import React, { useState, useEffect } from 'react';
import { ProjectModel, VisualGraphPayload, ClassInfo } from '../../types';
import { openFile, getClassDetail } from '../../api/client';
import {
  FileCode,
  Folder,
  Box,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Code2,
  ListFilter,
  CheckCircle2,
  X,
  GitCommit,
  Layers,
  Sparkles
} from 'lucide-react';

interface InspectorPanelProps {
  selectedNodeId: string | null;
  graphData: VisualGraphPayload | null;
  project: ProjectModel | null;
  onSelectNode: (nodeId: string) => void;
  onClose: () => void;
  onOpenCallHierarchy?: (memberId: string) => void;
}

const getRelationKindBadge = (kind?: string, label?: string) => {
  if (kind === 'Extends') {
    return { badge: 'extends', color: 'bg-amber-500/20 text-[#fb923c] border-amber-500/40', icon: '🧬' };
  }
  if (kind === 'Implements') {
    return { badge: 'implements', color: 'bg-cyan-500/20 text-[#38bdf8] border-cyan-500/40', icon: '🔌' };
  }
  if (kind === 'FieldDependency') {
    const isDI = label?.includes('@Autowired') || label?.includes('@Inject');
    return { badge: isDI ? '@Autowired' : 'Поле', color: 'bg-purple-500/20 text-[#c084fc] border-purple-500/40', icon: '💉' };
  }
  if (kind === 'MethodCall') {
    return { badge: 'Виклик', color: 'bg-blue-500/20 text-[#38bdf8] border-blue-500/40', icon: '📞' };
  }
  if (kind === 'MethodSignature') {
    const isParam = label?.includes('Параметр');
    return { badge: isParam ? 'Параметр' : 'Return', color: 'bg-teal-500/20 text-[#2dd4bf] border-teal-500/40', icon: '📋' };
  }
  if (kind === 'GwtRpcCall' || kind === 'GwtRpcBinding') {
    return { badge: 'GWT RPC', color: 'bg-fuchsia-500/20 text-[#e879f9] border-fuchsia-500/40', icon: '🌐' };
  }
  return { badge: 'Зв\'язок', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40', icon: '🔗' };
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedNodeId,
  graphData,
  project,
  onSelectNode,
  onClose,
  onOpenCallHierarchy,
}) => {
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('javalens_inspector_width');
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [detailClassInfo, setDetailClassInfo] = useState<ClassInfo | null>(null);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 240 && newWidth <= 750) {
        setPanelWidth(newWidth);
        localStorage.setItem('javalens_inspector_width', String(newWidth));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Find node in graphData
  const activeNode = graphData?.nodes.find((n) => n.id === selectedNodeId);
  const baseClassInfo = project?.classes.find((c) => c.id === selectedNodeId);
  const pkgInfo = project?.packages.find((p) => p.id === selectedNodeId);
  const moduleInfo = project?.modules.find((m) => m.id === selectedNodeId);

  useEffect(() => {
    if (selectedNodeId && activeNode?.category !== 'package' && activeNode?.category !== 'module') {
      getClassDetail(selectedNodeId)
        .then((detail) => setDetailClassInfo(detail))
        .catch(() => setDetailClassInfo(null));
    } else {
      setDetailClassInfo(null);
    }
  }, [selectedNodeId, activeNode?.category]);

  const classInfo = detailClassInfo || baseClassInfo;

  if (!selectedNodeId) {
    return (
      <div
        className="h-full relative flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-[#161b22] border-l border-[#30363d] flex-shrink-0"
        style={{ width: `${panelWidth}px` }}
      >
        {/* Left Drag Handle */}
        <div
          onMouseDown={startResizing}
          className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-sky-500 transition-colors z-30"
          title="Потягніть, щоб змінити ширину панелі деталей"
        />
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3 text-slate-400">
          <ListFilter className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-300">Елемент не вибрано</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
          Клікніть на будь-який клас, пакет або модуль для перегляду зв'язків та деталей
        </p>
      </div>
    );
  }

  // Inbound & Outbound edges
  const inboundEdges = graphData?.edges.filter((e) => e.target === selectedNodeId) || [];
  const outboundEdges = graphData?.edges.filter((e) => e.source === selectedNodeId) || [];

  const handleOpenIDE = () => {
    if (classInfo?.file_path) {
      openFile(classInfo.file_path, classInfo.line_number);
    } else if (moduleInfo?.path) {
      openFile(moduleInfo.path, 1);
    }
  };

  return (
    <div
      className="h-full relative flex flex-col bg-[#161b22] border-l border-[#30363d] overflow-y-auto flex-shrink-0 select-text"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Left Resize Drag Handle */}
      <div
        onMouseDown={startResizing}
        className={`absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-col-resize transition-all z-30 flex items-center justify-center group ${
          isResizing ? 'bg-sky-500' : 'hover:bg-sky-500/50'
        }`}
        title="Потягніть, щоб змінити ширину панелі деталей"
      >
        <div className="w-0.5 h-8 bg-white/20 rounded-full group-hover:bg-white transition-colors" />
      </div>

      {/* Header */}
      <div className="p-3.5 border-b border-[#30363d] flex items-start justify-between bg-black/20">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              {activeNode?.category || 'Element'}
            </span>
            {classInfo?.is_public && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                public
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-slate-100 truncate tracking-tight" title={selectedNodeId}>
            {activeNode?.label || selectedNodeId}
          </h3>
          <p className="text-xs font-mono text-slate-400 truncate mt-0.5" title={selectedNodeId}>
            {selectedNodeId}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Quick Action: Open in IDE */}
        {(classInfo?.file_path || moduleInfo?.path) && (
          <button
            onClick={handleOpenIDE}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-all shadow-sm group"
          >
            <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            Відкрити файл у редакторі
          </button>
        )}

        {/* Metrics Overview Card */}
        <div className="grid grid-cols-2 gap-2 bg-[#0d1117] p-3 rounded-xl border border-[#30363d]">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ArrowDownLeft className="w-3 h-3 text-sky-400" /> Вхідні (Ca)
            </span>
            <span className="text-lg font-bold font-mono text-sky-400">
              {inboundEdges.length}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-amber-400" /> Вихідні (Ce)
            </span>
            <span className="text-lg font-bold font-mono text-amber-400">
              {outboundEdges.length}
            </span>
          </div>
          {classInfo && (
            <>
              <div className="flex flex-col pt-2 border-t border-white/5">
                <span className="text-[11px] text-slate-400">Рядків (LOC)</span>
                <span className="text-sm font-semibold font-mono text-slate-200">{classInfo.loc}</span>
              </div>
              <div className="flex flex-col pt-2 border-t border-white/5">
                <span className="text-[11px] text-slate-400">Полів / Методів</span>
                <span className="text-sm font-semibold font-mono text-slate-200">
                  {classInfo.fields.length} / {classInfo.methods.length}
                </span>
              </div>
            </>
          )}
          {pkgInfo?.metrics && (
            <>
              <div className="flex flex-col pt-2 border-t border-white/5">
                <span className="text-[11px] text-slate-400">Instability (I)</span>
                <span className="text-sm font-semibold font-mono text-amber-400">
                  {pkgInfo.metrics.instability.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-col pt-2 border-t border-white/5">
                <span className="text-[11px] text-slate-400">Abstractness (A)</span>
                <span className="text-sm font-semibold font-mono text-emerald-400">
                  {pkgInfo.metrics.abstractness.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Annotations */}
        {classInfo?.annotations && classInfo.annotations.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-1.5">
              Анотації (Spring / GWT / Framework)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {classInfo.annotations.map((ann, i) => (
                <span
                  key={i}
                  className="text-xs font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20"
                >
                  @{ann}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Inbound Dependencies List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Вхідні залежності ({inboundEdges.length})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">хто використовує цей клас</span>
          </div>
          {inboundEdges.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-[#0d1117] p-2.5 rounded-xl border border-[#30363d] text-center">
              Немає прямих вхідних залежностей
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {inboundEdges.map((edge) => {
                const srcLabel = graphData?.nodes.find((n) => n.id === edge.source)?.label || edge.source;
                const kindInfo = getRelationKindBadge(edge.kind, edge.label);

                return (
                  <button
                    key={edge.id}
                    onClick={() => onSelectNode(edge.source)}
                    className="w-full text-left p-2.5 rounded-xl bg-[#0d1117] hover:bg-[#1e293b] border border-[#30363d] hover:border-sky-400 transition-all group shadow-sm space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="text-[13px] font-bold font-mono text-white group-hover:text-sky-300 truncate"
                        style={{ color: '#ffffff' }}
                        title={edge.source}
                      >
                        {srcLabel}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 flex-shrink-0 ${kindInfo.color}`}>
                        <span>{kindInfo.icon}</span>
                        <span>{kindInfo.badge}</span>
                      </span>
                    </div>
                    {edge.label && (
                      <div
                        className="text-[10px] font-mono text-slate-300 bg-black/40 px-2 py-0.5 rounded border border-white/5 truncate"
                        title={edge.label}
                      >
                        {edge.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Outbound Dependencies List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Вихідні залежності ({outboundEdges.length})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">кого викликає цей клас</span>
          </div>
          {outboundEdges.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-[#0d1117] p-2.5 rounded-xl border border-[#30363d] text-center">
              Немає вихідних залежностей
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {outboundEdges.map((edge) => {
                const tgtLabel = graphData?.nodes.find((n) => n.id === edge.target)?.label || edge.target;
                const kindInfo = getRelationKindBadge(edge.kind, edge.label);

                return (
                  <button
                    key={edge.id}
                    onClick={() => onSelectNode(edge.target)}
                    className="w-full text-left p-2.5 rounded-xl bg-[#0d1117] hover:bg-[#1e293b] border border-[#30363d] hover:border-amber-400 transition-all group shadow-sm space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className="text-[13px] font-bold font-mono text-white group-hover:text-amber-300 truncate"
                        style={{ color: '#ffffff' }}
                        title={edge.target}
                      >
                        {tgtLabel}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 flex-shrink-0 ${kindInfo.color}`}>
                        <span>{kindInfo.icon}</span>
                        <span>{kindInfo.badge}</span>
                      </span>
                    </div>
                    {edge.label && (
                      <div
                        className="text-[10px] font-mono text-slate-300 bg-black/40 px-2 py-0.5 rounded border border-white/5 truncate"
                        title={edge.label}
                      >
                        {edge.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Methods List with Call Hierarchy Integration */}
        {classInfo?.methods && classInfo.methods.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" /> Методи ({classInfo.methods.length})
              </span>
              <span className="text-[10px] text-slate-400 font-mono">виклики & глибина</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {classInfo.methods.map((m, i) => {
                const methodId = m.id || `${classInfo.id}#${m.name}`;
                const paramsStr = m.parameters && m.parameters.length > 0
                  ? m.parameters.map((p) => `${p.type_name} ${p.name}`).join(', ')
                  : (m.param_types ? m.param_types.join(', ') : '');

                return (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-purple-500/40 transition-colors space-y-1.5 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {m.visibility && (
                            <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1 rounded">
                              {m.visibility}
                            </span>
                          )}
                          <span className="text-xs font-bold font-mono text-purple-300 truncate">
                            {m.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate">
                            ({paramsStr})
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-sky-400 truncate mt-0.5">
                          ➔ {m.return_type}
                        </div>
                      </div>

                      {onOpenCallHierarchy && (
                        <button
                          onClick={() => onOpenCallHierarchy(methodId)}
                          className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold font-mono transition-all flex items-center gap-1 flex-shrink-0 shadow-sm"
                          title="Відкрити інтерактивну ієрархію викликів методу"
                        >
                          <GitCommit className="w-3 h-3 text-purple-400" />
                          Ієрархія 🎯
                        </button>
                      )}
                    </div>

                    {/* Method Annotations */}
                    {m.annotations && m.annotations.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {m.annotations.map((ann, ai) => (
                          <span key={ai} className="text-[9px] font-mono px-1 rounded bg-amber-500/15 text-amber-400">
                            @{ann}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fields List with Field Usage Integration */}
        {classInfo?.fields && classInfo.fields.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" /> Поля ({classInfo.fields.length})
              </span>
              <span className="text-[10px] text-slate-400 font-mono">типи & зв'язки</span>
            </div>

            <div className="space-y-1.5 bg-[#0d1117] p-2.5 rounded-xl border border-[#30363d] max-h-48 overflow-y-auto">
              {classInfo.fields.map((f, i) => {
                const fieldId = f.id || `${classInfo.id}#${f.name}`;
                return (
                  <div key={i} className="text-xs font-mono text-slate-300 flex items-center justify-between gap-2 py-1 border-b border-white/5 last:border-none">
                    <div className="min-w-0 truncate flex items-center gap-1.5">
                      {f.visibility && (
                        <span className="text-[9px] text-slate-400">{f.visibility}</span>
                      )}
                      <span className="font-semibold text-slate-200">{f.name}:</span>
                      <span className="text-sky-400 truncate">{f.type_name}</span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {f.is_injected && (
                        <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-400">DI</span>
                      )}
                      {onOpenCallHierarchy && (
                        <button
                          onClick={() => onOpenCallHierarchy(fieldId)}
                          className="px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 text-[10px] transition-colors"
                          title="Показати методи, які використовують це поле"
                        >
                          Виклики ➔
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
