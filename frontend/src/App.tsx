import React, { useState, useEffect, useCallback } from 'react';
import { ProjectModel, VisualGraphPayload } from './types';
import { scanProject, getProject, getGraph, loadStoredProject } from './api/client';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { InspectorPanel } from './components/inspector/InspectorPanel';
import { GraphCanvas } from './components/views/GraphCanvas';
import { CyclesView } from './components/views/CyclesView';
import { MetricsView } from './components/views/MetricsView';
import { ImpactView } from './components/views/ImpactView';
import { DriftView } from './components/views/DriftView';
import { ExtractionView } from './components/views/ExtractionView';
import { CallHierarchyModal } from './components/CallHierarchyModal';

export function App() {
  const [project, setProject] = useState<ProjectModel | null>(null);
  const [activeTab, setActiveTab] = useState<
    'modules' | 'packages' | 'classes' | 'impact' | 'drift' | 'extraction' | 'cycles' | 'metrics'
  >('classes');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [callHierarchyTarget, setCallHierarchyTarget] = useState<string | null>(null);
  const [depth, setDepth] = useState<number>(1);
  const [isolateMode, setIsolateMode] = useState<boolean>(false);
  const [hideDTOs, setHideDTOs] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [graphData, setGraphData] = useState<VisualGraphPayload | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Scoping Filters: Module, Package, and Boundary/External connections
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [includeExternal, setIncludeExternal] = useState<boolean>(true);

  const defaultFixturePath = 'd:/antigravity/java_project_analyzer/fixtures/sample-petclinic';

  // Load or scan project
  const handleScanPath = useCallback(async (path: string) => {
    try {
      setIsScanning(true);
      await scanProject(path);
      const proj = await getProject();
      setProject(proj);
      setSelectedNodeId(null);
      setSelectedModules([]);
      setSelectedPackages([]);
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Load project from NoSQL DB
  const handleLoadFromNoSQL = useCallback(async (path: string) => {
    try {
      setIsScanning(true);
      await loadStoredProject(path);
      const proj = await getProject();
      setProject(proj);
      setSelectedNodeId(null);
      setSelectedModules([]);
      setSelectedPackages([]);
    } catch (err) {
      console.error('Load from NoSQL error:', err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    handleScanPath(defaultFixturePath);
  }, [handleScanPath]);

  // Fetch updated graph when tab, selected node, depth, isolate mode, module/package filters, or external toggle change
  useEffect(() => {
    if (!project) return;
    if (
      activeTab === 'cycles' ||
      activeTab === 'metrics' ||
      activeTab === 'impact' ||
      activeTab === 'drift' ||
      activeTab === 'extraction'
    ) {
      return;
    }

    getGraph(
      activeTab,
      selectedNodeId || undefined,
      depth,
      isolateMode,
      selectedModules.length > 0 ? selectedModules : undefined,
      selectedPackages.length > 0 ? selectedPackages : undefined,
      includeExternal
    )
      .then((data) => setGraphData(data))
      .catch((err) => console.error('Graph fetch error:', err));
  }, [project, activeTab, selectedNodeId, depth, isolateMode, selectedModules, selectedPackages, includeExternal]);

  // Select node inside current graph
  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };

  // Navigate directly from any analytical view (Impact, Drift, Extraction, Cycles, Metrics) to the graph
  const handleNavigateToGraph = useCallback(
    (nodeId: string, view: 'modules' | 'packages' | 'classes' = 'classes') => {
      setSelectedNodeId(nodeId);
      setActiveTab(view);
    },
    []
  );

  const handleCanvasClick = () => {
    setSelectedNodeId(null);
  };

  // Module filter handlers
  const handleToggleModule = (moduleId: string) => {
    setSelectedModules((prev) => {
      if (prev.includes(moduleId)) {
        return prev.filter((id) => id !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const handleSelectOnlyModule = (moduleId: string) => {
    setSelectedModules([moduleId]);
  };

  const handleClearModuleFilter = () => {
    setSelectedModules([]);
  };

  // Package filter handlers
  const handleTogglePackage = (packageId: string) => {
    setSelectedPackages((prev) => {
      if (prev.includes(packageId)) {
        return prev.filter((id) => id !== packageId);
      } else {
        return [...prev, packageId];
      }
    });
  };

  const handleSelectOnlyPackage = (packageId: string) => {
    setSelectedPackages([packageId]);
    if (activeTab === 'modules') {
      setActiveTab('classes');
    }
  };

  const handleClearPackageFilter = () => {
    setSelectedPackages([]);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1117]">
      {/* Header */}
      <Header
        project={project}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedNodeId(null);
        }}
        depth={depth}
        onDepthChange={setDepth}
        isolateMode={isolateMode}
        onToggleIsolateMode={() => setIsolateMode(!isolateMode)}
        onScanPath={handleScanPath}
        onLoadFromNoSQL={handleLoadFromNoSQL}
        isScanning={isScanning}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar only on graph views */}
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
            onToggleModule={handleToggleModule}
            onSelectOnlyModule={handleSelectOnlyModule}
            onClearModuleFilter={handleClearModuleFilter}
            selectedPackages={selectedPackages}
            onTogglePackage={handleTogglePackage}
            onSelectOnlyPackage={handleSelectOnlyPackage}
            onClearPackageFilter={handleClearPackageFilter}
            includeExternal={includeExternal}
            onToggleIncludeExternal={() => setIncludeExternal(!includeExternal)}
          />
        )}

        {/* Dynamic Main View Area */}
        <main className="flex-1 h-full overflow-hidden relative flex flex-col bg-[#0d1117]">
          {activeTab === 'cycles' ? (
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
              selectedModules={selectedModules}
              selectedPackages={selectedPackages}
              onClearModuleFilter={handleClearModuleFilter}
              onClearPackageFilter={handleClearPackageFilter}
              includeExternal={includeExternal}
              onToggleIncludeExternal={() => setIncludeExternal(!includeExternal)}
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
    </div>
  );
}
export default App;
