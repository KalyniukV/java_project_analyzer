import React, { useState, useEffect } from 'react';
import { StoredProjectSummary, DirEntryInfo, BrowseDirResponse } from '../types';
import {
  listStoredProjects,
  deleteStoredProject,
  pickFolderNative,
  browseDirectories,
} from '../api/client';
import {
  FolderSearch,
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Database,
  Trash2,
  Sparkles,
  Zap,
  HardDrive,
  Code2,
  FileCode,
  Box,
  Compass,
  X,
  UploadCloud,
  CheckCircle2,
  Radio
} from 'lucide-react';

interface ProjectPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanPath: (path: string) => void;
  onLoadFromNoSQL: (path: string) => void;
  isScanning: boolean;
}

export const ProjectPickerModal: React.FC<ProjectPickerModalProps> = ({
  isOpen,
  onClose,
  onScanPath,
  onLoadFromNoSQL,
  isScanning,
}) => {
  const [modalTab, setModalTab] = useState<'explorer' | 'saved' | 'direct'>('explorer');
  const [storedProjects, setStoredProjects] = useState<StoredProjectSummary[]>([]);
  const [browseData, setBrowseData] = useState<BrowseDirResponse | null>(null);
  const [customPath, setCustomPath] = useState('');
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isNativePicking, setIsNativePicking] = useState(false);

  const samplePath = 'fixtures/sample-petclinic';

  // Load initial browse & stored list
  useEffect(() => {
    if (isOpen) {
      listStoredProjects().then(setStoredProjects).catch(console.error);
      loadBrowse();
    }
  }, [isOpen]);

  const loadBrowse = async (path?: string) => {
    try {
      setIsBrowsing(true);
      const data = await browseDirectories(path);
      setBrowseData(data);
      setCustomPath(data.current_path);
    } catch (err) {
      console.error('Browse error:', err);
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleNativePick = async () => {
    try {
      setIsNativePicking(true);
      const picked = await pickFolderNative();
      if (picked) {
        setCustomPath(picked);
        onScanPath(picked);
        onClose();
      }
    } catch (err) {
      console.error('Native pick error:', err);
    } finally {
      setIsNativePicking(false);
    }
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPath.trim()) {
      onScanPath(customPath.trim());
      onClose();
    }
  };

  const handleDeleteStored = async (e: React.MouseEvent, rootPath: string) => {
    e.stopPropagation();
    await deleteStoredProject(rootPath);
    listStoredProjects().then(setStoredProjects).catch(console.error);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // In webview/browser, if files or path dropped
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0] as any;
      if (file.path) {
        onScanPath(file.path);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div
        className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Top Header */}
        <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FolderSearch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Вибір Java проєкту для сканування
              </h3>
              <p className="text-xs text-slate-400">
                Виберіть каталог із Maven (`pom.xml`), Gradle або вихідним кодом Java
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNativePick}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95"
              title="Відкрити системний провідник Windows/Linux"
            >
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>Системний вибір...</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-[#30363d] bg-[#0d1117]/60">
          <button
            onClick={() => setModalTab('explorer')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
              modalTab === 'explorer'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Огляд файлової системи</span>
          </button>

          <button
            onClick={() => setModalTab('saved')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
              modalTab === 'saved'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Збережені у NoSQL ({storedProjects.length})</span>
          </button>

          <button
            onClick={() => setModalTab('direct')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
              modalTab === 'direct'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Прямий шлях & Demo</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex-1 overflow-y-auto min-h-[320px]">
          {/* TAB 1: File System Explorer */}
          {modalTab === 'explorer' && (
            <div className="space-y-3 flex flex-col h-full">
              {/* Breadcrumb & Navigation Bar */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#0d1117] border border-[#30363d] text-xs font-mono">
                {browseData?.parent_path && (
                  <button
                    onClick={() => loadBrowse(browseData.parent_path)}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-sky-300 transition-colors flex-shrink-0"
                    title="Вгору на один рівень"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <span className="text-slate-400 select-all truncate flex-1" title={browseData?.current_path}>
                  {browseData?.current_path || 'Завантаження...'}
                </span>
                <button
                  onClick={() => {
                    if (browseData?.current_path) {
                      onScanPath(browseData.current_path);
                      onClose();
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] transition-all flex-shrink-0 shadow"
                >
                  Сканувати поточну папку 🚀
                </button>
              </div>

              {/* Directory Entries List */}
              <div className="flex-1 border border-[#30363d] rounded-xl bg-[#0d1117] overflow-y-auto max-h-72 divide-y divide-[#21262d]">
                {isBrowsing ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-mono">
                    Зчитування папок...
                  </div>
                ) : browseData?.entries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    У цьому каталозі немає вкладених папок
                  </div>
                ) : (
                  browseData?.entries.map((entry: DirEntryInfo) => (
                    <div
                      key={entry.path}
                      className={`p-2.5 flex items-center justify-between hover:bg-white/5 transition-colors group cursor-pointer ${
                        entry.is_java_project ? 'bg-sky-500/5' : ''
                      }`}
                      onClick={() => loadBrowse(entry.path)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {entry.is_java_project ? (
                          <FolderOpen className="w-4 h-4 text-sky-400 flex-shrink-0" />
                        ) : (
                          <Folder className="w-4 h-4 text-slate-400 group-hover:text-slate-200 flex-shrink-0" />
                        )}
                        <span className="text-xs font-mono font-medium text-slate-200 truncate group-hover:text-sky-300">
                          {entry.name}
                        </span>

                        {entry.project_type === 'gwt' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/40">
                            GWT Project
                          </span>
                        )}
                        {entry.project_type === 'maven' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Maven pom.xml
                          </span>
                        )}
                        {entry.project_type === 'gradle' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Gradle
                          </span>
                        )}
                        {entry.project_type === 'java' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                            Java src
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {entry.is_java_project && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onScanPath(entry.path);
                              onClose();
                            }}
                            className="px-2 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-slate-950 text-[11px] font-bold transition-all border border-sky-500/30"
                          >
                            Сканувати ⚡
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Stored NoSQL Projects */}
          {modalTab === 'saved' && (
            <div className="space-y-3">
              {storedProjects.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-[#0d1117] rounded-xl border border-[#30363d]">
                  У NoSQL базі даних ще немає збережених проєктів. Виконайте перше сканування.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {storedProjects.map((p) => (
                    <div
                      key={p.root_path}
                      onClick={() => {
                        onLoadFromNoSQL(p.root_path);
                        onClose();
                      }}
                      className="p-3.5 rounded-xl bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] hover:border-emerald-500/50 transition-all cursor-pointer flex items-center justify-between group shadow-sm"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-slate-100 group-hover:text-emerald-300">
                            {p.project_name}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            {p.classes_count} класів • {p.modules_count} модулів • {p.relationships_count} зв'язків
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 truncate" title={p.root_path}>
                          {p.root_path}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-emerald-400 group-hover:underline flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> Завантажити
                        </span>
                        <button
                          onClick={(e) => handleDeleteStored(e, p.root_path)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Видалити з NoSQL бази"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Direct Path & Demo */}
          {modalTab === 'direct' && (
            <div className="space-y-4">
              <form onSubmit={handleDirectSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Введіть або вставте абсолютний шлях до проєкту:
                  </label>
                  <input
                    type="text"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="D:/workspace/my-spring-project"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 shadow-inner"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onScanPath(samplePath);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Demo PetClinic
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onScanPath('d:/antigravity/java_project_analyzer/fixtures/sample-gwt-app');
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
                    >
                      <Radio className="w-3.5 h-3.5 text-fuchsia-400" />
                      Demo GWT RPC
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!customPath.trim() || isScanning}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-md disabled:opacity-50"
                  >
                    {isScanning ? 'Сканування...' : 'Розпочати сканування 🚀'}
                  </button>
                </div>
              </form>

              {/* Drag & Drop Dropzone */}
              <div
                className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all ${
                  isDragOver
                    ? 'border-sky-400 bg-sky-500/10'
                    : 'border-[#30363d] bg-[#0d1117]/50 text-slate-400'
                }`}
              >
                <UploadCloud className="w-8 h-8 text-sky-400 mb-2" />
                <p className="text-xs font-semibold text-slate-200">
                  Або перетягніть папку проєкту сюди
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Система автоматично визначить структуру та зв'язки
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
