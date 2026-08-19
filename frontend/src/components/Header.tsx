import React, { useState, useEffect } from 'react';
import { ProjectModel, ArchitectureHealth } from '../types';
import { getArchitectureHealth, getArchitectureSnapshot } from '../api/client';
import { ProjectPickerModal } from './ProjectPickerModal';
import {
  Box,
  Folder,
  FileCode,
  ShieldAlert,
  BarChart3,
  FolderSearch,
  RefreshCw,
  EyeOff,
  Sliders,
  Target,
  Layers,
  Puzzle,
  Download,
  Activity,
  Award
} from 'lucide-react';

interface HeaderProps {
  project: ProjectModel | null;
  activeTab: 'modules' | 'packages' | 'classes' | 'impact' | 'drift' | 'extraction' | 'cycles' | 'metrics';
  onTabChange: (tab: 'modules' | 'packages' | 'classes' | 'impact' | 'drift' | 'extraction' | 'cycles' | 'metrics') => void;
  depth: number;
  onDepthChange: (depth: number) => void;
  isolateMode: boolean;
  onToggleIsolateMode: () => void;
  onScanPath: (path: string) => void;
  onLoadFromNoSQL: (path: string) => void;
  isScanning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  activeTab,
  onTabChange,
  depth,
  onDepthChange,
  isolateMode,
  onToggleIsolateMode,
  onScanPath,
  onLoadFromNoSQL,
  isScanning,
}) => {
  const [showScanModal, setShowScanModal] = useState(false);
  const [health, setHealth] = useState<ArchitectureHealth | null>(null);

  useEffect(() => {
    if (project) {
      getArchitectureHealth().then(setHealth).catch(console.error);
    }
  }, [project, isScanning]);

  const handleExportSnapshot = async () => {
    try {
      const snapshot = await getArchitectureSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.project_name || 'project'}-architecture-snapshot.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export snapshot error:', err);
    }
  };

  const getHealthBadgeColor = (grade?: string) => {
    if (!grade) return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    if (grade.startsWith('A')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (grade === 'B') return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    if (grade === 'C') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <header className="h-14 bg-[#161b22] border-b border-[#30363d] px-3 flex items-center justify-between gap-3 select-none z-20 overflow-x-auto">
      {/* Brand & Project Selector */}
      <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 font-black text-white text-sm">
            JL
          </div>
          <span className="font-extrabold text-base tracking-tight text-white hidden xl:inline">
            JavaLens
          </span>
        </div>

        {/* Project Picker Button */}
        <button
          onClick={() => setShowScanModal(true)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#0d1117] hover:bg-[#21262d] border border-sky-500/30 hover:border-sky-500/60 text-xs font-mono text-slate-200 transition-all truncate max-w-xs group shadow-sm ring-1 ring-sky-500/10"
          title="Натисніть для вибору проєкту, огляду папок або завантаження з NoSQL"
        >
          <FolderSearch className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform flex-shrink-0" />
          <span className="truncate font-semibold text-slate-100 max-w-[120px] sm:max-w-[180px]">
            {project?.project_name || 'Вибрати проєкт...'}
          </span>
        </button>

        {/* Architecture Health Widget */}
        {health && (
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold ${getHealthBadgeColor(
              health.grade
            )}`}
            title={`Architecture Health Score: ${health.score}/100 (Grade ${health.grade})`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>{health.score}/100</span>
            <span className="px-1 rounded bg-black/20 text-[10px]">{health.grade}</span>
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <nav className="flex items-center gap-1 bg-[#0d1117] p-1 rounded-xl border border-[#30363d] flex-shrink-0">
        <button
          onClick={() => onTabChange('modules')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'modules'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Діаграма модулів"
        >
          <Box className="w-3.5 h-3.5" />
          <span>Модулі</span>
        </button>

        <button
          onClick={() => onTabChange('packages')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'packages'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Діаграма пакетів"
        >
          <Folder className="w-3.5 h-3.5" />
          <span>Пакети</span>
        </button>

        <button
          onClick={() => onTabChange('classes')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'classes'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Граф класів"
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Класи</span>
        </button>

        <div className="w-px h-4 bg-[#30363d] mx-0.5" />

        {/* INTELLIGENCE TABS */}
        <button
          onClick={() => onTabChange('impact')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'impact'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Impact Analysis & Blast Radius"
        >
          <Target className="w-3.5 h-3.5 text-rose-400" />
          <span>Impact</span>
        </button>

        <button
          onClick={() => onTabChange('drift')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'drift'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Architecture Drift & Layer Violations"
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Drift</span>
        </button>

        <button
          onClick={() => onTabChange('extraction')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'extraction'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Microservice Extraction Assistant"
        >
          <Puzzle className="w-3.5 h-3.5 text-indigo-400" />
          <span>Extraction</span>
        </button>

        <button
          onClick={() => onTabChange('cycles')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'cycles'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Цикли</span>
        </button>

        <button
          onClick={() => onTabChange('metrics')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'metrics'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Метрики</span>
        </button>
      </nav>

      {/* Graph Visual Controls & Snapshot Export */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Depth Filter for Graph */}
        {(activeTab === 'modules' || activeTab === 'packages' || activeTab === 'classes') && (
          <div className="hidden lg:flex items-center gap-2 bg-[#0d1117] px-2 py-1 rounded-lg border border-[#30363d] text-xs">
            <span className="text-slate-400 flex items-center gap-1 font-medium text-[11px]">
              <Sliders className="w-3 h-3 text-sky-400" /> Глибина:
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 5].map((d) => (
                <button
                  key={d}
                  onClick={() => onDepthChange(d)}
                  className={`w-4 h-4 rounded flex items-center justify-center font-mono text-[10px] font-semibold transition-colors ${
                    depth === d
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {d === 5 ? '∞' : d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Isolate Mode Toggle */}
        {(activeTab === 'modules' || activeTab === 'packages' || activeTab === 'classes') && (
          <button
            onClick={onToggleIsolateMode}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isolateMode
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-[#0d1117] text-slate-400 hover:text-slate-200 border-[#30363d]'
            }`}
            title="Приховує всі непов'язані вузли"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Ізоляція</span>
          </button>
        )}

        {/* Export Source-Safe Snapshot Button */}
        {project && (
          <button
            onClick={handleExportSnapshot}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
            title="Експортувати безпечний знімок архітектури (JSON для CI/CD чи звітів)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Snapshot</span>
          </button>
        )}

        {/* Rescan Button */}
        {project && (
          <button
            onClick={() => onScanPath(project.root_path)}
            disabled={isScanning}
            className="p-1.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            title="Пересканувати та оновити NoSQL базу"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        )}
      </div>

      {/* Dedicated Project Picker & Explorer Modal */}
      <ProjectPickerModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onScanPath={onScanPath}
        onLoadFromNoSQL={onLoadFromNoSQL}
        isScanning={isScanning}
      />
    </header>
  );
};
