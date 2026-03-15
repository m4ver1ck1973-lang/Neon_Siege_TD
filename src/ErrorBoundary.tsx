import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };
  props: any;

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // A fallback UI that matches the application's theme
      return (
        <div className="flex flex-col w-full h-screen bg-[#050505] font-mono text-cyan-500 select-none items-center justify-center p-8">
          <div className="max-w-md w-full text-center bg-zinc-950 border border-rose-900/50 p-8 shadow-[0_0_50px_rgba(255,0,0,0.1)]">
            <h1 className="text-4xl font-black uppercase tracking-widest mb-2 text-rose-500">System Crash</h1>
            <p className="text-cyan-700 mb-8 font-mono text-sm">A critical error occurred. Please reload the application.</p>
            <button onClick={() => window.location.reload()} className="w-full py-4 bg-rose-950 hover:bg-rose-900 border border-rose-500/50 text-rose-400 font-bold transition-colors uppercase tracking-widest text-sm">Reload Application</button>
          </div>
        </div>
      );
    }

    return this.props?.children;
  }
}

export default ErrorBoundary;