#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod scanner;

use anyhow::Result;
use commands::*;
use graph_core::algorithms::GraphAnalyzer;
use graph_core::models::ScanProgress;
use graph_core::storage::StorageManager;
use scanner::ProjectScanner;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

fn main() -> Result<()> {
    // Linux WebKitGTK graphics stability flags (prevents black screen on AMD/Intel/NVIDIA)
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
    }

    tracing_subscriber::fmt::init();

    // 1. Initialize embedded NoSQL database (redb)
    let db_path = PathBuf::from("data/javalens.redb");
    let storage = Arc::new(StorageManager::open(&db_path)?);
    println!("💾 Embedded NoSQL Database initialized at: {}", db_path.display());

    let state = AppState {
        current_analyzer: Arc::new(RwLock::new(None)),
        storage: storage.clone(),
        scan_progress: Arc::new(RwLock::new(ScanProgress::default())),
    };

    // If a path is provided in CLI arguments, pre-scan it
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && !args[1].starts_with('-') {
        let project_path = PathBuf::from(&args[1]);
        if project_path.exists() {
            println!("🔍 Pre-scanning project: {}", project_path.display());
            match ProjectScanner::scan(&project_path) {
                Ok(model) => {
                    println!(
                        "✅ Scanned project '{}': {} modules, {} packages, {} classes, {} rels in {}ms",
                        model.project_name,
                        model.modules.len(),
                        model.packages.len(),
                        model.classes.len(),
                        model.relationships.len(),
                        model.scan_time_ms
                    );
                    let mut analyzer = GraphAnalyzer::new(model);
                    analyzer.calculate_metrics();

                    // Persist to NoSQL DB
                    if let Err(e) = storage.save_project(&analyzer.model) {
                        eprintln!("⚠️ Failed to persist to NoSQL DB: {}", e);
                    } else {
                        println!("💾 Project successfully stored in NoSQL DB!");
                    }

                    let state_clone = state.clone();
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    rt.block_on(async {
                        let mut lock = state_clone.current_analyzer.write().await;
                        *lock = Some(analyzer);
                    });
                }
                Err(e) => {
                    eprintln!("❌ Scan error: {}", e);
                }
            }
        }
    }

    println!("🚀 Starting JavaLens Desktop Application (Tauri 2.0)...");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            scan_project,
            get_scan_progress,
            get_project,
            get_graph,
            get_class_detail,
            get_cycles,
            list_stored_projects,
            load_stored_project,
            delete_stored_project,
            pick_folder,
            browse_dirs,
            open_file,
            get_impact_analysis,
            get_architecture_drift,
            get_microservice_extraction,
            get_architecture_health,
            get_architecture_snapshot,
            get_call_hierarchy,
        ])
        .run(tauri::generate_context!())
        .expect("error while running JavaLens Tauri application");

    Ok(())
}
