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
  const [error, setError] = useState<string | null>(null);
  const [isProvisioned, setIsProvisioned] = useState(() => isUniversityJitsiProvisioned());

  const safeRoomName = useMemo(() => roomName.trim(), [roomName]);
  const fullRoomPath = useMemo(() => buildUniversityJitsiRoomPath(safeRoomName), [safeRoomName]);

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
      if (!safeRoomName || !containerRef.current) return;
      if (!isProvisioned) {
        setError(getUniversityJitsiProvisioningMessage());
        return;
      }

      try {
        setError(null);
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
            enableWelcomePage: false,
            disableInitialGUM: true,
            disableModeratorIndicator: true,
            requireDisplayName: false,
            startWithAudioMuted: true,
            startWithVideoMuted: true,
            startSilent: true,
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
          try {
            api.executeCommand?.('displayName', displayName);
            if (meetingTitle) {
              api.executeCommand?.('subject', meetingTitle);
            }
          } catch {
            // Ignore command failures from public Jitsi instances.
          }
        });

        api.addListener?.('conferenceFailed', (details: any) => {
          const name = typeof details === 'string' ? details : details?.name;
          if (name === 'conference.connectionError.membersOnly') {
            setError('This room opened with a lobby restriction. Start a fresh in-app Jitsi room from Teamwork and join it again.');
          }
        });

        apiRef.current = api;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the Jitsi meeting room.');
      }
    }

    mountRoom();

    return () => {
      cancelled = true;
      apiRef.current?.dispose?.();
      apiRef.current = null;
    };
  }, [displayName, email, meetingTitle, safeRoomName, fullRoomPath, isProvisioned, moderator]);

  return (
    <div className={`block min-w-0 w-full ${className || ''}`}>
      {error ? (
        <div className="flex h-full items-center justify-center rounded-[26px] border border-amber-200 bg-amber-50 px-6 py-8 text-center text-sm font-semibold leading-7 text-amber-800">
          {error}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={error ? 'hidden' : 'h-full w-full overflow-hidden rounded-[26px] border border-zinc-200 bg-zinc-950'}
      />
    </div>
  );
}
