import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, Minimize2, PanelBottomOpen, PhoneOff, Video } from 'lucide-react';
import { auth } from '../firebase';
import EmbeddedJitsiRoom from './EmbeddedJitsiRoom';
import {
  clearActiveUniversityMeeting,
  getUniversityJitsiProvisioningMessage,
  getMeetingCountdown,
  isUniversityJitsiProvisioned,
  readActiveUniversityMeeting,
  subscribeActiveUniversityMeeting,
  type ActiveUniversityMeeting,
} from '../lib/university-meetings';

export default function UniversityMeetingDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMeeting, setActiveMeeting] = useState<ActiveUniversityMeeting | null>(() => readActiveUniversityMeeting());
  const [expanded, setExpanded] = useState(false);
  const jitsiProvisioned = isUniversityJitsiProvisioned();

  useEffect(() => subscribeActiveUniversityMeeting(setActiveMeeting), []);

  useEffect(() => {
    const openMeetingHandler = (event: Event) => {
      const custom = event as CustomEvent<{ meetingId?: string }>;
      if (custom.detail?.meetingId) {
        setExpanded(true);
      }
    };
    window.addEventListener('edurev-open-meeting', openMeetingHandler as EventListener);
    return () => window.removeEventListener('edurev-open-meeting', openMeetingHandler as EventListener);
  }, []);

  if (!activeMeeting) return null;

  const isMeetingRoomPage = location.pathname === '/uni/meeting-room-uni';
  const countdown = getMeetingCountdown(activeMeeting.when);

  if (isMeetingRoomPage) {
    return (
      <div className="fixed bottom-4 right-4 z-40 rounded-full border border-emerald-200 bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Video className="h-4 w-4 text-emerald-600" />
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-zinc-900">{activeMeeting.title}</p>
            <p className="text-xs font-semibold text-zinc-500">{countdown?.label || 'Meeting active'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(380px,calc(100vw-1.5rem))] rounded-[28px] border border-white/70 bg-white/94 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-emerald-600" />
            <p className="truncate text-sm font-black text-zinc-900">{activeMeeting.title}</p>
          </div>
          <p className="mt-1 text-xs font-semibold text-zinc-500">
            {countdown?.label || 'Meeting active in university workspace'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/uni/meeting-room-uni')}
            className="rounded-full bg-zinc-100 p-2 text-zinc-600 transition hover:bg-zinc-200"
            aria-label="Open meeting room page"
          >
            <PanelBottomOpen className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExpanded((current) => !current)}
            className="rounded-full bg-zinc-100 p-2 text-zinc-600 transition hover:bg-zinc-200"
            aria-label={expanded ? 'Collapse meeting dock' : 'Expand meeting dock'}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => clearActiveUniversityMeeting()}
            className="rounded-full bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
            aria-label="End active meeting"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="px-4 pb-4">
          {activeMeeting.provider === 'jitsi' && activeMeeting.roomName && jitsiProvisioned ? (
            <EmbeddedJitsiRoom
              roomName={activeMeeting.roomName}
              displayName={auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'University student'}
              email={auth.currentUser?.email || undefined}
              meetingTitle={activeMeeting.title}
              moderator={Boolean(activeMeeting.moderator)}
              className="h-[260px] w-full rounded-[22px]"
            />
          ) : activeMeeting.provider === 'jitsi' && !jitsiProvisioned ? (
            <div className="flex h-[260px] w-full items-center justify-center rounded-[22px] border border-amber-200 bg-amber-50 px-5 text-center text-sm font-semibold leading-7 text-amber-900">
              {getUniversityJitsiProvisioningMessage()}
            </div>
          ) : (
            <iframe
              title={activeMeeting.title}
              src={activeMeeting.joinUrl}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              className="h-[260px] w-full rounded-[22px] border border-zinc-200 bg-zinc-950"
            />
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              onClick={() => navigate('/uni/meeting-room-uni')}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-black text-white transition hover:bg-zinc-800"
            >
              Open meeting room
            </button>
            <a
              href={activeMeeting.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
            >
              <ExternalLink className="h-4 w-4" />
              Open externally
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
