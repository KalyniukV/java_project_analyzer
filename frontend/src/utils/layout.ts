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

  const nodeMap = new Map<string, VisualGraphNode>();
  activeNodes.forEach((n) => nodeMap.set(n.id, n));

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

  // Classify each node into its architectural layer
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
    { key: 'UI', label: 'PRESENTATION / CONTROLLERS', color: 'rgba(56, 189, 248, 0.04)' },
    { key: 'Service', label: 'APPLICATION / SERVICES', color: 'rgba(251, 146, 60, 0.04)' },
    { key: 'Infrastructure', label: 'INFRASTRUCTURE / REPOSITORIES & CLIENTS', color: 'rgba(168, 85, 247, 0.04)' },
    { key: 'Domain', label: 'DOMAIN MODEL & ENTITIES', color: 'rgba(52, 211, 153, 0.04)' },
  ];

  if (ranks.Other.length > 0) {
    layerOrder.push({ key: 'Other', label: 'UTILITIES & OTHER COMPONENTS', color: 'rgba(148, 163, 184, 0.04)' });
  }

  const nodeWidth = 280;
  const nodeHeight = 150;
  const horizontalGap = 60;
  const verticalGap = 130;

  const positionedNodes: PositionedNode[] = [];
  const swimlanes: SwimlaneInfo[] = [];

  let currentY = 50;

  for (const tier of layerOrder) {
    const tierNodes = ranks[tier.key];
    if (tierNodes.length === 0) continue;

    // Sort tier nodes to minimize edge crossings (connected nodes closer together)
    tierNodes.sort((a, b) => a.label.localeCompare(b.label));

    const totalWidth = tierNodes.length * nodeWidth + (tierNodes.length - 1) * horizontalGap;
    const startX = Math.max(60, 60);

    const laneHeight = nodeHeight + 80;
    swimlanes.push({
      label: tier.label,
      y: currentY - 25,
      height: laneHeight,
      color: tier.color,
    });

    tierNodes.forEach((node, idx) => {
      const x = startX + idx * (nodeWidth + horizontalGap);
      const y = currentY + 15;
      positionedNodes.push({ ...node, x, y });
    });

    currentY += laneHeight + verticalGap - 50;
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

  const nodeWidth = 260;
  const nodeHeight = 140;
  const gapX = 35;
  const gapY = 30;

  let clusterX = 60;
  let clusterY = 60;
  let maxClusterHeightInRow = 0;
  const maxRowWidth = 2200;

  for (const [pkgName, pkgNodes] of packageGroups.entries()) {
    const cols = Math.min(3, Math.ceil(Math.sqrt(pkgNodes.length)));
    const rows = Math.ceil(pkgNodes.length / cols);

    const clusterWidth = cols * (nodeWidth + gapX) + 40;
    const clusterHeight = rows * (nodeHeight + gapY) + 70;

    if (clusterX + clusterWidth > maxRowWidth && clusterX > 60) {
      clusterX = 60;
      clusterY += maxClusterHeightInRow + 80;
      maxClusterHeightInRow = 0;
    }

    swimlanes.push({
      label: `PACKAGE: ${pkgName.split('.').slice(-2).join('.')}`,
      y: clusterY - 20,
      height: clusterHeight,
      color: 'rgba(255, 255, 255, 0.02)',
    });

    pkgNodes.forEach((node, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = clusterX + 20 + col * (nodeWidth + gapX);
      const y = clusterY + 30 + row * (nodeHeight + gapY);
      positionedNodes.push({ ...node, x, y });
    });

    clusterX += clusterWidth + 50;
    maxClusterHeightInRow = Math.max(maxClusterHeightInRow, clusterHeight);
  }

  return { nodes: positionedNodes, swimlanes };
}

/**
 * 3. FOCUS 3-COLUMN LAYOUT (Inputs -> Selected Target -> Outputs)
 */
function calculateFocusLayout(
  nodes: VisualGraphNode[],
  edges: VisualGraphEdge[],
  selectedNodeId: string | null
): LayoutResult {
  if (!selectedNodeId) {
    // If no node selected, fallback to layered
    return calculateLayeredLayout(nodes, edges);
  }

  const inCallers: VisualGraphNode[] = [];
  const outCallees: VisualGraphNode[] = [];
  const otherNodes: VisualGraphNode[] = [];
  let targetNode: VisualGraphNode | null = null;

  const incomingIds = new Set<string>();
  const outgoingIds = new Set<string>();

  for (const e of edges) {
    if (e.target === selectedNodeId) incomingIds.add(e.source);
    if (e.source === selectedNodeId) outgoingIds.add(e.target);
  }

  for (const node of nodes) {
    if (node.id === selectedNodeId) {
      targetNode = node;
    } else if (incomingIds.has(node.id)) {
      inCallers.push(node);
    } else if (outgoingIds.has(node.id)) {
      outCallees.push(node);
    } else {
      otherNodes.push(node);
    }
  }

  const positionedNodes: PositionedNode[] = [];
  const nodeWidth = 280;
  const nodeHeight = 150;
  const gapY = 40;

  // Center column X
  const centerX = 550;
  const leftX = 80;
  const rightX = 1020;

  // Target Node at Center
  const centerY = Math.max(160, Math.max(inCallers.length, outCallees.length) * 80);
  if (targetNode) {
    positionedNodes.push({ ...targetNode, x: centerX, y: centerY });
  }

  // Left Column (Callers / Inbound)
  const leftStartY = Math.max(50, centerY - (inCallers.length * (nodeHeight + gapY)) / 2 + 50);
  inCallers.forEach((node, i) => {
    positionedNodes.push({
      ...node,
      x: leftX,
      y: leftStartY + i * (nodeHeight + gapY),
    });
  });

  // Right Column (Callees / Outbound)
  const rightStartY = Math.max(50, centerY - (outCallees.length * (nodeHeight + gapY)) / 2 + 50);
  outCallees.forEach((node, i) => {
    positionedNodes.push({
      ...node,
      x: rightX,
      y: rightStartY + i * (nodeHeight + gapY),
    });
  });

  // Other secondary nodes at bottom in a grid
  const bottomY = Math.max(centerY + 300, Math.max(leftStartY + inCallers.length * 190, rightStartY + outCallees.length * 190) + 80);
  const otherCols = 4;
  otherNodes.forEach((node, i) => {
    const col = i % otherCols;
    const row = Math.floor(i / otherCols);
    positionedNodes.push({
      ...node,
      x: 80 + col * (nodeWidth + 40),
      y: bottomY + row * (nodeHeight + 30),
    });
  });

  const swimlanes: SwimlaneInfo[] = [
    { label: `INBOUND CALLERS (${inCallers.length})`, y: 10, height: bottomY - 30, color: 'rgba(56, 189, 248, 0.03)' },
    { label: `SELECTED TARGET`, y: 10, height: bottomY - 30, color: 'rgba(56, 189, 248, 0.07)' },
    { label: `OUTBOUND DEPENDENCIES (${outCallees.length})`, y: 10, height: bottomY - 30, color: 'rgba(251, 146, 60, 0.03)' },
  ];

  return { nodes: positionedNodes, swimlanes };
}

/**
 * 4. STANDARD GRID LAYOUT
 */
function calculateGridLayout(nodes: VisualGraphNode[]): LayoutResult {
  const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length * 1.5)));
  const colSpacing = 340;
  const rowSpacing = 190;

  const positionedNodes = nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const xOffset = (row % 2) * 40;
    return {
      ...node,
      x: col * colSpacing + xOffset + 60,
      y: row * rowSpacing + 60,
    };
  });

  return { nodes: positionedNodes, swimlanes: [] };
}

function determineLayerFromNode(node: VisualGraphNode): ArchitectureLayer {
  const sub = node.sub_label || '';
  const label = node.label || '';
  const group = node.group || '';

  if (sub.includes('Controller') || group.includes('controller') || label.endsWith('Controller')) {
    return 'UI';
  }
  if (sub.includes('Service') || group.includes('service') || label.endsWith('Service') || label.endsWith('UseCase')) {
    return 'Service';
  }
  if (sub.includes('Repository') || group.includes('repository') || group.includes('dao') || label.endsWith('Repository') || label.endsWith('Dao')) {
    return 'Infrastructure';
  }
  if (sub.includes('Entity') || group.includes('model') || group.includes('domain') || group.includes('entity') || label.endsWith('Entity') || label.endsWith('Dto')) {
    return 'Domain';
  }
  return 'Unknown';
}
