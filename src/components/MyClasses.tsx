import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Calculator, 
  Book, 
  FlaskConical, 
  Cpu, 
  Globe, 
  Gamepad2, 
  PenTool,
  Loader2,
  ChevronRight,
  BookOpen,
  Library,
  GraduationCap,
  BellRing
} from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, onSnapshot } from '@/lib/portal-firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { APP_THEME_PALETTES, getStoredThemePreference, type ThemePaletteId } from '../lib/theme';
import { detectStudentPortalFromPath, studentPortalPath } from '@/lib/portal';

interface TimetableEntry {
  subject: string;
}

type BubbleVisual = {
  backgroundColor: string;
  shadowColor: string;
};

type BubbleConfig = {
  diameter: number;
  z: string;
};

type BubbleLayout = BubbleConfig & {
  top: number;
  left: number;
};

const DESKTOP_BUBBLE_CANVAS_WIDTH = 980;
const DESKTOP_BUBBLE_CANVAS_HEIGHT = 700;

const SUBJECT_MAP: Record<string, { icon: any }> = {
  'italian': { icon: Calculator },
  'h&pe': { icon: PenTool },
  'science': { icon: Book },
  'english': { icon: FlaskConical },
  'leap': { icon: Cpu },
  'art': { icon: Globe },
  'hass': { icon: Gamepad2 },
  'math': { icon: Calculator },
  'history': { icon: Library },
  'default': { icon: GraduationCap }
};

const BUBBLE_CONFIGS: BubbleConfig[] = [
  { diameter: 176, z: 'z-10' },
  { diameter: 288, z: 'z-20' },
  { diameter: 224, z: 'z-20' },
  { diameter: 256, z: 'z-10' },
  { diameter: 208, z: 'z-10' },
  { diameter: 224, z: 'z-10' },
  { diameter: 256, z: 'z-30' },
  { diameter: 192, z: 'z-10' },
  { diameter: 208, z: 'z-10' },
];

const INVALID_SUBJECTS = new Set([
  '',
  'new class',
  'new subject',
  'untitled',
  'class',
  'subject',
]);

const SUBJECT_SIZE_MULTIPLIER: Record<string, number> = {
  italian: 1.18,
  english: 1.14,
  art: 1.12,
  hass: 1.06,
  math: 1.04,
  science: 0.98,
  leap: 1.02,
};

const DESKTOP_BUBBLE_EDGE_PADDING = {
  top: 2,
  right: 64,
  bottom: 72,
  left: 28,
};

const SUBJECT_COLOR_SLOT: Record<string, number> = {
  italian: 0,
  math: 0,
  english: 1,
  hass: 1,
  leap: 2,
  art: 2,
  science: 3,
  'h&pe': 4,
  history: 5,
};

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(hex: string) {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    return cleaned.split('').map((char) => char + char).join('');
  }
  return cleaned;
}

function mixHexColors(fromHex: string, toHex: string, weight: number) {
  const from = normalizeHex(fromHex);
  const to = normalizeHex(toHex);
  const ratio = Math.max(0, Math.min(1, weight));

  const red = clampChannel(parseInt(from.slice(0, 2), 16) * (1 - ratio) + parseInt(to.slice(0, 2), 16) * ratio);
  const green = clampChannel(parseInt(from.slice(2, 4), 16) * (1 - ratio) + parseInt(to.slice(2, 4), 16) * ratio);
  const blue = clampChannel(parseInt(from.slice(4, 6), 16) * (1 - ratio) + parseInt(to.slice(4, 6), 16) * ratio);

  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = normalizeHex(hex);
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function buildThemeBubbleVisuals(paletteId: ThemePaletteId): BubbleVisual[] {
  const palette = APP_THEME_PALETTES.find((entry) => entry.id === paletteId) || APP_THEME_PALETTES[0];
  const [primary, secondary, tertiary] = palette.swatches;

  return [
    { backgroundColor: primary, shadowColor: primary },
    { backgroundColor: secondary, shadowColor: secondary },
    { backgroundColor: tertiary, shadowColor: tertiary },
    { backgroundColor: mixHexColors(primary, secondary, 0.48), shadowColor: primary },
    { backgroundColor: mixHexColors(secondary, tertiary, 0.45), shadowColor: secondary },
    { backgroundColor: mixHexColors(tertiary, '#ffffff', 0.18), shadowColor: tertiary },
  ];
}

function seededValue(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let value = seed || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function shuffleIndices(length: number, rng: () => number) {
  const indices = Array.from({ length }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function buildBubbleLayouts(subjects: string[], userKey: string | undefined): BubbleLayout[] {
  const width = DESKTOP_BUBBLE_CANVAS_WIDTH;
  const height = DESKTOP_BUBBLE_CANVAS_HEIGHT;
  const padding = 18;
  const minGap = subjects.length <= 5 ? 14 : subjects.length <= 7 ? 11 : 8;
  const rng = createSeededRandom(seededValue(`${userKey || 'guest'}:${subjects.join('|')}`));
  const scale = subjects.length <= 4 ? 0.9 : subjects.length <= 6 ? 0.78 : subjects.length <= 8 ? 0.72 : 0.64;
  const minDiameter = subjects.length <= 6 ? 210 : subjects.length <= 8 ? 190 : 176;
  const centerX = width * 0.5;
  const centerY = height * 0.38;

  const configs = subjects.map((subject, index) => ({
    subject,
    index,
    diameter: Math.max(
      minDiameter,
      Math.round(
        BUBBLE_CONFIGS[index % BUBBLE_CONFIGS.length].diameter *
          scale *
          (SUBJECT_SIZE_MULTIPLIER[subject.toLowerCase()] || 1)
      ),
    ),
    z: BUBBLE_CONFIGS[index % BUBBLE_CONFIGS.length].z,
  }));

  const placementOrder = [...configs].sort((a, b) => b.diameter - a.diameter);
  const placed: { index: number; subject: string; x: number; y: number; radius: number; z: string }[] = [];

  const hasCollision = (
    x: number,
    y: number,
    radius: number,
    ignoreIndex?: number,
  ) => placed.some((bubble) => {
    if (bubble.index === ignoreIndex) return false;
    const dx = bubble.x - x;
    const dy = bubble.y - y;
    return Math.hypot(dx, dy) < bubble.radius + radius + minGap;
  });

  for (const item of placementOrder) {
    const radius = item.diameter / 2;
    let placedX = centerX;
    let placedY = centerY;
    let foundSpot = false;
    const baseAngle = rng() * Math.PI * 2;

    for (let attempt = 0; attempt < 320; attempt += 1) {
      const ring = Math.floor(attempt / 12);
      const angle = baseAngle + attempt * 0.68;
      const distance = 10 + ring * 23 + rng() * 7;
      const x = Math.max(
        DESKTOP_BUBBLE_EDGE_PADDING.left + radius,
        Math.min(width - DESKTOP_BUBBLE_EDGE_PADDING.right - radius, centerX + Math.cos(angle) * distance * 0.98),
      );
      const y = Math.max(
        DESKTOP_BUBBLE_EDGE_PADDING.top + radius,
        Math.min(height - DESKTOP_BUBBLE_EDGE_PADDING.bottom - radius, centerY + Math.sin(angle) * distance * 0.82),
      );

      if (!hasCollision(x, y, radius)) {
        placedX = x;
        placedY = y;
        foundSpot = true;
        break;
      }
    }

    if (!foundSpot) {
      const fallbackIndex = placed.length;
      const angle = baseAngle + fallbackIndex * 0.86;
      const distance = 75 + fallbackIndex * 18;
      placedX = Math.max(
        DESKTOP_BUBBLE_EDGE_PADDING.left + radius,
        Math.min(width - DESKTOP_BUBBLE_EDGE_PADDING.right - radius, centerX + Math.cos(angle) * distance * 0.94),
      );
      placedY = Math.max(
        DESKTOP_BUBBLE_EDGE_PADDING.top + radius,
        Math.min(height - DESKTOP_BUBBLE_EDGE_PADDING.bottom - radius, centerY + Math.sin(angle) * distance * 0.76),
      );
    }

    placed.push({ index: item.index, subject: item.subject, x: placedX, y: placedY, radius, z: item.z });
  }

  const tryNudge = (subjectName: string, deltaX: number, deltaY: number) => {
    const bubble = placed.find((entry) => entry.subject.toLowerCase() === subjectName);
    if (!bubble) return;

    for (let strength = 1; strength <= 8; strength += 1) {
      const nextX = Math.max(
        DESKTOP_BUBBLE_EDGE_PADDING.left + bubble.radius,
        Math.min(width - DESKTOP_BUBBLE_EDGE_PADDING.right - bubble.radius, bubble.x + deltaX * strength),
      );
      const nextY = Math.max(
        DESKTOP_BUBBLE_EDGE_PADDING.top + bubble.radius,
        Math.min(height - DESKTOP_BUBBLE_EDGE_PADDING.bottom - bubble.radius, bubble.y + deltaY * strength),
      );

      if (!hasCollision(nextX, nextY, bubble.radius, bubble.index)) {
        bubble.x = nextX;
        bubble.y = nextY;
      } else {
        break;
      }
    }
  };

  const positionBubbleAbove = (subjectName: string, anchorName: string, lateralShift = 0, gap = minGap + 16) => {
    const bubble = placed.find((entry) => entry.subject.toLowerCase() === subjectName);
    const anchor = placed.find((entry) => entry.subject.toLowerCase() === anchorName);
    if (!bubble || !anchor) return;

    const nextX = Math.max(
      DESKTOP_BUBBLE_EDGE_PADDING.left + bubble.radius,
      Math.min(
        width - DESKTOP_BUBBLE_EDGE_PADDING.right - bubble.radius,
        anchor.x + lateralShift,
      ),
    );
    const nextY = Math.max(
      DESKTOP_BUBBLE_EDGE_PADDING.top + bubble.radius,
      Math.min(
        height - DESKTOP_BUBBLE_EDGE_PADDING.bottom - bubble.radius,
        anchor.y - anchor.radius - bubble.radius - gap,
      ),
    );

    if (!hasCollision(nextX, nextY, bubble.radius, bubble.index)) {
      bubble.x = nextX;
      bubble.y = nextY;
    }
  };

  if (subjects.length >= 5) {
    positionBubbleAbove('english', 'leap', -118, minGap + 74);
    tryNudge('english', -42, -36);
    tryNudge('art', 36, 18);
  }

  const bounds = placed.reduce(
    (acc, bubble) => ({
      minX: Math.min(acc.minX, bubble.x - bubble.radius),
      maxX: Math.max(acc.maxX, bubble.x + bubble.radius),
      minY: Math.min(acc.minY, bubble.y - bubble.radius),
      maxY: Math.max(acc.maxY, bubble.y + bubble.radius),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );

  const clusterWidth = bounds.maxX - bounds.minX;
  const clusterHeight = bounds.maxY - bounds.minY;
  const targetLeft = DESKTOP_BUBBLE_EDGE_PADDING.left;
  const targetTop = DESKTOP_BUBBLE_EDGE_PADDING.top;
  const horizontalSlack = Math.max(0, width - clusterWidth - targetLeft - DESKTOP_BUBBLE_EDGE_PADDING.right);
  const verticalSlack = Math.max(0, height - clusterHeight - targetTop - DESKTOP_BUBBLE_EDGE_PADDING.bottom);
  const shiftX = targetLeft - bounds.minX + horizontalSlack * 0.18;
  const shiftY = targetTop - bounds.minY - Math.min(18, verticalSlack * 0.25);

  for (const bubble of placed) {
    bubble.x = Math.max(
      DESKTOP_BUBBLE_EDGE_PADDING.left + bubble.radius,
      Math.min(width - DESKTOP_BUBBLE_EDGE_PADDING.right - bubble.radius, bubble.x + shiftX),
    );
    bubble.y = Math.max(
      DESKTOP_BUBBLE_EDGE_PADDING.top + bubble.radius,
      Math.min(height - DESKTOP_BUBBLE_EDGE_PADDING.bottom - bubble.radius, bubble.y + shiftY),
    );
  }

  if (subjects.length >= 5) {
    const englishBubble = placed.find((bubble) => bubble.subject.toLowerCase() === 'english');
    if (englishBubble) {
      englishBubble.x = DESKTOP_BUBBLE_EDGE_PADDING.left + englishBubble.radius + 22;
      englishBubble.y = DESKTOP_BUBBLE_EDGE_PADDING.top + englishBubble.radius + 34;
    }
  }

  return configs.map((item) => {
    const match = placed.find((bubble) => bubble.index === item.index)!;
    return {
      diameter: item.diameter,
      z: item.z,
      left: (match.x / width) * 100,
      top: (match.y / height) * 100,
    };
  });
}

export default function MyClasses() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [themePaletteId, setThemePaletteId] = useState<ThemePaletteId>(() => getStoredThemePreference().paletteId);
  const navigate = useNavigate();
  const location = useLocation();
  const { isPhone } = useResponsiveDevice();
  const [layoutSeed, setLayoutSeed] = useState<string>('guest');
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const timetablePath = studentPortalPath(activePortal, '/timetable');
  const announcementsPath = studentPortalPath(activePortal, '/announcements');
  const classPath = (subject: string) => studentPortalPath(activePortal, `/classes/${encodeURIComponent(subject)}`);

  const bubbleVisuals = useMemo(() => buildThemeBubbleVisuals(themePaletteId), [themePaletteId]);

  useEffect(() => {
    let unsubscribeTimetable = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeTimetable();

      if (!user) {
        setLayoutSeed('guest');
        setSubjects([]);
        setLoading(false);
        return;
      }

      setLayoutSeed(user.uid);
      setLoading(true);

      unsubscribeTimetable = onSnapshot(
        doc(db, 'timetables', user.uid),
        (docSnap) => {
          if (docSnap.exists()) {
            const entries: TimetableEntry[] = docSnap.data().entries || [];
            const uniqueSubjects = Array.from(new Set(
              entries
                .map((entry) => entry.subject?.trim())
                .filter((subject) => {
                  if (!subject) return false;
                  return !INVALID_SUBJECTS.has(subject.toLowerCase());
                })
            ));
            setSubjects(uniqueSubjects);
          } else {
            setSubjects([]);
          }
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `timetables/${user.uid}`);
          setSubjects([]);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeTimetable();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      setThemePaletteId(getStoredThemePreference().paletteId);
    };

    syncTheme();
    window.addEventListener('focus', syncTheme);
    window.addEventListener('storage', syncTheme);

    const observer = new MutationObserver(() => {
      syncTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme-palette'],
    });

    return () => {
      window.removeEventListener('focus', syncTheme);
      window.removeEventListener('storage', syncTheme);
      observer.disconnect();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
          <BookOpen size={40} />
        </div>
        <h2 className="text-2xl font-black text-zinc-900">No Classes Found</h2>
        <p className="text-zinc-500 max-w-md">
          Your classes are automatically pulled from your timetable. 
          Go to the Timetable page and add some classes or use Smart Fill!
        </p>
        <a 
          href={timetablePath}
          className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          Go to Timetable
        </a>
      </div>
    );
  }

  const bubbleLayouts = buildBubbleLayouts(subjects, layoutSeed);

  if (isPhone) {
    return (
      <div className="min-h-full rounded-[32px] bg-[#A5E1FF]/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
        <div className="mb-5 flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">My Classes</h1>
            <p className="mt-1 text-sm font-medium text-zinc-500">Tap a class bubble to open notes and tasks.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(announcementsPath)}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-xs font-black text-zinc-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
          >
            <BellRing size={14} />
            Alerts
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {subjects.map((subject, index) => {
            const lowerSubject = subject.toLowerCase();
            const config = SUBJECT_MAP[lowerSubject] || SUBJECT_MAP.default;
            const colorIndex = SUBJECT_COLOR_SLOT[lowerSubject] ?? index;
            const visual = bubbleVisuals[colorIndex % bubbleVisuals.length];
            const Icon = config.icon;
            const isTall = index % 3 === 1;

            return (
              <motion.button
                key={subject}
                initial={{ opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.06, duration: 0.3 }}
                onClick={() => navigate(classPath(subject))}
                className={cn(
                  "relative overflow-hidden rounded-[30px] text-left text-white shadow-2xl transition-transform active:scale-[0.98]",
                  isTall ? "min-h-[220px]" : "aspect-[0.9/1]"
                )}
                style={{
                  backgroundColor: visual.backgroundColor,
                  boxShadow: `0 24px 60px ${hexToRgba(visual.shadowColor, 0.34)}`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-black/10" />
                <div className="relative z-10 flex h-full flex-col justify-between p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur-sm">
                    <Icon size={24} strokeWidth={2.4} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black leading-none tracking-tight">{subject}</h3>
                    <p className="mt-2 text-[11px] font-semibold text-white/75">Notes, tasks, and class progress</p>
                    <div className="mt-4 inline-flex items-center rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]">
                      Open
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="m-4 space-y-3">
      <div className="px-1">
        <h1 className="text-5xl font-black leading-none tracking-tight text-zinc-900">My Classes</h1>
      </div>

      <div className="relative w-full rounded-[40px] bg-[#A5E1FF]/30">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-white/20 blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-blue-400/10 blur-[100px]" />
        </div>

        <div
          className="relative w-full overflow-hidden px-4 py-4"
          style={{ minHeight: `${DESKTOP_BUBBLE_CANVAS_HEIGHT}px` }}
        >
          {subjects.map((subject, index) => {
            const lowerSubject = subject.toLowerCase();
            const config = SUBJECT_MAP[lowerSubject] || SUBJECT_MAP['default'];
            const colorIndex = SUBJECT_COLOR_SLOT[lowerSubject] ?? index;
            const visual = bubbleVisuals[colorIndex % bubbleVisuals.length];
            const pos = bubbleLayouts[index];
            const Icon = config.icon;

            return (
              <motion.div
                key={subject}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: index * 0.1
                }}
                whileHover={{ scale: 1.05, zIndex: 50 }}
                className={cn(
                  "absolute flex flex-col items-center justify-center overflow-hidden text-center text-white",
                  "rounded-full shadow-2xl transition-all duration-500",
                  lowerSubject === 'english' ? 'z-40' : pos.z
                )}
                style={{
                  backgroundColor: visual.backgroundColor,
                  boxShadow: `0 28px 80px ${hexToRgba(visual.shadowColor, 0.34)}`,
                  width: `${pos.diameter}px`,
                  height: `${pos.diameter}px`,
                  top: `${pos.top}%`,
                  left: `${pos.left}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent" />

                <div className="relative z-10 flex h-full w-full flex-col items-center px-4 pb-6 pt-5">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-white/20 backdrop-blur-sm">
                    <Icon size={28} strokeWidth={2.5} />
                  </div>

                  <h3 className="mb-1 text-[clamp(1.75rem,2vw,2.25rem)] font-black tracking-tight leading-none">
                    {subject}
                  </h3>
                  <p className="px-5 text-[11px] font-medium text-white/75">View notes & tasks</p>

                  <button
                    onClick={() => navigate(classPath(subject))}
                    className="mt-auto rounded-full border border-white/40 bg-white/20 px-7 py-2 text-sm font-bold backdrop-blur-md transition-all active:scale-95 hover:bg-white/30"
                  >
                    Open
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <section className="rounded-[32px] border border-zinc-200 bg-white/80 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-zinc-900">Class list</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-500">
              Classes on this page come from the timetable. To add a new class, go to the Timetable page and add it there.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(timetablePath)}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
          >
            Go to Timetable
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {subjects.map((subject) => (
            <button
              key={`class-list-${subject}`}
              type="button"
              onClick={() => navigate(classPath(subject))}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-white"
            >
              {subject}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
