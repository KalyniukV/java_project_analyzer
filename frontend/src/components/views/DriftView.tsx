import React, { useState, useEffect } from 'react';
import { ProjectModel, ArchitectureViolation } from '../../types';
import { getArchitectureDrift } from '../../api/client';
import {
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  Layers,
  FileCode,
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface DriftViewProps {
  project: ProjectModel | null;
  onNavigateToGraph: (nodeId: string) => void;
}

export const DriftView: React.FC<DriftViewProps> = ({ onNavigateToGraph }) => {
  const [violations, setViolations] = useState<ArchitectureViolation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadDrift = async () => {
    try {
      setIsLoading(true);
      const data = await getArchitectureDrift();
      setViolations(data);
    } catch (err) {
      console.error('Drift load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDrift();
  }, []);

  return (
    <div className="flex-1 h-full bg-[#0d1117] overflow-y-auto p-6 space-y-6">
      {/* Top Architectural Standard Reference */}
      <div className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              Контроль архітектурних шарів (Layered Architecture Rules)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Автоматичний моніторинг правил залежностей між шарами системи
            </p>
          </div>

          <button
            onClick={loadDrift}
            className="p-2 rounded-xl bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-slate-300 transition-colors"
            title="Оновити перевірку"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>

        {/* Expected Layer Hierarchy Flow Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400 block">
              Шар 1: Представлення
            </span>
            <span className="text-sm font-black font-mono text-sky-200">UI / Controllers</span>
          </div>

          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block">
              Шар 2: Бізнес-логіка
            </span>
            <span className="text-sm font-black font-mono text-indigo-200">Application / Service</span>
          </div>

          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 block">
              Шар 3: Доменне ядро
            </span>
            <span className="text-sm font-black font-mono text-purple-200">Domain / Entities</span>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
              Шар 4: Інфраструктура
            </span>
            <span className="text-sm font-black font-mono text-emerald-200">Repository / DAO</span>
          </div>
        </div>
      </div>

      {/* Violations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Виявлені порушення архітектурного дрейфу ({violations.length})
          </h3>
          <span className="text-xs text-slate-400">
            {violations.length === 0 ? 'Порушень не виявлено' : 'Вимагають рефакторингу'}
          </span>
        </div>

        {violations.length === 0 ? (
          <div className="p-12 rounded-2xl bg-[#161b22] border border-[#30363d] text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-100">
              Архітектурний дрейф відсутній!
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Всі класи суворо дотримуються односпрямованого потоку залежностей (UI → Service → Domain → Infrastructure).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {violations.map((v) => (
              <div
                key={v.id}
                className="p-5 rounded-2xl bg-[#161b22] border border-rose-500/40 hover:border-rose-500/70 transition-all shadow-md space-y-3 group"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <span className="font-bold text-sm text-slate-100 group-hover:text-rose-300 transition-colors">
                      {v.violation_title}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
                    {v.severity}
                  </span>
                </div>

                {/* Explanation */}
                <p className="text-xs text-slate-300 leading-relaxed font-sans pl-7">
                  {v.explanation}
                </p>

                {/* Expected vs Actual Boxes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 pl-7">
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">
                      Очікуваний потік (Expected)
                    </span>
                    <span className="font-mono text-emerald-200 text-[11px]">
                      {v.expected_flow}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
                    <span className="text-[10px] uppercase font-bold text-rose-400 block mb-1">
                      Фактичний виклик (Actual Violation)
                    </span>
                    <span className="font-mono text-rose-200 text-[11px]">
                      {v.actual_flow}
                    </span>
                  </div>
                </div>

                {/* Source & Target Link Cards */}
                <div className="flex items-center gap-2 pt-1 pl-7 text-xs font-mono">
                  <button
                    onClick={() => onNavigateToGraph(v.source_class)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d1117] hover:bg-sky-500/20 border border-[#30363d] hover:border-sky-500/50 text-slate-200 hover:text-sky-300 transition-all shadow-sm group/btn"
                    title={`Переглянути ${v.source_class} на графі`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-sky-400" />
                    <span>{v.source_class.split('.').pop() || v.source_class}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover/btn:text-sky-400" />
                  </button>

                  <ArrowRight className="w-4 h-4 text-rose-400" />

                  <button
                    onClick={() => onNavigateToGraph(v.target_class)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0d1117] hover:bg-rose-500/20 border border-[#30363d] hover:border-rose-500/50 text-slate-200 hover:text-rose-300 transition-all shadow-sm group/btn"
                    title={`Переглянути ${v.target_class} на графі`}
                  >
                    <FileCode className="w-3.5 h-3.5 text-rose-400" />
                    <span>{v.target_class.split('.').pop() || v.target_class}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover/btn:text-rose-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
