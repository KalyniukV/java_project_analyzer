use crate::scanner::ProjectScanner;
use axum::{
    extract::{Query, State},
    http::{Method, StatusCode},
    routing::{get, post},
    Json, Router,
};
use graph_core::algorithms::GraphAnalyzer;
use graph_core::models::*;
use graph_core::storage::StorageManager;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct AppState {
    pub current_analyzer: Arc<RwLock<Option<GraphAnalyzer>>>,
    pub storage: Arc<StorageManager>,
}

#[derive(Deserialize)]
pub struct ScanRequest {
    pub path: String,
}

#[derive(Serialize)]
pub struct ScanResponse {
    pub success: bool,
    pub project_name: String,
    pub modules_count: usize,
    pub packages_count: usize,
    pub classes_count: usize,
    pub relationships_count: usize,
    pub scan_time_ms: u64,
    pub saved_to_nosql: bool,
}

#[derive(Deserialize)]
pub struct GraphQuery {
    pub view: Option<String>,
    pub selected: Option<String>,
    pub depth: Option<u32>,
    pub isolate: Option<bool>,
    pub modules: Option<String>,
    pub packages: Option<String>,
    pub include_external: Option<bool>,
}

#[derive(Deserialize)]
pub struct TargetQuery {
    pub target: Option<String>,
}

#[derive(Deserialize)]
pub struct CallHierarchyQuery {
    pub target: Option<String>,
    pub depth: Option<u32>,
}

#[derive(Deserialize)]
pub struct OpenFileRequest {
    pub path: String,
    pub line: Option<u32>,
}

#[derive(Deserialize)]
pub struct StorageLoadRequest {
    pub root_path: String,
}

#[derive(Deserialize)]
pub struct BrowseDirRequest {
    pub path: Option<String>,
}

#[derive(Serialize)]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_java_project: bool,
    pub project_type: Option<String>,
}

#[derive(Serialize)]
pub struct BrowseDirResponse {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub entries: Vec<DirEntryInfo>,
}

#[derive(Serialize)]
pub struct PickFolderResponse {
    pub path: Option<String>,
}

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers(tower_http::cors::Any);

    let api_router = Router::new()
        .route("/health", get(health_check))
        .route("/scan", post(scan_project_handler))
        .route("/project", get(get_project_handler))
        .route("/graph", get(get_graph_handler))
        .route("/cycles", get(get_cycles_handler))
        .route("/storage/projects", get(list_stored_projects_handler))
        .route("/storage/load", post(load_stored_project_handler))
        .route("/storage/delete", post(delete_stored_project_handler))
        .route("/dialog/pick-folder", post(pick_folder_handler))
        .route("/fs/browse", post(browse_dirs_handler))
        .route("/ide/open", post(open_file_handler))
        // Architecture Intelligence Endpoints
        .route("/intelligence/impact", get(get_impact_analysis_handler))
        .route("/intelligence/drift", get(get_architecture_drift_handler))
        .route("/intelligence/extraction", get(get_extraction_analysis_handler))
        .route("/intelligence/health", get(get_architecture_health_handler))
        .route("/intelligence/snapshot", get(get_architecture_snapshot_handler))
        .route("/call-hierarchy", get(get_call_hierarchy_handler))
        .layer(cors)
        .with_state(state);

    let mut router = Router::new().nest("/api", api_router);

    // Serve frontend/dist if available
    let dist_paths = ["frontend/dist", "../frontend/dist", "../../frontend/dist"];
    for p in dist_paths {
        let path = std::path::Path::new(p);
        if path.exists() {
            router = router.fallback_service(tower_http::services::ServeDir::new(path));
            break;
        }
    }

    router
}

async fn health_check() -> &'static str {
    "JavaLens Backend OK"
}

async fn scan_project_handler(
    State(state): State<AppState>,
    Json(payload): Json<ScanRequest>,
) -> Result<Json<ScanResponse>, (StatusCode, String)> {
    let path = PathBuf::from(&payload.path);
    if !path.exists() {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Path does not exist: {}", payload.path),
        ));
    }

    match ProjectScanner::scan(&path) {
        Ok(model) => {
            let mut analyzer = GraphAnalyzer::new(model.clone());
            analyzer.calculate_metrics();

            // Save into Embedded NoSQL Database (redb)
            let saved_to_nosql = state.storage.save_project(&analyzer.model).is_ok();

            let resp = ScanResponse {
                success: true,
                project_name: analyzer.model.project_name.clone(),
                modules_count: analyzer.model.modules.len(),
                packages_count: analyzer.model.packages.len(),
                classes_count: analyzer.model.classes.len(),
                relationships_count: analyzer.model.relationships.len(),
                scan_time_ms: analyzer.model.scan_time_ms,
                saved_to_nosql,
            };

            let mut lock = state.current_analyzer.write().await;
            *lock = Some(analyzer);

            Ok(Json(resp))
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Scan failed: {}", e),
        )),
    }
}

async fn get_project_handler(
    State(state): State<AppState>,
) -> Result<Json<ProjectModel>, (StatusCode, String)> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        Ok(Json(analyzer.model.clone()))
    } else {
        Err((StatusCode::NOT_FOUND, "No project loaded".to_string()))
    }
}

async fn get_graph_handler(
    State(state): State<AppState>,
    Query(query): Query<GraphQuery>,
) -> Result<Json<VisualGraphPayload>, (StatusCode, String)> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let view = query.view.unwrap_or_else(|| "classes".to_string());
        let depth = query.depth.unwrap_or(1);
        let isolate = query.isolate.unwrap_or(false);
        let selected = query.selected.as_deref();
        let include_ext = query.include_external.unwrap_or(false);

        let mod_filter = query.modules.as_deref().map(|s| {
            s.split(',')
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect::<Vec<String>>()
        });
        let pkg_filter = query.packages.as_deref().map(|s| {
            s.split(',')
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect::<Vec<String>>()
        });

        let graph = analyzer.build_visual_graph(
            &view,
            selected,
            depth,
            isolate,
            mod_filter.as_deref(),
            pkg_filter.as_deref(),
            include_ext,
        );
        Ok(Json(graph))
    } else {
        Err((StatusCode::NOT_FOUND, "No project loaded".to_string()))
    }
}

async fn get_cycles_handler(
    State(state): State<AppState>,
    Query(query): Query<GraphQuery>,
) -> Result<Json<Vec<CycleInfo>>, (StatusCode, String)> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let view = query.view.unwrap_or_else(|| "classes".to_string());
        let cycles = analyzer.find_cycles(&view);
        Ok(Json(cycles))
    } else {
        Err((StatusCode::NOT_FOUND, "No project loaded".to_string()))
    }
}

// -------------------------------------------------------------
// ARCHITECTURE INTELLIGENCE HANDLERS
// -------------------------------------------------------------

async fn get_impact_analysis_handler(
    State(state): State<AppState>,
    Query(query): Query<TargetQuery>,
) -> Result<Json<ImpactAnalysis>, (StatusCode, String)> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let target = query.target.unwrap_or_default();
        if target.is_empty() {
            // Default to first class if none provided
            if let Some(first_cls) = analyzer.model.classes.first() {
                return Ok(Json(analyzer.calculate_impact_analysis(&first_cls.id)));
            }
        }
        Ok(Json(analyzer.calculate_impact_analysis(&target)))
    } else {
        Err((StatusCode::NOT_FOUND, "No project loaded".to_string()))
    }
}

async fn get_architecture_drift_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<ArchitectureViolation>>, (StatusCode, String)> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        Ok(Json(analyzer.detect_architecture_drift()))
    } else {
        Err((StatusCode::NOT_FOUND, "No project loaded".to_string()))
    }
}

async fn get_extraction_analysis_handler(
    State(state): State<AppState>,
    Query(query): Query<TargetQuery>,
) -> Result<Json<MicroserviceExtractionAnalysis>, (StatusCode, String)> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        let target = match query.target {
            Some(t) if !t.is_empty() => t,
            _ => {
                // Default to first module or package
                if let Some(m) = analyzer.model.modules.first() {
                    m.id.clone()
                } else if let Some(p) = analyzer.model.packages.first() {
                    p.id.clone()
                } else {
                    "".to_string()
                }
            }
        };
        Ok(Json(analyzer.analyze_microservice_extraction(&target)))
    } else {
        Err((StatusCode::NOT_FOUND, "No project loaded".to_string()))
    }
}

async fn get_architecture_health_handler(
    State(state): State<AppState>,
) -> Result<Json<ArchitectureHealth>, (StatusCode, String)> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        Ok(Json(analyzer.calculate_architecture_health()))
    } else {
        Err((StatusCode::NOT_FOUND, "No project loaded".to_string()))
    }
}

async fn get_architecture_snapshot_handler(
    State(state): State<AppState>,
) -> Result<Json<ArchitectureSnapshot>, (StatusCode, String)> {
    let lock = state.current_analyzer.read().await;
    if let Some(analyzer) = &*lock {
        Ok(Json(analyzer.create_architecture_snapshot()))
    } else {
        Err((StatusCode::NOT_FOUND, "No project loaded".to_string()))
    }
}

async fn list_stored_projects_handler(
    State(state): State<AppState>,
) -> Result<Json<Vec<ProjectModel>>, (StatusCode, String)> {
    match state.storage.list_projects() {
        Ok(list) => Ok(Json(list)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list projects from NoSQL DB: {}", e),
        )),
    }
}

async fn load_stored_project_handler(
    State(state): State<AppState>,
    Json(payload): Json<StorageLoadRequest>,
) -> Result<Json<ScanResponse>, (StatusCode, String)> {
    match state.storage.load_project(&payload.root_path) {
        Ok(Some(model)) => {
            let resp = ScanResponse {
                success: true,
                project_name: model.project_name.clone(),
                modules_count: model.modules.len(),
                packages_count: model.packages.len(),
                classes_count: model.classes.len(),
                relationships_count: model.relationships.len(),
                scan_time_ms: model.scan_time_ms,
                saved_to_nosql: true,
            };

            let mut analyzer = GraphAnalyzer::new(model);
            analyzer.calculate_metrics();

            let mut lock = state.current_analyzer.write().await;
            *lock = Some(analyzer);

            Ok(Json(resp))
        }
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            format!("Project not found in NoSQL DB: {}", payload.root_path),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to load from NoSQL DB: {}", e),
        )),
    }
}

async fn delete_stored_project_handler(
    State(state): State<AppState>,
    Json(payload): Json<StorageLoadRequest>,
) -> Result<Json<bool>, (StatusCode, String)> {
    match state.storage.delete_project(&payload.root_path) {
        Ok(_) => Ok(Json(true)),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to delete project from NoSQL DB: {}", e),
        )),
    }
}

async fn pick_folder_handler() -> Result<Json<PickFolderResponse>, (StatusCode, String)> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Виберіть каталог Java проєкту")
        .pick_folder()
        .await;

    let path = folder.map(|f| f.path().to_string_lossy().to_string());
    Ok(Json(PickFolderResponse { path }))
}

async fn browse_dirs_handler(
    Json(payload): Json<BrowseDirRequest>,
) -> Result<Json<BrowseDirResponse>, (StatusCode, String)> {
    let target_path = match payload.path {
        Some(p) if !p.trim().is_empty() => PathBuf::from(p),
        _ => {
            std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
        }
    };

    let canonical = target_path.canonicalize().unwrap_or(target_path.clone());
    let current_str = canonical.to_string_lossy().to_string();
    let parent_path = canonical.parent().map(|p| p.to_string_lossy().to_string());

    let mut entries = Vec::new();

    if let Ok(read_dir) = std::fs::read_dir(&canonical) {
        for entry in read_dir.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();

                if name.starts_with('.') && name != ".javalens" {
                    continue;
                }

                let pom_exists = path.join("pom.xml").exists();
                let gradle_exists = path.join("build.gradle").exists() || path.join("build.gradle.kts").exists();
                let src_exists = path.join("src").exists();
                let gwt_exists = walkdir::WalkDir::new(&path)
                    .max_depth(4)
                    .into_iter()
                    .filter_map(|e| e.ok())
                    .any(|e| e.path().file_name().and_then(|s| s.to_str()).map(|s| s.ends_with(".gwt.xml")).unwrap_or(false));

                let is_java_project = pom_exists || gradle_exists || src_exists || gwt_exists;
                let project_type = if gwt_exists {
                    Some("gwt".to_string())
                } else if pom_exists {
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
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    is_java_project,
                    project_type,
                });
            }
        }
    }

    entries.sort_by(|a, b| {
        b.is_java_project
            .cmp(&a.is_java_project)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(Json(BrowseDirResponse {
        current_path: current_str,
        parent_path,
        entries,
    }))
}

async fn open_file_handler(
    Json(payload): Json<OpenFileRequest>,
) -> Result<Json<bool>, (StatusCode, String)> {
    let path = payload.path;
    let _line = payload.line.unwrap_or(1);

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn();
    }

    Ok(Json(true))
}

async fn get_call_hierarchy_handler(
    State(state): State<AppState>,
    Query(query): Query<CallHierarchyQuery>,
) -> Result<Json<CallHierarchyGraph>, (StatusCode, String)> {
    let analyzer_lock = state.current_analyzer.read().await;
    let analyzer = analyzer_lock
        .as_ref()
        .ok_or((StatusCode::NOT_FOUND, "No project loaded".to_string()))?;

    let target = query.target.unwrap_or_default();
    let depth = query.depth.unwrap_or(2);

    let hierarchy = analyzer.build_call_hierarchy(&target, depth);
    Ok(Json(hierarchy))
}

