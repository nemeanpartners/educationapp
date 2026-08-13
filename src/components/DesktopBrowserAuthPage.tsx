import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  setPersistence,
  signInWithCredential,
  signInWithRedirect,
  type UserCredential,
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { appleProvider, auth, googleProvider, microsoftProvider } from '../firebase';
import { APP_BRAND_NAME } from '../lib/branding';
import { getStoredStudentPortal, setStoredStudentPortal, studentPortalHome, type StudentPortalType } from '../lib/portal';

type SupportedProvider = 'apple' | 'google' | 'microsoft';

function readPortal(value: string | null): StudentPortalType {
  return value === 'university' ? 'university' : 'highschool';
}

function readProvider(value: string | null): SupportedProvider {
  if (value === 'apple') return 'apple';
  return value === 'microsoft' ? 'microsoft' : 'google';
}

function encodePayload(payload: Record<string, string>) {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodePayload(payload: string) {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return JSON.parse(atob(padded)) as Record<string, string>;
}

function extractDesktopProviderPayload(result: UserCredential, provider: SupportedProvider) {
  if (provider === 'google') {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    const idToken = credential?.idToken || '';
    if (!accessToken && !idToken) {
      throw new Error('Google sign-in completed, but the app did not receive a usable credential.');
    }
    return { accessToken, idToken };
  }

  const credential = OAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || '';
  const idToken = credential?.idToken || '';
  if (!accessToken && !idToken) {
      throw new Error(`${provider === 'apple' ? 'Apple' : 'Microsoft'} sign-in completed, but the app did not receive a usable credential.`);
  }
  return { accessToken, idToken };
}

function buildAppReturnUrl(provider: SupportedProvider, portal: StudentPortalType, tokens: { accessToken: string; idToken: string }) {
  const payload = encodePayload({
    provider,
    portal,
    accessToken: tokens.accessToken || '',
    idToken: tokens.idToken || '',
  });
  return `edurevolutionai://auth-complete?payload=${encodeURIComponent(payload)}`;
}

export function DesktopBrowserAuthPage() {
  const [status, setStatus] = useState<'ready' | 'working' | 'returning' | 'error'>('ready');
  const [message, setMessage] = useState('Choose continue below to sign in with your saved browser account list.');
  const [redirectChecked, setRedirectChecked] = useState(false);
  const autoStartedRef = useRef(false);

  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const provider = readProvider(searchParams.get('provider'));
  const portal = readPortal(searchParams.get('portal'));
  const autoStart = searchParams.get('auto') === '1';
  const complete = searchParams.get('complete') === '1';
  const authState = searchParams.get('state')
    || window.sessionStorage.getItem('edurevDesktopAuthState')
    || 'default';
  const autoStartedKey = `edurevDesktopAuthAutoStarted:${authState}`;
  const returnedKey = `edurevDesktopAuthReturned:${authState}`;

  useEffect(() => {
    setStoredStudentPortal(portal);
  }, [portal, provider]);

  const handleBrowserLogin = useCallback(async () => {
    try {
      setStatus('working');
      setMessage(provider === 'apple' ? 'Opening Continue with Apple…' : provider === 'google' ? 'Opening your Google account chooser…' : 'Opening your Microsoft account chooser…');
      await setPersistence(auth, browserLocalPersistence);
      window.sessionStorage.setItem('edurevDesktopAuthProvider', provider);
      window.sessionStorage.setItem('edurevDesktopAuthPortal', portal);
      window.sessionStorage.setItem('edurevDesktopAuthState', authState);
      await signInWithRedirect(auth, provider === 'apple' ? appleProvider : provider === 'google' ? googleProvider : microsoftProvider);
    } catch (error: any) {
      console.error('Desktop browser auth failed:', error);
      setStatus('error');
      setMessage(error?.message || 'Sign-in could not be completed. Please close this page and try again.');
    }
  }, [authState, portal, provider]);

  useEffect(() => {
    if (complete) {
      setStatus('returning');
      setMessage(`Sign-in was sent to ${APP_BRAND_NAME}. You can close this browser tab.`);
      return;
    }

    let active = true;

    const finishRedirect = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await getRedirectResult(auth);
        if (!active) return;
        if (!result?.user) {
          setRedirectChecked(true);
          return;
        }

        const storedProvider = readProvider(window.sessionStorage.getItem('edurevDesktopAuthProvider'));
        const storedPortal = readPortal(window.sessionStorage.getItem('edurevDesktopAuthPortal'));
        const storedState = window.sessionStorage.getItem('edurevDesktopAuthState') || authState;
        const tokens = extractDesktopProviderPayload(result, storedProvider);
        const returnUrl = buildAppReturnUrl(storedProvider, storedPortal, tokens);
        const storedReturnedKey = `edurevDesktopAuthReturned:${storedState}`;

        if (window.sessionStorage.getItem(storedReturnedKey) === '1') {
          setStatus('returning');
          setMessage(`Sign-in was already sent to ${APP_BRAND_NAME}. You can close this browser tab.`);
          return;
        }

        window.sessionStorage.setItem(storedReturnedKey, '1');
        window.sessionStorage.removeItem('edurevDesktopAuthProvider');
        window.sessionStorage.removeItem('edurevDesktopAuthPortal');
        window.sessionStorage.removeItem('edurevDesktopAuthState');
        window.history.replaceState(
          {},
          '',
          `/auth/desktop-browser?complete=1&provider=${storedProvider}&portal=${storedPortal}&state=${encodeURIComponent(storedState)}`,
        );
        setStatus('returning');
        setMessage(`Sign-in complete. Choose Open ${APP_BRAND_NAME} if your browser asks. This page will not try again.`);
        window.setTimeout(() => {
          window.location.href = returnUrl;
        }, 100);
        window.setTimeout(() => {
          setMessage(`Sign-in was sent to ${APP_BRAND_NAME}. You can close this browser tab.`);
          window.close();
        }, 1400);
      } catch (error: any) {
        if (!active || error?.code === 'auth/no-auth-event') return;
        console.error('Desktop browser redirect completion failed:', error);
        setStatus('error');
        setMessage(error?.message || 'Sign-in could not be completed. Please close this page and try again.');
      } finally {
        if (active) {
          setRedirectChecked(true);
        }
      }
    };

    finishRedirect();

    return () => {
      active = false;
    };
  }, [authState, complete]);

  useEffect(() => {
    if (!redirectChecked) return;
    if (status === 'error' || status === 'returning') return;
    if (complete || !autoStart || autoStartedRef.current) return;
    if (window.sessionStorage.getItem('edurevDesktopAuthProvider')) return;
    if (window.sessionStorage.getItem(returnedKey) === '1') {
      setStatus('returning');
      setMessage(`Sign-in was already sent to ${APP_BRAND_NAME}. You can close this browser tab.`);
      return;
    }
    if (window.sessionStorage.getItem(autoStartedKey) === '1') {
      setMessage('The browser sign-in was already started. Finish the Google page already open, or click continue again if you cancelled it.');
      return;
    }

    autoStartedRef.current = true;
    window.sessionStorage.setItem(autoStartedKey, '1');
    const timer = window.setTimeout(() => {
      handleBrowserLogin();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [autoStart, autoStartedKey, complete, handleBrowserLogin, redirectChecked, returnedKey, status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f4f7fb_100%)] px-6 py-12 font-sans">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-zinc-400">Browser Sign-In</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-950">
          {provider === 'apple' ? 'Continue with Apple' : provider === 'google' ? 'Continue with Google' : 'Continue with Microsoft'}
        </h1>
        <p className="mt-4 text-lg font-medium leading-8 text-zinc-500">
          This secure sign-in runs in your default browser so you can use your saved accounts, then returns you to {APP_BRAND_NAME} automatically.
        </p>

        <div className="mt-8 rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-6">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">
            {status === 'error' ? 'Sign-In Error' : 'Current Step'}
          </p>
          <p className="mt-3 text-xl font-bold tracking-tight text-zinc-900">{message}</p>
          <p className="mt-4 text-sm font-medium leading-7 text-zinc-500">
            If {APP_BRAND_NAME} does not come back to the front automatically, reopen the app after completing sign-in here.
          </p>
          <button
            type="button"
            onClick={handleBrowserLogin}
            disabled={status === 'working' || status === 'returning'}
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200/70 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'working'
              ? 'Opening…'
              : provider === 'apple'
                ? 'Continue with Apple'
                : provider === 'google'
                  ? 'Continue with Google'
                  : 'Continue with Microsoft'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DesktopCompleteAuthPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState(`Finishing sign-in inside ${APP_BRAND_NAME}...`);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        const params = new URLSearchParams(window.location.search);
        const payloadParam = params.get('payload') || '';
        if (!payloadParam) {
          throw new Error('The sign-in return payload is missing.');
        }

        const payload = decodePayload(payloadParam);
        const provider = readProvider(payload.provider || null);
        const portal = readPortal(payload.portal || null);
        const accessToken = String(payload.accessToken || '');
        const idToken = String(payload.idToken || '');

        let credential;
        if (provider === 'google') {
          credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
        } else {
          credential = new OAuthProvider(provider === 'apple' ? 'apple.com' : 'microsoft.com').credential({
            idToken: idToken || undefined,
            accessToken: accessToken || undefined,
          });
        }

        if (!credential) {
          throw new Error('The sign-in credential could not be reconstructed inside the app.');
        }

        setStoredStudentPortal(portal);
        await signInWithCredential(auth, credential);
        setMessage('Signed in. Returning you to your portal…');
        navigate(studentPortalHome(portal), { replace: true });
      } catch (error: any) {
        console.error('Desktop wrapper sign-in completion failed:', error);
        setErrorMessage(error?.message || `${APP_BRAND_NAME} could not finish the sign-in return.`);
      }
    };

    run();
  }, [navigate]);

  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f4f7fb_100%)] px-6 py-12 font-sans">
        <div className="w-full max-w-2xl rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-rose-400">Return Failed</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-950">{APP_BRAND_NAME} could not finish sign-in</h1>
          <p className="mt-4 text-lg font-medium leading-8 text-zinc-500">{errorMessage}</p>
          <button
            type="button"
            onClick={() => navigate('/auth', { replace: true })}
            className="mt-8 inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200/70 transition hover:bg-indigo-500"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f4f7fb_100%)] px-6 py-12 font-sans">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/80 bg-white/92 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-zinc-400">Returning To App</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-zinc-950">Finishing your sign-in</h1>
        <p className="mt-4 text-lg font-medium leading-8 text-zinc-500">{message}</p>
      </div>
    </div>
  );
}
