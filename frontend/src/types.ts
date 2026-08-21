export type ClassKind = 'Class' | 'Interface' | 'AbstractClass' | 'Enum' | 'Record' | 'Annotation';

export type ArchitectureLayer = 'UI' | 'Service' | 'Domain' | 'Infrastructure' | 'Unknown';

export type RelationKind =
  | 'Extends'
  | 'Implements'
  | 'FieldDependency'
  | 'MethodCall'
  | 'MethodSignature'
  | 'AnnotationDependency'
  | 'PackageDependency'
  | 'ModuleDependency'
  | 'GwtRpcCall'
  | 'GwtRpcBinding';

export interface ParameterInfo {
  name: string;
  type_name: string;
  annotations: string[];
}

export interface FieldInfo {
  id?: string;
  name: string;
  type_name: string;
  is_injected: boolean;
  annotations: string[];
  visibility?: string;
  is_static?: boolean;
}

export interface MethodInfo {
  id?: string;
  name: string;
  return_type: string;
  parameters?: ParameterInfo[];
  param_types?: string[];
  annotations: string[];
  line_number: number;
  visibility?: string;
  is_static?: boolean;
  called_methods?: string[];
  used_fields?: string[];
}

export interface CallHierarchyNode {
  id: string;
  name: string;
  declaring_class: string;
  class_simple_name: string;
  member_type: 'method' | 'field';
  layer: ArchitectureLayer;
  depth: number;
  signature?: string;
  return_or_field_type?: string;
}

export interface CallHierarchyEdge {
  id: string;
  source: string;
  target: string;
  call_kind: string;
  label?: string;
}

export interface CallHierarchyGraph {
  root_id: string;
  root_name: string;
  root_class: string;
  root_type: 'method' | 'field';
  nodes: CallHierarchyNode[];
  edges: CallHierarchyEdge[];
  max_depth: number;
}

export interface ClassInfo {
  id: string;
  name: string;
  package_name: string;
  module_name: string;
  layer: ArchitectureLayer;
  file_path: string;
  line_number: number;
  kind: ClassKind;
  is_public: boolean;
  loc: number;
  super_class?: string;
  interfaces: string[];
  annotations: string[];
  fields: FieldInfo[];
  methods: MethodInfo[];
  referenced_types: string[];
}

export interface PackageMetrics {
  afferent_coupling: number;
  efferent_coupling: number;
  instability: number;
  abstractness: number;
  distance_main_seq: number;
}

export interface PackageInfo {
  id: string;
  name: string;
  module_name: string;
  class_ids: string[];
  subpackage_ids: string[];
  metrics?: PackageMetrics;
}

export interface ModuleInfo {
  id: string;
  name: string;
  path: string;
  build_type: string;
  direct_dependencies: string[];
  exported_packages: string[];
  afferent_coupling: number;
  efferent_coupling: number;
  instability: number;
  parent_module_id?: string;
  submodule_ids?: string[];
}

export interface RelationshipEvidence {
  file_path: string;
  line_number?: number;
  detail: string;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  kind: RelationKind;
  description?: string;
  is_circular: boolean;
  evidences?: RelationshipEvidence[];
}

export interface ProjectModel {
  project_name: string;
  root_path: string;
  modules: ModuleInfo[];
  packages: PackageInfo[];
  classes: ClassInfo[];
  relationships: Relationship[];
  scan_time_ms: number;
}

export interface StoredProjectSummary {
  project_name: string;
  root_path: string;
  modules_count: number;
  packages_count: number;
  classes_count: number;
  relationships_count: number;
  scan_time_ms: number;
}

export type NodeHighlightState =
  | 'Normal'
  | 'Selected'
  | 'InboundActive'
  | 'OutboundActive'
  | 'MutualActive'
  | 'Dimmed';

export type EdgeHighlightState =
  | 'Normal'
  | 'InboundActive'
  | 'OutboundActive'
  | 'CircularActive'
  | 'Dimmed';

export interface VisualGraphNode {
  id: string;
  label: string;
  sub_label?: string;
  category: string;
  layer?: ArchitectureLayer;
  group?: string;
  highlight_state: NodeHighlightState;
  degree_in: number;
  degree_out: number;
  metrics_summary?: string;
  file_path?: string;
  line_number?: number;
  is_external?: boolean;
  hop_depth?: number;
}

export interface VisualGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: RelationKind;
  highlight_state: EdgeHighlightState;
  is_circular: boolean;
  hop_depth?: number;
  evidences?: RelationshipEvidence[];
}

export interface VisualGraphPayload {
  view_type: string;
  nodes: VisualGraphNode[];
  edges: VisualGraphEdge[];
  selected_node_id?: string;
  total_nodes: number;
  total_edges: number;
  cycles_count: number;
}

export interface CycleInfo {
  id: string;
  cycle_type: string;
  path: string[];
  length: number;
}

export interface ScanResponse {
  success: boolean;
  project_name: string;
  modules_count: number;
  packages_count: number;
  classes_count: number;
  relationships_count: number;
  scan_time_ms: number;
  saved_to_nosql?: boolean;
}

export interface ScanProgress {
  is_scanning: boolean;
  stage: string;
  stage_index: number;
  total_stages: number;
  processed_items: number;
  total_items: number;
  percentage: number;
  current_file?: string;
  modules_found: number;
  packages_found: number;
  classes_found: number;
  relationships_found: number;
  elapsed_ms: number;
  speed_items_per_sec: number;
  eta_seconds: number;
  logs: string[];
  error?: string;
}

export interface DirEntryInfo {
  name: string;
  path: string;
  is_dir: boolean;
  is_java_project: boolean;
  project_type?: 'maven' | 'gradle' | 'java' | 'gwt';
}

export interface BrowseDirResponse {
  current_path: string;
  parent_path?: string;
  entries: DirEntryInfo[];
}

// -------------------------------------------------------------
// ARCHITECTURE INTELLIGENCE TYPES
// -------------------------------------------------------------

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface AffectedElement {
  id: string;
  name: string;
  category: string;
  layer: ArchitectureLayer;
  depth: number;
}

export interface ImpactAnalysis {
  target_id: string;
  target_name: string;
  direct_dependents_count: number;
  total_affected_classes: number;
  total_affected_modules: number;
  total_affected_packages: number;
  risk_level: RiskLevel;
  risk_score: number;
  risk_factors: string[];
  affected_classes: AffectedElement[];
  affected_modules: string[];
  affected_packages: string[];
  affected_layers: ArchitectureLayer[];
}

export type ViolationSeverity = 'Warning' | 'High' | 'Critical';

export interface ArchitectureViolation {
  id: string;
  source_class: string;
  target_class: string;
  from_layer: ArchitectureLayer;
  to_layer: ArchitectureLayer;
  violation_title: string;
  expected_flow: string;
  actual_flow: string;
  severity: ViolationSeverity;
  explanation: string;
}

export interface ExtractionBlocker {
  source: string;
  target: string;
  description: string;
  blocker_type: string;
  solution_hint: string;
}

export interface MicroserviceExtractionAnalysis {
  target_id: string;
  target_name: string;
  target_type: string;
  total_classes: number;
  readiness_score: number;
  is_cleanly_extractable: boolean;
  inbound_blockers: ExtractionBlocker[];
  outbound_blockers: ExtractionBlocker[];
  shared_dependencies_count: number;
  suggested_extraction_order: string[];
}

export interface ArchitectureHealth {
  score: number;
  grade: string;
  total_classes: number;
  total_modules: number;
  total_packages: number;
  cyclic_dependencies_count: number;
  architecture_violations_count: number;
  god_classes_count: number;
  god_classes: string[];
  key_recommendations: string[];
}

export interface ArchitectureSnapshot {
  project_name: string;
  scan_timestamp: number;
  health: ArchitectureHealth;
  modules_count: number;
  packages_count: number;
  classes_count: number;
  relationships_count: number;
  violations: ArchitectureViolation[];
  cycles: CycleInfo[];
  layers_distribution: Record<string, number>;
}
