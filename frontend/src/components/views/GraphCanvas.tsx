import React, { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  BackgroundVariant,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomGraphNode } from '../graph/CustomNodes';
import { CustomGraphEdge } from '../graph/CustomEdges';
import { VisualGraphPayload, VisualGraphNode, VisualGraphEdge } from '../../types';
import { calculateLayout, LayoutMode } from '../../utils/layout';
import {
  Layers,
  Box,
  Target,
  Grid,
  Filter,
  Eye,
  EyeOff,
  Sparkles,
  Maximize2,
  Folder,
  X,
  Globe,
  ChevronRight,
  Home
} from 'lucide-react';

interface GraphCanvasProps {
  graphData: VisualGraphPayload | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onCanvasClick: () => void;
  activeView: 'modules' | 'packages' | 'classes';
  selectedModules?: string[];
  selectedPackages?: string[];
  onClearModuleFilter?: () => void;
  onClearPackageFilter?: () => void;
  includeExternal?: boolean;
  onToggleIncludeExternal?: () => void;
  onDrillDown?: (targetId: string, targetView: 'modules' | 'packages' | 'classes') => void;
  onNavigateView?: (view: 'modules' | 'packages' | 'classes') => void;
}

const nodeTypes = {
  customNode: CustomGraphNode as any,
};

const edgeTypes = {
  customEdge: CustomGraphEdge as any,
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  selectedNodeId,
  onSelectNode,
  onCanvasClick,
  activeView,
  selectedModules = [],
  selectedPackages = [],
  onClearModuleFilter,
  onClearPackageFilter,
  includeExternal = false,
  onToggleIncludeExternal,
  onDrillDown,
  onNavigateView,
}) => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('layered');
  const [hideDTOs, setHideDTOs] = useState<boolean>(false);
  const [onlyActiveEdges, setOnlyActiveEdges] = useState<boolean>(false);

  const { nodes, edges, swimlanes } = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [], swimlanes: [] };

    // 1. Calculate positions using our anti-confusion layout engine
    const layout = calculateLayout(
      graphData.nodes,
      graphData.edges,
      layoutMode,
      selectedNodeId,
      hideDTOs
    );

    const activeNodeIds = new Set(layout.nodes.map((n) => n.id));

    // 2. Map positioned nodes to React Flow nodes
    const rfNodes: Node[] = layout.nodes.map((node) => ({
      id: node.id,
      type: 'customNode',
      position: {
        x: node.x,
        y: node.y,
      },
      data: { ...node },
      selected: node.id === selectedNodeId,
    }));

    // 3. Map edges with decluttering & active isolation
    let rawEdges = graphData.edges.filter((edge) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target));

    if (onlyActiveEdges && selectedNodeId) {
      rawEdges = rawEdges.filter((edge) => edge.highlight_state !== 'Dimmed' && edge.highlight_state !== 'Normal');
    } else if (rawEdges.length > 150 && !selectedNodeId) {
      // Smart edge capping: prioritize circular & inter-module edges
      const priorityEdges = rawEdges.filter(e => e.is_circular || e.kind === 'ModuleDependency' || e.kind === 'PackageDependency');
      rawEdges = priorityEdges.length > 0 ? priorityEdges.slice(0, 120) : rawEdges.slice(0, 100);
    }

    const rfEdges: Edge[] = rawEdges.map((edge: VisualGraphEdge) => {
      const isHighlighted = edge.highlight_state !== 'Normal' && edge.highlight_state !== 'Dimmed';
      const isIndirect = edge.hop_depth !== undefined && edge.hop_depth >= 2;

      let markerColor = '#4b5563';
      if (edge.highlight_state === 'InboundActive') {
        markerColor = isIndirect ? '#818cf8' : '#38bdf8';
      } else if (edge.highlight_state === 'OutboundActive') {
        markerColor = isIndirect ? '#fbbf24' : (edge.kind === 'GwtRpcCall' || edge.kind === 'GwtRpcBinding' ? '#e879f9' : '#fb923c');
      } else if (edge.is_circular) {
        markerColor = '#ef4444';
      } else if (edge.kind === 'GwtRpcCall' || edge.kind === 'GwtRpcBinding') {
        markerColor = '#c084fc';
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'customEdge',
        data: { ...edge },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: isIndirect ? 11 : isHighlighted ? 16 : 12,
          height: isIndirect ? 11 : isHighlighted ? 16 : 12,
          color: markerColor,
        },
        animated: isHighlighted && !isIndirect,
      };
    });

    return { nodes: rfNodes, edges: rfEdges, swimlanes: layout.swimlanes };
  }, [graphData, selectedNodeId, layoutMode, hideDTOs, onlyActiveEdges]);

  // Handle double click for drill-down
  const handleNodeDoubleClick = (_: React.MouseEvent, node: Node) => {
    const nodeData = node.data as any;
    if (nodeData.category === 'module' && onDrillDown) {
      onDrillDown(node.id, 'packages');
    } else if (nodeData.category === 'package' && onDrillDown) {
      onDrillDown(node.id, 'classes');
    }
  };

  return (
    <div className="w-full h-full relative bg-[#0d1117]">
      {/* Visual Swimlane Background Labels for Layered / Clustered Mode */}
      {layoutMode === 'layered' && swimlanes.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
          {swimlanes.map((lane, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: `${lane.y}px`,
                left: '20px',
                right: '20px',
                height: `${lane.height}px`,
                backgroundColor: lane.color,
                border: '1px dashed rgba(255, 255, 255, 0.07)',
                borderRadius: '24px',
              }}
            >
              <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-md bg-[#161b22] border border-[#30363d] text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase shadow">
                {lane.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Top Floating Breadcrumb Bar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#161b22]/95 border border-[#30363d] px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono">
          <button
            onClick={() => onNavigateView && onNavigateView('modules')}
            className={`flex items-center gap-1 hover:text-sky-300 transition ${
              activeView === 'modules' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Всі модулі</span>
          </button>

          {selectedModules.length > 0 && (
            <>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <button
                onClick={() => onNavigateView && onNavigateView('packages')}
                className={`flex items-center gap-1 hover:text-emerald-300 transition ${
                  activeView === 'packages' ? 'text-emerald-400 font-bold' : 'text-slate-400'
                }`}
                title={selectedModules[0]}
              >
                <Box className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[120px]">{selectedModules[0]}</span>
              </button>
            </>
          )}

          {selectedPackages.length > 0 && (
            <>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <span className="flex items-center gap-1 text-purple-400 font-bold" title={selectedPackages[0]}>
                <Folder className="w-3 h-3 text-purple-400" />
                <span className="truncate max-w-[140px]">
                  {selectedPackages[0].split('.').slice(-2).join('.')}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Layout Engine Switcher */}
        <div className="flex items-center gap-1 bg-[#161b22]/95 border border-[#30363d] p-1 rounded-xl shadow-2xl backdrop-blur-md">
          <button
            onClick={() => setLayoutMode('layered')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              layoutMode === 'layered'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Архітектурний потік зверху-вниз"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Шари</span>
          </button>

          <button
            onClick={() => setLayoutMode('packages')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              layoutMode === 'packages'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Групувати в острови пакетів"
          >
            <Box className="w-3.5 h-3.5 text-purple-400" />
            <span>Пакети</span>
          </button>

          <button
            onClick={() => setLayoutMode('focus')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              layoutMode === 'focus'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="3 Колонки: Вхідні -> Ціль -> Вихідні"
          >
            <Target className="w-3.5 h-3.5 text-rose-400" />
            <span>Фокус</span>
          </button>

          <button
            onClick={() => setLayoutMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              layoutMode === 'grid'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Компактна матрична сітка"
          >
            <Grid className="w-3.5 h-3.5 text-emerald-400" />
            <span>Сітка</span>
          </button>
        </div>

        {/* Quick Toggles: Hide DTOs, Only Active Edges */}
        <div className="flex items-center gap-1 bg-[#161b22]/95 border border-[#30363d] p-1 rounded-xl shadow-2xl backdrop-blur-md text-xs">
          {onToggleIncludeExternal && (
            <button
              onClick={onToggleIncludeExternal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                includeExternal
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Відображати зовнішні залежності"
            >
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>Зовнішні</span>
            </button>
          )}

          <button
            onClick={() => setHideDTOs(!hideDTOs)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              hideDTOs
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Приховати другорядні DTO та Entity"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Без DTO</span>
          </button>

          <button
            onClick={() => setOnlyActiveEdges(!onlyActiveEdges)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              onlyActiveEdges
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Приховувати фонові лінії, показувати тільки активні стрілки вибраного елемента"
          >
            {onlyActiveEdges ? <EyeOff className="w-3.5 h-3.5 text-sky-400" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{onlyActiveEdges ? 'Тільки активні' : 'Усі зв\'язки'}</span>
          </button>
        </div>
      </div>

      {/* Main React Flow Graph Viewport */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={onCanvasClick}
        minZoom={0.05}
        maxZoom={2.0}
        defaultViewport={{ x: 80, y: 80, zoom: 0.75 }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.0 }}
        attributionPosition="bottom-left"
        className="w-full h-full"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#30363d" />
        <Controls
          showInteractive={false}
          className="!bg-[#161b22] !border-[#30363d] !rounded-xl !shadow-2xl overflow-hidden [&>button]:!bg-[#161b22] [&>button]:!border-[#30363d] [&>button]:!text-slate-300 [&>button:hover]:!bg-[#21262d]"
        />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as any;
            if (data.layer === 'UI') return '#38bdf8';
            if (data.layer === 'Service') return '#fb923c';
            if (data.layer === 'Infrastructure') return '#c084fc';
            if (data.layer === 'Domain') return '#34d399';
            return '#64748b';
          }}
          maskColor="rgba(13, 17, 23, 0.85)"
          className="!bg-[#161b22] !border-[#30363d] !rounded-xl !shadow-2xl overflow-hidden"
        />
      </ReactFlow>

      {/* Bottom Hint */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
        <div className="px-3 py-1.5 rounded-lg bg-[#161b22]/90 border border-[#30363d] text-[11px] font-mono text-slate-400 shadow-xl backdrop-blur-md flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>💡 Подвійний клік на модулі/пакеті: розкрити дочірній рівень (Drill-Down)</span>
        </div>
      </div>
    </div>
  );
};
