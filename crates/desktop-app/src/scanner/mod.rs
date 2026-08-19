pub mod native_scanner;

use anyhow::Result;
use graph_core::models::ProjectModel;
use native_scanner::NativeJavaScanner;
use std::path::Path;
use std::process::Command;

pub struct ProjectScanner;

impl ProjectScanner {
    pub fn scan(root_path: &Path) -> Result<ProjectModel> {
        // 1. Try Java JAR scanner if available
        let jar_path = Path::new("java-scanner/target/java-scanner.jar");
        let alt_jar_path = Path::new("../java-scanner/target/java-scanner.jar");
        let final_jar = if jar_path.exists() {
            Some(jar_path)
        } else if alt_jar_path.exists() {
            Some(alt_jar_path)
        } else {
            None
        };

        if let Some(jar) = final_jar {
            if let Ok(output) = Command::new("java")
                .arg("-jar")
                .arg(jar)
                .arg(root_path)
                .output()
            {
                if output.status.success() {
                    let json_str = String::from_utf8_lossy(&output.stdout);
                    if let Ok(model) = serde_json::from_str::<ProjectModel>(&json_str) {
                        return Ok(model);
                    }
                }
            }
        }

        // 2. High-speed Native Rust fallback scanner
        let scanner = NativeJavaScanner::new();
        scanner.scan_project(root_path)
    }
}
