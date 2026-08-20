import React, { useState, useMemo, useEffect } from 'react';
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
  X
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
  // Local input with debounce for 0ms typing lag
  const [localInput, setLocalInput] = useState(searchTerm);
  const [expandedMods, setExpandedMods] = useState<Record<string, boolean>>({});
  const [expandedPkgs, setExpandedPkgs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localInput);
    }, 120);
    return () => clearTimeout(handler);
  }, [localInput, onSearchChange]);

  const toggleMod = (modId: string) => {
    setExpandedMods((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const togglePkg = (pkgId: string) => {
    setExpandedPkgs((prev) => ({ ...prev, [pkgId]: !prev[pkgId] }));
  };

  const hasModuleFilter = selectedModules.length > 0;
  const hasPackageFilter = selectedPackages.length > 0;
  const isSearching = localInput.trim().length > 0;

  // 1. Filtered classes (Lightning fast O(N), with search term)
  const { matchedClasses, totalMatchedCount } = useMemo(() => {
    if (!project) return { matchedClasses: [], totalMatchedCount: 0 };
    const term = localInput.trim().toLowerCase();

    let count = 0;
    const matches: ClassInfo[] = [];

    for (const c of project.classes) {
      if (hideDTOs && (c.name.endsWith('Dto') || c.name.endsWith('DTO') || c.name.endsWith('VO'))) continue;
      if (hasModuleFilter && !selectedModules.includes(c.module_name)) continue;
      if (hasPackageFilter && !selectedPackages.includes(c.package_name)) continue;

      if (!term || c.name.toLowerCase().includes(term) || c.package_name.toLowerCase().includes(term) || c.module_name.toLowerCase().includes(term)) {
        count++;
        if (matches.length < 50) {
          matches.push(c);
        }
      }
    }

    return { matchedClasses: matches, totalMatchedCount: count };
  }, [project, hideDTOs, hasModuleFilter, selectedModules, hasPackageFilter, selectedPackages, localInput]);

  // 2. Group matched classes by Module -> Package
  const searchGroupedTree = useMemo(() => {
    if (!isSearching) return null;

    const modMap = new Map<string, Map<string, ClassInfo[]>>();
    for (const c of matchedClasses) {
      const mName = c.module_name || 'default';
      if (!modMap.has(mName)) {
        modMap.set(mName, new Map());
      }
      const pkgMap = modMap.get(mName)!;
      if (!pkgMap.has(c.package_name)) {
        pkgMap.set(c.package_name, []);
      }
      pkgMap.get(c.package_name)!.push(c);
    }
    return modMap;
  }, [matchedClasses, isSearching]);

  // 3. Normal structure (when NOT searching)
  const { packagesByModMap } = useMemo(() => {
    const modMap = new Map<string, PackageInfo[]>();
    if (project) {
      for (const p of project.packages) {
        if (hasModuleFilter && !selectedModules.includes(p.module_name)) continue;
        const modKey = p.module_name || 'default';
        let list = modMap.get(modKey);
        if (!list) {
          list = [];
          modMap.set(modKey, list);
        }
        list.push(p);
      }
    }
    return { packagesByModMap: modMap };
  }, [project, hasModuleFilter, selectedModules]);

  if (!project) return null;

  const modulesList = project.modules.length > 0
    ? (hasModuleFilter ? project.modules.filter(m => selectedModules.includes(m.id)) : project.modules)
    : [{ id: 'default', name: project.project_name, path: '', build_type: '', direct_dependencies: [], exported_packages: [], afferent_coupling: 0, efferent_coupling: 0, instability: 0 }];

  return (
    <div className="w-80 h-full flex flex-col bg-[#161b22] border-r border-[#30363d] overflow-hidden flex-shrink-0 select-none">
      {/* Search Input with Instant Clear */}
      <div className="p-3 border-b border-[#30363d] bg-black/20">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Швидкий пошук (клас, пакет, модуль)..."
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
          />
          {localInput && (
            <button
              onClick={() => { setLocalInput(''); onSearchChange(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isSearching ? (
          /* =========================================================
             SEARCH RESULTS MODE (Grouped by Module ➔ Package ➔ Class)
             ========================================================= */
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-sky-300 font-bold">
                <Search className="w-3 h-3 text-sky-400" />
                Знайдено: {totalMatchedCount} {totalMatchedCount === 1 ? 'клас' : 'класів'}
              </span>
              {totalMatchedCount > 50 && (
                <span className="text-[9px] text-amber-400 font-mono">
                  Топ-50
                </span>
              )}
            </div>

            {searchGroupedTree && Array.from(searchGroupedTree.entries()).map(([modName, pkgMap]) => (
              <div key={modName} className="rounded-xl border border-emerald-500/20 bg-black/20 p-2 space-y-1.5">
                {/* Module Group Header */}
                <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-300 px-1">
                  <span className="flex items-center gap-1.5 truncate">
                    <Box className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{modName}</span>
                  </span>
                  <button
                    onClick={() => {
                      onSelectOnlyModule(modName);
                      if (onDrillDown) onDrillDown(modName, 'packages');
                    }}
                    className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400 transition"
                    title="Фокус на цьому модулі"
                  >
                    <Target className="w-3 h-3" />
                  </button>
                </div>

                {/* Packages in this Module */}
                <div className="space-y-1 pl-2 border-l border-emerald-500/10 ml-1">
                  {Array.from(pkgMap.entries()).map(([pkgName, classes]) => (
                    <div key={pkgName} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-purple-300 px-1">
                        <span className="flex items-center gap-1 truncate" title={pkgName}>
                          <Folder className="w-3 h-3 text-purple-400 flex-shrink-0" />
                          <span className="truncate">{pkgName.split('.').slice(-2).join('.')}</span>
                        </span>
                        <button
                          onClick={() => {
                            onSelectOnlyPackage(pkgName);
                            if (onDrillDown) onDrillDown(pkgName, 'classes');
                          }}
                          className="p-0.5 hover:bg-purple-500/20 rounded text-purple-400 transition"
                          title="Фокус на цьому пакеті"
                        >
                          <Target className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Matching Classes */}
                      <div className="space-y-0.5 pl-3 border-l border-purple-500/10 ml-1">
                        {classes.map((cls) => {
                          const isSelected = selectedNodeId === cls.id;
                          return (
                            <button
                              key={cls.id}
                              onClick={() => onSelectNode(cls.id)}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-all text-left truncate ${
                                isSelected
                                  ? 'bg-sky-500/30 text-sky-200 border border-sky-500/60 font-bold shadow-md'
                                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
                              }`}
                              title={cls.id}
                            >
                              <FileCode className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                              <span className="truncate">{cls.name}</span>
                              {cls.annotations.length > 0 && (
                                <span className="text-[8px] text-amber-400 ml-auto flex-shrink-0">
                                  @{cls.annotations[0]}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {totalMatchedCount === 0 && (
              <div className="p-6 text-center text-xs font-mono text-slate-500 border border-dashed border-[#30363d] rounded-xl">
                Не знайдено класів за запитом "{localInput}".
              </div>
            )}
          </div>
        ) : (
          /* =========================================================
             STANDARD HIERARCHICAL TREE (Module ➔ Package ➔ Class)
             ========================================================= */
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-emerald-400" />
                Ієрархія ({modulesList.length} мод. • {project.packages.length} пак.)
              </span>
            </div>

            {modulesList.map((m) => {
              const isModExpanded = expandedMods[m.id] ?? (modulesList.length <= 2);
              const modPackages = packagesByModMap.get(m.id) || [];
              const isModSelected = selectedModules.includes(m.id);

              return (
                <div key={m.id} className="space-y-0.5">
                  {/* Module Header */}
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
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-emerald-500/20 rounded text-emerald-400 transition-opacity"
                        title="Фокусувати цей модуль на графі"
                      >
                        <Target className="w-3 h-3" />
                      </button>
                      <span className="text-[9px] text-slate-400 px-1 rounded bg-black/40">
                        {modPackages.length}
                      </span>
                    </div>
                  </div>

                  {/* Packages in Module */}
                  {isModExpanded && (
                    <div className="pl-3 space-y-0.5 border-l border-emerald-500/10 ml-3.5">
                      {modPackages.map((pkg) => {
                        const isPkgExpanded = expandedPkgs[pkg.id] ?? false;
                        const isPkgSelected = selectedPackages.includes(pkg.id);
                        const shortPkgName = pkg.name.split('.').slice(-2).join('.');

                        return (
                          <div key={pkg.id} className="space-y-0.5">
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
                                  {pkg.class_ids.length}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
