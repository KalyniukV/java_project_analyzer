import React, { useState, useEffect } from 'react';
import { ProjectModel, ImpactAnalysis } from '../../types';
import { getImpactAnalysis } from '../../api/client';
import {
  Target,
  AlertTriangle,
  Flame,
  ShieldCheck,
  Layers,
  Box,
  Folder,
  FileCode,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Activity,
  ArrowRight
} from 'lucide-react';

interface ImpactViewProps {
  project: ProjectModel | null;
  onNavigateToGraph: (nodeId: string) => void;
}

export const ImpactView: React.FC<ImpactViewProps> = ({ project, onNavigateToGraph }) => {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [impactData, setImpactData] = useState<ImpactAnalysis | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (project && project.classes.length > 0) {
      const defaultId = selectedClassId || project.classes[0].id;
      setSelectedClassId(defaultId);
      loadImpact(defaultId);
    }
  }, [project]);

  const loadImpact = async (classId: string) => {
    try {
      setIsLoading(true);
      const data = await getImpactAnalysis(classId);
      setImpactData(data);
    } catch (err) {
      console.error('Impact load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    loadImpact(id);
  };

  const filteredClasses = (project?.classes || []).filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'Critical':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'High':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'Medium':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
  };

  return (
    <div className="flex-1 h-full bg-[#0d1117] flex overflow-hidden">
      {/* Left List of Classes */}
      <div className="w-80 border-r border-[#30363d] bg-[#161b22]/70 flex flex-col h-full flex-shrink-0">
        <div className="p-3.5 border-b border-[#30363d] space-y-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Цільовий клас для зміни
            </span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Пошук класу..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#21262d]">
          {filteredClasses.map((cls) => {
            const isSelected = cls.id === selectedClassId;
            return (
              <div
                key={cls.id}
                onClick={() => handleClassChange(cls.id)}
                className={`p-3 cursor-pointer transition-colors text-left flex items-center justify-between group ${
                  isSelected ? 'bg-rose-500/15 border-l-2 border-rose-400' : 'hover:bg-white/5'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <FileCode
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isSelected ? 'text-rose-400' : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    <span
                      className={`text-xs font-mono font-semibold truncate ${
                        isSelected ? 'text-rose-300' : 'text-slate-300'
                      }`}
                    >
                      {cls.name}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5" title={cls.package_name}>
                    {cls.package_name}
                  </p>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isSelected ? 'text-rose-400' : ''}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Impact & Blast Radius Dashboard */}
      <div className="flex-1 h-full overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
            Розрахунок площі ураження (Blast Radius)...
          </div>
        ) : !impactData ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Виберіть клас зліва для аналізу наслідків змін
          </div>
        ) : (
          <>
            {/* Top Overview Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Impact Analysis Target
                  </span>
                  <button
                    onClick={() => onNavigateToGraph(impactData.target_id)}
                    className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-[#30363d] hover:border-sky-500/40 transition-colors"
                    title="Переглянути цей клас у графі"
                  >
                    <span>{impactData.target_id}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
                <h2 className="text-2xl font-black text-white font-mono flex items-center gap-2">
                  <Flame className="w-6 h-6 text-rose-500 animate-pulse" />
                  {impactData.target_name}
                </h2>
              </div>

              {/* Risk Level Badge */}
              <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3.5 ${getRiskColor(impactData.risk_level)} shadow-md`}>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                    Change Risk Score
                  </span>
                  <span className="text-xl font-black font-mono">
                    {impactData.risk_score}/100 • {impactData.risk_level} Risk
                  </span>
                </div>
                {impactData.risk_level === 'Critical' || impactData.risk_level === 'High' ? (
                  <AlertTriangle className="w-8 h-8 flex-shrink-0" />
                ) : (
                  <ShieldCheck className="w-8 h-8 flex-shrink-0" />
                )}
              </div>
            </div>

            {/* 4 Key Blast Radius Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-1 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-400" /> Прямі залежні (Fan-In)
                </span>
                <p className="text-2xl font-black text-white font-mono">
                  {impactData.direct_dependents_count}
                </p>
                <span className="text-[11px] text-slate-400">класів посилаються безпосередньо</span>
              </div>

              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-1 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Уражені класи (Blast Radius)
                </span>
                <p className="text-2xl font-black text-rose-400 font-mono">
                  {impactData.total_affected_classes}
                </p>
                <span className="text-[11px] text-slate-400">транзитивно під загрозою</span>
              </div>

              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-1 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-purple-400" /> Зачеплені модулі
                </span>
                <p className="text-2xl font-black text-purple-300 font-mono">
                  {impactData.total_affected_modules}
                </p>
                <span className="text-[11px] text-slate-400">
                  {impactData.affected_modules.join(', ') || 'Тільки локальний модуль'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-1 shadow-sm">
                <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" /> Зачеплені шари
                </span>
                <p className="text-2xl font-black text-amber-300 font-mono">
                  {impactData.affected_layers.length}
                </p>
                <span className="text-[11px] text-slate-400">
                  {impactData.affected_layers.join(', ') || 'Локальний шар'}
                </span>
              </div>
            </div>

            {/* Risk Factors Explanations */}
            <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Фактори архітектурного ризику
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-300 pl-2">
                {impactData.risk_factors.map((factor, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Full List of Transitively Affected Classes */}
            <div className="p-4 rounded-xl bg-[#161b22] border border-[#30363d] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-sky-400" />
                  Повний перелік зачеплених компонентів ({impactData.affected_classes.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Клікніть на елемент для перегляду на інтерактивному графі
                </span>
              </div>

              {impactData.affected_classes.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-[#0d1117] rounded-xl border border-[#30363d]">
                  Цей клас є листовим або ізольованим — жоден інший компонент не залежить від нього.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {impactData.affected_classes.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onNavigateToGraph(item.id)}
                      className="p-3 rounded-xl bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/60 transition-all flex items-center justify-between cursor-pointer group shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                      title={`Переглянути ${item.name} на графі класів`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold font-mono text-slate-200 group-hover:text-sky-300 transition-colors">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                            {item.layer}
                          </span>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 truncate" title={item.id}>
                          {item.id}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Target Switch Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClassChange(item.id);
                          }}
                          className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 text-[10px] font-mono border border-rose-500/20 transition-colors"
                          title="Зробити цей клас новою ціллю аналізу"
                        >
                          <Target className="w-3 h-3" />
                        </button>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          Hop +{item.depth}
                        </span>

                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-sky-400 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
