import React, { useState, useMemo } from 'react';
import { ProjectModel, ClassInfo, PackageInfo, ModuleInfo } from '../types';
import {
  Folder,
  FolderOpen,
  FileCode,
  Box,
  ChevronDown,
  ChevronRight,
  Layers,
  Search,
  Filter,
  RotateCcw,
  Target,
  Sparkles,
  Globe,
  CheckSquare,
  Square
} from 'lucide-react';

interface SidebarProps {
  project: ProjectModel | null;
  activeTab: string;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  hideDTOs: boolean;
  onToggleHideDTOs: () => void;
  selectedModules: string[];
  onToggleModule: (moduleId: string) => void;
  onSelectOnlyModule: (moduleId: string) => void;
  onClearModuleFilter: () => void;
  selectedPackages: string[];
  onTogglePackage: (packageId: string) => void;
  onSelectOnlyPackage: (packageId: string) => void;
  onClearPackageFilter: () => void;
  includeExternal: boolean;
  onToggleIncludeExternal: () => void;
  onDrillDown?: (targetId: string, targetView: 'modules' | 'packages' | 'classes') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  project,
  activeTab,
  selectedNodeId,
  onSelectNode,
  searchTerm,
  onSearchChange,
  hideDTOs,
  onToggleHideDTOs,
  selectedModules,
  onToggleModule,
  onSelectOnlyModule,
  onClearModuleFilter,
  selectedPackages,
  onTogglePackage,
  onSelectOnlyPackage,
  onClearPackageFilter,
  includeExternal,
  onToggleIncludeExternal,
  onDrillDown,
}) => {
  const [expandedMods, setExpandedMods] = useState<Record<string, boolean>>({});
  const [expandedPkgs, setExpandedPkgs] = useState<Record<string, boolean>>({});

  const toggleMod = (modId: string) => {
    setExpandedMods((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const togglePkg = (pkgId: string) => {
    setExpandedPkgs((prev) => ({ ...prev, [pkgId]: !prev[pkgId] }));
  };

  const hasModuleFilter = selectedModules.length > 0;
  const hasPackageFilter = selectedPackages.length > 0;

  // Filter classes by active module & package filters & search with useMemo
  const filteredClasses = useMemo(() => {
    if (!project) return [];
    const term = searchTerm.trim().toLowerCase();
    return project.classes.filter((c: ClassInfo) => {
      if (hideDTOs && (c.name.endsWith('Dto') || c.name.endsWith('DTO') || c.name.endsWith('VO'))) return false;
      if (hasModuleFilter && !selectedModules.includes(c.module_name)) return false;
      if (hasPackageFilter && !selectedPackages.includes(c.package_name)) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        c.package_name.toLowerCase().includes(term)
      );
    });
  }, [project, hideDTOs, hasModuleFilter, selectedModules, hasPackageFilter, selectedPackages, searchTerm]);

  // Pre-index classes by module and package for O(1) hierarchy building
  const { classesByPkgMap, packagesByModMap } = useMemo(() => {
    const pkgMap = new Map<string, ClassInfo[]>();
    for (const c of filteredClasses) {
      let list = pkgMap.get(c.package_name);
      if (!list) {
        list = [];
        pkgMap.set(c.package_name, list);
      }
      list.push(c);
    }

    const modMap = new Map<string, PackageInfo[]>();
    if (project) {
      for (const p of project.packages) {
        const modKey = p.module_name || 'default';
        let list = modMap.get(modKey);
        if (!list) {
          list = [];
          modMap.set(modKey, list);
        }
        list.push(p);
      }
    }

    return { classesByPkgMap: pkgMap, packagesByModMap: modMap };
  }, [filteredClasses, project]);

  if (!project) return null;

  const modulesList = project.modules.length > 0
    ? project.modules
    : [{ id: 'default', name: project.project_name, path: '', build_type: '', direct_dependencies: [], exported_packages: [], afferent_coupling: 0, efferent_coupling: 0, instability: 0 }];

  return (
    <div className="w-80 h-full flex flex-col bg-[#161b22] border-r border-[#30363d] overflow-hidden flex-shrink-0 select-none">
      {/* Search Input */}
      <div className="p-3 border-b border-[#30363d] bg-black/15">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Пошук модулів, пакетів, класів..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
          />
        </div>
      </div>

      {/* Active Filter Scope Indicators */}
      {(hasModuleFilter || hasPackageFilter) && (
        <div className="px-3 py-2 border-b border-[#30363d] bg-sky-950/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-sky-300 font-mono text-[11px] truncate">
            <Filter className="w-3 h-3 text-sky-400 flex-shrink-0" />
            <span className="truncate">
              {hasModuleFilter && `${selectedModules.length} мод.`}
              {hasModuleFilter && hasPackageFilter && ' • '}
              {hasPackageFilter && `${selectedPackages.length} пак.`}
            </span>
          </div>
          <button
            onClick={() => { onClearModuleFilter(); onClearPackageFilter(); }}
            className="text-[10px] text-sky-400 hover:text-sky-200 font-mono flex items-center gap-1 ml-2 flex-shrink-0"
            title="Скинути всі фільтри"
          >
            <RotateCcw className="w-2.5 h-2.5" /> Скинути
          </button>
        </div>
      )}

      {/* Quick Controls: DTO & Include External Toggle */}
      <div className="px-3 py-2 border-b border-[#30363d] bg-black/20 flex flex-col gap-1.5 text-[11px] text-slate-400">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors">
          <input
            type="checkbox"
            checked={includeExternal}
            onChange={onToggleIncludeExternal}
            className="rounded border-[#30363d] bg-[#0d1117] text-purple-500 focus:ring-0 w-3.5 h-3.5"
          />
          <span className="flex items-center gap-1 text-slate-300 font-semibold">
            <Globe className="w-3 h-3 text-purple-400" />
            <span>Зовнішні зв'язки</span>
          </span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200 transition-colors">
          <input
            type="checkbox"
            checked={hideDTOs}
            onChange={onToggleHideDTOs}
            className="rounded border-[#30363d] bg-[#0d1117] text-sky-500 focus:ring-0 w-3.5 h-3.5"
          />
          <span>Приховати DTO / Entity</span>
        </label>
      </div>

      {/* 3-Level Hierarchical Tree: Module ➔ Package ➔ Class */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-400" /> Ієрархія ({modulesList.length} мод. • {filteredClasses.length} клас.)
          </span>
        </div>

        {modulesList.map((m) => {
          const isModExpanded = expandedMods[m.id] ?? (modulesList.length <= 3 || searchTerm.length > 0);
          const modPackages = packagesByModMap.get(m.id) || [];
          const isModSelected = selectedModules.includes(m.id);

          return (
            <div key={m.id} className="space-y-0.5">
              {/* Level 1: Module Header */}
              <div
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-mono transition-colors group ${
                  isModSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : selectedNodeId === m.id
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                <button onClick={() => toggleMod(m.id)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                  {isModExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}
                  <Box className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span className="truncate flex-1 font-bold text-[11px]" title={m.name}>
                    {m.name}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onSelectOnlyModule(m.id);
                      if (onDrillDown) onDrillDown(m.id, 'packages');
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-emerald-500/20 rounded text-emerald-400 transition-opacity text-[10px] font-semibold"
                    title="Фокусувати цей модуль на графі"
                  >
                    <Target className="w-3 h-3" />
                  </button>
                  <span className="text-[9px] text-slate-400 px-1 rounded bg-black/40">
                    {modPackages.length} пак.
                  </span>
                </div>
              </div>

              {/* Level 2: Packages of this Module */}
              {isModExpanded && (
                <div className="pl-3 space-y-0.5 border-l border-emerald-500/10 ml-3.5">
                  {modPackages.map((pkg) => {
                    const isPkgExpanded = expandedPkgs[pkg.id] ?? (modPackages.length <= 4 || searchTerm.length > 0);
                    const pkgClasses = classesByPkgMap.get(pkg.name) || classesByPkgMap.get(pkg.id) || [];
                    if (searchTerm && pkgClasses.length === 0) return null;

                    const isPkgSelected = selectedPackages.includes(pkg.id);
                    const shortPkgName = pkg.name.split('.').slice(-2).join('.');

                    return (
                      <div key={pkg.id} className="space-y-0.5">
                        {/* Package Header */}
                        <div
                          className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono transition-colors group ${
                            isPkgSelected
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : selectedNodeId === pkg.id
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <button onClick={() => togglePkg(pkg.id)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                            {isPkgExpanded ? (
                              <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            )}
                            {isPkgExpanded ? (
                              <FolderOpen className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                            ) : (
                              <Folder className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                            )}
                            <span className="truncate flex-1 text-[11px]" title={pkg.name}>
                              {shortPkgName}
                            </span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                onSelectOnlyPackage(pkg.id);
                                if (onDrillDown) onDrillDown(pkg.id, 'classes');
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-purple-500/20 rounded text-purple-400 transition-opacity"
                              title="Ізолювати класи цього пакета на графі"
                            >
                              <Target className="w-3 h-3" />
                            </button>
                            <span className="text-[9px] text-slate-400 px-1 rounded bg-black/40">
                              {pkgClasses.length}
                            </span>
                          </div>
                        </div>

                        {/* Level 3: Classes in Package */}
                        {isPkgExpanded && (
                          <div className="pl-3 space-y-0.5 border-l border-purple-500/10 ml-3">
                            {pkgClasses.slice(0, 30).map((cls) => {
                              const isClassSelected = selectedNodeId === cls.id;
                              return (
                                <button
                                  key={cls.id}
                                  onClick={() => onSelectNode(cls.id)}
                                  className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono transition-all text-left truncate ${
                                    isClassSelected
                                      ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50 font-bold shadow-sm'
                                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                  }`}
                                  title={cls.id}
                                >
                                  <FileCode className={`w-3 h-3 flex-shrink-0 ${isClassSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                                  <span className="truncate">{cls.name}</span>
                                  {cls.annotations.length > 0 && (
                                    <span className="text-[8px] text-amber-400 ml-auto flex-shrink-0 font-normal">
                                      @{cls.annotations[0]}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                            {pkgClasses.length > 30 && (
                              <div className="text-[9px] font-mono text-slate-500 px-2 py-0.5 italic">
                                +ще {pkgClasses.length - 30} класів
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
