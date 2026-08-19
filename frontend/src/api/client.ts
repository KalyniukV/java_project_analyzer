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
} from '../types';

const API_BASE = 'http://127.0.0.1:3030/api';

export async function scanProject(path: string): Promise<ScanResponse> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Failed to scan project');
  }
  return res.json();
}

export async function getScanProgress(): Promise<ScanProgress> {
  const res = await fetch(`${API_BASE}/scan/progress`);
  if (!res.ok) {
    throw new Error('Failed to fetch scan progress');
  }
  return res.json();
}

export async function getProject(): Promise<ProjectModel> {
  const res = await fetch(`${API_BASE}/project`);
  if (!res.ok) {
    throw new Error('No project currently loaded');
  }
  return res.json();
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
  const params = new URLSearchParams();
  params.set('view', view);
  params.set('depth', depth.toString());
  params.set('isolate', isolate.toString());
  if (selectedId) {
    params.set('selected', selectedId);
  }
  if (modules && modules.length > 0) {
    params.set('modules', modules.join(','));
  }
  if (packages && packages.length > 0) {
    params.set('packages', packages.join(','));
  }
  if (includeExternal) {
    params.set('include_external', 'true');
  }

  const res = await fetch(`${API_BASE}/graph?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to load graph data');
  }
  return res.json();
}

export async function getCycles(view: 'modules' | 'packages' | 'classes'): Promise<CycleInfo[]> {
  const res = await fetch(`${API_BASE}/cycles?view=${view}`);
  if (!res.ok) {
    throw new Error('Failed to fetch cycles');
  }
  return res.json();
}

export async function listStoredProjects(): Promise<ProjectModel[]> {
  const res = await fetch(`${API_BASE}/storage/projects`);
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function loadStoredProject(root_path: string): Promise<ScanResponse> {
  const res = await fetch(`${API_BASE}/storage/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root_path }),
  });
  if (!res.ok) {
    throw new Error('Failed to load project from NoSQL DB');
  }
  return res.json();
}

export async function deleteStoredProject(root_path: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/storage/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root_path }),
  });
  return res.ok;
}

export async function pickFolderNative(): Promise<string | null> {
  const res = await fetch(`${API_BASE}/dialog/pick-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.path || null;
}

export async function browseDirectories(path?: string): Promise<BrowseDirResponse> {
  const res = await fetch(`${API_BASE}/fs/browse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    throw new Error('Failed to browse directories');
  }
  return res.json();
}

export async function openFile(path: string, line: number = 1): Promise<boolean> {
  const res = await fetch(`${API_BASE}/ide/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, line }),
  });
  return res.ok;
}

// -------------------------------------------------------------
// ARCHITECTURE INTELLIGENCE CLIENT METHODS
// -------------------------------------------------------------

export async function getImpactAnalysis(targetId?: string): Promise<ImpactAnalysis> {
  const url = targetId
    ? `${API_BASE}/intelligence/impact?target=${encodeURIComponent(targetId)}`
    : `${API_BASE}/intelligence/impact`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch impact analysis');
  }
  return res.json();
}

export async function getArchitectureDrift(): Promise<ArchitectureViolation[]> {
  const res = await fetch(`${API_BASE}/intelligence/drift`);
  if (!res.ok) {
    throw new Error('Failed to fetch architecture drift violations');
  }
  return res.json();
}

export async function getMicroserviceExtraction(targetId?: string): Promise<MicroserviceExtractionAnalysis> {
  const url = targetId
    ? `${API_BASE}/intelligence/extraction?target=${encodeURIComponent(targetId)}`
    : `${API_BASE}/intelligence/extraction`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch microservice extraction analysis');
  }
  return res.json();
}

export async function getArchitectureHealth(): Promise<ArchitectureHealth> {
  const res = await fetch(`${API_BASE}/intelligence/health`);
  if (!res.ok) {
    throw new Error('Failed to fetch architecture health');
  }
  return res.json();
}

export async function getArchitectureSnapshot(): Promise<ArchitectureSnapshot> {
  const res = await fetch(`${API_BASE}/intelligence/snapshot`);
  if (!res.ok) {
    throw new Error('Failed to fetch architecture snapshot');
  }
  return res.json();
}

export async function getCallHierarchy(target: string, depth: number = 2): Promise<CallHierarchyGraph> {
  const res = await fetch(`${API_BASE}/call-hierarchy?target=${encodeURIComponent(target)}&depth=${depth}`);
  if (!res.ok) {
    throw new Error('Failed to fetch call hierarchy');
  }
  return res.json();
}

export async function getClassDetail(target: string): Promise<any> {
  const res = await fetch(`${API_BASE}/class/detail?target=${encodeURIComponent(target)}`);
  if (!res.ok) {
    return null;
  }
  return res.json();
}

