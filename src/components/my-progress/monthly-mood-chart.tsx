import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { auth, db } from '@/firebase';
import { doc, increment, onSnapshot, serverTimestamp, setDoc, updateDoc } from '@/lib/portal-firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Angry, Coffee, Frown, Meh, Smile, Sparkles, X, Zap } from 'lucide-react';

const emotions = [
  { name: 'Happy', short: 'Hap', icon: Smile, color: '#22c55e' },
  { name: 'Calm', short: 'Cal', icon: Coffee, color: '#60a5fa' },
  { name: 'Neutral', short: 'Neu', icon: Meh, color: '#94a3b8' },
  { name: 'Anxious', short: 'Anx', icon: Zap, color: '#facc15' },
  { name: 'Sad', short: 'Sad', icon: Frown, color: '#3b82f6' },
  { name: 'Angry', short: 'Ang', icon: Angry, color: '#ef4444' },
];

export function MonthlyMoodChart() {
  const [daily, setDaily] = useState<Record<string, string>>({});
  const [dailyCounts, setDailyCounts] = useState<Record<string, Record<string, number>>>({});
  const [visibleMonths, setVisibleMonths] = useState<1 | 4>(1);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [quickLogMessage, setQuickLogMessage] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  useEffect(() => {
    let unsubSnapshot = () => {};
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubSnapshot();
      unsubSnapshot = () => {};
      if (!user) {
        setDaily({});
        setActiveUserId(null);
        return;
      }
      setActiveUserId(user.uid);
      const ref = doc(db, 'mood_logs', user.uid);
      unsubSnapshot = onSnapshot(ref, (snap) => {
        const data = snap.data() as any;
        // dailyCounts: { "YYYY-MM-DD": { Hap: 1, Cal: 2, ... } }
        setDailyCounts((data?.dailyCounts as Record<string, Record<string, number>>) || {});
        setDaily((data?.daily as Record<string, string>) || {});
      });
    });
    return () => {
      unsubAuth();
      unsubSnapshot();
    };
  }, []);

  const monthViews = useMemo(() => {
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekStartsOn = 1; // Monday
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const out: Array<{ label: string; cells: Array<{ dateKey: string | null; day: number | null }> }> = [];

    for (let offset = visibleMonths - 1; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const first = new Date(year, month, 1);
      const leading = (first.getDay() - weekStartsOn + 7) % 7;
      const total = leading + daysInMonth;
      const trailing = (7 - (total % 7)) % 7;

      const cells: Array<{ dateKey: string | null; day: number | null }> = [];
      for (let i = 0; i < leading; i++) cells.push({ dateKey: null, day: null });
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${pad2(month + 1)}-${pad2(day)}`;
        cells.push({ dateKey, day });
      }
      for (let i = 0; i < trailing; i++) cells.push({ dateKey: null, day: null });

      out.push({
        label: `${monthNames[month]} ${year}`,
        cells,
      });
    }
    return out;
  }, [visibleMonths]);

  const moodStyleFor = (moodShort?: string) => {
    // Solid colors keep the dots crisp against the glass background.
    if (moodShort === 'Hap') return { backgroundColor: '#22c55e' };
    if (moodShort === 'Cal') return { backgroundColor: '#60a5fa' };
    if (moodShort === 'Neu') return { backgroundColor: '#cbd5e1' };
    if (moodShort === 'Anx') return { backgroundColor: '#facc15' };
    if (moodShort === 'Sad') return { backgroundColor: '#3b82f6' };
    if (moodShort === 'Ang') return { backgroundColor: '#ef4444' };
    return { backgroundColor: '#d9dee7' };
  };

  const majorityMoodForDay = (dateKey: string) => {
    const counts = dailyCounts?.[dateKey];
    if (!counts || typeof counts !== 'object') return undefined;
    const entries = Object.entries(counts).filter(([, v]) => typeof v === 'number' && v > 0) as Array<[string, number]>;
    if (entries.length === 0) return undefined;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };

  const formatLocalDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleQuickLogMood = async (moodName: string) => {
    if (!activeUserId) return;
    const shortName = emotions.find((emotion) => emotion.name === moodName)?.short;
    if (!shortName) return;
    const docRef = doc(db, 'mood_logs', activeUserId);
    const dateKey = formatLocalDateKey(new Date());

    await setDoc(docRef, {}, { merge: true });
    await updateDoc(docRef, {
      [shortName]: increment(1),
      [`daily.${dateKey}`]: shortName,
      [`dailyCounts.${dateKey}.${shortName}`]: increment(1),
      [`dailyLastAt.${dateKey}`]: serverTimestamp(),
      lastLoggedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setQuickLogMessage(`Logged ${moodName.toLowerCase()} for today.`);
  };

  return (
    <>
      <Card className="relative overflow-hidden rounded-[34px] border border-white/70 bg-white/34 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.36),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))] backdrop-blur-[3px]" />
      <CardHeader className="relative z-10 pb-1 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex max-w-[52%] rounded-full border border-white/55 bg-white/30 px-3 py-1 backdrop-blur-md">
            <CardTitle className="text-xs font-black uppercase tracking-[0.22em] text-zinc-600">Monthly Mood</CardTitle>
          </div>
          <div className="shrink-0">
            <button
              onClick={() => setVisibleMonths((prev) => (prev === 1 ? 4 : 1))}
              className="rounded-full bg-white/90 px-3 py-1.5 text-center text-xs font-black text-zinc-700 hover:bg-white transition"
            >
              {visibleMonths === 1 ? 'Show 4 Months' : 'Show 1 Month'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 flex flex-col gap-4 pb-4 pt-3">
        <div className={cn('grid gap-4', visibleMonths === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
          {monthViews.map((monthView) => (
            <div key={monthView.label} className="mt-2 rounded-[24px] border border-white/55 bg-white/22 p-3.5 backdrop-blur-md">
              <div className="mb-2 text-sm font-bold tracking-tight text-zinc-800">{monthView.label}</div>
              {visibleMonths === 1 ? (
                <div className="grid grid-cols-7 justify-items-center gap-x-3 gap-y-3 px-1 py-3">
                  {monthView.cells.map((c, i) => {
                    const moodShort = c.dateKey ? (majorityMoodForDay(c.dateKey) || daily[c.dateKey]) : undefined;
                    const style = moodStyleFor(moodShort);
                    return (
                      <div
                        key={`${monthView.label}-${c.dateKey ?? 'x'}-${i}`}
                        className={cn(
                          'h-4 w-4 rounded-full transition-all duration-200 sm:h-5 sm:w-5',
                          c.dateKey ? 'cursor-pointer hover:scale-105' : 'opacity-20'
                        )}
                        style={style}
                        title={c.dateKey ? `${c.dateKey}${moodShort ? ` • ${moodShort}` : ''}` : ''}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-7 justify-items-center gap-x-3 gap-y-2.5">
                  {monthView.cells.map((c, i) => {
                    const moodShort = c.dateKey ? (majorityMoodForDay(c.dateKey) || daily[c.dateKey]) : undefined;
                    const style = moodStyleFor(moodShort);
                    return (
                      <div
                        key={`${monthView.label}-${c.dateKey ?? 'x'}-${i}`}
                        className={cn(
                          'h-[18px] w-[18px] rounded-full transition-all duration-200 sm:h-5 sm:w-5',
                          c.dateKey ? 'cursor-pointer hover:scale-105' : 'opacity-20'
                        )}
                        style={style}
                        title={c.dateKey ? `${c.dateKey}${moodShort ? ` • ${moodShort}` : ''}` : ''}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-auto flex justify-center pt-2">
          <button
            onClick={() => setIsQuickLogOpen(true)}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-[0_12px_30px_rgba(5,150,105,0.28)] hover:bg-emerald-700 transition"
          >
            Log Mood
          </button>
        </div>
      </CardContent>
      </Card>

      {isQuickLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Mood Shortcut</p>
                <h3 className="text-2xl font-black text-zinc-900">Log Mood For Today</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsQuickLogOpen(false);
                  setQuickLogMessage(null);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-500 hover:bg-zinc-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {emotions.map((emotion) => {
                  const Icon = emotion.icon;
                  return (
                    <button
                      key={emotion.name}
                      type="button"
                      onClick={() => handleQuickLogMood(emotion.name)}
                      className="flex items-center justify-between rounded-3xl border px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5"
                      style={{
                        borderColor: `${emotion.color}55`,
                        background: `linear-gradient(135deg, ${emotion.color}22 0%, rgba(255,255,255,0.92) 70%)`,
                      }}
                    >
                      <div>
                        <p className="text-sm font-black text-zinc-900">{emotion.name}</p>
                        <p className="mt-1 text-xs font-semibold" style={{ color: emotion.color }}>Tap to log today</p>
                      </div>
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border"
                        style={{ backgroundColor: `${emotion.color}1f`, color: emotion.color, borderColor: `${emotion.color}40` }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                    </button>
                  );
                })}
              </div>
              {quickLogMessage && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  {quickLogMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
