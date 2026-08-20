import React, { useState, useMemo } from 'react';
import { ProjectModel, ModuleInfo, PackageInfo, Relationship } from '../../types';
import {
  Layers,
  Box,
  Folder,
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Target,
  Maximize2,
  Sparkles
} from 'lucide-react';

interface MatrixViewProps {
  project: ProjectModel | null;
  onNavigateToGraph: (nodeId: string, view: 'modules' | 'packages' | 'classes') => void;
  onSelectModule?: (moduleId: string) => void;
  onSelectPackage?: (packageId: string) => void;
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  project,
  onNavigateToGraph,
  onSelectModule,
  onSelectPackage,
}) => {
  const [matrixLevel, setMatrixLevel] = useState<'modules' | 'packages'>('modules');
  const [search, setSearch] = useState('');
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string; count: number; isCircular: boolean } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: string; col: string; count: number; isCircular: boolean } | null>(null);

  // 1. Prepare items (Modules or Packages)
  const items = useMemo(() => {
    if (!project) return [];
    const term = search.trim().toLowerCase();

    if (matrixLevel === 'modules') {
      const mods = project.modules.length > 0 ? project.modules : [{ id: 'default', name: project.project_name, path: '', build_type: '', direct_dependencies: [], exported_packages: [], afferent_coupling: 0, efferent_coupling: 0, instability: 0 }];
      if (!term) return mods.slice(0, 45);
      return mods.filter(m => m.name.toLowerCase().includes(term) || m.id.toLowerCase().includes(term)).slice(0, 45);
    } else {
      const pkgs = project.packages;
      if (!term) return pkgs.slice(0, 45);
      return pkgs.filter(p => p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)).slice(0, 45);
    }
  }, [project, matrixLevel, search]);

  // 2. Build Dependency Map & Circular Detectors
  const { depMap, circularPairs, maxDepCount } = useMemo(() => {
    const map = new Map<string, number>();
    const circ = new Set<string>();
    let maxCount = 1;

    if (!project) return { depMap: map, circularPairs: circ, maxDepCount: maxCount };

    if (matrixLevel === 'modules') {
      for (const rel of project.relationships) {
        if (rel.kind === 'ModuleDependency') {
          const key = `${rel.source}:::${rel.target}`;
          const count = (map.get(key) || 0) + 1;
          map.set(key, count);
          if (count > maxCount) maxCount = count;

          if (rel.is_circular) {
            circ.add(key);
            circ.add(`${rel.target}:::${rel.source}`);
          }
        }
      }
    } else {
      for (const rel of project.relationships) {
        if (rel.kind === 'PackageDependency') {
          const key = `${rel.source}:::${rel.target}`;
          const count = (map.get(key) || 0) + 1;
          map.set(key, count);
          if (count > maxCount) maxCount = count;

          if (rel.is_circular) {
            circ.add(key);
            circ.add(`${rel.target}:::${rel.source}`);
          }
        }
      }
    }

    return { depMap: map, circularPairs: circ, maxDepCount: maxCount };
  }, [project, matrixLevel]);

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-400 font-mono text-xs">
        Немає завантаженого проєкту для відображення матриці залежностей.
      </div>
    );
  }

  const getItemDisplayName = (item: any) => {
    if (matrixLevel === 'modules') return item.name;
    const parts = item.name.split('.');
    return parts.slice(-2).join('.');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1117] text-slate-100 overflow-hidden select-none">
      {/* Top Controls Bar */}
      <div className="h-12 border-b border-[#30363d] bg-[#161b22] px-4 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#0d1117] p-1 rounded-xl border border-[#30363d]">
            <button
              onClick={() => { setMatrixLevel('modules'); setSelectedCell(null); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                matrixLevel === 'modules'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-emerald-400" />
              <span>Модулі ({project.modules.length})</span>
            </button>

            <button
              onClick={() => { setMatrixLevel('packages'); setSelectedCell(null); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                matrixLevel === 'packages'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-purple-400" />
              <span>Пакети ({project.packages.length})</span>
            </button>
          </div>

          <span className="text-xs text-slate-400 hidden md:inline">
            Dependency Structure Matrix (DSM) — $0$ перетинів ліній
          </span>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Пошук ${matrixLevel === 'modules' ? 'модулів' : 'пакетів'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Main Matrix Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Matrix Grid Scrollable Area */}
        <div className="flex-1 overflow-auto p-4">
          <div className="inline-block min-w-full">
            {/* Column Headers (Targets) */}
            <div className="flex sticky top-0 bg-[#0d1117] z-20 pb-2 border-b border-[#30363d]">
              <div className="w-48 flex-shrink-0 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider self-end pr-2 text-right">
                Джерело ➔ Ціль
              </div>
              <div className="flex gap-1">
                {items.map((colItem, cIdx) => {
                  const isHovered = hoveredCell?.col === colItem.id;
                  const isSelected = selectedCell?.col === colItem.id;
                  return (
                    <div
                      key={colItem.id}
                      className={`w-9 flex-shrink-0 text-center transition-colors cursor-pointer ${
                        isSelected ? 'text-sky-300 font-bold' : isHovered ? 'text-emerald-300 font-semibold' : 'text-slate-400'
                      }`}
                      onClick={() => onNavigateToGraph(colItem.id, matrixLevel)}
                      title={`${cIdx + 1}. ${colItem.name} (Клік для переходу на граф)`}
                    >
                      <div className="text-[10px] font-mono mb-1">{cIdx + 1}</div>
                      <div className="h-28 flex items-end justify-center">
                        <span className="text-[10px] font-mono -rotate-90 origin-bottom-left block whitespace-nowrap truncate max-w-[100px]">
                          {getItemDisplayName(colItem)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rows (Sources) */}
            <div className="space-y-1 pt-2">
              {items.map((rowItem, rIdx) => {
                const isHoveredRow = hoveredCell?.row === rowItem.id;
                const isSelectedRow = selectedCell?.row === rowItem.id;

                return (
                  <div key={rowItem.id} className="flex items-center gap-1 group">
                    {/* Row Header */}
                    <div
                      className={`w-48 flex-shrink-0 text-xs font-mono pr-3 flex items-center justify-between truncate cursor-pointer py-1 px-2 rounded-lg transition-colors ${
                        isSelectedRow
                          ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                          : isHoveredRow
                          ? 'bg-white/10 text-emerald-300 font-semibold'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                      onClick={() => onNavigateToGraph(rowItem.id, matrixLevel)}
                      title={`${rowItem.name} (Клік для переходу на граф)`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold w-4">{rIdx + 1}</span>
                        <span className="truncate">{getItemDisplayName(rowItem)}</span>
                      </span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-sky-400" />
                    </div>

                    {/* Matrix Cells */}
                    <div className="flex gap-1">
                      {items.map((colItem, cIdx) => {
                        const isDiagonal = rIdx === cIdx;
                        const key = `${rowItem.id}:::${colItem.id}`;
                        const count = depMap.get(key) || 0;
                        const isCircular = circularPairs.has(key);

                        const isCellSelected = selectedCell?.row === rowItem.id && selectedCell?.col === colItem.id;
                        const isCellHovered = hoveredCell?.row === rowItem.id && hoveredCell?.col === colItem.id;

                        if (isDiagonal) {
                          return (
                            <div
                              key={colItem.id}
                              className="w-9 h-8 rounded bg-[#161b22]/40 border border-[#30363d]/30 flex items-center justify-center text-slate-600 font-mono text-xs select-none"
                            >
                              •
                            </div>
                          );
                        }

                        // Determine cell style by dependency intensity & circular state
                        let cellBg = 'bg-[#161b22]/80 border border-[#30363d]/50 hover:border-sky-400';
                        let textColor = 'text-slate-500';

                        if (count > 0) {
                          if (isCircular) {
                            cellBg = 'bg-rose-500/25 border-rose-500/60 shadow-sm shadow-rose-500/20';
                            textColor = 'text-rose-300 font-bold';
                          } else {
                            const intensity = Math.min(1, count / Math.max(1, maxDepCount));
                            if (intensity > 0.5) {
                              cellBg = 'bg-sky-500/30 border-sky-500/60 shadow-sm shadow-sky-500/20';
                              textColor = 'text-sky-200 font-bold';
                            } else {
                              cellBg = 'bg-sky-500/15 border-sky-500/30';
                              textColor = 'text-sky-300 font-medium';
                            }
                          }
                        }

                        if (isCellSelected) {
                          cellBg = 'bg-amber-500/30 ring-2 ring-amber-400 border-transparent';
                        }

                        return (
                          <button
                            key={colItem.id}
                            onMouseEnter={() => setHoveredCell({ row: rowItem.id, col: colItem.id, count, isCircular })}
                            onMouseLeave={() => setHoveredCell(null)}
                            onClick={() => setSelectedCell({ row: rowItem.id, col: colItem.id, count, isCircular })}
                            className={`w-9 h-8 rounded flex items-center justify-center font-mono text-xs transition-all ${cellBg} ${textColor}`}
                            title={`${rowItem.name} ➔ ${colItem.name}: ${count} залежностей ${isCircular ? '(Циклічний зв\'язок ⚠️)' : ''}`}
                          >
                            {count > 0 ? (
                              isCircular ? (
                                <span className="flex items-center gap-0.5">
                                  <span>{count}</span>
                                </span>
                              ) : (
                                count
                              )
                            ) : (
                              ''
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Info & Inspector Sidebar */}
        <div className="w-80 border-l border-[#30363d] bg-[#161b22] p-4 flex flex-col justify-between overflow-y-auto flex-shrink-0">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Інспектор зв'язку DSM</span>
            </h3>

            {selectedCell || hoveredCell ? (
              (() => {
                const active = selectedCell || hoveredCell!;
                const sourceItem = items.find(i => i.id === active.row);
                const targetItem = items.find(i => i.id === active.col);

                return (
                  <div className="space-y-3 bg-[#0d1117] p-3.5 rounded-xl border border-[#30363d]">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-400">Джерело (Хто викликає)</span>
                      <div className="text-xs font-mono font-bold text-slate-100 truncate" title={sourceItem?.name}>
                        {sourceItem?.name || active.row}
                      </div>
                    </div>

                    <div className="flex items-center justify-center text-slate-500">
                      <ArrowRight className="w-4 h-4 text-sky-400" />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-400">Ціль (Кого викликають)</span>
                      <div className="text-xs font-mono font-bold text-slate-100 truncate" title={targetItem?.name}>
                        {targetItem?.name || active.col}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#30363d] flex items-center justify-between">
                      <span className="text-xs text-slate-400">Кількість зв'язків:</span>
                      <span className="text-sm font-mono font-bold text-sky-400">{active.count}</span>
                    </div>

                    {active.isCircular && (
                      <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                        <span>Виявлено взаємно-циклічну залежність!</span>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col gap-2">
                      <button
                        onClick={() => onNavigateToGraph(active.row, matrixLevel)}
                        className="w-full py-1.5 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      >
                        <Target className="w-3.5 h-3.5" />
                        <span>Відкрити джерело на графі</span>
                      </button>

                      <button
                        onClick={() => onNavigateToGraph(active.col, matrixLevel)}
                        className="w-full py-1.5 px-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Відкрити ціль на графі</span>
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-6 text-center text-xs font-mono text-slate-500 border border-dashed border-[#30363d] rounded-xl">
                Наведіть курсор або натисніть на будь-яку комірку матриці для перегляду взаємних залежностей.
              </div>
            )}
          </div>

          {/* DSM Legend */}
          <div className="p-3 bg-[#0d1117] rounded-xl border border-[#30363d] space-y-2 text-[11px] font-mono">
            <div className="font-bold text-slate-300 uppercase text-[10px]">Легенда матриці:</div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-sky-500/30 border border-sky-500/60" />
              <span className="text-slate-300">Пряма залежність</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-rose-500/30 border border-rose-500/60" />
              <span className="text-rose-300 font-semibold">Циклічна залежність ⚠️</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-[#161b22] border border-[#30363d]" />
              <span className="text-slate-500">Головна діагональ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
