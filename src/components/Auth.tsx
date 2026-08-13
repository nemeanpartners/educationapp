import { useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail,
  getRedirectResult,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type AuthProvider,
} from 'firebase/auth';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { appleProvider, auth, db, googleProvider, microsoftProvider } from '../firebase';
import { bindNativeGoogleSignInBridge, isNativeIosGoogleWrapper, requestNativeGoogleSignIn } from '../lib/native-ios-google-auth';
import { doc, getDoc, setDoc } from '../lib/portal-firestore';
import { getStoredStudentPortal, setStoredStudentPortal, type StudentPortalType } from '../lib/portal';
import { APP_BRAND_NAME } from '../lib/branding';
import type { UserProfile } from '../types';

type AuthMode = 'signin' | 'signup';
const CANONICAL_AUTH_ORIGIN = 'https://www.educationrevolution.qld.one';
type DesktopAuthShellBridge = {
  openExternalAuth?: (url: string) => void;
};

function isMacDesktopWrapper() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('shell') === 'macos') return true;
  return /Electron/i.test(window.navigator.userAgent || '')
    || window.localStorage.getItem('edurev-desktop-shell') === '1'
    || window.localStorage.getItem('edurev-wrapper-origin') === 'native-macos';
}

function openDesktopAuthInBrowser(url: string) {
  if (typeof window === 'undefined') return;

  const shell = window.eduRevShell as (typeof window.eduRevShell & DesktopAuthShellBridge) | undefined;
  if (shell?.openExternalAuth) {
    shell.openExternalAuth(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

async function resolveEmailFromLoginIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error('Enter your email or username.');
  }

  if (trimmed.includes('@')) {
    return normalizeEmail(trimmed);
  }

  const usernameLower = normalizeUsername(trimmed);
  const indexDoc = await getDoc(doc(db, 'usernameIndexes', usernameLower));

  if (!indexDoc.exists()) {
    throw new Error('No account was found for that username in the selected portal.');
  }

  const indexEntry = indexDoc.data() as Partial<UserProfile> & { email?: string };
  if (!indexEntry?.email) {
    throw new Error('That username exists, but the linked email is missing.');
  }

  return normalizeEmail(indexEntry.email);
}

export default function Auth() {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [authError, setAuthError] = useState<{ code?: string; message?: string } | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<StudentPortalType>(() => getStoredStudentPortal());
  const [usingDesktopBrowserFlow] = useState(() => isMacDesktopWrapper());
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signUpName, setSignUpName] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const appLogo = '/edurevlogoimage.png';

  useEffect(() => {
    let active = true;

    const finishPendingRedirect = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await getRedirectResult(auth);
        if (active && result?.user) {
          setAuthError(null);
          setIsLoggingIn(false);
        }
      } catch (error: any) {
        if (active && error?.code !== 'auth/no-auth-event') {
          console.error('Provider redirect completion failed:', error);
          setAuthError({ code: error?.code, message: error?.message });
          setIsLoggingIn(false);
        }
      }
    };

    finishPendingRedirect();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setStoredStudentPortal(selectedPortal);
  }, [selectedPortal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.pathname === '/auth' && url.searchParams.get('deleted') === '1') {
      url.searchParams.delete('deleted');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => bindNativeGoogleSignInBridge(auth, {
    onSuccess: () => {
      setIsLoggingIn(false);
      setAuthError(null);
    },
    onError: (message) => {
      setIsLoggingIn(false);
      setAuthError({ message });
    },
  }), []);

  const authErrorHint = useMemo(() => {
    if (authError?.code === 'auth/operation-not-allowed') {
      return 'Enable the relevant Firebase Authentication providers for this project: Apple, Google, Microsoft, Email/Password, and Anonymous guest access.';
    }

    if (authError?.code === 'auth/unauthorized-domain') {
      return 'This domain must be added to Firebase Authentication authorized domains.';
    }

    if (authError?.code === 'auth/email-already-in-use') {
      return 'That email already belongs to an account. Use sign in with the same email and password to enter either portal.';
    }

    if (authError?.code === 'permission-denied') {
      return 'The sign-in index is blocked by Firestore rules. Refresh after the latest deploy, or make sure Firestore rules were published.';
    }

    if (authError?.message?.includes('This account is linked to')) {
      return 'Use the matching provider button, or reset the password for that same email if you want password sign-in instead.';
    }

    if (authError?.code === 'auth/invalid-credential' || authError?.code === 'auth/wrong-password' || authError?.code === 'auth/user-not-found') {
      return 'Check the portal, email or username, and password, then try again.';
    }

    return 'If Google or Microsoft access pages fail inside a wrapped app, check that OAuth is allowed for your domain and authorized return URLs.';
  }, [authError]);

  const authErrorMessage = useMemo(() => {
    if (!authError) return '';

    if (authError.message && !authError.code) {
      return authError.message;
    }

    if (authError.code === 'auth/popup-closed-by-user' || authError.code === 'auth/cancelled-popup-request') {
      return 'Sign-in was cancelled. Choose Apple, Google, or Microsoft again to continue.';
    }

    if (authError.code === 'auth/operation-not-allowed') {
      return 'This sign-in method is not enabled yet.';
    }

    if (authError.code === 'auth/unauthorized-domain') {
      return 'This domain is not approved for sign-in yet.';
    }

    if (authError.message?.includes('This account is linked to')) {
      return authError.message;
    }

    if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password' || authError.code === 'auth/user-not-found') {
      return 'We could not sign in with that username or email and password. Check the details, or use Apple, Google, or Microsoft sign-in.';
    }

    return 'Sign-in could not be completed. Please try again.';
  }, [authError]);

  const handleProviderLogin = async (provider: AuthProvider) => {
    setAuthError(null);
    setIsLoggingIn(true);
    setStoredStudentPortal(selectedPortal);

    try {
      if (usingDesktopBrowserFlow) {
        const providerName = provider === appleProvider
          ? 'apple'
            : provider === microsoftProvider
              ? 'microsoft'
              : 'google';
        const desktopAuthUrl = `${CANONICAL_AUTH_ORIGIN}/auth/desktop-browser?provider=${providerName}&portal=${selectedPortal}&auto=1`;
        openDesktopAuthInBrowser(desktopAuthUrl);
        return;
      }

      if (provider === googleProvider && isNativeIosGoogleWrapper()) {
        requestNativeGoogleSignIn();
        return;
      }

      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Provider login failed:', error);
      setAuthError({ code: error?.code, message: error?.message });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordSignIn = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    setStoredStudentPortal(selectedPortal);

    try {
      if (!loginIdentifier.trim()) {
        throw new Error('Enter your username or email.');
      }

      if (!loginPassword) {
        throw new Error('Enter your password.');
      }

      const email = await resolveEmailFromLoginIdentifier(loginIdentifier);
      await signInWithEmailAndPassword(auth, email, loginPassword);
    } catch (error: any) {
      console.error('Password sign-in failed:', error);
      const code = error?.code;
      let message = error?.message || 'Sign-in could not be completed.';

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        try {
          const resolvedEmail = await resolveEmailFromLoginIdentifier(loginIdentifier);
          const signInMethods = await fetchSignInMethodsForEmail(auth, resolvedEmail);

          if (!signInMethods.includes('password') && signInMethods.length > 0) {
            const providerLabel = signInMethods.includes('google.com')
              ? 'Google'
              : signInMethods.includes('microsoft.com')
                ? 'Microsoft'
                : 'another sign-in provider';
            message = `This account is linked to ${providerLabel}. Use that sign-in button, or reset the password if you want email sign-in for this account.`;
          }
        } catch {
          // Ignore secondary lookup failures and keep the default credential message.
        }
      }

      setAuthError({ code, message });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateAccount = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    setStoredStudentPortal(selectedPortal);

    try {
      const displayName = signUpName.trim();
      const username = signUpUsername.trim();
      const usernameLower = normalizeUsername(username);
      const email = normalizeEmail(signUpEmail);
      const password = signUpPassword;

      if (!displayName) {
        throw new Error('Enter your name.');
      }

      if (usernameLower.length < 3) {
        throw new Error('Choose a username with at least 3 characters.');
      }

      if (!/^[a-z0-9._-]+$/.test(usernameLower)) {
        throw new Error('Use only letters, numbers, dots, underscores, or hyphens in the username.');
      }

      if (!email) {
        throw new Error('Enter your email address.');
      }

      if (password.length < 6) {
        throw new Error('Use a password with at least 6 characters.');
      }

      const usernameIndexRef = doc(db, 'usernameIndexes', usernameLower);
      const usernameCheck = await getDoc(usernameIndexRef);
      const existingUsernameEntry = usernameCheck.exists()
        ? (usernameCheck.data() as { uid?: string; email?: string })
        : null;
      if (existingUsernameEntry && normalizeEmail(existingUsernameEntry.email || '') !== email) {
        throw new Error('That username is already taken in this portal.');
      }

      let credential;
      let createdNewAuthUser = false;
      try {
        credential = await createUserWithEmailAndPassword(auth, email, password);
        createdNewAuthUser = true;
      } catch (createError: any) {
        if (createError?.code !== 'auth/email-already-in-use') {
          throw createError;
        }

        credential = await signInWithEmailAndPassword(auth, email, password);
      }

      try {
        await updateProfile(credential.user, { displayName });

        const createdAt = new Date().toISOString();
        const nextProfile: UserProfile = {
          uid: credential.user.uid,
          email,
          displayName,
          photoURL: '',
          role: 'student',
          createdAt,
          accountType: 'member',
          aiAccessEnabled: true,
          username,
          usernameLower,
          pronouns: 'prefer-not-to-say',
          gradeLevel: '',
          schoolName: '',
          institutionName: '',
          universityStudyLevel: '',
          degreeProgram: '',
          secondDegreeProgram: '',
          majors: [],
          minors: [],
          studentNumber: '',
        };

        await setDoc(doc(db, 'users', credential.user.uid), nextProfile, { merge: true });
        await setDoc(usernameIndexRef, {
          uid: credential.user.uid,
          email,
          username,
          usernameLower,
          portal: selectedPortal,
          createdAt,
        }, { merge: true });
      } catch (innerError) {
        if (createdNewAuthUser) {
          try {
            await deleteUser(credential.user);
          } catch {
            // Ignore rollback failure.
          }
        }
        throw innerError;
      }
    } catch (error: any) {
      console.error('Account creation failed:', error);
      setAuthError({ code: error?.code, message: error?.message || 'Account creation failed.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestAccess = async () => {
    setAuthError(null);
    setIsLoggingIn(true);
    setStoredStudentPortal(selectedPortal);

    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error('Guest sign-in failed:', error);
      setAuthError({ code: error?.code, message: error?.message || 'Guest access failed.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const portalTitle = selectedPortal === 'university' ? 'University student sign in' : 'High school student sign in';
  const portalBody = selectedPortal === 'university'
    ? 'Open the university portal for workspace structure, dashboards, notes, research, and university-specific planning tools.'
    : 'Open the high school portal for dashboard planning, notes, games, progress tracking, and study tools.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f4f7fb_100%)] p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl rounded-[36px] border border-white/70 bg-white/92 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8"
      >
        <div className="rounded-[32px] border border-zinc-200/80 bg-white px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-transparent">
              <img src={appLogo} alt={`${APP_BRAND_NAME} logo`} className="h-full w-full object-contain" />
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-zinc-950 sm:text-[2.8rem]">
              {APP_BRAND_NAME}
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-zinc-500 sm:text-lg">
              Choose an education level portal, then sign in to the matching workspace.
            </p>
          </div>

          <div className="mt-8 rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
                <img src={appLogo} alt={`${APP_BRAND_NAME} logo`} className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Student Portal</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPortal('highschool');
                      setStoredStudentPortal('highschool');
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                      selectedPortal === 'highschool'
                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-200/70'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.18em] opacity-80">High School</span>
                    <span className="mt-1 block text-base">High school students</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPortal('university');
                      setStoredStudentPortal('university');
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
                      selectedPortal === 'university'
                        ? 'border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-200/70'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.18em] opacity-80">University</span>
                    <span className="mt-1 block text-base">University students</span>
                  </button>
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-zinc-950">{portalTitle}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">{portalBody}</p>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Account access</p>
                      <div className="inline-flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
                        <button
                          type="button"
                          onClick={() => setAuthMode('signin')}
                          className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.15em] transition ${
                            authMode === 'signin' ? 'bg-zinc-950 text-white' : 'text-zinc-500'
                          }`}
                        >
                          Sign in
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode('signup')}
                          className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.15em] transition ${
                            authMode === 'signup' ? 'bg-zinc-950 text-white' : 'text-zinc-500'
                          }`}
                        >
                          Create account
                        </button>
                      </div>
                    </div>

                    {authMode === 'signin' ? (
                      <div className="mt-4 space-y-3">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Username or email</span>
                          <input
                            type="text"
                            value={loginIdentifier}
                            onChange={(event) => setLoginIdentifier(event.target.value)}
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                            placeholder="Enter your username or email"
                            autoComplete="username"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Password</span>
                          <div className="relative">
                            <input
                              type={showLoginPassword ? 'text' : 'password'}
                              value={loginPassword}
                              onChange={(event) => setLoginPassword(event.target.value)}
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                              placeholder="Enter your password"
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowLoginPassword((current) => !current)}
                              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-zinc-400 transition hover:text-zinc-700"
                              aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                            >
                              {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={handlePasswordSignIn}
                          disabled={isLoggingIn}
                          className="w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isLoggingIn ? 'Signing in…' : 'Sign in with password'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Your name</span>
                          <input
                            type="text"
                            value={signUpName}
                            onChange={(event) => setSignUpName(event.target.value)}
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                            placeholder="Enter your name"
                            autoComplete="name"
                          />
                        </label>
                        <div className="grid gap-3">
                          <label className="block">
                            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Username</span>
                            <input
                              type="text"
                              value={signUpUsername}
                              onChange={(event) => setSignUpUsername(event.target.value)}
                              className="w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                              placeholder="Choose a username"
                              autoComplete="username"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Email</span>
                            <input
                              type="email"
                              value={signUpEmail}
                              onChange={(event) => setSignUpEmail(event.target.value)}
                              className="w-full min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                              placeholder="Enter your email"
                              autoComplete="email"
                            />
                          </label>
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Password</span>
                          <div className="relative">
                            <input
                              type={showSignUpPassword ? 'text' : 'password'}
                              value={signUpPassword}
                              onChange={(event) => setSignUpPassword(event.target.value)}
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-12 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400"
                              placeholder="Create a password"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignUpPassword((current) => !current)}
                              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-zinc-400 transition hover:text-zinc-700"
                              aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                            >
                              {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={handleCreateAccount}
                          disabled={isLoggingIn}
                          className="w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isLoggingIn ? 'Creating account…' : 'Create account'}
                        </button>
                      </div>
                    )}

                    <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs font-semibold leading-6 text-zinc-500">
                      You can sign in with a username or email after your account is created.
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Quick sign-in</p>
                      <div className="mt-4 space-y-3">
                        <button
                          onClick={() => handleProviderLogin(appleProvider)}
                          disabled={isLoggingIn}
                          aria-label="Continue with Apple"
                          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-black bg-black px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-zinc-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <span className="text-[18px] leading-none" aria-hidden="true"></span>
                          <span>{isLoggingIn ? 'Continuing…' : 'Continue with Apple'}</span>
                        </button>

                        <button
                          onClick={() => handleProviderLogin(googleProvider)}
                          disabled={isLoggingIn}
                          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="h-5 w-5" alt="Google" />
                          {isLoggingIn ? 'Continuing…' : 'Continue with Google'}
                        </button>

                        <button
                          onClick={() => handleProviderLogin(microsoftProvider)}
                          disabled={isLoggingIn}
                          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" className="h-5 w-5" alt="Microsoft" />
                          {isLoggingIn ? 'Continuing…' : 'Continue with Microsoft'}
                        </button>
                      </div>
                      {usingDesktopBrowserFlow ? (
                        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 text-left">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Mac App Sign-In</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-indigo-900">
                            Continue with Apple, Google, or Microsoft in your browser, then return to the app automatically.
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Guest profile</p>
                      <p className="mt-3 text-sm font-semibold leading-6 text-amber-950">
                        Guest mode lets students explore the portal, but AI features stay locked until they create an account or sign in.
                      </p>
                      <button
                        type="button"
                        onClick={handleGuestAccess}
                        disabled={isLoggingIn}
                        className="mt-4 w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isLoggingIn ? 'Opening guest mode…' : 'Continue as guest'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {authError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm">
            <p className="font-black text-rose-800">Sign-in failed</p>
            <p className="mt-1 font-semibold text-rose-700">{authErrorMessage}</p>
            <p className="mt-2 text-xs font-bold text-rose-700/80">{authErrorHint}</p>
          </div>
        ) : null}

        <div className="mt-4 text-center text-xs font-medium text-zinc-400">
          By continuing, you agree to our{' '}
          <a className="font-bold text-zinc-500 underline underline-offset-4 hover:text-zinc-800" href="/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </a>{' '}
          and{' '}
          <a className="font-bold text-zinc-500 underline underline-offset-4 hover:text-zinc-800" href="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          .
        </div>
      </motion.div>
    </div>
  );
}
