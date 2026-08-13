import { useState, useEffect, type ChangeEvent } from 'react';
import { 
  Calendar, 
  CalendarPlus,
  Upload, 
  Plus, 
  Trash2, 
  Save, 
  Loader2,
  Sparkles,
  Clock,
  MapPin,
  Edit3,
  BookOpen,
  Check,
  HelpCircle,
  ChevronDown,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, onSnapshot } from '@/lib/portal-firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { geminiGenerateContent } from '../services/geminiProxy';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { normalizePlan, HomeworkSession } from '../lib/homework';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

interface TimetableEntry {
  id: string;
  subject: string;
  day: string;
  startTime: string;
  endTime: string;
  location?: string;
  teacher?: string;
  color?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

const COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
];

const COLOR_HEX_VALUES = ['#dbeafe', '#d1fae5', '#ede9fe', '#fef3c7', '#ffe4e6', '#cffafe', '#e0e7ff'];

const normalizeSubject = (subject: string) => subject.trim().toLowerCase();

const isHexColor = (value?: string) => Boolean(value?.startsWith('#'));

const getReadableTextColor = (hexColor: string) => {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#18181b';

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.58 ? '#18181b' : '#ffffff';
};

const getCustomColorStyle = (color?: string) => {
  if (!isHexColor(color)) return undefined;

  return {
    backgroundColor: color,
    borderColor: color,
    color: getReadableTextColor(color),
  };
};

const getPickerValue = (color?: string, fallbackIndex = 0) => (
  isHexColor(color) ? color! : COLOR_HEX_VALUES[Math.max(0, fallbackIndex) % COLOR_HEX_VALUES.length]
);

const getColorSelectionIndex = (color?: string) => {
  if (!color) return -1;
  if (isHexColor(color)) return COLOR_HEX_VALUES.indexOf(color.toLowerCase());
  return COLORS.indexOf(color);
};

const isSelectedSwatch = (color: string | undefined, colorIndex: number) => (
  getColorSelectionIndex(color) === colorIndex
);

const DAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const escapeIcsText = (value = '') => (
  value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
);

const formatIcsDate = (date: Date, time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const withTime = new Date(date);
  withTime.setHours(hours || 0, minutes || 0, 0, 0);
  const year = withTime.getFullYear();
  const month = String(withTime.getMonth() + 1).padStart(2, '0');
  const day = String(withTime.getDate()).padStart(2, '0');
  const hour = String(withTime.getHours()).padStart(2, '0');
  const minute = String(withTime.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}00`;
};

const getNextDateForDay = (day: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetIndex = DAY_INDEX[day] ?? 1;
  const daysUntilTarget = (targetIndex - today.getDay() + 7) % 7;
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilTarget);
  return nextDate;
};

export default function TimetablePage() {
  const { isPhone } = useResponsiveDevice();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [is24Hour, setIs24Hour] = useState(false);
  const [showHomework, setShowHomework] = useState(false);
  const [is3DView, setIs3DView] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);
  const [homeworkEntries, setHomeworkEntries] = useState<HomeworkSession[]>([]);
  const [showPhoneActions, setShowPhoneActions] = useState(false);
  const [selectedMobileDay, setSelectedMobileDay] = useState(() => {
    const todayIndex = new Date().getDay();
    return DAYS[(todayIndex + 6) % 7] || 'Monday';
  });

  useEffect(() => {
    let unsubscribeHomework = () => {};
    let unsubscribeTimetable = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Fetch homework plan (stored as doc with user uid)
        unsubscribeHomework = onSnapshot(doc(db, 'homeworkPlans', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const plan = docSnap.data().plan || [];
            setHomeworkEntries(normalizePlan(plan));
          } else {
            setHomeworkEntries([]);
          }
        }, (err) => {
          console.error("Homework listener error:", err);
        });

        // Fetch timetable
        unsubscribeTimetable = onSnapshot(doc(db, 'timetables', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            setEntries(docSnap.data().entries || []);
          }
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `timetables/${user.uid}`);
          setError("Failed to load timetable. Please try again.");
          setLoading(false);
        });
      } else {
        setLoading(false);
        setEntries([]);
        setHomeworkEntries([]);
      }
    });
    
    return () => {
      unsubscribeAuth();
      unsubscribeHomework();
      unsubscribeTimetable();
    };
  }, []);

  const formatTime = (timeStr: string) => {
    if (is24Hour) return timeStr;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const parseMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const parseDurationMinutes = (duration?: string) => {
    if (!duration) return 60;
    const lower = duration.toLowerCase();
    const hoursMatch = lower.match(/(\d+(?:\.\d+)?)\s*h/);
    const minsMatch = lower.match(/(\d+)\s*m/);
    if (hoursMatch) return Math.round(parseFloat(hoursMatch[1]) * 60);
    if (minsMatch) return parseInt(minsMatch[1], 10);
    return 60;
  };

  const getDayClasses = (day: string) => (
    entries
      .filter((entry) => entry.day === day)
      .sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime))
  );

  const getDayHomework = (day: string) => (
    showHomework
      ? homeworkEntries
          .filter((entry) => entry.day === day)
          .sort((a, b) => parseMinutes(a.timeOfDay) - parseMinutes(b.timeOfDay))
      : []
  );

  const moveSelectedMobileDay = (direction: 1 | -1) => {
    const currentIndex = DAYS.indexOf(selectedMobileDay);
    const nextIndex = (currentIndex + direction + DAYS.length) % DAYS.length;
    setSelectedMobileDay(DAYS[nextIndex]);
  };

  const renderCompactOverview = (dayOverride?: string) => {
    const compactHours = HOURS.slice(0, 11);
    const activeDays = dayOverride ? [dayOverride] : DAYS;
    const rowHeight = dayOverride ? 48 : (isPhone ? 38 : 52);
    const compactWidthClass = dayOverride ? "min-w-[320px]" : (isPhone ? "min-w-[820px]" : "min-w-[860px]");

    return (
      <div className="overflow-x-auto scrollbar-hide">
        <div className={compactWidthClass}>
          <div
            className="grid gap-[1px] overflow-hidden rounded-[24px] border border-zinc-200 bg-zinc-200"
            style={{ gridTemplateColumns: `52px repeat(${activeDays.length}, minmax(0, 1fr))` }}
          >
            <div className="bg-zinc-50" />
            {activeDays.map((day) => (
              <div key={`compact-head-${day}`} className="bg-zinc-50 px-2 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{day.slice(0, 3)}</p>
              </div>
            ))}

            {compactHours.map((hour) => (
              <div key={`compact-row-${hour}`} className="contents">
                <div className="bg-white px-2 py-2 text-right text-[9px] font-black text-zinc-400">
                  {formatTime(`${hour.toString().padStart(2, '0')}:00`)}
                </div>
                {activeDays.map((day) => {
                  const classCount = entries.filter((entry) => entry.day === day && parseInt(entry.startTime.split(':')[0]) === hour).length;
                  const homeworkCount = showHomework
                    ? homeworkEntries.filter((entry) => entry.day === day && parseInt(entry.timeOfDay.split(':')[0]) === hour).length
                    : 0;
                  const totalCount = classCount + homeworkCount;
                  const firstClass = entries.find((entry) => entry.day === day && parseInt(entry.startTime.split(':')[0]) === hour);

                  return (
                    <div
                      key={`${day}-compact-${hour}`}
                      className="bg-white px-1 py-1"
                      style={{ minHeight: `${rowHeight}px` }}
                    >
                      {totalCount > 0 ? (
                        <div
                          className={cn(
                            "flex h-full flex-col justify-between rounded-[12px] border px-1.5 py-1 text-[8px] font-black shadow-sm",
                            isHexColor(firstClass?.color) ? "" : firstClass?.color || "bg-sky-50 text-sky-700 border-sky-200"
                          )}
                          style={getCustomColorStyle(firstClass?.color)}
                        >
                          <span className="truncate uppercase">{firstClass?.subject || 'Study'}</span>
                          <span className="text-[8px] opacity-70">{totalCount} block{totalCount === 1 ? '' : 's'}</span>
                        </div>
                      ) : (
                        <div className="h-full rounded-[12px] bg-zinc-50" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const render3DView = () => {
    const cardHeight = 104;
    const cellGap = 14;

    const getCellItems = (day: string, hour: number) => {
      const classItems = entries
        .filter((entry) => entry.day === day && parseInt(entry.startTime.split(':')[0]) === hour)
        .map((entry) => ({
          id: entry.id,
          type: 'class' as const,
          subject: entry.subject,
          startTime: entry.startTime,
          endTime: entry.endTime,
          color: entry.color || COLORS[0],
          location: entry.location,
        }));

      const homeworkItems = showHomework
        ? homeworkEntries
            .filter((entry) => entry.day === day && parseInt(entry.timeOfDay.split(':')[0]) === hour)
            .map((entry, index) => {
              const startMinutes = parseMinutes(entry.timeOfDay);
              const durationMinutes = parseDurationMinutes(entry.duration);
              const endMinutes = startMinutes + durationMinutes;

              return {
                id: `hw-3d-${day}-${hour}-${index}`,
                type: 'homework' as const,
                subject: entry.subject,
                startTime: entry.timeOfDay,
                endTime: `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`,
                color: 'bg-sky-50 text-sky-700 border-sky-200',
                location: entry.technique,
              };
            })
        : [];

      return [...classItems, ...homeworkItems].sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime));
    };

    const rowHeights = HOURS.map((hour) => {
      const maxItems = Math.max(1, ...DAYS.map((day) => getCellItems(day, hour).length));
      return maxItems * cardHeight + Math.max(0, maxItems - 1) * cellGap + 28;
    });

    const PrismCard = ({ item }: { item: ReturnType<typeof getCellItems>[number] }) => (
      <button
        key={item.id}
        onClick={() => setIsEditing(true)}
        className="relative h-[104px] w-full text-left transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[20px] bg-black/18 blur-[1px]" />
        <div className="absolute bottom-[-12px] left-3 right-[-9px] h-[17px] skew-x-[42deg] rounded-b-[18px] bg-black/14" />
        <div className="absolute right-[-13px] top-3 bottom-[-7px] w-[17px] skew-y-[42deg] rounded-r-[18px] bg-black/16" />
        <div
          className={cn(
            "absolute inset-0 rounded-[20px] border p-3 shadow-[inset_4px_4px_10px_rgba(255,255,255,0.52),inset_-6px_-7px_14px_rgba(15,23,42,0.10),8px_8px_18px_rgba(80,76,65,0.20)]",
            isHexColor(item.color) ? "" : item.color,
          )}
          style={getCustomColorStyle(item.color)}
        >
          <div className="absolute inset-x-3 top-2 h-1 rounded-full bg-white/45" />
          <div className="relative flex h-full flex-col justify-between gap-2">
            <p className="line-clamp-1 text-sm font-black uppercase leading-tight">{item.subject}</p>
            <div className="space-y-1 text-[10px] font-bold opacity-85">
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span className="truncate">{formatTime(item.startTime)} - {formatTime(item.endTime)}</span>
              </div>
              {item.location ? (
                <div className="flex items-center gap-1">
                  {item.type === 'homework' ? <BookOpen size={10} /> : <MapPin size={10} />}
                  <span className="truncate">{item.location}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </button>
    );

    return (
      <div className={cn(
        "overflow-hidden rounded-[34px] border border-white/80 bg-[#f1f0eb] shadow-[18px_18px_42px_rgba(163,159,146,0.36),-14px_-14px_36px_rgba(255,255,255,0.82)]",
        isPhone ? "p-3" : "p-4"
      )}>
        <div className={cn(
          "mb-5 flex items-center justify-between gap-3 rounded-[26px] border border-white/70 bg-white/45 shadow-[8px_8px_22px_rgba(163,159,146,0.22),-8px_-8px_22px_rgba(255,255,255,0.78)] backdrop-blur-xl",
          isPhone ? "px-4 py-3" : "px-5 py-4"
        )}>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-500">3D Prism Timetable</p>
            <p className={cn("font-semibold text-zinc-500", isPhone ? "text-xs" : "text-sm")}>Your timetable blocks as raised rectangular prisms.</p>
          </div>
          <div className="hidden rounded-2xl border border-white/70 bg-[#f7f6f1] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 shadow-[inset_4px_4px_10px_rgba(163,159,146,0.16),inset_-4px_-4px_10px_rgba(255,255,255,0.78)] sm:block">
            Raised prism view
          </div>
        </div>

        <div className="overflow-x-auto pb-6">
          <div className={cn(isPhone ? "min-w-[980px]" : "min-w-[1260px]")}>
            <div className={cn(
              "grid",
              isPhone ? "grid-cols-[64px_repeat(7,minmax(128px,1fr))] gap-3" : "grid-cols-[82px_repeat(7,minmax(156px,1fr))] gap-4"
            )}>
              <div />
              {DAYS.map((day) => (
                <div key={`3d-header-${day}`} className={cn(
                  "rounded-[24px] border border-white/80 bg-[#f8f7f2] text-center shadow-[10px_10px_22px_rgba(163,159,146,0.20),-8px_-8px_18px_rgba(255,255,255,0.86)]",
                  isPhone ? "px-3 py-3" : "px-4 py-4"
                )}>
                  <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{day}</p>
                </div>
              ))}

              {HOURS.map((hour, hourIndex) => (
                <div key={`3d-row-${hour}`} className="contents">
                  <div
                    key={`3d-time-${hour}`}
                    className="flex items-start justify-end pr-2 pt-4 text-[10px] font-black text-zinc-400"
                    style={{ minHeight: `${rowHeights[hourIndex]}px` }}
                  >
                    {formatTime(`${hour.toString().padStart(2, '0')}:00`)}
                  </div>

                  {DAYS.map((day) => {
                    const cellItems = getCellItems(day, hour);

                    return (
                      <div
                        key={`${day}-3d-cell-${hour}`}
                        className={cn(
                          "rounded-[24px] border border-white/70 bg-[#e9e7df] shadow-[inset_7px_7px_18px_rgba(163,159,146,0.18),inset_-7px_-7px_18px_rgba(255,255,255,0.68)]",
                          isPhone ? "p-2.5" : "p-3"
                        )}
                        style={{ minHeight: `${rowHeights[hourIndex]}px` }}
                      >
                        <div className="grid gap-[14px]">
                          {cellItems.map((item) => (
                            <PrismCard key={item.id} item={item} />
                          ))}
                          {cellItems.length === 0 ? (
                            <div className="h-[104px] rounded-[20px] border border-white/35 bg-white/12" />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPhone3DView = () => {
    const dayItems = HOURS.flatMap((hour) => {
      const classItems = entries
        .filter((entry) => entry.day === selectedMobileDay && parseInt(entry.startTime.split(':')[0]) === hour)
        .map((entry) => ({
          id: entry.id,
          type: 'class' as const,
          subject: entry.subject,
          startTime: entry.startTime,
          endTime: entry.endTime,
          color: entry.color || COLORS[0],
          location: entry.location,
        }));

      const homeworkItems = showHomework
        ? homeworkEntries
            .filter((entry) => entry.day === selectedMobileDay && parseInt(entry.timeOfDay.split(':')[0]) === hour)
            .map((entry, index) => {
              const startMinutes = parseMinutes(entry.timeOfDay);
              const durationMinutes = parseDurationMinutes(entry.duration);
              const endMinutes = startMinutes + durationMinutes;
              return {
                id: `hw-phone-3d-${selectedMobileDay}-${hour}-${index}`,
                type: 'homework' as const,
                subject: entry.subject,
                startTime: entry.timeOfDay,
                endTime: `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`,
                color: 'bg-sky-50 text-sky-700 border-sky-200',
                location: entry.technique,
              };
            })
        : [];

      return [...classItems, ...homeworkItems].sort((a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime));
    });

    return (
      <div className="space-y-4">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-100">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">3D Prism Day View</p>
              <h2 className="text-xl font-black text-zinc-900">{selectedMobileDay}</h2>
            </div>
            <div className="rounded-full bg-violet-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">
              isolated day
            </div>
          </div>

          {isCompactView && (
            <div className="mb-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Whole Week Mini View</p>
                <p className="text-[10px] font-bold text-zinc-500">All at once</p>
              </div>
              {renderCompactOverview()}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={() => moveSelectedMobileDay(-1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 shadow-sm"
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Tap a day to switch</p>
            </div>
            <button
              onClick={() => moveSelectedMobileDay(1)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 shadow-sm"
              aria-label="Next day"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide snap-x">
            {DAYS.map((day) => {
              const totalCount = getDayClasses(day).length + getDayHomework(day).length;
              const isSelected = selectedMobileDay === day;
              return (
                <button
                  key={`phone-3d-day-${day}`}
                  onClick={() => setSelectedMobileDay(day)}
                  className={cn(
                    "min-w-[92px] snap-start rounded-[20px] border px-3 py-2.5 text-left transition-all",
                    isSelected ? "border-violet-200 bg-violet-50 shadow-sm shadow-violet-100" : "border-zinc-200 bg-zinc-50"
                  )}
                >
                  <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", isSelected ? "text-violet-600" : "text-zinc-400")}>
                    {day.slice(0, 3)}
                  </p>
                  <p className="mt-2 text-sm font-black text-zinc-900">{totalCount}</p>
                  <p className="text-[10px] font-semibold text-zinc-400">blocks</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {dayItems.length > 0 ? (
              dayItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setIsEditing(true)}
                  className="relative w-full text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-[22px] bg-black/15 blur-[1px]" />
                  <div className="absolute bottom-[-10px] left-3 right-[-8px] h-[14px] skew-x-[38deg] rounded-b-[16px] bg-black/12" />
                  <div className="absolute right-[-10px] top-3 bottom-[-5px] w-[14px] skew-y-[38deg] rounded-r-[16px] bg-black/14" />
                  <div
                    className={cn(
                      "relative rounded-[22px] border p-4 shadow-[inset_3px_3px_8px_rgba(255,255,255,0.52),inset_-5px_-5px_12px_rgba(15,23,42,0.08),8px_8px_18px_rgba(80,76,65,0.16)]",
                      isHexColor(item.color) ? "" : item.color
                    )}
                    style={getCustomColorStyle(item.color)}
                  >
                    <div className="absolute inset-x-3 top-2 h-1 rounded-full bg-white/45" />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-black uppercase leading-tight">{item.subject}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold opacity-85">
                          <Clock size={12} />
                          <span>{formatTime(item.startTime)} - {formatTime(item.endTime)}</span>
                        </div>
                        {item.location ? (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold opacity-75">
                            {item.type === 'homework' ? <BookOpen size={12} /> : <MapPin size={12} />}
                            <span>{item.location}</span>
                          </div>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                        {item.type}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-zinc-200 bg-white px-4 py-10 text-center">
                <p className="text-sm font-bold text-zinc-500">No blocks on {selectedMobileDay} yet.</p>
                <p className="mt-1 text-xs font-medium text-zinc-400">Switch day or use Add / Smart Fill.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleSave = async (newEntries: TimetableEntry[]) => {
    if (!auth.currentUser) return;
    try {
      // Sanitize entries to remove undefined values which Firestore doesn't support
      const sanitizedEntries = newEntries.map(entry => {
        const sanitized: any = {};
        Object.entries(entry).forEach(([key, value]) => {
          if (value !== undefined) {
            sanitized[key] = value;
          }
        });
        return sanitized;
      });

      await setDoc(doc(db, 'timetables', auth.currentUser.uid), {
        userId: auth.currentUser.uid,
        entries: sanitizedEntries,
        updatedAt: new Date().toISOString()
      });
      // We don't necessarily want to close the editor every time we save if manually triggered
      // but for automatic saves it's fine.
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `timetables/${auth.currentUser.uid}`);
      setError("Failed to save changes.");
    }
  };

  const handleCalendarSync = (calendarName: 'apple' | 'google') => {
    if (entries.length === 0) {
      setError("Add at least one class before syncing your timetable.");
      return;
    }

    const events = entries.map((entry) => {
      const eventDate = getNextDateForDay(entry.day);
      const description = entry.teacher ? `Teacher: ${entry.teacher}` : 'Class timetable event from EducationRev.';
      return [
        'BEGIN:VEVENT',
        `UID:${entry.id}@edurev-ai`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
        `DTSTART:${formatIcsDate(eventDate, entry.startTime)}`,
        `DTEND:${formatIcsDate(eventDate, entry.endTime)}`,
        'RRULE:FREQ=WEEKLY;COUNT=52',
        `SUMMARY:${escapeIcsText(entry.subject)}`,
        entry.location ? `LOCATION:${escapeIcsText(entry.location)}` : '',
        `DESCRIPTION:${escapeIcsText(description)}`,
        'END:VEVENT',
      ].filter(Boolean).join('\r\n');
    }).join('\r\n');

    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EducationRev//Class Timetable//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:EducationRev Class Timetable',
      events,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edurev-${calendarName}-timetable.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setError(null);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await geminiGenerateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Extract the class timetable from this image or document. Return a JSON array of objects with fields: subject, day (full name, e.g., Monday), startTime (24h format HH:mm), endTime (24h format HH:mm), location (optional), and teacher (optional). Ensure days are correctly mapped to Monday-Sunday." },
              { inlineData: { data: base64Data, mimeType: file.type } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                subject: { type: "string" },
                day: { type: "string" },
                startTime: { type: "string" },
                endTime: { type: "string" },
                location: { type: "string" },
                teacher: { type: "string" },
              },
              required: ["subject", "day", "startTime", "endTime"]
            }
          }
        }
      });

      const rawText = response.text || '[]';
      const parsedEntries: any[] = JSON.parse(rawText);
      
      const newEntries: TimetableEntry[] = parsedEntries.map((entry, index) => ({
        id: Math.random().toString(36).substr(2, 9),
        subject: entry.subject || 'Unknown Subject',
        day: entry.day || 'Monday',
        startTime: entry.startTime || '09:00',
        endTime: entry.endTime || '10:00',
        location: entry.location || '',
        teacher: entry.teacher || '',
        color: COLORS[(entries.length + index) % COLORS.length]
      }));

      const updatedEntries = [...entries, ...newEntries];
      setEntries(updatedEntries);
      await handleSave(updatedEntries);
      setIsEditing(false);
    } catch (err) {
      console.error("AI Error:", err);
      setError("Failed to parse the file. Please try manual entry or a clearer image.");
    } finally {
      setIsUploading(false);
    }
  };

  const addEntry = () => {
    const newSubject = 'New Class';
    const subjectMatch = entries.find(e => normalizeSubject(e.subject) === normalizeSubject(newSubject));
    const newEntry: TimetableEntry = {
      id: Math.random().toString(36).substr(2, 9),
      subject: newSubject,
      day: 'Monday',
      startTime: '09:00',
      endTime: '10:00',
      color: subjectMatch?.color || COLORS[entries.length % COLORS.length]
    };
    setEntries([...entries, newEntry]);
    setIsEditing(true);
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const updateEntry = (id: string, updates: Partial<TimetableEntry>) => {
    setEntries(currentEntries => {
      const target = currentEntries.find(e => e.id === id);
      if (!target) return currentEntries;

      if (updates.color) {
        const targetSubject = normalizeSubject(target.subject);
        return currentEntries.map(entry =>
          normalizeSubject(entry.subject) === targetSubject
            ? { ...entry, color: updates.color }
            : entry
        );
      }

      if (updates.subject !== undefined) {
        const nextSubject = updates.subject;
        const subjectMatch = currentEntries.find(entry =>
          entry.id !== id && normalizeSubject(entry.subject) === normalizeSubject(nextSubject)
        );

        return currentEntries.map(entry =>
          entry.id === id
            ? { ...entry, ...updates, color: subjectMatch?.color || entry.color }
            : entry
        );
      }

      return currentEntries.map(e => e.id === id ? { ...e, ...updates } : e);
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const phoneActionItems = [
    {
      label: 'Sync Apple',
      icon: CalendarPlus,
      action: () => handleCalendarSync('apple'),
    },
    {
      label: 'Sync Google',
      icon: CalendarPlus,
      action: () => handleCalendarSync('google'),
    },
    {
      label: showHomework ? 'Hide Homework' : 'Show Homework',
      icon: BookOpen,
      action: () => setShowHomework(!showHomework),
    },
    {
      label: is3DView ? 'View in 2D' : 'View in 3D',
      icon: Sparkles,
      action: () => setIs3DView(!is3DView),
    },
    {
      label: is24Hour ? '24h' : '12h',
      icon: Clock,
      action: () => setIs24Hour(!is24Hour),
    },
    {
      label: isEditing ? 'Close editor' : 'Edit',
      icon: Edit3,
      action: () => setIsEditing(!isEditing),
    },
    {
      label: isCompactView ? 'Expanded view' : 'Compact view',
      icon: Calendar,
      action: () => setIsCompactView(!isCompactView),
    },
    {
      label: isUploading ? 'Filling...' : 'Smart Fill',
      icon: isUploading ? Loader2 : Upload,
      action: () => {
        const input = document.getElementById('timetable-upload-input') as HTMLInputElement | null;
        if (!isUploading) input?.click();
      },
    },
  ];

  if (isPhone) {
    const mobileEntries = getDayClasses(selectedMobileDay);
    const mobileHomework = getDayHomework(selectedMobileDay);

    return (
      <div className="mx-auto max-w-7xl space-y-5 p-4">
        <input
          id="timetable-upload-input"
          type="file"
          className="hidden"
          accept="image/*,.pdf"
          onChange={handleFileUpload}
          disabled={isUploading}
        />

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-[1.65rem] font-black tracking-tight text-zinc-900">
                <Calendar className="text-indigo-600" size={26} />
                Timetable
              </h1>
              <p className="mt-1 text-sm font-medium text-zinc-500">Tap a day to zoom into the full schedule.</p>
            </div>
            <button
              onClick={addEntry}
              className="shrink-0 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700"
            >
              <span className="flex items-center gap-2">
                <Plus size={16} />
                Add
              </span>
            </button>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Tools</p>
                <p className="text-[13px] font-semibold leading-snug text-zinc-600">All timetable actions in one menu.</p>
              </div>
              <button
                onClick={() => setShowPhoneActions((value) => !value)}
                className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] font-bold text-zinc-700"
              >
                <MoreHorizontal size={16} />
                More
                <ChevronDown size={16} className={cn("transition-transform", showPhoneActions && "rotate-180")} />
              </button>
            </div>

            <AnimatePresence>
              {showPhoneActions && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-3 grid grid-cols-1 gap-2"
                >
                  {phoneActionItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        item.action();
                        setShowPhoneActions(false);
                      }}
                      className="flex min-h-[46px] items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-[13px] font-bold text-zinc-700 shadow-sm"
                    >
                      <item.icon size={16} className={cn(item.label === 'Smart Fill' && isUploading && "animate-spin")} />
                      <span className="leading-tight">{item.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600">
            <Sparkles size={18} />
            {error}
          </div>
        )}

        {is3DView ? (
          renderPhone3DView()
        ) : (
        <div className="rounded-[32px] border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-100">
          <div className="mb-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Week View</p>
              <p className="text-xs font-bold text-zinc-500">Tap a day to zoom in</p>
            </div>
            {isCompactView ? (
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-3">
                {renderCompactOverview()}
              </div>
            ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide snap-x">
              {DAYS.map((day) => {
                const dayEntries = getDayClasses(day);
                const dayHomeworkEntries = getDayHomework(day);
                const isSelected = selectedMobileDay === day;
                const totalItems = dayEntries.length + dayHomeworkEntries.length;
                const firstClass = dayEntries[0];
                const firstHomework = dayHomeworkEntries[0];
                const previewTime = firstClass?.startTime || firstHomework?.timeOfDay;
                const previewLabel = firstClass?.subject || firstHomework?.subject || 'No classes';
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedMobileDay(day)}
                    className={cn(
                      "min-w-[102px] snap-start rounded-[24px] border px-3 py-3 text-left transition-all",
                      isSelected
                        ? "border-indigo-200 bg-indigo-50 shadow-md shadow-indigo-100"
                        : "border-zinc-200 bg-zinc-50/70 shadow-sm"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-[10px] font-black uppercase tracking-[0.18em]", isSelected ? "text-indigo-600" : "text-zinc-400")}>
                        {day.slice(0, 3)}
                      </p>
                      <div className={cn(
                        "rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]",
                        isSelected ? "bg-white text-indigo-600" : "bg-white/80 text-zinc-500"
                      )}>
                        {totalItems}
                      </div>
                    </div>
                    <p className={cn("mt-3 line-clamp-2 text-sm font-black leading-tight", isSelected ? "text-zinc-900" : "text-zinc-800")}>
                      {previewLabel}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-zinc-500">
                      {previewTime ? formatTime(previewTime) : 'Free day'}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-zinc-400">
                      {totalItems === 0 ? 'Tap to add' : totalItems === 1 ? '1 block' : `${totalItems} blocks`}
                    </p>
                  </button>
                );
              })}
            </div>
            )}
          </div>

          <div className="rounded-[28px] border border-zinc-100 bg-[#F8FAFC] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                onClick={() => moveSelectedMobileDay(-1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 shadow-sm"
                aria-label="Previous day"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Selected Day</p>
                <h2 className="text-xl font-black text-zinc-900">{selectedMobileDay}</h2>
              </div>
              <button
                onClick={() => moveSelectedMobileDay(1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 shadow-sm"
                aria-label="Next day"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 shadow-sm">
                Apple-style day zoom
              </div>
              <div className="rounded-full bg-zinc-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                {mobileEntries.length + mobileHomework.length} blocks
              </div>
            </div>

            <div className="space-y-3">
              {mobileEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setIsEditing(true)}
                  className={cn(
                    "w-full rounded-[24px] border p-4 text-left shadow-sm transition-all",
                    isHexColor(entry.color) ? "" : entry.color || COLORS[0]
                  )}
                  style={getCustomColorStyle(entry.color)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-black leading-tight">{entry.subject}</h3>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold opacity-80">
                        <Clock size={12} />
                        <span>{formatTime(entry.startTime)} - {formatTime(entry.endTime)}</span>
                      </div>
                      {entry.location && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold opacity-75">
                          <MapPin size={12} />
                          <span>{entry.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                      Class
                    </div>
                  </div>
                </button>
              ))}

              {mobileHomework.map((entry, index) => (
                <div
                  key={`mobile-hw-${selectedMobileDay}-${index}`}
                  className="w-full rounded-[24px] border border-sky-200 bg-sky-50 p-4 text-left shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-black leading-tight text-sky-700">{entry.subject}</h3>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-sky-600">
                        <Clock size={12} />
                        <span>{formatTime(entry.timeOfDay)} · {entry.duration}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-sky-600">
                        <BookOpen size={12} />
                        <span>{entry.technique}</span>
                      </div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">
                      Homework
                    </div>
                  </div>
                </div>
              ))}

              {mobileEntries.length === 0 && mobileHomework.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-zinc-200 bg-white px-4 py-10 text-center">
                  <p className="text-sm font-bold text-zinc-500">No classes on {selectedMobileDay} yet.</p>
                  <p className="mt-1 text-xs font-medium text-zinc-400">Use Add or Smart Fill to build this day.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
            >
              <div className="rounded-t-[30px] border border-zinc-800 bg-zinc-900 p-4 text-white shadow-2xl shadow-zinc-900/40">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-black tracking-tight">
                    <Sparkles className="text-amber-400" size={18} />
                    Edit Timetable
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300"
                    >
                      Close
                    </button>
                    <button
                      onClick={async () => {
                        await handleSave(entries);
                        setIsEditing(false);
                      }}
                      className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                  {entries.map((entry) => (
                    <div key={entry.id} className="space-y-3 rounded-2xl border border-zinc-700/60 bg-zinc-800/60 p-3">
                      <input
                        value={entry.subject}
                        onChange={(e) => updateEntry(entry.id, { subject: e.target.value })}
                        className="w-full rounded-xl border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={entry.day}
                          onChange={(e) => updateEntry(entry.id, { day: e.target.value })}
                          className="w-full rounded-xl border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <input
                          value={entry.location || ''}
                          onChange={(e) => updateEntry(entry.id, { location: e.target.value })}
                          placeholder="Location"
                          className="w-full rounded-xl border-zinc-700 bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="time"
                          value={entry.startTime}
                          onChange={(e) => updateEntry(entry.id, { startTime: e.target.value })}
                          className="w-full rounded-xl border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="time"
                          value={entry.endTime}
                          onChange={(e) => updateEntry(entry.id, { endTime: e.target.value })}
                          className="w-full rounded-xl border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_HEX_VALUES.map((hexColor, colorIndex) => {
                            const isSelected = isSelectedSwatch(entry.color, colorIndex);

                            return (
                            <button
                              key={hexColor}
                              type="button"
                              onClick={() => updateEntry(entry.id, { color: hexColor })}
                              className={cn(
                                "relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-lg border transition-all",
                                isSelected
                                  ? "scale-110 ring-2 ring-white/80 shadow-[0_0_0_1px_rgba(24,24,27,0.28)]"
                                  : "opacity-80 hover:scale-105 hover:opacity-100"
                              )}
                              style={{
                                backgroundColor: hexColor,
                                borderColor: isSelected ? hexColor : 'rgba(255,255,255,0.18)',
                              }}
                              aria-pressed={isSelected}
                            >
                              {isSelected ? (
                                <Check
                                  size={14}
                                  className="drop-shadow-sm"
                                  style={{ color: getReadableTextColor(hexColor) }}
                                />
                              ) : null}
                            </button>
                          )})}
                        </div>
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="rounded-xl bg-red-500/10 p-2.5 text-red-500 transition-all hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
            <Calendar className="text-indigo-600" size={32} />
            Class Schedule Timetable
          </h1>
          <p className="text-zinc-500 font-medium mt-1">Manage your classes and study sessions</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleCalendarSync('apple')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-zinc-200 text-zinc-700 font-bold text-sm hover:border-teal-600 hover:text-teal-700 shadow-sm transition-all"
          >
            <CalendarPlus size={18} />
            Sync Apple
          </button>
          <button
            onClick={() => handleCalendarSync('google')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-zinc-200 text-zinc-700 font-bold text-sm hover:border-emerald-600 hover:text-emerald-700 shadow-sm transition-all"
          >
            <CalendarPlus size={18} />
            Sync Google
          </button>
          <button 
            onClick={() => setShowHomework(!showHomework)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all",
              showHomework 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                : "bg-white border border-zinc-200 text-zinc-700 hover:border-indigo-600 hover:text-indigo-600 shadow-sm"
            )}
          >
            <BookOpen size={18} />
            {showHomework ? "Hide Homework" : "Show Homework"}
          </button>
          <button
            onClick={() => setIs3DView(!is3DView)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all",
              is3DView
                ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
                : "bg-white border border-zinc-200 text-zinc-700 hover:border-violet-600 hover:text-violet-600 shadow-sm"
            )}
          >
            <Sparkles size={18} />
            {is3DView ? "View in 2D" : "View in 3D"}
          </button>
          <button 
            onClick={() => setIs24Hour(!is24Hour)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-zinc-200 text-zinc-700 font-bold text-sm hover:border-zinc-900 hover:text-zinc-900 shadow-sm transition-all"
          >
            <Clock size={18} />
            {is24Hour ? "24h" : "12h"}
          </button>
          <button
            onClick={() => setIsCompactView(!isCompactView)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all",
              isCompactView
                ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20"
                : "bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 shadow-sm"
            )}
          >
            <Calendar size={18} />
            {isCompactView ? "Expanded View" : "Compact View"}
          </button>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all",
              isEditing 
                ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20" 
                : "bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 shadow-sm"
            )}
          >
            <Edit3 size={18} />
            {isEditing ? "Close Editor" : "Edit Mode"}
          </button>
          <label className="cursor-pointer">
            <input 
              type="file" 
              className="hidden" 
              accept="image/*,.pdf" 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <div className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all",
              isUploading 
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" 
                : "bg-white border border-zinc-200 text-zinc-700 hover:border-indigo-600 hover:text-indigo-600 shadow-sm"
            )}>
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              Smart Fill
            </div>
          </label>
          <button 
            onClick={addEntry}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
          >
            <Plus size={18} />
            Add Class
          </button>
          {isEditing && (
            <button 
              onClick={() => handleSave(entries)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all"
            >
              <Save size={18} />
              Save Changes
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2">
          <Sparkles size={18} />
          {error}
        </div>
      )}

      {/* Grid View */}
      {is3DView ? render3DView() : (
      <div className="bg-white rounded-[32px] border border-zinc-200 shadow-xl shadow-zinc-100 overflow-hidden">
        <div className="overflow-x-auto">
          <div className={cn(isCompactView ? "min-w-[840px]" : "min-w-[1000px]")}>
            {/* Days Header */}
            <div className="grid grid-cols-8 border-bottom border-zinc-100 bg-zinc-50/50">
              <div className="p-4 border-r border-zinc-100"></div>
              {DAYS.map(day => (
                <div key={day} className={cn(
                  "text-center font-black uppercase tracking-widest text-zinc-400 border-r border-zinc-100 last:border-r-0",
                  isCompactView ? "p-3 text-[10px]" : "p-4 text-xs"
                )}>
                  {day}
                </div>
              ))}
            </div>

            {/* Time Slots */}
            <div className="relative">
              {HOURS.map(hour => (
                <div key={hour} className="grid grid-cols-8 border-b border-zinc-50 last:border-b-0 group">
                  <div className={cn(
                    "text-right font-mono text-[10px] text-zinc-400 border-r border-zinc-100 bg-zinc-50/30",
                    isCompactView ? "p-3" : "p-4"
                  )}>
                    {formatTime(`${hour.toString().padStart(2, '0')}:00`)}
                  </div>
                  {DAYS.map(day => (
                    <div key={`${day}-${hour}`} className={cn(
                      "p-1 border-r border-zinc-50 last:border-r-0 relative",
                      isCompactView ? "min-h-[58px]" : "min-h-[80px]"
                    )}>
                      {entries
                        .filter(e => e.day === day && parseInt(e.startTime.split(':')[0]) === hour)
                        .map(entry => (
                          <motion.div
                            layoutId={entry.id}
                            key={entry.id}
                            className={cn(
                              "absolute inset-x-1 z-10 rounded-xl border font-bold shadow-sm transition-all cursor-pointer group/item",
                              isCompactView ? "p-1.5 text-[9px]" : "p-2 text-[10px]",
                              isHexColor(entry.color) ? "" : entry.color || COLORS[0]
                            )}
                            style={{
                              top: '4px',
                              height: `${(parseInt(entry.endTime.split(':')[0]) - parseInt(entry.startTime.split(':')[0])) * (isCompactView ? 58 : 80) - 8}px`,
                              ...getCustomColorStyle(entry.color),
                            }}
                            onClick={() => setIsEditing(true)}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="line-clamp-1 uppercase tracking-tight">{entry.subject}</span>
                              {isEditing && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }}
                                  className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-white/50 rounded-lg transition-all"
                                >
                                  <Trash2 size={12} className="text-red-500" />
                                </button>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 opacity-80">
                              <div className="flex items-center gap-1">
                                <Clock size={10} />
                                {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
                              </div>
                              {entry.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin size={10} />
                                  {entry.location}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                        {showHomework && homeworkEntries
                          .filter(e => e.day === day && parseInt(e.timeOfDay.split(':')[0]) === hour)
                          .map((entry, index) => {
                            const startMinutes = parseMinutes(entry.timeOfDay);
                            const offsetMinutes = startMinutes - hour * 60;
                            const durationMinutes = parseDurationMinutes(entry.duration);
                            const height = Math.max(28, (durationMinutes / 60) * 80 - 8);
                            return (
                              <motion.div
                                key={`hw-${index}`}
                                className={cn(
                                  "absolute inset-x-1 z-20 rounded-xl border border-sky-200 bg-sky-50 font-bold shadow-sm cursor-pointer",
                                  isCompactView ? "p-1.5 text-[9px]" : "p-2 text-[10px]"
                                )}
                                style={{
                                  top: `${4 + (offsetMinutes / 60) * (isCompactView ? 58 : 80)}px`,
                                  height: `${Math.max(24, (durationMinutes / 60) * (isCompactView ? 58 : 80) - 8)}px`
                                }}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <span className="line-clamp-1 uppercase tracking-tight text-sky-700">{entry.subject}</span>
                                </div>
                                <div className="flex flex-col gap-0.5 text-sky-600">
                                  <div className="flex items-center gap-1">
                                    <BookOpen size={10} />
                                    {entry.technique}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Editor Panel */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-50"
          >
            <div className="bg-zinc-900 text-white rounded-[32px] p-6 shadow-2xl shadow-zinc-900/40 border border-zinc-800">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <Sparkles className="text-amber-400" size={20} />
                  Edit Timetable
                </h3>
                <div className="flex items-center gap-2">
                  {showClearConfirm ? (
                    <div className="flex items-center gap-2 mr-4 bg-red-500/10 p-1 rounded-xl border border-red-500/20">
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-500 px-2">Clear all?</span>
                      <button 
                        onClick={() => {
                          setEntries([]);
                          handleSave([]);
                          setShowClearConfirm(false);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-500 text-white font-bold text-[10px] hover:bg-red-600 transition-all"
                      >
                        Yes
                      </button>
                      <button 
                        onClick={() => setShowClearConfirm(false)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 font-bold text-[10px] hover:text-white transition-all"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowClearConfirm(true)}
                      className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500 hover:text-white transition-all mr-2"
                    >
                      Clear All
                    </button>
                  )}
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 font-bold text-sm hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      await handleSave(entries);
                      setIsEditing(false);
                    }}
                    className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-4 md:grid-cols-[minmax(180px,1.55fr)_minmax(130px,0.9fr)_minmax(180px,1fr)_minmax(140px,0.82fr)_minmax(140px,0.82fr)_minmax(140px,0.9fr)_68px]"
                  >
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Subject</label>
                      <input 
                        value={entry.subject}
                        onChange={(e) => updateEntry(entry.id, { subject: e.target.value })}
                        className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Day</label>
                      <select 
                        value={entry.day}
                        onChange={(e) => updateEntry(entry.id, { day: e.target.value })}
                        className="w-full truncate bg-zinc-800 border-zinc-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                      >
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Colour</label>
                        <button
                          type="button"
                          className="group/help relative flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-zinc-400 transition-colors hover:border-indigo-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                          aria-label="Colour help"
                        >
                          <HelpCircle size={12} />
                          <span className="pointer-events-none absolute left-1/2 top-6 z-50 w-56 -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-[11px] font-semibold leading-snug text-zinc-200 opacity-0 shadow-2xl shadow-black/40 transition-opacity group-hover/help:opacity-100 group-focus-visible/help:opacity-100">
                            One colour is used per class subject. If you change Science to blue, every Science slot becomes blue.
                          </span>
                        </button>
                      </div>
                      <div className="flex h-[38px] items-center gap-1.5 rounded-xl bg-zinc-800 border border-zinc-700 px-2">
                        {COLOR_HEX_VALUES.map((hexColor, colorIndex) => {
                          const isSelected = isSelectedSwatch(entry.color, colorIndex);

                          return (
                          <button
                            key={hexColor}
                            type="button"
                            onClick={() => updateEntry(entry.id, { color: hexColor })}
                            className={cn(
                              "relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-lg border transition-all hover:scale-110 focus-visible:ring-2 focus-visible:ring-indigo-400",
                              isSelected
                                ? "scale-110 ring-2 ring-white/80 shadow-[0_0_0_1px_rgba(24,24,27,0.28)]"
                                : "opacity-70 hover:opacity-100"
                            )}
                            style={{
                              backgroundColor: hexColor,
                              borderColor: isSelected ? hexColor : 'rgba(255,255,255,0.18)',
                            }}
                            title={`Choose this colour for every ${entry.subject || 'matching subject'} class`}
                            aria-pressed={isSelected}
                          >
                            {isSelected ? (
                              <Check
                                size={14}
                                className="drop-shadow-sm"
                                style={{ color: getReadableTextColor(hexColor) }}
                              />
                            ) : null}
                          </button>
                        )})}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Start</label>
                      <input 
                        type="time"
                        value={entry.startTime}
                        onChange={(e) => updateEntry(entry.id, { startTime: e.target.value })}
                        className="w-full min-w-[110px] rounded-xl border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">End</label>
                      <input 
                        type="time"
                        value={entry.endTime}
                        onChange={(e) => updateEntry(entry.id, { endTime: e.target.value })}
                        className="w-full min-w-[110px] rounded-xl border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white [color-scheme:dark] outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1 block">Location</label>
                      <input 
                        value={entry.location || ''}
                        onChange={(e) => updateEntry(entry.id, { location: e.target.value })}
                        placeholder="Room 101"
                        className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={() => removeEntry(entry.id)}
                        className="w-full p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all md:w-auto"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {entries.length === 0 && (
                  <div className="text-center py-12 text-zinc-500">
                    No classes added yet. Use "Smart Fill" or click "Add Class".
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
