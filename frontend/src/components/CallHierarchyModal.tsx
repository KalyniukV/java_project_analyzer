import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
  MarkerType,
  BaseEdge,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CallHierarchyGraph, CallHierarchyNode, CallHierarchyEdge } from '../types';
import { getCallHierarchy } from '../api/client';
import {
  GitCommit,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Target,
  Sliders,
  Filter,
  Code2,
  Database,
  Layers,
  Network,
  LayoutGrid,
  Radio,
  Tv,
  Maximize2
} from 'lucide-react';

interface CallHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string | null;
  onNavigateToClass?: (classId: string) => void;
}

// -------------------------------------------------------------
// CUSTOM NODE FOR CALL HIERARCHY FLOW
// -------------------------------------------------------------
const CallHierarchyFlowNode = memo(({ data }: NodeProps<any>) => {
  const node = data.node as CallHierarchyNode;
  const isRoot = node.depth === 0;
  const onSelect = data.onSelect as (id: string) => void;

  const getLayerBadge = (layer: string) => {
    switch (layer) {
      case 'UI':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'Service':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Domain':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Infrastructure':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  const getHopBadge = () => {
    if (isRoot) {
      return 'bg-purple-500 text-slate-950 font-bold';
    }
    if (node.depth < 0) {
      return 'bg-sky-500/20 text-sky-300 border border-sky-500/30';
    }
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  };

  let borderClass = isRoot
    ? 'border-purple-500 bg-[#161b22] ring-2 ring-purple-500/50 shadow-2xl shadow-purple-500/20'
    : node.depth < 0
    ? 'border-[#30363d] hover:border-sky-500/60 bg-[#0d1117]/95'
    : 'border-[#30363d] hover:border-amber-500/60 bg-[#0d1117]/95';

  return (
    <div
      onClick={() => !isRoot && onSelect(node.id)}
      className={`min-w-[220px] max-w-[260px] rounded-xl border p-3 shadow-xl backdrop-blur-md transition-all duration-200 cursor-pointer ${borderClass}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-[#38bdf8] !w-2.5 !h-2.5 !border-2 !border-[#0d1117]"
      />

      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${getHopBadge()}`}>
          {isRoot ? '★ ROOT' : node.depth < 0 ? `Hop ${node.depth}` : `Hop +${node.depth}`}
        </span>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${getLayerBadge(node.layer)}`}>
          {node.layer}
        </span>
      </div>

      <div className="text-xs font-bold font-mono text-slate-100 truncate" title={node.name}>
        {node.name}{node.member_type === 'method' ? '()' : ''}
      </div>

      <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5" title={node.declaring_class}>
        📁 {node.class_simple_name}
      </div>

      {node.return_or_field_type && (
        <div className="text-[10px] font-mono text-sky-400 truncate mt-1 bg-black/30 px-1.5 py-0.5 rounded">
          {node.member_type === 'method' ? `➔ ${node.return_or_field_type}` : `type: ${node.return_or_field_type}`}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-[#fb923c] !w-2.5 !h-2.5 !border-2 !border-[#0d1117]"
      />
    </div>
  );
});

// -------------------------------------------------------------
// CUSTOM EDGE FOR CALL HIERARCHY FLOW
// -------------------------------------------------------------
const CallHierarchyFlowEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<any>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const isGwtRpc = data?.call_kind?.includes('Gwt') || data?.call_kind?.includes('Rpc');
  const isField = data?.call_kind === 'FieldAccess';
  const label = data?.label as string | undefined;
  const hopDepth = data?.hop_depth as number | undefined;
  const isIndirect = hopDepth !== undefined && hopDepth >= 2;

  let strokeColor = isGwtRpc ? '#d946ef' : isField ? '#c084fc' : isIndirect ? '#818cf8' : '#38bdf8';
  let strokeWidth = isIndirect ? 1.8 : 2.5;
  let strokeDasharray = isIndirect ? '6,4' : isField ? '4,4' : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          filter: `drop-shadow(0 0 ${isIndirect ? '2px' : '4px'} ${strokeColor}66)`,
        }}
      />
      {(label || isIndirect) && (
        <foreignObject
          width={120}
          height={22}
          x={labelX - 60}
          y={labelY - 11}
          className="pointer-events-none"
        >
          <div className="flex items-center justify-center h-full">
            <span
              className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full border shadow flex items-center gap-1 ${
                isIndirect
                  ? 'bg-indigo-950/90 border-indigo-500/50 text-indigo-300'
                  : 'bg-[#161b22]/95 border-[#30363d] text-slate-300'
              }`}
            >
              {isIndirect && <span className="text-[7px] text-indigo-400">Hop {hopDepth}</span>}
              <span>{label || 'calls'}</span>
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
});

const nodeTypes = {
  callNode: CallHierarchyFlowNode as any,
};

const edgeTypes = {
  callEdge: CallHierarchyFlowEdge as any,
};

// -------------------------------------------------------------
// MAIN MODAL COMPONENT
// -------------------------------------------------------------
export const CallHierarchyModal: React.FC<CallHierarchyModalProps> = ({
  isOpen,
  onClose,
  targetId,
  onNavigateToClass,
}) => {
  const [depth, setDepth] = useState<number>(2);
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [viewMode, setViewMode] = useState<'diagram' | 'columns'>('diagram');
  const [hierarchy, setHierarchy] = useState<CallHierarchyGraph | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTarget, setActiveTarget] = useState<string | null>(targetId);

  useEffect(() => {
    setActiveTarget(targetId);
  }, [targetId]);

  useEffect(() => {
    if (!isOpen || !activeTarget) return;

    let isMounted = true;
    setIsLoading(true);

    getCallHierarchy(activeTarget, depth)
      .then((data) => {
        if (isMounted) {
          setHierarchy(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load call hierarchy:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeTarget, depth]);

  const rootNode = hierarchy?.nodes.find((n) => n.depth === 0);
  const callers = hierarchy?.nodes.filter((n) => n.depth < 0).sort((a, b) => b.depth - a.depth) || [];
  const callees = hierarchy?.nodes.filter((n) => n.depth > 0).sort((a, b) => a.depth - b.depth) || [];

  // -------------------------------------------------------------
  // LAYOUT ENGINE FOR HIERARCHY FLOW DIAGRAM
  // -------------------------------------------------------------
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!hierarchy || hierarchy.nodes.length === 0) {
      return { rfNodes: [], rfEdges: [] };
    }

    // Filter nodes based on direction
    const filteredNodes = hierarchy.nodes.filter((n) => {
      if (direction === 'inbound') return n.depth <= 0;
      if (direction === 'outbound') return n.depth >= 0;
      return true;
    });

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Group nodes by depth
    const nodesByDepth: Record<number, CallHierarchyNode[]> = {};
    for (const node of filteredNodes) {
      if (!nodesByDepth[node.depth]) {
        nodesByDepth[node.depth] = [];
      }
      nodesByDepth[node.depth].push(node);
    }

    const X_SPACING = 300;
    const Y_SPACING = 130;

    const rfNodes = filteredNodes.map((node) => {
      const depthNodes = nodesByDepth[node.depth] || [];
      const indexInDepth = depthNodes.findIndex((n) => n.id === node.id);
      const totalInDepth = depthNodes.length;

      // X coordinate: -2 * 300, -1 * 300, 0, +1 * 300, +2 * 300
      const x = node.depth * X_SPACING;
      // Y coordinate: centered around Y = 0
      const y = (indexInDepth - (totalInDepth - 1) / 2) * Y_SPACING;

      return {
        id: node.id,
        type: 'callNode',
        position: { x, y },
        data: {
          node,
          onSelect: (id: string) => setActiveTarget(id),
        },
      };
    });

    const nodeMap = new Map(filteredNodes.map((n) => [n.id, n]));

    const rfEdges = hierarchy.edges
      .filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
      .map((edge) => {
        const srcNode = nodeMap.get(edge.source);
        const tgtNode = nodeMap.get(edge.target);
        const edgeDepth = Math.max(Math.abs(srcNode?.depth || 0), Math.abs(tgtNode?.depth || 0));
        const isIndirect = edgeDepth >= 2;

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'callEdge',
          data: { ...edge, hop_depth: edgeDepth },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: edge.call_kind?.includes('Gwt') ? '#d946ef' : isIndirect ? '#818cf8' : '#38bdf8',
          },
          animated: true,
        };
      });

    return { rfNodes, rfEdges };
  }, [hierarchy, direction]);

  if (!isOpen || !activeTarget) return null;

  const getLayerBadge = (layer: string) => {
    switch (layer) {
      case 'UI':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'Service':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Domain':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Infrastructure':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-3.5 px-5 border-b border-[#30363d] flex items-center justify-between bg-black/40 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <GitCommit className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {rootNode?.member_type === 'field' ? 'Field Usage Flow' : 'Call Hierarchy'}
                </span>
                {rootNode?.layer && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getLayerBadge(rootNode.layer)}`}>
                    {rootNode.layer}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-100 font-mono truncate" title={rootNode?.signature || activeTarget}>
                {rootNode?.name || activeTarget}
              </h2>
              <p className="text-xs font-mono text-slate-400 truncate" title={rootNode?.declaring_class}>
                {rootNode?.declaring_class}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {onNavigateToClass && rootNode?.declaring_class && (
              <button
                onClick={() => {
                  onNavigateToClass(rootNode.declaring_class);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Target className="w-3.5 h-3.5 text-purple-400" />
                Перейти до класу
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="p-2.5 px-5 border-b border-[#30363d] bg-[#0d1117]/80 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          {/* Left: View Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-xl border border-[#30363d]">
            <button
              onClick={() => setViewMode('diagram')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'diagram'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Відобразити у вигляді інтерактивного графа зв'язків"
            >
              <Network className="w-3.5 h-3.5 text-purple-400" />
              <span>Діаграма викликів</span>
            </button>

            <button
              onClick={() => setViewMode('columns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'columns'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Відобразити у 3 структурованих колонках"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              <span>Колонки</span>
            </button>
          </div>

          {/* Middle: Depth Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-sky-400" /> Глибина (Depth):
            </span>
            <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`w-7 h-6 rounded font-mono font-bold text-xs transition-all ${
                    depth === d
                      ? 'bg-sky-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Direction Filter */}
          <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
            <button
              onClick={() => setDirection('all')}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                direction === 'all'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Всі ({callers.length + callees.length})
            </button>
            <button
              onClick={() => setDirection('inbound')}
              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                direction === 'inbound'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-sky-400" /> Вхідні ({callers.length})
            </button>
            <button
              onClick={() => setDirection('outbound')}
              className={`px-2.5 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                direction === 'outbound'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" /> Вихідні ({callees.length})
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 w-full h-full relative overflow-hidden bg-[#0d1117]">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 font-mono text-xs">
              <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mb-3"></div>
              Побудова графа викликів (Depth {depth})...
            </div>
          ) : viewMode === 'diagram' ? (
            /* 1. INTERACTIVE REACT FLOW GRAPH DIAGRAM */
            <div className="w-full h-full relative">
              {/* Visual Depth Step Column Headers */}
              <div className="absolute top-3 inset-x-0 z-10 pointer-events-none flex items-center justify-center gap-8 text-[11px] font-mono text-slate-400 opacity-60">
                <span>◀ Вхідні виклики (Callers)</span>
                <span className="font-bold text-purple-300 px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30">
                  ★ Цільовий елемент
                </span>
                <span>Вихідні виклики (Callees) ▶</span>
              </div>

              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                minZoom={0.2}
                maxZoom={2}
                defaultEdgeOptions={{ type: 'callEdge' }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1.2}
                  color="#21262d"
                />
                <Controls />
                <MiniMap
                  nodeColor={(node: any) => {
                    const d = node.data?.node?.depth;
                    if (d === 0) return '#c084fc';
                    if (d < 0) return '#38bdf8';
                    return '#fb923c';
                  }}
                  maskColor="rgba(13, 17, 23, 0.85)"
                  className="!bg-[#161b22] !border !border-[#30363d] !rounded-xl !overflow-hidden !shadow-2xl"
                />
              </ReactFlow>
            </div>
          ) : (
            /* 2. 3-COLUMN STRUCTURED VIEW */
            <div className="p-5 h-full overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {/* Column 1: Inbound Callers */}
                {(direction === 'all' || direction === 'inbound') && (
                  <div className="space-y-3 bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5 font-mono">
                        <ArrowDownLeft className="w-4 h-4" /> Хто викликає (Fan-In)
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                        {callers.length} методів
                      </span>
                    </div>

                    {callers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">
                        Немає прямих викликів у межах глибини {depth}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {callers.map((node) => (
                          <div
                            key={node.id}
                            onClick={() => setActiveTarget(node.id)}
                            className="p-3 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/50 transition-all cursor-pointer group shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                Hop {node.depth}
                              </span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${getLayerBadge(node.layer)}`}>
                                {node.layer}
                              </span>
                            </div>
                            <p className="text-xs font-bold font-mono text-slate-200 group-hover:text-sky-300 truncate" title={node.name}>
                              {node.name}()
                            </p>
                            <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={node.declaring_class}>
                              {node.class_simple_name}
                            </p>
                            {node.signature && (
                              <p className="text-[10px] font-mono text-slate-400 truncate mt-1 bg-black/30 px-1.5 py-0.5 rounded">
                                {node.signature}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Column 2: Target Root Member */}
                <div className="space-y-3 bg-[#161b22] p-5 rounded-2xl border-2 border-purple-500/60 shadow-xl shadow-purple-500/5 relative">
                  <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-purple-500 text-slate-950 text-[10px] font-mono font-bold uppercase shadow">
                    Цільовий елемент (Root)
                  </div>

                  <div className="pt-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getLayerBadge(rootNode?.layer || 'Unknown')}`}>
                      {rootNode?.layer || 'Element'}
                    </span>
                    <h3 className="text-base font-bold font-mono text-slate-100 mt-2 truncate" title={rootNode?.name}>
                      {rootNode?.name}
                    </h3>
                    <p className="text-xs font-mono text-slate-400 truncate mt-0.5" title={rootNode?.declaring_class}>
                      📁 {rootNode?.declaring_class}
                    </p>
                  </div>

                  {rootNode?.signature && (
                    <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d] text-xs font-mono text-purple-300">
                      <span className="text-slate-400 text-[10px] block mb-1">Сигнатура:</span>
                      <span className="break-all">{rootNode.signature}</span>
                    </div>
                  )}

                  {onNavigateToClass && rootNode?.declaring_class && (
                    <button
                      onClick={() => {
                        onNavigateToClass(rootNode.declaring_class);
                        onClose();
                      }}
                      className="w-full py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Target className="w-3.5 h-3.5 text-purple-400" />
                      Перейти до класу на графі
                    </button>
                  )}
                </div>

                {/* Column 3: Outbound Callees */}
                {(direction === 'all' || direction === 'outbound') && (
                  <div className="space-y-3 bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-mono">
                        <ArrowUpRight className="w-4 h-4" /> Кого викликає (Fan-Out)
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                        {callees.length} елементів
                      </span>
                    </div>

                    {callees.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">
                        Немає вихідних викликів у межах глибини {depth}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {callees.map((node) => (
                          <div
                            key={node.id}
                            onClick={() => setActiveTarget(node.id)}
                            className="p-3 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-amber-500/50 transition-all cursor-pointer group shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Hop +{node.depth}
                              </span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${getLayerBadge(node.layer)}`}>
                                {node.layer}
                              </span>
                            </div>
                            <p className="text-xs font-bold font-mono text-slate-200 group-hover:text-amber-300 truncate" title={node.name}>
                              {node.name}{node.member_type === 'method' ? '()' : ''}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={node.declaring_class}>
                              {node.class_simple_name}
                            </p>
                            {node.signature && (
                              <p className="text-[10px] font-mono text-slate-400 truncate mt-1 bg-black/30 px-1.5 py-0.5 rounded">
                                {node.signature}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
