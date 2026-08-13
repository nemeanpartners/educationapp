import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ExternalLink, RefreshCcw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { UserProfile } from '../types';
import { detectStudentPortalFromPath } from '../lib/portal';

type WordOnlinePageProps = {
  profile: UserProfile | null;
};

const WORD_ONLINE_URL = 'https://word.cloud.microsoft/en-gb/?wdOrigin=OFFICECOM-WEB.REDIRECT';

declare global {
  interface Window {
    eduRevShell?: {
      isDesktopShell?: boolean;
      openWordOnline?: (payload: { url: string; bounds: { x: number; y: number; width: number; height: number } }) => void;
      updateWordOnlineBounds?: (bounds: { x: number; y: number; width: number; height: number }) => void;
      closeWordOnline?: () => void;
    };
  }
}

function isDesktopWrapper() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.eduRevShell?.isDesktopShell)
    || /Electron/i.test(window.navigator.userAgent || '')
    || new URLSearchParams(window.location.search).get('shell') === 'macos'
    || window.localStorage.getItem('edurev-desktop-shell') === '1';
}

export default function WordOnlinePage({ profile }: WordOnlinePageProps) {
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const viewHostRef = useRef<HTMLDivElement | null>(null);
  const desktopShell = useMemo(() => isDesktopWrapper(), []);
  const canEmbedWord = desktopShell && Boolean(window.eduRevShell?.openWordOnline);

  const syncEmbeddedBounds = () => {
    if (!desktopShell || !viewHostRef.current || !window.eduRevShell?.updateWordOnlineBounds) return;
    const rect = viewHostRef.current.getBoundingClientRect();
    window.eduRevShell.updateWordOnlineBounds({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  useLayoutEffect(() => {
    if (!canEmbedWord || !viewHostRef.current || !window.eduRevShell?.openWordOnline) return;

    const rect = viewHostRef.current.getBoundingClientRect();
    window.eduRevShell.openWordOnline({
      url: WORD_ONLINE_URL,
      bounds: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    });

    const resizeObserver = new ResizeObserver(() => syncEmbeddedBounds());
    resizeObserver.observe(viewHostRef.current);
    window.addEventListener('resize', syncEmbeddedBounds);
    window.addEventListener('scroll', syncEmbeddedBounds, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncEmbeddedBounds);
      window.removeEventListener('scroll', syncEmbeddedBounds, true);
      window.eduRevShell?.closeWordOnline?.();
    };
  }, [canEmbedWord]);

  const openDirectly = () => {
    if (desktopShell) {
      window.location.assign(WORD_ONLINE_URL);
      return;
    }

    window.open(WORD_ONLINE_URL, '_blank', 'noopener,noreferrer');
  };

  const reloadWord = () => {
    if (desktopShell && viewHostRef.current && window.eduRevShell?.openWordOnline) {
      const rect = viewHostRef.current.getBoundingClientRect();
      window.eduRevShell.openWordOnline({
        url: WORD_ONLINE_URL,
        bounds: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
      return;
    }

    openDirectly();
  };

  useEffect(() => {
    if (!desktopShell) {
      window.eduRevShell?.closeWordOnline?.();
    }
  }, [desktopShell]);

  return (
    <div className="flex h-[calc(100vh-5.3rem)] min-h-[720px] flex-col gap-2.5 p-3">
      <section className="rounded-[22px] border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">
              {activePortal === 'university' ? 'University Word' : 'Word'}
            </p>
            <h1 className="mt-0.5 text-[1.72rem] font-black tracking-tight leading-none text-zinc-950">
              Microsoft Word Online
            </h1>
            <p className="mt-1.5 max-w-3xl text-[13px] font-medium leading-5 text-zinc-500">
              This page keeps Word Online inside the EducationRev desktop app instead of trying to frame Microsoft in the browser.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-2">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Version</p>
              <p className="mt-0.5 text-sm font-bold text-zinc-900">
                {desktopShell ? 'Desktop app' : 'Browser web app'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reloadWord}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-black text-zinc-900 transition hover:bg-zinc-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Reload Word
              </button>
              <button
                type="button"
                onClick={openDirectly}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700"
              >
                <ExternalLink className="h-4 w-4" />
                Open Direct Link
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={viewHostRef}
        className="min-h-0 flex-1 overflow-hidden rounded-[30px] border border-zinc-200 bg-white shadow-sm"
      >
        {canEmbedWord ? (
          <div className="flex h-full min-h-[680px] items-center justify-center bg-zinc-50 text-center">
            <div className="max-w-xl px-6">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">Word</p>
              <h2 className="mt-3 text-2xl font-black text-zinc-950">Embedded in the desktop app</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-zinc-500">
                The Mac wrapper places Microsoft Word Online directly into this page area as a native desktop view.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[680px] items-center justify-center bg-zinc-50 text-center">
            <div className="max-w-xl px-6">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">Microsoft Word Online</p>
              <h2 className="mt-3 text-2xl font-black text-zinc-950">Open Word in this window</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-zinc-500">
                Microsoft blocks Word Online from being framed in a normal browser. In the desktop wrapper, use the direct Word link to load Microsoft Word Online as the main page.
              </p>
              <button
                type="button"
                onClick={openDirectly}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700"
              >
                <ExternalLink className="h-4 w-4" />
                Open Microsoft Word Online
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
