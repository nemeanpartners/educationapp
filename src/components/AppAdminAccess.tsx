import { useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  AuthProvider,
  setPersistence,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { BarChart3, Database, GraduationCap, LogIn, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth, googleProvider, microsoftProvider } from '../firebase';
import AppAdminPortal from './portals/AppAdminPortal';
import { bindNativeGoogleSignInBridge, isNativeIosGoogleWrapper, requestNativeGoogleSignIn } from '../lib/native-ios-google-auth';

interface AppAdminAccessProps {
  user: User | null;
}

function AppAdminLoginPanel() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }, []);

  useEffect(() => bindNativeGoogleSignInBridge(auth, {
    onSuccess: () => {
      setIsLoggingIn(false);
      setAuthError('');
    },
    onError: (message) => {
      setIsLoggingIn(false);
      setAuthError(message);
    },
  }), []);

  const handleLogin = async (provider: AuthProvider) => {
    setIsLoggingIn(true);
    setAuthError('');

    try {
      if (provider === googleProvider && isNativeIosGoogleWrapper()) {
        requestNativeGoogleSignIn();
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError(error?.message || 'App admin sign-in failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-8 lg:grid-cols-[1fr_440px] lg:items-center">
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-950/30">
              <GraduationCap size={26} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-indigo-200">EduRev AI</p>
              <h1 className="text-3xl font-black tracking-tight">App Admin Portal</h1>
            </div>
          </div>

          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-indigo-300">Global control centre</p>
            <h2 className="mt-5 text-5xl font-black tracking-tight sm:text-6xl">
              Manage subscriptions, curriculum data, and platform analytics from one control layer.
            </h2>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-zinc-300">
              App admins sign in here to manage school access, update QCAA curriculum content, and monitor system-wide growth and uptime.
            </p>
          </div>

          <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
            {[
              { label: 'School control', icon: Users },
              { label: 'Analytics view', icon: BarChart3 },
              { label: 'Curriculum data', icon: Database },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <Icon className="h-6 w-6 text-indigo-300" />
                  <p className="mt-4 text-sm font-black text-white">{item.label}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white p-8 text-zinc-950 shadow-2xl shadow-black/30">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <ShieldCheck size={28} />
          </div>
          <h2 className="text-3xl font-black tracking-tight">App admin sign in</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-zinc-500">
            Use a Google or Microsoft account to open the app admin control centre.
          </p>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => handleLogin(googleProvider)}
              disabled={isLoggingIn}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
              {isLoggingIn ? 'Signing in...' : 'Continue with Google'}
            </button>
            <button
              type="button"
              onClick={() => handleLogin(microsoftProvider)}
              disabled={isLoggingIn}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" className="h-5 w-5" alt="Microsoft" />
              {isLoggingIn ? 'Signing in...' : 'Continue with Microsoft'}
            </button>
          </div>

          {authError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-700">
              {authError}
            </div>
          ) : null}

          <div className="mt-8 flex items-center gap-3 rounded-3xl bg-zinc-50 p-4">
            <LogIn className="h-5 w-5 text-indigo-600" />
            <p className="text-xs font-bold leading-5 text-zinc-500">
              This portal is separate from student, teacher, and principal access so platform admins land directly in the control centre.
            </p>
          </div>

          <Link
            to="/auth"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-600 transition hover:bg-zinc-50"
          >
            <GraduationCap size={17} />
            Back to Portal Login
          </Link>
        </section>
      </div>
    </main>
  );
}

export default function AppAdminAccess({ user }: AppAdminAccessProps) {
  if (!user) {
    return <AppAdminLoginPanel />;
  }

  return <AppAdminPortal />;
}
