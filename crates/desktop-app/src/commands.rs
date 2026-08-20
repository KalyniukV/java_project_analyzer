use graph_core::{
    ArchitectureHealth, ArchitectureSnapshot, ArchitectureViolation, CallHierarchyGraph,
    ClassInfo, CycleInfo, GraphAnalyzer, ImpactAnalysis, MicroserviceExtractionAnalysis,
    ProjectModel, ScanProgress, StorageManager, VisualGraphPayload,
};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::scanner::native_scanner::NativeJavaScanner;

#[derive(Clone)]
pub struct AppState {
    pub current_analyzer: Arc<RwLock<Option<GraphAnalyzer>>>,
    pub storage: Arc<StorageManager>,
    pub scan_progress: Arc<RwLock<ScanProgress>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScanResponse {
    pub status: String,
    pub project_name: String,
    pub root_path: String,
    pub scan_time_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_java_project: bool,
    pub project_type: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BrowseDirResponse {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub entries: Vec<DirEntryInfo>,
}

// -------------------------------------------------------------
// CORE TAURI IPC COMMANDS
// -------------------------------------------------------------

#[tauri::command]
pub async fn scan_project(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<ScanResponse, String> {
    let start = std::time::Instant::now();
    println!("\n[IPC] 🔍 Запит scan_project(path='{}')...", path);
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        let err = format!("Path does not exist: {}", path);
        eprintln!("[IPC] ❌ Помилка: {}", err);
        return Err(err);
    }

    let progress_ref = state.scan_progress.clone();
    let scanner = NativeJavaScanner::new();

    match scanner.scan_project_with_progress(&path_buf, move |prog| {
        let p_ref = progress_ref.clone();
        tokio::spawn(async move {
            let mut lock = p_ref.write().await;
            *lock = prog;
        });
    }) {
        Ok(model) => {
            let scan_time_ms = model.scan_time_ms;
            let project_name = model.project_name.clone();
            let root_path = model.root_path.clone();

            // Store in embedded NoSQL DB
            if let Err(e) = state.storage.save_project(&model) {
                eprintln!("[IPC] ⚠️ Failed to store project in NoSQL DB: {}", e);
            } else {
                println!("[IPC] 💾 Проєкт успішно збережено у вбудовану NoSQL DB (redb).");
            }

            let analyzer = GraphAnalyzer::new(model);
            let mut lock = state.current_analyzer.write().await;
            *lock = Some(analyzer);

            // Finalize progress
            let mut p_lock = state.scan_progress.write().await;
            p_lock.is_scanning = false;
            p_lock.percentage = 100.0;
            p_lock.stage = "Сканування завершено".to_string();

            println!("[IPC] ✅ scan_project завершено за {}мс (всього: {}мс)\n", scan_time_ms, start.elapsed().as_millis());

            Ok(ScanResponse {
                status: "success".to_string(),
                project_name,
                root_path,
                scan_time_ms,
            })
        }
        Err(e) => {
            eprintln!("[IPC] ❌ Помилка під час scan_project: {}", e);
            let mut p_lock = state.scan_progress.write().await;
            p_lock.is_scanning = false;
            p_lock.error = Some(e.to_string());
            p_lock.logs.push(format!("[ERROR] Помилка сканування: {}", e));
            Err(format!("Failed to scan project: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_scan_progress(state: tauri::State<'_, AppState>) -> Result<ScanProgress, String> {
    let progress = state.scan_progress.read().await.clone();
    Ok(progress)
}

#[tauri::command]
pub async fn get_project(state: tauri::State<'_, AppState>) -> Result<ProjectModel, String> {
    let start = std::time::Instant::now();
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let is_large_project = analyzer.model.classes.len() > 300;
        let res = if is_large_project {
            // High-performance streaming: send lightweight class descriptors and omit raw relationships
            let lightweight_classes: Vec<ClassInfo> = analyzer
                .model
                .classes
                .iter()
                .map(|c| ClassInfo {
                    id: c.id.clone(),
                    name: c.name.clone(),
                    package_name: c.package_name.clone(),
                    module_name: c.module_name.clone(),
                    layer: c.layer,
                    file_path: c.file_path.clone(),
                    line_number: c.line_number,
                    kind: c.kind,
                    is_public: c.is_public,
                    loc: c.loc,
                    super_class: c.super_class.clone(),
                    interfaces: c.interfaces.clone(),
                    annotations: c.annotations.clone(),
                    fields: Vec::new(),
                    methods: Vec::new(),
                    referenced_types: Vec::new(),
                })
                .collect();

            let summary_model = ProjectModel {
                project_name: analyzer.model.project_name.clone(),
                root_path: analyzer.model.root_path.clone(),
                scan_time_ms: analyzer.model.scan_time_ms,
                modules: analyzer.model.modules.clone(),
                packages: analyzer.model.packages.clone(),
                classes: lightweight_classes,
                relationships: Vec::new(),
            };

            summary_model
        } else {
            analyzer.model.clone()
        };

        println!(
            "[IPC] 📦 get_project() -> {} класів, {} пакетів, {} модулів (підготовка зайняла {}мс)",
            res.classes.len(),
            res.packages.len(),
            res.modules.len(),
            start.elapsed().as_millis()
        );

        Ok(res)
    } else {
        eprintln!("[IPC] ⚠️ get_project() викликано, але жоден проєкт не завантажено.");
        Err("No project loaded".to_string())
    }
}

#[tauri::command]
pub async fn get_graph(
    state: tauri::State<'_, AppState>,
    view: String,
    selected_id: Option<String>,
    depth: Option<u32>,
    isolate: Option<bool>,
    modules: Option<Vec<String>>,
    packages: Option<Vec<String>>,
    include_external: Option<bool>,
) -> Result<VisualGraphPayload, String> {
    let start = std::time::Instant::now();
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let d = depth.unwrap_or(1);
        let iso = isolate.unwrap_or(false);
        let ext = include_external.unwrap_or(false);

        let graph = analyzer.build_visual_graph(
            &view,
            selected_id.as_deref(),
            d,
            iso,
            modules.as_deref(),
            packages.as_deref(),
            ext,
        );

        println!(
            "[IPC] 📊 get_graph(view='{}', selected='{:?}', depth={}, isolate={}) -> {} вузлів, {} зв'язків (розрахунок: {}мс)",
            view,
            selected_id,
            d,
            iso,
            graph.nodes.len(),
            graph.edges.len(),
            start.elapsed().as_millis()
        );

        Ok(graph)
    } else {
        eprintln!("[IPC] ⚠️ get_graph() викликано, але проєкт не завантажено.");
        Err("No project loaded".to_string())
    }
}

#[tauri::command]
pub async fn get_class_detail(
    state: tauri::State<'_, AppState>,
    target: Option<String>,
) -> Result<ClassInfo, String> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let t = target.unwrap_or_default();
        if let Some(cls) = analyzer.model.classes.iter().find(|c| c.id == t) {
            println!("[IPC] 🔍 get_class_detail(target='{}') -> знайдено ({} полів, {} методів)", t, cls.fields.len(), cls.methods.len());
            Ok(cls.clone())
        } else {
            eprintln!("[IPC] ❌ get_class_detail: клас '{}' не знайдено", t);
            Err("Class not found".to_string())
        }
    } else {
        Err("No project loaded".to_string())
    }
}

#[tauri::command]
pub async fn get_cycles(
    state: tauri::State<'_, AppState>,
    view: Option<String>,
) -> Result<Vec<CycleInfo>, String> {
    let start = std::time::Instant::now();
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let v = view.unwrap_or_else(|| "classes".to_string());
        let cycles = analyzer.find_cycles(&v);
        println!("[IPC] 🔄 get_cycles(view='{}') -> знайдено {} циклів (розрахунок: {}мс)", v, cycles.len(), start.elapsed().as_millis());
        Ok(cycles)
    } else {
        Err("No project loaded".to_string())
    }
}

// -------------------------------------------------------------
// STORAGE IPC COMMANDS
// -------------------------------------------------------------

#[tauri::command]
pub async fn list_stored_projects(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<graph_core::models::StoredProjectSummary>, String> {
    let start = std::time::Instant::now();
    match state.storage.list_projects() {
        Ok(projects) => {
            println!("[IPC] 💾 list_stored_projects() -> {} збережених проєктів ({}мс)", projects.len(), start.elapsed().as_millis());
            Ok(projects)
        }
        Err(e) => {
            eprintln!("[IPC] ❌ list_stored_projects error: {}", e);
            Err(format!("Failed to list stored projects: {}", e))
        }
    }
}

#[tauri::command]
pub async fn load_stored_project(
    state: tauri::State<'_, AppState>,
    root_path: String,
) -> Result<ProjectModel, String> {
    match state.storage.load_project(&root_path) {
        Ok(Some(model)) => {
            let analyzer = GraphAnalyzer::new(model.clone());
            let mut lock = state.current_analyzer.write().await;
            *lock = Some(analyzer);
            Ok(model)
        }
        Ok(None) => Err("Project not found in NoSQL DB".to_string()),
        Err(e) => Err(format!("Failed to load from NoSQL DB: {}", e)),
    }
}

#[tauri::command]
pub async fn delete_stored_project(
    state: tauri::State<'_, AppState>,
    root_path: String,
) -> Result<bool, String> {
    match state.storage.delete_project(&root_path) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Failed to delete project from NoSQL DB: {}", e)),
    }
}

// -------------------------------------------------------------
// OS & FILE SYSTEM IPC COMMANDS
// -------------------------------------------------------------

#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    println!("[IPC] 📁 pick_folder -> відкриття системного діалогу вибору папки...");
    let res = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Виберіть каталог Java проєкту")
            .pick_folder()
            .map(|p| p.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("Dialog thread error: {}", e))?;

    if let Some(ref p) = res {
        println!("[IPC] 📁 pick_folder -> вибрано: '{}'", p);
    } else {
        println!("[IPC] 📁 pick_folder -> діалог закрито без вибору");
    }

    Ok(res)
}

#[tauri::command]
pub async fn browse_dirs(path: Option<String>) -> Result<BrowseDirResponse, String> {
    tokio::task::spawn_blocking(move || {
        let target_path = match path {
            Some(p) if !p.trim().is_empty() => PathBuf::from(p),
            _ => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
        };

        let canonical = target_path.canonicalize().unwrap_or(target_path.clone());
        let current_str = canonical.to_string_lossy().to_string();
        let parent_path = canonical.parent().map(|p| p.to_string_lossy().to_string());

        let mut entries = Vec::new();

        if let Ok(read_dir) = std::fs::read_dir(&canonical) {
            for entry in read_dir.filter_map(|e| e.ok()) {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        let name = entry.file_name().to_string_lossy().to_string();

                        // Skip hidden folders and heavy VCS/cache dirs
                        if name.starts_with('.') && name != ".javalens" {
                            continue;
                        }
                        if name == "node_modules" || name == "target" || name == "build" || name == "bin" || name == ".git" {
                            continue;
                        }

                        let p = entry.path();
                        let pom_exists = p.join("pom.xml").exists();
                        let gradle_exists = p.join("build.gradle").exists() || p.join("build.gradle.kts").exists();
                        let src_exists = p.join("src").exists();

                        let is_java_project = pom_exists || gradle_exists || src_exists;
                        let project_type = if pom_exists {
                            Some("maven".to_string())
                        } else if gradle_exists {
                            Some("gradle".to_string())
                        } else if src_exists {
                            Some("java".to_string())
                        } else {
                            None
                        };

                        entries.push(DirEntryInfo {
                            name,
                            path: p.to_string_lossy().to_string(),
                            is_dir: true,
                            is_java_project,
                            project_type,
                        });
                    }
                }
            }
        }

        entries.sort_by(|a, b| match (b.is_java_project, a.is_java_project) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        println!("[IPC] 📂 browse_dirs('{}') -> {} каталогів (Java: {})", current_str, entries.len(), entries.iter().filter(|e| e.is_java_project).count());

        Ok(BrowseDirResponse {
            current_path: current_str,
            parent_path,
            entries,
        })
    })
    .await
    .map_err(|e| format!("Browse error: {}", e))?
}

#[tauri::command]
pub async fn open_file(path: String, line: Option<u32>) -> Result<bool, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let line_num = line.unwrap_or(1);

    // Try VS Code first with line number: code -g path:line
    let status = std::process::Command::new("code")
        .arg("-g")
        .arg(format!("{}:{}", path, line_num))
        .status();

    if status.is_ok() && status.unwrap().success() {
        return Ok(true);
    }

    // Try IntelliJ IDEA: idea --line line path
    let idea_status = std::process::Command::new("idea")
        .arg("--line")
        .arg(line_num.to_string())
        .arg(&path)
        .status();

    if idea_status.is_ok() && idea_status.unwrap().success() {
        return Ok(true);
    }

    // Fallback to system default application via open crate
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&path).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&path).spawn();
    }

    Ok(true)
}

// -------------------------------------------------------------
// ARCHITECTURE INTELLIGENCE IPC COMMANDS
// -------------------------------------------------------------

#[tauri::command]
pub async fn get_impact_analysis(
    state: tauri::State<'_, AppState>,
    target: Option<String>,
) -> Result<ImpactAnalysis, String> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let t = target.unwrap_or_default();
        if t.is_empty() {
            if let Some(first_cls) = analyzer.model.classes.first() {
                return Ok(analyzer.calculate_impact_analysis(&first_cls.id));
            }
        }
        Ok(analyzer.calculate_impact_analysis(&t))
    } else {
        Err("No project loaded".to_string())
    }
}

#[tauri::command]
pub async fn get_architecture_drift(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ArchitectureViolation>, String> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        Ok(analyzer.detect_architecture_drift())
    } else {
        Err("No project loaded".to_string())
    }
}

#[tauri::command]
pub async fn get_microservice_extraction(
    state: tauri::State<'_, AppState>,
    target: Option<String>,
) -> Result<MicroserviceExtractionAnalysis, String> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let t = match target {
            Some(val) if !val.is_empty() => val,
            _ => {
                if let Some(m) = analyzer.model.modules.first() {
                    m.id.clone()
                } else if let Some(p) = analyzer.model.packages.first() {
                    p.id.clone()
                } else {
                    "".to_string()
                }
            }
        };
        Ok(analyzer.analyze_microservice_extraction(&t))
    } else {
        Err("No project loaded".to_string())
    }
}

#[tauri::command]
pub async fn get_architecture_health(
    state: tauri::State<'_, AppState>,
) -> Result<ArchitectureHealth, String> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        Ok(analyzer.calculate_architecture_health())
    } else {
        Err("No project loaded".to_string())
    }
}

#[tauri::command]
pub async fn get_architecture_snapshot(
    state: tauri::State<'_, AppState>,
) -> Result<ArchitectureSnapshot, String> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        Ok(analyzer.create_architecture_snapshot())
    } else {
        Err("No project loaded".to_string())
    }
}

#[tauri::command]
pub async fn get_call_hierarchy(
    state: tauri::State<'_, AppState>,
    target: String,
    depth: Option<u32>,
) -> Result<CallHierarchyGraph, String> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let d = depth.unwrap_or(2);
        Ok(analyzer.build_call_hierarchy(&target, d))
    } else {
        Err("No project loaded".to_string())
    }
}
