import { invoke } from '@tauri-apps/api/core';
import {
  ProjectModel,
  ScanResponse,
  VisualGraphPayload,
  CycleInfo,
  BrowseDirResponse,
  ImpactAnalysis,
  ArchitectureViolation,
  MicroserviceExtractionAnalysis,
  ArchitectureHealth,
  ArchitectureSnapshot,
  CallHierarchyGraph,
  ScanProgress,
  ClassInfo,
} from '../types';

export async function scanProject(path: string): Promise<ScanResponse> {
  return invoke<ScanResponse>('scan_project', { path });
}

export async function getScanProgress(): Promise<ScanProgress> {
  return invoke<ScanProgress>('get_scan_progress');
}

export async function getProject(): Promise<ProjectModel> {
  return invoke<ProjectModel>('get_project');
}

export async function getGraph(
  view: 'modules' | 'packages' | 'classes',
  selectedId?: string,
  depth: number = 1,
  isolate: boolean = false,
  modules?: string[],
  packages?: string[],
  includeExternal: boolean = false
): Promise<VisualGraphPayload> {
  return invoke<VisualGraphPayload>('get_graph', {
    view,
    selectedId: selectedId || null,
    depth,
    isolate,
    modules: modules && modules.length > 0 ? modules : null,
    packages: packages && packages.length > 0 ? packages : null,
    includeExternal,
  });
}

export async function getCycles(view: 'modules' | 'packages' | 'classes'): Promise<CycleInfo[]> {
  return invoke<CycleInfo[]>('get_cycles', { view });
}

export async function getClassDetail(target: string): Promise<ClassInfo | null> {
  return invoke<ClassInfo | null>('get_class_detail', { target });
}

export async function listStoredProjects(): Promise<ProjectModel[]> {
  return invoke<ProjectModel[]>('list_stored_projects');
}

export async function loadStoredProject(rootPath: string): Promise<ProjectModel> {
  return invoke<ProjectModel>('load_stored_project', { rootPath });
}

export async function deleteStoredProject(rootPath: string): Promise<boolean> {
  return invoke<boolean>('delete_stored_project', { rootPath });
}

export async function pickFolderNative(): Promise<string | null> {
  return invoke<string | null>('pick_folder');
}

export async function browseDirectories(path?: string): Promise<BrowseDirResponse> {
  return invoke<BrowseDirResponse>('browse_dirs', { path: path || null });
}

export async function openFile(path: string, line?: number): Promise<boolean> {
  return invoke<boolean>('open_file', { path, line: line || null });
}

// -------------------------------------------------------------
// ARCHITECTURE INTELLIGENCE IPC COMMANDS
// -------------------------------------------------------------

export async function getImpactAnalysis(targetId?: string): Promise<ImpactAnalysis> {
  return invoke<ImpactAnalysis>('get_impact_analysis', { target: targetId || null });
}

export async function getArchitectureDrift(): Promise<ArchitectureViolation[]> {
  return invoke<ArchitectureViolation[]>('get_architecture_drift');
}

export async function getMicroserviceExtraction(targetId?: string): Promise<MicroserviceExtractionAnalysis> {
  return invoke<MicroserviceExtractionAnalysis>('get_microservice_extraction', { target: targetId || null });
}

export async function getArchitectureHealth(): Promise<ArchitectureHealth> {
  return invoke<ArchitectureHealth>('get_architecture_health');
}

export async function getArchitectureSnapshot(): Promise<ArchitectureSnapshot> {
  return invoke<ArchitectureSnapshot>('get_architecture_snapshot');
}

export async function getCallHierarchy(target: string, depth: number = 2): Promise<CallHierarchyGraph> {
  return invoke<CallHierarchyGraph>('get_call_hierarchy', { target, depth });
}
