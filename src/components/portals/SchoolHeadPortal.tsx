import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  LogOut,
  Search,
  Settings,
  SquareKanban,
  TrendingUp,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { auth } from '../../firebase';

type PrincipalView = 'dashboard' | 'teacher-tracking' | 'grade-trends';

const GRADE_TRENDS = [
  { subject: 'Math', avgGrade: 78, target: 85 },
  { subject: 'Science', avgGrade: 82, target: 85 },
  { subject: 'English', avgGrade: 75, target: 80 },
  { subject: 'History', avgGrade: 88, target: 85 },
  { subject: 'Art', avgGrade: 92, target: 90 },
];

const CURRICULUM_COVERAGE = [
  { name: 'Year 10', coverage: 85, fill: '#6366f1' },
  { name: 'Year 11', coverage: 72, fill: '#8b5cf6' },
  { name: 'Year 12', coverage: 94, fill: '#ec4899' },
];

const TEACHER_RELIABILITY = [
  { name: 'Dr. Sarah Miller', subject: 'Biology', badge: 'High frequency', badgeTone: 'green', rating: 4.8, initial: 'D' },
  { name: 'Mr. James Wilson', subject: 'Math', badge: 'Medium frequency', badgeTone: 'amber', rating: 4.2, initial: 'M' },
  { name: 'Ms. Emily Davis', subject: 'English', badge: 'High frequency', badgeTone: 'green', rating: 4.9, initial: 'M' },
  { name: 'Mr. Robert Brown', subject: 'History', badge: 'Low frequency', badgeTone: 'rose', rating: 3.8, initial: 'M' },
];

const NAV_GROUPS: Array<{
  title: string;
  icon: string;
  items: Array<{
    id: PrincipalView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent?: string;
  }>;
}> = [
  {
    title: 'School Management',
    icon: '🏫',
    items: [
      { id: 'dashboard', label: 'School Dashboard', icon: SquareKanban, accent: 'green' },
      { id: 'teacher-tracking', label: 'Teacher Tracking', icon: Users, accent: 'blue' },
      { id: 'grade-trends', label: 'Grade Trends', icon: TrendingUp, accent: 'violet' },
    ],
  },
  {
    title: 'Admin',
    icon: '🛡️',
    items: [],
  },
];

export default function SchoolHeadPortal() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<PrincipalView>('dashboard');

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#f8f8fa] font-sans text-zinc-900">
      <div className="grid min-h-screen lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-zinc-200 bg-white">
          <div className="flex h-[86px] items-center gap-4 border-b border-zinc-200 px-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-100">
              <GraduationCap className="h-5 w-5" />
            </div>
            <p className="whitespace-nowrap text-[20px] font-black tracking-tight text-zinc-950">EduRev AI</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-8">
            {NAV_GROUPS.map((group, groupIndex) => (
              <div key={group.title} className={groupIndex === 0 ? '' : 'mt-8'}>
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">
                    <span>{group.icon}</span>
                    <span>{group.title}</span>
                  </div>
                  <ChevronUp className="h-4 w-4 text-zinc-400" />
                </div>

                <nav className="mt-4 space-y-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveView(item.id)}
                        className={cn(
                          'flex w-full items-center gap-4 rounded-[20px] px-6 py-4 text-left transition',
                          active
                            ? 'bg-emerald-500 text-white shadow-[0_12px_30px_rgba(34,197,94,0.22)]'
                            : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-6 w-6 shrink-0',
                            active
                              ? 'text-white'
                              : item.accent === 'blue'
                                ? 'text-blue-500'
                                : item.accent === 'violet'
                                  ? 'text-violet-500'
                                  : 'text-zinc-500'
                          )}
                        />
                        <span className="text-[16px] font-bold tracking-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}

            <div className="mt-10 rounded-[28px] bg-zinc-900 p-6 text-white shadow-[0_18px_48px_rgba(15,23,42,0.2)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-yellow-400">
                <span className="text-lg">✨</span>
              </div>
              <p className="mt-6 text-[18px] font-black tracking-tight">Pro Features</p>
              <p className="mt-3 text-sm font-medium leading-6 text-zinc-400">
                Unlock advanced oversight tools, full analytics exports, and leadership reporting.
              </p>
              <button className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-zinc-900">
                Upgrade Now
              </button>
            </div>
          </div>

          <div className="border-t border-zinc-200 px-8 py-6">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-3 text-[16px] font-bold text-zinc-500 transition hover:text-zinc-900"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="flex h-[86px] items-center justify-between border-b border-zinc-200 bg-white px-8 md:px-10">
            <div className="flex min-w-0 flex-1 items-center">
              <div className="flex h-[58px] w-full max-w-[485px] items-center gap-3 rounded-[20px] bg-zinc-50 px-5 text-zinc-400">
                <Search className="h-5 w-5 shrink-0" />
                <span className="truncate text-[15px] font-medium">Search your study materials...</span>
              </div>
            </div>

            <div className="ml-6 flex items-center gap-4">
              <button className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500">
                <Bell className="h-5 w-5" />
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-rose-500" />
              </button>
              <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500">
                <Settings className="h-5 w-5" />
              </button>
              <div className="hidden h-10 w-px bg-zinc-200 md:block" />
              <button className="flex items-center gap-4 rounded-[18px] bg-zinc-50 px-4 py-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500 text-lg font-black text-white shadow-lg shadow-violet-100">
                  C
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-black leading-5 text-zinc-950">Christina</p>
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-emerald-600">School Head</p>
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          </header>

          <div className="p-8 md:p-10">
            {activeView === 'dashboard' ? <SchoolDashboardPage /> : null}
            {activeView === 'teacher-tracking' ? <TeacherTrackingPage /> : null}
            {activeView === 'grade-trends' ? <GradeTrendsPage /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function SchoolDashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[40px] border border-zinc-100 bg-white px-10 py-9 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="rounded-xl bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-600">The Principal</div>
            </div>
            <h1 className="mt-5 max-w-[520px] text-[58px] font-black leading-[0.98] tracking-tight text-zinc-950">School Head Dashboard</h1>
            <p className="mt-3 max-w-[560px] text-[17px] font-medium leading-8 text-zinc-500">
              Monitoring teacher reliability, grade trends, and curriculum coverage.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex h-[50px] min-w-[234px] items-center justify-center gap-3 rounded-[18px] bg-zinc-900 px-7 text-[15px] font-bold text-white">
              <BookOpen className="h-4 w-4" />
              Academic Calendar
            </button>
            <button className="inline-flex h-[50px] min-w-[206px] items-center justify-center gap-3 rounded-[18px] border border-zinc-200 bg-white px-7 text-[15px] font-bold text-zinc-900 shadow-sm">
              <Search className="h-4 w-4" />
              Search Records
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Students', value: '1,240', icon: <Users className="text-blue-500" />, trend: '+45' },
          { label: 'Avg. Grade', value: '82.4%', icon: <TrendingUp className="text-emerald-500" />, trend: '+1.2%' },
          { label: 'Curriculum Coverage', value: '84%', icon: <BookOpen className="text-violet-500" />, trend: 'On Track' },
          { label: 'Teacher Engagement', value: '92%', icon: <Trophy className="text-amber-500" />, trend: '+5%' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[30px] border border-zinc-100 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50">{stat.icon}</div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-600">
                {stat.trend}
              </div>
            </div>
            <p className="mt-10 text-[3rem] font-black tracking-tight text-zinc-950">{stat.value}</p>
            <p className="mt-2 min-h-[44px] text-[12px] font-bold uppercase leading-5 tracking-[0.24em] text-zinc-400">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-5">
            <div>
              <h2 className="text-[2rem] font-black tracking-tight text-zinc-950">Grade Trends by Subject</h2>
              <p className="mt-2 text-lg font-medium text-zinc-500">Average student performance vs. academic targets.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-emerald-600">
              Full Report
            </button>
          </div>
          <div className="mt-6 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={GRADE_TRENDS} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#a1a1aa' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#a1a1aa' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }} />
                <Bar dataKey="avgGrade" fill="#59bb88" radius={[8, 8, 0, 0]} barSize={48} />
                <Bar dataKey="target" fill="#dfe5ef" radius={[8, 8, 0, 0]} barSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-[2rem] font-black tracking-tight text-zinc-950">Curriculum Coverage</h2>
          <p className="mt-2 text-lg font-medium text-zinc-500">Progress across different year levels.</p>
          <div className="mt-4 h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={CURRICULUM_COVERAGE} cx="50%" cy="50%" innerRadius={62} outerRadius={92} paddingAngle={4} dataKey="coverage">
                  {CURRICULUM_COVERAGE.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-5">
            {CURRICULUM_COVERAGE.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-[1.1rem] font-bold text-zinc-950">{item.name}</span>
                </div>
                <span className="text-[1.1rem] font-black text-zinc-950">{item.coverage}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <h2 className="text-[2rem] font-black tracking-tight text-zinc-950">Teacher Reliability & Engagement</h2>
        <p className="mt-2 text-lg font-medium text-zinc-500">Tracking quiz frequency and student feedback.</p>

        <div className="mt-8 grid gap-6 xl:grid-cols-4">
          {TEACHER_RELIABILITY.map((teacher) => (
            <div key={teacher.name} className="rounded-[28px] border border-zinc-100 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-[1.5rem] font-black text-zinc-400">
                  {teacher.initial}
                </div>
                <div className={cn(
                  'rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                  teacher.badgeTone === 'green' && 'bg-emerald-50 text-emerald-600',
                  teacher.badgeTone === 'amber' && 'bg-amber-50 text-amber-600',
                  teacher.badgeTone === 'rose' && 'bg-rose-50 text-rose-600'
                )}>
                  {teacher.badge}
                </div>
              </div>

              <h3 className="mt-6 text-[2rem] font-black tracking-tight text-zinc-950">{teacher.name}</h3>
              <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.24em] text-zinc-400">{teacher.subject}</p>

              <div className="mt-6 border-t border-zinc-200 pt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-900">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span className="text-[1.6rem] font-black">{teacher.rating}</span>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">Rating</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TeacherTrackingPage() {
  return (
    <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <h1 className="text-[2.2rem] font-black tracking-tight text-zinc-950">Teacher Tracking</h1>
      <p className="mt-2 max-w-3xl text-lg font-medium text-zinc-500">
        Monitor teacher responsiveness, quiz frequency, assignment release cadence, and current follow-up load.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ['Teachers monitored', '48'],
          ['Needs follow-up', '6'],
          ['Priority escalations', '2'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[26px] bg-zinc-50 p-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.24em] text-zinc-400">{label}</p>
            <p className="mt-4 text-[2.8rem] font-black tracking-tight text-zinc-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function GradeTrendsPage() {
  return (
    <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <h1 className="text-[2.2rem] font-black tracking-tight text-zinc-950">Grade Trends</h1>
      <p className="mt-2 max-w-3xl text-lg font-medium text-zinc-500">
        Review subject performance, curriculum coverage, and where school-wide intervention is needed.
      </p>
      <div className="mt-8 h-[360px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={GRADE_TRENDS} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
            <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#a1a1aa' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#a1a1aa' }} />
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }} />
            <Bar dataKey="avgGrade" fill="#59bb88" radius={[8, 8, 0, 0]} barSize={48} />
            <Bar dataKey="target" fill="#dfe5ef" radius={[8, 8, 0, 0]} barSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(' ');
}
