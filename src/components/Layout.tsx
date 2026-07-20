import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut, User } from 'firebase/auth';
import { UserProfile } from '../types';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  StickyNote,
  MessageSquare,
  Search,
  Video,
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
  ChevronDown,
  Calendar,
  CalendarDays,
  Users,
  Smile,
  Coffee,
  Brain,
  Calculator,
  Clock,
  School,
  Map,
  ClipboardList,
  CheckSquare,
  Wrench,
  Library,
  Mail,
  Target,
  NotebookPen,
  Trophy,
  TrendingUp,
  BarChart3,
  PieChart,
  Sparkles,
  User as UserIcon,
  Shield,
  Building2,
  Database,
  Gamepad2,
  GraduationCap
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { studentPortalPath, studentPortalToolPath, type StudentPortalType } from '../lib/portal';
import UniversityMeetingDock from './UniversityMeetingDock';
import {
  formatFocusTimer,
  getFocusTimerState,
  pauseFocusTimer,
  playFocusTimerChime,
  startFocusTimer,
  stopGlobalAmbientAudio,
  subscribeFocusTimer,
  syncFocusTimer,
  type FocusTimerState,
} from '../lib/focus-timer';

interface LayoutProps {
  user: User;
  profile: UserProfile | null;
  portal?: StudentPortalType;
}

export default function Layout({ user, profile, portal = 'highschool' }: LayoutProps) {
  // NOTE: This layout is currently configured for the Student Portal.
  // When implementing other portals (Teacher, School Head, App Admin),
  // ensure the navigation structure is adapted accordingly.
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [focusTimer, setFocusTimer] = useState<FocusTimerState>(() => getFocusTimerState());
  const { isPhone, isTablet } = useResponsiveDevice();

  const withPortal = (path: string) => studentPortalPath(portal, path);

  const getRoleInfo = () => {
    if (location.pathname.startsWith('/admin/app-admin')) return { name: 'App Admin', color: 'text-indigo-600', bg: 'bg-indigo-600' };
    if (location.pathname.startsWith('/admin/school-head')) return { name: 'School Head', color: 'text-emerald-600', bg: 'bg-emerald-600' };
    if (location.pathname.startsWith('/admin/teacher')) return { name: 'Teacher', color: 'text-purple-600', bg: 'bg-purple-600' };
    return { name: portal === 'university' ? 'University Student' : 'Student', color: 'text-zinc-400', bg: 'bg-zinc-900' };
  };

  const roleInfo = getRoleInfo();
  const portalEditionLabel = portal === 'university' ? 'University Edition' : 'HighSchool Edition';
  const avatarInitial = (user.displayName?.trim()?.charAt(0) || user.email?.trim()?.charAt(0) || 'U').toUpperCase();
  const settingsPath = withPortal('/settings');
  const isUniversityPortal = portal === 'university';
  const appLogo = '/edurevlogoimage.png';

  const isAppAdmin = location.pathname.startsWith('/admin/app-admin');
  const isSchoolHead = location.pathname.startsWith('/admin/school-head');
  const isTeacher = location.pathname.startsWith('/admin/teacher');

  const navSections = isAppAdmin ? [
    {
      label: 'Global Control',
      icon: '🌐',
      items: [
        { name: 'Global Dashboard', path: '/admin/app-admin', icon: LayoutDashboard, color: 'text-indigo-500', activeBg: 'bg-indigo-600' },
        { name: 'Schools', path: '/admin/app-admin/schools', icon: Building2, color: 'text-blue-500', activeBg: 'bg-blue-600' },
        { name: 'Curriculum', path: '/admin/app-admin/curriculum', icon: Database, color: 'text-purple-500', activeBg: 'bg-purple-600' },
      ]
    },
    {
      label: 'Admin',
      icon: '🛡️',
      items: [
        { name: 'Portal Switcher', path: '/settings/admins', icon: Shield, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
        { name: 'Student View', path: withPortal('/'), icon: GraduationCap, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
      ]
    }
  ] : isSchoolHead ? [
    {
      label: 'School Management',
      icon: '🏫',
      items: [
        { name: 'School Dashboard', path: '/admin/school-head', icon: LayoutDashboard, color: 'text-emerald-500', activeBg: 'bg-emerald-600' },
        { name: 'Teacher Tracking', path: '/admin/school-head/teachers', icon: Users, color: 'text-blue-500', activeBg: 'bg-blue-600' },
        { name: 'Grade Trends', path: '/admin/school-head/grades', icon: TrendingUp, color: 'text-purple-500', activeBg: 'bg-purple-600' },
      ]
    },
    {
      label: 'Admin',
      icon: '🛡️',
      items: [
        { name: 'Portal Switcher', path: '/settings/admins', icon: Shield, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
        { name: 'Student View', path: withPortal('/'), icon: GraduationCap, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
      ]
    }
  ] : isTeacher ? [
    {
      label: 'Teaching',
      icon: '👨‍🏫',
      items: [
        { name: 'Teacher Dashboard', path: '/admin/teacher', icon: LayoutDashboard, color: 'text-purple-500', activeBg: 'bg-purple-600' },
        { name: 'Tickets', path: '/admin/teacher/tickets', icon: MessageSquare, color: 'text-fuchsia-500', activeBg: 'bg-fuchsia-600' },
        { name: 'Class Progress', path: '/admin/teacher/progress', icon: BarChart3, color: 'text-blue-500', activeBg: 'bg-blue-600' },
        { name: 'Set Quizzes', path: '/admin/teacher/quizzes', icon: BookOpen, color: 'text-emerald-500', activeBg: 'bg-emerald-600' },
      ]
    },
    {
      label: 'Admin',
      icon: '🛡️',
      items: [
        { name: 'Portal Switcher', path: '/settings/admins', icon: Shield, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
        { name: 'Student View', path: withPortal('/'), icon: GraduationCap, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
      ]
    }
  ] : [
    {
      label: 'Main',
      icon: '🏠',
      items: [
        { name: 'Dashboard', path: withPortal('/'), icon: LayoutDashboard, color: 'text-indigo-500', activeBg: 'bg-indigo-600' },
        { name: 'My Classes', path: withPortal('/classes'), icon: School, color: 'text-blue-500', activeBg: 'bg-blue-600' },
      ]
    },
    {
      label: 'Planner',
      icon: '📅',
      items: [
        { name: 'Plan', path: withPortal('/plan'), icon: Map, color: 'text-emerald-500', activeBg: 'bg-emerald-600' },
        { name: 'Timetable', path: withPortal('/timetable'), icon: Calendar, color: 'text-teal-500', activeBg: 'bg-teal-600' },
        { name: 'Calendar', path: withPortal('/timetable/calendar'), icon: CalendarDays, color: 'text-cyan-500', activeBg: 'bg-cyan-600' },
        { name: 'Daily Planner', path: withPortal('/daily-planner'), icon: ClipboardList, color: 'text-cyan-500', activeBg: 'bg-cyan-600' },
        { name: 'To-do List', path: withPortal('/todo'), icon: CheckSquare, color: 'text-sky-500', activeBg: 'bg-sky-600' },
        { name: 'Deadlines', path: withPortal('/deadlines'), icon: Clock, color: 'text-rose-500', activeBg: 'bg-rose-600' },
      ]
    },
    {
      label: 'Study Hub',
      icon: '📚',
      items: isUniversityPortal
        ? [
            { name: 'Study Hub', path: withPortal('/study-hub'), icon: BookOpen, color: 'text-orange-500', activeBg: 'bg-orange-600' },
            { name: 'My Tools', path: studentPortalToolPath(portal, 'study'), icon: Wrench, color: 'text-amber-500', activeBg: 'bg-amber-600' },
            { name: 'Lecture Lift', path: studentPortalToolPath(portal, 'lecture-lift-page'), icon: Sparkles, color: 'text-emerald-500', activeBg: 'bg-emerald-600' },
            { name: 'Assignment Studio', path: studentPortalToolPath(portal, 'assignment-studio'), icon: ClipboardList, color: 'text-rose-500', activeBg: 'bg-rose-600' },
            { name: 'Research Desk', path: studentPortalToolPath(portal, 'research-desk'), icon: Search, color: 'text-cyan-500', activeBg: 'bg-cyan-600' },
            { name: 'Report Builder', path: studentPortalToolPath(portal, 'report-builder'), icon: FileText, color: 'text-fuchsia-500', activeBg: 'bg-fuchsia-600' },
            { name: 'Teamwork', path: studentPortalToolPath(portal, 'teamwork'), icon: Users, color: 'text-blue-500', activeBg: 'bg-blue-600' },
            { name: 'Meeting Room', path: studentPortalToolPath(portal, 'meeting-room'), icon: Video, color: 'text-indigo-500', activeBg: 'bg-indigo-600' },
            { name: 'Class Notes', path: studentPortalToolPath(portal, 'class-notes'), icon: NotebookPen, color: 'text-indigo-500', activeBg: 'bg-indigo-600' },
          ]
        : [
            { name: 'Study Hub', path: withPortal('/study-hub'), icon: BookOpen, color: 'text-orange-500', activeBg: 'bg-orange-600' },
            { name: 'My Tools', path: studentPortalToolPath(portal, 'study'), icon: Wrench, color: 'text-amber-500', activeBg: 'bg-amber-600' },
            { name: 'Study Buddy', path: studentPortalToolPath(portal, 'assistant'), icon: MessageSquare, color: 'text-purple-500', activeBg: 'bg-purple-600' },
            { name: 'Notes', path: withPortal('/notes'), icon: StickyNote, color: 'text-rose-500', activeBg: 'bg-rose-600' },
            { name: 'Workbooks', path: studentPortalToolPath(portal, 'workbooks'), icon: FileText, color: 'text-pink-500', activeBg: 'bg-pink-600' },
            { name: 'Word', path: portal === 'university' ? '/uni/workbooks-uni/word' : '/workbooks/word', icon: FileText, color: 'text-fuchsia-500', activeBg: 'bg-fuchsia-600' },
            { name: 'Class Notes', path: studentPortalToolPath(portal, 'class-notes'), icon: NotebookPen, color: 'text-indigo-500', activeBg: 'bg-indigo-600' },
          ]
    },
    {
      label: 'Utilities',
      icon: '🛠️',
      items: [
        { name: 'Resources', path: studentPortalToolPath(portal, 'resources'), icon: Library, color: 'text-violet-500', activeBg: 'bg-violet-600' },
        { name: 'Library', path: studentPortalToolPath(portal, 'library'), icon: BookOpen, color: 'text-emerald-500', activeBg: 'bg-emerald-600' },
        { name: 'Email', path: withPortal('/email'), icon: Mail, color: 'text-zinc-500', activeBg: 'bg-zinc-600' },
      ]
    },
    {
      label: isUniversityPortal ? 'Performance' : 'Focus & Rewards',
      icon: '🎯',
      items: [
        { name: isUniversityPortal ? 'Focus' : 'Focus Mode', path: studentPortalToolPath(portal, 'timer'), icon: Target, color: 'text-red-500', activeBg: 'bg-red-600' },
        { name: isUniversityPortal ? 'Achievements' : 'Rewards', path: withPortal('/rewards'), icon: Trophy, color: 'text-yellow-500', activeBg: 'bg-yellow-600' },
        ...(isUniversityPortal
          ? [
              { name: 'Performance Hub', path: studentPortalToolPath(portal, 'progress'), icon: BarChart3, color: 'text-indigo-500', activeBg: 'bg-indigo-600' },
            ]
          : [
              { name: 'Study Growth', path: studentPortalToolPath(portal, 'growth'), icon: TrendingUp, color: 'text-green-500', activeBg: 'bg-green-600' },
              { name: 'My Progress', path: studentPortalToolPath(portal, 'progress'), icon: BarChart3, color: 'text-indigo-500', activeBg: 'bg-indigo-600' },
            ]),
        { name: isUniversityPortal ? 'Course Standing' : 'Class Progress', path: withPortal('/class-progress'), icon: PieChart, color: 'text-blue-500', activeBg: 'bg-blue-600' },
      ]
    },
    {
      label: 'Personal',
      icon: '👤',
      items: [
        { name: isUniversityPortal ? 'Profile' : 'Me', path: withPortal('/profile'), icon: UserIcon, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
        ...(isUniversityPortal
          ? [
              { name: 'Network', path: withPortal('/social'), icon: Gamepad2, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
              { name: 'Journal', path: withPortal('/mood'), icon: StickyNote, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
              { name: 'Mood History', path: withPortal('/mood-logs'), icon: Smile, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
              { name: 'Vision Board', path: withPortal('/motivation-wall'), icon: Sparkles, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
              { name: 'Career Direction', path: withPortal('/beyond-school'), icon: GraduationCap, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
            ]
          : [
              { name: 'Social', path: withPortal('/social'), icon: Gamepad2, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
            ]),
        { name: 'Settings', path: withPortal('/settings'), icon: Settings, color: 'text-zinc-700', activeBg: 'bg-zinc-800' },
      ]
    }
  ];

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/auth');
  };

  const allNavItems = navSections.flatMap((section) => section.items);

  const isNavItemActive = (item: typeof allNavItems[number]) => {
    if (location.pathname === item.path) return true;
    if (item.path === '/' || !location.pathname.startsWith(`${item.path}/`)) return false;

    return !allNavItems.some((otherItem) => (
      otherItem.path !== item.path &&
      otherItem.path.startsWith(`${item.path}/`) &&
      location.pathname === otherItem.path
    ));
  };

  const sectionHasActiveItem = (section: typeof navSections[number]) => (
    section.items.some(isNavItemActive)
  );

  const isSectionExpanded = (section: typeof navSections[number]) => (
    expandedSections[section.label] ?? sectionHasActiveItem(section)
  );

  const toggleSection = (sectionLabel: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionLabel]: !(current[sectionLabel] ?? isSectionExpanded(navSections.find((section) => section.label === sectionLabel) || navSections[0])),
    }));
  };

  useEffect(() => {
    setExpandedSections((current) => {
      const activeSection = navSections.find(sectionHasActiveItem);
      if (!activeSection || current[activeSection.label]) return current;
      return { ...current, [activeSection.label]: true };
    });
  }, [location.pathname]);

  useEffect(() => {
    const unsubscribe = subscribeFocusTimer((state) => {
      setFocusTimer(state);
    });

    const interval = window.setInterval(() => {
      const { state, completed } = syncFocusTimer();
      setFocusTimer(state);
      if (completed) {
        stopGlobalAmbientAudio();
        playFocusTimerChime();
      }
    }, 1000);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-zinc-50 font-sans text-zinc-900">
      {/* Sidebar - Desktop */}
      <aside className="hidden h-dvh min-h-dvh w-72 shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 px-8 shrink-0">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
            <img src={appLogo} alt="EducationRev logo" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <span className="block text-xl font-black tracking-tight text-zinc-900">EducationRev</span>
            {!isAppAdmin && !isSchoolHead && !isTeacher && (
              <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                {portalEditionLabel}
              </p>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
            <nav className="space-y-3 pb-8">
              {navSections.map((section) => {
                const sectionExpanded = isSectionExpanded(section);

                return (
                <div key={section.label} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    aria-expanded={sectionExpanded}
                    className="flex w-full items-center justify-between rounded-2xl px-4 py-2 text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span>{section.icon}</span>
                      <span className="truncate">{section.label}</span>
                    </span>
                    <ChevronDown
                      size={14}
                      className={cn("shrink-0 transition-transform", sectionExpanded && "rotate-180")}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {sectionExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isNavItemActive(item);
                      return (
                        <Link
                          key={item.name + item.path}
                          to={item.path}
                          className={cn(
                            "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all",
                            isActive
                              ? `${item.activeBg} text-white shadow-lg shadow-zinc-200`
                              : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                          )}
                        >
                          <Icon 
                            size={18} 
                            className={cn(
                              "transition-colors", 
                              isActive ? "text-white" : cn("text-zinc-400 group-hover:text-zinc-900", item.color)
                            )} 
                          />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                  </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                );
              })}
            </nav>
        </div>

        <div className="mt-auto shrink-0 border-t border-zinc-100 bg-white p-6">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold text-zinc-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className={cn(
          "border-b border-zinc-200 bg-white",
          isPhone ? "px-4 py-3" : "flex h-20 items-center justify-between px-8 lg:px-12"
        )}>
          {isPhone ? (
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button className="rounded-xl p-2 text-zinc-500 lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                  <Menu size={24} />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-zinc-900">EducationRev</p>
                  {!isAppAdmin && !isSchoolHead && !isTeacher && (
                    <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                      {portalEditionLabel}
                    </p>
                  )}
                  <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", roleInfo.color)}>{roleInfo.name}</p>
                </div>
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                {(focusTimer.active || focusTimer.remainingSeconds > 0) && (
                  <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <span className="font-mono text-[13px] font-black text-zinc-900">
                      {formatFocusTimer(focusTimer.remainingSeconds)}
                    </span>
                    <button
                      onClick={() => {
                        if (focusTimer.active) {
                          pauseFocusTimer();
                          stopGlobalAmbientAudio();
                        } else if (focusTimer.remainingSeconds > 0) {
                          startFocusTimer();
                        }
                      }}
                      className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-white px-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-700 shadow-sm transition hover:bg-zinc-100"
                    >
                      {focusTimer.active ? 'Pause' : 'Start'}
                    </button>
                  </div>
                )}

                <button className="relative rounded-2xl bg-zinc-100 p-2.5 text-zinc-500 hover:bg-zinc-200 transition-all">
                  <Bell size={18} />
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
                </button>
                <button
                  onClick={() => navigate(settingsPath)}
                  className="rounded-2xl bg-zinc-100 p-2.5 text-zinc-500 hover:bg-zinc-200 transition-all"
                >
                  <Settings size={18} />
                </button>

                <div className="relative shrink-0">
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 rounded-2xl bg-zinc-100 p-1.5 pr-2 hover:bg-zinc-200 transition-all"
                  >
                    {user.photoURL && !avatarFailed ? (
                      <img
                        src={user.photoURL}
                        className="h-9 w-9 rounded-xl border border-white object-cover shadow-sm"
                        alt="User"
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white bg-violet-500 text-sm font-black text-white shadow-sm">
                        {avatarInitial}
                      </div>
                    )}
                    <ChevronDown size={14} className={cn("text-zinc-400 transition-transform", isProfileOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {isProfileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-56 origin-top-right rounded-3xl bg-white p-2 shadow-2xl ring-1 ring-black/5 z-50"
                      >
                        <div className="mb-1 border-b border-zinc-50 px-4 py-3">
                          <p className="text-sm font-bold text-zinc-900">{user.displayName}</p>
                          <p className="truncate text-xs text-zinc-400">{user.email}</p>
                        </div>
                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            navigate(settingsPath);
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold text-zinc-600 transition-all hover:bg-zinc-50"
                        >
                          <Settings size={18} /> Settings
                        </button>
                        <button 
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold text-red-600 transition-all hover:bg-red-50"
                        >
                          <LogOut size={18} /> Sign Out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-1 items-center gap-8">
                <div className="relative hidden w-full max-w-md md:block">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search your study materials..."
                    className="w-full rounded-2xl border-none bg-zinc-100 py-3 pl-12 pr-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                </div>
                <button className="rounded-xl p-2 text-zinc-500 lg:hidden" onClick={() => setIsMobileMenuOpen(true)}>
                  <Menu size={24} />
                </button>
              </div>

              <div className="flex items-center gap-6">
                {(focusTimer.active || focusTimer.remainingSeconds > 0) && (
                  <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <span className="font-mono text-sm font-black text-zinc-900">
                      {formatFocusTimer(focusTimer.remainingSeconds)}
                    </span>
                    <button
                      onClick={() => {
                        if (focusTimer.active) {
                          pauseFocusTimer();
                          stopGlobalAmbientAudio();
                        } else if (focusTimer.remainingSeconds > 0) {
                          startFocusTimer();
                        }
                      }}
                      className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-white px-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-700 shadow-sm transition hover:bg-zinc-100"
                    >
                      {focusTimer.active ? 'Pause' : 'Start'}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-6">
                  <button className="relative rounded-2xl bg-zinc-100 p-3 text-zinc-500 hover:bg-zinc-200 transition-all">
                    <Bell size={20} />
                    <span className="absolute right-3 top-3 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
                  </button>
                  <button
                    onClick={() => navigate(settingsPath)}
                    className="rounded-2xl bg-zinc-100 p-3 text-zinc-500 hover:bg-zinc-200 transition-all"
                  >
                    <Settings size={20} />
                  </button>
                  <div className="mx-2 h-8 w-px bg-zinc-200" />

                  <div className="relative">
                    <button 
                      onClick={() => setIsProfileOpen(!isProfileOpen)}
                      className="flex items-center gap-3 rounded-2xl bg-zinc-100 p-1.5 pr-4 hover:bg-zinc-200 transition-all"
                    >
                      {user.photoURL && !avatarFailed ? (
                        <img
                          src={user.photoURL}
                          className="h-9 w-9 rounded-xl border border-white object-cover shadow-sm"
                          alt="User"
                          onError={() => setAvatarFailed(true)}
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white bg-violet-500 text-sm font-black text-white shadow-sm">
                          {avatarInitial}
                        </div>
                      )}
                      <div className="hidden text-left sm:block">
                        <p className="text-xs font-black leading-none text-zinc-900">{user.displayName?.split(' ')[0]}</p>
                        <p className={cn("mt-0.5 text-[10px] font-black uppercase tracking-wider", roleInfo.color)}>{roleInfo.name}</p>
                      </div>
                      <ChevronDown size={14} className={cn("text-zinc-400 transition-transform", isProfileOpen && "rotate-180")} />
                    </button>

                    <AnimatePresence>
                      {isProfileOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-3 w-56 origin-top-right rounded-3xl bg-white p-2 shadow-2xl ring-1 ring-black/5 z-50"
                        >
                          <div className="mb-1 border-b border-zinc-50 px-4 py-3">
                            <p className="text-sm font-bold text-zinc-900">{user.displayName}</p>
                            <p className="truncate text-xs text-zinc-400">{user.email}</p>
                          </div>
                          <button
                            onClick={() => {
                              setIsProfileOpen(false);
                              navigate(settingsPath);
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold text-zinc-600 transition-all hover:bg-zinc-50"
                          >
                            <Settings size={18} /> Settings
                          </button>
                          <button 
                            onClick={handleSignOut}
                            className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold text-red-600 transition-all hover:bg-red-50"
                          >
                            <LogOut size={18} /> Sign Out
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </>
          )}
        </header>
        {/* Mobile Nav Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-h-dvh flex-col overflow-hidden bg-white shadow-2xl lg:hidden"
              >
                <div className="mb-4 flex shrink-0 items-center justify-between p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-transparent">
                      <img src={appLogo} alt="EducationRev logo" className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xl font-black tracking-tight text-zinc-900">EducationRev</span>
                      {!isAppAdmin && !isSchoolHead && !isTeacher && (
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                          {portalEditionLabel}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900">
                    <X size={24} />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
                  <nav className="space-y-3 pb-6">
                    {navSections.map((section) => {
                      const sectionExpanded = isSectionExpanded(section);

                      return (
                      <div key={section.label} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => toggleSection(section.label)}
                          aria-expanded={sectionExpanded}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-2 text-left text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span>{section.icon}</span>
                            <span className="truncate">{section.label}</span>
                          </span>
                          <ChevronDown
                            size={14}
                            className={cn("shrink-0 transition-transform", sectionExpanded && "rotate-180")}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {sectionExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                        <div className="space-y-1">
                          {section.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = isNavItemActive(item);
                            return (
                              <Link
                                key={item.name + item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={cn(
                                  "flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all",
                                  isActive
                                    ? `${item.activeBg} text-white shadow-lg shadow-zinc-200`
                                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                                )}
                              >
                                <Icon size={18} className={isActive ? "text-white" : item.color} />
                                {item.name}
                              </Link>
                            );
                          })}
                        </div>
                        </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      );
                    })}
                    <div className="pt-3">
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-50 px-4 py-4 text-sm font-bold text-red-600 transition-all"
                      >
                        <LogOut size={20} />
                        Sign Out
                      </button>
                    </div>
                  </nav>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className={cn(
          "flex-1 overflow-y-auto bg-zinc-50/50",
          isPhone ? "p-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]" : isTablet ? "p-6 lg:p-8" : "p-8 lg:p-12"
        )}>
          <div className={cn("mx-auto w-full", location.pathname.includes('class-notes') ? "max-w-none" : "max-w-7xl")}>
            <Outlet />
          </div>
        </main>
      </div>
      {isUniversityPortal ? <UniversityMeetingDock /> : null}
    </div>
  );
}
