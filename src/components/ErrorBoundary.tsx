/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React error caught by ErrorBoundary:', error, errorInfo);
    (this as any).setState?.({ errorInfo });
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('mihiretu_chart_settings');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    const state = (this as any).state as State;
    const props = (this as any).props as Props;

    if (state?.hasError) {
      return (
        <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#09090b] text-[#fafafa] font-sans p-6 selection:bg-blue-600 selection:text-white">
          <div className="max-w-md w-full p-8 rounded-2xl bg-[#121214] border border-neutral-800 shadow-2xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-5 text-rose-500">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Application Recovery</h2>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              A runtime component encountered an unexpected error. You can reload the application or reset cached chart data to restore the display.
            </p>

            {state.error && (
              <div className="w-full mb-6 p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 text-left font-mono text-[11px] text-rose-400 overflow-x-auto max-h-32">
                {state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/20 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload App</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold text-xs transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Reset Settings</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return props.children;
  }
}
