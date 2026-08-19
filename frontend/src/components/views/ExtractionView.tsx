import React, { useState, useEffect } from 'react';
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
  Database
} from 'lucide-react';

interface ExtractionViewProps {
  project: ProjectModel | null;
  onNavigateToGraph: (nodeId: string) => void;
}

export const ExtractionView: React.FC<ExtractionViewProps> = ({ project, onNavigateToGraph }) => {
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [extractionData, setExtractionData] = useState<MicroserviceExtractionAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (project) {
      const defaultId =
        project.modules.length > 0
          ? project.modules[0].id
          : project.packages.length > 0
          ? project.packages[0].id
          : '';
      if (defaultId) {
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

  return (
    <div className="flex-1 h-full bg-[#0d1117] flex overflow-hidden">
      {/* Left List of Modules & Packages */}
      <div className="w-80 border-r border-[#30363d] bg-[#161b22]/70 flex flex-col h-full flex-shrink-0">
        <div className="p-3.5 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Кандидат для винесення
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#21262d]">
          {/* Modules Group */}
          <div className="p-2 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Модулі проєкту ({project?.modules.length || 0})
          </div>
          {(project?.modules || []).map((m) => {
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
                    Maven Module • {m.exported_packages.length} pkgs
                  </span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isSelected ? 'text-purple-400' : ''}`} />
              </div>
            );
          })}

          {/* Packages Group */}
          <div className="p-2 bg-black/20 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Пакети ({project?.packages.length || 0})
          </div>
          {(project?.packages || []).map((p) => {
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
                  >
                    {p.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {p.class_ids.length} класів
                  </span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isSelected ? 'text-purple-400' : ''}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Extraction Assistant Dashboard */}
      <div className="flex-1 h-full overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
            Аналіз готовності до винесення мікросервісу...
          </div>
        ) : !extractionData ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Виберіть модуль або пакет зліва для оцінки відокремлення
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
                </div>
                <h2 className="text-2xl font-black text-white font-mono flex items-center gap-2">
                  <Puzzle className="w-6 h-6 text-purple-400" />
                  {extractionData.target_name}
                </h2>
              </div>

              {/* Extraction Readiness Gauge */}
              <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3.5 ${getScoreColor(extractionData.readiness_score)} shadow-md`}>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                    Extraction Readiness
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
            </div>

            {/* Inbound & Outbound Blockers Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Inbound Blockers (Outside -> Inside) */}
              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4 text-sky-400 rotate-45" />
                    Вхідні зв'язки-блокери ({extractionData.inbound_blockers.length})
                  </span>
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
                        onClick={() => onNavigateToGraph(b.source)}
                        className="p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/50 cursor-pointer transition-colors text-xs space-y-1 group"
                        title="Клікніть для перегляду у графі"
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
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4 text-rose-400 -rotate-45" />
                    Вихідні зв'язки-блокери ({extractionData.outbound_blockers.length})
                  </span>
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
                        onClick={() => onNavigateToGraph(b.target)}
                        className="p-2.5 rounded-lg bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-rose-500/50 cursor-pointer transition-colors text-xs space-y-1 group"
                        title="Клікніть для перегляду у графі"
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
