import React, { useEffect, useRef, useState, useMemo } from 'react';
import cytoscape, { Core, EventObject } from 'cytoscape';
// @ts-ignore
import dagre from 'cytoscape-dagre';
// @ts-ignore
import fcose from 'cytoscape-fcose';
import { VisualGraphPayload } from '../../types';
import {
  Layers,
  Box,
  Grid,
  Filter,
  Eye,
  EyeOff,
  Maximize2,
  Folder,
  Globe,
  ChevronRight,
  Home,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

// Register layout extensions safely
try {
  cytoscape.use(dagre);
} catch {}
try {
  cytoscape.use(fcose);
} catch {}

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

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  selectedNodeId,
  onSelectNode,
  onCanvasClick,
  activeView,
  selectedModules = [],
  selectedPackages = [],
  includeExternal = false,
  onToggleIncludeExternal,
  onDrillDown,
  onNavigateView,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [layoutMode, setLayoutMode] = useState<'dagre' | 'fcose' | 'grid' | 'concentric'>('dagre');
  const [hideDTOs, setHideDTOs] = useState<boolean>(false);
  const [onlyActiveEdges, setOnlyActiveEdges] = useState<boolean>(true);

  // -------------------------------------------------------------
  // Filter nodes & edges
  // -------------------------------------------------------------
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (!graphData) return { filteredNodes: [], filteredEdges: [] };

    let nodes = graphData.nodes;
    if (hideDTOs) {
      nodes = nodes.filter((n) => {
        const name = n.label || '';
        return !name.endsWith('Dto') && !name.endsWith('DTO') && !name.endsWith('VO') && n.category !== 'dto';
      });
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = graphData.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    return { filteredNodes: nodes, filteredEdges: edges };
  }, [graphData, hideDTOs]);

  // -------------------------------------------------------------
  // Run layout algorithm (only on initial load or layout switch)
  // -------------------------------------------------------------
  const runLayout = (cy: Core, mode: string) => {
    let layoutOptions: any;

    if (mode === 'dagre') {
      layoutOptions = {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 60,
        rankSep: 80,
        edgeSep: 30,
        animate: true,
        animationDuration: 300,
        fit: true,
        padding: 50,
      };
    } else if (mode === 'fcose') {
      layoutOptions = {
        name: 'fcose',
        quality: 'proof',
        randomize: false,
        animate: true,
        animationDuration: 300,
        fit: true,
        padding: 50,
        nodeSeparation: 80,
        idealEdgeLength: 120,
      };
    } else if (mode === 'grid') {
      layoutOptions = {
        name: 'grid',
        fit: true,
        padding: 50,
        animate: true,
        animationDuration: 300,
      };
    } else {
      layoutOptions = {
        name: 'concentric',
        fit: true,
        padding: 50,
        animate: true,
        animationDuration: 300,
      };
    }

    try {
      const l = cy.layout(layoutOptions);
      l.run();
    } catch (e) {
      const fallback = cy.layout({ name: 'grid', fit: true, padding: 50 });
      fallback.run();
    }
  };

  // -------------------------------------------------------------
  // Initialize Cytoscape instance on structure change
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    // Transform to Cytoscape elements
    const elements: cytoscape.ElementDefinition[] = [];

    // Nodes
    for (const node of filteredNodes) {
      const category = (node.category || '').toLowerCase();
      const layer = (node.layer || '').toLowerCase();
      const isInterface = category === 'interface';
      const isModule = node.category === 'module' || activeView === 'modules';
      const isPackage = node.category === 'package' || activeView === 'packages';

      elements.push({
        group: 'nodes',
        data: {
          id: node.id,
          label: node.label,
          category: category,
          layer: layer,
          degreeIn: node.degree_in || 0,
          degreeOut: node.degree_out || 0,
          isInterface: isInterface ? 'true' : 'false',
          isModule: isModule ? 'true' : 'false',
          isPackage: isPackage ? 'true' : 'false',
        },
      });
    }

    // Edges
    for (const edge of filteredEdges) {
      elements.push({
        group: 'edges',
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label || '',
          kind: edge.kind || '',
          isCircular: edge.is_circular ? 'true' : 'false',
        },
      });
    }

    // High-Contrast Dark Theme Stylesheet for Cytoscape
    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      minZoom: 0.08,
      maxZoom: 4.0,
      wheelSensitivity: 0.25,
      style: [
        // BASE NODE STYLING
        {
          selector: 'node',
          style: {
            'shape': 'round-rectangle',
            'width': '190px',
            'height': '52px',
            'background-color': '#161b22',
            'border-width': '2px',
            'border-color': '#30363d',
            'border-opacity': 1,
            'corner-radius': '10px',
            'label': 'data(label)',
            'color': '#ffffff',
            'font-family': 'JetBrains Mono, Fira Code, monospace',
            'font-size': '12px',
            'font-weight': 'bold',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'ellipsis',
            'text-max-width': '170px',
            'text-outline-color': '#0d1117',
            'text-outline-width': '2px',
            'transition-property': 'background-color, border-color, border-width, opacity',
            'transition-duration': 0.15,
          } as any,
        },
        // Controllers / UI Layer
        {
          selector: 'node[layer = "ui"], node[category = "controller"]',
          style: {
            'background-color': '#881337',
            'border-color': '#f43f5e',
          },
        },
        // Service Layer
        {
          selector: 'node[layer = "service"], node[category = "service"]',
          style: {
            'background-color': '#1e3a8a',
            'border-color': '#60a5fa',
          },
        },
        // Repository / Data Layer
        {
          selector: 'node[layer = "repository"], node[category = "repository"], node[category = "dao"]',
          style: {
            'background-color': '#064e3b',
            'border-color': '#34d399',
          },
        },
        // Interfaces
        {
          selector: 'node[isInterface = "true"]',
          style: {
            'background-color': '#0c4a6e',
            'border-color': '#38bdf8',
            'border-style': 'dashed',
          },
        },
        // Packages
        {
          selector: 'node[isPackage = "true"]',
          style: {
            'background-color': '#3b0764',
            'border-color': '#c084fc',
            'width': '210px',
            'height': '56px',
          },
        },
        // Modules
        {
          selector: 'node[isModule = "true"]',
          style: {
            'background-color': '#022c22',
            'border-color': '#10b981',
            'width': '230px',
            'height': '60px',
            'font-size': '13px',
          },
        },
        // SELECTED NODE STYLING
        {
          selector: 'node.selected',
          style: {
            'border-color': '#a855f7',
            'border-width': '4px',
            'background-color': '#2e1065',
            'shadow-blur': 20,
            'shadow-color': '#a855f7',
            'shadow-opacity': 0.9,
            'z-index': 999,
            'opacity': 1,
          } as any,
        },
        // Inbound caller neighbors (Who calls selected)
        {
          selector: 'node.neighbor-in',
          style: {
            'border-color': '#38bdf8',
            'border-width': '3.5px',
            'background-color': '#0c4a6e',
            'opacity': 1,
            'z-index': 500,
          },
        },
        // Outbound callee neighbors (Who selected calls)
        {
          selector: 'node.neighbor-out',
          style: {
            'border-color': '#fbbf24',
            'border-width': '3.5px',
            'background-color': '#451a03',
            'opacity': 1,
            'z-index': 500,
          },
        },
        // Dimmed when another node is selected in active mode
        {
          selector: 'node.dimmed',
          style: {
            'opacity': 0.12,
          },
        },

        // BASE EDGE STYLING
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#475569',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle-backcurve',
            'target-arrow-color': '#475569',
            'arrow-scale': 1.2,
            'opacity': 0.65,
            'transition-property': 'line-color, target-arrow-color, width, opacity',
            'transition-duration': 0.15,
          } as any,
        },
        // Extends / Implements
        {
          selector: 'edge[kind = "Extends"], edge[kind = "Implements"]',
          style: {
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'line-style': 'dashed',
            'width': 2.5,
          },
        },
        // Field / Autowired
        {
          selector: 'edge[kind = "FieldDependency"]',
          style: {
            'line-color': '#ec4899',
            'target-arrow-color': '#ec4899',
            'width': 2.5,
          },
        },
        // Method Call
        {
          selector: 'edge[kind = "MethodCall"]',
          style: {
            'line-color': '#a855f7',
            'target-arrow-color': '#a855f7',
            'width': 2,
          },
        },
        // GWT RPC
        {
          selector: 'edge[kind = "GwtRpcBinding"]',
          style: {
            'line-color': '#fbbf24',
            'target-arrow-color': '#fbbf24',
            'width': 2.5,
          },
        },
        // Circular Edges
        {
          selector: 'edge[isCircular = "true"]',
          style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'width': 3,
            'opacity': 0.9,
          },
        },
        // Active Inbound Highlighted Edge (Calls INTO selected)
        {
          selector: 'edge.inbound-edge',
          style: {
            'width': 4,
            'opacity': 1,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'z-index': 800,
          },
        },
        // Active Outbound Highlighted Edge (Calls OUT FROM selected)
        {
          selector: 'edge.outbound-edge',
          style: {
            'width': 4,
            'opacity': 1,
            'line-color': '#fbbf24',
            'target-arrow-color': '#fbbf24',
            'z-index': 800,
          },
        },
        // Dimmed Edge
        {
          selector: 'edge.dimmed',
          style: {
            'opacity': 0.04,
          },
        },
      ],
    });

    // Event Handlers
    cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target;
      onSelectNode(node.id());
    });

    cy.on('dbltap', 'node', (evt: EventObject) => {
      const node = evt.target;
      const id = node.id();
      if (activeView === 'modules') {
        if (onDrillDown) onDrillDown(id, 'packages');
      } else if (activeView === 'packages') {
        if (onDrillDown) onDrillDown(id, 'classes');
      }
    });

    cy.on('tap', (evt: EventObject) => {
      if (evt.target === cy) {
        onCanvasClick();
      }
    });

    cyRef.current = cy;

    runLayout(cy, layoutMode);

    return () => {
      cy.destroy();
    };
  }, [filteredNodes, filteredEdges, activeView]);

  // -------------------------------------------------------------
  // Pure Visual Selection Effect (ZERO RESHUFFLE, INSTANT STYLING)
  // -------------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass('selected inbound-edge outbound-edge neighbor-in neighbor-out dimmed');

      if (selectedNodeId) {
        const selectedNode = cy.getElementById(selectedNodeId);
        if (selectedNode.length > 0) {
          selectedNode.addClass('selected');

          const inEdges = selectedNode.incomers('edge');
          const outEdges = selectedNode.outgoers('edge');
          const inNodes = selectedNode.incomers('node');
          const outNodes = selectedNode.outgoers('node');

          if (onlyActiveEdges) {
            cy.elements().addClass('dimmed');
            selectedNode.removeClass('dimmed');

            inNodes.removeClass('dimmed').addClass('neighbor-in');
            outNodes.removeClass('dimmed').addClass('neighbor-out');
            inEdges.removeClass('dimmed').addClass('inbound-edge');
            outEdges.removeClass('dimmed').addClass('outbound-edge');
          } else {
            inNodes.addClass('neighbor-in');
            outNodes.addClass('neighbor-out');
            inEdges.addClass('inbound-edge');
            outEdges.addClass('outbound-edge');
          }
        }
      }
    });
  }, [selectedNodeId, onlyActiveEdges]);

  // Switch layout mode explicitly
  const handleLayoutChange = (mode: 'dagre' | 'fcose' | 'grid' | 'concentric') => {
    setLayoutMode(mode);
    if (cyRef.current) {
      runLayout(cyRef.current, mode);
    }
  };

  // Fit to screen
  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.animate({
        fit: {
          eles: cyRef.current.elements(),
          padding: 50,
        },
        duration: 300,
      });
    }
  };

  // Zoom In / Out
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
    <div className="relative w-full h-full bg-[#0d1117] overflow-hidden select-none">
      {/* CYTOSCAPE HTML5 CANVAS CONTAINER */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP FLOATING BAR (Breadcrumbs & Layout Controls) */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20 gap-3">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 bg-[#161b22]/95 border border-[#30363d] px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto text-xs font-mono">
          <button
            onClick={() => onNavigateView && onNavigateView('modules')}
            className={`flex items-center gap-1 hover:text-white transition ${
              activeView === 'modules' ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Проєкт</span>
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
        <div className="flex items-center gap-1 bg-[#161b22]/95 border border-[#30363d] p-1 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto">
          <button
            onClick={() => handleLayoutChange('dagre')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              layoutMode === 'dagre'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Ієрархічний потік (Dagre)"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Шари</span>
          </button>

          <button
            onClick={() => handleLayoutChange('fcose')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              layoutMode === 'fcose'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Кластери (FCoSE Physics)"
          >
            <Box className="w-3.5 h-3.5 text-purple-400" />
            <span>Кластери</span>
          </button>

          <button
            onClick={() => handleLayoutChange('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              layoutMode === 'grid'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Сітка елементів"
          >
            <Grid className="w-3.5 h-3.5 text-emerald-400" />
            <span>Сітка</span>
          </button>
        </div>

        {/* View Options & Filters */}
        <div className="flex items-center gap-1 bg-[#161b22]/95 border border-[#30363d] p-1 rounded-xl shadow-2xl backdrop-blur-md pointer-events-auto">
          {/* Active Edges Only Toggle */}
          <button
            onClick={() => setOnlyActiveEdges(!onlyActiveEdges)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              onlyActiveEdges
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Приховувати неактивні зв'язки при виборі вузла"
          >
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Фокус</span>
          </button>

          {/* Hide DTOs Toggle */}
          <button
            onClick={() => setHideDTOs(!hideDTOs)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              hideDTOs
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Сховати DTO / Entity класи"
          >
            {hideDTOs ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Без DTO</span>
          </button>

          {/* External/Cross-Module Toggle */}
          {onToggleIncludeExternal && (
            <button
              onClick={onToggleIncludeExternal}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                includeExternal
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Показувати зв'язки до зовнішніх модулів"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Зовнішні</span>
            </button>
          )}
        </div>
      </div>

      {/* BOTTOM-LEFT FLOATING CONTROLS (Zoom & Fit) */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-[#161b22]/95 border border-[#30363d] p-1.5 rounded-xl shadow-2xl backdrop-blur-md z-20">
        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
          title="Наблизити (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition"
          title="Віддалити (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-[#30363d] mx-0.5" />
        <button
          onClick={handleFit}
          className="p-1.5 hover:bg-white/10 rounded-lg text-sky-400 hover:text-sky-300 transition"
          title="Вмістити весь граф на екрані (Fit to Screen)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* BOTTOM-RIGHT METRICS COUNTER & VISUAL LEGEND */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-xl bg-[#161b22]/95 border border-[#30363d] text-[11px] font-mono shadow-2xl backdrop-blur-md flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sky-300 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
            <span>⬅ Вхідні</span>
          </span>
          <span className="flex items-center gap-1.5 text-amber-300 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>➡ Вихідні</span>
          </span>
          <span className="text-emerald-400 font-bold">⚡ 60 FPS (Canvas)</span>
        </div>
      </div>
    </div>
  );
};
