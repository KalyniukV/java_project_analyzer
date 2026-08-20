import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectModel, VisualGraphPayload, ScanProgress } from './types';
import { scanProject, getProject, getGraph, loadStoredProject, getScanProgress } from './api/client';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { InspectorPanel } from './components/inspector/InspectorPanel';
import { GraphCanvas } from './components/views/GraphCanvas';
import { MatrixView } from './components/views/MatrixView';
import { CyclesView } from './components/views/CyclesView';
import { MetricsView } from './components/views/MetricsView';
import { ImpactView } from './components/views/ImpactView';
import { DriftView } from './components/views/DriftView';
import { ExtractionView } from './components/views/ExtractionView';
import { CallHierarchyModal } from './components/CallHierarchyModal';
import { ScanProgressModal } from './components/ScanProgressModal';

export function App() {
  const [project, setProject] = useState<ProjectModel | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('javalens_theme') as 'dark' | 'light') || 'dark';
  });
  const [activeTab, setActiveTab] = useState<
    'modules' | 'packages' | 'classes' | 'matrix' | 'impact' | 'drift' | 'extraction' | 'cycles' | 'metrics'
  >('modules');

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('javalens_theme', next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.className = theme;
    document.body.className = theme;
  }, [theme]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [callHierarchyTarget, setCallHierarchyTarget] = useState<string | null>(null);
  const [depth, setDepth] = useState<number>(1);
  const [isolateMode, setIsolateMode] = useState<boolean>(false);
  const [hideDTOs, setHideDTOs] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [graphData, setGraphData] = useState<VisualGraphPayload | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Scan Progress Modal State
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [scanningPath, setScanningPath] = useState<string>('');
  const progressIntervalRef = useRef<any>(null);

  // Scoping Filters: Module, Package, and Boundary/External connections
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [includeExternal, setIncludeExternal] = useState<boolean>(true);

  // Load or scan project with real-time progress streaming
  const handleScanPath = useCallback(async (path: string) => {
    if (!path || !path.trim()) return;
    try {
      setIsScanning(true);
      setScanningPath(path);
      setShowProgressModal(true);

      // Start live polling of progress
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = setInterval(async () => {
        try {
          const prog = await getScanProgress();
          setScanProgress(prog);
        } catch {
          // ignore transient poll errors
        }
      }, 300);

      await scanProject(path);

      // Final progress fetch
      try {
        const finalProg = await getScanProgress();
        setScanProgress(finalProg);
      } catch {
        // ignore
      }

      const proj = await getProject();
      setProject(proj);
      setSelectedNodeId(null);
      setSelectedModules([]);
      setSelectedPackages([]);
      if (proj && proj.modules && proj.modules.length > 1) {
        setActiveTab('modules');
      } else {
        setActiveTab('packages');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanProgress((prev) => ({
        is_scanning: false,
        stage: 'Помилка сканування',
        stage_index: 0,
        total_stages: 4,
        processed_items: 0,
        total_items: 0,
        percentage: 0,
        modules_found: 0,
        packages_found: 0,
        classes_found: 0,
        relationships_found: 0,
        elapsed_ms: 0,
        speed_items_per_sec: 0,
        eta_seconds: 0,
        logs: prev?.logs ? [...prev.logs, `[ERROR] ${err?.message || err}`] : [`[ERROR] ${err?.message || err}`],
        error: err?.message || String(err),
      }));
    } finally {
      setIsScanning(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, []);

  // Load directly from embedded NoSQL database (redb) instantly
  const handleLoadFromNoSQL = useCallback(async (rootPath: string) => {
    try {
      setIsScanning(true);
      const proj = await loadStoredProject(rootPath);
      setProject(proj);
      setSelectedNodeId(null);
      setSelectedModules([]);
      setSelectedPackages([]);
      if (proj.modules && proj.modules.length > 1) {
        setActiveTab('modules');
      } else {
        setActiveTab('packages');
      }
    } catch (err) {
      console.error('Load from NoSQL error:', err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Initial load: check if project already pre-loaded from CLI
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const current = await getProject();
        if (isMounted && current) {
          setProject(current);
          if (current.modules && current.modules.length > 1) {
            setActiveTab('modules');
          } else {
            setActiveTab('packages');
          }
        }
      } catch {
        // No project pre-loaded, user will pick one
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch updated graph when tab, module/package filters, or external toggle change
  useEffect(() => {
    let isMounted = true;

    if (activeTab === 'modules' || activeTab === 'packages' || activeTab === 'classes') {
      getGraph(
        activeTab,
        undefined,
        1,
        false,
        selectedModules.length > 0 ? selectedModules : undefined,
        selectedPackages.length > 0 ? selectedPackages : undefined,
        includeExternal
      )
        .then((data) => {
          if (isMounted) {
            setGraphData(data);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch graph payload:', err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedModules, selectedPackages, includeExternal]);

  // Handle node selection from graph or sidebar
  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  };

  // Handle clicking empty canvas space to deselect
  const handleCanvasClick = () => {
    setSelectedNodeId(null);
  };

  // Direct Drill-down helper
  const handleDrillDown = useCallback((targetId: string, targetView: 'modules' | 'packages' | 'classes') => {
    if (targetView === 'packages') {
      setSelectedModules([targetId]);
      setActiveTab('packages');
      setSelectedNodeId(null);
    } else if (targetView === 'classes') {
      setSelectedPackages([targetId]);
      setActiveTab('classes');
      setSelectedNodeId(null);
    } else {
      setSelectedModules([]);
      setSelectedPackages([]);
      setActiveTab('modules');
      setSelectedNodeId(null);
    }
  }, []);

  const handleNavigateView = useCallback((view: 'modules' | 'packages' | 'classes') => {
    if (view === 'modules') {
      setSelectedModules([]);
      setSelectedPackages([]);
    } else if (view === 'packages') {
      setSelectedPackages([]);
    }
    setActiveTab(view);
  }, []);

  // Navigation from DSM Matrix, Cycles, or Impact views directly to Graph View
  const handleNavigateToGraph = (nodeId: string, view: 'modules' | 'packages' | 'classes' = 'classes') => {
    setActiveTab(view);
    setSelectedNodeId(nodeId);
  };

  // Module filter helpers
  const handleToggleModuleFilter = (moduleId: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    );
  };

  const handleClearModuleFilter = () => {
    setSelectedModules([]);
  };

  // Package filter helpers
  const handleTogglePackageFilter = (pkgName: string) => {
    setSelectedPackages((prev) =>
      prev.includes(pkgName) ? prev.filter((p) => p !== pkgName) : [...prev, pkgName]
    );
  };

  const handleClearPackageFilter = () => {
    setSelectedPackages([]);
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${theme} bg-[#0d1117] text-slate-100 font-sans select-none`}>
      {/* Top Header Bar */}
      <Header
        project={project}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        depth={depth}
        onDepthChange={setDepth}
        isolateMode={isolateMode}
        onToggleIsolateMode={() => setIsolateMode(!isolateMode)}
        onScanPath={handleScanPath}
        onLoadFromNoSQL={handleLoadFromNoSQL}
        isScanning={isScanning}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Workspace: Left Sidebar, Center Canvas, Right Inspector */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar for Classes, Packages, and Modules */}
        {(activeTab === 'modules' || activeTab === 'packages' || activeTab === 'classes') && (
          <Sidebar
            project={project}
            activeTab={activeTab}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            hideDTOs={hideDTOs}
            onToggleHideDTOs={() => setHideDTOs(!hideDTOs)}
            selectedModules={selectedModules}
            onToggleModule={handleToggleModuleFilter}
            onSelectOnlyModule={(m) => { setSelectedModules([m]); setActiveTab('packages'); }}
            onClearModuleFilter={handleClearModuleFilter}
            selectedPackages={selectedPackages}
            onTogglePackage={handleTogglePackageFilter}
            onSelectOnlyPackage={(p) => { setSelectedPackages([p]); setActiveTab('classes'); }}
            onClearPackageFilter={handleClearPackageFilter}
            includeExternal={includeExternal}
            onToggleIncludeExternal={() => setIncludeExternal(!includeExternal)}
            onDrillDown={handleDrillDown}
          />
        )}

        {/* Dynamic Main View Area */}
        <main className="flex-1 h-full overflow-hidden relative flex flex-col bg-[#0d1117]">
          {activeTab === 'matrix' ? (
            <MatrixView
              project={project}
              onNavigateToGraph={handleNavigateToGraph}
              onSelectModule={(m) => handleDrillDown(m, 'packages')}
              onSelectPackage={(p) => handleDrillDown(p, 'classes')}
            />
          ) : activeTab === 'cycles' ? (
            <CyclesView onSelectNode={(nodeId) => handleNavigateToGraph(nodeId, 'classes')} />
          ) : activeTab === 'metrics' ? (
            <MetricsView project={project} onSelectNode={(nodeId) => handleNavigateToGraph(nodeId, 'packages')} />
          ) : activeTab === 'impact' ? (
            <ImpactView
              project={project}
              onNavigateToGraph={(nodeId) => handleNavigateToGraph(nodeId, 'classes')}
            />
          ) : activeTab === 'drift' ? (
            <DriftView
              project={project}
              onNavigateToGraph={(nodeId) => handleNavigateToGraph(nodeId, 'classes')}
            />
          ) : activeTab === 'extraction' ? (
            <ExtractionView
              project={project}
              onNavigateToGraph={(nodeId) => handleNavigateToGraph(nodeId, 'classes')}
            />
          ) : (
            <GraphCanvas
              graphData={graphData}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              onCanvasClick={handleCanvasClick}
              activeView={activeTab as any}
              depth={depth}
              isolateMode={isolateMode}
              selectedModules={selectedModules}
              selectedPackages={selectedPackages}
              onClearModuleFilter={handleClearModuleFilter}
              onClearPackageFilter={handleClearPackageFilter}
              includeExternal={includeExternal}
              onToggleIncludeExternal={() => setIncludeExternal(!includeExternal)}
              onDrillDown={handleDrillDown}
              onNavigateView={handleNavigateView}
            />
          )}
        </main>

        {/* Right Inspector Panel for selected entity */}
        {(activeTab === 'modules' || activeTab === 'packages' || activeTab === 'classes') && (
          <InspectorPanel
            selectedNodeId={selectedNodeId}
            graphData={graphData}
            project={project}
            onSelectNode={handleSelectNode}
            onClose={() => setSelectedNodeId(null)}
            onOpenCallHierarchy={(targetId) => setCallHierarchyTarget(targetId)}
          />
        )}
      </div>

      {/* Call Hierarchy Modal */}
      <CallHierarchyModal
        isOpen={Boolean(callHierarchyTarget)}
        onClose={() => setCallHierarchyTarget(null)}
        targetId={callHierarchyTarget}
        onNavigateToClass={(classId) => handleNavigateToGraph(classId, 'classes')}
      />

      {/* Scan Progress & Live Logs Modal for 100k+ classes */}
      <ScanProgressModal
        isOpen={showProgressModal}
        progress={scanProgress}
        scanningPath={scanningPath}
        onClose={() => {
          setShowProgressModal(false);
          setScanProgress(null);
        }}
      />
    </div>
  );
}
export default App;
