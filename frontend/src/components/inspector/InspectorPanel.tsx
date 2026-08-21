import React, { useState, useEffect } from 'react';
import { ProjectModel, VisualGraphPayload, ClassInfo, RelationshipEvidence } from '../../types';
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

function getDependencyDetails(
  sourceId: string,
  targetId: string,
  edgeKind: string | undefined,
  edgeLabel: string | undefined,
  edgeEvidences: RelationshipEvidence[] | undefined,
  project: ProjectModel | null,
  graphData: VisualGraphPayload | null
) {
  const srcClass = project?.classes.find((c) => c.id === sourceId);
  const tgtClass = project?.classes.find((c) => c.id === targetId);

  const srcNode = graphData?.nodes.find((n) => n.id === sourceId);
  const tgtNode = graphData?.nodes.find((n) => n.id === targetId);

  const srcSimple = srcClass?.name || sourceId.split('.').pop() || sourceId;
  const tgtSimple = tgtClass?.name || targetId.split('.').pop() || targetId;

  const causes: string[] = [];
  const evidences: RelationshipEvidence[] = edgeEvidences ? [...edgeEvidences] : [];

  // 1. Check Fields in Source
  if (srcClass?.fields) {
    for (const f of srcClass.fields) {
      if (f.type_name === tgtSimple || f.type_name === targetId || f.type_name.includes(tgtSimple)) {
        causes.push(`Поле: ${f.is_injected ? '@Autowired ' : ''}${f.type_name} ${f.name}`);
        if (!evidences.some((e) => e.detail.includes(f.name))) {
          evidences.push({
            file_path: srcClass.file_path,
            line_number: undefined,
            detail: `Поле ${f.is_injected ? '@Autowired ' : ''}${f.type_name} ${f.name}`,
          });
        }
      }
    }
  }

  // 2. Check Method Calls in Source
  if (srcClass?.methods) {
    for (const m of srcClass.methods) {
      const called = m.called_methods || [];
      const calls = called.filter((cm) => cm.includes(tgtSimple) || cm.includes(targetId));
      for (const call of calls) {
        const callMethodName = call.split('#').pop() || call;
        causes.push(`Метод: ${m.name}() ➔ ${callMethodName}()`);
        if (!evidences.some((e) => e.detail.includes(m.name))) {
          evidences.push({
            file_path: srcClass.file_path,
            line_number: m.line_number,
            detail: `Виклик у методі ${m.name}() ➔ ${callMethodName}()`,
          });
        }
      }
    }
  }

  // 3. Check Inheritance
  if (srcClass?.super_class === targetId || srcClass?.super_class === tgtSimple) {
    causes.push(`Наслідування: extends ${tgtSimple}`);
    if (!evidences.some((e) => e.detail.includes('extends'))) {
      evidences.push({
        file_path: srcClass.file_path,
        line_number: srcClass.line_number,
        detail: `extends ${tgtSimple}`,
      });
    }
  }
  if (srcClass?.interfaces?.some((i) => i === targetId || i === tgtSimple)) {
    causes.push(`Інтерфейс: implements ${tgtSimple}`);
    if (!evidences.some((e) => e.detail.includes('implements'))) {
      evidences.push({
        file_path: srcClass.file_path,
        line_number: srcClass.line_number,
        detail: `implements ${tgtSimple}`,
      });
    }
  }

  // Fallback to edge label if causes empty
  if (causes.length === 0 && edgeLabel) {
    causes.push(edgeLabel);
  }

  const srcFilePath = srcNode?.file_path || srcClass?.file_path;
  const srcLineNumber = srcNode?.line_number || srcClass?.line_number;

  const tgtFilePath = tgtNode?.file_path || tgtClass?.file_path;
  const tgtLineNumber = tgtNode?.line_number || tgtClass?.line_number;

  return {
    srcSimple,
    tgtSimple,
    causes,
    evidences,
    srcFilePath,
    srcLineNumber,
    tgtFilePath,
    tgtLineNumber,
  };
}

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
    return saved ? parseInt(saved, 10) : 340;
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
      if (newWidth >= 260 && newWidth <= 800) {
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
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-purple-500/50 transition-colors"
          onMouseDown={startResizing}
        />
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
          <Sparkles className="w-6 h-6 text-purple-400" />
        </div>
        <p className="text-sm font-semibold text-slate-200">Виберіть елемент на графі</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
          Клікніть на будь-який клас, пакет або модуль для детальної інспекції зв'язків
        </p>
      </div>
    );
  }

  const inboundEdges = graphData?.edges.filter((e) => e.target === selectedNodeId) || [];
  const outboundEdges = graphData?.edges.filter((e) => e.source === selectedNodeId) || [];

  const handleOpenFile = (path?: string, line?: number) => {
    if (path) {
      openFile(path, line);
    }
  };

  return (
    <aside
      className="relative flex flex-col h-full bg-[#161b22] border-l border-[#30363d] text-slate-100 flex-shrink-0 select-none shadow-2xl z-20"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Resizer Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-purple-500/50 transition-colors z-30"
        onMouseDown={startResizing}
        title="Перетягніть для зміни ширини панелі"
      />

      {/* Header */}
      <div className="p-4 border-b border-[#30363d] bg-black/20 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono">
              {activeNode?.category || 'Інспектор'}
            </span>
            {activeNode?.layer && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {activeNode.layer}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white truncate font-mono mt-0.5" title={selectedNodeId}>
            {activeNode?.label || selectedNodeId}
          </h3>
          <p className="text-[11px] text-slate-400 truncate font-mono" title={selectedNodeId}>
            {selectedNodeId}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Закрити панель (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
        {/* Open in Editor Button */}
        {classInfo?.file_path && (
          <button
            onClick={() => handleOpenFile(classInfo.file_path, classInfo.line_number)}
            className="w-full py-2 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm group"
          >
            <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            <span>Відкрити файл у редакторі</span>
          </button>
        )}

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 gap-2 bg-[#0d1117] p-3 rounded-xl border border-[#30363d] font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block">Вхідні (Ca)</span>
            <span className="text-sm font-bold text-sky-400">{inboundEdges.length}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Вихідні (Ce)</span>
            <span className="text-sm font-bold text-amber-400">{outboundEdges.length}</span>
          </div>

          {classInfo && (
            <>
              <div>
                <span className="text-[10px] text-slate-400 block">Рядків (LOC)</span>
                <span className="text-xs font-bold text-slate-200">{classInfo.loc}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Полів / Методів</span>
                <span className="text-xs font-bold text-slate-200">
                  {classInfo.fields.length} / {classInfo.methods.length}
                </span>
              </div>
            </>
          )}

          {pkgInfo?.metrics && (
            <>
              <div>
                <span className="text-[10px] text-slate-400 block">Нестабільність (I)</span>
                <span className="text-xs font-bold text-purple-400">
                  {pkgInfo.metrics.instability.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Абстрактність (A)</span>
                <span className="text-xs font-bold text-emerald-400">
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

        {/* Inbound Dependencies List (Who calls / uses this class) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Вхідні залежності ({inboundEdges.length})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">хто використовує</span>
          </div>
          {inboundEdges.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-[#0d1117] p-2.5 rounded-xl border border-[#30363d] text-center">
              Немає прямих вхідних залежностей
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {inboundEdges.map((edge) => {
                const details = getDependencyDetails(edge.source, edge.target, edge.kind, edge.label, edge.evidences, project, graphData);
                const kindInfo = getRelationKindBadge(edge.kind, edge.label);

                return (
                  <div
                    key={edge.id}
                    className="p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-sky-400/80 transition-all group shadow-sm space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        onClick={() => onSelectNode(edge.source)}
                        className="text-[13px] font-bold font-mono text-white group-hover:text-sky-300 truncate text-left"
                        title={edge.source}
                      >
                        {details.srcSimple}
                      </button>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 flex-shrink-0 ${kindInfo.color}`}>
                        <span>{kindInfo.icon}</span>
                        <span>{kindInfo.badge}</span>
                      </span>
                    </div>

                    {/* Source File Location */}
                    {details.srcFilePath && (
                      <div
                        onClick={() => handleOpenFile(details.srcFilePath, details.srcLineNumber)}
                        className="text-[10px] font-mono text-slate-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer truncate transition-colors"
                        title={`Відкрити файл: ${details.srcFilePath}:${details.srcLineNumber || 1}`}
                      >
                        <FileCode className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">
                          {details.srcFilePath.split(/[/\\]/).slice(-2).join('/')}
                          {details.srcLineNumber ? `:${details.srcLineNumber}` : ''}
                        </span>
                      </div>
                    )}

                    {/* Detailed Evidence List */}
                    {details.evidences.length > 0 ? (
                      <div className="space-y-1 pt-1.5 border-t border-white/5">
                        <span className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider block">
                          Підстави зв'язку:
                        </span>
                        {details.evidences.slice(0, 5).map((ev, ei) => (
                          <div
                            key={ei}
                            onClick={() => ev.file_path && handleOpenFile(ev.file_path, ev.line_number)}
                            className={`p-1.5 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-0.5 ${
                              ev.file_path ? 'cursor-pointer hover:border-sky-500/50 transition-colors' : ''
                            }`}
                            title={ev.file_path ? `Відкрити ${ev.file_path}:${ev.line_number || 1}` : undefined}
                          >
                            <span className="text-[10.5px] font-mono text-sky-200 truncate">
                              {ev.detail}
                            </span>
                            {ev.file_path && (
                              <span className="text-[9px] font-mono text-sky-400/80 flex items-center gap-1 truncate">
                                <FileCode className="w-2.5 h-2.5 flex-shrink-0" />
                                {ev.file_path.split(/[/\\]/).slice(-2).join('/')}
                                {ev.line_number ? `:${ev.line_number}` : ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : details.causes.length > 0 ? (
                      <div className="space-y-1 pt-1 border-t border-white/5">
                        {details.causes.map((cause, ci) => (
                          <div
                            key={ci}
                            className="text-[10.5px] font-mono text-sky-200 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 truncate"
                            title={cause}
                          >
                            {cause}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outbound Dependencies List (Who this class calls / uses) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Вихідні залежності ({outboundEdges.length})
            </span>
            <span className="text-[10px] text-slate-400 font-mono">кого викликає</span>
          </div>
          {outboundEdges.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-[#0d1117] p-2.5 rounded-xl border border-[#30363d] text-center">
              Немає вихідних залежностей
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {outboundEdges.map((edge) => {
                const details = getDependencyDetails(edge.source, edge.target, edge.kind, edge.label, edge.evidences, project, graphData);
                const kindInfo = getRelationKindBadge(edge.kind, edge.label);

                return (
                  <div
                    key={edge.id}
                    className="p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-amber-400/80 transition-all group shadow-sm space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        onClick={() => onSelectNode(edge.target)}
                        className="text-[13px] font-bold font-mono text-white group-hover:text-amber-300 truncate text-left"
                        title={edge.target}
                      >
                        {details.tgtSimple}
                      </button>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 flex-shrink-0 ${kindInfo.color}`}>
                        <span>{kindInfo.icon}</span>
                        <span>{kindInfo.badge}</span>
                      </span>
                    </div>

                    {/* Target File Location */}
                    {details.tgtFilePath && (
                      <div
                        onClick={() => handleOpenFile(details.tgtFilePath, details.tgtLineNumber)}
                        className="text-[10px] font-mono text-slate-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer truncate transition-colors"
                        title={`Відкрити файл: ${details.tgtFilePath}:${details.tgtLineNumber || 1}`}
                      >
                        <FileCode className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">
                          {details.tgtFilePath.split(/[/\\]/).slice(-2).join('/')}
                          {details.tgtLineNumber ? `:${details.tgtLineNumber}` : ''}
                        </span>
                      </div>
                    )}

                    {/* Detailed Evidence List */}
                    {details.evidences.length > 0 ? (
                      <div className="space-y-1 pt-1.5 border-t border-white/5">
                        <span className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider block">
                          Підстави зв'язку:
                        </span>
                        {details.evidences.slice(0, 5).map((ev, ei) => (
                          <div
                            key={ei}
                            onClick={() => ev.file_path && handleOpenFile(ev.file_path, ev.line_number)}
                            className={`p-1.5 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-0.5 ${
                              ev.file_path ? 'cursor-pointer hover:border-amber-500/50 transition-colors' : ''
                            }`}
                            title={ev.file_path ? `Відкрити ${ev.file_path}:${ev.line_number || 1}` : undefined}
                          >
                            <span className="text-[10.5px] font-mono text-amber-200 truncate">
                              {ev.detail}
                            </span>
                            {ev.file_path && (
                              <span className="text-[9px] font-mono text-amber-400/80 flex items-center gap-1 truncate">
                                <FileCode className="w-2.5 h-2.5 flex-shrink-0" />
                                {ev.file_path.split(/[/\\]/).slice(-2).join('/')}
                                {ev.line_number ? `:${ev.line_number}` : ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : details.causes.length > 0 ? (
                      <div className="space-y-1 pt-1 border-t border-white/5">
                        {details.causes.map((cause, ci) => (
                          <div
                            key={ci}
                            className="text-[10.5px] font-mono text-amber-200 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 truncate"
                            title={cause}
                          >
                            {cause}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
              {classInfo.methods.map((m) => {
                const methodId = m.id || `${classInfo.id}#${m.name}`;
                return (
                  <div
                    key={m.id}
                    className="p-2 rounded-xl bg-[#0d1117] border border-[#30363d] hover:border-purple-500/40 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {m.visibility && (
                            <span className="text-[9px] font-mono text-slate-400">{m.visibility}</span>
                          )}
                          <span className="text-xs font-bold font-mono text-slate-200 truncate">
                            {m.name}()
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
    </aside>
  );
};
