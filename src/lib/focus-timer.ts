export type FocusTimerMode = 'study' | 'break';

export interface FocusTimerState {
  active: boolean;
  mode: FocusTimerMode;
  totalSeconds: number;
  remainingSeconds: number;
  endAt: number | null;
  sessionId: string;
  completedSessionId: string | null;
}

const STORAGE_KEY = 'edurev-focus-timer';
const EVENT_NAME = 'edurev-focus-timer-change';

const defaultState = (): FocusTimerState => ({
  active: false,
  mode: 'study',
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  endAt: null,
  sessionId: crypto.randomUUID(),
  completedSessionId: null,
});

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getFocusTimerState(): FocusTimerState {
  if (!canUseStorage()) return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) } as FocusTimerState;
  } catch {
    return defaultState();
  }
}

export function setFocusTimerState(nextState: FocusTimerState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: nextState }));
}

export function computeRemainingSeconds(state: FocusTimerState, now = Date.now()) {
  if (!state.active || !state.endAt) return Math.max(0, state.remainingSeconds);
  return Math.max(0, Math.ceil((state.endAt - now) / 1000));
}

export function syncFocusTimer(now = Date.now()) {
  const current = getFocusTimerState();
  const remainingSeconds = computeRemainingSeconds(current, now);

  if (current.active && remainingSeconds <= 0) {
    const completed = {
      ...current,
      active: false,
      remainingSeconds: 0,
      endAt: null,
      completedSessionId: current.sessionId,
    };
    setFocusTimerState(completed);
    return { state: completed, completed: true };
  }

  if (remainingSeconds !== current.remainingSeconds) {
    const updated = { ...current, remainingSeconds };
    setFocusTimerState(updated);
    return { state: updated, completed: false };
  }

  return { state: current, completed: false };
}

export function startFocusTimer() {
  const current = getFocusTimerState();
  const remainingSeconds = computeRemainingSeconds(current);
  const next: FocusTimerState = {
    ...current,
    active: true,
    remainingSeconds,
    endAt: Date.now() + remainingSeconds * 1000,
  };
  setFocusTimerState(next);
  return next;
}

export function pauseFocusTimer() {
  const current = getFocusTimerState();
  const next: FocusTimerState = {
    ...current,
    active: false,
    remainingSeconds: computeRemainingSeconds(current),
    endAt: null,
  };
  setFocusTimerState(next);
  return next;
}

export function configureFocusTimer({
  mode,
  totalSeconds,
}: {
  mode: FocusTimerMode;
  totalSeconds: number;
}) {
  const next: FocusTimerState = {
    active: false,
    mode,
    totalSeconds,
    remainingSeconds: totalSeconds,
    endAt: null,
    sessionId: crypto.randomUUID(),
    completedSessionId: null,
  };
  setFocusTimerState(next);
  return next;
}

export function subscribeFocusTimer(listener: (state: FocusTimerState) => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<FocusTimerState>).detail;
    listener(detail ?? getFocusTimerState());
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      listener(getFocusTimerState());
    }
  };

  window.addEventListener(EVENT_NAME, onCustom);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(EVENT_NAME, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

export function formatFocusTimer(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (safe % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function playFocusTimerChime() {
  if (typeof window === 'undefined') return;

  const AudioContextCtor =
    window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const now = context.currentTime;
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

  const tones = [
    { frequency: 1046.5, start: 0, duration: 0.18 },
    { frequency: 1318.5, start: 0.14, duration: 0.22 },
    { frequency: 1568, start: 0.3, duration: 0.5 },
  ];

  tones.forEach((tone) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, now + tone.start);
    oscillator.connect(gain);
    oscillator.start(now + tone.start);
    oscillator.stop(now + tone.start + tone.duration);
  });

  setTimeout(() => {
    void context.close();
  }, 1800);
}

export function stopGlobalAmbientAudio() {
  if (typeof window === 'undefined') return;
  const currentAmbient = (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio;
  if (currentAmbient) {
    currentAmbient.pause();
    currentAmbient.currentTime = 0;
    delete (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio;
  }
}
