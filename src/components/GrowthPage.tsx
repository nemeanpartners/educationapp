import { motion } from 'motion/react';
import { TreeDeciduous, Zap, Calendar } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { detectStudentPortalFromPath } from '../lib/portal';

export default function GrowthPage() {
  const location = useLocation();
  const isUniversityPortal = detectStudentPortalFromPath(location.pathname) === 'university';
  if (isUniversityPortal) {
    return <Navigate to="/uni/progress-uni?view=overview" replace />;
  }

  const totalLogs = 37;
  const fullTrees = Math.floor(totalLogs / 10);
  const logsForNextTree = totalLogs % 10;
  const dayStreak = 0;

  return (
    <div className="p-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-zinc-900 flex items-center gap-3">
          <TreeDeciduous className="text-emerald-600" /> Your Forest
        </h1>
        <p className="text-zinc-500">A new tree grows for every 10 study sessions you log by completing to-do items or creating flashcard sets. Keep up the great work!</p>
      </header>

      {/* Forest Visualization */}
      <div className="bg-sky-50 rounded-3xl p-8 border border-sky-100 min-h-[200px] flex items-center justify-center gap-4">
        {Array.from({ length: fullTrees }).map((_, i) => (
          <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <TreeDeciduous size={64} className="text-emerald-600" />
          </motion.div>
        ))}
        {logsForNextTree > 0 && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
            <TreeDeciduous size={40} className="text-emerald-400" />
          </motion.div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'FULL TREES', value: fullTrees, icon: TreeDeciduous },
          { label: 'TOTAL LOGS', value: totalLogs, icon: Zap },
          { label: 'DAY STREAK', value: dayStreak, icon: Calendar },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm text-center">
            <div className="text-4xl font-black text-zinc-900">{stat.value}</div>
            <div className="text-sm font-bold text-zinc-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="w-full bg-zinc-200 rounded-full h-4 overflow-hidden">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${(logsForNextTree / 10) * 100}%` }}
          />
        </div>
        <p className="text-sm font-bold text-zinc-500">{logsForNextTree}/10 logs to grow next tree</p>
      </div>
    </div>
  );
}
