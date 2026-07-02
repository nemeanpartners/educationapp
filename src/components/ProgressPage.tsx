import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Flame,
  GraduationCap,
  Printer,
  Share2,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth } from '../firebase';
import { collection, doc, getDoc, getDocs, query, where } from '@/lib/portal-firestore';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { useLocation, useNavigate } from 'react-router-dom';
import { detectStudentPortalFromPath, studentPortalPath, studentPortalToolPath } from '@/lib/portal';
import { useTodoStore } from '../hooks/use-todo-store';
import { useAcademicGoalsStore } from '../hooks/use-academic-goals-store';
import { useTimetableStore } from '../hooks/use-timetable-store';
import type { AssignmentPlan, Deadline } from '../types';
import { differenceInCalendarDays, format, isPast, parseISO, startOfDay } from 'date-fns';
import bushyTreeLog from '../../bushytreelog.png';
import palmTreeLog from '../../palmtreelog.png';
import pineTreeLog from '../../pinetreelog.png';

const data = [
  { name: 'Mon', actual: 2.5, goal: 3 },
  { name: 'Tue', actual: 4.2, goal: 4 },
  { name: 'Wed', actual: 3.6, goal: 3 },
  { name: 'Thu', actual: 1.3, goal: 2 },
  { name: 'Fri', actual: 2.1, goal: 2 },
  { name: 'Sat', actual: 4.7, goal: 4 },
  { name: 'Sun', actual: 1.9, goal: 2 },
];

const moodData = [
  { day: 1, color: 'bg-gray-100' }, { day: 2, color: 'bg-gray-100' }, { day: 3, color: 'bg-gray-100' }, { day: 4, color: 'bg-gray-100' }, { day: 5, color: 'bg-green-500' },
  { day: 6, color: 'bg-green-500' }, { day: 7, color: 'bg-blue-500' }, { day: 8, color: 'bg-blue-500' }, { day: 9, color: 'bg-red-500' }, { day: 10, color: 'bg-red-500' },
  { day: 11, color: 'bg-yellow-500' }, { day: 12, color: 'bg-yellow-500' }, { day: 13, color: 'bg-yellow-500' }, { day: 14, color: 'bg-yellow-500' }, { day: 15, color: 'bg-green-500' },
  { day: 16, color: 'bg-green-500' }, { day: 17, color: 'bg-blue-500' }, { day: 18, color: 'bg-blue-500' }, { day: 19, color: 'bg-red-500' }, { day: 20, color: 'bg-red-500' },
  { day: 21, color: 'bg-yellow-500' }, { day: 22, color: 'bg-yellow-500' }, { day: 23, color: 'bg-yellow-500' }, { day: 24, color: 'bg-yellow-500' }, { day: 25, color: 'bg-green-500' },
  { day: 26, color: 'bg-green-500' }, { day: 27, color: 'bg-blue-500' }, { day: 28, color: 'bg-blue-500' }, { day: 29, color: 'bg-red-500' }, { day: 30, color: 'bg-yellow-500' },
];

type LearningProfile = {
  primaryMethod: string;
  challenge: string;
  focusLength: string;
  supportTools: string[];
  updatedAt: string;
};

type QuizAttempt = {
  id: string;
  source: string;
  title: string;
  score: number;
  total: number;
  createdAt: string;
};

const methodLabels: Record<string, string> = {
  practice: 'Practice questions',
  visual: 'Visual maps',
  explain: 'Explain it back',
  memory: 'Memory drills',
};

const challengeLabels: Record<string, string> = {
  starting: 'Starting work',
  remembering: 'Remembering content',
  understanding: 'Understanding concepts',
  focus: 'Staying focused',
  exam: 'Exam pressure',
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 999.91) * 43758.5453123;
  return value - Math.floor(value);
}

function normalizeDateValue(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const maybeSeconds = (value as { seconds?: unknown }).seconds;
    if (typeof maybeSeconds === 'number') {
      return new Date(maybeSeconds * 1000).toISOString();
    }
    const maybeToDate = (value as { toDate?: () => Date }).toDate;
    if (typeof maybeToDate === 'function') {
      try {
        return maybeToDate().toISOString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

function parseDateValue(value: unknown): Date | null {
  const normalized = normalizeDateValue(value);
  if (!normalized) return null;
  const parsed = parseISO(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPressureTone(score: number) {
  if (score >= 75) return { label: 'Critical load', className: 'text-rose-700 bg-rose-50 border-rose-200' };
  if (score >= 50) return { label: 'Watch closely', className: 'text-amber-700 bg-amber-50 border-amber-200' };
  if (score >= 30) return { label: 'Building pressure', className: 'text-sky-700 bg-sky-50 border-sky-200' };
  return { label: 'Stable week', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
}

function getReadinessLabel(score: number) {
  if (score >= 80) return 'Strong exam posture';
  if (score >= 65) return 'Healthy momentum';
  if (score >= 45) return 'Developing consistency';
  return 'Signal still forming';
}

type UniversityProgressProps = {
  isPhone: boolean;
  streakDays: number;
  streakGoal: number;
  learningProfile: LearningProfile | null;
  quizAttempts: QuizAttempt[];
  flashcardCount: number;
  quizSetCount: number;
  recentAverage: number;
  latestPercent: number;
  quizImprovement: number;
  deadlines: Deadline[];
  assignmentPlans: AssignmentPlan[];
  todos: ReturnType<typeof useTodoStore.getState>['todos'];
  goals: ReturnType<typeof useAcademicGoalsStore.getState>['goals'];
  timetableEntries: ReturnType<typeof useTimetableStore.getState>['entries'];
};

function UniversityProgressDashboard({
  isPhone,
  streakDays,
  streakGoal,
  learningProfile,
  quizAttempts,
  flashcardCount,
  quizSetCount,
  recentAverage,
  latestPercent,
  quizImprovement,
  deadlines,
  assignmentPlans,
  todos,
  goals,
  timetableEntries,
}: UniversityProgressProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const groveSectionRef = useRef<HTMLElement | null>(null);
  const today = startOfDay(new Date());
  const viewFromQuery = new URLSearchParams(location.search).get('view');
  const initialView =
    viewFromQuery === 'forest'
        ? 'forest'
        : 'overview';
  const [activeView, setActiveView] = useState<'overview' | 'forest'>(initialView);
  const revisionAssetCount = flashcardCount + quizSetCount + quizAttempts.length;
  const openTodos = todos.filter((todo) => !todo.completed);
  const highPriorityTodos = openTodos.filter((todo) => todo.priority === 'high');
  const completedTodos = todos.filter((todo) => todo.completed);
  const totalGoalTarget = goals.reduce((sum, goal) => sum + Math.max(goal.target, 0), 0);
  const totalGoalCurrent = goals.reduce((sum, goal) => sum + Math.min(goal.current, goal.target), 0);
  const goalProgress = totalGoalTarget > 0 ? clampPercent((totalGoalCurrent / totalGoalTarget) * 100) : 0;
  const activeGoals = goals.filter((goal) => goal.current < goal.target);
  const completedGoals = goals.filter((goal) => goal.current >= goal.target);
  const subjects = Array.from(
    new Set(
      [
        ...timetableEntries.map((entry) => entry.subject?.trim()),
        ...deadlines.map((deadline) => deadline.course?.trim()),
        ...goals.map((goal) => goal.subject?.trim()),
      ].filter((value): value is string => Boolean(value && value !== 'General')),
    ),
  );

  const normalizedDeadlines = [...deadlines].sort(
    (a, b) => (parseDateValue(a.dueDate)?.getTime() || 0) - (parseDateValue(b.dueDate)?.getTime() || 0),
  );
  const overdueDeadlines = normalizedDeadlines.filter((deadline) => {
    const dueDate = parseDateValue(deadline.dueDate);
    return Boolean(
      dueDate &&
      !deadline.completed &&
      isPast(startOfDay(dueDate)) &&
      differenceInCalendarDays(today, startOfDay(dueDate)) > 0,
    );
  });
  const upcomingDeadlines = normalizedDeadlines.filter((deadline) => !deadline.completed && !overdueDeadlines.some((item) => item.id === deadline.id));
  const dueThisWeek = upcomingDeadlines.filter((deadline) => {
    const dueDate = parseDateValue(deadline.dueDate);
    return Boolean(dueDate && differenceInCalendarDays(startOfDay(dueDate), today) <= 7);
  });
  const nextDeadline = upcomingDeadlines[0] || null;
  const openPlanTasks = assignmentPlans.reduce(
    (total, plan) =>
      total +
      plan.steps.reduce((stepTotal, step) => stepTotal + step.tasks.filter((task) => !task.completed).length, 0),
    0,
  );

  const executionScore = openTodos.length + completedTodos.length > 0
    ? clampPercent((completedTodos.length / (openTodos.length + completedTodos.length)) * 100)
    : 55;
  const revisionEngineScore = clampPercent(Math.min(100, revisionAssetCount * 11 + Math.min(streakDays, 10) * 2));
  const assessmentConfidenceScore = latestPercent || recentAverage || 38;
  const momentumScore = clampPercent((executionScore + revisionEngineScore + assessmentConfidenceScore + (goalProgress || 35)) / 4);
  const pressureScore = clampPercent(
    overdueDeadlines.length * 28 +
      dueThisWeek.length * 12 +
      highPriorityTodos.length * 10 +
      Math.min(openPlanTasks, 15) * 2,
  );
  const pressureTone = getPressureTone(pressureScore);

  const readinessPillars = [
    {
      label: 'Execution discipline',
      value: executionScore,
      note: `${completedTodos.length} completed vs ${openTodos.length} still open`,
      tone: 'bg-slate-900',
    },
    {
      label: 'Assessment confidence',
      value: assessmentConfidenceScore,
      note: latestPercent ? `${latestPercent}% latest marked result` : 'No marked quiz yet',
      tone: 'bg-sky-500',
    },
    {
      label: 'Revision engine',
      value: revisionEngineScore,
      note: `${revisionAssetCount} revision outputs built`,
      tone: 'bg-emerald-500',
    },
    {
      label: 'Goal traction',
      value: goalProgress || 30,
      note: `${completedGoals.length}/${goals.length || 0} goals closed`,
      tone: 'bg-amber-500',
    },
  ];

  const workloadByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const dueDateKey = format(date, 'yyyy-MM-dd');
    const deadlineCount = deadlines.filter(
      (deadline) => !deadline.completed && normalizeDateValue(deadline.dueDate)?.slice(0, 10) === dueDateKey,
    ).length;
    const todoCount = openTodos.filter((todo) => normalizeDateValue(todo.dueDate)?.slice(0, 10) === dueDateKey).length;
    const intensity = deadlineCount * 3 + todoCount;
    return {
      label: format(date, 'EEE'),
      deadlineCount,
      todoCount,
      intensity,
      dateLabel: format(date, 'd MMM'),
    };
  });
  const maxWorkload = Math.max(...workloadByDay.map((day) => day.intensity), 1);

  const summaryText = overdueDeadlines.length > 0
    ? `You have ${overdueDeadlines.length} overdue ${overdueDeadlines.length === 1 ? 'item' : 'items'} and should stabilize the backlog before adding new work.`
    : dueThisWeek.length > 0
      ? `${dueThisWeek.length} assessment ${dueThisWeek.length === 1 ? 'is' : 'are'} due in the next 7 days. Protect execution blocks now.`
      : momentumScore >= 70
        ? 'Your academic operating rhythm is healthy. This is a good week to convert revision into assessed output.'
        : 'Your signals are forming, but the page needs more recent outputs to become sharper. Use it as your weekly checkpoint.';

  const nextActions = [
    overdueDeadlines.length > 0
      ? {
          label: 'Stabilize due work',
          detail: 'Open deadlines and clear the oldest overdue item first.',
          action: 'Open deadlines',
          onClick: () => navigate(studentPortalToolPath('university', 'deadlines')),
        }
      : null,
    dueThisWeek.length > 0
      ? {
          label: 'Prepare the next assessment',
          detail: nextDeadline && parseDateValue(nextDeadline.dueDate)
            ? `${nextDeadline.title} is due ${format(parseDateValue(nextDeadline.dueDate) as Date, 'EEE d MMM')}.`
            : 'Tighten the next due assessment.',
          action: 'Open assignment studio',
          onClick: () => navigate(studentPortalToolPath('university', 'assignment-studio')),
        }
      : null,
    quizAttempts.length === 0
      ? {
          label: 'Create a performance signal',
          detail: 'Complete one quiz so this page can track real assessment accuracy.',
          action: 'Start a quiz',
          onClick: () => navigate(studentPortalToolPath('university', 'practice-quiz')),
        }
      : null,
    revisionAssetCount < 4
      ? {
          label: 'Build your revision engine',
          detail: 'Turn notes into flashcards or a quiz pack so outputs start compounding.',
          action: 'Open study tools',
          onClick: () => navigate(studentPortalToolPath('university', 'study')),
        }
      : null,
    activeGoals.length === 0
      ? {
          label: 'Set outcome targets',
          detail: 'Define a few measurable university goals so momentum has a destination.',
          action: 'Open goals',
          onClick: () => navigate(studentPortalToolPath('university', 'academic-goals')),
        }
      : null,
    openTodos.length > 0
      ? {
          label: 'Reduce task clutter',
          detail: `${highPriorityTodos.length || openTodos.length} task${(highPriorityTodos.length || openTodos.length) === 1 ? '' : 's'} need attention before your week gets noisy.`,
          action: 'Open to-do list',
          onClick: () => navigate(studentPortalToolPath('university', 'todo')),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 3);

  const pipelineItems = upcomingDeadlines.slice(0, 4).map((deadline) => {
    const dueDate = parseDateValue(deadline.dueDate);
    return {
      ...deadline,
      dueDateLabel: dueDate ? format(dueDate, 'EEE d MMM') : 'Date pending',
      daysLeft: dueDate ? differenceInCalendarDays(startOfDay(dueDate), today) : null,
    };
  });

  const copySummary = async () => {
    const summary = [
      `Performance Insights`,
      `Momentum score: ${momentumScore}% (${getReadinessLabel(momentumScore)})`,
      `Pressure: ${pressureScore}% (${pressureTone.label})`,
      `Upcoming assessments this week: ${dueThisWeek.length}`,
      `Open tasks: ${openTodos.length}`,
      `Revision outputs: ${revisionAssetCount}`,
      `Assessment trend: ${latestPercent ? `${latestPercent}% latest result` : 'No marked result yet'}`,
      `Next priority: ${nextActions[0]?.label || 'Protect one focused study block'}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      // non-blocking
    }
  };

  const metricCards = [
    {
      title: 'Momentum score',
      value: `${momentumScore}%`,
      detail: getReadinessLabel(momentumScore),
      icon: TrendingUp,
      style: 'bg-slate-950 text-white border-slate-900',
    },
    {
      title: 'Pressure radar',
      value: `${pressureScore}%`,
      detail: pressureTone.label,
      icon: AlertTriangle,
      style: 'bg-white text-zinc-950 border-zinc-200',
    },
    {
      title: 'Upcoming assessments',
      value: `${dueThisWeek.length}`,
      detail: nextDeadline && parseDateValue(nextDeadline.dueDate)
        ? `Next: ${format(parseDateValue(nextDeadline.dueDate) as Date, 'EEE d MMM')}`
        : 'No due items in the next 7 days',
      icon: GraduationCap,
      style: 'bg-white text-zinc-950 border-zinc-200',
    },
    {
      title: 'Revision outputs',
      value: `${revisionAssetCount}`,
      detail: `${flashcardCount} flashcards · ${quizSetCount} quiz packs`,
      icon: Brain,
      style: 'bg-white text-zinc-950 border-zinc-200',
    },
  ];

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  const groveMilestones = [
    { label: 'Tasks closed', value: completedTodos.length, note: 'Each finished task helps the grove fill out.' },
    { label: 'Revision outputs', value: revisionAssetCount, note: 'Flashcards, quiz packs, and attempts grow visible progress.' },
    { label: 'Goals completed', value: completedGoals.length, note: 'Closed goals add stronger, more established trees.' },
  ];
  const groveActionCount = completedTodos.length + revisionAssetCount + completedGoals.length;
  const groveZoomLevel =
    groveActionCount >= 36 ? 'Grove detail'
      : groveActionCount >= 18 ? 'Mid canopy'
        : 'Basin view';
  const groveDensity =
    groveActionCount >= 36 ? 'Dense canopy'
      : groveActionCount >= 18 ? 'Expanding canopy'
        : 'Young canopy';
  const groveSpecies = [
    { key: 'pine', src: pineTreeLog, name: 'Pine', unlock: 'Focus and consistency', width: 96, height: 136 },
    { key: 'bushy', src: bushyTreeLog, name: 'Bush tree', unlock: 'Task completion and assignment progress', width: 116, height: 126 },
    { key: 'palm', src: palmTreeLog, name: 'Palm', unlock: 'Revision outputs and streak momentum', width: 78, height: 156 },
  ] as const;
  const groveRewardTreeCount = Math.max(0, completedTodos.length + revisionAssetCount + completedGoals.length * 2 + Math.floor(streakDays / 3));
  const groveTreeCount = 3 + groveRewardTreeCount;
  const groveTrees = useMemo(() => (
    Array.from({ length: groveTreeCount }, (_, index) => {
      const starter = index < groveSpecies.length;
      const species = starter ? groveSpecies[index] : groveSpecies[Math.floor(seededUnit(index + 17) * groveSpecies.length)];
      const seed = index + 1;
      const worldX = 10 + seededUnit(seed * 1.7) * 80;
      const worldY = 20 + seededUnit(seed * 2.3) * 62;
      const depth = Math.round(worldY);
      const scale = starter
        ? 0.78 + index * 0.04
        : 0.68 + seededUnit(seed * 3.1) * 0.34;
      return {
        id: `${species.key}-${index}`,
        src: species.src,
        name: species.name,
        unlock: species.unlock,
        worldX,
        worldY,
        scale,
        rotate: (seededUnit(seed * 5.2) - 0.5) * 9,
        opacity: 0.88 + seededUnit(seed * 4.1) * 0.1,
        zIndex: depth + (starter ? 20 : 0),
        width: species.width,
        height: species.height,
      };
    })
  ), [groveTreeCount]);
  const groveLegend = [
    { title: 'Starter grove', note: 'Every student begins with one pine, one bush tree, and one palm.' },
    { title: 'Reward drops', note: 'Completed work adds more trees into random map positions across the same world.' },
    { title: 'Camera sweep', note: 'The scene pans and zooms across one rainforest map instead of swapping backgrounds.' },
  ];
  const forestWorldPath = studentPortalPath('university', '/forest-world');

  const openGrove = () => {
    setActiveView('forest');
    window.setTimeout(() => {
      groveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  return (
    <div className={cn('space-y-6 overflow-x-hidden', isPhone ? 'p-4' : 'p-8')}>
      <header className={cn('overflow-hidden rounded-[34px] border border-zinc-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_45%,#eef2ff_100%)] shadow-[0_24px_60px_rgba(15,23,42,0.08)]', isPhone ? 'p-5' : 'p-8')}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
                <Trophy className="h-6 w-6" />
              </div>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
                University performance
              </span>
            </div>
            <h1 className={cn('mt-4 font-black tracking-tight text-zinc-950', isPhone ? 'text-[2rem] leading-none' : 'text-5xl')}>
              A page worth checking before the week checks you
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-zinc-600 sm:text-base">
              This dashboard reads your real study pressure, output quality, and next academic move so you can decide what matters before the week gets noisy.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[22rem]">
            <div className="rounded-[26px] border border-zinc-200 bg-white/80 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">Executive signal</p>
              <p className="mt-2 text-xl font-black text-zinc-950">{summaryText}</p>
            </div>
            <div className="rounded-[26px] border border-zinc-200 bg-slate-950 p-4 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">This week</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl font-black">{streakDays}d</p>
                  <p className="text-sm font-bold text-white/70">current study streak</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/50">Target</p>
                  <p className="mt-1 text-lg font-black">{streakGoal} days</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-2 shadow-sm">
        <div className={cn('grid gap-2', isPhone ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.9fr)]')}>
          {[
            { id: 'overview', label: 'Performance Hub', desc: 'Weekly operating view, momentum, and growth.' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as 'overview')}
              className={cn(
                'rounded-[22px] px-4 py-4 text-left transition',
                activeView === tab.id ? 'bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]' : 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100',
              )}
            >
              <p className={cn('text-sm font-black', activeView === tab.id ? 'text-white' : 'text-zinc-950')}>{tab.label}</p>
              <p className={cn('mt-1 text-xs font-semibold leading-5', activeView === tab.id ? 'text-white/70' : 'text-zinc-500')}>{tab.desc}</p>
            </button>
          ))}
          <button
            onClick={() => navigate(studentPortalPath('university', '/class-progress'))}
            className="rounded-[22px] bg-zinc-50 px-4 py-4 text-left text-zinc-900 transition hover:bg-zinc-100"
          >
            <p className="text-sm font-black text-zinc-950">Course Standing</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
              Open the dedicated course standing page for semester, year, and degree progress.
            </p>
          </button>
          <button
            onClick={openGrove}
            className={cn(
              'rounded-[22px] px-4 py-4 text-left transition',
              activeView === 'forest'
                ? 'bg-emerald-50 text-zinc-950 ring-1 ring-emerald-200'
                : 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100',
            )}
          >
            <p className="text-sm font-black text-zinc-950">Forest Growth</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-zinc-500">
              Open the grove and see your study effort turn into something visual.
            </p>
          </button>
        </div>
      </section>

      {activeView === 'overview' ? (
        <>

      <section className={cn('grid gap-4', isPhone ? 'grid-cols-2' : 'lg:grid-cols-4')}>
        {metricCards.map((card) => (
          <div key={card.title} className={cn('rounded-[28px] border p-5 shadow-sm', card.style)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={cn('text-[10px] font-black uppercase tracking-[0.22em]', card.style.includes('text-white') ? 'text-white/55' : 'text-zinc-400')}>
                  {card.title}
                </p>
                <p className="mt-3 text-3xl font-black">{card.value}</p>
                <p className={cn('mt-2 text-sm font-bold leading-6', card.style.includes('text-white') ? 'text-white/70' : 'text-zinc-600')}>
                  {card.detail}
                </p>
              </div>
              <card.icon className={cn('h-5 w-5', card.style.includes('text-white') ? 'text-white/55' : 'text-zinc-400')} />
            </div>
          </div>
        ))}
      </section>

      <section className={cn('grid gap-6', !isPhone && 'xl:grid-cols-[1.2fr_0.8fr]')}>
        <div className="rounded-[34px] border border-zinc-200 bg-white p-6 shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Pressure map</p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950">Next 7 days</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                See where deadlines and task due dates are clustering before they become a reactive week.
              </p>
            </div>
            <span className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]', pressureTone.className)}>
              {pressureTone.label}
            </span>
          </div>

          <div className={cn('mt-6 grid gap-3', isPhone ? 'grid-cols-2' : 'grid-cols-3')}>
            {workloadByDay.map((day) => (
              <div key={day.label} className="rounded-[24px] border border-zinc-100 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">{day.label}</p>
                    <p className="mt-1 text-sm font-bold text-zinc-600">{day.dateLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-zinc-950">{day.deadlineCount}</p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">deadlines</p>
                  </div>
                </div>
                <div className="mt-4 flex h-24 items-end">
                  <div
                    className="w-full rounded-t-[18px] bg-gradient-to-t from-slate-900 via-sky-600 to-cyan-300 transition-all"
                    style={{ height: `${Math.max(10, (day.intensity / maxWorkload) * 100)}%` }}
                  />
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-sm font-semibold leading-6 text-zinc-500">
                    {day.todoCount} task due dates
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[34px] border border-zinc-200 bg-white p-6 shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Readiness pillars</p>
            <div className="mt-5 space-y-4">
              {readinessPillars.map((pillar) => (
                <div key={pillar.label}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-black text-zinc-950">{pillar.label}</p>
                    <p className="text-sm font-black text-zinc-500">{pillar.value}%</p>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-100">
                    <div className={cn('h-full rounded-full transition-all', pillar.tone)} style={{ width: `${pillar.value}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">{pillar.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] border border-zinc-200 bg-slate-950 p-6 text-white shadow-[0_22px_50px_rgba(15,23,42,0.18)]">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">AI brief</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-[22px] bg-white/8 p-4">
                <p className="text-sm font-bold leading-6 text-white/90">{summaryText}</p>
              </div>
              <div className="rounded-[22px] bg-white/8 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Learning preference</p>
                <p className="mt-2 text-sm font-bold leading-6 text-white/85">
                  {learningProfile
                    ? `${methodLabels[learningProfile.primaryMethod] || 'Structured revision'} is your strongest mode, and ${challengeLabels[learningProfile.challenge] || 'study consistency'} remains the main friction point.`
                    : 'Add a learning profile to make this brief smarter about how you work best.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={cn('grid gap-6', !isPhone && 'xl:grid-cols-[0.95fr_1.05fr_0.9fr]')}>
        <div className="rounded-[34px] border border-zinc-200 bg-white p-6 shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Assessment pipeline</p>
              <h3 className="mt-2 text-xl font-black text-zinc-950">What is coming at you</h3>
            </div>
            <GraduationCap className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="mt-5 space-y-3">
            {pipelineItems.length > 0 ? pipelineItems.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-zinc-100 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-zinc-950">{item.title}</p>
                    <p className="mt-1 text-xs font-semibold text-zinc-500">{item.course || 'General'} · {item.type}</p>
                  </div>
                  <span className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                    item.priority === 'high'
                      ? 'bg-rose-100 text-rose-700'
                      : item.priority === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {item.priority}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold">
                  <span className="text-zinc-600">{item.dueDateLabel}</span>
                  <span className={cn((item.daysLeft ?? 99) <= 2 ? 'text-rose-700' : 'text-zinc-900')}>
                    {item.daysLeft === null ? 'Date pending' : item.daysLeft === 0 ? 'Due today' : item.daysLeft === 1 ? '1 day left' : `${item.daysLeft} days left`}
                  </span>
                </div>
              </div>
            )) : (
              <div className="rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold leading-6 text-zinc-500">
                No upcoming deadlines yet. Add your next assignment or exam to turn this page into a real pressure tracker.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[34px] border border-zinc-200 bg-white p-6 shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Next moves</p>
          <h3 className="mt-2 text-xl font-black text-zinc-950">Do these next</h3>
          <div className="mt-5 space-y-3">
            {nextActions.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full rounded-[24px] border border-zinc-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-4 text-left transition-all hover:border-zinc-300 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-zinc-950">{item.label}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{item.detail}</p>
                    <p className="mt-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-sky-700">
                      {item.action} <ArrowRight className="h-3.5 w-3.5" />
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[34px] border border-zinc-200 bg-white p-6 shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Student profile</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-zinc-100 bg-zinc-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Subjects in play</p>
                <p className="mt-2 text-3xl font-black text-zinc-950">{subjects.length}</p>
                <p className="mt-2 text-sm font-semibold text-zinc-500">
                  {subjects.length ? subjects.slice(0, 3).join(' · ') : 'No timetable or subject data yet'}
                </p>
              </div>
              <div className="rounded-[24px] border border-zinc-100 bg-zinc-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Assignment plan tasks</p>
                <p className="mt-2 text-3xl font-black text-zinc-950">{openPlanTasks}</p>
                <p className="mt-2 text-sm font-semibold text-zinc-500">Outstanding checklist items across active assignment plans</p>
              </div>
              <div className="rounded-[24px] border border-zinc-100 bg-zinc-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Goal traction</p>
                <p className="mt-2 text-3xl font-black text-zinc-950">{goalProgress || 0}%</p>
                <p className="mt-2 text-sm font-semibold text-zinc-500">{activeGoals.length} active goals · {completedGoals.length} completed</p>
              </div>
            </div>
          </div>

          <div className="rounded-[34px] border border-zinc-200 bg-white p-6 shadow-[0_22px_50px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Command actions</p>
            <div className="mt-5 space-y-3">
              <button onClick={copySummary} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
                <Copy size={16} /> Copy weekly brief
              </button>
              <button onClick={() => navigate(studentPortalPath('university', '/class-progress'))} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-900">
                <TrendingUp size={16} /> Open course standing
              </button>
              <button onClick={() => navigate(studentPortalToolPath('university', 'study'))} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-900">
                <BookOpen size={16} /> Open study tools
              </button>
            </div>
          </div>
        </div>
      </section>

        </>
      ) : activeView === 'forest' ? (
        <section
          ref={groveSectionRef}
          className="overflow-hidden rounded-[36px] border border-[#7dc69a] bg-[radial-gradient(circle_at_top,rgba(222,255,233,0.24),transparent_26%),linear-gradient(180deg,#edf8f0_0%,#b9dfc0_18%,#6aa676_54%,#2f6941_86%,#173523_100%)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-emerald-950/10 bg-white/58 px-3 py-1 backdrop-blur-md">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-950/75">Forest growth</p>
              </div>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-emerald-950 sm:text-4xl">Your study rainforest</h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-emerald-950/72 sm:text-base">
                Every real action in the app grows this space. This view is intentionally separate from the heavier analytics so students get a cleaner, more rewarding end-state.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-950/10 bg-emerald-950/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-50">
                  Camera: {groveZoomLevel}
                </span>
                <span className="rounded-full border border-emerald-950/10 bg-white/65 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-950/75">
                  {groveDensity}
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[30rem]">
              {groveMilestones.map((item) => (
                <div key={item.label} className="rounded-[24px] border border-emerald-950/10 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-950/55">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-emerald-950">{item.value}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-emerald-950/70">{item.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-[30px] border border-white/20 bg-[linear-gradient(180deg,rgba(234,255,240,0.18)_0%,rgba(62,126,80,0.22)_46%,rgba(16,42,28,0.42)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <div className={cn('relative overflow-hidden rounded-[24px]', isPhone ? 'h-[30rem]' : 'h-[34rem]')}>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#d7ecd6_0%,#c8e0c6_10%,#4b8458_34%,#1c4b2e_68%,#0a2013_100%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.36),transparent_18%),radial-gradient(circle_at_72%_16%,rgba(229,255,238,0.12),transparent_15%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[24%] bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.02))]" />
              {groveTrees.map((tree) => (
                <div
                  key={tree.id}
                  className="pointer-events-none absolute flex items-end justify-center"
                  style={{
                    left: `${tree.worldX}%`,
                    top: `${tree.worldY}%`,
                    width: tree.width * 0.82,
                    height: tree.height * 0.82,
                    zIndex: tree.zIndex,
                    transform: `translate(-50%, -78%) rotate(${tree.rotate}deg) scale(${tree.scale})`,
                    opacity: tree.opacity,
                  }}
                >
                  <div className="absolute bottom-1 h-[14%] w-[56%] rounded-full bg-black/24 blur-[8px]" />
                  <img
                    src={tree.src}
                    alt={tree.name}
                    className="relative h-full w-full object-contain saturate-[1.02] drop-shadow-[0_16px_20px_rgba(5,20,12,0.28)]"
                  />
                </div>
              ))}
              <div className="pointer-events-none absolute right-5 top-5 rounded-full border border-white/20 bg-[#163222]/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-50 backdrop-blur-md">
                Rainforest view
              </div>
              <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-white/15 bg-[#10281b]/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-50 backdrop-blur-md">
                {groveTreeCount} trees planted
              </div>
              <button
                onClick={() => navigate(forestWorldPath)}
                className="absolute right-5 bottom-5 rounded-[18px] border border-white/15 bg-[#10281b]/78 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-50 backdrop-blur-md transition hover:bg-[#163222]"
              >
                Open full world
              </button>
              <div className="absolute left-5 bottom-5 flex gap-3">
                <div className="pointer-events-none rounded-[22px] border border-white/15 bg-[#10281b]/68 px-4 py-3 text-emerald-50 backdrop-blur-md">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100/72">Live camera</p>
                  <p className="mt-1 text-sm font-black">{groveZoomLevel}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-50/68">{groveDensity}</p>
                </div>
                <div className="flex flex-col gap-2 rounded-[22px] border border-white/15 bg-[#10281b]/78 p-2 text-emerald-50 backdrop-blur-md">
                  <div className="flex gap-2">
                    <button onClick={() => navigate(forestWorldPath)} className="pointer-events-auto rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50 transition hover:bg-white/12">
                      Zoom +
                    </button>
                    <button onClick={() => navigate(forestWorldPath)} className="pointer-events-auto rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50 transition hover:bg-white/12">
                      Zoom -
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(forestWorldPath)} className="pointer-events-auto rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50 transition hover:bg-white/12">
                      ←
                    </button>
                    <button onClick={() => navigate(forestWorldPath)} className="pointer-events-auto rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50 transition hover:bg-white/12">
                      ↑
                    </button>
                    <button onClick={() => navigate(forestWorldPath)} className="pointer-events-auto rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50 transition hover:bg-white/12">
                      ↓
                    </button>
                    <button onClick={() => navigate(forestWorldPath)} className="pointer-events-auto rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50 transition hover:bg-white/12">
                      →
                    </button>
                    <button onClick={() => navigate(forestWorldPath)} className="pointer-events-auto rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-50 transition hover:bg-white/12">
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {groveLegend.map((item) => (
            <div key={item.title} className="rounded-[22px] border border-emerald-950/10 bg-white/20 p-4 backdrop-blur-md">
              <p className="text-sm font-black text-emerald-950">{item.title}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-emerald-950/72">{item.note}</p>
            </div>
          ))}
        </div>
      </section>
      ) : null}
    </div>
  );
}

export default function ProgressPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isUniversityPortal = detectStudentPortalFromPath(location.pathname) === 'university';
  const [activeTab, setActiveTab] = useState('Goals vs Actual');
  const [streakDays, setStreakDays] = useState(0);
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [flashcardCount, setFlashcardCount] = useState(0);
  const [quizSetCount, setQuizSetCount] = useState(0);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [assignmentPlans, setAssignmentPlans] = useState<AssignmentPlan[]>([]);
  const streakGoal = 30;
  const { isPhone } = useResponsiveDevice();
  const todos = useTodoStore((state) => state.todos);
  const goals = useAcademicGoalsStore((state) => state.goals);
  const timetableEntries = useTimetableStore((state) => state.entries);

  const tabs = isUniversityPortal
    ? ['Focus vs Target', 'Workload Rhythm', 'Assessment Pattern', 'Mood Signal']
    : ['Goals vs Actual', 'Weekly Waveform', 'Weekly Report', 'Monthly Mood'];

  const getStreakReward = (days: number) => {
    if (days >= 30) return { icon: '🏆', label: 'Legend streak' };
    if (days >= 21) return { icon: '🚀', label: 'Momentum unlocked' };
    if (days >= 14) return { icon: '🌟', label: 'Focus star' };
    if (days >= 7) return { icon: '🔥', label: 'Heat mode' };
    if (days >= 5) return { icon: '✨', label: 'Surprise unlocked' };
    return null;
  };

  const streakReward = getStreakReward(streakDays);

  useEffect(() => {
    const loadStreak = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'focusStreaks', user.uid));
        if (!snap.exists()) return;
        const data = snap.data() as { currentStreak?: number };
        setStreakDays(Math.max(0, data.currentStreak ?? 0));
      } catch {
        // non-blocking: keep dashboard usable even if streak read fails
      }
    };
    loadStreak();
  }, []);

  useEffect(() => {
    try {
      const storedProfile = window.localStorage.getItem('learning-profile');
      setLearningProfile(storedProfile ? JSON.parse(storedProfile) : null);
      const storedAttempts = JSON.parse(window.localStorage.getItem('learning-quiz-attempts') || '[]') as QuizAttempt[];
      setQuizAttempts(storedAttempts);
    } catch {
      setLearningProfile(null);
      setQuizAttempts([]);
    }

    const loadToolCounts = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const flashcardsSnap = await getDocs(query(collection(db, 'flashcards'), where('userId', '==', user.uid)));
        const quizzesSnap = await getDocs(query(collection(db, 'quizzes'), where('userId', '==', user.uid)));
        setFlashcardCount(flashcardsSnap.size);
        setQuizSetCount(quizzesSnap.size);
      } catch {
        setFlashcardCount(0);
        setQuizSetCount(0);
      }
    };

    loadToolCounts();
  }, []);

  useEffect(() => {
    const loadUniversityData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const [deadlineSnap, assignmentPlanSnap] = await Promise.all([
          getDocs(query(collection(db, 'deadlines'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'assignmentPlans'), where('userId', '==', user.uid))),
        ]);

        setDeadlines(deadlineSnap.docs.map((deadlineDoc) => ({ id: deadlineDoc.id, ...deadlineDoc.data() } as Deadline)));
        setAssignmentPlans(assignmentPlanSnap.docs.map((planDoc) => ({ id: planDoc.id, ...planDoc.data() } as AssignmentPlan)));
      } catch {
        setDeadlines([]);
        setAssignmentPlans([]);
      }
    };

    loadUniversityData();
  }, []);

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab(tabs[0]);
    }
  }, [activeTab, tabs]);

  const chronologicalAttempts = [...quizAttempts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const firstAttempt = chronologicalAttempts[0];
  const latestAttempt = chronologicalAttempts[chronologicalAttempts.length - 1];
  const firstPercent = firstAttempt ? Math.round((firstAttempt.score / Math.max(firstAttempt.total, 1)) * 100) : 0;
  const latestPercent = latestAttempt ? Math.round((latestAttempt.score / Math.max(latestAttempt.total, 1)) * 100) : 0;
  const quizImprovement = firstAttempt && latestAttempt ? latestPercent - firstPercent : 0;
  const focusHours = 14;
  const focusGoalHours = 18;
  const tasksDone = 25;
  const taskGoal = 30;
  const deadlinesMet = 5;
  const deadlinesGoal = 5;
  const focusUtilization = Math.round((focusHours / focusGoalHours) * 100);
  const taskCompletionRate = Math.round((tasksDone / taskGoal) * 100);
  const deadlineReliability = Math.round((deadlinesMet / deadlinesGoal) * 100);
  const recentAverage = chronologicalAttempts.length
    ? Math.round(
        chronologicalAttempts.reduce((sum, attempt) => sum + Math.round((attempt.score / Math.max(attempt.total, 1)) * 100), 0) /
          chronologicalAttempts.length
      )
    : 0;

  if (isUniversityPortal) {
    return (
      <UniversityProgressDashboard
        isPhone={isPhone}
        streakDays={streakDays}
        streakGoal={streakGoal}
        learningProfile={learningProfile}
        quizAttempts={quizAttempts}
        flashcardCount={flashcardCount}
        quizSetCount={quizSetCount}
        recentAverage={recentAverage}
        latestPercent={latestPercent}
        quizImprovement={quizImprovement}
        deadlines={deadlines}
        assignmentPlans={assignmentPlans}
        todos={todos}
        goals={goals}
        timetableEntries={timetableEntries}
      />
    );
  }
  const productivitySummary = [
    { label: 'Focus hours logged', value: `${focusHours}h`, note: `${focusGoalHours}h weekly target` },
    { label: 'Tasks completed', value: `${tasksDone}`, note: `${taskGoal - tasksDone} tasks remaining` },
    { label: 'Revision assets built', value: `${flashcardCount + quizSetCount}`, note: `${flashcardCount} flashcards · ${quizSetCount} quiz sets` },
  ];
  const riskSummary = [
    {
      label: 'Primary blocker',
      value: learningProfile ? challengeLabels[learningProfile.challenge] || 'Study consistency' : 'No learning profile signal',
      tone: 'text-amber-700',
    },
    {
      label: 'Assessment signal',
      value: latestAttempt ? `${latestPercent}% latest accuracy` : 'No recent quiz signal',
      tone: latestAttempt ? 'text-emerald-700' : 'text-zinc-500',
    },
    {
      label: 'Reliability',
      value: `${deadlineReliability}% deadlines met`,
      tone: deadlineReliability >= 100 ? 'text-emerald-700' : 'text-sky-700',
    },
  ];
  const universitySummaryCards = [
    { title: 'Focus utilization', value: `${focusUtilization}%`, detail: `${focusHours}h of ${focusGoalHours}h target`, icon: Clock, accent: 'from-slate-900 to-slate-700 text-white border-slate-800' },
    { title: 'Task delivery', value: `${taskCompletionRate}%`, detail: `${tasksDone}/${taskGoal} weekly deliverables`, icon: CheckCircle2, accent: 'bg-white text-zinc-950 border-zinc-200' },
    { title: 'Deadline reliability', value: `${deadlineReliability}%`, detail: `${deadlinesMet}/${deadlinesGoal} commitments met`, icon: Target, accent: 'bg-white text-zinc-950 border-zinc-200' },
    { title: 'Assessment trend', value: latestAttempt ? `${latestPercent}%` : 'No data', detail: latestAttempt ? `Change of ${quizImprovement > 0 ? '+' : ''}${quizImprovement}% from baseline` : 'Complete a quiz to unlock signal', icon: Brain, accent: 'bg-white text-zinc-950 border-zinc-200' },
    { title: 'Current streak', value: `${streakDays}d`, detail: `Target: ${streakGoal} day consistency`, icon: Flame, accent: 'bg-white text-zinc-950 border-zinc-200' },
  ];

  return (
    <div className={cn("space-y-8 overflow-x-hidden", isPhone ? "p-4" : "p-8")}>
      <header
        className={cn(
          isUniversityPortal ? 'border border-slate-200 bg-white text-zinc-950 shadow-sm' : 'bg-gradient-to-r from-indigo-500 to-emerald-500 text-white shadow-lg',
          isPhone ? "rounded-[28px] p-5" : "rounded-3xl p-8"
        )}
      >
        <h1 className={cn("font-black flex items-center", isPhone ? "gap-2 text-[2rem] leading-none" : "gap-3 text-4xl")}>
          <Trophy /> {isUniversityPortal ? 'Performance Insights' : 'My Progress'}
        </h1>
        <p className={cn("mt-2", isUniversityPortal ? 'text-zinc-600' : 'opacity-90', isPhone ? "text-sm leading-6" : "")}>
          {isUniversityPortal
            ? 'Weekly academic operating view for focus, delivery, assessment readiness, and output quality.'
            : 'Track goals, see your progress trends, and export weekly reports.'}
        </p>
        {isUniversityPortal && (
          <div className={cn("mt-5 flex flex-wrap gap-2", isPhone ? "gap-2" : "gap-3")}>
            {['University Edition', 'Current week', 'Auto-synced'].map((chip) => (
              <span key={chip} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
                {chip}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Summary Cards */}
      <div className={cn("grid", isUniversityPortal ? (isPhone ? "grid-cols-2 gap-3" : "grid-cols-1 gap-4 lg:grid-cols-5") : isPhone ? "grid-cols-2 gap-3" : "grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4")}>
        {(isUniversityPortal ? universitySummaryCards : [
          { title: 'Focus Time', value: '14h', goal: 'Goal: 18h', icon: Clock, color: 'bg-sky-50' },
          { title: 'Tasks Done', value: '25', goal: 'Goal: 30', icon: CheckCircle2, color: 'bg-pink-50' },
          { title: 'Deadlines Met', value: '5', goal: 'Goal: 5', icon: Target, color: 'bg-amber-50' },
          { title: 'Streak', value: `${streakDays} days`, goal: `Goal: ${streakGoal} days`, icon: Flame, color: 'bg-orange-50' },
        ]).map((card) => (
          <div
            key={card.title}
            className={cn(
              isPhone ? "rounded-[24px] border p-4 shadow-sm" : "rounded-3xl border p-6 shadow-sm",
              isUniversityPortal
                ? `${card.accent} ${String(card.accent).includes('from-') ? 'bg-gradient-to-br' : ''}`
                : card.color
            )}
          >
            <div className="flex justify-between items-start">
              <h3 className={cn("font-bold flex items-center", isUniversityPortal ? 'text-current/80 uppercase tracking-[0.14em] text-[11px]' : "text-zinc-700", isPhone ? "gap-1.5 leading-4" : "gap-2")}><card.icon size={isPhone ? 15 : 18} /> {card.title}</h3>
              <Share2 size={isPhone ? 14 : 16} className={cn(isUniversityPortal ? "text-current/45" : "text-zinc-400")} />
            </div>
            {card.title !== 'Streak' && (
              <>
                <div className={cn("font-black text-zinc-900 mt-4", isPhone ? "text-[1.8rem] leading-none" : "text-4xl")}>{card.value}</div>
                <div className={cn("mt-1", isUniversityPortal ? "text-current/70" : "text-zinc-500", isPhone ? "text-[11px] leading-4" : "text-sm")}>{isUniversityPortal ? card.detail : card.goal}</div>
                {card.title === 'Focus Time' && (
                  <div className={cn("mt-3 flex items-center justify-between gap-3", isPhone && "mt-2 gap-2")}>
                    <div className="text-[11px] text-zinc-500">Streak unlock</div>
                    <div className={cn("relative", isPhone ? "h-12 w-14" : "h-16 w-20")}>
                      {streakReward && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className={cn(isPhone ? "text-base leading-none" : "text-xl leading-none")}>{streakReward.icon}</span>
                          <span className="text-[9px] font-bold text-zinc-500 mt-1 text-center">{streakReward.label}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 grid grid-cols-4 gap-1 p-1">
                        {Array.from({ length: 12 }).map((_, index) => {
                          const filled = index < Math.min(12, streakDays);
                          return (
                            <div
                              key={index}
                              className={cn(
                                'rounded-[3px] transition-all',
                                filled ? 'bg-orange-200/65' : 'bg-zinc-200'
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {card.title === 'Streak' && (
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className={cn("font-black text-zinc-900", isPhone ? "text-[1.8rem] leading-none" : "text-4xl")}>{streakDays}</div>
                  <div className={cn(isUniversityPortal ? "text-current/70" : "text-zinc-500", isPhone ? "text-[11px]" : "text-sm")}>days</div>
                  <div className={cn("mt-1", isUniversityPortal ? "text-current/70" : "text-zinc-500", isPhone ? "text-[11px] leading-4" : "text-sm")}>Goal: {streakGoal} days</div>
                </div>
                <div className={cn("relative", isPhone ? "h-12 w-14" : "h-16 w-20")}>
                  {streakReward && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className={cn(isPhone ? "text-base leading-none" : "text-xl leading-none")}>{streakReward.icon}</span>
                      <span className="text-[9px] font-bold text-zinc-500 mt-1 text-center">{streakReward.label}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 grid grid-cols-4 gap-1 p-1">
                    {Array.from({ length: 12 }).map((_, index) => {
                      const filled = index < Math.min(12, streakDays);
                      return (
                        <div
                          key={index}
                          className={cn(
                            "rounded-[3px] transition-all",
                            filled ? "bg-orange-200/65" : "bg-zinc-200"
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isUniversityPortal ? (
        <section className={cn("grid grid-cols-1 gap-6", !isPhone && "lg:grid-cols-[1.1fr_0.9fr]")}>
          <div className={cn("rounded-3xl border border-zinc-200 bg-white shadow-sm", isPhone ? "rounded-[28px] p-5" : "p-6")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500">
                  <Brain size={17} />
                  Execution summary
                </p>
                <h2 className={cn("mt-3 font-black text-zinc-950", isPhone ? "text-xl leading-7" : "text-2xl")}>
                  Academic operating view
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Review where effort is going, how efficiently work is shipping, and which study assets are converting into usable assessment output.
                </p>
              </div>
              <Sparkles className="text-zinc-400" />
            </div>
            <div className={cn("mt-5 grid gap-3", !isPhone && "sm:grid-cols-3")}>
              {productivitySummary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.label}</p>
                  <p className="mt-2 text-3xl font-black text-zinc-950">{item.value}</p>
                  <p className="mt-2 text-sm font-bold text-zinc-600">{item.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={cn("rounded-3xl border border-zinc-200 bg-white shadow-sm", isPhone ? "rounded-[28px] p-5" : "p-6")}>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500">
              <Target size={17} />
              Academic risk watch
            </p>
            <div className="mt-5 space-y-3">
              {riskSummary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.label}</p>
                  <p className={cn("mt-2 text-lg font-black", item.tone)}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className={cn("grid grid-cols-1 gap-6", !isPhone && "lg:grid-cols-[0.95fr_1.05fr]")}>
          <div className={cn("rounded-3xl border border-emerald-100 bg-emerald-50 shadow-sm", isPhone ? "rounded-[28px] p-5" : "p-6")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700">
                  <Brain size={17} />
                  How I learn
                </p>
                <h2 className={cn("mt-3 font-black text-zinc-950", isPhone ? "text-xl leading-7" : "text-2xl")}>
                  {learningProfile ? methodLabels[learningProfile.primaryMethod] || 'Learning profile' : 'No profile yet'}
                </h2>
              </div>
              <Sparkles className="text-emerald-500" />
            </div>
            {learningProfile ? (
              <div className={cn("mt-5 grid gap-3", !isPhone && "sm:grid-cols-2")}>
                <div className="rounded-2xl bg-white/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Focus block</p>
                  <p className="mt-1 text-lg font-black text-zinc-900">{learningProfile.focusLength}</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Main blocker</p>
                  <p className="mt-1 text-lg font-black text-zinc-900">{challengeLabels[learningProfile.challenge] || 'Study consistency'}</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Recommended tools</p>
                  <p className="mt-1 text-sm font-bold text-zinc-700">{learningProfile.supportTools.join(', ')}</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-white/70 p-4">
                <p className="text-sm font-bold leading-6 text-zinc-600">Create your learning profile to connect study methods with progress.</p>
              </div>
            )}
          </div>

          <div className={cn("rounded-3xl border border-violet-100 bg-white shadow-sm", isPhone ? "rounded-[28px] p-5" : "p-6")}>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-violet-600">
              <BookOpen size={17} />
              Learning impact
            </p>
            <div className={cn("mt-5 grid gap-4", isPhone ? "grid-cols-1" : "sm:grid-cols-3")}>
              <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Flashcards</p>
                <p className="mt-2 text-3xl font-black text-zinc-950">{flashcardCount}</p>
                <p className="mt-1 text-xs font-bold text-zinc-500">sets created</p>
              </div>
              <div className="rounded-2xl bg-sky-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-sky-500">Quizzes</p>
                <p className="mt-2 text-3xl font-black text-zinc-950">{quizAttempts.length}</p>
                <p className="mt-1 text-xs font-bold text-zinc-500">attempts marked</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Saved quizlets</p>
                <p className="mt-2 text-3xl font-black text-zinc-950">{quizSetCount}</p>
                <p className="mt-1 text-xs font-bold text-zinc-500">AI quiz sets</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              {firstAttempt && latestAttempt ? (
                <p className="text-sm font-bold leading-6 text-zinc-700">
                  Quiz scores moved from {firstAttempt.score}/{firstAttempt.total} to {latestAttempt.score}/{latestAttempt.total}
                  {quizImprovement === 0 ? '.' : ` (${quizImprovement > 0 ? '+' : ''}${quizImprovement}%).`}
                </p>
              ) : (
                <p className="text-sm font-bold leading-6 text-zinc-700">
                  Mark a Practice Quiz or AI Quizlet to start tracking whether your study methods are improving your memory and accuracy.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Interactive Chart Area */}
      {isUniversityPortal ? (
        <div className={cn(
          "relative overflow-hidden rounded-[34px] border border-white/40 bg-white/12 shadow-[0_30px_80px_rgba(72,90,255,0.16)] backdrop-blur-2xl",
          isPhone ? "p-4" : "p-8"
        )}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(72,90,255,0.28),transparent_35%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.18),transparent_30%)]" />
          <div className="relative space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-zinc-500">Signal Console</p>
                <h3 className="text-2xl font-black tracking-tight text-zinc-950 md:text-3xl">Performance command deck</h3>
                <p className="max-w-2xl text-sm font-medium leading-6 text-zinc-600 md:text-base">
                  Review execution pressure, assessment rhythm, mood stability, and intervention windows from one university-grade control surface.
                </p>
              </div>
              <div className={cn("gap-2", isPhone ? "grid grid-cols-2" : "flex flex-wrap justify-end")}>
                {[
                  { label: 'Utilization', value: `${focusUtilization}%` },
                  { label: 'Assessment lift', value: `${quizImprovement > 0 ? '+' : ''}${quizImprovement} pts` },
                  { label: 'Task delivery', value: `${taskCompletionRate}%` },
                  { label: 'Deadline reliability', value: `${deadlineReliability}%` },
                ].map(metric => (
                  <div key={metric.label} className="rounded-2xl border border-white/50 bg-white/35 px-4 py-3 shadow-[0_18px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">{metric.label}</p>
                    <p className="mt-2 text-lg font-black text-zinc-950">{metric.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={cn(
              "grid gap-4",
              isPhone ? "grid-cols-1" : "lg:grid-cols-[1.45fr_0.85fr]"
            )}>
              <div className="overflow-hidden rounded-[30px] border border-white/45 bg-zinc-950/88 p-4 shadow-[0_30px_60px_rgba(3,7,18,0.28)] backdrop-blur-xl md:p-6">
                <div className={cn("gap-1.5 rounded-full bg-white/8 p-1", isPhone ? "grid grid-cols-2" : "flex w-fit")}>
                  {tabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "font-bold transition-all",
                        isPhone ? "rounded-[16px] px-2 py-2 text-[10px] leading-3.5 text-center" : "rounded-full px-5 py-2.5 text-sm",
                        activeTab === tab
                          ? "bg-white text-zinc-950 shadow-[0_12px_30px_rgba(255,255,255,0.12)]"
                          : "text-zinc-400 hover:text-white"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className={cn("mt-5 min-w-0", isPhone ? "h-64" : "h-[360px]")}>
                  {(activeTab === 'Focus vs Target' || activeTab === 'Goals vs Actual') && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 16, right: 6, left: -16, bottom: 8 }}>
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: isPhone ? 10 : 12, fill: '#94a3b8', fontWeight: 700 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: isPhone ? 10 : 12, fill: '#64748b', fontWeight: 700 }}
                          tickLine={false}
                          axisLine={false}
                          width={isPhone ? 24 : 34}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(9, 14, 30, 0.94)',
                            border: '1px solid rgba(148, 163, 184, 0.24)',
                            borderRadius: '18px',
                            color: '#fff',
                            boxShadow: '0 24px 48px rgba(0,0,0,0.32)',
                          }}
                          cursor={{ stroke: 'rgba(148,163,184,0.24)', strokeWidth: 1 }}
                        />
                        <Line type="monotone" dataKey="actual" stroke="rgba(34,211,238,0.2)" strokeWidth={10} dot={false} activeDot={false} />
                        <Line type="monotone" dataKey="goal" stroke="rgba(192,132,252,0.18)" strokeWidth={10} dot={false} activeDot={false} />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="#22d3ee"
                          strokeWidth={4}
                          dot={{ r: isPhone ? 4 : 5, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 3 }}
                          activeDot={{ r: isPhone ? 5 : 6, fill: '#22d3ee', stroke: '#cffafe', strokeWidth: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="goal"
                          stroke="#c084fc"
                          strokeWidth={4}
                          dot={{ r: isPhone ? 4 : 5, fill: '#0f172a', stroke: '#c084fc', strokeWidth: 3 }}
                          activeDot={{ r: isPhone ? 5 : 6, fill: '#c084fc', stroke: '#f5d0fe', strokeWidth: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  {activeTab === 'Workload Rhythm' && (
                    <div className="flex h-full items-center justify-center rounded-[26px] border border-white/10 bg-white/[0.03] p-3">
                      <svg viewBox="0 0 440 180" className="h-full w-full">
                        <defs>
                          <linearGradient id="uni-wave" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#22d3ee" />
                            <stop offset="35%" stopColor="#38bdf8" />
                            <stop offset="65%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#d946ef" />
                          </linearGradient>
                          <filter id="uni-glow">
                            <feGaussianBlur stdDeviation="6" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        <path
                          d="M20 98 C60 24, 108 158, 150 86 C196 18, 248 164, 292 96 C334 34, 382 150, 420 74"
                          fill="none"
                          stroke="url(#uni-wave)"
                          strokeWidth="5"
                          strokeLinecap="round"
                          filter="url(#uni-glow)"
                        />
                        <path
                          d="M20 112 C60 168, 108 40, 150 118 C196 168, 248 44, 292 116 C334 164, 382 54, 420 110"
                          fill="none"
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  )}

                  {activeTab === 'Assessment Pattern' && (
                    <div className="grid h-full gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Assessment readout</p>
                        <div className="mt-5 space-y-4">
                          <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Latest result</p>
                            <p className="mt-2 text-3xl font-black text-white">{latestPercent}%</p>
                            <p className="mt-2 text-sm font-medium leading-6 text-zinc-300">
                              {latestAttempt
                                ? `Assessment signal is ${quizImprovement >= 0 ? 'strengthening' : 'softening'} by ${Math.abs(quizImprovement)} points against your first recorded quiz.`
                                : 'No marked attempts recorded yet. Launch a practice quiz to activate trend tracking.'}
                            </p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                              <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Strongest mode</p>
                              <p className="mt-2 text-lg font-black text-white">{learningProfile ? methodLabels[learningProfile.primaryMethod] || 'Structured revision' : 'Not configured'}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                              <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Next intervention</p>
                              <p className="mt-2 text-lg font-black text-white">Convert one block into assessed output</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 rounded-[26px] border border-white/10 bg-gradient-to-b from-fuchsia-500/10 to-cyan-500/5 p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-fuchsia-300">AI desk note</p>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-sm font-bold leading-6 text-zinc-200">
                            Prioritize one deliverable that proves understanding under time pressure: practice quiz, timed recall set, or a short written response.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Output mix</p>
                          <p className="mt-2 text-sm font-bold leading-6 text-white">{flashcardCount} revision sets · {quizAttempts.length} marked attempts · {quizSetCount} saved quiz packs</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Mood Signal' && (
                    <div className="grid h-full gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">Stability band</p>
                        <div className="mt-5 grid grid-cols-5 gap-3">
                          {moodData.slice(0, 15).map((d, i) => (
                            <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                              <div className={cn("h-10 rounded-xl shadow-[0_0_18px_rgba(255,255,255,0.12)]", d.color)} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-3">
                        <div className="rounded-[26px] border border-white/10 bg-white/[0.05] p-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">Recovery signal</p>
                          <p className="mt-3 text-xl font-black text-white">Mood is steady enough to sustain output, but protect Thursday-style low-energy windows.</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-cyan-500/10 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Best recovery tool</p>
                            <p className="mt-2 text-lg font-black text-white">Short deep-work block + one concrete win</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-fuchsia-500/10 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-200">Watchlist</p>
                            <p className="mt-2 text-lg font-black text-white">Deadline clustering around low-focus days</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[30px] border border-white/40 bg-white/24 p-5 backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">Pressure window</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-zinc-950 px-4 py-3 text-white shadow-[0_20px_50px_rgba(15,23,42,0.24)]">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Next 72 hours</p>
                      <p className="mt-2 text-2xl font-black">{deadlinesMet}/{deadlinesGoal}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-300">deadlines landed on time</p>
                    </div>
                    <div className="rounded-2xl border border-white/50 bg-white/45 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-zinc-500">Most exposed zone</p>
                      <p className="mt-2 text-lg font-black text-zinc-950">{data.reduce((worst, day) => day.actual < worst.actual ? day : worst, data[0]).name}</p>
                      <p className="mt-1 text-sm font-medium leading-6 text-zinc-600">This is your weakest live-output day against target right now.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/40 bg-white/24 p-5 backdrop-blur-xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">AI performance brief</p>
                  <div className="mt-4 space-y-3">
                    {[
                      {
                        label: 'Execution',
                        text: `You are operating at ${focusUtilization}% of your focus target with ${taskCompletionRate}% task delivery.`,
                      },
                      {
                        label: 'Quality',
                        text: latestAttempt ? `Assessment quality is holding at ${latestPercent}% with ${quizImprovement >= 0 ? 'positive' : 'negative'} momentum.` : 'Assessment quality signal is waiting on the first marked quiz.',
                      },
                      {
                        label: 'Move next',
                        text: 'Use the next high-energy block to complete one visible output: quiz, flashcard pack, or graded draft section.',
                      },
                    ].map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/50 bg-white/45 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">{item.label}</p>
                        <p className="mt-2 text-sm font-bold leading-6 text-zinc-800">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={cn("grid gap-4", isPhone ? "grid-cols-1" : "xl:grid-cols-[1.15fr_0.85fr_0.85fr]")}>
              <div className="rounded-[30px] border border-white/40 bg-white/24 p-5 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">Assessment readiness pulse</p>
                    <h4 className="mt-2 text-2xl font-black text-zinc-950">Readiness mix</h4>
                  </div>
                  <Sparkles className="h-6 w-6 text-fuchsia-500" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Flashcards', value: flashcardCount, tone: 'from-cyan-500/20 to-cyan-400/5' },
                    { label: 'Quizzes', value: quizAttempts.length, tone: 'from-fuchsia-500/20 to-fuchsia-400/5' },
                    { label: 'Quiz packs', value: quizSetCount, tone: 'from-emerald-500/20 to-emerald-400/5' },
                  ].map(item => (
                    <div key={item.label} className={cn("rounded-2xl border border-white/40 bg-gradient-to-br p-4", item.tone)}>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">{item.label}</p>
                      <p className="mt-3 text-3xl font-black text-zinc-950">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/40 bg-white/24 p-5 backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">Next 72 hours</p>
                <div className="mt-5 space-y-3">
                  {[
                    'Protect one uninterrupted 90-minute execution block.',
                    'Convert one class note set into an assessed output.',
                    'Close one outstanding task before adding new admin work.',
                  ].map(item => (
                    <div key={item} className="rounded-2xl border border-white/45 bg-white/45 p-4 text-sm font-bold leading-6 text-zinc-800">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/40 bg-white/24 p-5 backdrop-blur-xl">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">Command actions</p>
                <div className="mt-5 space-y-3">
                  <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white shadow-[0_16px_40px_rgba(15,23,42,0.24)]"><Share2 size={16}/> Share brief</button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/45 px-4 py-3 text-sm font-black text-zinc-900"><Download size={16}/> Export snapshot</button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/45 px-4 py-3 text-sm font-black text-zinc-900"><Copy size={16}/> Copy summary</button>
                  <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/50 bg-white/45 px-4 py-3 text-sm font-black text-zinc-900"><CalendarDays size={16}/> Monthly review</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn("space-y-6 rounded-3xl border border-zinc-200 bg-white shadow-sm min-w-0 overflow-hidden", isPhone ? "rounded-[28px] p-4" : "p-8")}>
          <div className={cn("gap-1.5 bg-zinc-100 p-1 min-w-0", isPhone ? "grid grid-cols-2 rounded-[20px]" : "flex w-fit rounded-full")}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "font-bold transition-all min-w-0",
                  isPhone ? "rounded-[16px] px-2 py-2 text-[10px] leading-3.5 text-center break-words" : "rounded-full px-6 py-2 text-sm",
                  activeTab === tab ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={cn("flex items-center justify-center min-w-0 overflow-hidden", isPhone ? "h-56" : "h-80")}>
            {(activeTab === 'Goals vs Actual' || activeTab === 'Focus vs Target') && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: isPhone ? 10 : 12 }} />
                  <YAxis tick={{ fontSize: isPhone ? 10 : 12 }} width={isPhone ? 22 : 40} />
                  <Tooltip />
                  <Line type="monotone" dataKey="actual" stroke="#8884d8" strokeWidth={isPhone ? 2.5 : 3} dot={{ r: isPhone ? 4 : 6 }} />
                  <Line type="monotone" dataKey="goal" stroke="#82ca9d" strokeWidth={isPhone ? 2.5 : 3} dot={{ r: isPhone ? 4 : 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {(activeTab === 'Weekly Waveform' || activeTab === 'Workload Rhythm') && (
              <svg viewBox="0 0 400 100" className="w-full h-full">
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 50 C 50 0, 100 100, 150 50 C 200 0, 250 100, 300 50 C 350 0, 400 100, 400 50 M 0 50 C 50 100, 100 0, 150 50 C 200 100, 250 0, 300 50 C 350 100, 400 0, 400 50"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {(activeTab === 'Weekly Report' || activeTab === 'Assessment Pattern') && (
              <div className="grid w-full gap-4 min-w-0 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {isUniversityPortal ? 'Performance memo' : 'Weekly report'}
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Assessment trend</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-zinc-700">
                        {latestAttempt
                          ? `Latest marked attempt landed at ${latestPercent}%. ${quizImprovement === 0 ? 'Accuracy is stable against the first recorded baseline.' : `That is ${quizImprovement > 0 ? 'up' : 'down'} ${Math.abs(quizImprovement)} points versus the first recorded quiz.`}`
                          : 'No assessment trend yet. Completing a quiz will unlock a live performance signal.'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Best-fit study mode</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-zinc-700">
                        {learningProfile ? `${methodLabels[learningProfile.primaryMethod] || 'Structured revision'} is currently your strongest operating mode.` : 'Learning profile not configured yet.'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Recommended next move</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-zinc-700">
                        {isUniversityPortal
                          ? 'Shift the next session toward execution: close one outstanding task, then convert the session into a quiz or flashcard output so revision assets keep compounding.'
                          : 'Turn your next study block into one quiz or flashcard set to build a visible progress trail.'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-950 p-5 text-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Current benchmark</p>
                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-4xl font-black">{recentAverage || focusUtilization}%</p>
                      <p className="mt-1 text-sm font-bold text-zinc-300">
                        {recentAverage ? 'recent average marked accuracy' : 'focus utilization against weekly target'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Output mix</p>
                      <p className="mt-2 text-sm font-bold text-zinc-200">{flashcardCount} revision sets · {quizAttempts.length} marked attempts · {quizSetCount} stored quiz packs</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {(activeTab === 'Monthly Mood' || activeTab === 'Mood Signal') && (
              <div className={cn("grid w-full min-w-0", isPhone ? "grid-cols-6 gap-1" : "grid-cols-10 gap-2")}>
                {moodData.map((d, i) => <div key={i} className={cn(isPhone ? "h-8 rounded-md" : "h-10 rounded-lg", d.color)} />)}
              </div>
            )}
          </div>

          <div className={cn("border-t border-zinc-100 pt-4 min-w-0", isPhone ? "grid grid-cols-2 gap-2" : "flex gap-4")}>
            <button className={cn("flex items-center justify-center gap-2 font-bold", isUniversityPortal ? 'bg-zinc-950 text-white' : 'bg-sky-500 text-white', isPhone ? "rounded-[18px] px-3 py-2.5 text-xs" : "rounded-full px-6 py-2 text-sm")}><Share2 size={16}/> {isUniversityPortal ? 'Share brief' : 'Share'}</button>
            <button className={cn("flex items-center justify-center gap-2 bg-zinc-100 font-bold", isPhone ? "rounded-[18px] px-3 py-2.5 text-xs" : "rounded-full px-6 py-2 text-sm")}><Download size={16}/> {isUniversityPortal ? 'Export snapshot' : 'Export'}</button>
            <button className={cn("flex items-center justify-center gap-2 bg-zinc-100 font-bold", isPhone ? "rounded-[18px] px-3 py-2.5 text-xs" : "rounded-full px-6 py-2 text-sm")}><Printer size={16}/> {isUniversityPortal ? 'Print view' : 'Print'}</button>
            <button className={cn("flex items-center justify-center gap-2 bg-zinc-100 font-bold", isPhone ? "rounded-[18px] px-3 py-2.5 text-xs" : "rounded-full px-6 py-2 text-sm")}><Copy size={16}/> {isUniversityPortal ? 'Copy summary' : 'Copy'}</button>
            <button className={cn("flex items-center justify-center gap-2 bg-zinc-100 font-bold", isPhone ? "col-span-2 rounded-[18px] px-3 py-2.5 text-xs" : "ml-auto rounded-full px-6 py-2 text-sm")}><CalendarDays size={16}/> {isUniversityPortal ? 'Monthly review' : 'Monthly'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
