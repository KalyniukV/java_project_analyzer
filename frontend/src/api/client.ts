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
  StoredProjectSummary,
} from '../types';

async function invokeWithLog<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  const t0 = performance.now();
  try {
    const res = await invoke<T>(cmd, args);
    const ms = (performance.now() - t0).toFixed(1);
    console.debug(`%c[JavaLens IPC] %c${cmd} %c(${ms}ms)`, 'color: #38bdf8; font-weight: bold', 'color: #a855f7', 'color: #34d399', args || {});
    return res;
  } catch (err) {
    const ms = (performance.now() - t0).toFixed(1);
    console.error(`%c[JavaLens IPC ERROR] %c${cmd} %c(${ms}ms)`, 'color: #f43f5e; font-weight: bold', 'color: #fb923c', 'color: #94a3b8', err);
    throw err;
  }
}

export async function scanProject(path: string): Promise<ScanResponse> {
  return invokeWithLog<ScanResponse>('scan_project', { path });
}

export async function getScanProgress(): Promise<ScanProgress> {
  return invoke<ScanProgress>('get_scan_progress');
}

export async function getProject(): Promise<ProjectModel> {
  return invokeWithLog<ProjectModel>('get_project');
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
  return invokeWithLog<VisualGraphPayload>('get_graph', {
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
  return invokeWithLog<CycleInfo[]>('get_cycles', { view });
}

export async function getClassDetail(target: string): Promise<ClassInfo | null> {
  return invokeWithLog<ClassInfo | null>('get_class_detail', { target });
}

export async function listStoredProjects(): Promise<StoredProjectSummary[]> {
  return invokeWithLog<StoredProjectSummary[]>('list_stored_projects');
}

export async function loadStoredProject(rootPath: string): Promise<ProjectModel> {
  return invokeWithLog<ProjectModel>('load_stored_project', { rootPath });
}

export async function deleteStoredProject(rootPath: string): Promise<boolean> {
  return invokeWithLog<boolean>('delete_stored_project', { rootPath });
}

export async function pickFolderNative(): Promise<string | null> {
  return invokeWithLog<string | null>('pick_folder');
}

export async function browseDirectories(path?: string): Promise<BrowseDirResponse> {
  return invokeWithLog<BrowseDirResponse>('browse_dirs', { path: path || null });
}

export async function openFile(path: string, line?: number): Promise<boolean> {
  return invokeWithLog<boolean>('open_file', { path, line: line || null });
}

// -------------------------------------------------------------
// ARCHITECTURE INTELLIGENCE IPC COMMANDS
// -------------------------------------------------------------

export async function getImpactAnalysis(targetId?: string): Promise<ImpactAnalysis> {
  return invokeWithLog<ImpactAnalysis>('get_impact_analysis', { target: targetId || null });
}

export async function getArchitectureDrift(): Promise<ArchitectureViolation[]> {
  return invokeWithLog<ArchitectureViolation[]>('get_architecture_drift');
}

export async function getMicroserviceExtraction(targetId?: string): Promise<MicroserviceExtractionAnalysis> {
  return invokeWithLog<MicroserviceExtractionAnalysis>('get_microservice_extraction', { target: targetId || null });
}

export async function getArchitectureHealth(): Promise<ArchitectureHealth> {
  return invokeWithLog<ArchitectureHealth>('get_architecture_health');
}

export async function getArchitectureSnapshot(): Promise<ArchitectureSnapshot> {
  return invokeWithLog<ArchitectureSnapshot>('get_architecture_snapshot');
}

export async function getCallHierarchy(target: string, depth: number = 2): Promise<CallHierarchyGraph> {
  return invokeWithLog<CallHierarchyGraph>('get_call_hierarchy', { target, depth });
}
