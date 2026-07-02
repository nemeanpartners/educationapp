import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, onSnapshot } from '@/lib/portal-firestore';
import { AlertCircle, BellRing, CalendarDays, GraduationCap, Loader2, MapPin, Megaphone, School, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

interface TimetableEntry {
  subject: string;
}

type AnnouncementKind = 'school' | 'class';

type AnnouncementItem = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  audienceLabel: string;
  timeLabel: string;
  tag: string;
  icon: typeof Megaphone;
  accent: string;
};

const CLASS_ANNOUNCEMENT_TEMPLATES = [
  {
    title: (subject: string) => `${subject} consultation hours updated`,
    body: (subject: string) =>
      `${subject} consultation is available this week after school. Bring your draft questions, practical notes, or any content you want clarified before the next lesson.`,
    tag: 'Consultation',
    icon: Users,
    accent: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  },
  {
    title: (subject: string) => `${subject} room change`,
    body: (subject: string) =>
      `${subject} will meet in a different room for the next lesson. Check your timetable and arrive a few minutes early so you do not miss the roll or starter instructions.`,
    tag: 'Room change',
    icon: MapPin,
    accent: 'text-amber-600 bg-amber-50 border-amber-100',
  },
  {
    title: (subject: string) => `${subject} extra tutoring session`,
    body: (subject: string) =>
      `An extra ${subject.toLowerCase()} support session has been scheduled this week for students who want revision, feedback, or more guided practice before upcoming assessments.`,
    tag: 'Tutoring',
    icon: GraduationCap,
    accent: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  },
];

const SCHOOL_ANNOUNCEMENT_TEMPLATES = [
  {
    title: 'Student free day reminder',
    body: (school: string) =>
      `${school} has a student free day coming up. Use the extra time to get ahead on assessments, catch up on reading, and confirm any due dates for the following week.`,
    tag: 'School notice',
    icon: School,
    accent: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100',
  },
  {
    title: 'Public holiday schedule update',
    body: (school: string) =>
      `Classes and support services at ${school} will pause for the public holiday. Check timetable adjustments and any changed submission cutoffs before the long weekend.`,
    tag: 'Calendar',
    icon: CalendarDays,
    accent: 'text-cyan-600 bg-cyan-50 border-cyan-100',
  },
  {
    title: 'Whole-school announcement',
    body: (school: string) =>
      `${school} has posted a general update for students covering campus notices, support access, and any changes that affect regular class attendance this week.`,
    tag: 'Announcement',
    icon: BellRing,
    accent: 'text-rose-600 bg-rose-50 border-rose-100',
  },
];

function buildAnnouncements(subjects: string[], schoolName: string) {
  const classAnnouncements: AnnouncementItem[] = subjects.slice(0, 6).map((subject, index) => {
    const template = CLASS_ANNOUNCEMENT_TEMPLATES[index % CLASS_ANNOUNCEMENT_TEMPLATES.length];
    return {
      id: `class-${subject}-${index}`,
      kind: 'class',
      title: template.title(subject),
      body: template.body(subject),
      audienceLabel: subject,
      timeLabel: index === 0 ? 'Posted today' : `${index + 1} days ago`,
      tag: template.tag,
      icon: template.icon,
      accent: template.accent,
    };
  });

  const schoolAnnouncements: AnnouncementItem[] = SCHOOL_ANNOUNCEMENT_TEMPLATES.map((template, index) => ({
    id: `school-${index}`,
    kind: 'school',
    title: template.title,
    body: template.body(schoolName),
    audienceLabel: schoolName,
    timeLabel: index === 0 ? 'Posted today' : `${index + 2} days ago`,
    tag: template.tag,
    icon: template.icon,
    accent: template.accent,
  }));

  return [...schoolAnnouncements, ...classAnnouncements];
}

export default function AnnouncementsPage() {
  const { isPhone } = useResponsiveDevice();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('Your school');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'school' | 'class'>('all');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;

    const loadProfile = async () => {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!active) return;
      if (userSnap.exists()) {
        const data = userSnap.data() as { schoolName?: string };
        setSchoolName(data.schoolName?.trim() || 'Your school');
      }
    };

    const unsub = onSnapshot(doc(db, 'timetables', user.uid), (snapshot) => {
      if (!active) return;
      if (snapshot.exists()) {
        const entries: TimetableEntry[] = snapshot.data().entries || [];
        const uniqueSubjects = Array.from(new Set(entries.map((entry) => entry.subject).filter(Boolean)));
        setSubjects(uniqueSubjects);
      } else {
        setSubjects([]);
      }
      setLoading(false);
    });

    loadProfile().catch((error) => {
      console.error('Failed to load school profile for announcements:', error);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const allAnnouncements = useMemo(() => buildAnnouncements(subjects, schoolName), [schoolName, subjects]);

  const visibleAnnouncements = useMemo(() => {
    if (filter === 'all') return allAnnouncements;
    return allAnnouncements.filter((item) => item.kind === filter);
  }, [allAnnouncements, filter]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className={cn('mx-auto max-w-7xl', isPhone ? 'space-y-4 p-4' : 'space-y-6 p-8')}>
      <section
        className={cn(
          'relative overflow-hidden rounded-[32px] border border-white/55 bg-white/45 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl',
          isPhone ? 'p-5' : 'p-7'
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.16),transparent_36%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/80" />
        <div className={cn('gap-4', isPhone ? 'space-y-4' : 'flex items-start justify-between')}>
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Classes</p>
            <h1 className={cn('font-black tracking-tight text-zinc-950', isPhone ? 'mt-2 text-3xl' : 'mt-2 text-5xl')}>
              Announcements
            </h1>
            <p className={cn('mt-3 font-medium text-zinc-500', isPhone ? 'text-sm leading-6' : 'text-lg leading-8')}>
              See school-wide notices, class updates, room changes, consultation times, and tutoring sessions in one place.
            </p>
          </div>

          <div className={cn('relative z-10 gap-3', isPhone ? 'grid grid-cols-3' : 'flex items-center')}>
            {[
              ['all', 'All'],
              ['school', 'School'],
              ['class', 'Classes'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as 'all' | 'school' | 'class')}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-sm font-black shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition',
                  filter === value
                    ? 'border-indigo-200/80 bg-white/55 text-indigo-700 backdrop-blur-xl'
                    : 'border-white/60 bg-white/40 text-zinc-600 backdrop-blur-xl hover:border-white/80 hover:bg-white/55',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={cn('gap-5', isPhone ? 'space-y-4' : 'grid md:grid-cols-3')}>
        <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/42 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">School</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-950">{schoolName}</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-zinc-500">School notices, calendar changes, and whole-campus updates.</p>
        </div>
        <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/42 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Classes tracked</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-950">{subjects.length}</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-zinc-500">Announcements are tailored to the subjects currently on your timetable.</p>
        </div>
        <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/42 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.18)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Visible notices</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-950">{visibleAnnouncements.length}</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-zinc-500">Includes teacher posts, room changes, consultations, tutoring, and public holiday reminders.</p>
        </div>
      </section>

      {visibleAnnouncements.length === 0 ? (
        <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/42 px-6 py-12 text-center shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400">
            <AlertCircle size={24} />
          </div>
          <h2 className="mt-4 text-2xl font-black text-zinc-950">No announcements right now</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
            Add classes to your timetable first so EduRev can tailor class announcements here.
          </p>
        </section>
      ) : (
        <section className={cn('gap-5', isPhone ? 'space-y-4' : 'grid lg:grid-cols-2')}>
          {visibleAnnouncements.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-[32px] border border-white/60 bg-white/42 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_36px_90px_rgba(15,23,42,0.2)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.62),rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.08))]" />
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/85" />
                <div className="flex items-start gap-4">
                  <div className={cn('relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_12px_24px_rgba(15,23,42,0.08)]', item.accent)}>
                    <Icon size={24} />
                  </div>
                  <div className="relative z-10 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]', item.accent)}>
                        {item.tag}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                        {item.audienceLabel}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-300">
                        {item.timeLabel}
                      </span>
                    </div>
                    <h2 className="mt-3 text-2xl font-black leading-tight text-zinc-950">{item.title}</h2>
                    <p className="mt-3 text-sm font-medium leading-7 text-zinc-600">{item.body}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
