import React from 'react';
import { ProjectModel } from '../../types';
import { BarChart3, TrendingUp, Compass, Layers, ShieldCheck } from 'lucide-react';

interface MetricsViewProps {
  project: ProjectModel | null;
  onSelectNode: (nodeId: string) => void;
}

export const MetricsView: React.FC<MetricsViewProps> = ({ project, onSelectNode }) => {
  if (!project) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-slate-400 font-mono text-sm">
        Немає завантаженого проєкту
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto bg-[#0d1117] space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-sky-400" />
          Архітектурні Метрики (Robert C. Martin Metrics)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Оцінка стабільності, зв'язності та абстрактності пакетів та модулів проєкту.
        </p>
      </div>

      {/* Metric explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 mb-1">
            <Layers className="w-4 h-4" /> Afferent Coupling (Ca)
          </div>
          <p className="text-xs text-slate-400">
            Кількість зовнішніх класів, які залежать від цього пакета. Високий показник = важливий і стабільний пакет.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
            <TrendingUp className="w-4 h-4" /> Efferent Coupling (Ce)
          </div>
          <p className="text-xs text-slate-400">
            Кількість зовнішніх пакетів, від яких залежить цей пакет. Високий показник = висока залежність від змін.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d]">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
            <Compass className="w-4 h-4" /> Instability (I)
          </div>
          <p className="text-xs text-slate-400 font-mono">
            I = Ce / (Ca + Ce). 0 = абсолютно стабільний пакет, 1 = абсолютно нестабільний пакет.
          </p>
        </div>
      </div>

      {/* Packages Table */}
      <div className="bg-[#161b22] rounded-xl border border-[#30363d] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200">Таблиця метрик пакетів ({project.packages.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d1117] text-slate-400 font-mono uppercase text-[10px] border-b border-[#30363d]">
              <tr>
                <th className="p-3">Пакет</th>
                <th className="p-3">Класів</th>
                <th className="p-3">Ca (Вхідні)</th>
                <th className="p-3">Ce (Вихідні)</th>
                <th className="p-3">Instability (I)</th>
                <th className="p-3">Abstractness (A)</th>
                <th className="p-3">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d] font-mono">
              {project.packages.map((pkg) => {
                const m = pkg.metrics;
                return (
                  <tr key={pkg.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-semibold text-slate-200 truncate max-w-xs">{pkg.id}</td>
                    <td className="p-3 text-slate-400">{pkg.class_ids.length}</td>
                    <td className="p-3 text-sky-400">{m?.afferent_coupling ?? 0}</td>
                    <td className="p-3 text-amber-400">{m?.efferent_coupling ?? 0}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {(m?.instability ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {(m?.abstractness ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => onSelectNode(pkg.id)}
                        className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[11px] transition-colors"
                      >
                        Переглянути на графі
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
