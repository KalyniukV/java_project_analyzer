import React, { useEffect, useState } from 'react';
import { CycleInfo } from '../../types';
import { getCycles } from '../../api/client';
import { ShieldAlert, CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';

interface CyclesViewProps {
  onSelectNode: (nodeId: string) => void;
}

export const CyclesView: React.FC<CyclesViewProps> = ({ onSelectNode }) => {
  const [cycles, setCycles] = useState<CycleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<'modules' | 'packages' | 'classes'>('classes');

  useEffect(() => {
    setLoading(true);
    getCycles(level)
      .then((data) => setCycles(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [level]);

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto bg-[#0d1117]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Аудит циклічних залежностей (Circular Dependencies)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Алгоритм Tarjan SCC знаходить кільцеві зв'язки, які ускладнюють тестування та порушують модульність.
          </p>
        </div>

        {/* Level Switcher */}
        <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-xl border border-[#30363d]">
          {(['classes', 'packages', 'modules'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                level === lvl
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl === 'classes' ? 'Класи' : lvl === 'packages' ? 'Пакети' : 'Модулі'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 font-mono text-sm">
          Аналіз циклів...
        </div>
      ) : cycles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#161b22] rounded-2xl border border-[#30363d]">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-100">Циклічних залежностей не виявлено</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            На рівні {level === 'classes' ? 'класів' : level === 'packages' ? 'пакетів' : 'модулів'} архітектура повністю чиста та ациклічна.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-400 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Знайдено {cycles.length} циклічних контурів. Клікніть на елемент, щоб перейти до нього на діаграмі.</span>
          </div>

          <div className="grid gap-3">
            {cycles.map((cycle, idx) => (
              <div
                key={cycle.id}
                className="p-4 rounded-xl bg-[#161b22] border border-rose-500/30 hover:border-rose-500/60 transition-colors shadow-lg"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider">
                    Контур #{idx + 1} (Довжина: {cycle.length})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {cycle.path.map((nodeId, i) => (
                    <React.Fragment key={i}>
                      <button
                        onClick={() => onSelectNode(nodeId)}
                        className="px-3 py-1.5 rounded-lg bg-[#0d1117] hover:bg-rose-500/20 border border-[#30363d] hover:border-rose-500/50 text-xs font-mono text-slate-200 transition-colors"
                        title={nodeId}
                      >
                        {nodeId.split('.').pop()}
                      </button>
                      {i < cycle.path.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
