import React, { useEffect, useRef, useState } from 'react';
import { ScanProgress } from '../types';
import {
  Activity,
  CheckCircle,
  Copy,
  Cpu,
  FileCode,
  Layers,
  Link2,
  Terminal,
  X,
  Zap,
} from 'lucide-react';

interface ScanProgressModalProps {
  isOpen: boolean;
  progress: ScanProgress | null;
  scanningPath?: string;
  onClose: () => void;
}

export const ScanProgressModal: React.FC<ScanProgressModalProps> = ({
  isOpen,
  progress,
  scanningPath,
  onClose,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress?.logs]);

  if (!isOpen) return null;

  const logs = progress?.logs || [];
  const percent = Math.min(100, Math.max(0, Math.round(progress?.percentage || 0)));
  const isDone = progress?.is_scanning === false && percent >= 100;
  const hasError = !!progress?.error;

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stages = [
    { num: 1, name: 'Модулі & Файли', icon: Layers },
    { num: 2, name: 'AST Парсинг (Rayon)', icon: Cpu },
    { num: 3, name: 'Резолвінг зв\'язків', icon: Link2 },
    { num: 4, name: 'NoSQL & Метрики', icon: CheckCircle },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-4xl bg-[#0d1117] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#161b22]/70">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${isDone ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-sky-500/20 border-sky-500/40 text-sky-400 animate-pulse'}`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                {isDone ? '✅ Сканування завершено успішно' : hasError ? '❌ Помилка сканування' : '🚀 Сканування проєкту (100k+ класів)'}
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  Rayon Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono truncate max-w-lg">
                {scanningPath || 'Обробка проєкту...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDone ? (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
              >
                <span>Перейти до графу</span>
              </button>
            ) : hasError ? (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
              >
                <span>Закрити вікно</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-medium transition"
              >
                <span>Згорнути</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition"
              title="Закрити вікно"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Error Banner */}
          {hasError && (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-rose-300">Помилка сканування: </span>
                <span>{progress?.error}</span>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1 rounded bg-rose-600/40 hover:bg-rose-600 border border-rose-500/60 text-white text-[11px] font-bold flex-shrink-0 transition"
              >
                Вибрати інший каталог
              </button>
            </div>
          )}

          {/* 4-Stage Step Bar */}
          <div className="grid grid-cols-4 gap-2">
            {stages.map((st) => {
              const currentStage = progress?.stage_index || 1;
              const isPassed = isDone || currentStage > st.num;
              const isCurrent = !isDone && currentStage === st.num;
              const Icon = st.icon;

              return (
                <div
                  key={st.num}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                    isPassed
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : isCurrent
                      ? 'bg-sky-950/60 border-sky-400 text-sky-200 ring-1 ring-sky-400/40'
                      : 'bg-[#161b22]/40 border-[#30363d]/50 text-slate-500'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isPassed
                        ? 'bg-emerald-500 text-black'
                        : isCurrent
                        ? 'bg-sky-400 text-black animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPassed ? '✓' : st.num}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-[11px] font-bold truncate">{st.name}</div>
                    <div className="text-[9px] opacity-70 truncate font-mono">
                      {isPassed ? 'Готово' : isCurrent ? 'Виконується...' : 'В черзі'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar & Percentage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                {progress?.stage || 'Підготовка до сканування...'}
              </span>
              <span className="font-mono font-bold text-sky-400 text-sm">
                {percent}%
              </span>
            </div>

            <div className="w-full h-3.5 bg-black/60 rounded-full border border-[#30363d] overflow-hidden p-0.5 relative">
              <div
                className={`h-full rounded-full transition-all duration-300 relative ${
                  isDone
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/50'
                    : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500 shadow-lg shadow-sky-500/50'
                }`}
                style={{ width: `${percent}%` }}
              >
                {!isDone && (
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer_1.5s_infinite] rounded-full" />
                )}
              </div>
            </div>
          </div>

          {/* Live Telemetry Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#161b22]/70 border border-[#30363d]">
              <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
                <span>Файлів знайдено</span>
                <FileCode className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="text-lg font-mono font-bold text-slate-100">
                {progress?.total_items ? progress.total_items.toLocaleString() : '—'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {progress?.modules_found ? `${progress.modules_found} модулів` : '0 модулів'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#161b22]/70 border border-[#30363d]">
              <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
                <span>Класів & Інтерфейсів</span>
                <Layers className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-lg font-mono font-bold text-slate-100">
                {progress?.classes_found ? progress.classes_found.toLocaleString() : '—'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {progress?.packages_found ? `${progress.packages_found} пакетів` : '0 пакетів'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#161b22]/70 border border-[#30363d]">
              <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
                <span>Зв'язків (Graph Edges)</span>
                <Link2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-mono font-bold text-slate-100">
                {progress?.relationships_found ? progress.relationships_found.toLocaleString() : '—'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Calls, Extends, Fields, RPC
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#161b22]/70 border border-[#30363d]">
              <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
                <span>Швидкість & Час</span>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg font-mono font-bold text-slate-100">
                {progress?.elapsed_ms ? `${(progress.elapsed_ms / 1000).toFixed(2)}с` : '0.0с'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {progress?.speed_items_per_sec && progress.speed_items_per_sec > 0
                  ? `⚡ ${Math.round(progress.speed_items_per_sec).toLocaleString()} ф/с`
                  : 'Паралельний Rayon'}
              </div>
            </div>
          </div>

          {/* Terminal Console Logs */}
          <div className="rounded-xl border border-[#30363d] bg-black/90 overflow-hidden shadow-inner flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d] text-xs text-slate-400">
              <div className="flex items-center gap-2 font-mono">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>Термінал сканування (Live Console Logs)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                  {logs.length} рядків
                </span>
              </div>
              <button
                onClick={handleCopyLogs}
                className="flex items-center gap-1 text-[10px] font-mono hover:text-slate-200 transition px-2 py-0.5 rounded hover:bg-slate-800"
              >
                <Copy className="w-3 h-3" />
                <span>{copied ? 'Скопійовано!' : 'Копіювати логи'}</span>
              </button>
            </div>

            <div className="p-3 font-mono text-xs text-slate-300 max-h-52 overflow-y-auto space-y-1 select-text">
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Очікування повідомлень від рушія сканування...</div>
              ) : (
                logs.map((line, idx) => {
                  let color = 'text-slate-300';
                  if (line.includes('[ERROR]')) color = 'text-rose-400 font-bold';
                  else if (line.includes('✅') || line.includes('[SUCCESS]')) color = 'text-emerald-300 font-semibold';
                  else if (line.includes('⚡') || line.includes('📦') || line.includes('🔗') || line.includes('[Етап')) color = 'text-sky-300';
                  else if (line.includes('🚀')) color = 'text-fuchsia-300';

                  return (
                    <div key={idx} className={`${color} leading-relaxed break-words`}>
                      {line}
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
