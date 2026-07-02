import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserProfile, FlashcardSet, Quiz } from '../types';
import { geminiService } from '../services/gemini';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy } from '@/lib/portal-firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { mergeFlashcardSets, saveFlashcardSet } from '../lib/flashcards-storage';
import { detectStudentPortalFromPath, studentPortalToolPath } from '@/lib/portal';
import {
  createPresetFlashcardSet,
  createPresetQuiz,
  getStudySuggestions,
  normalizeStudyTopic,
  recordStudySuggestionUsage,
} from '../lib/study-presets';
import {
  Plus,
  BookOpen,
  CheckCircle2,
  Brain,
  Sparkles,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  RotateCcw,
  Loader2,
  Trash2,
  MessageSquare,
  Target,
  FileText,
  Map,
  Search,
  Code,
  Palette,
  Database,
  Cloud,
  Building2,
  ExternalLink,
  Calculator,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

interface StudyToolsProps {
  profile: UserProfile | null;
}

export default function StudyTools({ profile }: StudyToolsProps) {
  const { isPhone } = useResponsiveDevice();
  const [activeTab, setActiveTab] = useState<'flashcards' | 'quizzes'>('flashcards');
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [currentSet, setCurrentSet] = useState<FlashcardSet | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [isAiToolsOpen, setIsAiToolsOpen] = useState(false);
  const [isStudySectionsOpen, setIsStudySectionsOpen] = useState(false);
  const [isProgramsOpen, setIsProgramsOpen] = useState(false);
  const [showSavedFlashcards, setShowSavedFlashcards] = useState(false);
  const [showSavedQuizzes, setShowSavedQuizzes] = useState(false);
  const [showSuggestionLibrary, setShowSuggestionLibrary] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const suggestionFeature = activeTab === 'flashcards' ? 'flashcards' : 'quizzes';
  const suggestionLibrary = useMemo(
    () => getStudySuggestions(suggestionFeature, profile?.uid).slice(0, 16),
    [suggestionFeature, profile?.uid, flashcardSets.length, quizzes.length],
  );
  const topSuggestions = suggestionLibrary.slice(0, 4);

  const aiTools = [
    { title: 'How I Learn Best', desc: 'Build your learning profile and get study methods that match you.', icon: Sparkles, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'learning-profile')) },
    { title: 'Study Buddy', desc: 'Gemini tutor chat with saved study conversations.', icon: MessageSquare, color: 'text-purple-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'assistant')) },
    { title: 'Summary Brain', desc: 'PDF intelligence, summaries, and library.', icon: Brain, color: 'text-purple-600', onClick: () => navigate(studentPortalToolPath(activePortal, 'the-brain')) },
    { title: 'Flashcards', desc: 'Create flashcards for any topic with AI.', icon: Brain, color: 'text-blue-500', onClick: () => setActiveTab('flashcards') },
    { title: 'AI Quizlet (MCQ)', desc: 'Generate multiple-choice quizzes from your notes or PDFs.', icon: CheckCircle2, color: 'text-green-500', onClick: () => setActiveTab('quizzes') },
    { title: 'Question Breakdown', desc: 'Dismantle complex questions into solvable steps.', icon: Target, color: 'text-red-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'question-breakdown')) },
    { title: 'Practice Quiz', desc: 'Generate quizzes on any topic.', icon: CheckCircle2, color: 'text-green-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'practice-quiz')) },
    { title: 'Mind Maps', desc: 'Visualize connections with AI-generated mind maps.', icon: Map, color: 'text-teal-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'mind-maps')) },
    { title: 'Math Solver', desc: 'Solve complex equations with checked steps and follow-up help.', icon: Target, color: 'text-cyan-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'math-solver')) },
    { title: 'Formula Explainer', desc: 'Identify formulas, define variables, and learn how to use them.', icon: BookOpen, color: 'text-cyan-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'formula-explainer')) },
    { title: 'Study Games', desc: 'Make learning fun with interactive games.', icon: Brain, color: 'text-cyan-500' },
  ];

  const studyAppSections = activePortal === 'university'
    ? [
        { title: 'Lecture Lift', desc: 'Turn lecture notes into revision-ready material with transcript context.', icon: Sparkles, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'lecture-lift-page')) },
        { title: 'Assignment Studio', desc: 'Plan, scope, and manage major university assignments.', icon: FileText, color: 'text-rose-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'assignment-studio')) },
        { title: 'Research Desk', desc: 'Capture sources, build citations, and synthesize evidence.', icon: Search, color: 'text-cyan-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'research-desk')) },
        { title: 'Report Builder', desc: 'Draft long-form reports and export them as Word documents.', icon: BookOpen, color: 'text-fuchsia-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'report-builder')) },
        { title: 'Teamwork', desc: 'Run meetings, group tasks, and project roles in one place.', icon: MessageSquare, color: 'text-blue-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'teamwork')) },
        { title: 'Meeting Room', desc: 'Join live Jitsi study rooms and upcoming university meetings.', icon: Video, color: 'text-indigo-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'meeting-room')) },
        { title: 'Class Notes', desc: 'Your digital notebook for each course and lecture stream.', icon: FileText, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'class-notes')) },
        { title: 'To-do List', desc: 'Organize weekly deliverables and project actions.', icon: CheckCircle2, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'todo')) },
        { title: 'Academic Goals', desc: 'Track outcomes, targets, and milestones.', icon: Target, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'academic-goals')) },
        { title: 'Focus', desc: 'Use focused work sessions for report writing and revision.', icon: Clock, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'timer')) },
        { title: 'Resources', desc: 'Find supporting resources, readings, and references.', icon: Map, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'resources')) },
        { title: 'Guided Math Solver', desc: 'Work through advanced maths with checked steps.', icon: Calculator, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'math-solver')) },
        { title: 'Library', desc: 'Access your digital readings and saved materials.', icon: BookOpen, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'library')) },
      ]
    : [
        { title: 'Class Notes', desc: 'Your digital notebook for every subject.', icon: FileText, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'class-notes')) },
        { title: 'Workbooks', desc: 'Draft assignments and practice problems.', icon: BookOpen, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'workbooks')) },
        { title: 'To-do List', desc: 'Organize your tasks and stay on track.', icon: CheckCircle2, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'todo')) },
        { title: 'Academic Goals', desc: 'Set and monitor your academic targets.', icon: Target, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'academic-goals')) },
        { title: 'Focus Timer', desc: 'Use Pomodoro and other timers.', icon: Clock, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'timer')) },
        { title: 'Resources', desc: 'Find helpful study materials and links.', icon: Map, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'resources')) },
        { title: 'Calculator', desc: 'A handy tool for calculations and graphing.', icon: Calculator, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'calculator')) },
        { title: 'Library', desc: 'Access your digital textbooks and resources.', icon: BookOpen, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'library')) },
        { title: 'Study Growth', desc: 'Track habits and progress.', icon: Sparkles, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'growth')) },
        { title: 'Weekly Report', desc: 'Get a summary of your week.', icon: FileText, color: 'text-emerald-500', onClick: () => navigate(studentPortalToolPath(activePortal, 'progress')) },
        { title: 'Animation', desc: 'Interactive visual study support.', icon: Brain, color: 'text-emerald-500' },
        { title: 'Referencing', desc: 'Generate citations in various styles.', icon: BookOpen, color: 'text-emerald-500', onClick: () => navigate(`${studentPortalToolPath(activePortal, 'resources')}?tool=references`) },
      ];

  const programTools = [
    ...(activePortal === 'university'
      ? [{
          name: 'Apps Anywhere',
          icon: Building2,
          color: 'bg-emerald-600',
          iconColor: 'text-emerald-600',
          description: 'University app launcher for institution software access.',
          href: 'https://www.appsanywhere.com/',
        }]
      : []),
    { name: 'Matlab', icon: Code, color: 'bg-orange-500', iconColor: 'text-orange-500', description: 'Numerical computing environment.' },
    { name: 'Canva', icon: Palette, color: 'bg-purple-500', iconColor: 'text-purple-500', description: 'Graphic design platform.' },
    { name: 'Python', icon: Database, color: 'bg-blue-500', iconColor: 'text-blue-500', description: 'Programming language.' },
    { name: 'OneDrive', icon: Cloud, color: 'bg-sky-500', iconColor: 'text-sky-500', description: 'Cloud storage service.' },
    { name: 'Zoom', icon: Video, color: 'bg-blue-600', iconColor: 'text-blue-600', description: 'Video meetings and online classes.' },
  ];

  useEffect(() => {
    if (!profile) return;

    const flashcardsQuery = query(
      collection(db, 'flashcards'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const quizzesQuery = query(
      collection(db, 'quizzes'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubFlashcards = onSnapshot(flashcardsQuery, (snapshot) => {
      const remoteSets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlashcardSet));
      setFlashcardSets(mergeFlashcardSets(remoteSets, profile.uid));
    }, (error) => {
      console.error('Flashcards listener failed, using local flashcards only:', error);
      setFlashcardSets(mergeFlashcardSets([], profile.uid));
    });

    const unsubQuizzes = onSnapshot(quizzesQuery, (snapshot) => {
      setQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'quizzes');
    });

    return () => {
      unsubFlashcards();
      unsubQuizzes();
    };
  }, [profile]);

  const handleGenerate = async () => {
    if (!topic || !profile) return;
    setIsGenerating(true);
    try {
      const normalizedTopic = normalizeStudyTopic(topic);
      if (activeTab === 'flashcards') {
        const existingSet = flashcardSets.find((set) => normalizeStudyTopic(set.title) === normalizedTopic);
        if (existingSet) {
          recordStudySuggestionUsage('flashcards', existingSet.title, profile.uid);
          setCurrentSet(existingSet);
          setCurrentCardIndex(0);
          setIsFlipped(false);
          setTopic('');
          return;
        }

        const presetSet = createPresetFlashcardSet(topic, profile.uid);
        if (presetSet) {
          const result = await saveFlashcardSet(presetSet);
          recordStudySuggestionUsage('flashcards', presetSet.title, profile.uid);
          setFlashcardSets((prev) => mergeFlashcardSets([result.saved, ...prev], profile.uid));
          setCurrentSet(result.saved);
          setCurrentCardIndex(0);
          setIsFlipped(false);
          setTopic('');
          return;
        }

        const cards = await geminiService.generateFlashcards(topic);
        const newSet = {
          userId: profile.uid,
          title: topic,
          description: `Generated flashcards for ${topic}`,
          cards,
          createdAt: new Date().toISOString(),
        };
        const result = await saveFlashcardSet(newSet);
        recordStudySuggestionUsage('flashcards', topic, profile.uid);
        setFlashcardSets((prev) => mergeFlashcardSets([result.saved, ...prev], profile.uid));
        setCurrentSet(result.saved);
        setCurrentCardIndex(0);
        setIsFlipped(false);
      } else {
        const existingQuiz = quizzes.find((quiz) => normalizeStudyTopic(quiz.title) === normalizedTopic);
        if (existingQuiz) {
          recordStudySuggestionUsage('quizzes', existingQuiz.title, profile.uid);
          startQuizlet(existingQuiz);
          setTopic('');
          return;
        }

        const presetQuiz = createPresetQuiz(topic, profile.uid);
        if (presetQuiz) {
          const ref = await addDoc(collection(db, 'quizzes'), presetQuiz);
          const savedQuiz = { ...presetQuiz, id: ref.id };
          recordStudySuggestionUsage('quizzes', presetQuiz.title, profile.uid);
          setQuizzes((prev) => [savedQuiz, ...prev]);
          startQuizlet(savedQuiz);
          setTopic('');
          return;
        }

        const questions = await geminiService.generateQuiz(topic);
        const newQuiz = {
          userId: profile.uid,
          title: topic,
          questions,
          createdAt: new Date().toISOString(),
        };
        const ref = await addDoc(collection(db, 'quizzes'), newQuiz);
        const savedQuiz = { ...newQuiz, id: ref.id };
        recordStudySuggestionUsage('quizzes', topic, profile.uid);
        setQuizzes((prev) => [savedQuiz, ...prev]);
        startQuizlet(savedQuiz);
      }
      setTopic('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, activeTab);
    } finally {
      setIsGenerating(false);
    }
  };

  const startQuizlet = (quiz: Quiz) => {
    setCurrentQuiz(quiz);
    setCurrentQuizIndex(0);
    setQuizAnswers({});
    setIsQuizSubmitted(false);
  };

  const quizletScore = currentQuiz
    ? currentQuiz.questions.reduce((total, question, index) => total + (quizAnswers[index] === question.correctAnswer ? 1 : 0), 0)
    : 0;

  const saveQuizAttempt = () => {
    if (!currentQuiz) return;
    const attempt = {
      id: `quizlet-${currentQuiz.id}-${Date.now()}`,
      source: 'AI Quizlet',
      title: currentQuiz.title,
      score: quizletScore,
      total: currentQuiz.questions.length,
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = JSON.parse(window.localStorage.getItem('learning-quiz-attempts') || '[]');
      window.localStorage.setItem('learning-quiz-attempts', JSON.stringify([attempt, ...existing].slice(0, 50)));
    } catch (error) {
      console.error('Could not save quiz attempt:', error);
    }
  };

  const renderPhoneFolderGrid = (
    items: Array<{ title: string; icon: any; color: string; onClick?: () => void }>,
    close: () => void
  ) => (
    <div className="overflow-y-auto px-4 pb-5 pt-3">
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => (
          <motion.button
            key={`${item.title}-${i}`}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (item.onClick) item.onClick();
              close();
            }}
            className={cn(
              "flex aspect-square flex-col items-center justify-start rounded-[22px] border border-zinc-200 bg-white px-2 py-3 text-center shadow-sm",
              item.onClick ? "cursor-pointer" : "cursor-default"
            )}
          >
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-100 bg-zinc-50">
              <item.icon className={cn("h-6 w-6", item.color)} />
            </div>
            <span className="line-clamp-2 text-[12px] font-bold leading-4 text-zinc-900">{item.title}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="w-fit rounded-2xl border border-white/70 bg-white/35 px-5 py-2 text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-slate-700 to-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
            Study Tools
          </h1>
        </div>
      </header>

      {/* AI Tools Section */}
      <div>
        <div className="flex flex-wrap gap-4">
          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAiToolsOpen(true)}
            className="group aspect-square w-full max-w-[280px] rounded-2xl border border-sky-200/45 bg-white/28 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.35),0_24px_70px_rgba(14,116,144,0.16)] backdrop-blur-2xl transition-all hover:border-sky-300/70 hover:bg-white/36 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_28px_80px_rgba(37,99,235,0.2)] flex flex-col"
          >
            <div className="relative mb-3 flex min-h-[160px] flex-1 items-center justify-center">
              <div className="grid w-fit grid-cols-4 gap-2 rounded-2xl border border-white/60 bg-white/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-2xl">
                {aiTools.slice(0, 12).map((tool, idx) => (
                  <div
                    key={`${tool.title}-${idx}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/70 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl"
                  >
                    <tool.icon className={cn("h-5 w-5", tool.color)} />
                  </div>
                ))}
              </div>
              <span className="absolute right-0 top-0 rounded-full border border-white/70 bg-white/45 px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                {aiTools.length} tools
              </span>
            </div>
            <div className="mt-auto">
              <h4 className="text-xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-slate-700 to-amber-300">AI Study Tools</h4>
              <p className="mt-1 text-sm text-slate-500">Tap to open folder</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsStudySectionsOpen(true)}
            className="group aspect-square w-full max-w-[280px] rounded-2xl border border-sky-200/45 bg-white/28 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.35),0_24px_70px_rgba(14,116,144,0.16)] backdrop-blur-2xl transition-all hover:border-sky-300/70 hover:bg-white/36 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_28px_80px_rgba(37,99,235,0.2)] flex flex-col"
          >
            <div className="relative mb-3 flex min-h-[160px] flex-1 items-center justify-center">
              <div className="grid w-fit grid-cols-4 gap-2 rounded-2xl border border-white/60 bg-white/24 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-2xl">
                {studyAppSections.slice(0, 12).map((section, idx) => (
                  <div
                    key={`${section.title}-${idx}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/70 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl"
                  >
                    <section.icon className={cn("h-5 w-5", section.color)} />
                  </div>
                ))}
              </div>
              <span className="absolute right-0 top-0 rounded-full border border-white/70 bg-white/45 px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                {studyAppSections.length} sections
              </span>
            </div>
            <div className="mt-auto">
              <h4 className="text-xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-slate-700 to-amber-300">Tools</h4>
              <p className="mt-1 text-sm text-slate-500">Tap to open folder</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsProgramsOpen(true)}
            className="group aspect-square w-full max-w-[280px] rounded-2xl border border-sky-200/45 bg-white/28 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.35),0_24px_70px_rgba(14,116,144,0.16)] backdrop-blur-2xl transition-all hover:border-sky-300/70 hover:bg-white/36 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_28px_80px_rgba(37,99,235,0.2)] flex flex-col"
          >
            <div className="relative mb-3 flex min-h-[160px] flex-1 items-center justify-center">
              <div className="grid w-fit grid-cols-2 gap-3 rounded-2xl border border-white/60 bg-white/24 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-2xl">
                {programTools.map((program) => (
                  <div
                    key={program.name}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/70 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-xl"
                  >
                    <program.icon className={cn("h-6 w-6", program.iconColor)} />
                  </div>
                ))}
              </div>
              <span className="absolute right-0 top-0 rounded-full border border-white/70 bg-white/45 px-2.5 py-1 text-[11px] font-bold text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                {programTools.length} programs
              </span>
            </div>
            <div className="mt-auto">
              <h4 className="text-xl font-black leading-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-slate-700 to-amber-300">Programs</h4>
              <p className="mt-1 text-sm text-slate-500">Tap to open folder</p>
            </div>
          </motion.button>
        </div>
      </div>

      <section className="mt-4 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="w-fit rounded-2xl border border-white/70 bg-white/35 px-5 py-2 text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-950 via-slate-700 to-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
              Quick Tools
            </h2>
            <p className="text-zinc-500">Generate flashcards and quizzes with AI.</p>
          </div>
        <div className="flex rounded-xl bg-zinc-100 p-1">
          <button
            onClick={() => setActiveTab('flashcards')}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-bold transition-all",
              activeTab === 'flashcards' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            Flashcards
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-bold transition-all",
              activeTab === 'quizzes' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            Quizzes
          </button>
        </div>
        </div>

      {/* Generation Input */}
      <div className="mx-auto w-full max-w-4xl rounded-3xl border-2 border-dashed border-zinc-200 bg-white p-5 sm:p-6 text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <Brain size={30} />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">What are we studying today?</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter a topic (e.g. Photosynthesis, Ancient Rome...)"
              className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !topic}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              Generate
            </button>
          </div>
          <div className="space-y-2 text-left">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                Suggested {activeTab === 'flashcards' ? 'revision sets' : 'quiz packs'}
              </p>
              <button
                type="button"
                onClick={() => setShowSuggestionLibrary(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:border-indigo-300 hover:text-indigo-600"
                aria-label="Open full suggestion list"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {topSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setTopic(suggestion)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-600 transition hover:border-indigo-300 hover:bg-white hover:text-indigo-600"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      </section>

      {/* Saved History Menus */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white">
          <button
            onClick={() => setShowSavedFlashcards((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-bold text-zinc-800">Saved Flashcards ({flashcardSets.length})</span>
            <ChevronDown
              className={cn("h-4 w-4 text-zinc-400 transition-transform", showSavedFlashcards ? "rotate-180" : "")}
            />
          </button>
          <AnimatePresence initial={false}>
            {showSavedFlashcards && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-zinc-100"
              >
                <div className="p-3 space-y-2">
                  {flashcardSets.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-zinc-500">No saved flashcards yet.</p>
                  ) : (
                    flashcardSets.map((set) => (
                      <button
                        key={set.id}
                        onClick={() => {
                          setCurrentSet(set);
                          setCurrentCardIndex(0);
                          setIsFlipped(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-left hover:border-indigo-200 hover:bg-white"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-900">{set.title}</p>
                          <p className="truncate text-xs text-zinc-500">{set.description}</p>
                        </div>
                        <span className="ml-3 shrink-0 text-xs font-semibold text-zinc-400">{set.cards.length} cards</span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white">
          <button
            onClick={() => setShowSavedQuizzes((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-bold text-zinc-800">Saved Quizzes ({quizzes.length})</span>
            <ChevronDown
              className={cn("h-4 w-4 text-zinc-400 transition-transform", showSavedQuizzes ? "rotate-180" : "")}
            />
          </button>
          <AnimatePresence initial={false}>
            {showSavedQuizzes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-zinc-100"
              >
                <div className="p-3 space-y-2">
                  {quizzes.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-zinc-500">No saved quizzes yet.</p>
                  ) : (
                    quizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-zinc-900">{quiz.title}</p>
                          <p className="truncate text-xs text-zinc-500">{quiz.questions.length} questions</p>
                        </div>
                        <button
                          onClick={() => startQuizlet(quiz)}
                          className="ml-3 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
                        >
                          Start
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showSuggestionLibrary && (
          <div className="fixed inset-0 z-[75] bg-zinc-900/45 p-4 backdrop-blur-sm sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="mx-auto flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                <div>
                  <h4 className="text-xl font-black text-zinc-900">Suggested {activeTab === 'flashcards' ? 'Flashcards' : 'Quizzes'}</h4>
                  <p className="text-sm font-medium text-zinc-500">Reuse common topics first so AI does less repetitive work.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSuggestionLibrary(false)}
                  className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-bold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">
                {suggestionLibrary.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setTopic(suggestion);
                      setShowSuggestionLibrary(false);
                    }}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-bold text-zinc-700 transition hover:border-indigo-300 hover:bg-white hover:text-indigo-600"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {isAiToolsOpen && (
          <div className={cn("fixed inset-0 z-[70] bg-zinc-900/45 backdrop-blur-sm", isPhone ? "p-3" : "p-4 sm:p-8")}>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className={cn("mx-auto flex h-full w-full flex-col border border-zinc-200 bg-white shadow-2xl", isPhone ? "max-w-sm rounded-[28px]" : "max-w-6xl rounded-3xl")}
            >
              <div className={cn("flex items-center justify-between border-b border-zinc-100", isPhone ? "px-4 py-3" : "px-6 py-5")}>
                <div>
                  <h4 className={cn("font-black text-zinc-900", isPhone ? "text-xl" : "text-2xl")}>AI Study Tools</h4>
                  <p className={cn("text-zinc-500", isPhone ? "text-xs" : "text-sm")}>Select a tool to open it.</p>
                </div>
                <button
                  onClick={() => setIsAiToolsOpen(false)}
                  className={cn("rounded-xl border border-zinc-200 font-bold text-zinc-600 hover:bg-zinc-50", isPhone ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm")}
                >
                  Close
                </button>
              </div>
              {isPhone ? renderPhoneFolderGrid(aiTools, () => setIsAiToolsOpen(false)) : (
                <div className="overflow-y-auto p-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {aiTools.map((tool, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ y: -3 }}
                        onClick={() => {
                          if (tool.onClick) tool.onClick();
                          setIsAiToolsOpen(false);
                        }}
                        className={cn(
                          "rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-all hover:border-indigo-200 hover:shadow-md",
                          tool.onClick ? "cursor-pointer" : "cursor-default"
                        )}
                      >
                        <tool.icon className={cn("mb-4", tool.color)} size={28} />
                        <h5 className="text-lg font-bold text-zinc-900">{tool.title}</h5>
                        <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{tool.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isStudySectionsOpen && (
          <div className={cn("fixed inset-0 z-[70] bg-zinc-900/45 backdrop-blur-sm", isPhone ? "p-3" : "p-4 sm:p-8")}>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className={cn("mx-auto flex h-full w-full flex-col border border-zinc-200 bg-white shadow-2xl", isPhone ? "max-w-sm rounded-[28px]" : "max-w-6xl rounded-3xl")}
            >
              <div className={cn("flex items-center justify-between border-b border-zinc-100", isPhone ? "px-4 py-3" : "px-6 py-5")}>
                <div>
                  <h4 className={cn("font-black text-zinc-900", isPhone ? "text-xl" : "text-2xl")}>Tools</h4>
                  <p className={cn("text-zinc-500", isPhone ? "text-xs" : "text-sm")}>Select a section to open it.</p>
                </div>
                <button
                  onClick={() => setIsStudySectionsOpen(false)}
                  className={cn("rounded-xl border border-zinc-200 font-bold text-zinc-600 hover:bg-zinc-50", isPhone ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm")}
                >
                  Close
                </button>
              </div>
              {isPhone ? renderPhoneFolderGrid(studyAppSections, () => setIsStudySectionsOpen(false)) : (
                <div className="overflow-y-auto p-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {studyAppSections.map((section, i) => (
                      <motion.button
                        key={i}
                        whileHover={{ y: -3 }}
                        onClick={() => {
                          if (section.onClick) section.onClick();
                          setIsStudySectionsOpen(false);
                        }}
                        className={cn(
                          "rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-md",
                          section.onClick ? "cursor-pointer" : "cursor-default"
                        )}
                      >
                        <section.icon className={cn("mb-4", section.color)} size={28} />
                        <h5 className="text-lg font-bold text-zinc-900">{section.title}</h5>
                        <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{section.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProgramsOpen && (
          <div className={cn("fixed inset-0 z-[70] bg-zinc-900/45 backdrop-blur-sm", isPhone ? "p-3" : "p-4 sm:p-8")}>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className={cn("mx-auto flex h-full w-full flex-col border border-zinc-200 bg-white shadow-2xl", isPhone ? "max-w-sm rounded-[28px]" : "max-w-6xl rounded-3xl")}
            >
              <div className={cn("flex items-center justify-between border-b border-zinc-100", isPhone ? "px-4 py-3" : "px-6 py-5")}>
                <div>
                  <h4 className={cn("font-black text-zinc-900", isPhone ? "text-xl" : "text-2xl")}>Programs</h4>
                  <p className={cn("text-zinc-500", isPhone ? "text-xs" : "text-sm")}>Select a program to open it.</p>
                </div>
                <button
                  onClick={() => setIsProgramsOpen(false)}
                  className={cn("rounded-xl border border-zinc-200 font-bold text-zinc-600 hover:bg-zinc-50", isPhone ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm")}
                >
                  Close
                </button>
              </div>
              {isPhone ? (
                <div className="overflow-y-auto px-4 pb-5 pt-3">
                  <div className="grid grid-cols-3 gap-3">
                    {programTools.map((program) => (
                      <motion.button
                        key={program.name}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          if (program.href) window.open(program.href, '_blank', 'noopener,noreferrer');
                        }}
                        className="flex aspect-square flex-col items-center justify-start rounded-[22px] border border-zinc-200 bg-white px-2 py-3 text-center shadow-sm"
                      >
                        <div className={cn("mb-2 flex h-12 w-12 items-center justify-center rounded-2xl text-white", program.color)}>
                          <program.icon size={24} />
                        </div>
                        <span className="line-clamp-2 text-[12px] font-bold leading-4 text-zinc-900">{program.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="overflow-y-auto p-6">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {programTools.map((program) => (
                      <motion.button
                        key={program.name}
                        whileHover={{ y: -3 }}
                        onClick={() => {
                          if (program.href) window.open(program.href, '_blank', 'noopener,noreferrer');
                        }}
                        className="rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-all hover:border-sky-300 hover:shadow-md"
                      >
                        <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white", program.color)}>
                          <program.icon size={24} />
                        </div>
                        <h5 className="text-lg font-bold text-zinc-900">{program.name}</h5>
                        <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{program.description}</p>
                        <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-600">
                          Launch <ExternalLink size={14} />
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Flashcard Modal */}
      <AnimatePresence>
        {currentSet && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-zinc-900">{currentSet.title}</h3>
                <button onClick={() => setCurrentSet(null)} className="rounded-full p-2 hover:bg-zinc-100">
                  <Plus className="rotate-45" />
                </button>
              </div>

              <div className="relative h-80 w-full perspective-1000">
                <motion.div
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="relative h-full w-full cursor-pointer preserve-3d"
                >
                  {/* Front */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-indigo-100 bg-indigo-50 p-8 backface-hidden">
                    <span className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-400">Term</span>
                    <p className="text-center text-2xl font-bold text-zinc-900">
                      {currentSet.cards[currentCardIndex].term}
                    </p>
                  </div>
                  {/* Back */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-emerald-100 bg-emerald-50 p-8 backface-hidden rotate-y-180">
                    <span className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-400">Definition</span>
                    <p className="text-center text-lg text-zinc-800">
                      {currentSet.cards[currentCardIndex].definition}
                    </p>
                  </div>
                </motion.div>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    disabled={currentCardIndex === 0}
                    onClick={() => { setCurrentCardIndex(prev => prev - 1); setIsFlipped(false); }}
                    className="rounded-xl border border-zinc-200 p-3 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    disabled={currentCardIndex === currentSet.cards.length - 1}
                    onClick={() => { setCurrentCardIndex(prev => prev + 1); setIsFlipped(false); }}
                    className="rounded-xl border border-zinc-200 p-3 text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
                <div className="text-sm font-bold text-zinc-400">
                  {currentCardIndex + 1} / {currentSet.cards.length}
                </div>
                <button
                  onClick={() => { setCurrentCardIndex(0); setIsFlipped(false); }}
                  className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-200"
                >
                  <RotateCcw size={18} />
                  Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saved Quizlet Modal */}
      <AnimatePresence>
        {currentQuiz && currentQuiz.questions[currentQuizIndex] && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Quizlet</p>
                  <h3 className="mt-1 text-2xl font-black text-zinc-900">{currentQuiz.title}</h3>
                  <p className="mt-1 text-sm font-bold text-zinc-500">
                    Question {currentQuizIndex + 1} of {currentQuiz.questions.length}
                  </p>
                </div>
                <button
                  onClick={() => setCurrentQuiz(null)}
                  className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
                  aria-label="Close quiz"
                >
                  <Plus className="rotate-45" />
                </button>
              </div>

              <div className="mb-6 h-3 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${((currentQuizIndex + 1) / currentQuiz.questions.length) * 100}%` }}
                />
              </div>

              <div className="rounded-3xl border border-zinc-100 bg-zinc-50 p-5">
                <h4 className="text-xl font-black leading-8 text-zinc-900">
                  {currentQuiz.questions[currentQuizIndex].question}
                </h4>
                <div className="mt-5 space-y-3">
                  {currentQuiz.questions[currentQuizIndex].options.map((option) => {
                    const selected = quizAnswers[currentQuizIndex] === option;
                    const correct = isQuizSubmitted && option === currentQuiz.questions[currentQuizIndex].correctAnswer;
                    const wrong = isQuizSubmitted && selected && option !== currentQuiz.questions[currentQuizIndex].correctAnswer;

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          if (!isQuizSubmitted) {
                            setQuizAnswers((answers) => ({ ...answers, [currentQuizIndex]: option }));
                          }
                        }}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-4 text-left text-sm font-bold leading-6 transition",
                          selected && !isQuizSubmitted && "border-indigo-300 bg-indigo-50 text-indigo-900",
                          !selected && !isQuizSubmitted && "border-zinc-200 bg-white text-zinc-700 hover:border-indigo-200",
                          correct && "border-emerald-300 bg-emerald-50 text-emerald-900",
                          wrong && "border-rose-300 bg-rose-50 text-rose-900",
                          isQuizSubmitted && !correct && !wrong && "border-zinc-200 bg-white text-zinc-600",
                        )}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {isQuizSubmitted && (
                  <div className="mt-5 rounded-2xl bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Explanation</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-zinc-700">
                      {currentQuiz.questions[currentQuizIndex].explanation || `Correct answer: ${currentQuiz.questions[currentQuizIndex].correctAnswer}`}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  disabled={currentQuizIndex === 0}
                  onClick={() => setCurrentQuizIndex((index) => Math.max(0, index - 1))}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  {!isQuizSubmitted && (
                    <button
                      disabled={Object.keys(quizAnswers).length < currentQuiz.questions.length}
                      onClick={() => {
                        saveQuizAttempt();
                        setIsQuizSubmitted(true);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-45"
                    >
                      Mark Quizlet
                    </button>
                  )}
                  <button
                    disabled={currentQuizIndex === currentQuiz.questions.length - 1}
                    onClick={() => setCurrentQuizIndex((index) => Math.min(currentQuiz.questions.length - 1, index + 1))}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {isQuizSubmitted && (
                <div className="mt-6 rounded-3xl border border-zinc-100 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Score</p>
                      <p className="mt-1 text-3xl font-black text-zinc-900">{quizletScore}/{currentQuiz.questions.length}</p>
                    </div>
                    <button
                      onClick={() => {
                        setCurrentQuizIndex(0);
                        setQuizAnswers({});
                        setIsQuizSubmitted(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-200"
                    >
                      <RotateCcw size={18} />
                      Try again
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {currentQuiz.questions.map((question, index) => {
                      const correct = quizAnswers[index] === question.correctAnswer;
                      return (
                        <button
                          key={`${question.question}-${index}`}
                          onClick={() => setCurrentQuizIndex(index)}
                          className="rounded-2xl bg-zinc-50 px-4 py-3 text-left hover:bg-zinc-100"
                        >
                          <p className={cn("text-sm font-black", correct ? "text-emerald-700" : "text-rose-700")}>
                            {index + 1}. {correct ? 'Correct' : 'Wrong'}
                          </p>
                          <p className="mt-1 truncate text-xs font-bold text-zinc-500">{question.question}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
