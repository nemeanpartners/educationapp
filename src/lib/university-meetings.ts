export type UniversityMeetingProvider = 'jitsi' | 'zoom';

export type UniversityMeetingContext = 'class' | 'study' | 'assignment' | 'teamwork';

export type MeetingChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type UniversityMeeting = {
  id: string;
  title: string;
  when: string;
  notes: string;
  agenda?: string;
  checklist?: MeetingChecklistItem[];
  minutes?: string;
  decisions?: string;
  provider: UniversityMeetingProvider;
  roomName?: string;
  roomContext?: UniversityMeetingContext;
  classId?: string;
  assignmentId?: string;
  projectId?: string;
  participantUserIds?: string[];
  participantEmails?: string[];
  joinUrl?: string;
  status?: 'scheduled' | 'live' | 'ended';
  startedAt?: string;
  endedAt?: string;
  createdBy?: string;
  aiExecutiveSummary?: string;
  aiStructuredNotes?: string;
  aiKeyTakeaways?: string[];
  aiDecisions?: string[];
  aiActionItems?: {
    task: string;
    owner: string;
    deadline: string;
  }[];
  aiBlockers?: string[];
  aiFollowUpEmail?: string;
  aiGeneratedAt?: string;
};

export type ActiveUniversityMeeting = {
  meetingId: string;
  projectId?: string;
  title: string;
  provider: UniversityMeetingProvider;
  roomName?: string;
  joinUrl: string;
  when?: string;
  agenda?: string;
  moderator?: boolean;
};

const ACTIVE_UNI_MEETING_KEY = 'edurev-uni-active-meeting';
const ACTIVE_UNI_MEETING_EVENT = 'edurev-uni-active-meeting-changed';

export function getUniversityJitsiAppId() {
  return (import.meta.env.VITE_UNI_JITSI_APP_ID || '').trim();
}

export function getUniversityJitsiDomain() {
  return (import.meta.env.VITE_UNI_JITSI_DOMAIN || '').trim();
}

export function getUniversityJitsiExternalApiUrl() {
  const explicit = (import.meta.env.VITE_UNI_JITSI_EXTERNAL_API_URL || '').trim();
  if (explicit) {
    return explicit;
  }
  const domain = getUniversityJitsiDomain();
  const appId = getUniversityJitsiAppId();
  if (!domain || !appId) return '';
  return `https://${domain}/${appId}/external_api.js`;
}

export function getUniversityJitsiRoomPrefix() {
  return (import.meta.env.VITE_UNI_JITSI_ROOM_PREFIX || '').trim();
}

export function getUniversityJitsiJwtEndpoint() {
  return (import.meta.env.VITE_UNI_JITSI_JWT_ENDPOINT || '').trim();
}

export function buildUniversityJitsiRoomPath(rawRoomName: string) {
  const appId = getUniversityJitsiAppId();
  const safeRoom = rawRoomName.trim().replace(/^\/+|\/+$/g, '');
  if (!appId || !safeRoom) return safeRoom;
  return `${appId}/${safeRoom}`;
}

export function isUniversityJitsiProvisioned() {
  const appId = getUniversityJitsiAppId();
  const domain = getUniversityJitsiDomain();
  const externalApiUrl = getUniversityJitsiExternalApiUrl();
  const roomPrefix = getUniversityJitsiRoomPrefix();
  const jwtEndpoint = getUniversityJitsiJwtEndpoint();

  return Boolean(appId && domain && externalApiUrl && roomPrefix && jwtEndpoint);
}

export function getUniversityJitsiProvisioningMessage() {
  return 'In-app EducationRev meetings are temporarily unavailable.';
}

export function generateUniversityMeetingRoomName(params: {
  context: UniversityMeetingContext;
  userId?: string;
  classId?: string;
  assignmentId?: string;
  projectId?: string;
  timestamp?: number;
}) {
  const stamp = params.timestamp ?? Date.now();
  if (params.context === 'class' && params.classId) {
    return `edurev-class-${params.classId}`;
  }
  if (params.context === 'assignment' && params.assignmentId) {
    return `edurev-assignment-${params.assignmentId}`;
  }
  if (params.context === 'teamwork' && params.projectId) {
    return `edurev-studygroup-${params.projectId}-${stamp}`;
  }
  return `edurev-study-${params.userId || 'guest'}-${stamp}`;
}

export function buildJitsiMeetingUrl(roomName: string) {
  const roomPath = buildUniversityJitsiRoomPath(roomName);
  const safeRoom = encodeURIComponent(roomPath);
  const domain = getUniversityJitsiDomain() || 'meet.jit.si';
  return `https://${domain}/${safeRoom}#config.prejoinPageEnabled=false&config.enableWelcomePage=false&config.startWithAudioMuted=false&config.startWithVideoMuted=true&config.disableModeratorIndicator=true&config.requireDisplayName=false&config.analytics.disabled=true&interfaceConfig.SHOW_JITSI_WATERMARK=false`;
}

export function parseMeetingTime(value?: string) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function getMeetingCountdown(when?: string) {
  const target = parseMeetingTime(when);
  if (!target) return null;
  const diffMs = target - Date.now();
  if (diffMs <= -60_000) return null;
  if (diffMs <= 0) {
    return {
      isSoon: true,
      isLiveWindow: true,
      label: 'Starting now',
      diffMs,
    };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    isSoon: diffMs <= 120_000,
    isLiveWindow: false,
    label: minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')} until start` : `${seconds}s until start`,
    diffMs,
  };
}

function notifyActiveMeetingChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACTIVE_UNI_MEETING_EVENT));
}

export function readActiveUniversityMeeting(): ActiveUniversityMeeting | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_UNI_MEETING_KEY);
    return raw ? (JSON.parse(raw) as ActiveUniversityMeeting) : null;
  } catch {
    return null;
  }
}

export function writeActiveUniversityMeeting(meeting: ActiveUniversityMeeting) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_UNI_MEETING_KEY, JSON.stringify(meeting));
  notifyActiveMeetingChanged();
}

export function clearActiveUniversityMeeting() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_UNI_MEETING_KEY);
  notifyActiveMeetingChanged();
}

export function subscribeActiveUniversityMeeting(callback: (meeting: ActiveUniversityMeeting | null) => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(readActiveUniversityMeeting());
  const storageHandler = (event: StorageEvent) => {
    if (event.key === ACTIVE_UNI_MEETING_KEY) {
      callback(readActiveUniversityMeeting());
    }
  };
  window.addEventListener(ACTIVE_UNI_MEETING_EVENT, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(ACTIVE_UNI_MEETING_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}
