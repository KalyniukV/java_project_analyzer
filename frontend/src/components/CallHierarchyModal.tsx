import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateCallNodeSvg(
  label: string,
  layerTag: string,
  subLabel: string,
  headerBg: string,
  borderColor: string,
  isRoot: boolean = false
): string {
  const safeLabel = escapeXml(label.length > 28 ? label.substring(0, 26) + '...' : label);
  const safeTag = escapeXml(layerTag);
  const safeSub = escapeXml(subLabel.length > 34 ? subLabel.substring(0, 32) + '...' : subLabel);

  const cardBg = isRoot ? '#201335' : '#161b22';
  const borderWidth = isRoot ? '3' : '2';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="74" viewBox="0 0 260 74">
    <!-- Card Container -->
    <rect x="1.5" y="1.5" width="257" height="71" rx="8" ry="8" fill="${cardBg}" stroke="${borderColor}" stroke-width="${borderWidth}" />
    
    <!-- Top Header Bar -->
    <path d="M 1.5 8.5 Q 1.5 1.5 8.5 1.5 L 251.5 1.5 Q 258.5 1.5 258.5 8.5 L 258.5 22.5 L 1.5 22.5 Z" fill="${headerBg}" />
    <text x="10" y="15.5" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="800" letter-spacing="0.5">${safeTag}</text>
    
    <!-- Left & Right Port Handles (Horizontal Flow) -->
    <circle cx="1.5" cy="37" r="3" fill="#38bdf8" stroke="#0d1117" stroke-width="1.5" />
    <circle cx="258.5" cy="37" r="3" fill="#38bdf8" stroke="#0d1117" stroke-width="1.5" />
    
    <!-- Method Name -->
    <text x="10" y="41" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'JetBrains Mono', sans-serif" font-size="12" font-weight="700">${safeLabel}</text>
    
    <!-- Declaring Class Sublabel -->
    <text x="10" y="58" fill="#93c5fd" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="500">${safeSub}</text>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
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

  // Filtered elements for Cytoscape with ReactFlow styled SVG cards
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

    for (const node of filteredNodes) {
      const isRoot = node.depth === 0;
      const isCaller = node.depth < 0;

      let layerTag = isRoot
        ? '🎯 TARGET METHOD'
        : isCaller
        ? `⬅ CALLER (Step ${node.depth})`
        : `➡ CALLEE (Step +${node.depth})`;

      let headerBg = isRoot ? '#6b21a8' : isCaller ? '#0369a1' : '#c2410c';
      let borderColor = isRoot ? '#c084fc' : isCaller ? '#38bdf8' : '#fb923c';

      const shortClass = node.class_simple_name || node.declaring_class.split('.').pop() || node.declaring_class;
      const methodName = `${node.name}()`;

      const svgCard = generateCallNodeSvg(methodName, layerTag, shortClass, headerBg, borderColor, isRoot);

      elements.push({
        group: 'nodes',
        data: {
          id: node.id,
          label: methodName,
          svgCard: svgCard,
          depth: node.depth,
          isRoot: isRoot ? 'true' : 'false',
          isCaller: isCaller ? 'true' : 'false',
          declaringClass: node.declaring_class,
          methodName: node.name,
        },
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
  }, [hierarchy, direction]);

  const runHierarchyLayout = useCallback((cy: Core) => {
    try {
      const l = cy.layout({
        name: 'dagre',
        rankDir: 'LR', // Horizontal flow: Callers (Left) -> Root (Center) -> Callees (Right)
        nodeSep: 40,
        rankSep: 90,
        edgeSep: 25,
        animate: true,
        animationDuration: 300,
        fit: true,
        padding: 50,
      } as any);
      l.run();
    } catch {
      const fallback = cy.layout({ name: 'grid', fit: true, padding: 50 });
      fallback.run();
    }
  }, []);

  // Cytoscape Canvas Lifecycle
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    if (!cyRef.current) {
      const cy = cytoscape({
        container: containerRef.current,
        elements: [],
        boxSelectionEnabled: false,
        autounselectify: false,
        minZoom: 0.1,
        maxZoom: 3.5,
        wheelSensitivity: 0.25,
        style: [
          {
            selector: 'node',
            style: {
              'shape': 'rectangle',
              'width': '260px',
              'height': '74px',
              'background-image': 'data(svgCard)',
              'background-fit': 'cover',
              'background-opacity': 0,
              'border-width': 0,
              'label': '',
            } as any,
          },
          {
            selector: 'node[isRoot = "true"]',
            style: {
              'shadow-blur': 25,
              'shadow-color': '#a855f7',
              'shadow-opacity': 0.9,
              'z-index': 999,
            } as any,
          },
          // Edge styling
          {
            selector: 'edge',
            style: {
              'width': 2.5,
              'line-color': '#38bdf8',
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#38bdf8',
              'arrow-scale': 1.1,
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
    }

    const cy = cyRef.current;
    if (cy && cyElements.length > 0) {
      cy.batch(() => {
        cy.elements().remove();
        cy.add(cyElements);
      });
      runHierarchyLayout(cy);
    }
  }, [isOpen, cyElements, activeTarget, runHierarchyLayout]);

  // Clean up Cytoscape on modal close
  useEffect(() => {
    if (!isOpen && cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch {}
      cyRef.current = null;
    }
  }, [isOpen]);

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
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-30 bg-[#0d1117]/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-300 font-mono text-xs">
              <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mb-3"></div>
              <span>Побудова графа викликів (Depth {depth})...</span>
            </div>
          )}

          {/* Diagram Canvas (Always mounted in DOM to prevent ref null) */}
          <div
            className={`w-full h-full relative ${
              viewMode === 'diagram' ? 'block' : 'hidden'
            }`}
          >
            <div
              ref={containerRef}
              className="w-full h-full cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: '#0d1117',
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.12) 1.2px, transparent 1.2px)',
                backgroundSize: '20px 20px',
              }}
            />

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

          {/* 3-Column Structured View */}
          {viewMode === 'columns' && (
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
