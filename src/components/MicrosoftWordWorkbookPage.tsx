import { useMemo } from 'react';
import { ExternalLink, FileText, MonitorUp, TabletSmartphone } from 'lucide-react';
import { UserProfile } from '../types';
import { detectStudentPortalFromPath } from '../lib/portal';
import { useLocation } from 'react-router-dom';

type MicrosoftWordWorkbookPageProps = {
  profile: UserProfile | null;
};

const WORD_SIGN_IN_URL = 'https://www.office.com/signin?ru=%2Flaunch%2Fword';
const WORD_LAUNCH_URL = 'https://www.microsoft365.com/launch/word';

function isDesktopWrapper() {
  if (typeof window === 'undefined') return false;
  return /Electron/i.test(window.navigator.userAgent || '');
}

export default function MicrosoftWordWorkbookPage({ profile }: MicrosoftWordWorkbookPageProps) {
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const desktopShell = useMemo(() => isDesktopWrapper(), []);

  const openWordOnline = () => {
    window.location.assign(WORD_SIGN_IN_URL);
  };

  const openWordLaunch = () => {
    window.location.assign(WORD_LAUNCH_URL);
  };

  const openWordDesktop = () => {
    window.location.href = 'ms-word:';
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-8">
      <section className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">
              {activePortal === 'university' ? 'University Microsoft Word Online' : 'Microsoft Word Online'}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-950">
              Open Microsoft Word Online
            </h1>
            <p className="mt-4 text-base font-medium leading-7 text-zinc-500">
              This page opens the real Microsoft Word web app. The user signs into Microsoft Word directly and continues inside EduRevolution.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Mode</p>
            <p className="mt-2 text-sm font-bold text-zinc-900">
              {desktopShell ? 'Desktop wrapper in-app Word launch' : 'Browser Word launch'}
            </p>
            {profile?.email ? (
              <p className="mt-1 text-sm font-medium text-zinc-500">{profile.email}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex max-w-4xl items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <FileText className="h-7 w-7" />
          </div>
          <div className="w-full">
            <h2 className="text-2xl font-black text-zinc-950">Sign into Word and keep going</h2>
            <p className="mt-3 text-sm font-medium leading-7 text-zinc-500">
              Use the buttons below to open the real Microsoft Word Online experience. In the Mac app wrapper, Word Online stays inside the app window instead of sending the user away.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openWordOnline}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700"
              >
                <MonitorUp className="h-4 w-4" />
                Open Microsoft Word
              </button>

              <button
                type="button"
                onClick={openWordLaunch}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-900 transition hover:bg-zinc-50"
              >
                <ExternalLink className="h-4 w-4" />
                Launch Word Online
              </button>

              <button
                type="button"
                onClick={openWordDesktop}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-900 transition hover:bg-zinc-50"
              >
                <TabletSmartphone className="h-4 w-4" />
                Open Word Desktop App
              </button>
            </div>

            <div className="mt-6 rounded-[28px] border border-zinc-200 bg-zinc-50 px-6 py-6">
              <p className="text-base font-black text-zinc-950">What this does</p>
              <p className="mt-2 text-sm font-medium leading-7 text-zinc-500">
                `Open Microsoft Word` sends this page to Microsoft’s real Word sign-in page, then into Word Online. On the Mac wrapper app, that Microsoft page stays in the app window so the user can sign in to Word there.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
