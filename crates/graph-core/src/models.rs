use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ClassKind {
    Class,
    Interface,
    AbstractClass,
    Enum,
    Record,
    Annotation,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ArchitectureLayer {
    UI,
    Service,
    Domain,
    Infrastructure,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum RelationKind {
    Extends,
    Implements,
    FieldDependency,
    MethodCall,
    MethodSignature,
    AnnotationDependency,
    PackageDependency,
    ModuleDependency,
    GwtRpcCall,
    GwtRpcBinding,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterInfo {
    pub name: String,
    pub type_name: String,
    pub annotations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldInfo {
    pub id: String, // e.g. "com.example.OwnerService#ownerRepository"
    pub name: String,
    pub type_name: String,
    pub is_injected: bool, // e.g. @Autowired, @Inject
    pub annotations: Vec<String>,
    pub visibility: String, // "public", "private", "protected", "package"
    pub is_static: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MethodInfo {
    pub id: String, // e.g. "com.example.OwnerService#findOwner(String)"
    pub name: String,
    pub return_type: String,
    pub parameters: Vec<ParameterInfo>,
    pub annotations: Vec<String>,
    pub line_number: u32,
    pub visibility: String, // "public", "private", "protected", "package"
    pub is_static: bool,
    pub called_methods: Vec<String>, // list of method names or IDs called inside
    pub used_fields: Vec<String>,    // list of field names used inside
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHierarchyNode {
    pub id: String,
    pub name: String,
    pub declaring_class: String,
    pub class_simple_name: String,
    pub member_type: String, // "method" | "field"
    pub layer: ArchitectureLayer,
    pub depth: i32, // negative for callers, 0 for root, positive for callees
    pub signature: Option<String>,
    pub return_or_field_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHierarchyEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub call_kind: String, // "MethodCall", "FieldAccess", "GwtRpcCall"
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallHierarchyGraph {
    pub root_id: String,
    pub root_name: String,
    pub root_class: String,
    pub root_type: String, // "method" | "field"
    pub nodes: Vec<CallHierarchyNode>,
    pub edges: Vec<CallHierarchyEdge>,
    pub max_depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassInfo {
    pub id: String, // FQCN e.g. "org.springframework.samples.petclinic.owner.Owner"
    pub name: String, // simple name e.g. "Owner"
    pub package_name: String,
    pub module_name: String,
    pub layer: ArchitectureLayer,
    pub file_path: String,
    pub line_number: u32,
    pub kind: ClassKind,
    pub is_public: bool,
    pub loc: u32,
    pub super_class: Option<String>,
    pub interfaces: Vec<String>,
    pub annotations: Vec<String>,
    pub fields: Vec<FieldInfo>,
    pub methods: Vec<MethodInfo>,
    pub referenced_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageMetrics {
    pub afferent_coupling: usize, // Ca: how many outside classes depend on this package
    pub efferent_coupling: usize, // Ce: how many outside packages this package depends on
    pub instability: f64,         // I = Ce / (Ca + Ce)
    pub abstractness: f64,        // A = abstract_types / total_types
    pub distance_main_seq: f64,   // D = |A + I - 1|
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageInfo {
    pub id: String, // package name e.g. "org.springframework.samples.petclinic.owner"
    pub name: String,
    pub module_name: String,
    pub class_ids: Vec<String>,
    pub subpackage_ids: Vec<String>,
    pub metrics: Option<PackageMetrics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleInfo {
    pub id: String, // module name e.g. "core-service"
    pub name: String,
    pub path: String,
    pub build_type: String, // "maven", "gradle", "jpms"
    pub direct_dependencies: Vec<String>, // other module IDs
    pub exported_packages: Vec<String>,
    pub afferent_coupling: usize,
    pub efferent_coupling: usize,
    pub instability: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relationship {
    pub id: String,
    pub source: String,
    pub target: String,
    pub kind: RelationKind,
    pub description: Option<String>,
    pub is_circular: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectModel {
    pub project_name: String,
    pub root_path: String,
    pub modules: Vec<ModuleInfo>,
    pub packages: Vec<PackageInfo>,
    pub classes: Vec<ClassInfo>,
    pub relationships: Vec<Relationship>,
    pub scan_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum NodeHighlightState {
    Normal,
    Selected,
    InboundActive,
    OutboundActive,
    MutualActive,
    Dimmed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EdgeHighlightState {
    Normal,
    InboundActive,
    OutboundActive,
    CircularActive,
    Dimmed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualGraphNode {
    pub id: String,
    pub label: String,
    pub sub_label: Option<String>,
    pub category: String, // "module", "package", "class", "interface", etc.
    pub layer: Option<ArchitectureLayer>,
    pub group: Option<String>, // parent package/module for grouping
    pub highlight_state: NodeHighlightState,
    pub degree_in: usize,
    pub degree_out: usize,
    pub metrics_summary: Option<String>,
    pub file_path: Option<String>,
    pub line_number: Option<u32>,
    pub is_external: Option<bool>,
    pub hop_depth: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualGraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub label: Option<String>,
    pub kind: RelationKind,
    pub highlight_state: EdgeHighlightState,
    pub is_circular: bool,
    pub hop_depth: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualGraphPayload {
    pub view_type: String, // "modules", "packages", "classes"
    pub nodes: Vec<VisualGraphNode>,
    pub edges: Vec<VisualGraphEdge>,
    pub selected_node_id: Option<String>,
    pub total_nodes: usize,
    pub total_edges: usize,
    pub cycles_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub is_scanning: bool,
    pub stage: String,
    pub stage_index: usize,
    pub total_stages: usize,
    pub processed_items: usize,
    pub total_items: usize,
    pub percentage: f32,
    pub current_file: Option<String>,
    pub modules_found: usize,
    pub packages_found: usize,
    pub classes_found: usize,
    pub relationships_found: usize,
    pub elapsed_ms: u64,
    pub speed_items_per_sec: f64,
    pub eta_seconds: f64,
    pub logs: Vec<String>,
    pub error: Option<String>,
}

impl Default for ScanProgress {
    fn default() -> Self {
        Self {
            is_scanning: false,
            stage: "Ready".to_string(),
            stage_index: 0,
            total_stages: 4,
            processed_items: 0,
            total_items: 0,
            percentage: 0.0,
            current_file: None,
            modules_found: 0,
            packages_found: 0,
            classes_found: 0,
            relationships_found: 0,
            elapsed_ms: 0,
            speed_items_per_sec: 0.0,
            eta_seconds: 0.0,
            logs: Vec::new(),
            error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CycleInfo {
    pub id: String,
    pub cycle_type: String, // "module_cycle", "package_cycle", "class_cycle"
    pub path: Vec<String>,
    pub length: usize,
}

// -------------------------------------------------------------
// ARCHITECTURE INTELLIGENCE MODELS
// -------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AffectedElement {
    pub id: String,
    pub name: String,
    pub category: String,
    pub layer: ArchitectureLayer,
    pub depth: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactAnalysis {
    pub target_id: String,
    pub target_name: String,
    pub direct_dependents_count: usize,
    pub total_affected_classes: usize,
    pub total_affected_modules: usize,
    pub total_affected_packages: usize,
    pub risk_level: RiskLevel,
    pub risk_score: u32, // 0..100
    pub risk_factors: Vec<String>,
    pub affected_classes: Vec<AffectedElement>,
    pub affected_modules: Vec<String>,
    pub affected_packages: Vec<String>,
    pub affected_layers: Vec<ArchitectureLayer>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ViolationSeverity {
    Warning,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureViolation {
    pub id: String,
    pub source_class: String,
    pub target_class: String,
    pub from_layer: ArchitectureLayer,
    pub to_layer: ArchitectureLayer,
    pub violation_title: String,
    pub expected_flow: String,
    pub actual_flow: String,
    pub severity: ViolationSeverity,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionBlocker {
    pub source: String,
    pub target: String,
    pub description: String,
    pub blocker_type: String, // "Inbound Call", "Direct DB Dependency", "Shared Entity"
    pub solution_hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MicroserviceExtractionAnalysis {
    pub target_id: String,
    pub target_name: String,
    pub target_type: String, // "Module" or "Package"
    pub total_classes: usize,
    pub readiness_score: u32, // 0..100
    pub is_cleanly_extractable: bool,
    pub inbound_blockers: Vec<ExtractionBlocker>,
    pub outbound_blockers: Vec<ExtractionBlocker>,
    pub shared_dependencies_count: usize,
    pub suggested_extraction_order: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureHealth {
    pub score: u32, // 0..100
    pub grade: String, // "A+", "A", "B", "C", "D", "F"
    pub total_classes: usize,
    pub total_modules: usize,
    pub total_packages: usize,
    pub cyclic_dependencies_count: usize,
    pub architecture_violations_count: usize,
    pub god_classes_count: usize,
    pub god_classes: Vec<String>,
    pub key_recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureSnapshot {
    pub project_name: String,
    pub scan_timestamp: u64,
    pub health: ArchitectureHealth,
    pub modules_count: usize,
    pub packages_count: usize,
    pub classes_count: usize,
    pub relationships_count: usize,
    pub violations: Vec<ArchitectureViolation>,
    pub cycles: Vec<CycleInfo>,
    pub layers_distribution: std::collections::HashMap<String, usize>,
}
