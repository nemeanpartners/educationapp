import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  ArrowUpRight,
  Atom,
  Bell,
  Building2,
  ChevronDown,
  ChevronUp,
  Database,
  FlaskConical,
  Globe,
  GraduationCap,
  LineChart as LineChartIcon,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  SquareKanban,
  Users,
} from 'lucide-react';
import { auth } from '../../firebase';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type AdminView = 'dashboard' | 'schools' | 'curriculum' | 'stemInitiatives';

const SUBSCRIPTION_DATA = [
  { name: 'Brisbane High', status: 'Active', students: 1200, renewal: '2026-12-01' },
  { name: 'Sydney Academy', status: 'Active', students: 850, renewal: '2026-11-15' },
  { name: 'Melbourne Grammar', status: 'Pending', students: 2100, renewal: '2026-10-20' },
];

const GLOBAL_ANALYTICS = [
  { month: 'Jan', activeUsers: 4500 },
  { month: 'Feb', activeUsers: 5200 },
  { month: 'Mar', activeUsers: 6100 },
  { month: 'Apr', activeUsers: 7500 },
];

const STEM_INITIATIVE_METRICS = [
  { label: 'Pilot schools', value: '28', note: '+6 this term' },
  { label: 'Student reach', value: '8.4k', note: 'Years 7-12' },
  { label: 'Retention uplift', value: '+14%', note: 'Term-on-term' },
  { label: 'Engagement delta', value: '+19%', note: 'Survey intent' },
];

const STAKEHOLDER_PANELS = [
  {
    title: 'Problem this solves',
    text: 'Students leave STEM pathways for different reasons. Some do not feel that they belong. Others lose direction once difficulty rises. A single generic intervention misses both patterns.',
  },
  {
    title: 'Why two streams work',
    text: 'STEMHER and STEMHIM let schools speak to different disengagement patterns without weakening the shared message that STEM is valuable, demanding, and open to more students.',
  },
  {
    title: 'What schools can measure',
    text: 'Track participation, persistence into harder subjects, confidence surveys, project completion, and pathway continuation into senior STEM choices.',
  },
];

const NAV_GROUPS: Array<{
  title: string;
  icon: string;
  items: Array<{
    id: AdminView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accent?: string;
  }>;
}> = [
  {
    title: 'Global Control',
    icon: '🌐',
    items: [
      { id: 'dashboard', label: 'Global Dashboard', icon: SquareKanban, accent: 'indigo' },
      { id: 'schools', label: 'Schools', icon: Building2, accent: 'blue' },
      { id: 'curriculum', label: 'Curriculum', icon: Database, accent: 'violet' },
      { id: 'stemInitiatives', label: 'STEM Initiatives', icon: Atom, accent: 'violet' },
    ],
  },
  {
    title: 'Admin',
    icon: '🛡️',
    items: [],
  },
];

export default function AppAdminPortal() {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#f8f8fa] font-sans text-zinc-900">
      <div className="grid min-h-screen lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-zinc-200 bg-white">
          <div className="flex h-[86px] items-center gap-4 border-b border-zinc-200 px-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-100">
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
                            ? 'bg-indigo-600 text-white shadow-[0_12px_30px_rgba(99,102,241,0.22)]'
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
                                  : item.accent === 'indigo'
                                    ? 'text-indigo-500'
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
                Unlock advanced AI tutoring and unlimited storage.
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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-100">
                  C
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-black leading-5 text-zinc-950">Christina</p>
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-indigo-600">App Admin</p>
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          </header>

          <div className="p-8 md:p-10">
            {activeView === 'dashboard' ? <GlobalDashboardPage /> : null}
            {activeView === 'schools' ? <SchoolsPage /> : null}
            {activeView === 'curriculum' ? <CurriculumPage /> : null}
            {activeView === 'stemInitiatives' ? <StemInitiativesStakeholderPage /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function GlobalDashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[40px] border border-zinc-100 bg-zinc-900 px-10 py-9 text-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                <Globe className="h-5 w-5" />
              </div>
              <div className="rounded-xl bg-indigo-500/15 px-3 py-1 text-sm font-bold text-indigo-300">Global Overlord</div>
            </div>
            <h1 className="mt-5 max-w-[620px] text-[50px] font-black leading-[0.98] tracking-tight">App Admin Control Center</h1>
            <p className="mt-3 max-w-[560px] text-[17px] font-medium leading-8 text-zinc-400">
              Managing global subscriptions and QCAA curriculum data.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="inline-flex h-[50px] min-w-[214px] items-center justify-center gap-3 rounded-[18px] bg-indigo-600 px-7 text-[15px] font-bold text-white">
              <Database className="h-4 w-4" />
              Update QCAA Data
            </button>
            <button className="inline-flex h-[50px] min-w-[186px] items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/5 px-7 text-[15px] font-bold text-white">
              <Settings className="h-4 w-4" />
              System Config
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Schools', value: '142', icon: <Building2 className="text-blue-500" />, trend: '+12%' },
          { label: 'Active Students', value: '45.2k', icon: <Users className="text-emerald-500" />, trend: '+8%' },
          { label: 'System Uptime', value: '99.98%', icon: <ShieldCheck className="text-violet-500" />, trend: 'Stable' },
          { label: 'Global Revenue', value: '$1.2M', icon: <LineChartIcon className="text-amber-500" />, trend: '+15%' },
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
              <h2 className="text-[2rem] font-black tracking-tight text-zinc-950">School Subscriptions</h2>
              <p className="mt-2 text-lg font-medium text-zinc-500">Manage and monitor school-level access.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-indigo-600">
              View All <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {SUBSCRIPTION_DATA.map((school) => (
              <div key={school.name} className="flex items-center justify-between rounded-[24px] bg-zinc-50 px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white font-black text-zinc-400">
                    {school.name[0]}
                  </div>
                  <div>
                    <p className="text-lg font-black tracking-tight text-zinc-950">{school.name}</p>
                    <p className="text-sm font-bold text-zinc-400">{school.students} Students</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">Renewal</p>
                    <p className="text-sm font-black text-zinc-950">{school.renewal}</p>
                  </div>
                  <div className={cn(
                    'rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                    school.status === 'Active' && 'bg-emerald-50 text-emerald-600',
                    school.status === 'Pending' && 'bg-amber-50 text-amber-600'
                  )}>
                    {school.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-[2rem] font-black tracking-tight text-zinc-950">User Growth</h2>
          <p className="mt-2 text-lg font-medium text-zinc-500">Monthly active users across all portals.</p>
          <div className="mt-6 h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={GLOBAL_ANALYTICS}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#a1a1aa' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#a1a1aa' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }} />
                <Line type="monotone" dataKey="activeUsers" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

function SchoolsPage() {
  return (
    <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <h1 className="text-[2.2rem] font-black tracking-tight text-zinc-950">Schools</h1>
      <p className="mt-2 max-w-3xl text-lg font-medium text-zinc-500">Manage school accounts, renewal dates, student load, and access state.</p>
    </section>
  );
}

function CurriculumPage() {
  return (
    <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <h1 className="text-[2.2rem] font-black tracking-tight text-zinc-950">Curriculum</h1>
      <p className="mt-2 max-w-3xl text-lg font-medium text-zinc-500">Update QCAA content, release system-wide curriculum changes, and track version rollout.</p>
    </section>
  );
}

function StemInitiativesStakeholderPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[38px] border border-zinc-100 bg-white px-8 py-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="rounded-xl bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700">Stakeholder view</div>
            </div>
            <h1 className="mt-5 text-[3.2rem] font-black leading-[0.98] tracking-tight text-zinc-950">STEMHER and STEMHIM</h1>
            <p className="mt-4 max-w-3xl text-lg font-medium leading-8 text-zinc-500">
              This side is for school leaders and decision-makers. It shows why the initiative exists, what outcomes it should improve, and how it positions EduRev AI as a stronger partner for student retention in STEM.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:w-[440px]">
            {STEM_INITIATIVE_METRICS.map((metric) => (
              <div key={metric.label} className="rounded-[28px] border border-zinc-100 bg-zinc-50 px-5 py-5">
                <div className="text-[2rem] font-black tracking-tight text-zinc-950">{metric.value}</div>
                <div className="mt-2 text-[11px] font-black uppercase tracking-[0.24em] text-zinc-400">{metric.label}</div>
                <div className="mt-2 text-sm font-bold text-emerald-600">{metric.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-600">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-400">Initiative structure</p>
              <h2 className="text-[2rem] font-black tracking-tight text-zinc-950">Two streams, one retention goal</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] bg-zinc-950 p-6 text-white">
              <div className="flex items-center gap-3">
                <FlaskConical className="h-5 w-5 text-fuchsia-300" />
                <h3 className="text-xl font-black tracking-tight">STEMHER</h3>
              </div>
              <p className="mt-4 text-sm font-medium leading-7 text-zinc-300">
                Support more girls into STEM through belonging, visibility, and steady confidence-building.
              </p>
            </div>
            <div className="rounded-[28px] border border-zinc-100 bg-zinc-50 p-6">
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-sky-600" />
                <h3 className="text-xl font-black tracking-tight text-zinc-950">STEMHIM</h3>
              </div>
              <p className="mt-4 text-sm font-medium leading-7 text-zinc-600">
                Support more boys in STEM through healthy challenge, structured goals, and identity built around capability.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {STAKEHOLDER_PANELS.map((panel) => (
              <div key={panel.title} className="rounded-[26px] border border-zinc-100 bg-white p-5">
                <h3 className="text-lg font-black text-zinc-950">{panel.title}</h3>
                <p className="mt-2 text-sm font-medium leading-7 text-zinc-600">{panel.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[34px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Selling point</p>
                <h2 className="text-[2rem] font-black tracking-tight text-zinc-950">A final initiative layer schools can stand behind</h2>
              </div>
            </div>
            <p className="mt-4 text-base font-medium leading-8 text-zinc-600">
              The value is not just branding. The value is better retention, stronger confidence signals, clearer pathway identity, and a more persuasive school-wide story about why students should stay in STEM.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
              Belonging + ambition + measurable retention
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-[34px] border border-zinc-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-[2rem] font-black tracking-tight text-zinc-950">What stakeholders should see improving</h2>
            <div className="mt-6 space-y-3">
              {[
                'Higher opt-in to STEM clubs, projects, and pathway events.',
                'Better continuation into senior STEM subjects after early struggle.',
                'Stronger student survey responses around belonging and confidence.',
                'A clearer school narrative for families, teachers, and partners.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[24px] bg-zinc-50 px-4 py-4">
                  <Users className="mt-0.5 h-4 w-4 text-indigo-500" />
                  <p className="text-sm font-bold leading-6 text-zinc-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(' ');
}
