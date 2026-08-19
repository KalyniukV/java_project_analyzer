import React, { useState, useEffect } from 'react';
import { CallHierarchyGraph, CallHierarchyNode, CallHierarchyEdge } from '../types';
import { getCallHierarchy, openFile } from '../api/client';
import {
  GitCommit,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Target,
  ExternalLink,
  Layers,
  Sparkles,
  Sliders,
  Filter,
  Code2,
  Database,
  ShieldCheck,
  Component,
  Folder
} from 'lucide-react';

interface CallHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string | null;
  onNavigateToClass?: (classId: string) => void;
}

export const CallHierarchyModal: React.FC<CallHierarchyModalProps> = ({
  isOpen,
  onClose,
  targetId,
  onNavigateToClass,
}) => {
  const [depth, setDepth] = useState<number>(2);
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [hierarchy, setHierarchy] = useState<CallHierarchyGraph | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTarget, setActiveTarget] = useState<string | null>(targetId);

  useEffect(() => {
    setActiveTarget(targetId);
  }, [targetId]);

  useEffect(() => {
    if (!isOpen || !activeTarget) return;

    let isMounted = true;
    setIsLoading(true);

    getCallHierarchy(activeTarget, depth)
      .then((data) => {
        if (isMounted) {
          setHierarchy(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load call hierarchy:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeTarget, depth]);

  if (!isOpen || !activeTarget) return null;

  const rootNode = hierarchy?.nodes.find((n) => n.depth === 0);
  const callers = hierarchy?.nodes.filter((n) => n.depth < 0).sort((a, b) => b.depth - a.depth) || [];
  const callees = hierarchy?.nodes.filter((n) => n.depth > 0).sort((a, b) => a.depth - b.depth) || [];

  const getLayerBadge = (layer: string) => {
    switch (layer) {
      case 'UI':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'Service':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Domain':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Infrastructure':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <GitCommit className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {rootNode?.member_type === 'field' ? 'Field Usage Flow' : 'Call Hierarchy'}
                </span>
                {rootNode?.layer && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getLayerBadge(rootNode.layer)}`}>
                    {rootNode.layer}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-100 font-mono truncate" title={rootNode?.signature || activeTarget}>
                {rootNode?.name || activeTarget}
              </h2>
              <p className="text-xs font-mono text-slate-400 truncate" title={rootNode?.declaring_class}>
                {rootNode?.declaring_class}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="p-3 px-4 border-b border-[#30363d] bg-[#0d1117]/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Depth Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-sky-400" /> Глибина ланцюга (Depth):
            </span>
            <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`w-7 h-6 rounded font-mono font-bold text-xs transition-all ${
                    depth === d
                      ? 'bg-sky-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1 bg-[#161b22] p-1 rounded-lg border border-[#30363d]">
            <button
              onClick={() => setDirection('all')}
              className={`px-3 py-1 rounded font-medium transition-all ${
                direction === 'all'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Всі зв'язки ({callers.length + callees.length})
            </button>
            <button
              onClick={() => setDirection('inbound')}
              className={`px-3 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                direction === 'inbound'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-sky-400" /> Вхідні ({callers.length})
            </button>
            <button
              onClick={() => setDirection('outbound')}
              className={`px-3 py-1 rounded font-medium transition-all flex items-center gap-1 ${
                direction === 'outbound'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" /> Вихідні ({callees.length})
            </button>
          </div>
        </div>

        {/* Modal Body: 3-Column Visual Flow Canvas */}
        <div className="flex-1 p-5 overflow-y-auto min-h-[360px] space-y-6">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 font-mono text-xs">
              <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3"></div>
              Побудова графа викликів (Depth {depth})...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {/* Column 1: Inbound Callers */}
              {(direction === 'all' || direction === 'inbound') && (
                <div className="space-y-3 bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5 font-mono">
                      <ArrowDownLeft className="w-4 h-4" /> Хто викликає (Fan-In)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                      {callers.length} методів
                    </span>
                  </div>

                  {callers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      Немає прямих викликів у межах глибини {depth}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {callers.map((node) => (
                        <div
                          key={node.id}
                          onClick={() => setActiveTarget(node.id)}
                          className="p-3 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-sky-500/50 transition-all cursor-pointer group shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                              Hop {node.depth}
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${getLayerBadge(node.layer)}`}>
                              {node.layer}
                            </span>
                          </div>
                          <p className="text-xs font-bold font-mono text-slate-200 group-hover:text-sky-300 truncate" title={node.name}>
                            {node.name}()
                          </p>
                          <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={node.declaring_class}>
                            {node.class_simple_name}
                          </p>
                          {node.signature && (
                            <p className="text-[10px] font-mono text-slate-400 truncate mt-1 bg-black/30 px-1.5 py-0.5 rounded">
                              {node.signature}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Column 2: Target Root Member */}
              <div className="space-y-3 bg-[#161b22] p-5 rounded-2xl border-2 border-purple-500/60 shadow-xl shadow-purple-500/5 relative">
                <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-purple-500 text-slate-950 text-[10px] font-mono font-bold uppercase shadow">
                  Цільовий елемент (Root)
                </div>

                <div className="pt-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getLayerBadge(rootNode?.layer || 'Unknown')}`}>
                    {rootNode?.layer || 'Element'}
                  </span>
                  <h3 className="text-base font-bold font-mono text-slate-100 mt-2 truncate" title={rootNode?.name}>
                    {rootNode?.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 truncate mt-0.5" title={rootNode?.declaring_class}>
                    📁 {rootNode?.declaring_class}
                  </p>
                </div>

                {rootNode?.signature && (
                  <div className="bg-[#0d1117] p-3 rounded-xl border border-[#30363d] text-xs font-mono text-purple-300">
                    <span className="text-slate-400 text-[10px] block mb-1">Сигнатура:</span>
                    <span className="break-all">{rootNode.signature}</span>
                  </div>
                )}

                {onNavigateToClass && rootNode?.declaring_class && (
                  <button
                    onClick={() => {
                      onNavigateToClass(rootNode.declaring_class);
                      onClose();
                    }}
                    className="w-full py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Target className="w-3.5 h-3.5 text-purple-400" />
                    Перейти до класу на графі
                  </button>
                )}
              </div>

              {/* Column 3: Outbound Callees */}
              {(direction === 'all' || direction === 'outbound') && (
                <div className="space-y-3 bg-[#0d1117] p-4 rounded-xl border border-[#30363d]">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-mono">
                      <ArrowUpRight className="w-4 h-4" /> Кого викликає (Fan-Out)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                      {callees.length} елементів
                    </span>
                  </div>

                  {callees.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      Немає вихідних викликів у межах глибини {depth}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {callees.map((node) => (
                        <div
                          key={node.id}
                          onClick={() => setActiveTarget(node.id)}
                          className="p-3 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-amber-500/50 transition-all cursor-pointer group shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Hop +{node.depth}
                            </span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${getLayerBadge(node.layer)}`}>
                              {node.layer}
                            </span>
                          </div>
                          <p className="text-xs font-bold font-mono text-slate-200 group-hover:text-amber-300 truncate" title={node.name}>
                            {node.name}{node.member_type === 'method' ? '()' : ''}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={node.declaring_class}>
                            {node.class_simple_name}
                          </p>
                          {node.signature && (
                            <p className="text-[10px] font-mono text-slate-400 truncate mt-1 bg-black/30 px-1.5 py-0.5 rounded">
                              {node.signature}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
