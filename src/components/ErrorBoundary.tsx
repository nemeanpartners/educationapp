import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 text-center">
          <div className="mb-6 rounded-full bg-red-100 p-4 text-red-600">
            <AlertTriangle size={48} />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-zinc-900">Something went wrong</h1>
          <p className="mb-8 max-w-md text-zinc-500">
            {errorMessage}
          </p>
          {isFirestoreError && (
            <p className="mb-8 max-w-md text-sm text-zinc-400">
              This might be a permission issue or a configuration problem with the database.
            </p>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
          >
            <RotateCcw size={20} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
