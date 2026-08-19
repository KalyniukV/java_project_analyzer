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
  Globe
} from 'lucide-react';

interface GraphCanvasProps {
  graphData: VisualGraphPayload | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onCanvasClick: () => void;
  selectedModules?: string[];
  selectedPackages?: string[];
  onClearModuleFilter?: () => void;
  onClearPackageFilter?: () => void;
  includeExternal?: boolean;
  onToggleIncludeExternal?: () => void;
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
  selectedModules = [],
  selectedPackages = [],
  onClearModuleFilter,
  onClearPackageFilter,
  includeExternal = false,
  onToggleIncludeExternal,
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
    const rfEdges: Edge[] = graphData.edges
      .filter((edge) => activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target))
      .filter((edge) => {
        if (onlyActiveEdges && selectedNodeId) {
          return edge.highlight_state !== 'Dimmed' && edge.highlight_state !== 'Normal';
        }
        return true;
      })
      .map((edge: VisualGraphEdge) => {
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

      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        {/* Layout Engine Switcher */}
        <div className="flex items-center gap-1 bg-[#161b22]/95 border border-[#30363d] p-1 rounded-xl shadow-2xl backdrop-blur-md">
          <button
            onClick={() => setLayoutMode('layered')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              layoutMode === 'layered'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Архітектурний потік зверху-вниз (UI -> Service -> Repo -> Domain)"
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
            title="Групувати класи в острови пакетів"
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
            title="3 Колонки: Вхідні виклики -> Цільовий клас -> Вихідні залежності"
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
            title="Компактна сітка"
          >
            <Grid className="w-3.5 h-3.5 text-emerald-400" />
            <span>Сітка</span>
          </button>
        </div>

        {/* Quick Toggles: Hide DTOs, Only Active Edges, and Include External Neighbors */}
        <div className="flex items-center gap-1 bg-[#161b22]/95 border border-[#30363d] p-1 rounded-xl shadow-2xl backdrop-blur-md text-xs">
          {onToggleIncludeExternal && (
            <button
              onClick={onToggleIncludeExternal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                includeExternal
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Відображати зовнішні класи/пакети/модулі, які мають зв'язки з вибраними"
            >
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>Зовнішні зв'язки</span>
            </button>
          )}

          <button
            onClick={() => setHideDTOs(!hideDTOs)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              hideDTOs
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Приховати другорядні DTO та Entity класи для спрощення графа"
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
            title="Приховувати фонові зв'язки та показувати тільки активні стрілки вибраного класу"
          >
            {onlyActiveEdges ? <EyeOff className="w-3.5 h-3.5 text-sky-400" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Чистий вигляд</span>
          </button>
        </div>

        {/* Active Module Filter Chip */}
        {selectedModules.length > 0 && onClearModuleFilter && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono shadow-md backdrop-blur-md animate-in fade-in">
            <Box className="w-3 h-3 text-emerald-400" />
            <span>Модулі: {selectedModules.length}</span>
            <button
              onClick={onClearModuleFilter}
              className="p-0.5 hover:bg-emerald-500/30 rounded text-emerald-300 transition-colors ml-0.5"
              title="Скинути фільтр модулів"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Active Package Filter Chip */}
        {selectedPackages.length > 0 && onClearPackageFilter && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-mono shadow-md backdrop-blur-md animate-in fade-in">
            <Folder className="w-3 h-3 text-purple-400" />
            <span>Пакети: {selectedPackages.length}</span>
            <button
              onClick={onClearPackageFilter}
              className="p-0.5 hover:bg-purple-500/30 rounded text-purple-300 transition-colors ml-0.5"
              title="Скинути фільтр пакетів"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Legend Pill */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 px-3.5 py-2 rounded-full bg-[#161b22]/90 border border-[#30363d] backdrop-blur-md text-xs font-mono text-slate-300 shadow-2xl">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50"></span>
          <span>Вхідні (Хто використовує)</span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
          <span>Вихідні (Кого використовує)</span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
          <span>Циклічні взаємні</span>
        </div>
      </div>

      {/* Interactive React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={onCanvasClick}
        fitView
        minZoom={0.15}
        maxZoom={2.5}
        defaultEdgeOptions={{ type: 'customEdge' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#21262d"
        />
        <Controls />
        <MiniMap
          nodeColor={(node: any) => {
            const data = node.data;
            if (data?.highlight_state === 'Selected') return '#38bdf8';
            if (data?.highlight_state === 'InboundActive') return '#38bdf8';
            if (data?.highlight_state === 'OutboundActive') return '#fb923c';
            if (data?.highlight_state === 'MutualActive') return '#ef4444';
            return '#30363d';
          }}
          maskColor="rgba(13, 17, 23, 0.85)"
          className="!bg-[#161b22] !border !border-[#30363d] !rounded-xl !overflow-hidden !shadow-2xl"
        />
      </ReactFlow>
    </div>
  );
};
