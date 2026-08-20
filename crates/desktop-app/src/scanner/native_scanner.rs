use anyhow::Result;
use graph_core::models::*;
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
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
    import_regex: Regex,
    class_regex: Regex,
    field_regex: Regex,
    method_regex: Regex,
    annotation_regex: Regex,
    #[allow(dead_code)]
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
            import_regex: Regex::new(r"import\s+(?:static\s+)?([a-zA-Z0-9_.]+)\s*;").unwrap(),
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

        add_log(&mut progress_logs, &format!("🚀 Початок сканування проєкту '{}' (Шлях: '{}')...", project_name, root_dir.display()));

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
        add_log(&mut progress_logs, "🔍 [Етап 1.1] Пошук дескрипторів збірки (pom.xml, build.gradle, settings.gradle)...");
        self.detect_modules(root_dir, &mut model)?;
        if !model.modules.is_empty() {
            let mod_names: Vec<&str> = model.modules.iter().map(|m| m.name.as_str()).take(10).collect();
            add_log(
                &mut progress_logs,
                &format!(
                    "📦 [Етап 1.1] Виявлено {} модулів: {}{}",
                    model.modules.len(),
                    mod_names.join(", "),
                    if model.modules.len() > 10 { " ..." } else { "" }
                ),
            );
        } else {
            add_log(&mut progress_logs, "📦 [Етап 1.1] Монолітний проєкт (окремих підмодулів не виявлено).");
        }

        // 2. Discover GWT Modules (*.gwt.xml) & Web Servlets (web.xml)
        add_log(&mut progress_logs, "🌐 [Етап 1.2] Пошук дескрипторів GWT (*.gwt.xml) та сервлетів (web.xml)...");
        let gwt_modules = self.discover_gwt_modules(root_dir);
        let web_servlets = self.discover_web_xml_servlets(root_dir);
        if !gwt_modules.is_empty() {
            add_log(
                &mut progress_logs,
                &format!(
                    "🌐 [Етап 1.2] Знайдено {} GWT модулів та {} сервлетів у web.xml",
                    gwt_modules.len(),
                    web_servlets.len()
                ),
            );
            for gwt in gwt_modules.iter().take(5) {
                add_log(
                    &mut progress_logs,
                    &format!(
                        "   ↳ GWT модуль: '{}' (rename-to: '{}', entry-points: {})",
                        gwt.module_name,
                        gwt.rename_to.as_deref().unwrap_or("-"),
                        gwt.entry_points.len()
                    ),
                );
            }
        }

        // Fast discovery of .java files with early pruning of build/cache directories
        add_log(&mut progress_logs, "📂 [Етап 1.3] Обхід дерева файлів та пошук вихідного коду Java (*.java)...");
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
        let discovery_ms = start_time.elapsed().as_millis();
        add_log(
            &mut progress_logs,
            &format!(
                "✅ [Етап 1/4] Виявлено {} Java файлів у {} модулях за {}мс",
                total_files,
                model.modules.len(),
                discovery_ms
            ),
        );

        if total_files == 0 {
            add_log(&mut progress_logs, "⚠️ [WARN] У каталозі не знайдено жодного *.java файлу.");
        }

        on_progress(ScanProgress {
            is_scanning: true,
            stage: format!("Паралельний парсинг {} класів (Rayon)", total_files),
            stage_index: 2,
            total_stages: 4,
            processed_items: 0,
            total_items: total_files,
            percentage: 15.0,
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
        add_log(
            &mut progress_logs,
            &format!("⚡ [Етап 2/4] Запуск паралельного синтаксичного аналізу AST для {} файлів на пулі Rayon...", total_files),
        );
        let processed_counter = Arc::new(AtomicUsize::new(0));

        let modules_ref = &model.modules;
        let gwt_modules_ref = &gwt_modules;

        let parse_start = Instant::now();
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
        let mut parse_errors_count = 0;

        for res in parsed_results {
            match res {
                Ok(class_infos) => {
                    for class_info in class_infos {
                        classes_by_simple_name
                            .entry(class_info.name.clone())
                            .or_default()
                            .push(class_info.id.clone());

                        // Index inner class under short name and dot/dollar variants
                        if class_info.name.contains('.') {
                            let last_part = class_info.name.split('.').last().unwrap_or(&class_info.name);
                            classes_by_simple_name
                                .entry(last_part.to_string())
                                .or_default()
                                .push(class_info.id.clone());

                            let dollar_variant = class_info.name.replace('.', "$");
                            classes_by_simple_name
                                .entry(dollar_variant)
                                .or_default()
                                .push(class_info.id.clone());
                        }

                        // Track package per module
                        let pkg_key = format!("{}::{}", class_info.module_name, class_info.package_name);
                        let pkg_entry = package_map
                            .entry(pkg_key)
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
                Err(_) => {
                    parse_errors_count += 1;
                }
            }
        }

        let total_classes = model.classes.len();
        let total_packages = package_map.len();
        let parse_elapsed_sec = parse_start.elapsed().as_secs_f64();
        let parse_speed = if parse_elapsed_sec > 0.0 {
            total_files as f64 / parse_elapsed_sec
        } else {
            0.0
        };

        add_log(
            &mut progress_logs,
            &format!(
                "⚡ [Етап 2/4] Синтаксичний аналіз завершено: {} класів у {} пакетах ({:.0} файлів/сек, час: {:.2}с, помилок: {})",
                total_classes, total_packages, parse_speed, parse_elapsed_sec, parse_errors_count
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

            // D. Actual Method Calls extracted from method bodies
            for method in &class_info.methods {
                for called_ref in &method.called_methods {
                    let called_cls_name = if called_ref.contains('#') {
                        called_ref.split('#').next().unwrap_or("")
                    } else {
                        ""
                    };

                    if !called_cls_name.is_empty() {
                        let targets = self.resolve_type(called_cls_name, class_info, &classes_by_simple_name, &class_ids_set);
                        for target_id in targets {
                            if target_id != class_info.id {
                                let key = (class_info.id.clone(), target_id.clone(), RelationKind::MethodCall);
                                if existing_rels.insert(key) {
                                    let method_name = called_ref.split('#').nth(1).unwrap_or(called_ref);
                                    relationships.push(Relationship {
                                        id: format!("rel-{}", rel_id_counter),
                                        source: class_info.id.clone(),
                                        target: target_id,
                                        kind: RelationKind::MethodCall,
                                        description: Some(format!("calls {}", method_name)),
                                        is_circular: false,
                                    });
                                    rel_id_counter += 1;
                                }
                            }
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
        let mut found_modules = Vec::new();
        let mut discovered_paths = HashSet::new();

        let artifact_id_regex = Regex::new(r"<artifactId>([^<]+)</artifactId>").unwrap();

        // 1. Walk entire project tree to discover all pom.xml, build.gradle, and build.gradle.kts
        for entry in WalkDir::new(root_dir)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_str().unwrap_or("");
                !(e.file_type().is_dir()
                    && (name.starts_with('.')
                        || name == "target"
                        || name == "build"
                        || name == "node_modules"
                        || name == "bin"
                        || name == "out"
                        || name == "dist"
                        || name == ".tools"
                        || name == ".javalens"))
            })
            .filter_map(|e| e.ok())
        {
            let file_name = entry.file_name().to_str().unwrap_or("");
            let is_pom = file_name == "pom.xml";
            let is_gradle = file_name == "build.gradle" || file_name == "build.gradle.kts";

            if is_pom || is_gradle {
                let dir_path = entry.path().parent().unwrap_or(root_dir);
                let dir_path_str = dir_path.to_string_lossy().to_string();

                if discovered_paths.insert(dir_path_str.clone()) {
                    let mut mod_name = dir_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("module")
                        .to_string();

                    // If it's a pom.xml, extract artifactId if available
                    if is_pom {
                        if let Ok(content) = fs::read_to_string(entry.path()) {
                            // First artifactId or submodule name
                            if let Some(cap) = artifact_id_regex.captures(&content) {
                                if let Some(a_id) = cap.get(1) {
                                    let parsed_name = a_id.as_str().trim();
                                    if !parsed_name.is_empty() {
                                        mod_name = parsed_name.to_string();
                                    }
                                }
                            }
                        }
                    }

                    // Check if module is the root directory
                    let is_root = dir_path == root_dir;
                    let display_id = if is_root {
                        root_dir.file_name().and_then(|n| n.to_str()).unwrap_or("root").to_string()
                    } else {
                        mod_name.clone()
                    };

                    found_modules.push(ModuleInfo {
                        id: display_id.clone(),
                        name: display_id,
                        path: dir_path_str,
                        build_type: if is_pom { "maven".to_string() } else { "gradle".to_string() },
                        direct_dependencies: Vec::new(),
                        exported_packages: Vec::new(),
                        afferent_coupling: 0,
                        efferent_coupling: 0,
                        instability: 0.0,
                    });
                }
            }
        }

        // 2. Also parse Gradle settings.gradle if present
        let gradle_settings = root_dir.join("settings.gradle");
        let gradle_kts = root_dir.join("settings.gradle.kts");
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
                        let mod_path_str = mod_path.to_string_lossy().to_string();

                        if discovered_paths.insert(mod_path_str.clone()) {
                            found_modules.push(ModuleInfo {
                                id: raw_name.to_string(),
                                name: raw_name.to_string(),
                                path: mod_path_str,
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
        }

        // If submodules exist and root also exists, remove root if root contains no direct java files of its own
        if found_modules.len() > 1 {
            found_modules.retain(|m| {
                if m.path == root_dir.to_string_lossy() {
                    // Check if root directly has src/main/java
                    let root_src = root_dir.join("src").join("main").join("java");
                    root_src.exists()
                } else {
                    true
                }
            });
        }

        if found_modules.is_empty() {
            let root_name = root_dir
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("root")
                .to_string();
            found_modules.push(ModuleInfo {
                id: root_name.clone(),
                name: root_name,
                path: root_dir.to_string_lossy().to_string(),
                build_type: "standard".to_string(),
                direct_dependencies: Vec::new(),
                exported_packages: Vec::new(),
                afferent_coupling: 0,
                efferent_coupling: 0,
                instability: 0.0,
            });
        }

        // Sort modules by path length descending so most specific nested submodules match first
        found_modules.sort_by(|a, b| b.path.len().cmp(&a.path.len()));

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
            let mod_path = Path::new(&m.path);
            if file_path.starts_with(mod_path) {
                module_name = m.name.clone();
                break;
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

        // Extract imports
        let mut imports: HashMap<String, String> = HashMap::new();
        for imp_cap in self.import_regex.captures_iter(&content) {
            if let Some(imp) = imp_cap.get(1) {
                let fqcn_str = imp.as_str().trim();
                let simple_name = fqcn_str.split('.').last().unwrap_or(fqcn_str);
                imports.insert(simple_name.to_string(), fqcn_str.to_string());
            }
        }

        let file_stem = file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

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

            // Check if this is an inner/nested class within the file
            let is_inner_class = !file_stem.is_empty()
                && simple_name != file_stem
                && (content.contains(&format!("class {}", file_stem))
                    || content.contains(&format!("interface {}", file_stem))
                    || content.contains(&format!("enum {}", file_stem)));

            let display_name = if is_inner_class {
                format!("{}.{}", file_stem, simple_name)
            } else {
                simple_name.clone()
            };

            let fqcn = if package_name == "default" {
                display_name.clone()
            } else {
                format!("{}.{}", package_name, display_name)
            };

            // Extract fields
            let mut fields = Vec::new();
            let mut field_type_map: HashMap<String, String> = HashMap::new();
            for f_cap in self.field_regex.captures_iter(&content) {
                let ann = f_cap.get(1).map(|m| m.as_str().to_string());
                let vis = f_cap.get(2).map(|m| m.as_str()).unwrap_or("package").to_string();
                let type_name = f_cap.get(3).map(|m| m.as_str().split('<').next().unwrap_or("").trim().to_string()).unwrap_or_default();
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
                    field_type_map.insert(f_name.clone(), type_name.clone());
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
            let method_matches: Vec<_> = self.method_regex.captures_iter(&content).collect();
            let local_var_regex = Regex::new(r"\b([A-Z][a-zA-Z0-9_<>]+)\s+([a-zA-Z0-9_]+)\s*=").unwrap();

            for (idx, m_cap) in method_matches.iter().enumerate() {
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
                let mut param_type_map: HashMap<String, String> = HashMap::new();
                for param_str in params_raw.split(',') {
                    let p_trimmed = param_str.trim();
                    if !p_trimmed.is_empty() {
                        let parts: Vec<&str> = p_trimmed.split_whitespace().collect();
                        if parts.len() >= 2 {
                            let p_type = parts[parts.len() - 2].split('<').next().unwrap_or(parts[parts.len() - 2]).to_string();
                            let p_name = parts[parts.len() - 1].to_string();
                            let mut p_anns = Vec::new();
                            for part in &parts[..parts.len() - 2] {
                                if part.starts_with('@') {
                                    p_anns.push(part.trim_start_matches('@').to_string());
                                }
                            }
                            param_type_map.insert(p_name.clone(), p_type.clone());
                            parameters.push(ParameterInfo {
                                name: p_name,
                                type_name: p_type,
                                annotations: p_anns,
                            });
                        } else if parts.len() == 1 {
                            let p_type = parts[0].split('<').next().unwrap_or(parts[0]).to_string();
                            param_type_map.insert("arg".to_string(), p_type.clone());
                            parameters.push(ParameterInfo {
                                name: "arg".to_string(),
                                type_name: p_type,
                                annotations: Vec::new(),
                            });
                        }
                    }
                }

                let param_types_summary = parameters.iter().map(|p| p.type_name.clone()).collect::<Vec<_>>().join(", ");
                let method_id = format!("{}#{}({})", fqcn, m_name, param_types_summary);

                // Extract method body slice (from header end to next method or next 4000 chars)
                let start_pos = m_cap.get(0).map(|m| m.end()).unwrap_or(0);
                let end_pos = if idx + 1 < method_matches.len() {
                    method_matches[idx + 1].get(0).map(|m| m.start()).unwrap_or(content.len())
                } else {
                    content.len()
                };

                let body_slice = if start_pos < end_pos && end_pos <= content.len() {
                    &content[start_pos..end_pos]
                } else {
                    ""
                };

                // Extract local variables inside method body
                let mut local_vars: HashMap<String, String> = HashMap::new();
                for lv_cap in local_var_regex.captures_iter(body_slice) {
                    if let (Some(t), Some(n)) = (lv_cap.get(1), lv_cap.get(2)) {
                        let clean_t = t.as_str().split('<').next().unwrap_or(t.as_str()).trim();
                        local_vars.insert(n.as_str().to_string(), clean_t.to_string());
                    }
                }

                // Method body call & field analysis
                let mut called_methods = Vec::new();
                let mut used_fields = Vec::new();

                for call_cap in self.method_call_regex.captures_iter(body_slice) {
                    let receiver = call_cap.get(1).map(|m| m.as_str().to_string());
                    let called_name = call_cap.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();

                    if !called_name.is_empty() && called_name != m_name && !["if", "for", "while", "switch", "println", "print", "equals", "toString", "hashCode"].contains(&called_name.as_str()) {
                        if let Some(rec) = receiver {
                            if rec == "this" {
                                let target_call = format!("{}#{}", fqcn, called_name);
                                if !called_methods.contains(&target_call) {
                                    called_methods.push(target_call);
                                }
                            } else if let Some(var_type) = local_vars.get(&rec) {
                                let target_call = format!("{}#{}", var_type, called_name);
                                if !called_methods.contains(&target_call) {
                                    called_methods.push(target_call);
                                }
                            } else if let Some(param_type) = param_type_map.get(&rec) {
                                let target_call = format!("{}#{}", param_type, called_name);
                                if !called_methods.contains(&target_call) {
                                    called_methods.push(target_call);
                                }
                            } else if let Some(field_type) = field_type_map.get(&rec) {
                                let target_call = format!("{}#{}", field_type, called_name);
                                if !called_methods.contains(&target_call) {
                                    called_methods.push(target_call);
                                }
                                if !used_fields.contains(&rec) {
                                    used_fields.push(rec);
                                }
                            } else if let Some(imp_fqcn) = imports.get(&rec) {
                                let target_call = format!("{}#{}", imp_fqcn, called_name);
                                if !called_methods.contains(&target_call) {
                                    called_methods.push(target_call);
                                }
                            } else {
                                let target_call = format!("{}#{}", rec, called_name);
                                if !called_methods.contains(&target_call) {
                                    called_methods.push(target_call);
                                }
                            }
                        } else {
                            // Direct call without receiver
                            let target_call = format!("{}#{}", fqcn, called_name);
                            if !called_methods.contains(&target_call) {
                                called_methods.push(target_call);
                            }
                        }
                    }
                }

                // Check field usages in this method
                for f in &fields {
                    if body_slice.contains(&format!("{}.", f.name)) || body_slice.contains(&format!("this.{}", f.name)) || body_slice.contains(&format!("{} =", f.name)) {
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

            // Extract legitimate referenced types strictly from code (imports, fields, method signatures, GWT.create)
            let mut referenced_types = Vec::new();
            let add_ref = |t: &str, refs: &mut Vec<String>| {
                let clean = t.split('<').next().unwrap_or(t).trim_matches(|c: char| c == '[' || c == ']' || c.is_whitespace());
                if !clean.is_empty()
                    && clean != simple_name
                    && !["void", "int", "long", "double", "float", "boolean", "byte", "char", "short",
                         "String", "Integer", "Long", "Double", "Float", "Boolean", "Byte", "Character", "Short",
                         "List", "Map", "Set", "Collection", "Optional", "Object", "Override", "Autowired",
                         "Service", "Component", "Repository", "Controller", "GWT", "AsyncCallback"].contains(&clean)
                    && !refs.contains(&clean.to_string())
                {
                    refs.push(clean.to_string());
                }
            };

            // 1. All explicit imports in this file
            for imp_fqcn in imports.values() {
                add_ref(imp_fqcn, &mut referenced_types);
            }

            // 2. All field types
            for f in &fields {
                add_ref(&f.type_name, &mut referenced_types);
            }

            // 3. Method return types and parameters
            for m in &methods {
                add_ref(&m.return_type, &mut referenced_types);
                for p in &m.parameters {
                    add_ref(&p.type_name, &mut referenced_types);
                }
            }

            // 4. Explicit GWT.create(FooService.class)
            for gwt_cap in self.gwt_create_regex.captures_iter(&content) {
                if let Some(m) = gwt_cap.get(1) {
                    add_ref(m.as_str(), &mut referenced_types);
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

        // 3. Explicit import matching: check if any imported FQCN ends with .clean_type
        for ref_t in &current_class.referenced_types {
            if ref_t == clean_type || ref_t.ends_with(&format!(".{}", clean_type)) || ref_t.ends_with(&format!("${}", clean_type)) {
                if all_ids.contains(ref_t) {
                    return vec![ref_t.clone()];
                }
            }
        }

        // 4. Nested / Inner class resolution (e.g. "Outer.Inner" or "com.pkg.Outer.Inner" or "Map.Entry")
        if clean_type.contains('.') {
            let parts: Vec<&str> = clean_type.split('.').collect();

            // Check if full path with $ instead of . exists (e.g. com.pkg.Outer$Inner)
            let dollar_fqcn = clean_type.replace('.', "$");
            if all_ids.contains(&dollar_fqcn) {
                return vec![dollar_fqcn];
            }

            let same_pkg_dollar = format!("{}.{}", current_class.package_name, clean_type.replace('.', "$"));
            if all_ids.contains(&same_pkg_dollar) {
                return vec![same_pkg_dollar];
            }

            let same_pkg_dot = format!("{}.{}", current_class.package_name, clean_type);
            if all_ids.contains(&same_pkg_dot) {
                return vec![same_pkg_dot];
            }

            // If "Outer.Inner": check if Outer is in by_simple_name
            let outer_name = parts[0];
            if let Some(outer_fqcns) = by_simple_name.get(outer_name) {
                let mut resolved = Vec::new();
                for outer_fqcn in outer_fqcns {
                    let full_inner_dot = format!("{}.{}", outer_fqcn, parts[1..].join("."));
                    let full_inner_dollar = format!("{}${}", outer_fqcn, parts[1..].join("$"));
                    if all_ids.contains(&full_inner_dot) {
                        resolved.push(full_inner_dot);
                    } else if all_ids.contains(&full_inner_dollar) {
                        resolved.push(full_inner_dollar);
                    } else if all_ids.contains(outer_fqcn) {
                        resolved.push(outer_fqcn.clone());
                    }
                }
                if !resolved.is_empty() {
                    return resolved;
                }
            }

            // Check package prefixes: e.g. "com.pkg.Outer.Inner" -> find "com.pkg.Outer"
            for i in (1..parts.len()).rev() {
                let candidate_outer = parts[..i].join(".");
                if all_ids.contains(&candidate_outer) {
                    return vec![candidate_outer];
                }
            }
        }

        // 5. If current class IS an inner class (e.g. "Outer.Inner"), and references Outer or sibling inner
        if current_class.name.contains('.') {
            let outer_simple = current_class.name.split('.').next().unwrap_or(&current_class.name);
            if clean_type == outer_simple {
                let outer_fqcn = format!("{}.{}", current_class.package_name, outer_simple);
                if all_ids.contains(&outer_fqcn) {
                    return vec![outer_fqcn];
                }
            }

            let sibling_inner = format!("{}.{}.{}", current_class.package_name, outer_simple, clean_type);
            if all_ids.contains(&sibling_inner) {
                return vec![sibling_inner];
            }
        }

        // 6. Direct lookup by simple name ONLY IF unique and referenced
        if let Some(fqcns) = by_simple_name.get(clean_type) {
            if fqcns.len() == 1 {
                let target_fqcn = &fqcns[0];
                if current_class.referenced_types.iter().any(|r| r == clean_type || r == target_fqcn) {
                    return vec![target_fqcn.clone()];
                }
            }
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

    #[test]
    fn test_inner_class_resolution() {
        let scanner = NativeJavaScanner::new();
        let current_cls = ClassInfo {
            id: "com.example.service.OrderService".to_string(),
            name: "OrderService".to_string(),
            package_name: "com.example.service".to_string(),
            module_name: "order-mod".to_string(),
            layer: ArchitectureLayer::Service,
            file_path: "OrderService.java".to_string(),
            line_number: 1,
            kind: ClassKind::Class,
            is_public: true,
            loc: 100,
            super_class: None,
            interfaces: Vec::new(),
            annotations: Vec::new(),
            fields: Vec::new(),
            methods: Vec::new(),
            referenced_types: Vec::new(),
        };

        let mut by_simple_name = HashMap::new();
        by_simple_name.insert("OrderDTO".to_string(), vec!["com.example.dto.OrderDTO".to_string()]);
        by_simple_name.insert("OrderDTO.Status".to_string(), vec!["com.example.dto.OrderDTO.Status".to_string()]);
        by_simple_name.insert("Status".to_string(), vec!["com.example.dto.OrderDTO.Status".to_string()]);

        let mut all_ids = HashSet::new();
        all_ids.insert("com.example.dto.OrderDTO".to_string());
        all_ids.insert("com.example.dto.OrderDTO.Status".to_string());
        all_ids.insert("com.example.service.OrderService".to_string());

        // 1. Direct qualified inner class: OrderDTO.Status
        let res1 = scanner.resolve_type("OrderDTO.Status", &current_cls, &by_simple_name, &all_ids);
        assert_eq!(res1, vec!["com.example.dto.OrderDTO.Status".to_string()]);

        // 2. Unregistered inner class fallback to Outer: OrderDTO.Builder -> com.example.dto.OrderDTO
        let res2 = scanner.resolve_type("OrderDTO.Builder", &current_cls, &by_simple_name, &all_ids);
        assert_eq!(res2, vec!["com.example.dto.OrderDTO".to_string()]);
    }
}
