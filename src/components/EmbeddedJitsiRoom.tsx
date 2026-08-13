import { useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../firebase';
import {
  buildUniversityJitsiRoomPath,
  getUniversityJitsiDomain,
  getUniversityJitsiExternalApiUrl,
  getUniversityJitsiJwtEndpoint,
  getUniversityJitsiProvisioningMessage,
  isUniversityJitsiProvisioned,
  loadUniversityMeetingConfig,
} from '../lib/university-meetings';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: any;
    __edurevJitsiScriptPromise?: Promise<void>;
  }
}

function loadJitsiScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve();
  }
  if (window.__edurevJitsiScriptPromise) {
    return window.__edurevJitsiScriptPromise;
  }

  window.__edurevJitsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-edurev-jitsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Jitsi embed script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = getUniversityJitsiExternalApiUrl();
    script.async = true;
    script.dataset.edurevJitsi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Jitsi embed script.'));
    document.body.appendChild(script);
  });

  return window.__edurevJitsiScriptPromise;
}

function grantJitsiIframePermissions(container: HTMLDivElement | null) {
  const iframe = container?.querySelector('iframe');
  if (!iframe) return;

  iframe.setAttribute(
    'allow',
    [
      'camera',
      'microphone',
      'display-capture',
      'fullscreen',
      'autoplay',
      'clipboard-read',
      'clipboard-write',
    ].join('; '),
  );
  iframe.setAttribute('allowfullscreen', 'true');
}

function watchJitsiIframePermissions(container: HTMLDivElement | null) {
  if (!container || typeof MutationObserver === 'undefined') {
    return null;
  }

  grantJitsiIframePermissions(container);

  const observer = new MutationObserver(() => {
    grantJitsiIframePermissions(container);
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
  });

  return observer;
}

type EmbeddedJitsiRoomProps = {
  roomName: string;
  displayName: string;
  email?: string;
  meetingTitle?: string;
  className?: string;
  moderator?: boolean;
};

export default function EmbeddedJitsiRoom({
  roomName,
  displayName,
  email,
  meetingTitle,
  className,
  moderator = false,
}: EmbeddedJitsiRoomProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<any>(null);
  const endingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isProvisioned, setIsProvisioned] = useState(() => isUniversityJitsiProvisioned());
  const [hasJoined, setHasJoined] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  const safeRoomName = useMemo(() => roomName.trim(), [roomName]);
  const fullRoomPath = useMemo(() => buildUniversityJitsiRoomPath(safeRoomName), [safeRoomName]);

  const resetRoomToJoinScreen = () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      apiRef.current?.dispose?.();
    } catch {
      // Ignore disposal failures from the cross-origin Jitsi iframe.
    }
    apiRef.current = null;
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    setHasJoined(false);
    setIsStarting(false);
    setSessionKey((current) => current + 1);
    window.setTimeout(() => {
      endingRef.current = false;
    }, 250);
  };

  useEffect(() => {
    let cancelled = false;
    loadUniversityMeetingConfig().then(() => {
      if (!cancelled) {
        setIsProvisioned(isUniversityJitsiProvisioned());
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function mountRoom() {
      if (!hasJoined) return;
      if (!safeRoomName || !containerRef.current) return;
      if (!isProvisioned) {
        setError(getUniversityJitsiProvisioningMessage());
        setHasJoined(false);
        setIsStarting(false);
        return;
      }

      try {
        setError(null);
        setIsStarting(true);
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          throw new Error('You need to be signed in to open the EducationRev meeting room.');
        }

        const jwtResponse = await fetch(getUniversityJitsiJwtEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            roomName: safeRoomName,
            displayName,
            email,
            moderator,
          }),
        });

        const jwtPayload = await jwtResponse.json().catch(() => ({}));
        if (!jwtResponse.ok || !jwtPayload?.token) {
          throw new Error(
            typeof jwtPayload?.error === 'string'
              ? jwtPayload.error
              : 'Unable to create a secure EducationRev meeting token.',
          );
        }

        await loadJitsiScript();
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;

        apiRef.current?.dispose?.();
        const iframePermissionObserver = watchJitsiIframePermissions(containerRef.current);

        const api = new window.JitsiMeetExternalAPI(getUniversityJitsiDomain(), {
          roomName: fullRoomPath,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          jwt: jwtPayload.token,
          userInfo: {
            displayName,
            email,
          },
          configOverwrite: {
            prejoinPageEnabled: false,
            prejoinConfig: {
              enabled: false,
            },
            enableWelcomePage: false,
            disableInitialGUM: false,
            disableModeratorIndicator: true,
            requireDisplayName: false,
            startWithAudioMuted: false,
            startWithVideoMuted: true,
            hideLobbyButton: true,
            disableLobby: true,
            disableDeepLinking: true,
            analytics: { disabled: true },
            toolbarButtons: [
              'microphone',
              'camera',
              'desktop',
              'fullscreen',
              'hangup',
              'chat',
              'participants-pane',
              'tileview',
              'settings',
              'raisehand',
            ],
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          },
        });

        api.addListener?.('videoConferenceJoined', () => {
          setIsStarting(false);
          try {
            api.executeCommand?.('displayName', displayName);
            if (meetingTitle) {
              api.executeCommand?.('subject', meetingTitle);
            }
          } catch {
            // Ignore command failures from public Jitsi instances.
          }
        });

        api.addListener?.('videoConferenceLeft', resetRoomToJoinScreen);
        api.addListener?.('readyToClose', resetRoomToJoinScreen);
        api.addListener?.('toolbarButtonClicked', (details: any) => {
          const key = typeof details === 'string' ? details : details?.key;
          if (key === 'hangup') {
            window.setTimeout(resetRoomToJoinScreen, 500);
          }
        });

        api.addListener?.('conferenceFailed', (details: any) => {
          const name = typeof details === 'string' ? details : details?.name;
          if (name === 'conference.connectionError.membersOnly') {
            setError('This room opened with a lobby restriction. Start a fresh in-app Jitsi room from Teamwork and join it again.');
          }
        });

        apiRef.current = api;
        grantJitsiIframePermissions(containerRef.current);
        window.setTimeout(() => iframePermissionObserver?.disconnect(), 2000);
        window.setTimeout(() => grantJitsiIframePermissions(containerRef.current), 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the Jitsi meeting room.');
        setHasJoined(false);
        setIsStarting(false);
      }
    }

    mountRoom();

    return () => {
      cancelled = true;
      apiRef.current?.dispose?.();
      apiRef.current = null;
    };
  }, [displayName, email, meetingTitle, safeRoomName, fullRoomPath, isProvisioned, moderator, hasJoined, sessionKey]);

  return (
    <div className={`relative block min-w-0 w-full ${className || ''}`}>
      {error ? (
        <div className="flex h-full items-center justify-center rounded-[26px] border border-amber-200 bg-amber-50 px-6 py-8 text-center text-sm font-semibold leading-7 text-amber-800">
          {error}
        </div>
      ) : null}
      {!error && !hasJoined ? (
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-[26px] border border-zinc-200 bg-zinc-950 px-6 py-8 text-center text-white">
          <div className="w-full max-w-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">In-app study room</p>
            <h3 className="mt-4 text-4xl font-black tracking-tight">{meetingTitle || 'Join meeting'}</h3>
            <p className="mt-4 text-sm font-semibold leading-6 text-zinc-400">
              Join the secure EducationRev Jitsi room with microphone and camera permissions enabled.
            </p>
            <div className="mt-7 rounded-[18px] bg-zinc-800 px-4 py-4 text-base font-black text-white">
              {displayName || 'University student'}
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsStarting(true);
                setHasJoined(true);
              }}
              className="mt-5 inline-flex w-full items-center justify-center rounded-[18px] bg-blue-500 px-5 py-4 text-base font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400"
            >
              {isStarting ? 'Opening meeting...' : 'Join in-app meeting'}
            </button>
          </div>
        </div>
      ) : null}
      <div
        key={sessionKey}
        ref={containerRef}
        className={error || !hasJoined ? 'hidden' : 'h-full w-full overflow-hidden rounded-[26px] border border-zinc-200 bg-zinc-950'}
      />
      {!error && hasJoined && isStarting ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-[26px] border border-zinc-200 bg-zinc-950 px-6 py-8 text-center text-white">
          <div>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
            <p className="mt-5 text-xl font-black">Opening EducationRev meeting</p>
            <p className="mt-2 text-sm font-semibold text-zinc-400">Preparing microphone and room access.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
