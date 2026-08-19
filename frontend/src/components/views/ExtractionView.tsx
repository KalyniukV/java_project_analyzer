import React, { useState, useEffect, useMemo } from 'react';
import { ProjectModel, MicroserviceExtractionAnalysis } from '../../types';
import { getMicroserviceExtraction } from '../../api/client';
import {
  Boxes,
  Puzzle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ListOrdered,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
  Search,
  Folder,
  Box,
  Target
} from 'lucide-react';

interface ExtractionViewProps {
  project: ProjectModel | null;
  onNavigateToGraph: (nodeId: string, view?: 'modules' | 'packages' | 'classes') => void;
}

export const ExtractionView: React.FC<ExtractionViewProps> = ({ project, onNavigateToGraph }) => {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [extractionData, setExtractionData] = useState<MicroserviceExtractionAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'modules' | 'packages'>('all');

  useEffect(() => {
    if (project) {
      // Smart default: If multiple modules, default to first module; otherwise default to first package
      let defaultId = '';
      if (project.modules.length > 1) {
        defaultId = project.modules[0].id;
      } else if (project.packages.length > 0) {
        defaultId = project.packages[0].id;
      } else if (project.modules.length === 1) {
        defaultId = project.modules[0].id;
      }

      if (defaultId && defaultId !== selectedTarget) {
        setSelectedTarget(defaultId);
        loadExtraction(defaultId);
      }
    }
  }, [project]);

  const loadExtraction = async (targetId: string) => {
    try {
      setIsLoading(true);
      const data = await getMicroserviceExtraction(targetId);
      setExtractionData(data);
    } catch (err) {
      console.error('Extraction load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTargetChange = (id: string) => {
    setSelectedTarget(id);
    loadExtraction(id);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 50) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  // Filter modules and packages by search term
  const filteredModules = useMemo(() => {
    if (!project) return [];
    if (filterType === 'packages') return [];
    return project.modules.filter((m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [project, searchTerm, filterType]);

  const filteredPackages = useMemo(() => {
    if (!project) return [];
    if (filterType === 'modules') return [];
    return project.packages.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [project, searchTerm, filterType]);

  return (
    <div className="flex-1 h-full bg-[#0d1117] flex overflow-hidden">
      {/* Left List of Modules & Packages */}
      <div className="w-80 border-r border-[#30363d] bg-[#161b22]/70 flex flex-col h-full flex-shrink-0">
        <div className="p-3.5 border-b border-[#30363d] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Кандидат для винесення
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
              {filteredModules.length + filteredPackages.length}
            </span>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук модуля чи пакета..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filterType === 'all' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Усі
            </button>
            <button
              onClick={() => setFilterType('modules')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filterType === 'modules' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Модулі
            </button>
            <button
              onClick={() => setFilterType('packages')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filterType === 'packages' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Пакети
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#21262d]">
          {/* Modules Group */}
          {filteredModules.length > 0 && (
            <div>
              <div className="p-2 px-3 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Box className="w-3 h-3" />
                Модулі проєкту ({filteredModules.length})
              </div>
              {filteredModules.map((m) => {
                const isSelected = m.id === selectedTarget;
                return (
                  <div
                    key={m.id}
                    onClick={() => handleTargetChange(m.id)}
                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between group ${
                      isSelected ? 'bg-purple-500/15 border-l-2 border-purple-400' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span
                        className={`text-xs font-mono font-semibold truncate block ${
                          isSelected ? 'text-purple-300' : 'text-slate-300'
                        }`}
                      >
                        {m.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {m.exported_packages.length} пакетів
                      </span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isSelected ? 'text-purple-400' : ''}`} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Packages Group */}
          {filteredPackages.length > 0 && (
            <div>
              <div className="p-2 px-3 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Folder className="w-3 h-3" />
                Пакети ({filteredPackages.length})
              </div>
              {filteredPackages.map((p) => {
                const isSelected = p.id === selectedTarget;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleTargetChange(p.id)}
                    className={`p-3 cursor-pointer transition-colors flex items-center justify-between group ${
                      isSelected ? 'bg-purple-500/15 border-l-2 border-purple-400' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span
                        className={`text-xs font-mono font-semibold truncate block ${
                          isSelected ? 'text-purple-300' : 'text-slate-300'
                        }`}
                        title={p.name}
                      >
                        {p.name.split('.').slice(-2).join('.')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 truncate block" title={p.id}>
                        {p.class_ids.length} класів • {p.module_name || 'app'}
                      </span>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isSelected ? 'text-purple-400' : ''}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Extraction Assistant Dashboard */}
      <div className="flex-1 h-full overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
            Аналіз готовності до винесення мікросервісу...
          </div>
        ) : !extractionData ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
            <Boxes className="w-12 h-12 text-slate-400 mb-3" />
            <p className="text-sm font-semibold text-slate-200">Оберіть кандидат для аналізу</p>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Виберіть будь-який модуль або пакет у списку зліва, щоб оцінити його зв'язність та блокери
            </p>
          </div>
        ) : (
          <>
            {/* Top Score Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Microservice Extraction Candidate
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-purple-300 border border-purple-500/20">
                    {extractionData.target_type}: {extractionData.target_id}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    {extractionData.total_classes} класів
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white font-mono flex items-center gap-2">
                  <Puzzle className="w-6 h-6 text-purple-400" />
                  {extractionData.target_name}
                </h2>
              </div>

              {/* Extraction Readiness Gauge */}
              <div className="flex items-center gap-3">
                <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3.5 ${getScoreColor(extractionData.readiness_score)} shadow-md`}>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                      Готовність (Readiness)
                    </span>
                    <span className="text-xl font-black font-mono">
                      {extractionData.readiness_score}% • {extractionData.is_cleanly_extractable ? 'Ready' : 'Coupled'}
                    </span>
                  </div>
                  {extractionData.is_cleanly_extractable ? (
                    <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 flex-shrink-0" />
                  )}
                </div>

                <button
                  onClick={() => onNavigateToGraph(extractionData.target_id, extractionData.target_type === 'Module' ? 'modules' : 'packages')}
                  className="px-3.5 py-3 rounded-2xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                  title="Показати цей модуль/пакет на інтерактивному графі"
                >
                  <Target className="w-4 h-4 text-purple-400" />
                  На граф ➔
                </button>
              </div>
            </div>

            {/* Inbound & Outbound Blockers Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inbound Blockers (Outside -> Inside) */}
              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4 text-sky-400 rotate-45" />
                    Вхідні зв'язки-блокери ({extractionData.inbound_blockers.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">хто зовні звертається</span>
                </div>
                {extractionData.inbound_blockers.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 bg-[#0d1117] rounded-lg">
                    Немає неконтрольованих вхідних викликів. Публічний інтерфейс чистий.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {extractionData.inbound_blockers.map((b, i) => (
                      <div
                        key={i}
                        onClick={() => onNavigateToGraph(b.source, 'classes')}
                        className="p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/50 cursor-pointer transition-colors text-xs space-y-1 group"
                        title="Клікніть для перегляду виклику у графі"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sky-300 font-semibold group-hover:underline">{b.description}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400" />
                        </div>
                        <span className="text-[11px] text-slate-400 font-sans block">💡 {b.solution_hint}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outbound Blockers (Inside -> Outside) */}
              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4 text-rose-400 -rotate-45" />
                    Вихідні зв'язки-блокери ({extractionData.outbound_blockers.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">від кого залежить</span>
                </div>
                {extractionData.outbound_blockers.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 bg-[#0d1117] rounded-lg">
                    Модуль повністю автономний і не залежить від зовнішніх сервісів.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {extractionData.outbound_blockers.map((b, i) => (
                      <div
                        key={i}
                        onClick={() => onNavigateToGraph(b.target, 'classes')}
                        className="p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-rose-500/50 cursor-pointer transition-colors text-xs space-y-1 group"
                        title="Клікніть для перегляду цілі у графі"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-rose-300 font-semibold group-hover:underline">{b.description}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400" />
                        </div>
                        <span className="text-[11px] text-slate-400 font-sans block">💡 {b.solution_hint}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Suggested Step-by-Step Extraction Plan */}
            <div className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-purple-400" />
                Покроковий план винесення в мікросервіс (Extraction Roadmap)
              </h3>
              <div className="space-y-2 pt-1">
                {extractionData.suggested_extraction_order.map((step, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold font-mono text-xs flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs text-slate-200 font-sans">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
