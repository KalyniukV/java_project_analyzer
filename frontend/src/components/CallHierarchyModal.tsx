import React, { useState, useEffect, useRef, useMemo } from 'react';
import cytoscape, { Core, EventObject } from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
import { CallHierarchyGraph, CallHierarchyNode } from '../types';
import { getCallHierarchy } from '../api/client';
import {
  X,
  Sliders,
  ArrowDownLeft,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Target,
  Workflow,
  Network,
  LayoutGrid,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

try {
  cytoscape.use(dagre);
} catch {}

interface CallHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string | null;
  onNavigateToClass?: (classId: string) => void;
}

export const CallHierarchyModal: React.FC<CallHierarchyModalProps> = ({
  isOpen,
  onClose,
  targetId,
  onNavigateToClass,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [depth, setDepth] = useState<number>(2);
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [viewMode, setViewMode] = useState<'diagram' | 'columns'>('diagram');
  const [hierarchy, setHierarchy] = useState<CallHierarchyGraph | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTarget, setActiveTarget] = useState<string | null>(targetId);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

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

  // Filtered elements for Cytoscape
  const { cyElements } = useMemo(() => {
    if (!hierarchy || hierarchy.nodes.length === 0) return { cyElements: [] };

    const filteredNodes = hierarchy.nodes.filter((n) => {
      if (direction === 'inbound') return n.depth <= 0;
      if (direction === 'outbound') return n.depth >= 0;
      return true;
    });

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = hierarchy.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    const elements: cytoscape.ElementDefinition[] = [];

    // Group nodes by depth to assign distinct positions
    const nodesByDepth: Record<number, CallHierarchyNode[]> = {};
    for (const node of filteredNodes) {
      if (!nodesByDepth[node.depth]) nodesByDepth[node.depth] = [];
      nodesByDepth[node.depth].push(node);
    }

    const X_SPACING = 320;
    const Y_SPACING = 90;

    for (const node of filteredNodes) {
      const depthGroup = nodesByDepth[node.depth] || [];
      const index = depthGroup.findIndex((n) => n.id === node.id);
      const total = depthGroup.length;

      const posX = (node.depth + depth) * X_SPACING;
      const posY = (index - (total - 1) / 2) * Y_SPACING;

      const isRoot = node.depth === 0;
      const isCaller = node.depth < 0;
      const shortClass = node.class_simple_name || node.declaring_class.split('.').pop() || node.declaring_class;
      const label = `${shortClass}.${node.name}()`;

      elements.push({
        group: 'nodes',
        data: {
          id: node.id,
          label: label,
          depth: node.depth,
          isRoot: isRoot ? 'true' : 'false',
          isCaller: isCaller ? 'true' : 'false',
          declaringClass: node.declaring_class,
          methodName: node.name,
        },
        position: { x: posX, y: posY },
      });
    }

    for (const edge of filteredEdges) {
      elements.push({
        group: 'edges',
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.call_kind || '',
          isGwt: edge.call_kind?.includes('Gwt') ? 'true' : 'false',
        },
      });
    }

    return { cyElements: elements };
  }, [hierarchy, direction, depth]);

  // Cytoscape Canvas Lifecycle
  useEffect(() => {
    if (!isOpen || viewMode !== 'diagram' || !containerRef.current || cyElements.length === 0) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: cyElements,
      boxSelectionEnabled: false,
      autounselectify: false,
      minZoom: 0.1,
      maxZoom: 3.5,
      wheelSensitivity: 0.25,
      style: [
        {
          selector: 'node',
          style: {
            'shape': 'round-rectangle',
            'width': '240px',
            'height': '54px',
            'background-color': '#161b22',
            'border-width': '2px',
            'border-color': '#30363d',
            'corner-radius': '10px',
            'label': 'data(label)',
            'color': '#ffffff',
            'font-family': 'JetBrains Mono, Fira Code, monospace',
            'font-size': '11px',
            'font-weight': 'bold',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'ellipsis',
            'text-max-width': '220px',
            'text-outline-color': '#0d1117',
            'text-outline-width': '2px',
          } as any,
        },
        // Root Target Node
        {
          selector: 'node[isRoot = "true"]',
          style: {
            'background-color': '#3b0764',
            'border-color': '#c084fc',
            'border-width': '3px',
            'width': '260px',
            'height': '60px',
            'font-size': '12px',
            'shadow-blur': 20,
            'shadow-color': '#a855f7',
            'shadow-opacity': 0.7,
          } as any,
        },
        // Caller Nodes
        {
          selector: 'node[isCaller = "true"]',
          style: {
            'background-color': '#082f49',
            'border-color': '#38bdf8',
          },
        },
        // Callee Nodes
        {
          selector: 'node[isCaller = "false"][isRoot = "false"]',
          style: {
            'background-color': '#431407',
            'border-color': '#fb923c',
          },
        },
        // Edge styling
        {
          selector: 'edge',
          style: {
            'width': 2.5,
            'line-color': '#38bdf8',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle-backcurve',
            'target-arrow-color': '#38bdf8',
            'arrow-scale': 1.2,
            'opacity': 0.8,
          } as any,
        },
        {
          selector: 'edge[isGwt = "true"]',
          style: {
            'line-color': '#d946ef',
            'target-arrow-color': '#d946ef',
            'width': 3,
          },
        },
      ],
    });

    cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target;
      const id = node.id();
      if (id !== activeTarget) {
        setActiveTarget(id);
      }
    });

    cyRef.current = cy;

    cy.fit(undefined, 50);

    return () => {
      cy.destroy();
    };
  }, [isOpen, viewMode, cyElements]);

  if (!isOpen || !activeTarget) return null;

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.animate({
        fit: { eles: cyRef.current.elements(), padding: 50 },
        duration: 300,
      });
    }
  };

  const handleZoomIn = () => {
    if (cyRef.current && containerRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 1.3,
        renderedPosition: {
          x: containerRef.current.clientWidth / 2,
          y: containerRef.current.clientHeight / 2,
        },
      });
    }
  };

  const handleZoomOut = () => {
    if (cyRef.current && containerRef.current) {
      cyRef.current.zoom({
        level: cyRef.current.zoom() * 0.75,
        renderedPosition: {
          x: containerRef.current.clientWidth / 2,
          y: containerRef.current.clientHeight / 2,
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div
        className={`bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isMaximized ? 'w-[98vw] h-[96vh]' : 'w-full max-w-6xl h-[88vh]'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] bg-black/30 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0 shadow-inner">
              <Workflow className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono">
                  Ієрархія викликів
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                  {callers.length} вхідних • {callees.length} вихідних
                </span>
              </div>
              <h2 className="text-base font-bold text-white truncate font-mono mt-0.5" title={activeTarget}>
                {rootNode ? `${rootNode.declaring_class.split('.').pop()}.${rootNode.name}()` : activeTarget}
              </h2>
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
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title={isMaximized ? 'Зменшити вікно' : 'Розгорнути на весь екран'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Закрити (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="p-2.5 px-5 border-b border-[#30363d] bg-[#0d1117]/80 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-xl border border-[#30363d]">
            <button
              onClick={() => setViewMode('diagram')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'diagram'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Відобразити у вигляді інтерактивного графа"
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
              title="Відобразити у 3 колонках"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
              <span>Колонки</span>
            </button>
          </div>

          {/* Depth Selector */}
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

          {/* Direction Filter */}
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
            <div className="w-full h-full relative">
              {/* Cytoscape Canvas */}
              <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

              {/* Floating Canvas Zoom/Fit Controls */}
              <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-[#161b22]/95 border border-[#30363d] p-1.5 rounded-xl shadow-2xl backdrop-blur-md z-20">
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                  title="Наблизити"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
                  title="Віддалити"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-[#30363d] mx-0.5" />
                <button
                  onClick={handleFit}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-sky-400 hover:text-sky-300 transition"
                  title="Вмістити на екрані"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* 3-Column Structured View */
            <div className="p-5 h-full overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                {/* Inbound Callers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#30363d]">
                    <span className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowDownLeft className="w-4 h-4" /> Хто викликає ({callers.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {callers.map((node) => (
                      <div
                        key={node.id}
                        onClick={() => setActiveTarget(node.id)}
                        className="p-3 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-sky-500/60 cursor-pointer transition-all hover:shadow-lg group"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-mono text-sky-400 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                            Крок {node.depth}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            {node.declaring_class.split('.').pop()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white font-mono group-hover:text-sky-300 transition-colors truncate">
                          {node.name}()
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target Element */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-purple-500/30">
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4" /> Цільовий метод
                    </span>
                  </div>
                  {rootNode && (
                    <div className="p-4 rounded-xl bg-purple-500/10 border-2 border-purple-500/40 shadow-xl">
                      <span className="text-[10px] font-mono text-purple-400 block truncate">
                        {rootNode.declaring_class}
                      </span>
                      <h3 className="text-sm font-bold text-white font-mono mt-1">
                        {rootNode.name}()
                      </h3>
                    </div>
                  )}
                </div>

                {/* Outbound Callees */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#30363d]">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowUpRight className="w-4 h-4" /> Кого викликає ({callees.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {callees.map((node) => (
                      <div
                        key={node.id}
                        onClick={() => setActiveTarget(node.id)}
                        className="p-3 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-amber-500/60 cursor-pointer transition-all hover:shadow-lg group"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            Крок +{node.depth}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            {node.declaring_class.split('.').pop()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white font-mono group-hover:text-amber-300 transition-colors truncate">
                          {node.name}()
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
