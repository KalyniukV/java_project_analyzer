pub mod native_scanner;

use anyhow::Result;
use graph_core::models::{ProjectModel, ScanProgress};
use native_scanner::NativeJavaScanner;
use std::path::Path;

pub struct ProjectScanner;

impl ProjectScanner {
    pub fn scan(root_path: &Path) -> Result<ProjectModel> {
        Self::scan_with_progress(root_path, |_| {})
    }

    pub fn scan_with_progress<F>(root_path: &Path, on_progress: F) -> Result<ProjectModel>
    where
        F: FnMut(ScanProgress) + Send + Sync,
    {
        let scanner = NativeJavaScanner::new();
        scanner.scan_project_with_progress(root_path, on_progress)
    }
}
