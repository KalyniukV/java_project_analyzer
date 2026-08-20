import { VisualGraphNode, VisualGraphEdge, ArchitectureLayer } from '../types';

export type LayoutMode = 'layered' | 'packages' | 'focus' | 'grid';

export interface PositionedNode extends VisualGraphNode {
  x: number;
  y: number;
}

export interface SwimlaneInfo {
  label: string;
  y: number;
  height: number;
  color: string;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  swimlanes: SwimlaneInfo[];
}

/**
 * Calculates optimal (x, y) coordinates for nodes to minimize edge crossings,
 * eliminate visual clutter, and provide structured architectural clarity.
 */
export function calculateLayout(
  nodes: VisualGraphNode[],
  edges: VisualGraphEdge[],
  mode: LayoutMode,
  selectedNodeId: string | null,
  hideDTOs: boolean = false
): LayoutResult {
  // 1. Filter out DTOs if requested
  const activeNodes = nodes.filter((n) => {
    if (hideDTOs && (n.label.endsWith('Dto') || n.label.endsWith('DTO') || n.label.endsWith('VO'))) {
      return false;
    }
    return true;
  });

  switch (mode) {
    case 'layered':
      return calculateLayeredLayout(activeNodes, edges);
    case 'packages':
      return calculatePackageClusteredLayout(activeNodes);
    case 'focus':
      return calculateFocusLayout(activeNodes, edges, selectedNodeId);
    case 'grid':
    default:
      return calculateGridLayout(activeNodes);
  }
}

/**
 * 1. ARCHITECTURAL LAYERED LAYOUT (Top-to-Bottom Flow)
 * UI (Controllers) -> Service (Business) -> Infrastructure (Repositories/Clients) -> Domain (Entities)
 */
function calculateLayeredLayout(nodes: VisualGraphNode[], edges: VisualGraphEdge[]): LayoutResult {
  const ranks: { [key in 'UI' | 'Service' | 'Infrastructure' | 'Domain' | 'Other']: VisualGraphNode[] } = {
    UI: [],
    Service: [],
    Infrastructure: [],
    Domain: [],
    Other: [],
  };

  for (const node of nodes) {
    const layer = node.layer || determineLayerFromNode(node);
    if (layer === 'UI') {
      ranks.UI.push(node);
    } else if (layer === 'Service') {
      ranks.Service.push(node);
    } else if (layer === 'Infrastructure') {
      ranks.Infrastructure.push(node);
    } else if (layer === 'Domain') {
      ranks.Domain.push(node);
    } else {
      ranks.Other.push(node);
    }
  }

  const layerOrder: Array<{ key: keyof typeof ranks; label: string; color: string }> = [
    { key: 'UI', label: '1. PRESENTATION / CONTROLLERS & UI', color: 'rgba(16, 185, 129, 0.05)' },
    { key: 'Service', label: '2. APPLICATION / SERVICES & BUSINESS LOGIC', color: 'rgba(56, 189, 248, 0.05)' },
    { key: 'Infrastructure', label: '3. INFRASTRUCTURE / REPOSITORIES & SERVLETS', color: 'rgba(168, 85, 247, 0.05)' },
    { key: 'Domain', label: '4. DOMAIN MODEL & ENTITIES', color: 'rgba(245, 158, 11, 0.05)' },
  ];

  if (ranks.Other.length > 0) {
    layerOrder.push({ key: 'Other', label: '5. UTILITIES & COMPONENTS', color: 'rgba(148, 163, 184, 0.05)' });
  }

  const nodeWidth = 290;
  const nodeHeight = 130;
  const horizontalGap = 50;
  const verticalGap = 40;
  const maxColsPerRow = 4;

  const positionedNodes: PositionedNode[] = [];
  const swimlanes: SwimlaneInfo[] = [];

  let currentY = 50;

  for (const tier of layerOrder) {
    const tierNodes = ranks[tier.key];
    if (tierNodes.length === 0) continue;

    // Sort by out-degree descending so callers are on top-left
    tierNodes.sort((a, b) => b.degree_out - a.degree_out || a.label.localeCompare(b.label));

    const totalRows = Math.ceil(tierNodes.length / maxColsPerRow);
    const laneHeight = totalRows * nodeHeight + (totalRows - 1) * verticalGap + 60;

    swimlanes.push({
      label: tier.label,
      y: currentY - 20,
      height: laneHeight,
      color: tier.color,
    });

    tierNodes.forEach((node, idx) => {
      const row = Math.floor(idx / maxColsPerRow);
      const col = idx % maxColsPerRow;

      const x = 60 + col * (nodeWidth + horizontalGap);
      const y = currentY + 30 + row * (nodeHeight + verticalGap);
      positionedNodes.push({ ...node, x, y });
    });

    currentY += laneHeight + 60;
  }

  return { nodes: positionedNodes, swimlanes };
}

/**
 * 2. PACKAGE CLUSTERED LAYOUT (Organizes classes into distinct package islands)
 */
function calculatePackageClusteredLayout(nodes: VisualGraphNode[]): LayoutResult {
  const packageGroups = new Map<string, VisualGraphNode[]>();

  for (const node of nodes) {
    const pkg = node.group || 'default';
    if (!packageGroups.has(pkg)) {
      packageGroups.set(pkg, []);
    }
    packageGroups.get(pkg)!.push(node);
  }

  const positionedNodes: PositionedNode[] = [];
  const swimlanes: SwimlaneInfo[] = [];

  const nodeWidth = 290;
  const nodeHeight = 130;
  const maxCols = 3;

  let currentY = 50;

  const sortedPkgs = Array.from(packageGroups.entries()).sort((a, b) => b[1].length - a[1].length);

  for (const [pkgName, pkgNodes] of sortedPkgs) {
    pkgNodes.sort((a, b) => a.label.localeCompare(b.label));

    const totalRows = Math.ceil(pkgNodes.length / maxCols);
    const laneHeight = totalRows * nodeHeight + (totalRows - 1) * 35 + 50;

    swimlanes.push({
      label: `PACKAGE: ${pkgName} (${pkgNodes.length} classes)`,
      y: currentY - 15,
      height: laneHeight,
      color: 'rgba(168, 85, 247, 0.05)',
    });

    pkgNodes.forEach((node, idx) => {
      const row = Math.floor(idx / maxCols);
      const col = idx % maxCols;

      const x = 60 + col * (nodeWidth + 45);
      const y = currentY + 25 + row * (nodeHeight + 35);
      positionedNodes.push({ ...node, x, y });
    });

    currentY += laneHeight + 50;
  }

  return { nodes: positionedNodes, swimlanes };
}

/**
 * 3. FOCUS EGO-CENTERED LAYOUT
 * Target Node in center, Inbound callers on the Left, Outbound callees on the Right
 */
function calculateFocusLayout(
  nodes: VisualGraphNode[],
  edges: VisualGraphEdge[],
  selectedNodeId: string | null
): LayoutResult {
  if (!selectedNodeId) {
    return calculateLayeredLayout(nodes, edges);
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  if (!selectedNode) {
    return calculateLayeredLayout(nodes, edges);
  }

  const inNodes: VisualGraphNode[] = [];
  const outNodes: VisualGraphNode[] = [];
  const otherNodes: VisualGraphNode[] = [];

  const inSet = new Set<string>();
  const outSet = new Set<string>();

  for (const e of edges) {
    if (e.target === selectedNodeId && e.source !== selectedNodeId) {
      inSet.add(e.source);
    }
    if (e.source === selectedNodeId && e.target !== selectedNodeId) {
      outSet.add(e.target);
    }
  }

  for (const n of nodes) {
    if (n.id === selectedNodeId) continue;
    if (inSet.has(n.id)) {
      inNodes.push(n);
    } else if (outSet.has(n.id)) {
      outNodes.push(n);
    } else {
      otherNodes.push(n);
    }
  }

  const positionedNodes: PositionedNode[] = [];
  const nodeWidth = 290;
  const nodeHeight = 130;
  const gapY = 30;

  // Selected Node at Center
  const centerX = 500;
  const centerY = Math.max(inNodes.length, outNodes.length) * (nodeHeight + gapY) / 2 + 50;
  positionedNodes.push({ ...selectedNode, x: centerX, y: Math.max(centerY, 100) });

  // Inbound Callers on Left (x = 80)
  inNodes.forEach((n, idx) => {
    positionedNodes.push({ ...n, x: 80, y: 50 + idx * (nodeHeight + gapY) });
  });

  // Outbound Callees on Right (x = 920)
  outNodes.forEach((n, idx) => {
    positionedNodes.push({ ...n, x: 920, y: 50 + idx * (nodeHeight + gapY) });
  });

  // Other unselected nodes placed below
  let otherStartY = Math.max(centerY * 2, (inNodes.length + 1) * (nodeHeight + gapY)) + 100;
  otherNodes.forEach((n, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    positionedNodes.push({ ...n, x: 80 + col * (nodeWidth + 40), y: otherStartY + row * (nodeHeight + gapY) });
  });

  return { nodes: positionedNodes, swimlanes: [] };
}

/**
 * 4. CLEAN COMPACT GRID LAYOUT
 */
function calculateGridLayout(nodes: VisualGraphNode[]): LayoutResult {
  const positionedNodes: PositionedNode[] = [];
  const cols = 4;
  const nodeWidth = 290;
  const nodeHeight = 130;
  const gapX = 45;
  const gapY = 40;

  nodes.forEach((node, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    positionedNodes.push({
      ...node,
      x: 60 + col * (nodeWidth + gapX),
      y: 60 + row * (nodeHeight + gapY),
    });
  });

  return { nodes: positionedNodes, swimlanes: [] };
}

function determineLayerFromNode(node: VisualGraphNode): ArchitectureLayer {
  const lbl = node.label.toLowerCase();
  const sub = (node.sub_label || '').toLowerCase();
  const grp = (node.group || '').toLowerCase();

  if (sub.includes('controller') || grp.includes('controller') || grp.includes('web') || lbl.endsWith('controller')) {
    return 'UI';
  }
  if (sub.includes('service') || grp.includes('service') || lbl.endsWith('service') || lbl.endsWith('usecase')) {
    return 'Service';
  }
  if (sub.includes('repository') || grp.includes('repository') || grp.includes('dao') || lbl.endsWith('repository') || lbl.endsWith('dao')) {
    return 'Infrastructure';
  }
  if (sub.includes('entity') || grp.includes('model') || grp.includes('domain') || lbl.endsWith('entity') || lbl.endsWith('dto')) {
    return 'Domain';
  }
  return 'Unknown';
}
