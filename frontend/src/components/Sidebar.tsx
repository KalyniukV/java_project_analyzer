import React, { useState } from 'react';
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
  CheckSquare,
  Square,
  RotateCcw,
  Target,
  Sparkles,
  Globe
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
}) => {
  const [expandedPkgs, setExpandedPkgs] = useState<Record<string, boolean>>({
    'org.springframework.samples.petclinic.model': true,
    'org.springframework.samples.petclinic.service': true,
    'org.springframework.samples.petclinic.controller': true,
  });
  const [showModuleFilter, setShowModuleFilter] = useState<boolean>(true);
  const [showPackageFilter, setShowPackageFilter] = useState<boolean>(true);

  const togglePkg = (pkgId: string) => {
    setExpandedPkgs((prev) => ({ ...prev, [pkgId]: !prev[pkgId] }));
  };

  if (!project) return null;

  const hasModuleFilter = selectedModules.length > 0;
  const hasPackageFilter = selectedPackages.length > 0;

  // Filter packages by active module filter
  const visiblePackages = project.packages.filter((pkg) => {
    if (hasModuleFilter && !selectedModules.includes(pkg.module_name)) {
      return false;
    }
    return true;
  });

  // Filter classes by active module & package filters
  const filteredClasses = project.classes.filter((c: ClassInfo) => {
    if (hideDTOs && (c.name.endsWith('Dto') || c.name.endsWith('DTO'))) return false;
    if (hasModuleFilter && !selectedModules.includes(c.module_name)) return false;
    if (hasPackageFilter && !selectedPackages.includes(c.package_name)) return false;
    if (!searchTerm) return true;
    return (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.package_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="w-80 h-full flex flex-col bg-[#161b22] border-r border-[#30363d] overflow-hidden flex-shrink-0">
      {/* Search Input */}
      <div className="p-3 border-b border-[#30363d] bg-black/10">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Пошук класів / пакетів..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors font-mono"
          />
        </div>
      </div>

      {/* 1. MODULE SCOPING FILTER (If project has modules) */}
      {project.modules.length > 0 && (
        <div className="border-b border-[#30363d] bg-[#161b22]">
          <div className="px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-300">
            <button
              onClick={() => setShowModuleFilter(!showModuleFilter)}
              className="flex items-center gap-1.5 hover:text-sky-400 transition-colors uppercase tracking-wider text-[10px]"
            >
              {showModuleFilter ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              <Box className="w-3.5 h-3.5 text-emerald-400" />
              <span>Фільтр Модулів ({selectedModules.length > 0 ? `${selectedModules.length}/${project.modules.length}` : 'Всі'})</span>
            </button>
            {hasModuleFilter && (
              <button
                onClick={onClearModuleFilter}
                className="text-[10px] text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1"
                title="Показати всі модулі"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Всі
              </button>
            )}
          </div>

          {showModuleFilter && (
            <div className="px-3 pb-2.5 space-y-1 max-h-32 overflow-y-auto">
              {project.modules.map((m: ModuleInfo) => {
                const isChecked = selectedModules.length === 0 || selectedModules.includes(m.id);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-xs font-mono py-1 px-1.5 rounded hover:bg-white/5 group"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleModule(m.id)}
                        className="rounded border-[#30363d] bg-[#0d1117] text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span className={`truncate ${isChecked ? 'text-slate-200 font-semibold' : 'text-slate-400'}`}>
                        {m.name}
                      </span>
                    </label>
                    <button
                      onClick={() => onSelectOnlyModule(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] text-emerald-400 hover:underline px-1 rounded bg-emerald-500/10 transition-opacity"
                      title="Показати тільки цей модуль"
                    >
                      Тільки
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. PACKAGE SCOPING FILTER */}
      <div className="border-b border-[#30363d] bg-[#161b22]">
        <div className="px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-300">
          <button
            onClick={() => setShowPackageFilter(!showPackageFilter)}
            className="flex items-center gap-1.5 hover:text-purple-400 transition-colors uppercase tracking-wider text-[10px]"
          >
            {showPackageFilter ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            <Folder className="w-3.5 h-3.5 text-purple-400" />
            <span>Фільтр Пакетів ({selectedPackages.length > 0 ? `${selectedPackages.length}/${visiblePackages.length}` : 'Всі'})</span>
          </button>
          {hasPackageFilter && (
            <button
              onClick={onClearPackageFilter}
              className="text-[10px] text-purple-400 hover:text-purple-300 font-mono flex items-center gap-1"
              title="Показати всі пакети"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Всі
            </button>
          )}
        </div>

        {showPackageFilter && (
          <div className="px-3 pb-2.5 space-y-1 max-h-36 overflow-y-auto">
            {visiblePackages.map((p: PackageInfo) => {
              const isChecked = selectedPackages.length === 0 || selectedPackages.includes(p.id);
              const shortName = p.name.split('.').slice(-2).join('.');
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs font-mono py-1 px-1.5 rounded hover:bg-white/5 group"
                >
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" title={p.name}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onTogglePackage(p.id)}
                      className="rounded border-[#30363d] bg-[#0d1117] text-purple-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className={`truncate ${isChecked ? 'text-slate-200 font-semibold' : 'text-slate-400'}`}>
                      {shortName}
                    </span>
                  </label>
                  <button
                    onClick={() => onSelectOnlyPackage(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-purple-400 hover:underline px-1 rounded bg-purple-500/10 transition-opacity"
                    title="Показати тільки класи цього пакета"
                  >
                    Тільки
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
            <span>Показувати зовнішні зв'язки</span>
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

      {/* Project Structure Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-sky-400" /> Класи ({filteredClasses.length})
          </span>
        </div>

        {visiblePackages.map((pkg: PackageInfo) => {
          if (hasPackageFilter && !selectedPackages.includes(pkg.id)) return null;

          const isExpanded = expandedPkgs[pkg.id] ?? true;
          const pkgClasses = filteredClasses.filter((c: ClassInfo) => c.package_name === pkg.id);
          if (searchTerm && pkgClasses.length === 0) return null;

          return (
            <div key={pkg.id} className="space-y-0.5">
              {/* Package Header */}
              <div
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-mono transition-colors group ${
                  selectedNodeId === pkg.id
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <button onClick={() => togglePkg(pkg.id)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  )}
                  <span className="truncate flex-1" title={pkg.name}>
                    {pkg.name.split('.').slice(-2).join('.')}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSelectOnlyPackage(pkg.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-purple-500/20 rounded text-purple-400 transition-opacity"
                    title="Ізолювати цей пакет на графі"
                  >
                    <Target className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] text-slate-400 px-1 rounded bg-black/30">
                    {pkgClasses.length}
                  </span>
                </div>
              </div>

              {/* Classes in Package */}
              {isExpanded && (
                <div className="pl-4 space-y-0.5 border-l border-white/5 ml-3">
                  {pkgClasses.map((cls: ClassInfo) => {
                    const isSelected = selectedNodeId === cls.id;
                    return (
                      <button
                        key={cls.id}
                        onClick={() => onSelectNode(cls.id)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono transition-all text-left truncate ${
                          isSelected
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold shadow-sm'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                        title={cls.id}
                      >
                        <FileCode className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                        <span className="truncate">{cls.name}</span>
                        {cls.annotations.length > 0 && (
                          <span className="text-[9px] text-amber-400 ml-auto flex-shrink-0">
                            @{cls.annotations[0]}
                          </span>
                        )}
                      </button>
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
