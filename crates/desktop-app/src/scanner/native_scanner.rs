use anyhow::Result;
use graph_core::models::*;
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use rayon::prelude::*;
use walkdir::WalkDir;

#[allow(dead_code)]
#[derive(Debug, Clone, Default)]
pub struct GwtModuleInfo {
    pub file_path: String,
    pub module_name: String,
    pub rename_to: Option<String>,
    pub entry_points: Vec<String>,
    pub source_paths: Vec<String>,
    pub servlets: Vec<(String, String)>, // (path, class_name)
}

fn chrono_or_simple_time() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let secs = now % 60;
    let mins = (now / 60) % 60;
    let hours = (now / 3600 + 3) % 24; // Local timezone offset approximation
    format!("{:02}:{:02}:{:02}", hours, mins, secs)
}

#[derive(Debug, Clone, Default)]
pub struct GwtRpcServiceMapping {
    pub sync_interface: String,
    pub async_interface: Option<String>,
    pub server_servlet: Option<String>,
    pub rpc_path: String,
}

pub struct NativeJavaScanner {
    pkg_regex: Regex,
    class_regex: Regex,
    field_regex: Regex,
    method_regex: Regex,
    annotation_regex: Regex,
    pom_module_regex: Regex,
    gradle_include_regex: Regex,
    gwt_entry_point_regex: Regex,
    gwt_servlet_regex: Regex,
    gwt_rename_regex: Regex,
    gwt_rpc_path_regex: Regex,
    gwt_create_regex: Regex,
    method_call_regex: Regex,
}

impl Default for NativeJavaScanner {
    fn default() -> Self {
        Self::new()
    }
}

impl NativeJavaScanner {
    pub fn new() -> Self {
        Self {
            pkg_regex: Regex::new(r"package\s+([a-zA-Z0-9_.]+)\s*;").unwrap(),
            class_regex: Regex::new(
                r"(?m)(?:public|protected|private|static|final|abstract|\s)*\b(class|interface|enum|record|@interface)\s+([a-zA-Z0-9_]+)(?:<[^>]+>)?(?:\s+extends\s+([a-zA-Z0-9_.]+)(?:<[^>]+>)?)?(?:\s+implements\s+([a-zA-Z0-9_., <>]+))?",
            )
            .unwrap(),
            field_regex: Regex::new(
                r"(?m)^\s*(?:@([a-zA-Z0-9_]+(?:\([^)]*\))?)\s+)*(?:(public|protected|private)\s+)?(?:(?:final|static)\s+)*([a-zA-Z0-9_<>\[\]]+)\s+([a-zA-Z0-9_]+)\s*(?:=.*)?;",
            )
            .unwrap(),
            method_regex: Regex::new(
                r"(?m)^\s*(?:@([a-zA-Z0-9_]+(?:\([^)]*\))?)\s+)*(?:(public|protected|private)\s+)?(?:(?:final|static|abstract|synchronized)\s+)*([a-zA-Z0-9_<>\[\]]+)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)",
            )
            .unwrap(),
            annotation_regex: Regex::new(r"@([a-zA-Z0-9_]+)(?:\(([^)]*)\))?").unwrap(),
            pom_module_regex: Regex::new(r"<module>([^<]+)</module>").unwrap(),
            gradle_include_regex: Regex::new(r#"include\s+['"](?::)?([^'"]+)['"]"#).unwrap(),
            gwt_entry_point_regex: Regex::new(r#"<entry-point\s+class=['"]([^'"]+)['"]"#).unwrap(),
            gwt_servlet_regex: Regex::new(r#"<servlet\s+path=['"]([^'"]+)['"]\s+class=['"]([^'"]+)['"]"#).unwrap(),
            gwt_rename_regex: Regex::new(r#"<module\s+[^>]*rename-to=['"]([^'"]+)['"]"#).unwrap(),
            gwt_rpc_path_regex: Regex::new(r#"@RemoteServiceRelativePath\s*\(\s*["']([^"']+)["']\s*\)"#).unwrap(),
            gwt_create_regex: Regex::new(r#"GWT\s*\.\s*create\s*\(\s*([a-zA-Z0-9_]+)\.class\s*\)"#).unwrap(),
            method_call_regex: Regex::new(r#"(?:([a-zA-Z0-9_]+)\s*\.)?\s*([a-zA-Z0-9_]+)\s*\("#).unwrap(),
        }
    }

    #[allow(dead_code)]
    pub fn scan_project(&self, root_dir: &Path) -> Result<ProjectModel> {
        self.scan_project_with_progress(root_dir, |_| {})
    }

    pub fn scan_project_with_progress<F>(&self, root_dir: &Path, mut on_progress: F) -> Result<ProjectModel>
    where
        F: FnMut(ScanProgress) + Send + Sync,
    {
        let start_time = Instant::now();
        let project_name = root_dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("java-project")
            .to_string();

        let mut progress_logs = Vec::new();
        let add_log = |logs: &mut Vec<String>, msg: &str| {
            let time_str = chrono_or_simple_time();
            let line = format!("[{}] {}", time_str, msg);
            println!("{}", line);
            logs.push(line);
        };

        add_log(&mut progress_logs, &format!("🚀 Початок сканування проєкту '{}'...", project_name));

        on_progress(ScanProgress {
            is_scanning: true,
            stage: "Виявлення структури модулів та файлів".to_string(),
            stage_index: 1,
            total_stages: 4,
            processed_items: 0,
            total_items: 0,
            percentage: 5.0,
            current_file: None,
            modules_found: 0,
            packages_found: 0,
            classes_found: 0,
            relationships_found: 0,
            elapsed_ms: start_time.elapsed().as_millis() as u64,
            speed_items_per_sec: 0.0,
            eta_seconds: 0.0,
            logs: progress_logs.clone(),
            error: None,
        });

        let mut model = ProjectModel {
            project_name: project_name.clone(),
            root_path: root_dir.to_string_lossy().to_string(),
            modules: Vec::new(),
            packages: Vec::new(),
            classes: Vec::new(),
            relationships: Vec::new(),
            scan_time_ms: 0,
        };

        // 1. Detect Modules (Maven pom.xml / Gradle settings.gradle)
        self.detect_modules(root_dir, &mut model)?;

        // 2. Discover GWT Modules (*.gwt.xml) & Web Servlets (web.xml)
        let gwt_modules = self.discover_gwt_modules(root_dir);
        let web_servlets = self.discover_web_xml_servlets(root_dir);

        // Fast discovery of .java files with early pruning of build/cache directories
        let mut java_files: Vec<PathBuf> = Vec::new();
        let walker = WalkDir::new(root_dir).into_iter().filter_entry(|e| {
            let name = e.file_name().to_str().unwrap_or("");
            !(e.file_type().is_dir()
                && (name.starts_with('.')
                    || name == "target"
                    || name == "build"
                    || name == "node_modules"
                    || name == "bin"
                    || name == "out"
                    || name == "dist"
                    || name == "data"
                    || name == ".tools"
                    || name == ".javalens"))
        });

        for entry in walker.filter_map(|e| e.ok()) {
            if entry.file_type().is_file()
                && entry.path().extension().and_then(|s| s.to_str()) == Some("java")
            {
                java_files.push(entry.path().to_path_buf());
            }
        }

        let total_files = java_files.len();
        add_log(
            &mut progress_logs,
            &format!(
                "📦 [Етап 1/4] Виявлено {} Java файлів у {} модулях (знайдено {} GWT модулів)",
                total_files,
                model.modules.len(),
                gwt_modules.len()
            ),
        );

        on_progress(ScanProgress {
            is_scanning: true,
            stage: format!("Паралельний парсинг {} класів (Rayon)", total_files),
            stage_index: 2,
            total_stages: 4,
            processed_items: 0,
            total_items: total_files,
            percentage: 12.0,
            current_file: None,
            modules_found: model.modules.len(),
            packages_found: 0,
            classes_found: 0,
            relationships_found: 0,
            elapsed_ms: start_time.elapsed().as_millis() as u64,
            speed_items_per_sec: 0.0,
            eta_seconds: 0.0,
            logs: progress_logs.clone(),
            error: None,
        });

        // 3. Scan all .java files in parallel with Rayon
        let processed_counter = Arc::new(AtomicUsize::new(0));
        let _last_log_time = Arc::new(Mutex::new(Instant::now()));

        let modules_ref = &model.modules;
        let gwt_modules_ref = &gwt_modules;

        let parsed_results: Vec<Result<Vec<ClassInfo>>> = java_files
            .par_iter()
            .map(|file_path| {
                let res = self.parse_java_file(file_path, root_dir, modules_ref, gwt_modules_ref);
                processed_counter.fetch_add(1, Ordering::Relaxed);
                res
            })
            .collect();

        let mut classes_by_simple_name: HashMap<String, Vec<String>> = HashMap::new();
        let mut package_map: HashMap<String, PackageInfo> = HashMap::new();

        for res in parsed_results {
            if let Ok(class_infos) = res {
                for class_info in class_infos {
                    classes_by_simple_name
                        .entry(class_info.name.clone())
                        .or_default()
                        .push(class_info.id.clone());

                    // Track package
                    let pkg_entry = package_map
                        .entry(class_info.package_name.clone())
                        .or_insert_with(|| PackageInfo {
                            id: class_info.package_name.clone(),
                            name: class_info.package_name.clone(),
                            module_name: class_info.module_name.clone(),
                            class_ids: Vec::new(),
                            subpackage_ids: Vec::new(),
                            metrics: None,
                        });
                    pkg_entry.class_ids.push(class_info.id.clone());

                    model.classes.push(class_info);
                }
            }
        }

        let total_classes = model.classes.len();
        let total_packages = package_map.len();
        let parse_elapsed = start_time.elapsed().as_secs_f64();
        let parse_speed = if parse_elapsed > 0.0 {
            total_files as f64 / parse_elapsed
        } else {
            0.0
        };

        add_log(
            &mut progress_logs,
            &format!(
                "⚡ [Етап 2/4] Синтаксичний аналіз завершено: {} класів у {} пакетах ({:.0} файлів/сек)",
                total_classes, total_packages, parse_speed
            ),
        );

        on_progress(ScanProgress {
            is_scanning: true,
            stage: "Резолвінг зв'язків та GWT RPC мостів".to_string(),
            stage_index: 3,
            total_stages: 4,
            processed_items: total_files,
            total_items: total_files,
            percentage: 65.0,
            current_file: None,
            modules_found: model.modules.len(),
            packages_found: total_packages,
            classes_found: total_classes,
            relationships_found: 0,
            elapsed_ms: start_time.elapsed().as_millis() as u64,
            speed_items_per_sec: parse_speed,
            eta_seconds: 0.0,
            logs: progress_logs.clone(),
            error: None,
        });

        // 4. Resolve GWT RPC Mappings & Bridge Connections
        let gwt_rpc_mappings = self.build_gwt_rpc_mappings(&model.classes, &gwt_modules, &web_servlets);

        // 5. Resolve relationships between classes
        let mut relationships = Vec::new();
        let mut rel_id_counter = 1;
        let mut existing_rels: HashSet<(String, String, RelationKind)> = HashSet::new();

        // Index of all class FQCNs for fast lookup
        let class_ids_set: HashSet<String> = model.classes.iter().map(|c| c.id.clone()).collect();

        for class_info in &model.classes {
            // A. Inheritance (`extends`)
            if let Some(super_cls) = &class_info.super_class {
                let targets = self.resolve_type(super_cls, class_info, &classes_by_simple_name, &class_ids_set);
                for target_id in targets {
                    if target_id != class_info.id {
                        let key = (class_info.id.clone(), target_id.clone(), RelationKind::Extends);
                        if existing_rels.insert(key) {
                            relationships.push(Relationship {
                                id: format!("rel-{}", rel_id_counter),
                                source: class_info.id.clone(),
                                target: target_id,
                                kind: RelationKind::Extends,
                                description: Some("extends".to_string()),
                                is_circular: false,
                            });
                            rel_id_counter += 1;
                        }
                    }
                }
            }

            // B. Realization (`implements`)
            for iface in &class_info.interfaces {
                let targets = self.resolve_type(iface, class_info, &classes_by_simple_name, &class_ids_set);
                for target_id in targets {
                    if target_id != class_info.id {
                        let key = (class_info.id.clone(), target_id.clone(), RelationKind::Implements);
                        if existing_rels.insert(key) {
                            relationships.push(Relationship {
                                id: format!("rel-{}", rel_id_counter),
                                source: class_info.id.clone(),
                                target: target_id,
                                kind: RelationKind::Implements,
                                description: Some("implements".to_string()),
                                is_circular: false,
                            });
                            rel_id_counter += 1;
                        }
                    }
                }
            }

            // C. Fields & Injected dependencies
            for field in &class_info.fields {
                let targets = self.resolve_type(&field.type_name, class_info, &classes_by_simple_name, &class_ids_set);
                for target_id in targets {
                    if target_id != class_info.id {
                        let key = (class_info.id.clone(), target_id.clone(), RelationKind::FieldDependency);
                        if existing_rels.insert(key) {
                            let desc = if field.is_injected {
                                format!("@Autowired {}", field.name)
                            } else {
                                format!("field {}", field.name)
                            };
                            relationships.push(Relationship {
                                id: format!("rel-{}", rel_id_counter),
                                source: class_info.id.clone(),
                                target: target_id,
                                kind: RelationKind::FieldDependency,
                                description: Some(desc),
                                is_circular: false,
                            });
                            rel_id_counter += 1;
                        }
                    }
                }
            }

            // D. Referenced types in methods and signatures
            for ref_type in &class_info.referenced_types {
                let targets = self.resolve_type(ref_type, class_info, &classes_by_simple_name, &class_ids_set);
                for target_id in targets {
                    if target_id != class_info.id {
                        let key = (class_info.id.clone(), target_id.clone(), RelationKind::MethodCall);
                        if existing_rels.insert(key) {
                            relationships.push(Relationship {
                                id: format!("rel-{}", rel_id_counter),
                                source: class_info.id.clone(),
                                target: target_id,
                                kind: RelationKind::MethodCall,
                                description: Some("uses".to_string()),
                                is_circular: false,
                            });
                            rel_id_counter += 1;
                        }
                    }
                }
            }
        }

        // E. GWT RPC Binding & Client-to-Server RPC Call Connections
        for mapping in &gwt_rpc_mappings {
            // 1. Link Sync Interface <-> Server Implementation
            if let Some(ref srv) = mapping.server_servlet {
                let sync_key = (mapping.sync_interface.clone(), srv.clone(), RelationKind::GwtRpcBinding);
                if existing_rels.insert(sync_key) {
                    relationships.push(Relationship {
                        id: format!("rel-gwt-rpc-{}", rel_id_counter),
                        source: mapping.sync_interface.clone(),
                        target: srv.clone(),
                        kind: RelationKind::GwtRpcBinding,
                        description: Some(format!("GWT RPC Contract [{}]", mapping.rpc_path)),
                        is_circular: false,
                    });
                    rel_id_counter += 1;
                }

                // 2. Link Async Interface <-> Server Implementation
                if let Some(ref async_iface) = mapping.async_interface {
                    let async_key = (async_iface.clone(), srv.clone(), RelationKind::GwtRpcBinding);
                    if existing_rels.insert(async_key) {
                        relationships.push(Relationship {
                            id: format!("rel-gwt-rpc-{}", rel_id_counter),
                            source: async_iface.clone(),
                            target: srv.clone(),
                            kind: RelationKind::GwtRpcBinding,
                            description: Some(format!("GWT RPC Bridge [{}]", mapping.rpc_path)),
                            is_circular: false,
                        });
                        rel_id_counter += 1;
                    }
                }

                // 3. Find Client UI callers using this service and link them to the server servlet
                let sync_simple = mapping.sync_interface.split('.').last().unwrap_or(&mapping.sync_interface);
                let async_simple = mapping.async_interface.as_deref().map(|s| s.split('.').last().unwrap_or(s));

                for client_cls in &model.classes {
                    if client_cls.id == *srv || client_cls.id == mapping.sync_interface {
                        continue;
                    }
                    if let Some(ref a_id) = mapping.async_interface {
                        if client_cls.id == *a_id {
                            continue;
                        }
                    }

                    // Check if client class references sync or async service
                    let has_field = client_cls.fields.iter().any(|f| {
                        f.type_name == *sync_simple
                            || f.type_name == mapping.sync_interface
                            || async_simple.map(|a| f.type_name == a || f.type_name == mapping.async_interface.as_deref().unwrap_or("")).unwrap_or(false)
                    });

                    let has_ref = client_cls.referenced_types.iter().any(|r| {
                        r == sync_simple
                            || r == &mapping.sync_interface
                            || async_simple.map(|a| r == a || r == mapping.async_interface.as_deref().unwrap_or("")).unwrap_or(false)
                    });

                    if has_field || has_ref {
                        let rpc_call_key = (client_cls.id.clone(), srv.clone(), RelationKind::GwtRpcCall);
                        if existing_rels.insert(rpc_call_key) {
                            relationships.push(Relationship {
                                id: format!("rel-gwt-call-{}", rel_id_counter),
                                source: client_cls.id.clone(),
                                target: srv.clone(),
                                kind: RelationKind::GwtRpcCall,
                                description: Some(format!("GWT RPC [{}]", mapping.rpc_path)),
                                is_circular: false,
                            });
                            rel_id_counter += 1;
                        }
                    }
                }
            }
        }

        // 6. Derive Package-level and Module-level relationships
        let class_to_pkg: HashMap<String, String> = model.classes.iter().map(|c| (c.id.clone(), c.package_name.clone())).collect();
        let class_to_mod: HashMap<String, String> = model.classes.iter().map(|c| (c.id.clone(), c.module_name.clone())).collect();

        let mut pkg_rels: HashSet<(String, String)> = HashSet::new();
        let mut mod_rels: HashSet<(String, String)> = HashSet::new();
        let mut derived_rels = Vec::new();

        for rel in &relationships {
            if let (Some(src_pkg), Some(tgt_pkg)) = (class_to_pkg.get(&rel.source), class_to_pkg.get(&rel.target)) {
                if src_pkg != tgt_pkg && pkg_rels.insert((src_pkg.clone(), tgt_pkg.clone())) {
                    derived_rels.push(Relationship {
                        id: format!("rel-pkg-{}", rel_id_counter),
                        source: src_pkg.clone(),
                        target: tgt_pkg.clone(),
                        kind: RelationKind::PackageDependency,
                        description: Some("package dependency".to_string()),
                        is_circular: false,
                    });
                    rel_id_counter += 1;
                }
            }

            if let (Some(src_mod), Some(tgt_mod)) = (class_to_mod.get(&rel.source), class_to_mod.get(&rel.target)) {
                if !src_mod.is_empty() && !tgt_mod.is_empty() && src_mod != tgt_mod && mod_rels.insert((src_mod.clone(), tgt_mod.clone())) {
                    derived_rels.push(Relationship {
                        id: format!("rel-mod-{}", rel_id_counter),
                        source: src_mod.clone(),
                        target: tgt_mod.clone(),
                        kind: RelationKind::ModuleDependency,
                        description: Some("module dependency".to_string()),
                        is_circular: false,
                    });
                    rel_id_counter += 1;
                }
            }
        }
        relationships.extend(derived_rels);

        // 7. Detect mutual circular pairs
        let mut edge_pairs: HashSet<(String, String)> = HashSet::new();
        for r in &relationships {
            edge_pairs.insert((r.source.clone(), r.target.clone()));
        }
        for r in &mut relationships {
            if edge_pairs.contains(&(r.target.clone(), r.source.clone())) {
                r.is_circular = true;
            }
        }

        let total_relations = relationships.len();
        add_log(
            &mut progress_logs,
            &format!(
                "🔗 [Етап 3/4] Резолвінг залежностей: побудовано {} зв'язків",
                total_relations
            ),
        );

        on_progress(ScanProgress {
            is_scanning: true,
            stage: "Розрахунок архітектурних метрик та NoSQL збереження".to_string(),
            stage_index: 4,
            total_stages: 4,
            processed_items: total_files,
            total_items: total_files,
            percentage: 92.0,
            current_file: None,
            modules_found: model.modules.len(),
            packages_found: total_packages,
            classes_found: total_classes,
            relationships_found: total_relations,
            elapsed_ms: start_time.elapsed().as_millis() as u64,
            speed_items_per_sec: parse_speed,
            eta_seconds: 0.0,
            logs: progress_logs.clone(),
            error: None,
        });

        model.packages = package_map.into_values().collect();
        model.relationships = relationships;
        model.scan_time_ms = start_time.elapsed().as_millis() as u64;

        add_log(
            &mut progress_logs,
            &format!(
                "✅ [Етап 4/4] Сканування успішно завершено за {:.2}с ({} модулів, {} пакетів, {} класів, {} зв'язків)",
                model.scan_time_ms as f64 / 1000.0,
                model.modules.len(),
                model.packages.len(),
                model.classes.len(),
                model.relationships.len()
            ),
        );

        on_progress(ScanProgress {
            is_scanning: false,
            stage: "Сканування завершено".to_string(),
            stage_index: 4,
            total_stages: 4,
            processed_items: total_files,
            total_items: total_files,
            percentage: 100.0,
            current_file: None,
            modules_found: model.modules.len(),
            packages_found: model.packages.len(),
            classes_found: model.classes.len(),
            relationships_found: model.relationships.len(),
            elapsed_ms: model.scan_time_ms,
            speed_items_per_sec: parse_speed,
            eta_seconds: 0.0,
            logs: progress_logs,
            error: None,
        });

        Ok(model)
    }

    fn detect_modules(&self, root_dir: &Path, model: &mut ProjectModel) -> Result<()> {
        let pom_path = root_dir.join("pom.xml");
        let gradle_settings = root_dir.join("settings.gradle");
        let gradle_kts = root_dir.join("settings.gradle.kts");

        let mut found_modules = Vec::new();

        if pom_path.exists() {
            if let Ok(content) = fs::read_to_string(&pom_path) {
                for cap in self.pom_module_regex.captures_iter(&content) {
                    if let Some(m) = cap.get(1) {
                        let mod_name = m.as_str().trim();
                        let mod_path = root_dir.join(mod_name);
                        found_modules.push(ModuleInfo {
                            id: mod_name.to_string(),
                            name: mod_name.to_string(),
                            path: mod_path.to_string_lossy().to_string(),
                            build_type: "maven".to_string(),
                            direct_dependencies: Vec::new(),
                            exported_packages: Vec::new(),
                            afferent_coupling: 0,
                            efferent_coupling: 0,
                            instability: 0.0,
                        });
                    }
                }
            }
        }

        let gradle_path = if gradle_settings.exists() {
            Some(gradle_settings)
        } else if gradle_kts.exists() {
            Some(gradle_kts)
        } else {
            None
        };

        if let Some(gp) = gradle_path {
            if let Ok(content) = fs::read_to_string(&gp) {
                for cap in self.gradle_include_regex.captures_iter(&content) {
                    if let Some(m) = cap.get(1) {
                        let raw_name = m.as_str().trim().trim_start_matches(':');
                        let mod_name = raw_name.replace(':', "/");
                        let mod_path = root_dir.join(&mod_name);
                        found_modules.push(ModuleInfo {
                            id: raw_name.to_string(),
                            name: raw_name.to_string(),
                            path: mod_path.to_string_lossy().to_string(),
                            build_type: "gradle".to_string(),
                            direct_dependencies: Vec::new(),
                            exported_packages: Vec::new(),
                            afferent_coupling: 0,
                            efferent_coupling: 0,
                            instability: 0.0,
                        });
                    }
                }
            }
        }

        if found_modules.is_empty() {
            // Single module project
            let root_name = root_dir
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("root")
                .to_string();
            found_modules.push(ModuleInfo {
                id: root_name.clone(),
                name: root_name,
                path: root_dir.to_string_lossy().to_string(),
                build_type: if pom_path.exists() { "maven" } else { "standard" }.to_string(),
                direct_dependencies: Vec::new(),
                exported_packages: Vec::new(),
                afferent_coupling: 0,
                efferent_coupling: 0,
                instability: 0.0,
            });
        }

        model.modules = found_modules;
        Ok(())
    }

    /// Discover GWT module XML files (*.gwt.xml)
    fn discover_gwt_modules(&self, root_dir: &Path) -> Vec<GwtModuleInfo> {
        let mut modules = Vec::new();
        for entry in WalkDir::new(root_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().file_name().and_then(|s| s.to_str()).map(|s| s.ends_with(".gwt.xml")).unwrap_or(false))
        {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                let file_name = entry.path().file_stem().and_then(|s| s.to_str()).unwrap_or("Module").to_string();
                let rename_to = self.gwt_rename_regex.captures(&content).and_then(|c| c.get(1)).map(|m| m.as_str().to_string());
                
                let mut entry_points = Vec::new();
                for cap in self.gwt_entry_point_regex.captures_iter(&content) {
                    if let Some(m) = cap.get(1) {
                        entry_points.push(m.as_str().to_string());
                    }
                }

                let mut servlets = Vec::new();
                for cap in self.gwt_servlet_regex.captures_iter(&content) {
                    if let (Some(path_m), Some(cls_m)) = (cap.get(1), cap.get(2)) {
                        servlets.push((path_m.as_str().to_string(), cls_m.as_str().to_string()));
                    }
                }

                modules.push(GwtModuleInfo {
                    file_path: entry.path().to_string_lossy().to_string(),
                    module_name: file_name,
                    rename_to,
                    entry_points,
                    source_paths: vec!["client".to_string(), "shared".to_string()],
                    servlets,
                });
            }
        }
        modules
    }

    /// Discover web.xml servlet mappings (ServletClass -> url-pattern)
    fn discover_web_xml_servlets(&self, root_dir: &Path) -> HashMap<String, String> {
        let mut mappings = HashMap::new();
        let servlet_name_regex = Regex::new(r"<servlet-name>([^<]+)</servlet-name>").unwrap();
        let servlet_class_regex = Regex::new(r"<servlet-class>([^<]+)</servlet-class>").unwrap();
        let url_pattern_regex = Regex::new(r"<url-pattern>([^<]+)</url-pattern>").unwrap();

        for entry in WalkDir::new(root_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().file_name().and_then(|s| s.to_str()).map(|s| s.ends_with("web.xml")).unwrap_or(false))
        {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                let mut name_to_class = HashMap::new();
                let mut name_to_url = HashMap::new();

                for chunk in content.split("<servlet>") {
                    if let (Some(n_cap), Some(c_cap)) = (servlet_name_regex.captures(chunk), servlet_class_regex.captures(chunk)) {
                        if let (Some(name), Some(cls)) = (n_cap.get(1), c_cap.get(1)) {
                            name_to_class.insert(name.as_str().trim().to_string(), cls.as_str().trim().to_string());
                        }
                    }
                }

                for chunk in content.split("<servlet-mapping>") {
                    if let (Some(n_cap), Some(u_cap)) = (servlet_name_regex.captures(chunk), url_pattern_regex.captures(chunk)) {
                        if let (Some(name), Some(url)) = (n_cap.get(1), u_cap.get(1)) {
                            name_to_url.insert(name.as_str().trim().to_string(), url.as_str().trim().to_string());
                        }
                    }
                }

                for (name, cls) in name_to_class {
                    if let Some(url) = name_to_url.get(&name) {
                        mappings.insert(cls, url.clone());
                    }
                }
            }
        }
        mappings
    }

    /// Build GWT RPC Mappings by linking RemoteService sync interfaces, async interfaces, and servlets
    fn build_gwt_rpc_mappings(
        &self,
        classes: &[ClassInfo],
        gwt_modules: &[GwtModuleInfo],
        web_servlets: &HashMap<String, String>,
    ) -> Vec<GwtRpcServiceMapping> {
        let mut mappings = Vec::new();

        // 1. Find all GWT Sync interfaces (extends RemoteService or annotated with @RemoteServiceRelativePath)
        for c in classes {
            let is_remote_service = c.interfaces.iter().any(|i| i == "RemoteService" || i.ends_with(".RemoteService"))
                || c.annotations.iter().any(|a| a.starts_with("RemoteServiceRelativePath"));

            if is_remote_service && c.kind == ClassKind::Interface && !c.name.ends_with("Async") {
                let mut rpc_path = c.annotations.iter().find_map(|a| {
                    if a.starts_with("RemoteServiceRelativePath") {
                        let path = a.trim_start_matches("RemoteServiceRelativePath").trim_matches(|ch| ch == '(' || ch == ')' || ch == '"' || ch == '\'' || ch == ' ');
                        Some(path.to_string())
                    } else {
                        None
                    }
                }).unwrap_or_else(|| c.name.to_lowercase());

                // Find matching Async interface
                let async_name = format!("{}Async", c.name);
                let async_fqcn = classes.iter().find(|other| {
                    other.kind == ClassKind::Interface && (other.name == async_name || other.id == format!("{}.{}", c.package_name, async_name))
                }).map(|o| o.id.clone());

                // Find server implementation servlet
                let server_servlet = classes.iter().find(|other| {
                    if other.kind == ClassKind::Class {
                        let implements_sync = other.interfaces.iter().any(|i| i == &c.name || i == &c.id || i.ends_with(&c.name));
                        let is_servlet = other.super_class.as_deref() == Some("RemoteServiceServlet")
                            || other.super_class.as_deref().map(|s| s.ends_with("RemoteServiceServlet")).unwrap_or(false);
                        let name_matches = other.name == format!("{}Impl", c.name) || other.name.contains(&c.name);

                        implements_sync || (is_servlet && name_matches)
                    } else {
                        false
                    }
                }).map(|o| o.id.clone());

                // Check if path is overridden in web_servlets or gwt_modules
                if let Some(ref srv_id) = server_servlet {
                    if let Some(web_url) = web_servlets.get(srv_id) {
                        rpc_path = web_url.clone();
                    } else {
                        for gm in gwt_modules {
                            for (p, cls) in &gm.servlets {
                                if cls == srv_id || srv_id.ends_with(cls) {
                                    rpc_path = p.clone();
                                }
                            }
                        }
                    }
                }

                mappings.push(GwtRpcServiceMapping {
                    sync_interface: c.id.clone(),
                    async_interface: async_fqcn,
                    server_servlet,
                    rpc_path,
                });
            }
        }

        mappings
    }

    fn parse_java_file(
        &self,
        file_path: &Path,
        _root_dir: &Path,
        modules: &[ModuleInfo],
        gwt_modules: &[GwtModuleInfo],
    ) -> Result<Vec<ClassInfo>> {
        let content = fs::read_to_string(file_path)?;
        let lines: Vec<&str> = content.lines().collect();
        let loc = lines.len() as u32;

        // Extract package
        let package_name = self
            .pkg_regex
            .captures(&content)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| "default".to_string());

        // Determine module
        let mut module_name = "".to_string();
        for m in modules {
            if let Ok(rel) = file_path.strip_prefix(Path::new(&m.path)) {
                if !rel.as_os_str().is_empty() {
                    module_name = m.name.clone();
                    break;
                }
            }
        }
        if module_name.is_empty() && !modules.is_empty() {
            module_name = modules[0].name.clone();
        }

        // Extract class annotations & GWT annotations
        let mut class_annotations = Vec::new();
        for cap in self.annotation_regex.captures_iter(&content) {
            if let Some(m) = cap.get(1) {
                let name = m.as_str().to_string();
                if ["Service", "Component", "Repository", "Controller", "RestController", "Entity", "Configuration", "Bean", "UiField", "UiHandler", "UiTemplate", "Transactional"]
                    .contains(&name.as_str()) && !class_annotations.contains(&name)
                {
                    class_annotations.push(name);
                }
            }
        }

        // Check for GWT @RemoteServiceRelativePath("...")
        if let Some(cap) = self.gwt_rpc_path_regex.captures(&content) {
            if let Some(p) = cap.get(1) {
                class_annotations.push(format!("RemoteServiceRelativePath(\"{}\")", p.as_str()));
            }
        }

        // Extract classes declared in file
        let mut results = Vec::new();
        for cap in self.class_regex.captures_iter(&content) {
            let kind_str = cap.get(1).map(|m| m.as_str()).unwrap_or("class");
            let simple_name = cap.get(2).map(|m| m.as_str()).unwrap_or("").to_string();
            if simple_name.is_empty() {
                continue;
            }

            let kind = match kind_str {
                "interface" => ClassKind::Interface,
                "enum" => ClassKind::Enum,
                "record" => ClassKind::Record,
                "@interface" => ClassKind::Annotation,
                _ => {
                    if content.contains(&format!("abstract class {}", simple_name)) {
                        ClassKind::AbstractClass
                    } else {
                        ClassKind::Class
                    }
                }
            };

            let super_class = cap.get(3).map(|m| {
                m.as_str()
                    .split('<')
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string()
            });

            let interfaces: Vec<String> = cap
                .get(4)
                .map(|m| {
                    m.as_str()
                        .split(',')
                        .map(|s| s.split('<').next().unwrap_or("").trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_default();

            let fqcn = if package_name == "default" {
                simple_name.clone()
            } else {
                format!("{}.{}", package_name, simple_name)
            };

            // Extract fields
            let mut fields = Vec::new();
            for f_cap in self.field_regex.captures_iter(&content) {
                let ann = f_cap.get(1).map(|m| m.as_str().to_string());
                let vis = f_cap.get(2).map(|m| m.as_str()).unwrap_or("package").to_string();
                let type_name = f_cap.get(3).map(|m| m.as_str()).unwrap_or("").to_string();
                let f_name = f_cap.get(4).map(|m| m.as_str()).unwrap_or("").to_string();
                let is_static = content.contains(&format!("static {} {}", type_name, f_name))
                    || content.contains(&format!("static final {} {}", type_name, f_name));

                let is_injected = ann.as_deref() == Some("Autowired")
                    || ann.as_deref() == Some("Inject")
                    || content.contains(&format!("@Autowired\n    private {} {}", type_name, f_name))
                    || content.contains(&format!("@UiField\n    {} {}", type_name, f_name));

                let mut field_anns = Vec::new();
                if let Some(a) = ann {
                    field_anns.push(a);
                }

                if !type_name.is_empty() && !f_name.is_empty() {
                    fields.push(FieldInfo {
                        id: format!("{}#{}", fqcn, f_name),
                        name: f_name,
                        type_name,
                        is_injected,
                        annotations: field_anns,
                        visibility: vis,
                        is_static,
                    });
                }
            }

            // Extract methods and parse detailed parameters and bodies
            let mut methods = Vec::new();
            for m_cap in self.method_regex.captures_iter(&content) {
                let ann = m_cap.get(1).map(|m| m.as_str().to_string());
                let vis = m_cap.get(2).map(|m| m.as_str()).unwrap_or("public").to_string();
                let ret_type = m_cap.get(3).map(|m| m.as_str()).unwrap_or("void").to_string();
                let m_name = m_cap.get(4).map(|m| m.as_str()).unwrap_or("").to_string();
                let params_raw = m_cap.get(5).map(|m| m.as_str()).unwrap_or("");
                let is_static = content.contains(&format!("static {} {}(", ret_type, m_name))
                    || content.contains(&format!("static final {} {}(", ret_type, m_name));

                if m_name.is_empty() || ["if", "for", "while", "switch", "catch"].contains(&m_name.as_str()) {
                    continue;
                }

                // Detailed parameters extraction
                let mut parameters = Vec::new();
                for param_str in params_raw.split(',') {
                    let p_trimmed = param_str.trim();
                    if !p_trimmed.is_empty() {
                        let parts: Vec<&str> = p_trimmed.split_whitespace().collect();
                        if parts.len() >= 2 {
                            let p_type = parts[parts.len() - 2].to_string();
                            let p_name = parts[parts.len() - 1].to_string();
                            let mut p_anns = Vec::new();
                            for part in &parts[..parts.len() - 2] {
                                if part.starts_with('@') {
                                    p_anns.push(part.trim_start_matches('@').to_string());
                                }
                            }
                            parameters.push(ParameterInfo {
                                name: p_name,
                                type_name: p_type,
                                annotations: p_anns,
                            });
                        } else if parts.len() == 1 {
                            parameters.push(ParameterInfo {
                                name: "arg".to_string(),
                                type_name: parts[0].to_string(),
                                annotations: Vec::new(),
                            });
                        }
                    }
                }

                let param_types_summary = parameters.iter().map(|p| p.type_name.clone()).collect::<Vec<_>>().join(", ");
                let method_id = format!("{}#{}({})", fqcn, m_name, param_types_summary);

                // Method body call & field analysis
                let mut called_methods = Vec::new();
                let mut used_fields = Vec::new();

                // Scan content for calls made by this class/method
                for call_cap in self.method_call_regex.captures_iter(&content) {
                    let receiver = call_cap.get(1).map(|m| m.as_str().to_string());
                    let called_name = call_cap.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();

                    if !called_name.is_empty() && called_name != m_name && !["if", "for", "while", "switch", "println", "print", "equals", "toString", "hashCode"].contains(&called_name.as_str()) {
                        if let Some(rec) = receiver {
                            // If receiver matches a field, record field call
                            if let Some(f) = fields.iter().find(|f| f.name == rec) {
                                let target_call = format!("{}#{}", f.type_name, called_name);
                                if !called_methods.contains(&target_call) {
                                    called_methods.push(target_call);
                                }
                                if !used_fields.contains(&f.name) {
                                    used_fields.push(f.name.clone());
                                }
                            } else {
                                let target_call = format!("{}#{}", rec, called_name);
                                if !called_methods.contains(&target_call) {
                                    called_methods.push(target_call);
                                }
                            }
                        } else {
                            if !called_methods.contains(&called_name) {
                                called_methods.push(called_name);
                            }
                        }
                    }
                }

                // Check field usages
                for f in &fields {
                    if content.contains(&format!("{}.{}", f.name, "")) || content.contains(&format!("this.{}", f.name)) || content.contains(&format!("{} =", f.name)) {
                        if !used_fields.contains(&f.name) {
                            used_fields.push(f.name.clone());
                        }
                    }
                }

                let mut method_anns = Vec::new();
                if let Some(a) = ann {
                    method_anns.push(a);
                }

                methods.push(MethodInfo {
                    id: method_id,
                    name: m_name,
                    return_type: ret_type,
                    parameters,
                    annotations: method_anns,
                    line_number: 1,
                    visibility: vis,
                    is_static,
                    called_methods,
                    used_fields,
                });
            }

            // Extract referenced types (word matches in body, including GWT.create)
            let mut referenced_types = Vec::new();
            let type_word_regex = Regex::new(r"\b([A-Z][a-zA-Z0-9_]+)\b").unwrap();
            for w_cap in type_word_regex.captures_iter(&content) {
                if let Some(w) = w_cap.get(1) {
                    let word = w.as_str().to_string();
                    if word != simple_name
                        && !["String", "Integer", "Long", "Double", "Boolean", "List", "Map", "Set", "Optional", "Object", "Override", "Autowired", "Service", "Component", "Repository", "GWT", "AsyncCallback"].contains(&word.as_str())
                        && !referenced_types.contains(&word)
                    {
                        referenced_types.push(word);
                    }
                }
            }

            // Explicitly capture GWT.create(FooService.class)
            for gwt_cap in self.gwt_create_regex.captures_iter(&content) {
                if let Some(m) = gwt_cap.get(1) {
                    let gwt_service_name = m.as_str().to_string();
                    if !referenced_types.contains(&gwt_service_name) {
                        referenced_types.push(gwt_service_name);
                    }
                }
            }

            // Detect GWT roles
            let is_gwt_entry_point = interfaces.iter().any(|i| i == "EntryPoint" || i.ends_with(".EntryPoint"))
                || gwt_modules.iter().any(|gm| gm.entry_points.contains(&fqcn));

            let is_gwt_rpc_sync = interfaces.iter().any(|i| i == "RemoteService" || i.ends_with(".RemoteService"))
                || class_annotations.iter().any(|a| a.starts_with("RemoteServiceRelativePath"));

            let is_gwt_rpc_servlet = super_class.as_deref() == Some("RemoteServiceServlet")
                || super_class.as_deref().map(|s| s.ends_with("RemoteServiceServlet")).unwrap_or(false);

            let is_gwt_ui = (is_gwt_entry_point
                || package_name.contains("client")
                || simple_name.ends_with("View")
                || simple_name.ends_with("Presenter")
                || simple_name.ends_with("Widget")
                || simple_name.ends_with("Async")
                || interfaces.iter().any(|i| i == "IsWidget"))
                && !is_gwt_rpc_sync
                && !is_gwt_rpc_servlet;

            if is_gwt_entry_point {
                class_annotations.push("GWT:EntryPoint".to_string());
            }
            if is_gwt_rpc_sync {
                class_annotations.push("GWT:RemoteService".to_string());
            }
            if is_gwt_rpc_servlet {
                class_annotations.push("GWT:RemoteServiceServlet".to_string());
            }

            // Detect Architecture Layer (with GWT intelligence)
            let layer = if is_gwt_rpc_sync || class_annotations.iter().any(|a| a == "Service")
                || (package_name.contains("service") && !is_gwt_ui) || package_name.contains("business") || (simple_name.ends_with("Service") && !is_gwt_ui) || simple_name.ends_with("UseCase") || simple_name.ends_with("Manager")
            {
                ArchitectureLayer::Service
            } else if is_gwt_rpc_servlet || class_annotations.iter().any(|a| a == "Repository")
                || package_name.contains("repository") || package_name.contains("dao") || package_name.contains("infra") || package_name.contains("database") || simple_name.ends_with("Repository") || simple_name.ends_with("Dao") || simple_name.ends_with("Servlet")
            {
                ArchitectureLayer::Infrastructure
            } else if is_gwt_entry_point || is_gwt_ui || class_annotations.iter().any(|a| a == "Controller" || a == "RestController")
                || package_name.contains("controller") || package_name.contains("web") || package_name.contains("ui") || package_name.contains("rest") || simple_name.ends_with("Controller") || simple_name.ends_with("Panel") || simple_name.ends_with("View") || simple_name.ends_with("Widget") || simple_name.ends_with("Presenter")
            {
                ArchitectureLayer::UI
            } else if class_annotations.iter().any(|a| a == "Entity")
                || package_name.contains("model") || package_name.contains("domain") || package_name.contains("shared") || package_name.contains("entity") || package_name.contains("dto") || simple_name.ends_with("Entity") || simple_name.ends_with("Dto") || simple_name.ends_with("VO") || interfaces.iter().any(|i| i == "IsSerializable")
            {
                ArchitectureLayer::Domain
            } else {
                ArchitectureLayer::Unknown
            };

            results.push(ClassInfo {
                id: fqcn,
                name: simple_name,
                package_name: package_name.clone(),
                module_name: module_name.clone(),
                layer,
                file_path: file_path.to_string_lossy().to_string(),
                line_number: 1,
                kind,
                is_public: content.contains("public class") || content.contains("public interface"),
                loc,
                super_class,
                interfaces,
                annotations: class_annotations.clone(),
                fields,
                methods,
                referenced_types,
            });
        }

        Ok(results)
    }

    fn resolve_type(
        &self,
        type_name: &str,
        current_class: &ClassInfo,
        by_simple_name: &HashMap<String, Vec<String>>,
        all_ids: &HashSet<String>,
    ) -> Vec<String> {
        let clean_type = type_name.split('<').next().unwrap_or(type_name).trim();

        // 1. If it's already an FQCN
        if all_ids.contains(clean_type) {
            return vec![clean_type.to_string()];
        }

        // 2. Same package
        let same_pkg_fqcn = format!("{}.{}", current_class.package_name, clean_type);
        if all_ids.contains(&same_pkg_fqcn) {
            return vec![same_pkg_fqcn];
        }

        // 3. Lookup by simple name
        if let Some(fqcns) = by_simple_name.get(clean_type) {
            return fqcns.clone();
        }

        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_gwt_project_scanning_and_rpc_bridges() {
        let root = PathBuf::from("fixtures/sample-gwt-app");
        let target_dir = if root.exists() { root } else { PathBuf::from("../../fixtures/sample-gwt-app") };

        let scanner = NativeJavaScanner::new();
        let model = scanner.scan_project(&target_dir).expect("Failed to scan GWT fixture");

        assert_eq!(model.project_name, "sample-gwt-app");
        assert!(model.classes.len() >= 8, "Expected at least 8 classes, got {}", model.classes.len());

        // Verify GWT EntryPoint
        let entry_point = model.classes.iter().find(|c| c.name == "AppEntryPoint").expect("AppEntryPoint not found");
        assert_eq!(entry_point.layer, ArchitectureLayer::UI);
        assert!(entry_point.annotations.iter().any(|a| a.contains("GWT:EntryPoint")));

        // Verify GWT RPC Sync Service
        let sync_service = model.classes.iter().find(|c| c.name == "GreetingService").expect("GreetingService not found");
        assert_eq!(sync_service.layer, ArchitectureLayer::Service);
        assert!(sync_service.annotations.iter().any(|a| a.contains("RemoteServiceRelativePath")));

        // Verify GWT Server Servlet
        let servlet = model.classes.iter().find(|c| c.name == "GreetingServiceImpl").expect("GreetingServiceImpl not found");
        assert_eq!(servlet.layer, ArchitectureLayer::Infrastructure);
        assert!(servlet.annotations.iter().any(|a| a.contains("GWT:RemoteServiceServlet")));

        // Verify GWT RPC Bridge & Call Relationships
        let rpc_call = model.relationships.iter().find(|r| r.kind == RelationKind::GwtRpcCall);
        assert!(rpc_call.is_some(), "GWT RPC Call relationship from Presenter to Servlet should be detected!");
        let rpc = rpc_call.unwrap();
        assert_eq!(rpc.source, "com.example.gwtapp.client.presenter.GreetingPresenter");
        assert_eq!(rpc.target, "com.example.gwtapp.server.GreetingServiceImpl");

        let rpc_binding = model.relationships.iter().find(|r| r.kind == RelationKind::GwtRpcBinding && r.source.contains("GreetingServiceAsync"));
        assert!(rpc_binding.is_some(), "GWT RPC Bridge relationship from Async interface to Servlet should be detected!");

        // Verify detailed parameters on methods
        let presenter = model.classes.iter().find(|c| c.name == "GreetingPresenter").unwrap();
        let on_send_btn = presenter.methods.iter().find(|m| m.name == "onSendButtonClicked").unwrap();
        assert!(on_send_btn.called_methods.iter().any(|c| c.contains("greetServer")));
    }
}
