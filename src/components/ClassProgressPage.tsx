import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Award, CheckCircle2, ClipboardList, Clock3, ExternalLink, Loader2, TrendingUp, X } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, doc, onSnapshot, orderBy, query, where, Timestamp } from '@/lib/portal-firestore';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { useLocalStorage } from '../hooks/use-local-storage';
import { AssignmentPlan, Deadline } from '../types';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { detectStudentPortalFromPath, studentPortalAssignmentCoachPath, studentPortalToolPath } from '@/lib/portal';
import { addMonths, differenceInCalendarDays, format, isAfter, isBefore, startOfDay } from 'date-fns';

type ActivityPoint = {
  label: string;
  activity: number;
};

type PerformancePoint = {
  label: string;
  score: number;
};

type SubjectInsight = {
  weeklyActivity: ActivityPoint[];
  dailyActivity: ActivityPoint[];
  performance: PerformancePoint[];
  hoursStudied: number;
  averageHours: number;
  trendText: string;
  topFocus: string;
  todosLeft: number;
  assignmentsLeft: number;
};

type UniversityTimelineProfile = {
  degreeName: string;
  degreeStartDate: string;
  degreeEndDate: string;
  semesterLabel: string;
  semesterStartDate: string;
  semesterEndDate: string;
  yearLabel: string;
  yearStartDate: string;
  yearEndDate: string;
  creditsCompleted: number;
  totalCredits: number;
};

const GLASS_PANEL = 'relative overflow-hidden rounded-[32px] border border-white/55 bg-white/46 backdrop-blur-2xl shadow-[0_22px_60px_rgba(15,23,42,0.12)]';
const GLASS_CARD = 'relative overflow-hidden rounded-[28px] border border-white/60 bg-white/42 backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.12)]';
const GLASS_INSET = 'border border-white/60 bg-white/45 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]';

const weeklyLabels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
const dailyLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function subjectSeed(subject: string) {
  return subject.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function buildSubjectInsight(subject: string): SubjectInsight {
  const seed = subjectSeed(subject || 'Class');
  const weeklyActivity = weeklyLabels.map((label, index) => ({
    label,
    activity: 32 + ((seed + index * 9) % 34),
  }));
  const dailyActivity = dailyLabels.map((label, index) => ({
    label,
    activity: 18 + ((seed + index * 7) % 24),
  }));
  const performance = weeklyLabels.map((label, index) => ({
    label,
    score: 61 + ((seed + index * 6) % 27),
  }));

  const todosLeft = seed % 4;
  const assignmentsLeft = (seed + 1) % 3;
  const hoursStudied = 14 + (seed % 16);
  const averageHours = Math.max(10, hoursStudied - 3 + (seed % 4));
  const latestPerformance = performance[performance.length - 1]?.score || 0;
  const startingPerformance = performance[0]?.score || 0;
  const performanceLift = latestPerformance - startingPerformance;

  return {
    weeklyActivity,
    dailyActivity,
    performance,
    hoursStudied,
    averageHours,
    trendText:
      performanceLift > 0
        ? `${subject} improved by ${performanceLift}% across the recent checkpoints.`
        : `${subject} is steady right now, with the next checkpoint ready for improvement.`,
    topFocus: `The strongest momentum in ${subject} is showing up when sessions stay consistent and task follow-through is high.`,
    todosLeft,
    assignmentsLeft,
  };
}

function InsightTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-white/70 bg-white/85 px-3 py-2 text-sm font-semibold text-zinc-700 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      {payload.map((entry) => (
        <p key={`${entry.name}-${entry.value}`} className="mt-1" style={{ color: entry.color || '#0f172a' }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateTimelineProgress(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return { percent: 0, daysLeft: null as number | null, totalDays: null as number | null };
  }

  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));
  const today = startOfDay(new Date());

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !isAfter(end, start)) {
    return { percent: 0, daysLeft: null as number | null, totalDays: null as number | null };
  }

  const totalDays = Math.max(1, differenceInCalendarDays(end, start));
  const elapsedDays = isBefore(today, start)
    ? 0
    : isAfter(today, end)
      ? totalDays
      : differenceInCalendarDays(today, start);
  const daysLeft = isAfter(today, end) ? 0 : Math.max(0, differenceInCalendarDays(end, today));

  return {
    percent: clampPercent((elapsedDays / totalDays) * 100),
    daysLeft,
    totalDays,
  };
}

export default function ClassProgressPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [activeClass, setActiveClass] = useState('');
  const [activityView, setActivityView] = useState<'weekly' | 'daily'>('weekly');
  const [assignmentPlans, setAssignmentPlans] = useState<AssignmentPlan[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [showRemainingPopup, setShowRemainingPopup] = useState(false);
  const [showTimelinePopup, setShowTimelinePopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isPhone } = useResponsiveDevice();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [timelineProfile, setTimelineProfile] = useLocalStorage<UniversityTimelineProfile>('university-course-standing-profile', {
    degreeName: '',
    degreeStartDate: '',
    degreeEndDate: '',
    semesterLabel: '',
    semesterStartDate: '',
    semesterEndDate: '',
    yearLabel: '',
    yearStartDate: '',
    yearEndDate: '',
    creditsCompleted: 0,
    totalCredits: 0,
  });
  const [timelineDraft, setTimelineDraft] = useState<UniversityTimelineProfile>(timelineProfile);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribeTimetable = onSnapshot(
      doc(db, 'timetables', user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const entries: { subject: string }[] = snapshot.data().entries || [];
          const uniqueSubjects = Array.from(new Set(
            entries
              .map((entry) => entry.subject?.trim())
              .filter((subject): subject is string => Boolean(subject)),
          ));

          setSubjects(uniqueSubjects);
          if (uniqueSubjects.length > 0) {
            setActiveClass((current) => current || uniqueSubjects[0]);
          }
        } else {
          setSubjects([]);
        }
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `timetables/${auth.currentUser?.uid}`);
        setLoading(false);
      },
    );

    const assignmentPlansQuery = query(
      collection(db, 'assignmentPlans'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
    );

    const unsubscribePlans = onSnapshot(
      assignmentPlansQuery,
      (snapshot) => {
        setAssignmentPlans(snapshot.docs.map((planDoc) => ({ id: planDoc.id, ...planDoc.data() } as AssignmentPlan)));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'assignmentPlans');
      },
    );

    const deadlinesQuery = query(
      collection(db, 'deadlines'),
      where('userId', '==', user.uid),
      orderBy('dueDate', 'asc'),
    );

    const unsubscribeDeadlines = onSnapshot(
      deadlinesQuery,
      (snapshot) => {
        setDeadlines(
          snapshot.docs.map((deadlineDoc) => {
            const data = deadlineDoc.data();
            return {
              id: deadlineDoc.id,
              ...data,
              dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
            } as Deadline;
          }),
        );
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'deadlines');
      },
    );

    return () => {
      unsubscribeTimetable();
      unsubscribePlans();
      unsubscribeDeadlines();
    };
  }, []);

  const activeInsight = useMemo(
    () => buildSubjectInsight(activeClass || subjects[0] || 'Class'),
    [activeClass, subjects],
  );

  const activeClassProgress = useMemo(() => {
    const normalizedActiveClass = (activeClass || '').trim().toLowerCase();
    if (!normalizedActiveClass) {
      return {
        todosLeft: 0,
        assignmentsLeft: 0,
        matchingPlans: [] as AssignmentPlan[],
        matchingDeadlines: [] as Deadline[],
      };
    }

    const matchingPlans = assignmentPlans.filter(
      (plan) => (plan.subject || '').trim().toLowerCase() === normalizedActiveClass,
    );

    const todosLeft = matchingPlans.reduce(
      (total, plan) =>
        total +
        plan.steps.reduce(
          (stepTotal, step) => stepTotal + step.tasks.filter((task) => !task.completed).length,
          0,
        ),
      0,
    );

    const matchingDeadlines = deadlines.filter((deadline) => {
      const normalizedCourse = (deadline.course || '').trim().toLowerCase();
      return (
        normalizedCourse === normalizedActiveClass &&
        !deadline.completed &&
        (deadline.type === 'assignment' || deadline.type === 'project')
      );
    });

    const assignmentsLeft = matchingDeadlines.length;

    return {
      todosLeft,
      assignmentsLeft,
      matchingPlans,
      matchingDeadlines,
    };
  }, [activeClass, assignmentPlans, deadlines]);

  const remainingTaskItems = useMemo(
    () =>
      activeClassProgress.matchingPlans.flatMap((plan) =>
        plan.steps.flatMap((step) =>
          step.tasks
            .filter((task) => !task.completed)
            .map((task) => ({
              id: task.id,
              text: task.text,
              stepTitle: step.title,
              planId: plan.id,
              planTitle: plan.title,
            })),
        ),
      ),
    [activeClassProgress],
  );

  const activityData = activityView === 'weekly' ? activeInsight.weeklyActivity : activeInsight.dailyActivity;
  const remainingWork = activeClassProgress.todosLeft + activeClassProgress.assignmentsLeft;
  const degreeTimeline = calculateTimelineProgress(timelineProfile.degreeStartDate, timelineProfile.degreeEndDate);
  const yearTimeline = calculateTimelineProgress(timelineProfile.yearStartDate, timelineProfile.yearEndDate);
  const semesterTimeline = calculateTimelineProgress(timelineProfile.semesterStartDate, timelineProfile.semesterEndDate);
  const degreeCreditProgress = timelineProfile.totalCredits > 0
    ? clampPercent((timelineProfile.creditsCompleted / timelineProfile.totalCredits) * 100)
    : 0;
  const degreeTimelinePoints = useMemo(() => {
    if (!timelineProfile.degreeStartDate || !timelineProfile.degreeEndDate) return [];
    const start = new Date(timelineProfile.degreeStartDate);
    const end = new Date(timelineProfile.degreeEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !isAfter(end, start)) return [];
    return Array.from({ length: 7 }, (_, index) => {
      const pointDate = addMonths(start, index * Math.max(1, Math.round(differenceInCalendarDays(end, start) / 30 / 6)));
      const pointPercent = calculateTimelineProgress(timelineProfile.degreeStartDate, pointDate.toISOString()).percent;
      return {
        label: index === 0 ? 'Start' : index === 6 ? 'Finish' : `M${index}`,
        score: Math.min(100, Math.max(pointPercent, index === 6 ? 100 : pointPercent)),
      };
    });
  }, [timelineProfile.degreeStartDate, timelineProfile.degreeEndDate]);
  const hasTimeline = Boolean(
    timelineProfile.degreeName &&
    timelineProfile.degreeStartDate &&
    timelineProfile.degreeEndDate &&
    timelineProfile.semesterStartDate &&
    timelineProfile.semesterEndDate &&
    timelineProfile.yearStartDate &&
    timelineProfile.yearEndDate,
  );

  useEffect(() => {
    setTimelineDraft(timelineProfile);
  }, [timelineProfile]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (activePortal === 'university') {
    return (
      <div className={cn('min-h-screen space-y-6 overflow-x-hidden bg-[#eef5f3]', isPhone ? 'p-4' : 'p-8')}>
        <section className={cn(GLASS_PANEL, isPhone ? 'p-5' : 'p-7')}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_36%)]" />
          <div className={cn('gap-4', isPhone ? 'space-y-4' : 'flex items-start justify-between')}>
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">University standing</p>
              <h1 className={cn('mt-2 font-black tracking-tight text-zinc-950', isPhone ? 'text-3xl' : 'text-5xl')}>
                Course standing
              </h1>
              <p className={cn('mt-3 max-w-4xl font-medium text-zinc-600', isPhone ? 'text-sm leading-6' : 'text-lg leading-8')}>
                See how far through the semester, academic year, and degree you really are so the current workload sits in context.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTimelinePopup(true)}
              className={cn(
                'relative z-10 rounded-[26px] bg-emerald-500 px-8 py-6 text-center font-black text-white shadow-[0_18px_45px_rgba(16,185,129,0.28)] transition hover:bg-emerald-600',
                !hasTimeline && 'animate-pulse ring-4 ring-emerald-200',
                isPhone ? 'w-full text-2xl leading-tight' : 'min-w-[13rem] text-3xl leading-tight',
              )}
            >
              {timelineProfile.degreeName ? 'Update timeline' : 'Set timeline'}
            </button>
          </div>
        </section>

        <section className="space-y-5">
          <div className={cn(GLASS_CARD, isPhone ? 'p-5' : 'p-6')}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Degree journey track</p>
            <h2 className="mt-3 text-2xl font-black text-zinc-950">
              {hasTimeline ? (timelineProfile.degreeName || 'Your degree route') : 'Set your timeline to unlock your route'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-zinc-600">
              {hasTimeline
                ? 'Your degree route is now mapped from start to finish so the workload can sit inside the bigger journey.'
                : 'This is a placeholder runway. Once you set your dates, this becomes your own start-to-finish degree journey track.'}
            </p>

            <div className="mt-6 rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.7),rgba(240,249,245,0.68))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <div className="flex items-center justify-between gap-4 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                <span>{timelineProfile.degreeStartDate ? format(new Date(timelineProfile.degreeStartDate), 'd MMM yyyy') : 'Start point'}</span>
                <span>{hasTimeline ? 'Degree route active' : 'Awaiting timeline setup'}</span>
                <span>{timelineProfile.degreeEndDate ? format(new Date(timelineProfile.degreeEndDate), 'd MMM yyyy') : 'Finish point'}</span>
              </div>

              <div className="relative mt-6 h-44 overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#eef6f8_0%,#f9fbfd_100%)]">
                <div className="absolute left-[7%] right-[7%] top-1/2 h-[2px] -translate-y-1/2 bg-dashed bg-[length:18px_2px] bg-repeat-x [background-image:linear-gradient(90deg,rgba(148,163,184,0.42)_0_50%,transparent_50%_100%)]" />
                <div className="absolute left-[7%] right-[7%] top-1/2 h-[2px] -translate-y-1/2">
                  <svg className="h-full w-full overflow-visible" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
                    <path
                      d="M 0 60 C 130 30, 260 96, 392 52 S 661 22, 810 52 S 926 84, 1000 42"
                      fill="none"
                      stroke={hasTimeline ? 'url(#trajectoryGradient)' : 'rgba(148,163,184,0.5)'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={hasTimeline ? '0' : '12 12'}
                    />
                    <defs>
                      <linearGradient id="trajectoryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="45%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                <div className="absolute left-[7%] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-4 border-white bg-slate-900 shadow-[0_0_0_8px_rgba(15,23,42,0.05)]" />
                <div className="absolute right-[7%] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-4 border-white bg-emerald-500 shadow-[0_0_0_8px_rgba(16,185,129,0.12)]" />

                <div
                  className={cn(
                    'absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white text-lg shadow-[0_18px_30px_rgba(15,23,42,0.15)] transition-all duration-700',
                    hasTimeline ? 'bg-sky-500 text-white' : 'bg-zinc-300 text-zinc-600',
                    !hasTimeline && 'animate-bounce',
                  )}
                  style={{ left: `calc(7% + ${hasTimeline ? degreeTimeline.percent : 10}% * 0.86)` }}
                >
                  ✈
                </div>

                <div className="absolute bottom-4 left-[7%] right-[7%] flex items-center justify-between text-xs font-bold text-zinc-500">
                  <span>Origin</span>
                  <span>{hasTimeline ? `${degreeTimeline.percent}% through journey` : 'Set timeline to generate your route'}</span>
                  <span>Destination</span>
                </div>
              </div>
            </div>
          </div>

          <div className={cn('grid gap-5', isPhone ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-3')}>
            {[
            {
              title: timelineProfile.semesterLabel || 'Semester',
              percent: semesterTimeline.percent,
              detail: semesterTimeline.daysLeft === null ? 'Add semester dates' : `${semesterTimeline.daysLeft} days remaining`,
              icon: Clock3,
              tone: 'text-sky-500',
            },
            {
              title: timelineProfile.yearLabel || 'Academic year',
              percent: yearTimeline.percent,
              detail: yearTimeline.daysLeft === null ? 'Add year dates' : `${yearTimeline.daysLeft} days remaining`,
              icon: TrendingUp,
              tone: 'text-emerald-500',
            },
            {
              title: 'Degree credits',
              percent: degreeCreditProgress,
              detail: timelineProfile.totalCredits > 0 ? `${timelineProfile.creditsCompleted} of ${timelineProfile.totalCredits} completed` : 'Add degree credit totals',
              icon: Award,
              tone: 'text-amber-500',
            },
          ].map((item) => (
            <div key={item.title} className={cn(GLASS_CARD, 'p-5')}>
              <item.icon className={item.tone} size={28} />
              <h3 className="mt-4 text-xl font-black text-zinc-950">{item.title}</h3>
              <p className="mt-2 text-3xl font-black text-zinc-950">{item.percent}%</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-zinc-900" style={{ width: `${item.percent}%` }} />
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">{item.detail}</p>
            </div>
          ))}
          </div>
        </section>

        <section className={cn('grid gap-5', isPhone ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2')}>
          <div className={cn(GLASS_PANEL, 'p-5')}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Subjects tracked</p>
            <h2 className="mt-2 text-2xl font-black text-zinc-950">Current unit exposure</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
              Your current subjects still matter, but they should sit inside the semester and degree runway above.
            </p>
            <div className="mt-5 space-y-3">
              {subjects.length > 0 ? subjects.map((subject) => {
                const insight = buildSubjectInsight(subject);
                return (
                  <div key={subject} className="rounded-[22px] border border-white/70 bg-white/65 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-zinc-950">{subject}</p>
                        <p className="mt-1 text-sm font-semibold text-zinc-500">{insight.trendText}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                        {insight.performance[insight.performance.length - 1]?.score || 0}%
                      </span>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-[22px] border border-dashed border-zinc-200 bg-white/65 p-4 text-sm font-semibold leading-6 text-zinc-500">
                  Add units to your timetable so course standing can break down your current subject load.
                </div>
              )}
            </div>
          </div>

          <div className={cn(GLASS_PANEL, 'p-5')}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Reality check</p>
            <h2 className="mt-2 text-2xl font-black text-zinc-950">What is still open</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
              Standing is not just marks. It is also how much work is still hanging over the student right now.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/70 bg-white/65 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Open assignment plans</p>
                <p className="mt-2 text-3xl font-black text-zinc-950">{assignmentPlans.length}</p>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/65 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Upcoming deadlines</p>
                <p className="mt-2 text-3xl font-black text-zinc-950">{deadlines.filter((deadline) => !deadline.completed).length}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => navigate(studentPortalToolPath(activePortal, 'deadlines'))} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
                Open deadlines
              </button>
              <button onClick={() => navigate(studentPortalToolPath(activePortal, 'academic-goals'))} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm font-black text-zinc-700">
                Open goals
              </button>
            </div>
          </div>
        </section>

        {showTimelinePopup ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-sm">
            <div className={cn(GLASS_PANEL, 'w-full max-w-4xl p-5')}>
              <div className="relative z-10 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Setup</p>
                  <h2 className="mt-2 text-2xl font-black text-zinc-950">University timeline</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                    Add your degree, semester, and year dates so this page can show how far through the runway you actually are.
                  </p>
                </div>
                <button type="button" onClick={() => setShowTimelinePopup(false)} className="rounded-2xl border border-white/70 bg-white/70 p-2 text-zinc-600 transition hover:bg-white">
                  <X size={18} />
                </button>
              </div>

              <div className="relative z-10 mt-5 grid gap-4 md:grid-cols-2">
                {[
                  { label: 'Degree name', key: 'degreeName', type: 'text' },
                  { label: 'Academic year label', key: 'yearLabel', type: 'text' },
                  { label: 'Semester label', key: 'semesterLabel', type: 'text' },
                  { label: 'Degree start', key: 'degreeStartDate', type: 'date' },
                  { label: 'Degree end', key: 'degreeEndDate', type: 'date' },
                  { label: 'Year start', key: 'yearStartDate', type: 'date' },
                  { label: 'Year end', key: 'yearEndDate', type: 'date' },
                  { label: 'Semester start', key: 'semesterStartDate', type: 'date' },
                  { label: 'Semester end', key: 'semesterEndDate', type: 'date' },
                  { label: 'Credits completed', key: 'creditsCompleted', type: 'number' },
                  { label: 'Total credits', key: 'totalCredits', type: 'number' },
                ].map((field) => (
                  <label key={field.key} className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{field.label}</span>
                    <input
                      type={field.type}
                      value={String(timelineDraft[field.key as keyof UniversityTimelineProfile] ?? '')}
                      onChange={(event) =>
                        setTimelineDraft((current) => ({
                          ...current,
                          [field.key]: field.type === 'number' ? Number(event.target.value || 0) : event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm font-semibold text-zinc-900 outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="relative z-10 mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTimelineProfile(timelineDraft);
                    setShowTimelinePopup(false);
                  }}
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600"
                >
                  Save timeline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimelineDraft(timelineProfile);
                    setShowTimelinePopup(false);
                  }}
                  className="rounded-2xl border border-white/70 bg-white/70 px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen space-y-6 overflow-x-hidden bg-[#f3f7ff]/70', isPhone ? 'p-4' : 'p-8')}>
      <section className={cn(GLASS_PANEL, isPhone ? 'p-5' : 'p-7')}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_36%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/85" />

        <div className={cn('gap-4', isPhone ? 'space-y-4' : 'flex items-start justify-between')}>
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">Class insights</p>
            <h1 className={cn('mt-2 font-black tracking-tight text-zinc-950', isPhone ? 'text-3xl' : 'text-5xl')}>
              Progress insights
            </h1>
            <p className={cn('mt-3 max-w-4xl font-medium text-zinc-600', isPhone ? 'text-sm leading-6' : 'text-lg leading-8')}>
              Track app activity, performance movement, and what is still left for each class in one clearer view.
            </p>
          </div>

          {isPhone ? (
            <div className={cn(GLASS_INSET, 'relative z-10 rounded-[24px] p-3')}>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Class</label>
              <select
                value={activeClass}
                onChange={(event) => setActiveClass(event.target.value)}
                className="w-full rounded-xl border border-white/70 bg-white/70 px-3 py-3 text-sm font-bold capitalize text-zinc-900 outline-none"
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative z-10 flex flex-wrap gap-2 pt-3">
              {subjects.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setActiveClass(subject)}
                  className={cn(
                    'rounded-full border px-6 py-2 text-sm font-black capitalize shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition',
                    activeClass === subject
                      ? 'border-sky-400 bg-sky-500 text-white'
                      : 'border-white/60 bg-white/50 text-zinc-700 backdrop-blur-xl hover:bg-white/70',
                  )}
                >
                  {subject}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {activeClass ? (
        <>
          <section className={cn('gap-5', isPhone ? 'space-y-4' : 'grid xl:grid-cols-2')}>
            <div className={cn(GLASS_PANEL, isPhone ? 'p-4' : 'p-5')}>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.62),rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.08))]" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Activity on EduRev</p>
                  <h2 className="mt-2 text-2xl font-black text-zinc-950">Overall app activity</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                    Follow the student’s activity rhythm in {activeClass} by week or by day.
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['weekly', 'daily'] as const).map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setActivityView(view)}
                      className={cn(
                        'rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition',
                        activityView === view
                          ? 'border-sky-400 bg-sky-500 text-white'
                          : 'border-white/60 bg-white/55 text-zinc-600 backdrop-blur-xl hover:bg-white/75',
                      )}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              </div>

              <div className={cn('relative z-10 mt-4', isPhone ? 'h-56' : 'h-64')}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: isPhone ? 10 : 12, fill: '#64748b', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: isPhone ? 10 : 12, fill: '#94a3b8', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip content={<InsightTooltip />} cursor={{ stroke: 'rgba(14,165,233,0.18)', strokeWidth: 1 }} />
                    <Line
                      type="monotone"
                      dataKey="activity"
                      name="Activity"
                      stroke="#0ea5e9"
                      strokeWidth={3}
                      dot={{ r: 0 }}
                      activeDot={{ r: 5, fill: '#0ea5e9', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={cn(GLASS_PANEL, isPhone ? 'p-4' : 'p-5')}>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.62),rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.08))]" />
              <div className="relative z-10">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Performance trend</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-950">Checkpoint movement</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                  This line tracks how {activeClass} is moving across recent class checkpoints and review tasks.
                </p>
              </div>

              <div className={cn('relative z-10 mt-4', isPhone ? 'h-56' : 'h-64')}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeInsight.performance} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: isPhone ? 10 : 12, fill: '#64748b', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[50, 100]}
                      tick={{ fontSize: isPhone ? 10 : 12, fill: '#94a3b8', fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip content={<InsightTooltip />} cursor={{ stroke: 'rgba(16,185,129,0.18)', strokeWidth: 1 }} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name="Performance"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 0 }}
                      activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className={cn('grid gap-5', isPhone ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-4')}>
            <div className={cn(GLASS_CARD, isPhone ? 'p-5' : 'p-6')}>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
              <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                <Clock3 className="text-sky-500" size={isPhone ? 28 : 32} />
                <h3 className={cn('font-black text-zinc-950', isPhone ? 'text-base' : 'text-xl')}>Hours studied</h3>
                <p className="text-3xl font-black text-zinc-950">{activeInsight.hoursStudied}h</p>
                <p className={cn('text-zinc-600', isPhone ? 'text-xs leading-5' : 'text-sm leading-6')}>
                  {activeClass} study time this term, with an average of {activeInsight.averageHours}h across similar weeks.
                </p>
              </div>
            </div>

            <div className={cn(GLASS_CARD, isPhone ? 'p-5' : 'p-6')}>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
              <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                <Award className="text-amber-500" size={isPhone ? 28 : 32} />
                <h3 className={cn('font-black text-zinc-950', isPhone ? 'text-base' : 'text-xl')}>Top focus</h3>
                <p className={cn('text-zinc-600', isPhone ? 'text-xs leading-5' : 'text-sm leading-6')}>
                  {activeInsight.topFocus}
                </p>
              </div>
            </div>

            <div className={cn(GLASS_CARD, isPhone ? 'p-5' : 'p-6')}>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
              <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                <TrendingUp className="text-emerald-500" size={isPhone ? 28 : 32} />
                <h3 className={cn('font-black text-zinc-950', isPhone ? 'text-base' : 'text-xl')}>Performance trend</h3>
                <p className={cn('text-zinc-600', isPhone ? 'text-xs leading-5' : 'text-sm leading-6')}>
                  {activeInsight.trendText}
                </p>
              </div>
            </div>

            <div className={cn(GLASS_CARD, isPhone ? 'p-5' : 'p-6')}>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
              <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                {remainingWork > 0 ? (
                  <>
                    <ClipboardList className="text-sky-500" size={isPhone ? 28 : 32} />
                    <h3 className={cn('font-black text-zinc-950', isPhone ? 'text-base' : 'text-xl')}>What’s left</h3>
                    <p className={cn('text-zinc-600', isPhone ? 'text-xs leading-5' : 'text-sm leading-6')}>
                      {activeClassProgress.todosLeft} incomplete class tasks remaining and {activeClassProgress.assignmentsLeft} open assignments still linked to {activeClass}.
                    </p>
                    <div className={cn('mt-2 flex w-full flex-col gap-2', isPhone ? '' : 'pt-1')}>
                      <button
                        type="button"
                        onClick={() => setShowRemainingPopup(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white transition hover:bg-sky-600"
                      >
                        <ClipboardList size={16} />
                        View tasks
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(studentPortalAssignmentCoachPath(activePortal))}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-3 text-xs font-black text-zinc-700 transition hover:bg-white"
                        >
                          <ExternalLink size={14} />
                          Assignment hub
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(studentPortalToolPath(activePortal, 'deadlines'))}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-3 text-xs font-black text-zinc-700 transition hover:bg-white"
                        >
                          <ExternalLink size={14} />
                          Deadlines
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="text-emerald-500" size={isPhone ? 28 : 32} />
                    <h3 className={cn('font-black text-zinc-950', isPhone ? 'text-base' : 'text-xl')}>Well done</h3>
                    <p className={cn('text-zinc-600', isPhone ? 'text-xs leading-5' : 'text-sm leading-6')}>
                      Nothing is left in {activeClass} right now. The current class tasks are clear and up to date.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className={cn(GLASS_PANEL, isPhone ? 'p-5' : 'p-7')}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_36%)]" />
          <div className="relative z-10 text-center">
            <h2 className="text-2xl font-black text-zinc-950">No classes found yet</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">
              Add classes to the timetable first so class progress insights can appear here.
            </p>
          </div>
        </section>
      )}

      {showRemainingPopup && activeClass && remainingWork > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-sm">
          <div className={cn(GLASS_PANEL, 'w-full max-w-2xl p-5')}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_36%)]" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Quick view</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-950">{activeClass} remaining work</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                  Open the exact class task or jump straight to the area of the app where it needs to be finished.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRemainingPopup(false)}
                className="rounded-2xl border border-white/70 bg-white/70 p-2 text-zinc-600 transition hover:bg-white"
                aria-label="Close remaining work popup"
              >
                <X size={18} />
              </button>
            </div>

            <div className={cn('relative z-10 mt-5 max-h-[70vh] overflow-y-auto pr-1', isPhone ? 'space-y-4' : 'grid gap-4 md:grid-cols-2')}>
              <div className={cn(GLASS_INSET, 'rounded-[22px] p-4')}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-black text-zinc-950">Class tasks</h3>
                  <button
                    type="button"
                    onClick={() => navigate(studentPortalAssignmentCoachPath(activePortal))}
                    className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-sky-600"
                  >
                    Open hub
                  </button>
                </div>
                <div className="mt-3 space-y-2.5">
                  {remainingTaskItems.length > 0 ? remainingTaskItems.slice(0, 8).map((item) => (
                    <div key={item.id} className="rounded-[18px] border border-white/70 bg-white/70 p-3">
                      <p className="text-[13px] font-black leading-5 text-zinc-900">{item.text}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] leading-4 text-zinc-400">
                        {item.planTitle} • {item.stepTitle}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRemainingPopup(false);
                          navigate(studentPortalAssignmentCoachPath(activePortal, item.planId));
                        }}
                        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-black text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <ExternalLink size={14} />
                        Open task
                      </button>
                    </div>
                  )) : (
                    <p className="text-sm font-medium leading-6 text-zinc-600">
                      No class-linked plan tasks are open right now.
                    </p>
                  )}
                </div>
              </div>

              <div className={cn(GLASS_INSET, 'rounded-[22px] p-4')}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-black text-zinc-950">Open assignments</h3>
                  <button
                    type="button"
                    onClick={() => navigate(studentPortalToolPath(activePortal, 'deadlines'))}
                    className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-emerald-600"
                  >
                    Open deadlines
                  </button>
                </div>
                <div className="mt-3 space-y-2.5">
                  {activeClassProgress.matchingDeadlines.length > 0 ? activeClassProgress.matchingDeadlines.map((deadline) => (
                    <div key={deadline.id} className="rounded-[18px] border border-white/70 bg-white/70 p-3">
                      <p className="text-[13px] font-black leading-5 text-zinc-900">{deadline.title}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] leading-4 text-zinc-400">
                        Due {deadline.dueDate.split('T')[0] || deadline.dueDate}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRemainingPopup(false);
                          navigate(studentPortalToolPath(activePortal, 'deadlines'));
                        }}
                        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[11px] font-black text-zinc-700 transition hover:bg-zinc-50"
                      >
                        <ExternalLink size={14} />
                        View assignment
                      </button>
                    </div>
                  )) : (
                    <p className="text-sm font-medium leading-6 text-zinc-600">
                      No open assignment deadlines are linked to this class.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
