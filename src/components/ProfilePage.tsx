import { motion } from 'motion/react';
import {
  Book,
  Rocket,
  Smile,
  BarChart3,
  Flame,
  Target,
  Trophy,
  Sparkles,
  Atom,
  GraduationCap,
  ArrowUpRight,
  StickyNote,
  Gamepad2,
  User as UserIcon,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useSavedPageBackground } from '../lib/backgrounds';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { detectStudentPortalFromPath, studentPortalPath, studentPortalToolPath } from '../lib/portal';

const basePlanets = [
  { name: 'Beyond School', icon: Rocket, color: 'bg-purple-500', path: '/beyond-school' },
  { name: 'Motivation Wall', icon: Sparkles, color: 'bg-indigo-400', path: '/motivation-wall' },
  { name: 'Mood Logs', icon: Smile, color: 'bg-orange-300', path: '/mood-logs' },
  { name: 'Diary', icon: Book, color: 'bg-pink-400', path: '/mood' },
  { name: 'Weekly Reports', icon: BarChart3, color: 'bg-sky-500', path: '/progress' },
  { name: 'Achievements', icon: Trophy, color: 'bg-amber-400', path: '/rewards' },
  { name: 'Academic Goals', icon: Target, color: 'bg-green-300', path: '/academic-goals' },
  { name: 'Study Grove', icon: Flame, color: 'bg-rose-400', path: '/timer' },
];

function getStemBubbleLabel(pronouns?: UserProfile['pronouns']) {
  if (pronouns === 'she/her') return 'STEMHER';
  if (pronouns === 'he/him') return 'STEMHIM';
  return 'STEMHER + STEMHIM';
}

export default function ProfilePage({ profile }: { profile?: UserProfile | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPhone, isTablet } = useResponsiveDevice();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const isUniversityPortal = activePortal === 'university';
  const {
    setting: profileBackground,
    style: profileBackgroundStyle,
    imageStyle: profileBackgroundImageStyle,
    hasImage: hasProfileBackgroundImage,
  } = useSavedPageBackground('profile');

  const planets = [
    {
      name: getStemBubbleLabel(profile?.pronouns),
      icon: Atom,
      color: 'bg-fuchsia-400',
      path: studentPortalPath(activePortal, '/stem-initiatives'),
    },
    ...basePlanets.map((planet) => ({
      ...planet,
      path:
        planet.path === '/progress'
          ? studentPortalToolPath(activePortal, 'progress')
          : planet.path === '/rewards'
            ? studentPortalPath(activePortal, '/rewards')
            : planet.path === '/academic-goals'
              ? studentPortalToolPath(activePortal, 'academic-goals')
              : planet.path === '/timer'
                ? studentPortalToolPath(activePortal, 'timer')
                : studentPortalPath(activePortal, planet.path),
    })),
  ];

  const universitySections = [
    {
      title: 'Profile Settings',
      desc: 'Manage your account details, study identity, and workspace preferences.',
      icon: UserIcon,
      color: 'text-slate-700',
      path: studentPortalPath(activePortal, '/settings'),
    },
    {
      title: 'Journal',
      desc: 'Capture reflections, rough ideas, and private academic notes.',
      icon: StickyNote,
      color: 'text-rose-500',
      path: studentPortalPath(activePortal, '/mood'),
    },
    {
      title: 'Mood History',
      desc: 'Track how you are feeling across heavier weeks and academic blocks.',
      icon: Smile,
      color: 'text-amber-500',
      path: studentPortalPath(activePortal, '/mood-logs'),
    },
    {
      title: 'Vision Board',
      desc: 'Keep your direction visible with goals, motivation, and future focus.',
      icon: Sparkles,
      color: 'text-violet-500',
      path: studentPortalPath(activePortal, '/motivation-wall'),
    },
    {
      title: 'Career Direction',
      desc: 'Map life after university, pathways, and what comes next.',
      icon: GraduationCap,
      color: 'text-emerald-500',
      path: studentPortalPath(activePortal, '/beyond-school'),
    },
    {
      title: 'Performance Hub',
      desc: 'Review weekly pressure, momentum, growth, and your course standing in one place.',
      icon: BarChart3,
      color: 'text-sky-500',
      path: studentPortalToolPath(activePortal, 'progress'),
    },
    {
      title: 'Achievements',
      desc: 'See wins, streaks, and progress markers without the school-style gamification.',
      icon: Trophy,
      color: 'text-yellow-500',
      path: studentPortalPath(activePortal, '/rewards'),
    },
    {
      title: 'Network',
      desc: 'Open your student community, peers, and shared university space.',
      icon: Gamepad2,
      color: 'text-slate-700',
      path: studentPortalPath(activePortal, '/social'),
    },
  ];

  if (isUniversityPortal) {
    return (
      <div
        className="relative isolate min-h-[calc(100vh-100px)] overflow-hidden bg-zinc-50 p-4 sm:p-8"
        style={profileBackgroundStyle}
      >
        {hasProfileBackgroundImage ? (
          <div
            className={cn(
              'pointer-events-none absolute -inset-6 z-0',
              profileBackground.overlay === 'blur' ? 'scale-105 blur-xl opacity-80' : 'opacity-100',
            )}
            style={profileBackgroundImageStyle}
          />
        ) : null}
        {hasProfileBackgroundImage && profileBackground.overlay !== 'blur' ? (
          <div className="pointer-events-none absolute inset-0 z-0 bg-white/12" />
        ) : null}

        <div className="relative z-10 mx-auto max-w-6xl space-y-6">
          <div className="rounded-[34px] border border-white/70 bg-white/55 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-3xl sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">Personal Workspace</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">Your profile hub</h1>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-zinc-600 sm:text-base">
                  Keep your university identity, direction, reflection, and personal academic tools in one place.
                </p>
              </div>
              <div className="rounded-[26px] border border-slate-200/80 bg-slate-50/85 px-5 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">University Edition</p>
                <p className="mt-2 text-lg font-black text-zinc-900">{profile?.name || 'Student profile'}</p>
                <p className="text-sm font-semibold text-zinc-500">
                  {profile?.institution || 'Institution not set'}{profile?.degree ? ` • ${profile.degree}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className={cn("grid gap-5", isPhone ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-4")}>
            {universitySections.map((section, index) => (
              <motion.button
                key={section.title}
                onClick={() => navigate(section.path)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                className="group rounded-[30px] border border-white/70 bg-white/58 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-3xl transition-all hover:bg-white/68"
              >
                <div className="mb-5 flex items-start justify-between">
                  <div className="rounded-[22px] border border-zinc-100 bg-zinc-50/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                    <section.icon className={cn("h-6 w-6", section.color)} />
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-zinc-300 transition-colors group-hover:text-zinc-700" />
                </div>
                <h3 className="text-xl font-black leading-tight text-zinc-950">{section.title}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-600">{section.desc}</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isPhone) {
    return (
      <div
        className="relative isolate min-h-[calc(100vh-100px)] overflow-hidden bg-zinc-50 p-4"
        style={profileBackgroundStyle}
      >
        {hasProfileBackgroundImage ? (
          <div
            className={cn(
              'pointer-events-none absolute -inset-6 z-0',
              profileBackground.overlay === 'blur' ? 'scale-105 blur-xl opacity-80' : 'opacity-100',
            )}
            style={profileBackgroundImageStyle}
          />
        ) : null}
        {hasProfileBackgroundImage && profileBackground.overlay !== 'blur' ? (
          <div className="pointer-events-none absolute inset-0 z-0 bg-white/12" />
        ) : null}
        <div className="relative z-10 space-y-5">
          <div className="rounded-[28px] border border-sky-100 bg-sky-50/90 p-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            <h2 className="text-2xl font-black text-sky-700">Your Space ☀️</h2>
            <p className="mt-2 text-sm font-medium text-sky-600">Tap a bubble to explore</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {planets.map((planet) => (
              <motion.button
                key={planet.name}
                onClick={() => navigate(planet.path)}
                whileTap={{ scale: 0.98 }}
                className="rounded-[28px] border border-white/65 bg-white/75 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_14px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
              >
                <div className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg", planet.color)}>
                  <planet.icon size={24} />
                </div>
                <span className="mt-3 block text-sm font-black leading-tight text-zinc-900">{planet.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative isolate flex flex-col items-center justify-center min-h-[calc(100vh-100px)] overflow-hidden p-8 bg-zinc-50"
      style={profileBackgroundStyle}
    >
      {hasProfileBackgroundImage ? (
        <div
          className={cn(
            'pointer-events-none absolute -inset-6 z-0',
            profileBackground.overlay === 'blur' ? 'scale-105 blur-xl opacity-80' : 'opacity-100',
          )}
          style={profileBackgroundImageStyle}
        />
      ) : null}
      {hasProfileBackgroundImage && profileBackground.overlay !== 'blur' ? (
        <div className="pointer-events-none absolute inset-0 z-0 bg-white/12" />
      ) : null}
      <div className={cn("relative z-10 flex items-center justify-center", isTablet ? "h-[560px] w-[560px]" : "h-[660px] w-[660px]")}>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-48 h-48 rounded-full bg-sky-100 flex flex-col items-center justify-center text-center z-10 shadow-inner"
        >
          <h2 className="text-2xl font-black text-sky-700">Your Space ☀️</h2>
          <p className="text-sm text-sky-600">Tap a planet to explore</p>
        </motion.div>

        <div className={cn("absolute rounded-full border border-sky-200/50", isTablet ? "h-[360px] w-[360px]" : "h-[430px] w-[430px]")} />
        <div className={cn("absolute rounded-full border border-sky-200/30", isTablet ? "h-[540px] w-[540px]" : "h-[650px] w-[650px]")} />

        {planets.map((planet, index) => {
          const angle = (index / planets.length) * 2 * Math.PI - Math.PI / 2;
          const radius = isTablet ? 230 : 280;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);

          return (
            <div
              key={planet.name}
              className="absolute z-20"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <motion.button
                onClick={() => navigate(planet.path)}
                whileHover={{ scale: 1.1 }}
                className="flex w-36 origin-center flex-col items-center gap-2"
              >
                <div className={cn("w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg", planet.color)}>
                  <planet.icon size={32} />
                </div>
                <span className="text-center font-bold text-zinc-900">{planet.name}</span>
              </motion.button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
