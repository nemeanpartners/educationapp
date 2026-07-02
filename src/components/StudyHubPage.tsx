import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  FileText, 
  GraduationCap, 
  ChevronRight, 
  Sparkles,
  Target,
  Clock,
  ArrowRight,
  Plus,
  MessageSquare,
  Brain,
  CheckCircle2,
  Map,
  ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ExamPlanner from './ExamPlanner';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import {
  detectStudentPortalFromPath,
  studentPortalAssignmentCoachPath,
  studentPortalAssignmentPortalPath,
} from '@/lib/portal';

type View = 'hub' | 'exam';

interface StudyHubPageProps {
  initialView?: View;
}

export default function StudyHubPage({ initialView = 'hub' }: StudyHubPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPhone } = useResponsiveDevice();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [view, setView] = useState<View>(() => (location.state as { openExam?: boolean } | null)?.openExam ? 'exam' : initialView);

  useEffect(() => {
    if ((location.state as { openExam?: boolean } | null)?.openExam) {
      setView('exam');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    setView((location.state as { openExam?: boolean } | null)?.openExam ? 'exam' : initialView);
  }, [initialView, location.state]);

  return (
    <div className="min-h-full">
      <AnimatePresence mode="wait">
        {view === 'hub' && (
          <motion.div
            key="hub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn("mx-auto max-w-6xl", isPhone ? "p-4" : "p-8")}
          >
            <div className={cn(isPhone ? "mb-8" : "mb-12")}>
              <h1 className={cn("font-black tracking-tight text-zinc-900 mb-4", isPhone ? "text-3xl" : "text-4xl")}>Study Hub</h1>
              <p className="text-zinc-500 text-lg">Your central command for academic excellence. Choose a portal to begin planning.</p>
            </div>

            <div className={cn("grid", isPhone ? "grid-cols-1 gap-4" : "grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3")}>
              {/* Assignment Coach Card */}
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => navigate(studentPortalAssignmentCoachPath(activePortal))}
                className={cn("group relative bg-white border border-zinc-200 shadow-xl shadow-zinc-200/50 text-left overflow-hidden cursor-pointer", isPhone ? "rounded-[28px] p-5" : "rounded-[40px] p-10 md:col-span-2 xl:col-span-2")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(studentPortalAssignmentCoachPath(activePortal));
                  }
                }}
              >
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                  <ClipboardCheck size={240} />
                </div>

                <div className={cn("relative z-10 flex h-full", isPhone ? "items-center gap-4" : "flex-col")}>
                  <div className={cn("bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shrink-0", isPhone ? "h-14 w-14" : "mb-8 h-16 w-16")}>
                    <ClipboardCheck size={isPhone ? 28 : 32} />
                  </div>
                  <div className={cn("flex min-w-0 flex-1 flex-col", isPhone ? "justify-center" : "")}>
                    <h2 className={cn("font-black text-zinc-900", isPhone ? "mb-1 text-[1.6rem] leading-none" : "mb-4 text-3xl")}>Assignment Coach</h2>
                    <p className={cn("text-zinc-500 leading-relaxed", isPhone ? "mb-3 text-sm line-clamp-3" : "mb-6")}>
                      Upload the task sheet and rubric, get a personalised routine, weekly study blocks, and draft feedback against the criteria.
                    </p>
                    <div className={cn("mt-auto flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest", isPhone ? "text-[11px]" : "text-sm")}>
                      Start Coach <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Assignment Portal Card */}
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => navigate(studentPortalAssignmentPortalPath(activePortal))}
                className={cn("group relative bg-white border border-zinc-200 shadow-xl shadow-zinc-200/50 text-left overflow-hidden cursor-pointer", isPhone ? "rounded-[28px] p-5" : "rounded-[40px] p-10")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(studentPortalAssignmentPortalPath(activePortal));
                  }
                }}
              >
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                  <FileText size={240} />
                </div>
                
                <div className={cn("relative z-10 flex h-full", isPhone ? "items-center gap-4" : "flex-col")}>
                  <div className={cn("bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shrink-0", isPhone ? "h-14 w-14" : "mb-8 h-16 w-16")}>
                    <FileText size={isPhone ? 28 : 32} />
                  </div>
                  <div className={cn("flex min-w-0 flex-1 flex-col", isPhone ? "justify-center" : "")}>
                    <h2 className={cn("font-black text-zinc-900", isPhone ? "mb-1 text-[1.6rem] leading-none" : "mb-4 text-3xl")}>Assignment Portal</h2>
                    <p className={cn("text-zinc-500 leading-relaxed", isPhone ? "mb-3 text-sm line-clamp-2" : "mb-8")}>
                      Continue existing plans, export draft work, and manage the detailed assignment workspace.
                    </p>
                    <div className={cn("mt-auto flex items-center gap-2 text-blue-600 font-black uppercase tracking-widest", isPhone ? "text-[11px]" : "text-sm")}>
                      Enter Portal <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Exam Portal Card */}
              <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                onClick={() => setView('exam')}
                className={cn("group relative bg-white border border-zinc-200 shadow-xl shadow-zinc-200/50 text-left overflow-hidden cursor-pointer", isPhone ? "rounded-[28px] p-5" : "rounded-[40px] p-10")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setView('exam');
                  }
                }}
              >
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                  <GraduationCap size={240} />
                </div>

                <div className={cn("relative z-10 flex h-full", isPhone ? "items-center gap-4" : "flex-col")}>
                  <div className={cn("bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all duration-500 shrink-0", isPhone ? "h-14 w-14" : "mb-8 h-16 w-16")}>
                    <GraduationCap size={isPhone ? 28 : 32} />
                  </div>

                  <div className={cn("flex min-w-0 flex-1 flex-col", isPhone ? "justify-center" : "")}>
                    <h2 className={cn("font-black text-zinc-900", isPhone ? "mb-1 text-[1.6rem] leading-none" : "mb-4 text-3xl")}>Exam Portal</h2>
                    <p className={cn("text-zinc-500 leading-relaxed", isPhone ? "mb-3 text-sm line-clamp-2" : "mb-8")}>
                      Build topics, track mastery, and create a revision schedule.
                    </p>

                    <div className={cn("mt-auto flex items-center gap-2 text-purple-600 font-black uppercase tracking-widest", isPhone ? "text-[11px]" : "text-sm")}>
                      Enter Portal <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Quick Tips Section */}
            <div className={cn(isPhone ? "mt-8 flex gap-4 overflow-x-auto pb-2" : "mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3")}>
              <div className={cn("bg-zinc-900 text-white shrink-0", isPhone ? "w-[230px] rounded-[28px] p-5" : "rounded-3xl p-6")}>
                <Target className="text-yellow-400 mb-4" />
                <h4 className="font-bold mb-2">Set Clear Goals</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">Define exactly what you want to achieve before you start your study session.</p>
              </div>
              <div className={cn("bg-zinc-900 text-white shrink-0", isPhone ? "w-[230px] rounded-[28px] p-5" : "rounded-3xl p-6")}>
                <Clock className="text-blue-400 mb-4" />
                <h4 className="font-bold mb-2">Time Blocking</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">Allocate specific blocks of time for different tasks to avoid multitasking.</p>
              </div>
              <div className={cn("bg-zinc-900 text-white shrink-0", isPhone ? "w-[230px] rounded-[28px] p-5" : "rounded-3xl p-6")}>
                <Sparkles className="text-purple-400 mb-4" />
                <h4 className="font-bold mb-2">Active Recall</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">Test yourself frequently instead of just re-reading your notes.</p>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'exam' && (
          <motion.div
            key="exam"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="h-full"
          >
            <ExamPlanner onBack={() => setView('hub')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
