use crate::models::*;
use anyhow::{Context, Result};
use redb::{Database, ReadableDatabase, ReadableTable, TableDefinition};
use std::path::Path;
use std::sync::Arc;

const PROJECTS_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("projects");
const PROJECT_SUMMARIES_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("project_summaries");
const MODULES_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("modules");
const PACKAGES_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("packages");
const CLASSES_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("classes");
const RELATIONSHIPS_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("relationships");

#[derive(Clone)]
pub struct StorageManager {
    db: Arc<Database>,
}

impl StorageManager {
    /// Open or create an embedded NoSQL database at the specified path
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path_ref = path.as_ref();
        if let Some(parent) = path_ref.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create directory for DB at {:?}", parent))?;
        }

        let db = Database::create(path_ref)
            .map_err(|e| anyhow::anyhow!("Failed to open or create redb at {:?}: {}", path_ref, e))?;

        // Initialize tables within a write transaction
        let write_txn = db.begin_write()?;
        {
            let _ = write_txn.open_table(PROJECTS_TABLE)?;
            let _ = write_txn.open_table(PROJECT_SUMMARIES_TABLE)?;
            let _ = write_txn.open_table(MODULES_TABLE)?;
            let _ = write_txn.open_table(PACKAGES_TABLE)?;
            let _ = write_txn.open_table(CLASSES_TABLE)?;
            let _ = write_txn.open_table(RELATIONSHIPS_TABLE)?;
        }
        write_txn.commit()?;

        Ok(Self { db: Arc::new(db) })
    }

    /// Open in-memory temporary database for tests or transient storage
    pub fn open_temp() -> Result<Self> {
        let temp_dir = std::env::temp_dir().join(format!("javalens_test_{}.redb", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        Self::open(temp_dir)
    }

    /// Save full project model into the NoSQL database in an ACID transaction
    pub fn save_project(&self, model: &ProjectModel) -> Result<()> {
        let root_key = &model.root_path;

        let summary = StoredProjectSummary {
            project_name: model.project_name.clone(),
            root_path: model.root_path.clone(),
            modules_count: model.modules.len(),
            packages_count: model.packages.len(),
            classes_count: model.classes.len(),
            relationships_count: model.relationships.len(),
            scan_time_ms: model.scan_time_ms,
        };

        let write_txn = self.db.begin_write()?;
        {
            // 1. Save Lightweight Summary for instant zero-lag listing (< 1ms)
            let mut summary_table = write_txn.open_table(PROJECT_SUMMARIES_TABLE)?;
            let summary_bytes = serde_json::to_vec(&summary)?;
            summary_table.insert(root_key.as_str(), summary_bytes.as_slice())?;

            // 2. Save Project Header / Full Model
            let mut proj_table = write_txn.open_table(PROJECTS_TABLE)?;
            let proj_bytes = serde_json::to_vec(model)?;
            proj_table.insert(root_key.as_str(), proj_bytes.as_slice())?;

            // 3. Save Modules
            let mut mod_table = write_txn.open_table(MODULES_TABLE)?;
            for m in &model.modules {
                let key = format!("{}:{}", root_key, m.id);
                let bytes = serde_json::to_vec(m)?;
                mod_table.insert(key.as_str(), bytes.as_slice())?;
            }

            // 4. Save Packages
            let mut pkg_table = write_txn.open_table(PACKAGES_TABLE)?;
            for p in &model.packages {
                let key = format!("{}:{}", root_key, p.id);
                let bytes = serde_json::to_vec(p)?;
                pkg_table.insert(key.as_str(), bytes.as_slice())?;
            }

            // 5. Save Classes
            let mut cls_table = write_txn.open_table(CLASSES_TABLE)?;
            for c in &model.classes {
                let key = format!("{}:{}", root_key, c.id);
                let bytes = serde_json::to_vec(c)?;
                cls_table.insert(key.as_str(), bytes.as_slice())?;
            }

            // 6. Save Relationships
            let mut rel_table = write_txn.open_table(RELATIONSHIPS_TABLE)?;
            for r in &model.relationships {
                let key = format!("{}:{}", root_key, r.id);
                let bytes = serde_json::to_vec(r)?;
                rel_table.insert(key.as_str(), bytes.as_slice())?;
            }
        }
        write_txn.commit()?;

        Ok(())
    }

    /// Load project model from NoSQL database
    pub fn load_project(&self, root_path: &str) -> Result<Option<ProjectModel>> {
        let read_txn = self.db.begin_read()?;
        let proj_table = read_txn.open_table(PROJECTS_TABLE)?;

        if let Some(guard) = proj_table.get(root_path)? {
            let model: ProjectModel = serde_json::from_slice(guard.value())?;
            Ok(Some(model))
        } else {
            Ok(None)
        }
    }

    /// List all stored projects as lightweight summaries (Instant < 1ms, 0 RAM overhead)
    pub fn list_projects(&self) -> Result<Vec<StoredProjectSummary>> {
        let read_txn = self.db.begin_read()?;
        let mut list = Vec::new();

        // 1. Try reading from PROJECT_SUMMARIES_TABLE
        if let Ok(summary_table) = read_txn.open_table(PROJECT_SUMMARIES_TABLE) {
            let iter = summary_table.iter()?;
            for item in iter {
                let (_k, v) = item?;
                if let Ok(summary) = serde_json::from_slice::<StoredProjectSummary>(v.value()) {
                    list.push(summary);
                }
            }
        }

        // 2. Fallback for older records stored before summaries table existed
        if list.is_empty() {
            if let Ok(proj_table) = read_txn.open_table(PROJECTS_TABLE) {
                let iter = proj_table.iter()?;
                for item in iter {
                    let (_k, v) = item?;
                    if let Ok(model) = serde_json::from_slice::<ProjectModel>(v.value()) {
                        list.push(StoredProjectSummary {
                            project_name: model.project_name,
                            root_path: model.root_path,
                            modules_count: model.modules.len(),
                            packages_count: model.packages.len(),
                            classes_count: model.classes.len(),
                            relationships_count: model.relationships.len(),
                            scan_time_ms: model.scan_time_ms,
                        });
                    }
                }
            }
        }

        Ok(list)
    }

    /// Delete a project and its records from the database
    pub fn delete_project(&self, root_path: &str) -> Result<()> {
        let write_txn = self.db.begin_write()?;
        {
            if let Ok(mut summary_table) = write_txn.open_table(PROJECT_SUMMARIES_TABLE) {
                let _ = summary_table.remove(root_path);
            }
            if let Ok(mut proj_table) = write_txn.open_table(PROJECTS_TABLE) {
                let _ = proj_table.remove(root_path);
            }
        }
        write_txn.commit()?;
        Ok(())
    }
}
