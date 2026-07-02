import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyThemePreference, getStoredThemePreference } from './lib/theme';

function installGlobalErrorLogging() {
  const w = window as unknown as {
    __APP_ERRORS__?: Array<{ message: string; stack?: string; source?: string }>;
  };
  if (!w.__APP_ERRORS__) w.__APP_ERRORS__ = [];

  window.addEventListener('error', (event) => {
    const entry = {
      message: event.message || 'Unknown error',
      stack: (event.error && (event.error as Error).stack) || undefined,
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    };
    w.__APP_ERRORS__!.push(entry);
    console.error('[Global Error]', entry);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as Error | string | undefined;
    const entry = {
      message: typeof reason === 'string' ? reason : reason?.message || 'Unhandled promise rejection',
      stack: typeof reason === 'string' ? undefined : reason?.stack,
    };
    w.__APP_ERRORS__!.push(entry);
    console.error('[Unhandled Rejection]', entry);
  });
}

installGlobalErrorLogging();
applyThemePreference(getStoredThemePreference());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
