mod scanner;
mod server;

use anyhow::Result;
use graph_core::storage::StorageManager;
use scanner::ProjectScanner;
use server::{create_router, AppState};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    // 1. Initialize embedded NoSQL database (redb)
    let db_path = PathBuf::from("data/javalens.redb");
    let storage = Arc::new(StorageManager::open(&db_path)?);
    println!("💾 Embedded NoSQL Database initialized at: {}", db_path.display());

    let args: Vec<String> = std::env::args().collect();

    let state = AppState {
        current_analyzer: Arc::new(RwLock::new(None)),
        storage: storage.clone(),
        scan_progress: Arc::new(RwLock::new(graph_core::models::ScanProgress::default())),
    };

    // If a path is provided in arguments, pre-scan it
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
                    let mut analyzer = graph_core::algorithms::GraphAnalyzer::new(model);
                    analyzer.calculate_metrics();

                    // Persist to NoSQL DB
                    if let Err(e) = storage.save_project(&analyzer.model) {
                        eprintln!("⚠️ Failed to persist to NoSQL DB: {}", e);
                    } else {
                        println!("💾 Project successfully stored in NoSQL DB!");
                    }

                    let mut lock = state.current_analyzer.write().await;
                    *lock = Some(analyzer);
                }
                Err(e) => {
                    eprintln!("❌ Scan error: {}", e);
                }
            }
        }
    }

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3030);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let app = create_router(state);

    println!("🚀 JavaLens Backend Server running at http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
