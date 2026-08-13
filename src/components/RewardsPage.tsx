import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Lock,
  Medal,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { useLocation } from 'react-router-dom';
import { detectStudentPortalFromPath } from '@/lib/portal';

interface Achievement {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: any;
  unlocked: boolean;
}

interface PersonalAchievement {
  id: string;
  title: string;
  description: string;
  type: 'Certificate' | 'Grade' | 'Extracurricular' | 'Leadership' | 'Career';
  evidence: string;
  icon: any;
  highlight: string;
}

const appAchievements: Achievement[] = [
  { id: '1', title: 'First Task', description: 'Complete your first to-do item.', category: 'Productivity', icon: CheckCircle2, unlocked: true },
  { id: '2', title: 'Task Master', description: 'Complete 10 to-do items.', category: 'Productivity', icon: Target, unlocked: true },
  { id: '3', title: 'Drafter', description: 'Create your first workbook.', category: 'Consistency', icon: BookOpen, unlocked: true },
  { id: '4', title: 'Mindful', description: 'Log your mood for 3 days in a row.', category: 'Consistency', icon: Star, unlocked: true },
  { id: '5', title: 'Consistent', description: 'Log your mood for 7 days straight.', category: 'Consistency', icon: Calendar, unlocked: true },
  { id: '6', title: 'Summarizer', description: 'Generate your first AI study summary.', category: 'AI Power-User', icon: Brain, unlocked: true },
  { id: '7', title: 'Game Master', description: 'Create your first AI-powered study game.', category: 'Exploration', icon: Zap, unlocked: false },
  { id: '8', title: 'AI Planner', description: 'Generate a to-do list with AI.', category: 'AI Power-User', icon: Target, unlocked: false },
  { id: '9', title: 'Scholar', description: 'Read 5 study resources.', category: 'Exploration', icon: BookOpen, unlocked: true },
  { id: '10', title: 'Explorer', description: 'Visit all study tools.', category: 'Exploration', icon: Star, unlocked: false },
];

const personalAchievements: PersonalAchievement[] = [
  {
    id: 'p1',
    title: 'Academic Excellence Certificate',
    description: 'Awarded for sustained high achievement across core subjects this semester.',
    type: 'Certificate',
    evidence: 'Certificate uploaded by student',
    icon: Award,
    highlight: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  {
    id: 'p2',
    title: 'A in Science Research Investigation',
    description: 'Strong final result in a major assessment with clear analysis and evidence.',
    type: 'Grade',
    evidence: 'Latest verified assessment result',
    icon: Medal,
    highlight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  {
    id: 'p3',
    title: 'Debating Team Participation',
    description: 'Recognition for speaking, collaboration, and weekly commitment outside class.',
    type: 'Extracurricular',
    evidence: 'School activity record',
    icon: Users,
    highlight: 'bg-sky-50 border-sky-200 text-sky-700',
  },
  {
    id: 'p4',
    title: 'Community Volunteer Hours',
    description: 'Logged service hours through a school or local community program.',
    type: 'Extracurricular',
    evidence: 'Verified extracurricular contribution',
    icon: ShieldCheck,
    highlight: 'bg-violet-50 border-violet-200 text-violet-700',
  },
];

const universityAchievements: PersonalAchievement[] = [
  {
    id: 'u1',
    title: 'Dean’s Commendation',
    description: 'Recognition for sustained academic performance and strong execution across a demanding unit mix.',
    type: 'Certificate',
    evidence: 'Faculty recognition letter',
    icon: Award,
    highlight: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  {
    id: 'u2',
    title: 'Research Poster Showcase',
    description: 'Presented work publicly and translated academic effort into something visible and credible.',
    type: 'Career',
    evidence: 'Presentation or poster upload',
    icon: Medal,
    highlight: 'bg-sky-50 border-sky-200 text-sky-700',
  },
  {
    id: 'u3',
    title: 'Society Committee Role',
    description: 'Leadership through clubs, student societies, or cohort representation outside formal class results.',
    type: 'Leadership',
    evidence: 'Student leadership record',
    icon: Users,
    highlight: 'bg-violet-50 border-violet-200 text-violet-700',
  },
  {
    id: 'u4',
    title: 'Internship / Placement Win',
    description: 'A placement, internship, or industry experience that proves progress beyond weekly study pressure.',
    type: 'Career',
    evidence: 'Offer, placement, or supervisor confirmation',
    icon: ShieldCheck,
    highlight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
];

const universityFeatureCards = [
  {
    title: 'CV wins',
    body: 'Keep the moments worth mentioning in resumes, LinkedIn, and scholarship applications in one place.',
    icon: Trophy,
  },
  {
    title: 'Evidence locker',
    body: 'Separate real recognitions from app badges so students can quickly find what proves they are progressing.',
    icon: Lock,
  },
  {
    title: 'Confidence reset',
    body: 'When university feels flat, this page should remind the student what they have actually built already.',
    icon: Star,
  },
];

const categories = ['All', 'Productivity', 'Consistency', 'AI Power-User', 'Exploration'];
const GLASS_PANEL = 'relative overflow-hidden rounded-[32px] border border-white/55 bg-white/46 backdrop-blur-2xl shadow-[0_22px_60px_rgba(15,23,42,0.12)]';
const GLASS_CARD = 'relative overflow-hidden border border-white/60 bg-white/42 backdrop-blur-2xl shadow-[0_18px_50px_rgba(15,23,42,0.12)]';
const GLASS_INSET = 'border border-white/60 bg-white/45 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]';

export default function RewardsPage() {
  const location = useLocation();
  const isUniversityPortal = detectStudentPortalFromPath(location.pathname) === 'university';
  const [activeCategory, setActiveCategory] = useState('All');
  const { isPhone } = useResponsiveDevice();
  const featuredAchievements = isUniversityPortal ? universityAchievements : personalAchievements;

  const filteredAppAchievements = useMemo(
    () => activeCategory === 'All'
      ? appAchievements
      : appAchievements.filter((achievement) => achievement.category === activeCategory),
    [activeCategory],
  );

  const unlockedCount = appAchievements.filter((achievement) => achievement.unlocked).length;
  const certificateCount = featuredAchievements.filter((achievement) => achievement.type === 'Certificate').length;
  const academicWinCount = featuredAchievements.filter((achievement) => achievement.type === 'Grade' || achievement.type === 'Career').length;
  const leadershipCount = featuredAchievements.filter((achievement) => achievement.type === 'Extracurricular' || achievement.type === 'Leadership').length;

  return (
    <div className={cn('space-y-8', isPhone ? 'overflow-x-hidden p-4' : 'p-8')}>
      <header className={cn(GLASS_PANEL, isPhone ? 'space-y-3 p-5' : 'space-y-2 p-7')}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/85" />
        <div className={cn('flex', isPhone ? 'items-end justify-between gap-3' : 'items-center justify-between')}>
          <div className="relative z-10">
            <h1 className={cn('font-black text-zinc-900 flex items-center', isPhone ? 'gap-2 text-[2rem] leading-none' : 'gap-3 text-3xl')}>
              <Trophy className="text-yellow-500" /> {isUniversityPortal ? 'Achievements' : 'Rewards & Achievements'}
            </h1>
            <p className={cn('mt-2 text-zinc-500', isPhone ? 'text-sm leading-6' : '')}>
              {isUniversityPortal
                ? 'Track the recognitions, certificates, placements, and proof that you are moving forward even when university feels like it is all grind.'
                : 'Track your own milestones and the badges you unlock across EducationRev.'}
            </p>
          </div>
          <span className={cn('relative z-10 font-bold text-zinc-500', isPhone ? 'max-w-[7rem] text-right text-sm leading-4' : 'text-xl')}>
            {unlockedCount} / {appAchievements.length} App Badges
          </span>
        </div>
      </header>

      <section className={cn(GLASS_PANEL, 'space-y-5', isPhone ? 'p-5' : 'p-7')}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/85" />
        <div className={cn('flex', isPhone ? 'flex-col gap-3' : 'items-center justify-between')}>
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">My achievements</p>
            <h2 className="mt-2 text-3xl font-black text-zinc-950">
              {isUniversityPortal ? 'Certificates, recognitions, placements, and proof of progress' : 'Certificates, grades, and extracurricular wins'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-zinc-500">
              {isUniversityPortal
                ? 'Keep the moments that matter for confidence, CVs, scholarship applications, and future opportunities separate from app unlocks.'
                : 'Keep personal achievements separate from app badges so important academic results and real-world accomplishments are easy to find.'}
            </p>
          </div>
        </div>

        <div className={cn('grid gap-4', isPhone ? 'grid-cols-1' : 'grid-cols-3')}>
          <div className={cn(GLASS_CARD, 'rounded-[28px] p-5')}>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Certificates</p>
            <p className="mt-3 text-3xl font-black text-zinc-950">{certificateCount}</p>
          </div>
          <div className={cn(GLASS_CARD, 'rounded-[28px] p-5')}>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{isUniversityPortal ? 'Academic + career wins' : 'Grades tracked'}</p>
            <p className="mt-3 text-3xl font-black text-zinc-950">{academicWinCount}</p>
          </div>
          <div className={cn(GLASS_CARD, 'rounded-[28px] p-5')}>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{isUniversityPortal ? 'Leadership + community' : 'Extracurricular'}</p>
            <p className="mt-3 text-3xl font-black text-zinc-950">{leadershipCount}</p>
          </div>
        </div>

        {isUniversityPortal ? (
          <div className={cn('grid gap-4', isPhone ? 'grid-cols-1' : 'grid-cols-3')}>
            {universityFeatureCards.map((card) => (
              <div key={card.title} className={cn(GLASS_CARD, 'rounded-[28px] p-5')}>
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.56),rgba(255,255,255,0.18))]" />
                <card.icon className="relative z-10 text-emerald-600" size={24} />
                <h3 className="relative z-10 mt-4 text-lg font-black text-zinc-950">{card.title}</h3>
                <p className="relative z-10 mt-2 text-sm font-medium leading-6 text-zinc-600">{card.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className={cn('grid', isPhone ? 'grid-cols-1 gap-4' : 'grid-cols-1 gap-6 lg:grid-cols-2')}>
          {featuredAchievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              whileHover={{ y: -4 }}
              className={cn(GLASS_CARD, 'rounded-[30px] p-6 transition-all')}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.62),rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.08))]" />
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/85" />
              <div className="flex items-start gap-4">
                <div className={cn('relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_12px_24px_rgba(15,23,42,0.08)]', achievement.highlight)}>
                  <achievement.icon size={28} />
                </div>
                <div className="relative z-10 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]', achievement.highlight)}>
                      {achievement.type}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                      {achievement.evidence}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-black text-zinc-950">{achievement.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{achievement.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className={cn(GLASS_PANEL, 'space-y-5', isPhone ? 'p-5' : 'p-7')}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/85" />
        <div className={cn('flex', isPhone ? 'flex-col gap-3' : 'items-end justify-between')}>
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">EducationRev app achievements</p>
            <h2 className="mt-2 text-3xl font-black text-zinc-950">Badges unlocked inside the app</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
              These are the platform badges you unlock by using planning, wellbeing, AI, and study tools inside EducationRev.
            </p>
          </div>
          <span className={cn('relative z-10 font-bold text-zinc-500', isPhone ? 'text-sm' : 'text-lg')}>
            {unlockedCount} / {appAchievements.length} badges unlocked
          </span>
        </div>

        <div className={cn(GLASS_INSET, 'relative z-10 w-full overflow-hidden rounded-full h-4 bg-white/55')}>
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-500"
            style={{ width: `${(unlockedCount / appAchievements.length) * 100}%` }}
          />
        </div>

        <div className={cn('relative z-10 gap-2', isPhone ? 'grid grid-cols-3' : 'flex flex-wrap')}>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={cn(
                'rounded-full font-bold transition-all shadow-[0_10px_28px_rgba(15,23,42,0.08)]',
                isPhone ? 'min-w-0 px-2 py-3 text-[11px] leading-4' : 'px-6 py-2 text-sm',
                activeCategory === category
                  ? 'bg-sky-500 text-white'
                  : 'border border-white/60 bg-white/45 text-zinc-600 backdrop-blur-xl hover:bg-white/60',
              )}
            >
              {category}
            </button>
          ))}
        </div>

        <div className={cn('grid', isPhone ? 'grid-cols-1 gap-4' : 'grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4')}>
          {filteredAppAchievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              whileHover={{ y: -5 }}
              className={cn(
                'relative flex flex-col items-center overflow-hidden text-center transition-all backdrop-blur-2xl',
                isPhone ? 'gap-3 rounded-[28px] border p-4' : 'gap-4 rounded-3xl border-2 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.14)]',
                achievement.unlocked
                  ? 'border-amber-200/70 bg-white/48'
                  : 'border-dashed border-white/55 bg-white/34',
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.62),rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.08))]" />
              <div
                className={cn(
                  'relative z-10 rounded-full flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_12px_24px_rgba(15,23,42,0.08)]',
                  isPhone ? 'h-12 w-12' : 'h-16 w-16',
                  achievement.unlocked ? 'bg-amber-100 text-amber-600' : 'bg-zinc-200 text-zinc-400',
                )}
              >
                {achievement.unlocked ? <achievement.icon size={isPhone ? 22 : 32} /> : <Lock size={isPhone ? 22 : 32} />}
              </div>

              <div className="relative z-10 flex-1">
                <h3 className={cn('font-bold', isPhone ? 'text-base leading-5' : 'text-lg', achievement.unlocked ? 'text-zinc-900' : 'text-zinc-500')}>
                  {achievement.title}
                </h3>
                <p className={cn('mt-1 text-zinc-500', isPhone ? 'text-[13px] leading-5' : 'text-sm')}>
                  {achievement.description}
                </p>
              </div>

              {achievement.unlocked && <CheckCircle2 className="relative z-10 self-end text-emerald-500" size={isPhone ? 20 : 24} />}
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
