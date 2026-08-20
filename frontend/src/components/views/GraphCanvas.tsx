import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
  depth?: number;
  isolateMode?: boolean;
  selectedModules?: string[];
  selectedPackages?: string[];
  onClearModuleFilter?: () => void;
  onClearPackageFilter?: () => void;
  includeExternal?: boolean;
  onToggleIncludeExternal?: () => void;
  onDrillDown?: (targetId: string, targetView: 'modules' | 'packages' | 'classes') => void;
  onNavigateView?: (view: 'modules' | 'packages' | 'classes') => void;
}

// -------------------------------------------------------------
// SVG Card Generator for ReactFlow-identical visual styling
// -------------------------------------------------------------
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateNodeSvg(
  label: string,
  layerTag: string,
  subLabel: string,
  inDeg: number,
  outDeg: number,
  headerBg: string,
  borderColor: string,
  isDashed: boolean = false,
  isSelected: boolean = false
): string {
  const safeLabel = escapeXml(label.length > 28 ? label.substring(0, 26) + '...' : label);
  const safeTag = escapeXml(layerTag);
  const safeSub = escapeXml(subLabel.length > 34 ? subLabel.substring(0, 32) + '...' : subLabel);

  const effectiveBorderColor = isSelected ? '#a855f7' : borderColor;
  const borderWidth = isSelected ? '3' : '2';
  const cardBg = isSelected ? '#201335' : '#161b22';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="80" viewBox="0 0 260 80">
    <!-- Card Container -->
    <rect x="1.5" y="1.5" width="257" height="77" rx="8" ry="8" fill="${cardBg}" stroke="${effectiveBorderColor}" stroke-width="${borderWidth}" ${
    isDashed && !isSelected ? 'stroke-dasharray="4 3"' : ''
  } />
    
    <!-- Top Header Bar (ReactFlow Style) -->
    <path d="M 1.5 8.5 Q 1.5 1.5 8.5 1.5 L 251.5 1.5 Q 258.5 1.5 258.5 8.5 L 258.5 23.5 L 1.5 23.5 Z" fill="${headerBg}" />
    <text x="12" y="16.5" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="800" letter-spacing="0.6">${safeTag}</text>
    
    <!-- Top & Bottom Port Handles (ReactFlow Style) -->
    <circle cx="130" cy="1.5" r="3.5" fill="#38bdf8" stroke="#0d1117" stroke-width="1.5" />
    <circle cx="130" cy="78.5" r="3.5" fill="#38bdf8" stroke="#0d1117" stroke-width="1.5" />
    
    <!-- Main Label (Class / Package / Module Name) -->
    <text x="12" y="42" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'JetBrains Mono', sans-serif" font-size="12.5" font-weight="700">${safeLabel}</text>
    
    <!-- Sublabel / Annotations -->
    ${
      safeSub
        ? `<text x="12" y="58" fill="#93c5fd" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="500">${safeSub}</text>`
        : ''
    }
    
    <!-- In / Out Dependency Counts -->
    <text x="12" y="71.5" fill="#94a3b8" font-family="'JetBrains Mono', monospace" font-size="8.5">⬇ ${inDeg} in  •  ⬆ ${outDeg} out</text>
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  selectedNodeId,
  onSelectNode,
  onCanvasClick,
  activeView,
  depth = 1,
  isolateMode = false,
  selectedModules = [],
  selectedPackages = [],
  includeExternal = false,
  onToggleIncludeExternal,
  onDrillDown,
  onNavigateView,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const lastActiveViewRef = useRef<string>(activeView);
  const positionsCacheRef = useRef<Map<string, cytoscape.Position>>(new Map());

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
  // Layout Execution Helper
  // -------------------------------------------------------------
  const runLayout = useCallback((cy: Core, mode: string) => {
    let layoutOptions: any;

    if (mode === 'dagre') {
      layoutOptions = {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 70,
        rankSep: 90,
        edgeSep: 35,
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
        nodeSeparation: 90,
        idealEdgeLength: 140,
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
  }, []);

  // -------------------------------------------------------------
  // 1. Initialize Cytoscape ONCE on Mount (Never recreate DOM)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      boxSelectionEnabled: false,
      autounselectify: false,
      minZoom: 0.08,
      maxZoom: 4.0,
      wheelSensitivity: 0.25,
      style: [
        // BASE NODE STYLING (ReactFlow Pixel-Perfect Card)
        {
          selector: 'node',
          style: {
            'shape': 'rectangle',
            'width': '260px',
            'height': '80px',
            'background-image': 'data(svgCard)',
            'background-fit': 'cover',
            'background-opacity': 0,
            'border-width': 0,
            'label': '',
            'transition-property': 'opacity',
            'transition-duration': 0.15,
          } as any,
        },
        // SELECTED NODE STYLING
        {
          selector: 'node.selected',
          style: {
            'background-image': 'data(svgCardSelected)',
            'shadow-blur': 25,
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
            'shadow-blur': 15,
            'shadow-color': '#38bdf8',
            'shadow-opacity': 0.8,
            'opacity': 1,
            'z-index': 500,
          },
        },
        // Outbound callee neighbors (Who selected calls)
        {
          selector: 'node.neighbor-out',
          style: {
            'shadow-blur': 15,
            'shadow-color': '#fbbf24',
            'shadow-opacity': 0.8,
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

        // BASE EDGE STYLING (ReactFlow Clean Bezier / Step)
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#475569',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#475569',
            'arrow-scale': 1.1,
            'opacity': 0.7,
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

    return () => {
      try {
        cy.destroy();
      } catch {}
      cyRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------
  // 2. Incremental Element Synchronization (No DOM recreation!)
  // -------------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Cache current node positions
    cy.nodes().forEach((n) => {
      positionsCacheRef.current.set(n.id(), { ...n.position() });
    });

    const isViewChanged = lastActiveViewRef.current !== activeView;
    lastActiveViewRef.current = activeView;
    if (isViewChanged) {
      positionsCacheRef.current.clear();
    }

    // Build Cytoscape element definitions with ReactFlow SVG Cards
    const newElements: cytoscape.ElementDefinition[] = [];

    for (const node of filteredNodes) {
      const category = (node.category || '').toLowerCase();
      const layer = (node.layer || '').toLowerCase();
      const isInterface = category === 'interface';
      const isModule = node.category === 'module' || activeView === 'modules';
      const isPackage = node.category === 'package' || activeView === 'packages';
      const isExternalNode = node.is_external === true;

      // Determine Header Color & Layer Title
      let layerTag = 'CLASS';
      let headerBg = '#334155';
      let borderColor = '#475569';

      if (isModule) {
        layerTag = '📦 MODULE';
        headerBg = '#065f46';
        borderColor = '#10b981';
      } else if (isPackage) {
        layerTag = '📁 PACKAGE';
        headerBg = '#6b21a8';
        borderColor = '#c084fc';
      } else if (isInterface) {
        layerTag = '🔷 INTERFACE';
        headerBg = '#0369a1';
        borderColor = '#38bdf8';
      } else if (layer === 'ui' || category === 'controller') {
        layerTag = '🛡️ CONTROLLER / UI';
        headerBg = '#9f1239';
        borderColor = '#f43f5e';
      } else if (layer === 'service' || category === 'service') {
        layerTag = '⚙️ SERVICE';
        headerBg = '#1d4ed8';
        borderColor = '#60a5fa';
      } else if (layer === 'repository' || category === 'repository' || category === 'dao') {
        layerTag = '💾 REPOSITORY / DAO';
        headerBg = '#047857';
        borderColor = '#34d399';
      } else if (layer === 'domain' || category === 'entity') {
        layerTag = '📦 DOMAIN ENTITY';
        headerBg = '#b45309';
        borderColor = '#fbbf24';
      } else if (node.sub_label?.includes('GWT')) {
        layerTag = '⚡ GWT RPC';
        headerBg = '#86198f';
        borderColor = '#d946ef';
      }

      const subLabel = (!isModule && !isPackage && node.sub_label) ? node.sub_label : '';

      const svgCard = generateNodeSvg(
        node.label,
        layerTag,
        subLabel,
        node.degree_in || 0,
        node.degree_out || 0,
        headerBg,
        borderColor,
        isInterface || isExternalNode,
        false
      );

      const svgCardSelected = generateNodeSvg(
        node.label,
        layerTag,
        subLabel,
        node.degree_in || 0,
        node.degree_out || 0,
        headerBg,
        '#a855f7',
        false,
        true
      );

      const cachedPos = positionsCacheRef.current.get(node.id);

      newElements.push({
        group: 'nodes',
        data: {
          id: node.id,
          label: node.label,
          svgCard: svgCard,
          svgCardSelected: svgCardSelected,
          category: category,
          layer: layer,
          degreeIn: node.degree_in || 0,
          degreeOut: node.degree_out || 0,
          isInterface: isInterface ? 'true' : 'false',
          isModule: isModule ? 'true' : 'false',
          isPackage: isPackage ? 'true' : 'false',
          isExternal: isExternalNode ? 'true' : 'false',
        },
        position: cachedPos ? { x: cachedPos.x, y: cachedPos.y } : undefined,
      });
    }

    for (const edge of filteredEdges) {
      newElements.push({
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

    // Atomic element replacement in Cytoscape memory
    cy.batch(() => {
      cy.elements().remove();
      cy.add(newElements);

      // Restore cached positions
      cy.nodes().forEach((n) => {
        const cached = positionsCacheRef.current.get(n.id());
        if (cached) {
          n.position(cached);
        }
      });
    });

    const hasUnpositionedNodes = newElements.some((e) => e.group === 'nodes' && !e.position);
    if (isViewChanged || hasUnpositionedNodes || positionsCacheRef.current.size === 0) {
      runLayout(cy, layoutMode);
    }
  }, [filteredNodes, filteredEdges, activeView, runLayout, layoutMode]);

  // Fit to screen helper
  const handleFit = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.animate({
        fit: {
          eles: cyRef.current.elements(':visible'),
          padding: 50,
        },
        duration: 300,
      });
    }
  }, []);

  // -------------------------------------------------------------
  // 3. Focus, Multi-hop Depth BFS, and Isolate Mode
  // -------------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass('selected inbound-edge outbound-edge neighbor-in neighbor-out dimmed');
      cy.elements().style('display', 'element');

      if (selectedNodeId) {
        const selectedNode = cy.getElementById(selectedNodeId);
        if (selectedNode.length > 0) {
          selectedNode.addClass('selected');

          // Multi-hop BFS according to depth prop
          let inNodes = cy.collection();
          let inEdges = cy.collection();
          let currInFrontier = selectedNode;

          for (let d = 0; d < depth; d++) {
            const stepEdges = currInFrontier.incomers('edge');
            const stepNodes = currInFrontier.incomers('node').difference(inNodes).difference(selectedNode);
            inEdges = inEdges.union(stepEdges);
            inNodes = inNodes.union(stepNodes);
            currInFrontier = stepNodes;
            if (currInFrontier.length === 0) break;
          }

          let outNodes = cy.collection();
          let outEdges = cy.collection();
          let currOutFrontier = selectedNode;

          for (let d = 0; d < depth; d++) {
            const stepEdges = currOutFrontier.outgoers('edge');
            const stepNodes = currOutFrontier.outgoers('node').difference(outNodes).difference(selectedNode);
            outEdges = outEdges.union(stepEdges);
            outNodes = outNodes.union(stepNodes);
            currOutFrontier = stepNodes;
            if (currOutFrontier.length === 0) break;
          }

          const activeNodes = selectedNode.union(inNodes).union(outNodes);
          const activeEdges = inEdges.union(outEdges);
          const activeElements = activeNodes.union(activeEdges);

          if (isolateMode) {
            // In isolate mode, completely hide everything outside the neighborhood
            const nonActiveElements = cy.elements().difference(activeElements);
            nonActiveElements.style('display', 'none');

            inNodes.addClass('neighbor-in');
            outNodes.addClass('neighbor-out');
            inEdges.addClass('inbound-edge');
            outEdges.addClass('outbound-edge');
          } else if (onlyActiveEdges) {
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

    if (isolateMode && selectedNodeId) {
      handleFit();
    }
  }, [selectedNodeId, depth, isolateMode, onlyActiveEdges, handleFit]);

  // Switch layout mode explicitly
  const handleLayoutChange = (mode: 'dagre' | 'fcose' | 'grid' | 'concentric') => {
    setLayoutMode(mode);
    positionsCacheRef.current.clear();
    if (cyRef.current) {
      runLayout(cyRef.current, mode);
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
      {/* CYTOSCAPE HTML5 CANVAS CONTAINER with ReactFlow Dot Grid */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{
          backgroundColor: '#0d1117',
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.12) 1.2px, transparent 1.2px)',
          backgroundSize: '20px 20px',
        }}
      />

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
