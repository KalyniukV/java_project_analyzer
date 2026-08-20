import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleCopy = () => {
    const text = `${this.state.error?.toString()}\n\nStack:\n${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#0d1117] text-slate-100 flex items-center justify-center p-6 select-text z-50">
          <div className="max-w-xl w-full bg-[#161b22] border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-100">
                  Помилка інтерфейсу JavaLens
                </h1>
                <p className="text-xs text-slate-400">
                  Відбулася непередбачена помилка під час рендерингу компонента
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/50 border border-rose-950/60 font-mono text-xs text-rose-300 max-h-48 overflow-y-auto space-y-1">
              <div className="font-bold">{this.state.error?.toString()}</div>
              {this.state.errorInfo?.componentStack && (
                <div className="text-[11px] text-slate-400 whitespace-pre-wrap mt-2">
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={this.handleCopy}
                className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{this.state.copied ? 'Скопійовано' : 'Скопіювати помилку'}</span>
              </button>

              <button
                onClick={this.handleReload}
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-sky-600/30"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Перезавантажити інтерфейс</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
