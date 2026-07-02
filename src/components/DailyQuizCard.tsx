import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Star, ChevronRight, Flame, Sparkles, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from '@/lib/portal-firestore';
import { QCAAQuiz } from '@/types';
import { Badge } from '@/components/ui/badge';
import { detectStudentPortalFromPath, studentPortalPath } from '../lib/portal';

export function DailyQuizCard() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [officialQuiz, setOfficialQuiz] = useState<QCAAQuiz | null>(null);
  const [teacherQuiz, setTeacherQuiz] = useState<QCAAQuiz | null>(null);

  useEffect(() => {
    // Fetch latest official quiz
    const qOfficial = query(
      collection(db, 'qcaa_quizzes'),
      where('type', '==', 'official'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsubOfficial = onSnapshot(qOfficial, (snap) => {
      if (!snap.empty) setOfficialQuiz({ id: snap.docs[0].id, ...snap.docs[0].data() } as QCAAQuiz);
    });

    // Fetch latest teacher quiz
    const qTeacher = query(
      collection(db, 'qcaa_quizzes'),
      where('type', '==', 'teacher'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsubTeacher = onSnapshot(qTeacher, (snap) => {
      if (!snap.empty) setTeacherQuiz({ id: snap.docs[0].id, ...snap.docs[0].data() } as QCAAQuiz);
    });

    return () => {
      unsubOfficial();
      unsubTeacher();
    };
  }, []);

  const renderBattleCard = (quiz: QCAAQuiz, isTeacher: boolean) => (
    <motion.div 
      key={quiz.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group cursor-pointer w-full"
      onClick={() => navigate(`${studentPortalPath(activePortal, '/quiz-game')}?id=${quiz.id}`)}
    >
      {/* Glassmorphism Background */}
      <div className={cn(
        "absolute inset-0 backdrop-blur-2xl rounded-[32px] border shadow-lg transition-all group-hover:bg-white/15",
        isTeacher ? "bg-purple-500/5 border-purple-500/20" : "bg-indigo-500/5 border-indigo-500/20"
      )} />
      
      {/* Content */}
      <div className="relative p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className={cn(
            "p-4 rounded-[24px] border shadow-inner",
            isTeacher ? "bg-purple-500/20 border-purple-500/30 text-purple-400" : "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
          )}>
            {isTeacher ? <GraduationCap className="h-8 w-8" /> : <Zap className="h-8 w-8 animate-pulse" />}
          </div>
          
          <Button 
            className={cn(
              "h-12 px-6 rounded-[20px] text-white text-lg font-black shadow-lg transition-all group-hover:scale-105",
              isTeacher ? "bg-purple-600 hover:bg-purple-500 shadow-purple-600/20" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
            )}
          >
            {isTeacher ? "Accept" : "Start"}
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border",
              isTeacher ? "text-purple-400 bg-purple-500/10 border-purple-500/20" : "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
            )}>
              {isTeacher ? "Teacher's Challenge" : "Official QCAA Path"}
            </span>
          </div>
          
          <h2 className="text-xl font-black text-zinc-900 tracking-tight">
            {quiz.subject}: {quiz.unit}
          </h2>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex-1 max-w-[120px] space-y-1">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-zinc-400">
                <span>Level</span>
                <span>{isTeacher ? 'New' : '2/3'}</span>
              </div>
              <Progress value={isTeacher ? 0 : 66} className="h-1.5 bg-zinc-100" />
            </div>
            
            <div className="flex gap-0.5">
              {[1, 2, 3].map(s => (
                <Star key={s} className={cn("h-4 w-4", (!isTeacher && s <= 2) ? "text-amber-400 fill-amber-400" : "text-zinc-200")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
        <div className="h-px w-8 bg-zinc-300" />
        Daily Quiz Battle
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {officialQuiz && renderBattleCard(officialQuiz, false)}
        {teacherQuiz && renderBattleCard(teacherQuiz, true)}
        
        {!officialQuiz && !teacherQuiz && (
          <div className="col-span-full p-12 border-2 border-dashed border-zinc-200 rounded-[40px] text-center space-y-4">
            <Sparkles className="h-12 w-12 text-zinc-300 mx-auto" />
            <div>
              <p className="font-black text-zinc-900">No Battles Available</p>
              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Check back later for new QCAA challenges!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
