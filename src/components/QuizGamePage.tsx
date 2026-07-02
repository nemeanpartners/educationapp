import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Flame, 
  Star, 
  ChevronRight, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Package, 
  Users,
  ArrowLeft,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Loader2,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { db, auth } from '@/firebase';
import { doc, onSnapshot } from '@/lib/portal-firestore';
import { QCAAQuiz, QCAAQuizData, QCAAQuestion } from '@/types';
import { detectStudentPortalFromPath, studentPortalHome } from '@/lib/portal';

// --- Types ---
interface QuizState {
  currentLevel: 1 | 2 | 3;
  stars: number;
  xp: number;
  streak: number;
  isFinished: boolean;
  score: number;
  totalQuestions: number;
  knowledgeGaps: string[];
}

const LEADERBOARD = [
  { name: "Alex Chen", points: 2450, onFire: true },
  { name: "Sarah Miller", points: 2100, onFire: true },
  { name: "Jamie Smith", points: 1850, onFire: false },
  { name: "You", points: 1240, onFire: false, isUser: true },
  { name: "Taylor Reed", points: 980, onFire: false },
];

export default function QuizGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const quizId = searchParams.get('id');
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const homePath = studentPortalHome(activePortal);

  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'results'>('lobby');
  const [quiz, setQuiz] = useState<QCAAQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizState, setQuizState] = useState<QuizState>({
    currentLevel: 1,
    stars: 2,
    xp: 1240,
    streak: 5,
    isFinished: false,
    score: 0,
    totalQuestions: 0,
    knowledgeGaps: []
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showLootBox, setShowLootBox] = useState(false);

  useEffect(() => {
    if (!quizId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'qcaa_quizzes', quizId), (snap) => {
      if (snap.exists()) {
        setQuiz({ id: snap.id, ...snap.data() } as QCAAQuiz);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [quizId]);

  const currentQuestions = quiz 
    ? quiz.data[`level_${quizState.currentLevel}` as keyof QCAAQuizData] 
    : [];
  const currentQuestion = currentQuestions[currentQuestionIndex];

  const handleStart = () => {
    if (!currentQuestions.length) return;
    setGameState('playing');
    setCurrentQuestionIndex(0);
    setQuizState(prev => ({ ...prev, score: 0, totalQuestions: currentQuestions.length, knowledgeGaps: [] }));
  };

  const handleAnswer = (index: number) => {
    if (isAnswered || !currentQuestion) return;
    setSelectedOption(index);
    setIsAnswered(true);

    const isCorrect = currentQuestion.options[index] === currentQuestion.correct_answer;
    if (isCorrect) {
      setQuizState(prev => ({ ...prev, score: prev.score + 1 }));
    } else {
      setQuizState(prev => ({ 
        ...prev, 
        knowledgeGaps: [...prev.knowledgeGaps, currentQuestion.question] 
      }));
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    setGameState('results');
    const passed = quizState.score / currentQuestions.length >= 0.7;
    
    if (passed) {
      try {
        const confettiFn = (confetti as any).default || confetti;
        if (typeof confettiFn === 'function') {
          confettiFn({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      } catch (e) {
        console.error("Confetti error:", e);
      }
      
      if (quizState.currentLevel === 3) {
        setShowLootBox(true);
      }

      setQuizState(prev => ({
        ...prev,
        stars: Math.min(3, prev.stars + 1),
        xp: prev.xp + 50,
        streak: prev.streak + 1
      }));
    } else {
      setQuizState(prev => ({
        ...prev,
        xp: prev.xp + 10 // Bravery points
      }));
    }
  };

  const resetQuiz = () => {
    setGameState('lobby');
    setSelectedOption(null);
    setIsAnswered(false);
    setShowLootBox(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={() => navigate(homePath)}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 group"
          >
            <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          </button>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-orange-500/10 px-4 py-2 rounded-2xl border border-orange-500/20">
              <Flame className={cn("h-5 w-5", quizState.streak > 0 ? "text-orange-500 animate-pulse" : "text-zinc-600")} />
              <span className="font-black text-orange-500">{quizState.streak}</span>
            </div>
            <div className="flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-2xl border border-indigo-500/20">
              <Zap className="h-5 w-5 text-indigo-500" />
              <span className="font-black text-indigo-500">{quizState.xp} XP</span>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {gameState === 'lobby' && (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
                  <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Loading Battle Data...</p>
                </div>
              ) : quiz ? (
                <>
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Badge className={cn(
                        "px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border",
                        quiz.type === 'official' ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                      )}>
                        {quiz.type === 'official' ? 'Official QCAA Path' : "Teacher's Challenge"}
                      </Badge>
                      {quiz.type === 'teacher' && (
                        <div className="flex items-center gap-2 text-purple-400 font-black text-xs uppercase tracking-widest">
                          <GraduationCap className="h-4 w-4" />
                          Teacher Badge
                        </div>
                      )}
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight">{quiz.subject}: {quiz.unit}</h1>
                    <p className="text-zinc-400 text-lg max-w-xl mx-auto">
                      {quiz.type === 'teacher' ? quiz.teacherNotes : "Master the official QCAA standards and climb the ranks."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((lvl) => (
                      <div 
                        key={lvl}
                        className={cn(
                          "p-8 rounded-[32px] border-2 transition-all relative overflow-hidden group",
                          quizState.currentLevel === lvl 
                            ? "bg-white/10 border-indigo-500/50 shadow-2xl shadow-indigo-500/10" 
                            : "bg-white/5 border-white/5 opacity-50 grayscale hover:opacity-100 hover:grayscale-0"
                        )}
                        onClick={() => setQuizState(prev => ({ ...prev, currentLevel: lvl as any }))}
                      >
                        <div className="relative z-10 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className={cn(
                              "p-3 rounded-2xl",
                              lvl === 1 ? "bg-emerald-500/20 text-emerald-400" :
                              lvl === 2 ? "bg-indigo-500/20 text-indigo-400" :
                              "bg-purple-500/20 text-purple-400"
                            )}>
                              {lvl === 1 ? <BookOpen className="h-6 w-6" /> :
                               lvl === 2 ? <Zap className="h-6 w-6" /> :
                               <ShieldCheck className="h-6 w-6" />}
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3].map(s => (
                                <Star 
                                  key={s} 
                                  className={cn(
                                    "h-4 w-4", 
                                    s <= (quizState.currentLevel === lvl ? quizState.stars : 0) ? "text-amber-400 fill-amber-400" : "text-white/10"
                                  )} 
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <h3 className="text-xl font-black">Level {lvl}</h3>
                            <p className="text-sm text-zinc-400 font-medium">
                              {lvl === 1 ? "Recall & Facts" :
                               lvl === 2 ? "Application" :
                               "Analysis & Evaluation"}
                            </p>
                          </div>
                        </div>
                        {quizState.currentLevel === lvl && (
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col items-center gap-6 pt-8">
                    <Button 
                      onClick={handleStart}
                      className="h-20 px-12 rounded-[24px] bg-indigo-600 hover:bg-indigo-500 text-white text-2xl font-black shadow-2xl shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
                    >
                      Start Battle
                      <ChevronRight className="ml-2 h-8 w-8" />
                    </Button>
                    <p className="text-zinc-500 font-bold flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      {quizState.streak} day streak! Don't let it break.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 space-y-6">
                  <AlertCircle className="h-16 w-16 text-zinc-600 mx-auto" />
                  <h2 className="text-3xl font-black">Quiz Not Found</h2>
                  <Button onClick={() => navigate(homePath)} variant="outline" className="rounded-xl">
                    Back to Dashboard
                  </Button>
                </div>
              )}

              {/* Leaderboard Teaser */}
              <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <Users className="text-indigo-400" />
                    Class Leaderboard
                  </h3>
                  <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Global Rank: #42</span>
                </div>
                <div className="space-y-4">
                  {LEADERBOARD.map((user, i) => (
                    <div 
                      key={user.name}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl transition-colors",
                        user.isUser ? "bg-indigo-500/20 border border-indigo-500/30" : "hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-black text-zinc-500 w-4">{i + 1}</span>
                        <div className="h-10 w-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center font-black text-sm">
                          {user.name[0]}
                        </div>
                        <div>
                          <p className="font-bold">{user.name}</p>
                          {user.onFire && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1">
                              <Flame className="h-3 w-3" /> On Fire
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-black text-indigo-400">{user.points} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'playing' && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-8"
            >
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-black uppercase tracking-widest text-zinc-500">
                  <span>Question {currentQuestionIndex + 1} of {currentQuestions.length}</span>
                  <span>{Math.round(((currentQuestionIndex + 1) / currentQuestions.length) * 100)}%</span>
                </div>
                <Progress value={((currentQuestionIndex + 1) / currentQuestions.length) * 100} className="h-2 bg-white/5" />
              </div>

              {/* Question Card */}
              <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 md:p-16 space-y-12 backdrop-blur-xl">
                <h2 className="text-3xl md:text-4xl font-black leading-tight text-center">
                  {currentQuestion?.question}
                </h2>

                <div className="grid grid-cols-1 gap-4">
                  {currentQuestion?.options.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={isAnswered}
                      className={cn(
                        "p-6 rounded-3xl text-left text-lg font-bold transition-all border-2 flex items-center justify-between group",
                        !isAnswered && "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1",
                        isAnswered && option === currentQuestion.correct_answer && "bg-emerald-500/20 border-emerald-500 text-emerald-400",
                        isAnswered && selectedOption === i && option !== currentQuestion.correct_answer && "bg-red-500/20 border-red-500 text-red-400",
                        isAnswered && option !== currentQuestion.correct_answer && (selectedOption !== i || option !== currentQuestion.correct_answer) && "opacity-30 grayscale"
                      )}
                    >
                      <span>{option}</span>
                      {isAnswered && option === currentQuestion.correct_answer && <CheckCircle2 className="h-6 w-6" />}
                      {isAnswered && selectedOption === i && option !== currentQuestion.correct_answer && <X className="h-6 w-6" />}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {isAnswered && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="p-6 rounded-3xl bg-indigo-500/10 border border-indigo-500/20">
                        <p className="text-indigo-300 font-medium leading-relaxed">
                          <span className="font-black uppercase tracking-widest text-xs block mb-2">The Why:</span>
                          {currentQuestion?.why_explanation}
                        </p>
                      </div>
                      <Button 
                        onClick={handleNext}
                        className="w-full h-16 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 text-xl font-black"
                      >
                        {currentQuestionIndex < currentQuestions.length - 1 ? "Next Question" : "Finish Quiz"}
                        <ChevronRight className="ml-2 h-6 w-6" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {gameState === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 text-center"
            >
              <div className="py-12 space-y-6">
                <div className="inline-flex p-6 rounded-full bg-indigo-500/20 text-indigo-400 mb-4">
                  <Trophy className="h-16 w-16" />
                </div>
                <h2 className="text-5xl font-black">Battle Complete!</h2>
                <div className="flex justify-center gap-8">
                  <div className="text-center">
                    <p className="text-4xl font-black text-indigo-400">{quizState.score}/{quizState.totalQuestions}</p>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-4xl font-black text-emerald-400">+{quizState.score * 10} XP</p>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Earned</p>
                  </div>
                </div>
              </div>

              {/* Study Spark Mechanic */}
              <div className="bg-white/5 border border-white/10 rounded-[40px] p-10 space-y-8">
                <div className="flex items-center justify-center gap-3 text-emerald-400">
                  <Sparkles className="h-6 w-6" />
                  <h3 className="text-2xl font-black">The Study Spark</h3>
                </div>
                
                {quizState.knowledgeGaps.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-zinc-400 text-lg">
                      "You've identified <span className="text-white font-black">{quizState.knowledgeGaps.length} knowledge gaps</span>! That's {quizState.knowledgeGaps.length} things you won't get wrong on the real exam. +10 XP for Bravery."
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {quizState.knowledgeGaps.map((gap, i) => (
                        <span key={i} className="px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                          {gap.length > 30 ? gap.substring(0, 30) + '...' : gap}
                        </span>
                      ))}
                    </div>
                    <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white font-bold rounded-xl">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Get AI Cheat Sheet
                    </Button>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-lg">
                    Flawless victory! You've mastered these concepts. Ready for the next level?
                  </p>
                )}
              </div>

              {/* Loot Box Reveal */}
              {showLootBox && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/30 rounded-[40px] p-10 space-y-6"
                >
                  <Package className="h-16 w-16 text-purple-400 mx-auto animate-bounce" />
                  <h3 className="text-2xl font-black text-purple-400">Level 3 Mystery Crate!</h3>
                  <p className="text-zinc-400">You've earned a rare collectible for mastering complex scenarios.</p>
                  <Button className="bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl px-8 h-14">
                    Open Loot Box
                  </Button>
                </motion.div>
              )}

              <div className="flex flex-col md:flex-row gap-4 pt-8">
                <Button 
                  onClick={resetQuiz}
                  className="flex-1 h-16 rounded-2xl bg-white text-zinc-950 hover:bg-zinc-200 text-xl font-black"
                >
                  Back to Lobby
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate(homePath)}
                  className="flex-1 h-16 rounded-2xl border-white/10 hover:bg-white/5 text-white text-xl font-black"
                >
                  Return to Dashboard
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}
