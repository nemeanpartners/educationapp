import { useEffect, useState } from 'react';
import { Mail, ShieldCheck, ArrowRight } from 'lucide-react';
import { auth } from '../firebase';

function normalizeMicrosoftEmail(raw: string) {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.includes('#EXT#@')) {
    const localPart = trimmed.split('#EXT#@')[0];
    const lastUnderscore = localPart.lastIndexOf('_');
    if (lastUnderscore > 0) {
      return `${localPart.slice(0, lastUnderscore)}@${localPart.slice(lastUnderscore + 1)}`;
    }
    return localPart.replace(/_/g, '@');
  }
  return trimmed;
}

export default function EmailPage() {
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    const seededEmail = normalizeMicrosoftEmail(auth.currentUser?.email || '');
    setEmailInput(seededEmail);
  }, []);

  const openOutlookMail = () => {
    window.open('https://outlook.office.com/mail/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] w-full p-6 pt-2">
      <div className="mx-auto flex max-w-5xl items-start justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-sky-200/50 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_28px_90px_rgba(14,116,144,0.16)] backdrop-blur-2xl md:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between gap-12 p-8 sm:p-10">
            <div>
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <Mail className="h-7 w-7 text-sky-600" />
              </div>
              <h1 className="bg-gradient-to-r from-slate-950 via-slate-700 to-sky-500 bg-clip-text text-4xl font-black tracking-tight text-transparent">
                Student Email
              </h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-500">
                Access Official Microsoft 365 Emails and Calendar
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Microsoft 365 Outlook
              </div>
            </div>
          </div>

          <div className="border-t border-white/60 bg-white/30 p-6 backdrop-blur-2xl md:border-l md:border-t-0">
            <div className="mx-auto flex h-full max-w-sm flex-col justify-center rounded-3xl border border-white/70 bg-white/55 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
              <div className="mb-7 flex items-center gap-3">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
                  className="h-8 w-8"
                  alt="Microsoft"
                />
                <div>
                  <p className="text-sm font-black text-slate-900">Microsoft 365</p>
                  <p className="text-xs font-semibold text-slate-400">Official Outlook login</p>
                </div>
              </div>

              <label className="block rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-xl">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">School email</span>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  placeholder="student@school.edu"
                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>

              <button
                type="button"
                onClick={openOutlookMail}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-300"
              >
                Open Outlook Email
                <ArrowRight className="h-4 w-4" />
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
