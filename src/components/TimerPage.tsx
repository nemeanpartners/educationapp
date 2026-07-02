import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Smile, CloudRain, Meh, AlertTriangle, Frown, Angry, Music, CupSoda, Gamepad2, ScrollText, Cookie, Snowflake, Star, GlassWater, Boxes, Image as ImageIcon, Headphones, ExternalLink, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { auth, db } from '../firebase';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from '@/lib/portal-firestore';
import { BACKGROUND_PRESETS } from '../lib/backgrounds';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { useLocation } from 'react-router-dom';
import { detectStudentPortalFromPath } from '@/lib/portal';

type TimerMode = 'Pomodoro' | 'Short Break' | 'Long Break' | 'One Minute';
type Mood = 'Happy' | 'Calm' | 'Neutral' | 'Anxious' | 'Sad' | 'Angry';
type TimerVisual = 'ice' | 'stars' | 'glass' | 'shapes';

const MODES = {
  Pomodoro: 25 * 60,
  'Short Break': 5 * 60,
  'Long Break': 15 * 60,
  'One Minute': 60,
};

const MOODS: { name: Mood; icon: any }[] = [
  { name: 'Happy', icon: Smile },
  { name: 'Calm', icon: CloudRain },
  { name: 'Neutral', icon: Meh },
  { name: 'Anxious', icon: AlertTriangle },
  { name: 'Sad', icon: Frown },
  { name: 'Angry', icon: Angry },
];

const MOOD_RING_COLORS: Record<Mood, string> = {
  Happy: '#f59e0b',
  Calm: '#22c55e',
  Neutral: '#ffffff',
  Anxious: '#f97316',
  Sad: '#60a5fa',
  Angry: '#ef4444',
};

const REWARDS = [
  { id: 'coffee', label: 'Coffee Break', icon: CupSoda, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'scroll', label: 'Scroll Time', icon: ScrollText, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'game', label: 'Quick Game', icon: Gamepad2, tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'sweet', label: 'Sweet Treat', icon: Cookie, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const TIMER_VISUALS: { id: TimerVisual; label: string; description: string; icon: any; tone: string }[] = [
  { id: 'ice', label: 'Ice melts', description: 'Keep the current ice-melt reward menu.', icon: Snowflake, tone: 'border-cyan-200 bg-cyan-50/70 text-cyan-700' },
  { id: 'stars', label: 'Shooting star', description: 'A star traces a maze until time runs out.', icon: Star, tone: 'border-indigo-200 bg-indigo-50/70 text-indigo-700' },
  { id: 'glass', label: 'Fill the glass', description: 'Placeholder cup fills with rewards over time.', icon: GlassWater, tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-700' },
  { id: 'shapes', label: '3D shapes', description: 'Placeholder blocks fall like Tetris as focus builds.', icon: Boxes, tone: 'border-fuchsia-200 bg-fuchsia-50/70 text-fuchsia-700' },
];

const AMBIENT_SOUND_OPTIONS = [
  { id: 'rain-library', label: 'Rain Library', description: 'Soft rain with calm room tone', file: '/rain.mp3' },
  { id: 'night-cafe', label: 'Night Cafe', description: 'Low cafe ambience for longer blocks', file: '/Cafe Restaurant Ambience.mp3' },
  { id: 'ocean-breeze', label: 'Ocean Breeze', description: 'Wide soft ambience for reset breaks', file: '/Ocean waves.mp3' },
  { id: 'lofi-focus', label: 'Lo-fi Focus', description: 'Gentle instrumental study texture', file: '/Pure Focus.mp3' },
  { id: 'night-jazz', label: 'Night Jazz', description: 'Aesthetic late-night jazz for slower revision blocks', file: '/Aesthetic Night Jazz.mp3' },
  { id: 'calming', label: 'Calming', description: 'Soft calming loop for quiet review sessions', file: '/Calming.mp3' },
] as const;

function stopGlobalAmbientAudio() {
  if (typeof window === 'undefined') return;
  const currentAmbient = (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio;
  if (currentAmbient) {
    currentAmbient.pause();
    currentAmbient.currentTime = 0;
    delete (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio;
  }
}

export default function TimerPage() {
  const location = useLocation();
  const isUniversityPortal = detectStudentPortalFromPath(location.pathname) === 'university';
  const { isPhone, isDesktop } = useResponsiveDevice();
  const [mode, setMode] = useState<TimerMode>('Pomodoro');
  const [timeLeft, setTimeLeft] = useState(MODES[mode]);
  const [isActive, setIsActive] = useState(false);
  const [selectedMood, setSelectedMood] = useState<Mood>('Calm');
  const [selectedReward, setSelectedReward] = useState(REWARDS[0].id);
  const [selectedVisual, setSelectedVisual] = useState<TimerVisual>('ice');
  const [sessionComplete, setSessionComplete] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [completionLogged, setCompletionLogged] = useState(false);
  const [selectedAmbientId, setSelectedAmbientId] = useState<(typeof AMBIENT_SOUND_OPTIONS)[number]['id']>('rain-library');
  const [playingAmbientId, setPlayingAmbientId] = useState<(typeof AMBIENT_SOUND_OPTIONS)[number]['id'] | null>(null);
  const [showAmbientMenu, setShowAmbientMenu] = useState(false);
  const [selectedWallpaperId, setSelectedWallpaperId] = useState(BACKGROUND_PRESETS[0]?.id || 'neon-soft-pillars');
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const [showVisualsMenu, setShowVisualsMenu] = useState(false);
  const sweetVideoUrl = '/rewards/icemeltingsweettreat.mp4';
  const iceCubeVideoUrl = '/rewards/icecube.mp4';
  const selectedAmbient = AMBIENT_SOUND_OPTIONS.find((option) => option.id === selectedAmbientId) || AMBIENT_SOUND_OPTIONS[0];
  const selectedWallpaper = BACKGROUND_PRESETS.find((preset) => preset.id === selectedWallpaperId) || BACKGROUND_PRESETS[0];
  const pageTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTimeLeft(MODES[mode]);
    setIsActive(false);
    setSessionComplete(false);
    setCompletionLogged(false);
  }, [mode]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      setSessionComplete(true);
      stopGlobalAmbientAudio();
      setPlayingAmbientId(null);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  useEffect(() => {
    return () => {
      stopGlobalAmbientAudio();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((MODES[mode] - timeLeft) / MODES[mode]) * 100;
  const meltProgress = Math.min(100, Math.max(0, progress));
  const selectedMoodRingColor = MOOD_RING_COLORS[selectedMood];
  useEffect(() => {
    const loadStreak = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, 'focusStreaks', user.uid));
      if (snap.exists()) {
        const data = snap.data() as { currentStreak?: number };
        setStreakCount(data.currentStreak || 0);
      }
    };
    loadStreak();
  }, []);


  const handleSessionComplete = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'focusSessions'), {
        userId: user.uid,
        durationMinutes: Math.round(MODES[mode] / 60),
        mode,
        rewardType: selectedReward,
        visualType: selectedVisual,
        startedAt: serverTimestamp(),
        endedAt: serverTimestamp(),
        completed: true,
      });

      const streakRef = doc(db, 'focusStreaks', user.uid);
      const streakSnap = await getDoc(streakRef);
      const today = new Date().toISOString().slice(0, 10);
      let nextStreak = 1;
      if (streakSnap.exists()) {
        const data = streakSnap.data() as { currentStreak?: number; lastCompleted?: string };
        if (data.lastCompleted === today) {
          nextStreak = data.currentStreak || 1;
        } else if (data.lastCompleted) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yStr = yesterday.toISOString().slice(0, 10);
          nextStreak = data.lastCompleted === yStr ? (data.currentStreak || 0) + 1 : 1;
        }
      }
      await setDoc(streakRef, { userId: user.uid, currentStreak: nextStreak, lastCompleted: today }, { merge: true });
      setStreakCount(nextStreak);
    } catch {
      // soft failure, do not block UI
    }
  };

  useEffect(() => {
    if (sessionComplete && !completionLogged) {
      handleSessionComplete();
      setCompletionLogged(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionComplete, completionLogged]);

  const stopAmbientSound = () => {
    stopGlobalAmbientAudio();
    setPlayingAmbientId(null);
  };

  const playAmbientSound = async (ambientId: (typeof AMBIENT_SOUND_OPTIONS)[number]['id']) => {
    stopGlobalAmbientAudio();
    const selectedOption = AMBIENT_SOUND_OPTIONS.find((option) => option.id === ambientId);
    if (!selectedOption || typeof window === 'undefined') return;

    const ambientAudio = new Audio(selectedOption.file);
    ambientAudio.loop = true;
    ambientAudio.preload = 'auto';
    ambientAudio.volume = 0.4;

    try {
      await ambientAudio.play();
      (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio = ambientAudio;
      setPlayingAmbientId(ambientId);
    } catch (error) {
      console.error('Ambient audio playback error:', error);
    }
  };

  const openWallpaperLibrary = () => {
    if (typeof window === 'undefined') return;
    window.open('/study-wallpapers', '_blank', 'noopener,noreferrer');
  };

  const handleWallpaperSelection = (presetId: string) => {
    setSelectedWallpaperId(presetId);
    setShowWallpaperMenu(false);
    if (isPhone) {
      requestAnimationFrame(() => {
        pageTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  return (
    <div
      ref={pageTopRef}
      className={cn(
        "relative isolate min-h-[calc(100vh-80px)] overflow-hidden bg-[#f4f5f7] sm:-m-8 sm:p-8 lg:p-12",
        isPhone ? "-mx-4 -my-8 px-4 py-6" : "-m-8 p-4"
      )}
    >
      <div className="pointer-events-none absolute left-[8%] top-24 h-44 w-44 rounded-full bg-sky-300/60 blur-3xl" />
      <div className="pointer-events-none absolute right-[10%] top-12 h-72 w-72 rounded-full bg-zinc-900/25 blur-[72px]" />
      <div className="pointer-events-none absolute bottom-20 left-[18%] h-48 w-48 rounded-full bg-amber-300/45 blur-[56px]" />
      <div className="pointer-events-none absolute bottom-10 right-[22%] h-40 w-72 rounded-full bg-violet-300/35 blur-[64px]" />
      <div className="pointer-events-none absolute left-[42%] top-[42%] h-56 w-56 rounded-[42%] bg-white/70 blur-2xl" />

      <div className={cn("relative mx-auto flex w-full max-w-6xl min-w-0 flex-col justify-center gap-5", !isPhone && "xl:flex-row xl:items-start")}>
      <div className={cn(
        "min-w-0 space-y-5 rounded-[2rem] border border-white/60 bg-white/35 shadow-[0_24px_80px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl",
        isPhone ? "w-full p-4" : "w-full max-w-xl p-6 sm:p-8"
      )}>
        <div className="text-center space-y-2">
          <h1 className={cn("font-black text-zinc-900 flex items-center justify-center gap-2", isPhone ? "text-2xl" : "text-3xl")}>
            <span className="text-indigo-600">⏱️</span> {isUniversityPortal ? 'Focus' : 'Focus Mode'}
          </h1>
          <p className={cn("text-zinc-600", isPhone ? "text-sm" : "text-base")}>
            {isUniversityPortal ? 'Structure deep-work sessions and stay locked into higher-value study blocks.' : 'Minimize distractions and get in the zone.'}
          </p>
        </div>

        <div className={cn(
          "rounded-[1.5rem] border border-white/55 bg-white/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl",
          isPhone ? "grid grid-cols-2 gap-1.5" : "flex"
        )}>
          {(['Pomodoro', 'Short Break', 'Long Break', 'One Minute'] as TimerMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-3 py-2 font-bold transition-all",
                isPhone ? "text-xs" : "flex-1 text-sm",
                mode === m
                  ? "bg-white/70 text-zinc-900 shadow-[0_8px_22px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl"
                  : "text-zinc-600 hover:bg-white/25 hover:text-zinc-900"
              )}
            >
              {m}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-[2rem] border border-white/55 bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
            isPhone ? "aspect-square min-h-0 p-3.5" : "min-h-[20rem] p-6"
          )}
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0.05)), url(${selectedWallpaper.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_40%)]" />
          <svg
            viewBox="0 0 320 320"
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform -rotate-90",
              isPhone ? "h-[17rem] w-[17rem]" : "h-64 w-64"
            )}
          >
            <circle
              cx="160"
              cy="160"
              r="132"
              stroke="currentColor"
              strokeWidth={isPhone ? 16 : 12}
              fill="transparent"
              className="text-white/60"
            />
            <motion.circle
              cx="160"
              cy="160"
              r="132"
              stroke={selectedMoodRingColor}
              strokeWidth={isPhone ? 16 : 12}
              fill="transparent"
              strokeDasharray={2 * Math.PI * 132}
              strokeDashoffset={2 * Math.PI * 132 * (1 - progress / 100)}
              strokeLinecap="round"
              initial={false}
              animate={{ strokeDashoffset: 2 * Math.PI * 132 * (1 - progress / 100) }}
            />
          </svg>
          <div className={cn("relative z-10 text-center", isPhone ? "max-w-[11.5rem]" : "")}>
            <div className={cn("font-mono font-bold text-zinc-900", isPhone ? "text-[3.3rem] leading-none" : "text-5xl")}>{formatTime(timeLeft)}</div>
            <div className={cn("font-medium text-zinc-600", isPhone ? "mt-1 text-sm" : "text-base")}>{mode}</div>
            <div className={cn("mt-5 flex items-center justify-center gap-3", isPhone ? "flex-row" : "flex-row")}>
              <button
                onClick={() => {
                  if (isActive) {
                    setIsActive(false);
                    stopAmbientSound();
                  } else {
                    setSessionComplete(false);
                    setIsActive(true);
                  }
                }}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-full border border-white/50 bg-white/85 font-bold text-zinc-900 shadow-[0_12px_30px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition-all hover:bg-white",
                  isPhone ? "px-5 py-2.5 text-base" : "px-6 py-3 text-sm"
                )}
              >
                {isActive ? <Pause size={18} /> : <Play size={18} />}
                {isActive ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => {
                  setIsActive(false);
                  setTimeLeft(MODES[mode]);
                  setSessionComplete(false);
                  stopAmbientSound();
                }}
                className={cn(
                  "inline-flex items-center justify-center rounded-full border border-white/60 bg-white/55 text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all hover:bg-white",
                  isPhone ? "h-12 w-12" : "h-11 w-11"
                )}
                aria-label="Restart timer"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className={cn(
          "rounded-[1.75rem] border border-white/55 bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_16px_38px_rgba(15,23,42,0.08)] backdrop-blur-2xl",
          isPhone ? "p-3" : "p-4"
        )}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-zinc-900">Timer Visuals</h3>
              <p className={cn("font-semibold text-zinc-500", isPhone ? "text-[11px]" : "text-xs")}>Choose the animation that grows with your focus session.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/55 px-3 py-1 text-xs font-black text-zinc-500">{Math.round(progress)}%</span>
              <button
                type="button"
                onClick={() => setShowVisualsMenu((current) => !current)}
                className="rounded-full border border-white/60 bg-white/70 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl transition-all hover:bg-white"
              >
                {showVisualsMenu ? 'Close' : 'Open'}
              </button>
            </div>
          </div>

          {showVisualsMenu && (
            <>
              <div className={cn("grid gap-3", isPhone ? "grid-cols-1" : "grid-cols-2")}>
                {TIMER_VISUALS.map((visual) => (
                  <button
                    key={visual.id}
                    onClick={() => setSelectedVisual(visual.id)}
                    className={cn(
                      "rounded-3xl border p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_10px_24px_rgba(15,23,42,0.07)] transition-all backdrop-blur-xl",
                      isPhone ? "min-h-[5.25rem]" : "min-h-24",
                      visual.tone,
                      selectedVisual === visual.id ? "scale-[1.01] ring-2 ring-zinc-900/10" : "opacity-80 hover:opacity-100"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <visual.icon className="h-5 w-5" />
                      <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                        {selectedVisual === visual.id ? 'Open' : 'Tap'}
                      </span>
                    </div>
                    <p className="text-sm font-black">{visual.label}</p>
                    <p className="mt-1 text-xs font-semibold leading-4 opacity-75">{visual.description}</p>
                  </button>
                ))}
              </div>

              <div className={cn("mt-4 overflow-hidden rounded-[1.5rem] border border-white/55 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl", isPhone ? "p-3" : "p-4")}>
                {selectedVisual === 'ice' && (
                  <IceVisual
                    rewards={REWARDS}
                    selectedReward={selectedReward}
                    setSelectedReward={setSelectedReward}
                    sessionComplete={sessionComplete}
                    meltProgress={meltProgress}
                    sweetVideoUrl={sweetVideoUrl}
                    iceCubeVideoUrl={iceCubeVideoUrl}
                    streakCount={streakCount}
                  />
                )}
                {selectedVisual === 'stars' && <ShootingStarVisual progress={progress} sessionComplete={sessionComplete} />}
                {selectedVisual === 'glass' && <FillGlassVisual progress={progress} sessionComplete={sessionComplete} />}
                {selectedVisual === 'shapes' && <FallingShapesVisual progress={progress} sessionComplete={sessionComplete} />}
              </div>
            </>
          )}
        </div>

        <div className={cn("space-y-4 border-t border-white/45", isPhone ? "pt-5" : "pt-8")}>
          <div className="rounded-[1.75rem] border border-white/15 bg-zinc-950 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <p className="text-center font-bold text-white">What's the vibe for this session?</p>
          <div className={cn("mt-4 grid gap-2", isPhone ? "grid-cols-3" : "grid-cols-6")}>
            {MOODS.map((mood) => (
              <button
                key={mood.name}
                onClick={() => setSelectedMood(mood.name)}
                style={{
                  color: MOOD_RING_COLORS[mood.name],
                  borderColor: selectedMood === mood.name ? MOOD_RING_COLORS[mood.name] : undefined,
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all backdrop-blur-xl",
                  isPhone ? "p-2.5" : "p-3",
                  selectedMood === mood.name
                    ? "bg-white/10 shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                )}
              >
                <mood.icon size={24} />
                <span className="text-xs font-bold">{mood.name}</span>
              </button>
            ))}
          </div>
          </div>
        </div>
      </div>

      <div className={cn("w-full min-w-0 self-start space-y-3", isPhone ? "" : "max-w-xl xl:w-80")}>
        <div className={cn("grid gap-4", isDesktop ? "grid-cols-1" : "grid-cols-1")}>
          <div className="relative">
            <div
              onClick={() => {
                setShowAmbientMenu((current) => !current);
                setShowWallpaperMenu(false);
              }}
              className={cn(
                "group w-full min-w-0 overflow-hidden rounded-[2rem] border border-white/60 bg-white/35 text-left shadow-[0_24px_80px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl transition-all hover:-translate-y-0.5 hover:bg-white/45",
                isPhone ? "p-3.5" : "p-6"
              )}
            >
              <div className={cn("mb-3 flex items-end gap-2 rounded-[1.5rem] border border-white/55 bg-gradient-to-br from-indigo-100/70 via-sky-100/65 to-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]", isPhone ? "h-16 p-2.5" : "h-28 p-4")}>
                {[36, 64, 44, 78, 52, 88, 58].map((height, index) => (
                  <span
                    key={index}
                    className="w-full rounded-full bg-indigo-500/70 shadow-[0_8px_16px_rgba(79,70,229,0.16)]"
                    style={{ height: isPhone ? height * 0.56 : height }}
                  />
                ))}
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Ambient sound</p>
                  <h2 className={cn("mt-1.5 flex items-center gap-2 font-black text-zinc-900", isPhone ? "text-base" : "text-xl")}>
                    <Music className="h-5 w-5 text-indigo-500" /> {selectedAmbient.label}
                  </h2>
                  <p className={cn("mt-1 font-medium leading-5 text-zinc-600", isPhone ? "text-xs" : "text-sm")}>
                    {selectedAmbient.description}
                  </p>
                </div>
                <span className="rounded-full bg-white/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  Tap
                </span>
              </div>
              <div className={cn("mt-3 grid gap-2", isPhone ? "grid-cols-[1fr_auto]" : "grid-cols-[1fr_auto]")}>
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-sky-500/85 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(14,165,233,0.25),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-xl">
                  <Headphones className="h-5 w-5" /> {showAmbientMenu ? 'Close Menu' : 'Choose Sound'}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (playingAmbientId === selectedAmbient.id) {
                      stopAmbientSound();
                    } else {
                      void playAmbientSound(selectedAmbient.id);
                    }
                  }}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition-all",
                    playingAmbientId === selectedAmbient.id
                      ? "border-sky-200 bg-sky-50 text-sky-700"
                      : "border-white/60 bg-white/55 text-zinc-700"
                  )}
                  >
                    {playingAmbientId === selectedAmbient.id ? 'Pause' : 'Play'}
                  </button>
              </div>
              {isPhone && showAmbientMenu && (
                <div className="mt-3 grid gap-2">
                  {AMBIENT_SOUND_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedAmbientId(option.id);
                        setShowAmbientMenu(false);
                        void playAmbientSound(option.id);
                      }}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all",
                        selectedAmbientId === option.id
                          ? "border-sky-200 bg-sky-50 shadow-[0_10px_24px_rgba(14,165,233,0.14)]"
                          : "border-white bg-white/80"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-zinc-900">{option.label}</p>
                        <p className="mt-0.5 text-[11px] font-medium leading-4 text-zinc-500">{option.description}</p>
                      </div>
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black transition-all",
                        selectedAmbientId === option.id ? "border-sky-200 bg-sky-500 text-white" : "border-zinc-200 bg-white text-zinc-300"
                      )}>
                        {selectedAmbientId === option.id ? '✓' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!isPhone && showAmbientMenu && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-20 rounded-[1.5rem] border border-white/70 bg-white/88 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl">
                <div className="grid gap-2">
                  {AMBIENT_SOUND_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedAmbientId(option.id);
                        setShowAmbientMenu(false);
                        void playAmbientSound(option.id);
                      }}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
                        selectedAmbientId === option.id
                          ? "border-sky-200 bg-sky-50 shadow-[0_10px_24px_rgba(14,165,233,0.14)]"
                          : "border-white bg-white/80 hover:bg-white"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-zinc-900">{option.label}</p>
                        <p className="mt-1 text-xs font-medium text-zinc-500">{option.description}</p>
                      </div>
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black transition-all",
                        selectedAmbientId === option.id ? "border-sky-200 bg-sky-500 text-white" : "border-zinc-200 bg-white text-zinc-300"
                      )}>
                        {selectedAmbientId === option.id ? '✓' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <div
              onClick={() => {
                setShowWallpaperMenu((current) => !current);
                setShowAmbientMenu(false);
              }}
              className={cn(
                "group w-full min-w-0 overflow-hidden rounded-[2rem] border border-white/60 bg-white/35 text-left shadow-[0_24px_80px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl transition-all hover:-translate-y-0.5 hover:bg-white/45",
                isPhone ? "p-3.5" : "p-6"
              )}
            >
              <div className={cn("mb-3 grid gap-3", isPhone ? "h-24 grid-cols-[minmax(0,1fr)_4.5rem]" : "h-28 grid-cols-[1.15fr_0.85fr]")}>
                <div className="overflow-hidden rounded-[1.25rem] border border-white/55 bg-[linear-gradient(135deg,rgba(14,165,233,0.62),rgba(16,185,129,0.48)_48%,rgba(250,204,21,0.52))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="h-full rounded-[0.9rem] border border-white/40 bg-cover bg-center" style={{ backgroundImage: `url(${selectedWallpaper.url})` }} />
                </div>
                <div className="space-y-2.5">
                  <div className={cn("rounded-[1rem] border border-white/55 bg-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]", isPhone ? "h-[30px]" : "h-[36px]")} />
                  <div className={cn("rounded-[1rem] border border-white/55 bg-rose-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]", isPhone ? "h-[30px]" : "h-[36px]")} />
                </div>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Wallpaper</p>
                  <h2 className={cn("mt-1.5 flex items-center gap-2 font-black text-zinc-900", isPhone ? "text-[0.95rem]" : "text-xl")}>
                    <ImageIcon className="h-5 w-5 text-emerald-500" /> {selectedWallpaper.label}
                  </h2>
                  <p className={cn("mt-1 font-medium leading-5 text-zinc-600", isPhone ? "text-xs" : "text-sm")}>
                    Apply a timer background directly on this page.
                  </p>
                </div>
                <span className="rounded-full bg-white/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                  Tap
                </span>
              </div>
              <div className={cn("mt-3 grid gap-2", isDesktop ? "grid-cols-[1fr_auto]" : "grid-cols-1")}>
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-emerald-500/85 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-xl">
                  <ImageIcon className="h-5 w-5" /> {showWallpaperMenu ? 'Close Menu' : 'Choose Wallpaper'}
                </div>
                {isDesktop && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openWallpaperLibrary();
                    }}
                    className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-sm font-bold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition-all hover:bg-white"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" /> Open Page
                    </span>
                  </button>
                )}
              </div>
              {isPhone && showWallpaperMenu && (
                <div className="mt-3 grid gap-2">
                  {BACKGROUND_PRESETS.slice(0, 8).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedWallpaperId(preset.id);
                        setShowWallpaperMenu(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-all",
                        selectedWallpaperId === preset.id
                          ? "border-emerald-200 bg-emerald-50 shadow-[0_10px_24px_rgba(16,185,129,0.14)]"
                          : "border-white bg-white/80"
                      )}
                    >
                      <span
                        className="h-9 w-12 shrink-0 rounded-[0.8rem] border border-white/70 bg-cover bg-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                        style={{ backgroundImage: `url(${preset.url})` }}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-black text-zinc-900">{preset.label}</p>
                        <p className="mt-0.5 text-[10px] font-medium leading-4 text-zinc-500">Apply to the timer background</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!isPhone && showWallpaperMenu && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-20 rounded-[1.5rem] border border-white/70 bg-white/88 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl">
                <div className={cn("grid gap-2", isPhone ? "grid-cols-1" : "grid-cols-1")}>
                  {BACKGROUND_PRESETS.slice(0, isPhone ? 6 : 8).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedWallpaperId(preset.id);
                        setShowWallpaperMenu(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
                        selectedWallpaperId === preset.id
                          ? "border-emerald-200 bg-emerald-50 shadow-[0_10px_24px_rgba(16,185,129,0.14)]"
                          : "border-white bg-white/80 hover:bg-white"
                      )}
                    >
                      <span
                        className="h-12 w-16 shrink-0 rounded-[1rem] border border-white/70 bg-cover bg-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                        style={{ backgroundImage: `url(${preset.url})` }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-zinc-900">{preset.label}</p>
                        <p className="mt-1 text-xs font-medium text-zinc-500">Apply to the timer background</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={cn(
            "rounded-[2rem] border border-white/60 bg-white/35 shadow-[0_24px_80px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl",
            isPhone ? "p-4" : "p-5"
          )}>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <Volume2 className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-zinc-900">Now playing</h3>
                <p className="mt-1 text-sm font-medium text-zinc-600">
                  {playingAmbientId ? `${selectedAmbient.label} is looping in the background.` : 'No ambient track is playing right now.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function IcePreview({
  selectedReward,
  sessionComplete,
  meltProgress,
  sweetVideoUrl,
  iceCubeVideoUrl,
}: {
  selectedReward: string;
  sessionComplete: boolean;
  meltProgress: number;
  sweetVideoUrl: string;
  iceCubeVideoUrl: string;
}) {
  return (
    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_16px_35px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      {selectedReward === 'sweet' && sessionComplete ? (
        <video
          src={sweetVideoUrl}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          autoPlay
          loop
        />
      ) : (
        <>
          <video
            src={iceCubeVideoUrl}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
            autoPlay
            loop
          />
          <div className="absolute left-0 right-0 top-0 bg-white/80 transition-all backdrop-blur-sm" style={{ height: `${100 - meltProgress}%` }} />
        </>
      )}
    </div>
  );
}

function IceVisual({
  rewards,
  selectedReward,
  setSelectedReward,
  sessionComplete,
  meltProgress,
  sweetVideoUrl,
  iceCubeVideoUrl,
  streakCount,
}: {
  rewards: typeof REWARDS;
  selectedReward: string;
  setSelectedReward: (rewardId: string) => void;
  sessionComplete: boolean;
  meltProgress: number;
  sweetVideoUrl: string;
  iceCubeVideoUrl: string;
  streakCount: number;
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/55 bg-white/45 p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.78)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-zinc-900">Ice-Melt Reward</h3>
        <span className="text-xs font-bold text-emerald-600">Streak: {streakCount} days</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {rewards.map((reward) => (
          <button
            key={reward.id}
            onClick={() => setSelectedReward(reward.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all backdrop-blur-xl",
              reward.tone,
              selectedReward === reward.id ? "ring-2 ring-zinc-900/10" : "opacity-80 hover:opacity-100"
            )}
          >
            <reward.icon className="h-4 w-4" />
            {reward.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <IcePreview
          selectedReward={selectedReward}
          sessionComplete={sessionComplete}
          meltProgress={meltProgress}
          sweetVideoUrl={sweetVideoUrl}
          iceCubeVideoUrl={iceCubeVideoUrl}
        />
        <div className="flex-1 text-sm font-medium text-zinc-600">
          {sessionComplete
            ? 'Ice melted. Go claim your reward.'
            : 'Stay focused. Your reward unlocks when the timer hits zero.'}
        </div>
      </div>
    </div>
  );
}

function ShootingStarVisual({ progress, sessionComplete }: { progress: number; sessionComplete: boolean }) {
  const point = getMazePoint(progress);

  return (
    <div className="relative min-h-48 overflow-hidden rounded-[1.25rem] bg-slate-950 p-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(129,140,248,0.28),transparent_32%),radial-gradient(circle_at_85%_25%,rgba(56,189,248,0.2),transparent_28%)]" />
      <svg viewBox="0 0 320 170" className="relative h-44 w-full">
        <path
          d="M24 32 H95 V72 H54 V118 H142 V48 H214 V88 H178 V138 H292"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 32 H95 V72 H54 V118 H142 V48 H214 V88 H178 V138 H292"
          fill="none"
          stroke="rgba(251,191,36,0.85)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${Math.max(1, progress * 7)} 700`}
        />
        <motion.g
          animate={{ x: point.x, y: point.y, scale: sessionComplete ? [1, 1.7, 0.95] : 1, rotate: sessionComplete ? [0, 25, -10, 0] : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        >
          <text x="-13" y="10" className="select-none text-3xl">★</text>
        </motion.g>
        {sessionComplete && (
          <motion.g initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 0.75], scale: 1 }} transition={{ duration: 0.8 }}>
            <circle cx="292" cy="138" r="28" fill="rgba(250,204,21,0.2)" />
            <circle cx="292" cy="138" r="42" fill="none" stroke="rgba(250,204,21,0.55)" strokeWidth="3" strokeDasharray="5 8" />
            <text x="260" y="149" className="select-none text-3xl">✦ ✨</text>
          </motion.g>
        )}
      </svg>
      <p className="relative text-xs font-semibold leading-5 text-white/70">
        Placeholder maze: the star follows the line at the timer rate and bursts at the finish.
      </p>
    </div>
  );
}

function FillGlassVisual({ progress, sessionComplete }: { progress: number; sessionComplete: boolean }) {
  const fillHeight = Math.max(0, Math.min(100, progress));
  const cubes = ['🧊', '✨', '🍓', '🫧', '⭐', '🧊'];

  return (
    <div className="flex min-h-48 items-center gap-5">
      <div className="relative h-44 w-32 shrink-0">
        <svg viewBox="0 0 120 160" className="absolute inset-0 h-full w-full">
          <path d="M24 16 H96 L86 148 H34 Z" fill="rgba(255,255,255,0.55)" stroke="rgba(14,165,233,0.55)" strokeWidth="6" />
          <clipPath id="glass-fill-clip">
            <path d="M28 21 H92 L82 143 H38 Z" />
          </clipPath>
          <rect
            x="24"
            y={150 - fillHeight * 1.28}
            width="72"
            height={fillHeight * 1.28}
            fill="rgba(56,189,248,0.42)"
            clipPath="url(#glass-fill-clip)"
          />
        </svg>
        <div className="absolute inset-x-5 bottom-4 flex flex-wrap-reverse justify-center gap-1 overflow-hidden" style={{ height: `${Math.max(16, fillHeight * 1.15)}px` }}>
          {cubes.map((cube, index) => (
            <motion.span
              key={`${cube}-${index}`}
              className="text-lg leading-none"
              animate={{ y: sessionComplete ? [0, -6, 0] : 0 }}
              transition={{ duration: 1.2, repeat: sessionComplete ? Infinity : 0, delay: index * 0.08 }}
            >
              {cube}
            </motion.span>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-black text-zinc-900">Fill the glass</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
          Placeholder cup for your SVG. It fills with emoji/ice rewards as the timer advances.
        </p>
      </div>
    </div>
  );
}

function FallingShapesVisual({ progress, sessionComplete }: { progress: number; sessionComplete: boolean }) {
  const shapes = [
    { color: 'bg-cyan-400', left: '8%', delay: 0, shape: [[1, 1, 1, 1]] },
    { color: 'bg-amber-400', left: '34%', delay: 0.12, shape: [[1, 1], [1, 1]] },
    { color: 'bg-fuchsia-500', left: '62%', delay: 0.24, shape: [[0, 1, 0], [1, 1, 1]] },
    { color: 'bg-emerald-400', left: '78%', delay: 0.36, shape: [[1, 1, 0], [0, 1, 1]] },
  ];

  return (
    <div className="relative min-h-48 overflow-hidden rounded-[1.25rem] bg-zinc-950 p-4">
      <div className="absolute inset-x-5 bottom-5 top-5 rounded-xl border border-white/10 bg-white/[0.03]" />
      {shapes.map((shape, index) => (
        <motion.div
          key={index}
          className="absolute"
          style={{ left: shape.left, top: 12 }}
          animate={{ y: sessionComplete ? 118 : Math.min(118, progress * 1.18) }}
          transition={{ type: 'spring', stiffness: 65, damping: 16, delay: shape.delay }}
        >
          <TetrisShape color={shape.color} shape={shape.shape} />
        </motion.div>
      ))}
      {sessionComplete && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white"
        >
          Stack complete
        </motion.div>
      )}
      <p className="absolute left-4 top-4 text-xs font-semibold text-white/60">3D shapes placeholder</p>
    </div>
  );
}

function TetrisShape({ color, shape }: { color: string; shape: number[][] }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${shape[0].length}, 18px)` }}>
      {shape.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <div
            key={`${rowIndex}-${columnIndex}`}
            className={cn(
              "h-[18px] w-[18px] rounded-[4px]",
              cell ? `${color} shadow-[inset_3px_3px_0_rgba(255,255,255,0.35),inset_-3px_-3px_0_rgba(0,0,0,0.18),0_8px_16px_rgba(0,0,0,0.28)]` : 'opacity-0'
            )}
          />
        ))
      )}
    </div>
  );
}

function getMazePoint(progress: number) {
  const points = [
    { x: 24, y: 32 },
    { x: 95, y: 32 },
    { x: 95, y: 72 },
    { x: 54, y: 72 },
    { x: 54, y: 118 },
    { x: 142, y: 118 },
    { x: 142, y: 48 },
    { x: 214, y: 48 },
    { x: 214, y: 88 },
    { x: 178, y: 88 },
    { x: 178, y: 138 },
    { x: 292, y: 138 },
  ];
  const clamped = Math.max(0, Math.min(100, progress)) / 100;
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index];
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let distance = total * clamped;

  for (let index = 0; index < lengths.length; index += 1) {
    if (distance <= lengths[index]) {
      const start = points[index];
      const end = points[index + 1];
      const ratio = lengths[index] === 0 ? 0 : distance / lengths[index];
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    distance -= lengths[index];
  }

  return points[points.length - 1];
}
