import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from '@/lib/portal-firestore';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Loader2, Save, StickyNote, X } from 'lucide-react';
import { auth, db } from '../firebase';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

type MonthDayNotes = Record<string, Record<string, string>>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  return {
    leadingBlanks,
    days: Array.from({ length: totalDays }, (_, index) => index + 1),
  };
}

function escapeIcsText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function formatAllDayIcsDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export default function CalendarYearPage() {
  const { isPhone } = useResponsiveDevice();
  const today = new Date();
  const year = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDate = today.getDate();
  const [userId, setUserId] = useState<string | null>(null);
  const [monthNotes, setMonthNotes] = useState<MonthDayNotes>({});
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [draftDayNotes, setDraftDayNotes] = useState<Record<string, string>>({});
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showPastMonths, setShowPastMonths] = useState(false);

  const monthOrder = useMemo(() => {
    if (!isPhone) return MONTHS.map((_, index) => index);
    const upcoming = MONTHS.map((_, index) => index).filter((index) => index >= currentMonth);
    const past = MONTHS.map((_, index) => index).filter((index) => index < currentMonth);
    return [...upcoming, ...past];
  }, [currentMonth, isPhone]);

  const visibleMonthOrder = useMemo(() => {
    if (!isPhone) return monthOrder;
    return monthOrder.filter((index) => index >= currentMonth);
  }, [currentMonth, isPhone, monthOrder]);

  const pastMonthOrder = useMemo(
    () => MONTHS.map((_, index) => index).filter((index) => index < currentMonth),
    [currentMonth]
  );

  useEffect(() => {
    let unsubscribeNotes = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeNotes();
      setSaveMessage(null);

      if (!user) {
        setUserId(null);
        setMonthNotes({});
        setLoadingNotes(false);
        return;
      }

      setUserId(user.uid);
      setLoadingNotes(true);
      unsubscribeNotes = onSnapshot(
        doc(db, 'calendarNotes', user.uid),
        (snapshot) => {
          const years = snapshot.data()?.years || {};
          const rawYearNotes = years[String(year)] || {};
          const normalizedNotes = Object.entries(rawYearNotes).reduce<MonthDayNotes>((acc, [month, value]) => {
            if (typeof value === 'string') {
              acc[month] = value ? { '1': value } : {};
            } else if (value && typeof value === 'object') {
              acc[month] = value as Record<string, string>;
            }
            return acc;
          }, {});
          setMonthNotes(normalizedNotes);
          setLoadingNotes(false);
        },
        (error) => {
          console.error('Calendar notes listener error:', error);
          setSaveMessage('Could not load saved calendar notes.');
          setLoadingNotes(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeNotes();
    };
  }, [year]);

  const openMonth = (monthIndex: number) => {
    setSelectedMonth(monthIndex);
    setDraftDayNotes(monthNotes[String(monthIndex)] || {});
    setSaveMessage(null);
  };

  const saveMonthNote = async () => {
    if (selectedMonth === null || !userId) return;

    const cleanedDayNotes = Object.entries(draftDayNotes).reduce<Record<string, string>>((acc, [day, text]) => {
      const trimmed = text.trim();
      if (trimmed) acc[day] = trimmed;
      return acc;
    }, {});

    const nextNotes = {
      ...monthNotes,
      [String(selectedMonth)]: cleanedDayNotes,
    };

    setSavingNote(true);
    setSaveMessage(null);

    try {
      await setDoc(
        doc(db, 'calendarNotes', userId),
        {
          userId,
          years: {
            [String(year)]: nextNotes,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setMonthNotes(nextNotes);
      setSaveMessage(`${MONTHS[selectedMonth]} note saved.`);
    } catch (error) {
      console.error('Calendar note save error:', error);
      setSaveMessage('Could not save this note. Please try again.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleCalendarSync = (calendarName: 'apple' | 'google') => {
    const noteEvents = Object.entries(monthNotes).flatMap(([monthKey, dayMap]) => {
      const monthIndex = Number(monthKey);
      return Object.entries(dayMap)
        .filter(([, note]) => note.trim())
        .map(([day, note]) => {
          const date = new Date(year, monthIndex, Number(day));
          const start = formatAllDayIcsDate(date);
          const endDate = new Date(date);
          endDate.setDate(endDate.getDate() + 1);
          const end = formatAllDayIcsDate(endDate);

          return [
            'BEGIN:VEVENT',
            `UID:calendar-note-${year}-${monthIndex}-${day}@edurev-ai`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
            `DTSTART;VALUE=DATE:${start}`,
            `DTEND;VALUE=DATE:${end}`,
            `SUMMARY:${escapeIcsText(`${MONTHS[monthIndex]} ${day} note`)}`,
            `DESCRIPTION:${escapeIcsText(note)}`,
            'END:VEVENT',
          ].join('\r\n');
        });
    });

    if (noteEvents.length === 0) {
      setSaveMessage('Add at least one calendar note before syncing.');
      return;
    }

    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EducationRev//Calendar Notes//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:EducationRev Calendar Notes',
      ...noteEvents,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edurev-${calendarName}-calendar-notes.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSaveMessage(`${calendarName === 'apple' ? 'Apple' : 'Google'} calendar file downloaded.`);
  };

  return (
    <div className={isPhone ? "mx-auto max-w-7xl space-y-5 p-4" : "mx-auto max-w-7xl space-y-8 p-6"}>
      <div className={isPhone ? "space-y-4 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-100" : "flex flex-col gap-4 rounded-[32px] border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-100 md:flex-row md:items-center md:justify-between"}>
        <div>
          <div className={isPhone ? "mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700" : "mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-sm font-black text-teal-700"}>
            <CalendarDays size={16} />
            Current Year Calendar
          </div>
          <h1 className={isPhone ? "text-[2rem] font-black tracking-tight text-zinc-900" : "text-4xl font-black tracking-tight text-zinc-900"}>{year} Calendar</h1>
          <p className={isPhone ? "mt-2 text-sm font-medium leading-6 text-zinc-500" : "mt-2 text-sm font-medium text-zinc-500"}>
            {isPhone
              ? 'Current month is shown first. Past months stay collapsed until you open them.'
              : 'Today is highlighted. Click any month to open a calendar popup and add notes to each day.'}
          </p>

          {isPhone && (
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => handleCalendarSync('apple')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-black text-zinc-800 shadow-sm"
              >
                <Download size={14} />
                Sync Apple
              </button>
              <button
                onClick={() => handleCalendarSync('google')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-black text-zinc-800 shadow-sm"
              >
                <Download size={14} />
                Sync Google
              </button>
            </div>
          )}
        </div>
        <div className={isPhone ? "flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-700" : "flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-700"}>
          <ChevronLeft size={18} className="text-zinc-300" />
          {today.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
          <ChevronRight size={18} className="text-zinc-300" />
        </div>
      </div>

      {isPhone && currentMonth > 0 && (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-3 shadow-sm">
          <button
            onClick={() => setShowPastMonths((value) => !value)}
            className="flex w-full items-center justify-between rounded-2xl px-2 py-2 text-left"
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400">Past Months</p>
              <p className="mt-1 text-sm font-semibold text-zinc-600">
                {showPastMonths ? 'Hide earlier months' : 'Show earlier months'}
              </p>
            </div>
            <ChevronDown size={18} className={showPastMonths ? 'rotate-180 text-zinc-500 transition-transform' : 'text-zinc-500 transition-transform'} />
          </button>

          {showPastMonths && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {pastMonthOrder.map((monthIndex) => {
                const noteCount = Object.values(monthNotes[String(monthIndex)] || {}).filter(Boolean).length;

                return (
                  <button
                    key={`past-month-${monthIndex}`}
                    onClick={() => openMonth(monthIndex)}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-left shadow-sm transition active:scale-[0.98]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      {MONTHS[monthIndex].slice(0, 3)}
                    </p>
                    <p className="mt-1 text-sm font-black text-zinc-900">{MONTHS[monthIndex]}</p>
                    {noteCount > 0 && <p className="mt-1 text-[11px] font-bold text-teal-700">{noteCount} notes</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className={isPhone ? "space-y-4" : "grid gap-5 md:grid-cols-2 xl:grid-cols-3"}>
        {visibleMonthOrder.map((monthIndex) => {
          const monthName = MONTHS[monthIndex];
          const { leadingBlanks, days } = getMonthDays(year, monthIndex);
          const isCurrentMonth = monthIndex === currentMonth;
          const notes = monthNotes[String(monthIndex)] || {};
          const noteEntries = Object.values(notes).filter(Boolean);
          const notePreview = noteEntries[0] || '';
          const isSelected = selectedMonth === monthIndex;

          return (
            <section
              key={monthName}
              onClick={() => openMonth(monthIndex)}
              className={[
                isPhone
                  ? 'cursor-pointer rounded-[26px] border bg-white p-4 shadow-sm transition'
                  : 'cursor-pointer rounded-[28px] border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zinc-100',
                isSelected ? 'border-teal-500 ring-4 ring-teal-100' : 'border-zinc-200',
              ].join(' ')}
            >
              <div className={isPhone ? "mb-3 flex items-center justify-between" : "mb-4 flex items-center justify-between"}>
                <div>
                  <h2 className={isPhone ? "text-lg font-black tracking-tight text-zinc-900" : "text-xl font-black tracking-tight text-zinc-900"}>{monthName}</h2>
                  {notePreview && (
                    <p className="mt-1 line-clamp-1 text-xs font-bold text-teal-700">
                      {notePreview}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {loadingNotes && isCurrentMonth && <Loader2 size={15} className="animate-spin text-zinc-300" />}
                  {noteEntries.length > 0 && (
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-teal-50 px-2 text-xs font-black text-teal-700">
                      <StickyNote size={14} />
                      <span className="ml-1">{noteEntries.length}</span>
                    </span>
                  )}
                  {isCurrentMonth && (
                    <span className="rounded-full bg-teal-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-teal-700">
                      Current
                    </span>
                  )}
                </div>
              </div>

              <div className={isPhone ? "grid grid-cols-7 gap-1 text-center" : "grid grid-cols-7 gap-1 text-center"}>
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday} className={isPhone ? "py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400" : "py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400"}>
                    {weekday}
                  </div>
                ))}

                {Array.from({ length: leadingBlanks }).map((_, index) => (
                  <div key={`blank-${index}`} className="aspect-square rounded-xl" />
                ))}

                {days.map((day) => {
                  const isToday = isCurrentMonth && day === currentDate;

                  return (
                    <div
                      key={day}
                      className={[
                        isPhone
                          ? 'flex aspect-square items-center justify-center rounded-[10px] text-[12px] font-bold'
                          : 'flex aspect-square items-center justify-center rounded-xl text-sm font-bold',
                        isToday
                          ? 'bg-teal-600 text-white shadow-lg shadow-teal-200 ring-4 ring-teal-100'
                          : 'text-zinc-600 hover:bg-zinc-50',
                      ].join(' ')}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {selectedMonth !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
          <div className={isPhone ? "flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-2xl" : "flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-zinc-200 bg-white shadow-2xl"}>
            <div className={isPhone ? "border-b border-zinc-100 px-4 pb-4 pt-5" : "flex flex-col gap-4 border-b border-zinc-100 p-5 md:flex-row md:items-center md:justify-between"}>
              <div className={isPhone ? "flex items-start justify-between gap-3" : "flex items-center gap-3"}>
                <div className="flex items-center gap-3">
                  <div className={isPhone ? "flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700" : "flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"}>
                    <CalendarDays size={isPhone ? 19 : 21} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Daily Notes</p>
                    <h2 className={isPhone ? "text-[1.75rem] font-black tracking-tight text-zinc-900" : "text-2xl font-black tracking-tight text-zinc-900"}>
                      {MONTHS[selectedMonth]} {year}
                    </h2>
                  </div>
                </div>

                {isPhone && (
                  <button
                    onClick={() => {
                      setSelectedMonth(null);
                      setDraftDayNotes({});
                      setSaveMessage(null);
                    }}
                    className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-500 shadow-sm"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className={isPhone ? "mt-4 flex items-center gap-2" : "flex flex-wrap gap-2"}>
                <button
                  onClick={saveMonthNote}
                  disabled={!userId || savingNote}
                  className={isPhone
                    ? "flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-100 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
                    : "flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-100 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"}
                >
                  {savingNote ? (
                    <Loader2 size={18} className="mx-auto animate-spin" />
                  ) : isPhone ? (
                    'Save'
                  ) : (
                    <>
                      <Save size={18} />
                      Save Month
                    </>
                  )}
                </button>

                {!isPhone && (
                  <button
                    onClick={() => {
                      setSelectedMonth(null);
                      setDraftDayNotes({});
                      setSaveMessage(null);
                    }}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-600 transition hover:border-zinc-900 hover:text-zinc-900"
                  >
                    <X size={17} />
                    Close
                  </button>
                )}
              </div>
            </div>

            <div className={isPhone ? "overflow-y-auto px-4 pb-4 pt-3" : "overflow-y-auto p-5"}>
              <div className={isPhone ? "mb-3 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-medium leading-6 text-zinc-500" : "mb-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-500"}>
                {saveMessage || (userId ? 'Tap a day to add a note, then save the month.' : 'Sign in to save calendar notes.')}
              </div>

              {isPhone ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-1 rounded-2xl bg-zinc-50 px-2 py-2">
                    {WEEKDAYS.map((weekday) => (
                      <div key={weekday} className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                        {weekday.slice(0, 1)}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: getMonthDays(year, selectedMonth).leadingBlanks }).map((_, index) => (
                      <div key={`modal-blank-${index}`} className="aspect-square rounded-2xl bg-zinc-50/70" />
                    ))}

                    {getMonthDays(year, selectedMonth).days.map((day) => {
                      const isToday = selectedMonth === currentMonth && day === currentDate;
                      const dayKey = String(day);
                      const hasNote = Boolean((draftDayNotes[dayKey] || '').trim());

                      return (
                        <button
                          key={day}
                          onClick={() => {
                            const input = window.prompt(`Note for ${MONTHS[selectedMonth]} ${day}`, draftDayNotes[dayKey] || '');
                            if (input === null) return;
                            setDraftDayNotes({
                              ...draftDayNotes,
                              [dayKey]: input,
                            });
                          }}
                          className={[
                            'aspect-square rounded-[18px] border px-1 py-2 text-left shadow-sm transition active:scale-[0.98]',
                            isToday ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-100' : 'border-zinc-200 bg-white',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between">
                            <span className={isToday ? 'text-xs font-black text-teal-700' : 'text-xs font-black text-zinc-700'}>{day}</span>
                            {hasNote && <span className="mt-0.5 h-2 w-2 rounded-full bg-teal-500" />}
                          </div>
                          <p className="mt-2 line-clamp-3 text-[10px] font-medium leading-4 text-zinc-500">
                            {draftDayNotes[dayKey] || 'Add'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {WEEKDAYS.map((weekday) => (
                    <div key={weekday} className="rounded-xl bg-zinc-50 py-3 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {weekday}
                    </div>
                  ))}

                  {Array.from({ length: getMonthDays(year, selectedMonth).leadingBlanks }).map((_, index) => (
                    <div key={`modal-blank-${index}`} className="min-h-32 rounded-2xl bg-zinc-50/50" />
                  ))}

                  {getMonthDays(year, selectedMonth).days.map((day) => {
                    const isToday = selectedMonth === currentMonth && day === currentDate;
                    const dayKey = String(day);

                    return (
                      <div
                        key={day}
                        className={[
                          'min-h-32 rounded-2xl border p-2 transition',
                          isToday ? 'border-teal-500 bg-teal-50 ring-4 ring-teal-100' : 'border-zinc-200 bg-white',
                        ].join(' ')}
                      >
                        <div className={isToday ? 'mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-xs font-black text-white' : 'mb-2 text-xs font-black text-zinc-500'}>
                          {day}
                        </div>
                        <textarea
                          value={draftDayNotes[dayKey] || ''}
                          onChange={(event) => {
                            setDraftDayNotes({
                              ...draftDayNotes,
                              [dayKey]: event.target.value,
                            });
                          }}
                          placeholder="Add note..."
                          className="h-20 w-full resize-none rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-medium leading-5 text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
