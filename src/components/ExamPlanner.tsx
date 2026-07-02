import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  ChevronLeft,
  GraduationCap,
  Target,
  Clock,
  Loader2,
  Calendar,
  Sparkles,
  TrendingUp,
  BarChart3,
  Wand2,
  Play,
  Pause,
  RotateCcw,
  Youtube,
  Book,
  FileCheck,
  Timer,
  ExternalLink,
  Search,
  BookOpen,
  Eye,
  CheckCircle,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { geminiGenerateContent } from '../services/geminiProxy';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  orderBy,
  getDoc,
  getDocs,
  writeBatch
} from '@/lib/portal-firestore';
import { cn } from '../lib/utils';
import { ExamPlan } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { BACKGROUND_PRESETS } from '../lib/backgrounds';
import { getOrCreateCachedAiResult } from '../lib/ai-result-cache';
import {
  configureFocusTimer,
  formatFocusTimer,
  getFocusTimerState,
  pauseFocusTimer,
  startFocusTimer,
  stopGlobalAmbientAudio,
  subscribeFocusTimer,
  type FocusTimerState,
} from '../lib/focus-timer';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

interface ExamPlannerProps {
  onBack: () => void;
}

const EXAM_STEPS = [
  { id: 1, title: 'Topic Mapping', icon: Target, description: 'Identify topics and confidence levels.' },
  { id: 2, title: 'Plan of Attack', icon: BookOpen, description: 'Turn topics into a clear weekly study schedule.' },
  { id: 3, title: 'Active Revision', icon: Sparkles, description: 'Active recall, summaries, and flashcards.' },
  { id: 4, title: 'Mock Exams', icon: FileCheck, description: 'Practice papers and timed mock tests.' },
  { id: 5, title: 'Final Polish', icon: Eye, description: 'Review weak areas and final recap.' }
];

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const SUBJECT_TOPIC_LIBRARY: Array<{
  keywords: string[];
  topics: Record<'10' | '11' | '12', string[]>;
}> = [
  {
    keywords: ['math methods', 'mathematical methods', 'methods', 'general mathematics', 'math', 'mathematics'],
    topics: {
      '10': ['Linear equations', 'Quadratic patterns', 'Trigonometry basics', 'Statistics and probability', 'Measurement applications', 'Algebraic manipulation'],
      '11': ['Functions and graphs', 'Exponential relationships', 'Trigonometric equations', 'Univariate data analysis', 'Networks and matrices', 'Probability distributions'],
      '12': ['Differentiation and rates of change', 'Integration and area', 'Binomial distributions', 'Normal distributions', 'Sampling and inference', 'Problem-solving with functions'],
    },
  },
  {
    keywords: ['english', 'literature'],
    topics: {
      '10': ['Analytical paragraph writing', 'Language techniques', 'Theme development', 'Comparative response skills', 'Essay planning', 'Editing for clarity'],
      '11': ['Textual analysis', 'Persuasive techniques', 'Critical response structure', 'Comparative essay planning', 'Evidence selection', 'Draft refinement'],
      '12': ['Extended analytical responses', 'Argument and perspective', 'Exam response structure', 'Unseen text analysis', 'Refining thesis statements', 'Timed writing technique'],
    },
  },
  {
    keywords: ['biology'],
    topics: {
      '10': ['Cells and organ systems', 'Ecosystems', 'Genetics basics', 'Body systems', 'Adaptations', 'Scientific method'],
      '11': ['Cellular processes', 'Biodiversity', 'Homeostasis', 'Genetic inheritance', 'Experimental design', 'Data interpretation'],
      '12': ['DNA and gene expression', 'Evolutionary relationships', 'Biotechnology', 'Immune response', 'Population dynamics', 'Biological data analysis'],
    },
  },
  {
    keywords: ['chemistry'],
    topics: {
      '10': ['Atomic structure', 'Chemical reactions', 'Acids and bases', 'States of matter', 'Stoichiometry basics', 'Lab skills'],
      '11': ['Bonding and intermolecular forces', 'Mole calculations', 'Reaction rates', 'Aqueous solutions', 'Redox concepts', 'Experimental accuracy'],
      '12': ['Equilibrium systems', 'Organic chemistry', 'Acid-base systems', 'Electrochemistry', 'Spectroscopy interpretation', 'Multi-step problem solving'],
    },
  },
  {
    keywords: ['physics'],
    topics: {
      '10': ['Motion and forces', 'Energy transfer', 'Electricity basics', 'Waves', 'Scientific graphs', 'Practical investigations'],
      '11': ['Projectile motion', 'Newtonian mechanics', 'Thermal physics', 'Electric circuits', 'Measurement uncertainty', 'Practical data analysis'],
      '12': ['Circular and gravitational motion', 'Electromagnetism', 'Quantum and nuclear models', 'Wave behaviour', 'Exam calculation method', 'Extended-response explanations'],
    },
  },
  {
    keywords: ['history', 'modern history', 'ancient history'],
    topics: {
      '10': ['Source analysis', 'Cause and effect', 'Historical significance', 'Essay planning', 'Reliability and perspective', 'Short-response structure'],
      '11': ['Source interrogation', 'Historical argument', 'Extended response planning', 'Evidence integration', 'Corroboration', 'Revision of key events'],
      '12': ['Historiography', 'Essay judgement', 'Evidence under timed conditions', 'Source evaluation', 'Argument refinement', 'Comparative historical analysis'],
    },
  },
];

const STUDY_STYLE_ROTATION = [
  'Blurting and self-check',
  'Cornell notes with recall column',
  'Teach-it-back explanation',
  'Timed retrieval and correction',
  'Worked examples then independent practice',
  'Exam-style response rehearsal',
  'Mind map and summary compression',
];

const HOMEWORK_TECHNIQUE_ROTATION = [
  'Finish with a 5-minute recap and write one question to bring to class.',
  'Use spaced repetition at night: revisit the topic for 10 minutes before bed.',
  'Close your notes and explain the concept aloud before checking gaps.',
  'Mark one practice response with the task sheet or rubric language.',
  'Convert weak spots into three flashcards before stopping.',
  'Write one textbook summary paragraph from memory.',
  'Do a final self-quiz and flag anything below 70% confidence.',
];

const AMBIENT_SOUND_OPTIONS = [
  { id: 'rain-library', label: 'Rain Library', description: 'Soft rain with calm room tone', file: '/rain.mp3' },
  { id: 'night-cafe', label: 'Night Cafe', description: 'Low cafe ambience for longer blocks', file: '/Cafe Restaurant Ambience.mp3' },
  { id: 'ocean-breeze', label: 'Ocean Breeze', description: 'Wide soft ambience for reset breaks', file: '/Ocean waves.mp3' },
  { id: 'lofi-focus', label: 'Lo-fi Focus', description: 'Gentle instrumental study texture', file: '/Pure Focus.mp3' },
  { id: 'night-jazz', label: 'Night Jazz', description: 'Aesthetic late-night jazz for slower revision blocks', file: '/Aesthetic Night Jazz.mp3' },
  { id: 'calming', label: 'Calming', description: 'Soft calming loop for quiet review sessions', file: '/Calming.mp3' },
] as const;

const ICE_REWARDS = [
  { id: 'coffee', label: 'Coffee Break', emoji: '☕' },
  { id: 'scroll', label: 'Scroll Time', emoji: '📱' },
  { id: 'game', label: 'Quick Game', emoji: '🎮' },
  { id: 'sweet', label: 'Sweet Treat', emoji: '🍬' },
] as const;

const TIMER_DURATION_OPTIONS = [
  { id: '25', label: '25m', minutes: 25 },
  { id: '45', label: '45m', minutes: 45 },
  { id: '60', label: '60m', minutes: 60 },
  { id: '90', label: '90m', minutes: 90 },
] as const;

const TIMER_REVEAL_OPTIONS = [
  { id: 'ice', label: 'Ice melts' },
  { id: 'stars', label: 'Shooting star' },
  { id: 'glass', label: 'Fill glass' },
  { id: 'shapes', label: '3D shapes' },
] as const;

function MiniRevealPreview({
  revealId,
  progress,
  selectedRewardId,
  sessionComplete,
  sweetVideoUrl,
  iceCubeVideoUrl,
}: {
  revealId: (typeof TIMER_REVEAL_OPTIONS)[number]['id'];
  progress: number;
  selectedRewardId: (typeof ICE_REWARDS)[number]['id'];
  sessionComplete: boolean;
  sweetVideoUrl: string;
  iceCubeVideoUrl: string;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  const selectedReward = ICE_REWARDS.find((reward) => reward.id === selectedRewardId) || ICE_REWARDS[0];

  if (revealId === 'ice') {
    return (
      <div className="relative h-24 overflow-hidden rounded-[22px] border border-white/20 bg-white/10 backdrop-blur-sm">
        {selectedReward.id === 'sweet' && sessionComplete ? (
          <video
            src={sweetVideoUrl}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
            autoPlay
            loop
          />
        ) : (
          <>
            <video
              src={iceCubeVideoUrl}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              autoPlay
              loop
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.38),rgba(191,219,254,0.12))]" />
            <div
              className="absolute inset-x-0 top-0 bg-white/75 backdrop-blur-md transition-all duration-500"
              style={{ height: `${100 - clamped}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-[18px] border border-cyan-100/60 bg-cyan-50/30 px-5 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                <p className="text-3xl">{selectedReward.emoji}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/90">{selectedReward.label}</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (revealId === 'stars') {
    return (
      <div className="relative h-24 overflow-hidden rounded-[22px] border border-white/20 bg-slate-950/65 backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(129,140,248,0.32),transparent_34%),radial-gradient(circle_at_85%_25%,rgba(56,189,248,0.24),transparent_28%)]" />
        <div className="absolute left-4 right-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20">
          <div className="h-full rounded-full bg-amber-300 transition-all duration-500" style={{ width: `${clamped}%` }} />
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 text-2xl transition-all duration-500" style={{ left: `calc(${Math.max(6, Math.min(92, clamped))}% - 12px)` }}>
          ★
        </div>
      </div>
    );
  }

  if (revealId === 'glass') {
    return (
      <div className="relative h-24 overflow-hidden rounded-[22px] border border-white/20 bg-emerald-950/30 backdrop-blur-sm">
        <div className="absolute left-1/2 top-3 h-16 w-14 -translate-x-1/2 rounded-b-[18px] rounded-t-[10px] border-4 border-white/60" />
        <div
          className="absolute bottom-3 left-1/2 w-12 -translate-x-1/2 rounded-b-[12px] bg-cyan-300/70 transition-all duration-500"
          style={{ height: `${Math.max(10, (clamped / 100) * 52)}px` }}
        />
      </div>
    );
  }

  return (
    <div className="relative h-24 overflow-hidden rounded-[22px] border border-white/20 bg-zinc-950/55 backdrop-blur-sm">
      <div className="absolute inset-0 grid grid-cols-4 gap-2 p-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="relative rounded-xl bg-white/5">
            <div
              className={cn(
                "absolute bottom-0 left-1/2 w-8 -translate-x-1/2 rounded-t-xl transition-all duration-500",
                index % 2 === 0 ? 'bg-fuchsia-400/75' : 'bg-cyan-400/75'
              )}
              style={{ height: `${Math.max(8, (clamped / 100) * (18 + index * 8))}px` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeSubject(subject: string) {
  return subject.trim().toLowerCase();
}

function getQcaaTopicSuggestions(subject: string, yearLevel: ExamPlan['yearLevel']) {
  const normalized = normalizeSubject(subject);
  const matched = SUBJECT_TOPIC_LIBRARY.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (matched) {
    return matched.topics[yearLevel];
  }

  const fallbackSubject = subject.trim() || 'this subject';
  return [
    `${fallbackSubject} core concepts`,
    `${fallbackSubject} key terminology`,
    `${fallbackSubject} problem-solving methods`,
    `${fallbackSubject} exam response structure`,
    `${fallbackSubject} practice questions`,
    `${fallbackSubject} weak-area revision`,
  ];
}

function buildWeeklySchedule(plan: ExamPlan): NonNullable<ExamPlan['studySchedule']> {
  const rankedTopics = [...plan.topics].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return a.confidence - b.confidence;
  });

  const fallbackTopics = getQcaaTopicSuggestions(plan.subject, plan.yearLevel).map((name) => ({
    id: crypto.randomUUID(),
    name,
    confidence: 0,
    completed: false,
    source: 'qcaa' as const,
  }));

  const topics = rankedTopics.length > 0 ? rankedTopics : fallbackTopics;

  return WEEKDAY_LABELS.map((day, index) => {
    const primaryTopic = topics[index % topics.length];
    const secondaryTopic = topics[(index + 1) % topics.length];
    const focusTopics =
      topics.length > 1 && index % 2 === 0 && secondaryTopic.id !== primaryTopic.id
        ? [primaryTopic, secondaryTopic]
        : [primaryTopic];

    const studyStyle = STUDY_STYLE_ROTATION[index % STUDY_STYLE_ROTATION.length];
    const homeworkTechnique = HOMEWORK_TECHNIQUE_ROTATION[index % HOMEWORK_TECHNIQUE_ROTATION.length];
    const estimatedMinutes = index < 5 ? 75 : 90;

    return {
      id: crypto.randomUUID(),
      day,
      title: `${day} attack plan`,
      objective: `Move ${focusTopics.map((topic) => topic.name).join(' and ')} forward with one active recall block and one exam-style task.`,
      focusTopicIds: focusTopics.map((topic) => topic.id),
      focusTopicNames: focusTopics.map((topic) => topic.name),
      studyStyle,
      homeworkTechnique,
      textbookTask: `Complete one textbook or worksheet set for ${focusTopics[0].name} and mark corrections before the session ends.`,
      estimatedMinutes,
      methods: [
        {
          id: crypto.randomUUID(),
          title: 'Flashcards',
          description: `Build or review 8-12 flashcards for ${focusTopics[0].name}.`,
          type: 'flashcards',
        },
        {
          id: crypto.randomUUID(),
          title: 'Practice questions',
          description: `Do short-answer or worked examples focused on ${focusTopics[0].name}.`,
          type: 'practice',
        },
        {
          id: crypto.randomUUID(),
          title: 'Homework technique',
          description: homeworkTechnique,
          type: 'homework',
        },
      ],
      checklist: [
        {
          id: crypto.randomUUID(),
          text: `Review notes for ${focusTopics[0].name} and highlight weak spots.`,
          completed: false,
        },
        {
          id: crypto.randomUUID(),
          text: `Complete one active study block using ${studyStyle.toLowerCase()}.`,
          completed: false,
        },
        {
          id: crypto.randomUUID(),
          text: `Finish with one exam-style check or textbook task.`,
          completed: false,
        },
      ],
    };
  });
}

function topicExists(topics: ExamPlan['topics'], topicName: string) {
  return topics.some((topic) => topic.name.trim().toLowerCase() === topicName.trim().toLowerCase());
}

function buildYoutubeRecommendations(subject: string, topicNames: string[]) {
  const uniqueTopics = Array.from(new Set(topicNames.filter(Boolean)));
  const leadTopic = uniqueTopics[0] || `${subject} revision`;
  const scopedTopic = `${subject} ${leadTopic}`.trim();

  return [
    {
      id: 'concept-walkthrough',
      label: 'Concept walkthrough',
      provider: 'Khan Academy',
      query: `${scopedTopic} Khan Academy`,
      description: `Start with a clear explanation of ${leadTopic.toLowerCase()} before doing questions.`,
    },
    {
      id: 'exam-questions',
      label: 'Exam questions',
      provider: 'Cognito',
      query: `${scopedTopic} exam questions Cognito`,
      description: `Watch how the topic is worked through under exam conditions and compare methods.`,
    },
    {
      id: 'quick-recap',
      label: 'Quick recap',
      provider: 'CrashCourse',
      query: `${scopedTopic} quick revision CrashCourse`,
      description: `Use a short recap video when you need the big picture again after study blocks.`,
    },
  ].map((item) => ({
    ...item,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.query)}`,
  }));
}

export default function ExamPlanner({ onBack }: ExamPlannerProps) {
  const { isPhone, isTablet } = useResponsiveDevice();
  const [plans, setPlans] = useState<ExamPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  // Timer State
  const [focusTimer, setFocusTimer] = useState<FocusTimerState>(() => getFocusTimerState());
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedScheduleDayId, setSelectedScheduleDayId] = useState<string | null>(null);
  const [selectedAmbientId, setSelectedAmbientId] = useState<(typeof AMBIENT_SOUND_OPTIONS)[number]['id']>('rain-library');
  const [selectedWallpaperId, setSelectedWallpaperId] = useState(BACKGROUND_PRESETS[0]?.id || 'neon-soft-pillars');
  const [selectedRevealId, setSelectedRevealId] = useState<(typeof TIMER_REVEAL_OPTIONS)[number]['id']>('ice');
  const [selectedRewardId, setSelectedRewardId] = useState<(typeof ICE_REWARDS)[number]['id']>('coffee');
  const [customTimerMinutes, setCustomTimerMinutes] = useState('25');
  const [timerCompletionHandled, setTimerCompletionHandled] = useState(false);
  const [showAmbientMenu, setShowAmbientMenu] = useState(false);
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const [playingAmbientId, setPlayingAmbientId] = useState<(typeof AMBIENT_SOUND_OPTIONS)[number]['id'] | null>(null);
  const [hasChosenAmbient, setHasChosenAmbient] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [interactiveIndex, setInteractiveIndex] = useState(0);
  const [interactiveStarted, setInteractiveStarted] = useState(false);
  const [interactiveCompleted, setInteractiveCompleted] = useState(false);
  const sweetVideoUrl = '/rewards/icemeltingsweettreat.mp4';
  const iceCubeVideoUrl = '/rewards/icecube.mp4';

  // Timetable integration
  const [timetableSubjects, setTimetableSubjects] = useState<string[]>([]);

  const activePlan = useMemo(() => 
    plans.find(p => p.id === activePlanId) || null
  , [plans, activePlanId]);

  const [newResource, setNewResource] = useState({
    title: '',
    url: '',
    type: 'read' as 'read' | 'watch' | 'practice'
  });

  const [taskInput, setTaskInput] = useState('');
  const [topicInput, setTopicInput] = useState('');

  const selectedScheduleDay = useMemo(
    () => activePlan?.studySchedule?.find((day) => day.id === selectedScheduleDayId) || activePlan?.studySchedule?.[0] || null,
    [activePlan?.studySchedule, selectedScheduleDayId]
  );
  const currentWeekdayLabel = useMemo(
    () => new Intl.DateTimeFormat('en-AU', { weekday: 'long' }).format(new Date()),
    []
  );

  const totalFocusMinutes = activePlan?.focusSessions?.reduce((acc, session) => acc + session.duration, 0) || 0;
  const weeklyGoalHours = 12;
  const studyPulsePercent = Math.min(100, Math.round((totalFocusMinutes / 60 / weeklyGoalHours) * 100));
  const totalScheduleChecklistItems = activePlan?.studySchedule?.reduce((acc, day) => acc + day.checklist.length, 0) || 0;
  const completedScheduleChecklistItems =
    activePlan?.studySchedule?.reduce((acc, day) => acc + day.checklist.filter((item) => item.completed).length, 0) || 0;
  const selectedAmbient = AMBIENT_SOUND_OPTIONS.find((option) => option.id === selectedAmbientId) || AMBIENT_SOUND_OPTIONS[0];
  const selectedWallpaper = BACKGROUND_PRESETS.find((preset) => preset.id === selectedWallpaperId) || BACKGROUND_PRESETS[0];
  const studyTimerMinutes = Math.max(1, Number(customTimerMinutes) || 25);
  const timerActive = focusTimer.active;
  const timeLeft = focusTimer.remainingSeconds;
  const timerMode = focusTimer.mode;
  const sessionComplete = focusTimer.completedSessionId === focusTimer.sessionId && timeLeft === 0;
  const timerProgress = useMemo(() => {
    const total = timerMode === 'study' ? studyTimerMinutes * 60 : 5 * 60;
    return ((total - timeLeft) / total) * 100;
  }, [timeLeft, timerMode, studyTimerMinutes]);
  const studyGoals = useMemo(() => {
    if (!selectedScheduleDay) return [];

    return [
      `Finish ${selectedScheduleDay.focusTopicNames.length} focus ${selectedScheduleDay.focusTopicNames.length === 1 ? 'topic' : 'topics'} for ${activePlan?.subject || 'this study block'}.`,
      `Complete ${selectedScheduleDay.methods.length + 2} guided action ${selectedScheduleDay.methods.length + 2 === 1 ? 'card' : 'cards'} before the checklist.`,
      `Tick off all ${selectedScheduleDay.checklist.length} checklist ${selectedScheduleDay.checklist.length === 1 ? 'goal' : 'goals'} to close the session cleanly.`,
    ];
  }, [selectedScheduleDay, activePlan?.subject]);
  const interactiveSteps = useMemo(() => {
    if (!selectedScheduleDay) return [];

    return [
      {
        id: 'study-goals',
        badge: 'Start here',
        eyebrow: 'Study goals',
        title: 'Know what this study block is trying to achieve',
        render: (
          <div className="space-y-3">
            {studyGoals.map((goal, index) => (
              <div
                key={goal}
                className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-4"
              >
                <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white">
                  {index + 1}
                </div>
                <p className="text-sm font-bold leading-6 text-zinc-700">{goal}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: 'focus-topics',
        badge: 'Start 1',
        eyebrow: 'Focus topics',
        title: 'Lock in the topics first',
        render: (
          <div className="flex flex-wrap gap-2">
            {selectedScheduleDay.focusTopicNames.map((topicName) => (
              <span key={topicName} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-700">
                {topicName}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: 'homework-technique',
        badge: 'Start 2',
        eyebrow: 'Homework technique',
        title: 'Use this finishing method',
        render: <p className="text-base leading-8 text-zinc-700">{selectedScheduleDay.homeworkTechnique}</p>,
      },
      {
        id: 'textbook-task',
        badge: 'Start 3',
        eyebrow: 'Textbook task',
        title: 'Complete the textbook block',
        render: <p className="text-base leading-8 text-zinc-700">{selectedScheduleDay.textbookTask}</p>,
      },
      ...selectedScheduleDay.methods.map((method, index) => ({
        id: method.id,
        badge: `Start ${index + 4}`,
        eyebrow: method.type,
        title: method.title,
        render: <p className="text-base leading-8 text-zinc-700">{method.description}</p>,
      })),
      {
        id: 'checklist',
        badge: 'Finish here',
        eyebrow: 'Checklist',
        title: 'Close out the study block',
        render: (
          <div className="space-y-3">
            {selectedScheduleDay.checklist.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleScheduleChecklist(selectedScheduleDay.id, item.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white bg-white px-4 py-4 text-left"
              >
                {item.completed ? (
                  <CheckCircle2 size={18} className="text-emerald-500" />
                ) : (
                  <Circle size={18} className="text-zinc-300" />
                )}
                <span className={cn('text-sm font-bold text-zinc-700', item.completed && 'text-zinc-400 line-through')}>
                  {item.text}
                </span>
              </button>
            ))}
          </div>
        ),
      },
    ];
  }, [selectedScheduleDay, studyGoals]);

  useEffect(() => {
    if (!activePlan?.studySchedule?.length) {
      setSelectedScheduleDayId(null);
      return;
    }

    const stillExists = activePlan.studySchedule.some((day) => day.id === selectedScheduleDayId);
    if (!selectedScheduleDayId || !stillExists) {
      setSelectedScheduleDayId(activePlan.studySchedule[0].id);
    }
  }, [activePlan?.studySchedule, selectedScheduleDayId]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Fetch timetable subjects for preloading
    const fetchTimetable = async () => {
      const docRef = doc(db, 'timetables', auth.currentUser!.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const entries = docSnap.data().entries || [];
        const subjects = Array.from(new Set(entries.map((e: any) => e.subject))) as string[];
        setTimetableSubjects(subjects);
      }
    };
    fetchTimetable();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeFocusTimer((state) => {
      setFocusTimer(state);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setInteractiveIndex(0);
    setInteractiveStarted(false);
    setInteractiveCompleted(false);
  }, [selectedScheduleDayId]);

  useEffect(() => {
    return () => {
      const currentAmbient = (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio;
      if (currentAmbient) {
        currentAmbient.pause();
        currentAmbient.currentTime = 0;
        delete (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio;
        setPlayingAmbientId(null);
      }
    };
  }, []);

  useEffect(() => {
    if (sessionComplete && !timerCompletionHandled) {
      setTimerCompletionHandled(true);
      stopGlobalAmbientAudio();
      setPlayingAmbientId(null);
      if (timerMode === 'study' && activePlan) {
        logFocusSession(studyTimerMinutes);
      }
    }
  }, [sessionComplete, timerCompletionHandled, timerMode, activePlan, studyTimerMinutes]);

  const stopAmbientSound = () => {
    if (typeof window === 'undefined') return;
    const currentAmbient = (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio;
    if (currentAmbient) {
      currentAmbient.pause();
      currentAmbient.currentTime = 0;
      delete (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio;
    }
    setPlayingAmbientId(null);
  };

  const playAmbientSound = async (ambientId: (typeof AMBIENT_SOUND_OPTIONS)[number]['id']) => {
    stopAmbientSound();
    if (typeof window === 'undefined') return;
    const selectedOption = AMBIENT_SOUND_OPTIONS.find((option) => option.id === ambientId);
    if (!selectedOption) return;

    const ambientAudio = new Audio(selectedOption.file);
    ambientAudio.loop = true;
    ambientAudio.preload = 'auto';
    ambientAudio.volume = 0.4;

    try {
      await ambientAudio.play();
      (window as typeof window & { __edurevAmbientAudio?: HTMLAudioElement }).__edurevAmbientAudio = ambientAudio;
      setPlayingAmbientId(ambientId);
    } catch (error) {
      console.error('Ambient audio playback error:', error);
    }
  };

  const syncTimerConfiguration = (mode: 'study' | 'break', totalSeconds: number) => {
    configureFocusTimer({ mode, totalSeconds });
    setTimerCompletionHandled(false);
    setFocusTimer(getFocusTimerState());
  };

  const playDayCompleteConfetti = () => {
    if (typeof window === 'undefined') return;

    import('canvas-confetti').then((module) => {
      const confetti = module.default || module;
      if (typeof confetti === 'function') {
        try {
          confetti({
            particleCount: 110,
            spread: 72,
            startVelocity: 32,
            ticks: 220,
            origin: { y: 0.62 },
            colors: ['#22c55e', '#86efac', '#facc15', '#ffffff'],
          });
        } catch (error) {
          console.error('Confetti error:', error);
        }
      }
    });
  };

  const logFocusSession = async (duration: number) => {
    if (!activePlan) return;
    const newSession = {
      id: crypto.randomUUID(),
      duration,
      date: new Date().toISOString(),
      topicId: selectedTopicId || undefined
    };
    const sessions = [...(activePlan.focusSessions || []), newSession];
    updatePlan({ focusSessions: sessions });
  };

  // New Plan Form
  const [newPlanData, setNewPlanData] = useState({
    title: '',
    subject: '',
    yearLevel: '10' as '10' | '11' | '12',
    examDate: ''
  });

  const fetchPlans = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const q = query(
        collection(db, 'examPlans'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExamPlan[];
      setPlans(list);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'examPlans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setIsCreating(true);
    try {
      const initialSteps = EXAM_STEPS.map(step => ({
        id: step.id,
        title: step.title,
        tasks: [],
        completed: false
      }));

      const examPlanRef = doc(collection(db, 'examPlans'));
      const deadlineRef = doc(collection(db, 'deadlines'));
      const batch = writeBatch(db);

      batch.set(examPlanRef, {
        userId: user.uid,
        ...newPlanData,
        topics: [],
        studySchedule: [],
        currentStep: 1,
        steps: initialSteps,
        resources: [],
        focusSessions: [],
        deadlineId: deadlineRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.set(deadlineRef, {
        userId: user.uid,
        title: newPlanData.title,
        course: newPlanData.subject,
        dueDate: new Date(newPlanData.examDate),
        type: 'exam',
        priority: 'medium',
        completed: false,
        examPlanId: examPlanRef.id,
        createdAt: serverTimestamp()
      });

      await batch.commit();

      await fetchPlans();
      setShowCreateModal(false);
      setNewPlanData({ title: '', subject: '', yearLevel: '10', examDate: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'examPlans');
    } finally {
      setIsCreating(false);
    }
  };

  const generateStudyTasks = async () => {
    if (!activePlan) return;
    
    setIsGeneratingAI(true);
    try {
      const topicsList = activePlan.topics.map(t => t.name).join(', ');
      
      const prompt = `Create a comprehensive study roadmap for an exam titled "${activePlan.title}" in the subject "${activePlan.subject}" for Year ${activePlan.yearLevel} (Queensland Education QCAA standards), scheduled for ${activePlan.examDate}.
      The study plan should focus on these topics: ${topicsList || 'General subject review'}.
      
      Suggest specific topics, resources, and tools (flashcards, quizlets, practice exams based on QCAA mock exams).
      
      The roadmap should follow these phases:
      1. Topic Mapping (Identifying weak areas)
      2. Resource Hub (Gathering materials)
      3. Active Revision (Active recall, flashcards)
      4. Mock Exams (Practice papers)
      5. Final Polish (Final review)
      
      For each phase, provide 3-5 specific, actionable study tasks.
      Each task should have:
      - text: the task description
      - priority: "low", "medium", or "high"
      - estimatedTime: e.g., "45m", "1h", "2h"
      - dueDate: a suggested date (YYYY-MM-DD) before the exam date.
      
      Return the result as a JSON object with keys: "phase1", "phase2", "phase3", "phase4", "phase5".
      Each key should map to an array of objects with "text", "priority", "estimatedTime", and "dueDate" keys.`;

      const fullPlan = await getOrCreateCachedAiResult<Record<string, Array<{ text: string; priority: string; estimatedTime: string; dueDate: string }>>>(
        {
          scope: 'exam-planner-study-plan',
          input: {
            planId: activePlan.id,
            title: activePlan.title,
            subject: activePlan.subject,
            yearLevel: activePlan.yearLevel,
            examDate: activePlan.examDate,
            topics: activePlan.topics.map((topic) => topic.name),
          },
        },
        async () => {
          const response = await geminiGenerateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  phase1: { type: "array", items: { type: "object", properties: { text: { type: "string" }, priority: { type: "string" }, estimatedTime: { type: "string" }, dueDate: { type: "string" } } } },
                  phase2: { type: "array", items: { type: "object", properties: { text: { type: "string" }, priority: { type: "string" }, estimatedTime: { type: "string" }, dueDate: { type: "string" } } } },
                  phase3: { type: "array", items: { type: "object", properties: { text: { type: "string" }, priority: { type: "string" }, estimatedTime: { type: "string" }, dueDate: { type: "string" } } } },
                  phase4: { type: "array", items: { type: "object", properties: { text: { type: "string" }, priority: { type: "string" }, estimatedTime: { type: "string" }, dueDate: { type: "string" } } } },
                  phase5: { type: "array", items: { type: "object", properties: { text: { type: "string" }, priority: { type: "string" }, estimatedTime: { type: "string" }, dueDate: { type: "string" } } } },
                }
              }
            }
          });

          return JSON.parse(response.text || "{}");
        },
      );
      const newSteps = activePlan.steps.map(step => {
        let tasksToAdd: any[] = [];
        if (step.id === 1) tasksToAdd = fullPlan.phase1 || [];
        if (step.id === 2) tasksToAdd = fullPlan.phase2 || [];
        if (step.id === 3) tasksToAdd = fullPlan.phase3 || [];
        if (step.id === 4) tasksToAdd = fullPlan.phase4 || [];
        if (step.id === 5) tasksToAdd = fullPlan.phase5 || [];
        
        return {
          ...step,
          tasks: [
            ...step.tasks,
            ...tasksToAdd.map(t => ({
              id: crypto.randomUUID(),
              text: t.text,
              priority: t.priority as "low" | "medium" | "high",
              estimatedTime: t.estimatedTime,
              dueDate: t.dueDate,
              completed: false
            }))
          ]
        };
      });

      updatePlan({ steps: newSteps });
    } catch (error) {
      console.error('Error generating study tasks:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateFlashcards = async () => {
    if (!activePlan) return;
    setIsGeneratingFlashcards(true);
    try {
      const topicsList = activePlan.topics.map(t => t.name).join(', ');
      
      const prompt = `Generate 10 high-quality flashcards for the exam "${activePlan.title}" in "${activePlan.subject}".
      Focus on these topics: ${topicsList || 'General subject review'}.
      
      Return the result as a JSON object with a "cards" key mapping to an array of objects with "term" and "definition" keys.`;

      const result = await getOrCreateCachedAiResult<{ cards?: Array<{ term: string; definition: string }> }>(
        {
          scope: 'exam-planner-flashcards',
          input: {
            planId: activePlan.id,
            title: activePlan.title,
            subject: activePlan.subject,
            topics: activePlan.topics.map((topic) => topic.name),
          },
        },
        async () => {
          const response = await geminiGenerateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  cards: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        term: { type: "string" },
                        definition: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          });

          return JSON.parse(response.text || "{}");
        },
      );
      // For now, we'll add them as a special task or just alert the user.
      // Ideally, we'd save them to a new FlashcardSet.
      if (result.cards) {
        const flashcardSet = {
          userId: auth.currentUser!.uid,
          title: `${activePlan.title} - AI Generated`,
          description: `Generated for ${activePlan.subject} exam preparation.`,
          cards: result.cards,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'flashcardSets'), flashcardSet);
        alert("AI Flashcards generated and saved to your Flashcard Hub!");
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const generateQcaaTopics = async () => {
    if (!activePlan) return;

    setIsGeneratingTopics(true);
    try {
      const suggestedTopics = getQcaaTopicSuggestions(activePlan.subject, activePlan.yearLevel);
      const existing = new Set(activePlan.topics.map((topic) => topic.name.trim().toLowerCase()));
      const generatedTopics = suggestedTopics
        .filter((topicName) => !existing.has(topicName.trim().toLowerCase()))
        .map((topicName) => ({
          id: crypto.randomUUID(),
          name: topicName,
          confidence: 0,
          completed: false,
          source: 'qcaa' as const,
        }));

      if (generatedTopics.length === 0) return;

      await updatePlan({ topics: [...activePlan.topics, ...generatedTopics] });
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  const generateStudySchedule = async () => {
    if (!activePlan) return;

    setIsGeneratingSchedule(true);
    try {
      const schedule = buildWeeklySchedule(activePlan);
      setSelectedScheduleDayId(schedule[0]?.id || null);
      await updatePlan({ studySchedule: schedule });
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const toggleScheduleChecklist = (dayId: string, checklistId: string) => {
    if (!activePlan?.studySchedule) return;

    const previousDay = activePlan.studySchedule.find((day) => day.id === dayId);
    const wasDone = !!previousDay && previousDay.checklist.length > 0 && previousDay.checklist.every((item) => item.completed);

    const studySchedule = activePlan.studySchedule.map((day) =>
      day.id === dayId
        ? {
            ...day,
            checklist: day.checklist.map((item) =>
              item.id === checklistId ? { ...item, completed: !item.completed } : item
            ),
          }
        : day
    );

    const updatedDay = studySchedule.find((day) => day.id === dayId);
    const isNowDone = !!updatedDay && updatedDay.checklist.length > 0 && updatedDay.checklist.every((item) => item.completed);

    if (!wasDone && isNowDone) {
      playDayCompleteConfetti();
    }

    updatePlan({ studySchedule });
  };

  const addMockExam = (exam: { score: number; total: number; duration: number; notes?: string }) => {
    if (!activePlan) return;
    const newMock = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      ...exam
    };
    const mockExams = [...(activePlan.mockExams || []), newMock];
    updatePlan({ mockExams });
  };

  const optimizePlanBasedOnConfidence = () => {
    if (!activePlan) return;
    
    const weakTopics = activePlan.topics.filter(t => t.confidence < 60);
    if (weakTopics.length === 0) {
      alert("Great job! You seem confident in all topics.");
      return;
    }

    const newTasks = weakTopics.map(t => ({
      id: crypto.randomUUID(),
      text: `Review topic: ${t.name} (Confidence: ${t.confidence}%)`,
      completed: false,
      priority: 'high' as const
    }));

    const newSteps = activePlan.steps.map(step => {
      if (step.id === 3) {
        return {
          ...step,
          tasks: [...step.tasks, ...newTasks]
        };
      }
      return step;
    });

    updatePlan({ steps: newSteps });
    alert(`Added ${newTasks.length} review tasks to Active Revision based on your confidence ratings.`);
  };

  const addTask = (stepId: number, text: string) => {
    if (!activePlan || !text.trim()) return;
    const newSteps = activePlan.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          tasks: [
            ...step.tasks,
            { id: crypto.randomUUID(), text, completed: false, priority: 'medium' as const }
          ]
        };
      }
      return step;
    });
    updatePlan({ steps: newSteps });
  };

  const toggleTask = (stepId: number, taskId: string) => {
    if (!activePlan) return;
    const newSteps = activePlan.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          tasks: step.tasks.map(task => 
            task.id === taskId ? { ...task, completed: !task.completed } : task
          )
        };
      }
      return step;
    });
    updatePlan({ steps: newSteps });
  };

  const deleteTask = (stepId: number, taskId: string) => {
    if (!activePlan) return;
    const newSteps = activePlan.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          tasks: step.tasks.filter(task => task.id !== taskId)
        };
      }
      return step;
    });
    updatePlan({ steps: newSteps });
  };

  const addResource = (resource: typeof newResource) => {
    if (!activePlan || !resource.title || !resource.url) return;
    const resources = [...(activePlan.resources || []), { ...resource, id: crypto.randomUUID() }];
    updatePlan({ resources });
    setNewResource({ title: '', url: '', type: 'read' });
  };

  const deleteResource = (id: string) => {
    if (!activePlan) return;
    const resources = activePlan.resources?.filter(r => r.id !== id) || [];
    updatePlan({ resources });
  };

  const updatePlan = async (updates: Partial<ExamPlan>) => {
    if (!activePlan) return;

    // Optimistically update local state
    setPlans(prevPlans => prevPlans.map(p => 
      p.id === activePlan.id ? { ...p, ...updates } : p
    ));

    try {
      await updateDoc(doc(db, 'examPlans', activePlan.id), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `examPlans/${activePlan.id}`);
      // Revert on error
      fetchPlans();
    }
  };

  const addTopic = (name: string) => {
    if (!activePlan || !name.trim()) return;
    const cleanedName = name.trim();
    const exists = topicExists(activePlan.topics, cleanedName);
    if (exists) return;
    const newTopics = [
      ...activePlan.topics,
      { id: crypto.randomUUID(), name: cleanedName, confidence: 0, completed: false, source: 'manual' as const }
    ];
    updatePlan({ topics: newTopics });
  };

  const updateTopic = (topicId: string, updates: Partial<ExamPlan['topics'][0]>) => {
    if (!activePlan) return;
    const newTopics = activePlan.topics.map(topic => 
      topic.id === topicId ? { ...topic, ...updates } : topic
    );
    updatePlan({ topics: newTopics });
  };

  const deleteTopic = (topicId: string) => {
    if (!activePlan) return;
    const newTopics = activePlan.topics.filter(topic => topic.id !== topicId);
    updatePlan({ topics: newTopics });
  };

  const addSuggestedTopic = (topicName: string) => {
    if (!activePlan || topicExists(activePlan.topics, topicName)) return;
    const newTopics = [
      ...activePlan.topics,
      { id: crypto.randomUUID(), name: topicName.trim(), confidence: 0, completed: false, source: 'qcaa' as const }
    ];
    updatePlan({ topics: newTopics });
  };

  const deletePlan = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'examPlans', id));
      if (activePlanId === id) setActivePlanId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `examPlans/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-6xl", isPhone ? "p-4" : isTablet ? "p-6" : "p-8")}>
      <AnimatePresence mode="wait">
        {!activePlan ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(isPhone ? "space-y-5" : "space-y-8")}
          >
            <div className={cn("flex items-center justify-between", isPhone && "flex-col items-start gap-4")}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Exam hub</p>
                <h2 className="mt-2 text-3xl font-black text-zinc-900">Exam plans</h2>
              </div>
              <div className={cn("flex items-center gap-3", isPhone && "w-full")}>
                <button
                  onClick={onBack}
                  className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-black text-zinc-600 transition hover:bg-zinc-50", isPhone && "flex-1")}
                >
                  <ArrowLeft size={18} /> Back to Hub
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 text-sm font-black text-white transition hover:bg-purple-700 shadow-lg shadow-purple-100", isPhone && "flex-1")}
                >
                  <Plus size={18} /> New Exam Plan
                </button>
              </div>
            </div>

            <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3", !isPhone && "gap-6")}>
            {plans.map((plan) => (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                onClick={() => setActivePlanId(plan.id)}
                className="bg-white p-8 rounded-[32px] border border-zinc-200 shadow-sm text-left group relative cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActivePlanId(plan.id);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                    <GraduationCap size={24} />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deletePlan(plan.id); }}
                    className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2 truncate">{plan.title}</h3>
                <p className="text-zinc-500 text-sm font-bold mb-6">{plan.subject}</p>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <span>Mastery</span>
                    <span>{plan.topics.filter(t => t.completed).length}/{plan.topics.length} Topics</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-500"
                      style={{ 
                        width: `${plan.topics.length > 0 
                          ? (plan.topics.filter(t => t.completed).length / plan.topics.length) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}

            {plans.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="text-zinc-200" size={40} />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">No Exam Plans</h3>
                <p className="text-zinc-500">Map out your study topics and track your progress.</p>
              </div>
            )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(isPhone ? "space-y-5" : "space-y-8")}
          >
            {/* Header */}
            <div className={cn("flex flex-col gap-6 bg-white border border-zinc-200 shadow-sm md:flex-row md:items-center md:justify-between", isPhone ? "rounded-[28px] p-5" : "rounded-[40px] p-8")}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <button onClick={() => setActivePlanId(null)} className="p-2 hover:bg-zinc-100 rounded-xl transition-colors">
                    <ChevronLeft size={20} className="text-zinc-400" />
                  </button>
                  <h2 className="text-3xl font-black text-zinc-900">{activePlan.title}</h2>
                </div>
                <p className="text-zinc-500 font-bold ml-12">{activePlan.subject} • Exam on {new Date(activePlan.examDate).toLocaleDateString()}</p>
              </div>

              <div className={cn("flex items-center gap-4 self-start md:self-auto", isPhone && "w-full flex-col items-stretch")}>
                <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Study Pulse</p>
                  <p className="text-2xl font-black text-zinc-900">{studyPulsePercent}%</p>
                  <p className="text-xs font-bold text-zinc-500">{Math.round(totalFocusMinutes / 60)}h of {weeklyGoalHours}h</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Overall Mastery</p>
                    <p className="text-2xl font-black text-purple-600">
                      {activePlan.topics.length > 0 
                        ? Math.round((activePlan.topics.filter(t => t.completed).length / activePlan.topics.length) * 100) 
                        : 0}%
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                    <TrendingUp size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div className={cn(
              isPhone
                ? "flex gap-3 overflow-x-auto pb-2"
                : "grid grid-cols-5 gap-4"
            )}>
              {EXAM_STEPS.map((step) => {
                const isActive = activePlan.currentStep === step.id;
                const isCompleted = activePlan.currentStep > step.id;
                const Icon = step.icon;
                
                return (
                  <button
                    key={step.id}
                    onClick={() => updatePlan({ currentStep: step.id })}
                    className={cn(
                      "relative flex flex-col items-center rounded-3xl border transition-all",
                      isPhone ? "min-w-[150px] shrink-0 p-4" : "p-6",
                      isActive 
                        ? "bg-purple-600 border-purple-600 text-white shadow-xl shadow-purple-100" 
                        : isCompleted
                          ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                          : "bg-white border-zinc-200 text-zinc-400 hover:border-purple-200"
                    )}
                  >
                    <Icon size={24} className="mb-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest mb-1">Step {step.id}</span>
                    <span className="text-xs font-bold text-center leading-tight">{step.title}</span>
                    {isCompleted && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle2 size={14} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className={cn("grid grid-cols-1 gap-5 lg:gap-8", activePlan.currentStep === 2 ? "xl:grid-cols-1" : "lg:grid-cols-3")}>
              {/* Main Content */}
              <div className={cn("space-y-8", activePlan.currentStep === 2 ? "xl:col-span-1" : "lg:col-span-2")}>
                {activePlan.currentStep === 1 ? (
                  <div className={cn("bg-white border border-zinc-200 shadow-sm min-h-[400px]", isPhone ? "rounded-[28px] p-5" : "rounded-[40px] p-8")}>
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-black text-zinc-900">Topic Mapping</h3>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                        <Target size={14} />
                        Identify Weak Areas
                      </div>
                    </div>

                    <div className={cn("mb-8 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]", !isPhone && "gap-6")}>
                      <div className="rounded-[32px] border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-purple-50/40 p-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="rounded-2xl bg-purple-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">
                            QCAA Topic List
                          </div>
                          <p className="text-sm font-bold text-zinc-500">
                            Generate a syllabus-based list for Year {activePlan.yearLevel} {activePlan.subject}.
                          </p>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-zinc-600">
                          This gives the student a clean topic list to work through first. They can still add their own topics manually underneath.
                        </p>
                        <button
                          onClick={generateQcaaTopics}
                          disabled={isGeneratingTopics}
                          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 text-sm font-black text-white transition hover:bg-purple-700 disabled:opacity-60"
                        >
                          {isGeneratingTopics ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                          {isGeneratingTopics ? 'Generating topics...' : 'Generate Topic List'}
                        </button>
                      </div>

                      <div className="rounded-[32px] border border-zinc-200 bg-zinc-50 p-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Suggested focus</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {getQcaaTopicSuggestions(activePlan.subject, activePlan.yearLevel).slice(0, 6).map((topic) => {
                            const added = topicExists(activePlan.topics, topic);
                            return (
                            <button
                              key={topic}
                              type="button"
                              onClick={() => addSuggestedTopic(topic)}
                              disabled={added}
                              className={cn(
                                "rounded-full border px-3 py-2 text-xs font-bold transition",
                                added
                                  ? "border-purple-200 bg-purple-50 text-purple-600"
                                  : "border-zinc-200 bg-white text-zinc-600 hover:border-purple-200 hover:text-purple-600"
                              )}
                            >
                              {topic} {added ? 'Added' : '+'}
                            </button>
                          )})}
                        </div>
                        <p className="mt-4 text-xs font-bold text-zinc-500">
                          Tap any suggestion to add it straight into the topic list.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 mb-8">
                      <input
                        type="text"
                        value={topicInput}
                        placeholder="Add a study topic manually..."
                        onChange={(e) => setTopicInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addTopic(topicInput);
                            setTopicInput('');
                          }
                        }}
                        className="flex-1 px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                      />
                      <button
                        onClick={() => {
                          addTopic(topicInput);
                          setTopicInput('');
                        }}
                        className="px-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                      >
                        Add Topic
                      </button>
                    </div>

                    <div className="rounded-[32px] border border-zinc-200 bg-white p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Topic list</p>
                          <h4 className="mt-2 text-lg font-black text-zinc-900">Topics included in the planner</h4>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-600">
                          {activePlan.topics.length} topics
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        {activePlan.topics.map((topic) => (
                          <div
                            key={topic.id}
                            className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 transition-all"
                          >
                            <span className="font-bold">{topic.name}</span>
                            <span className={cn(
                              'rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em]',
                              topic.source === 'qcaa' ? 'bg-purple-50 text-purple-600' : 'bg-white text-zinc-500'
                            )}>
                              {topic.source === 'qcaa' ? 'QCAA' : 'Manual'}
                            </span>
                            <button
                              onClick={() => deleteTopic(topic.id)}
                              className="p-1 text-zinc-400 hover:text-red-500 transition-all"
                              aria-label={`Delete ${topic.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}

                        {activePlan.topics.length === 0 && (
                          <p className="py-6 text-sm font-medium text-zinc-400">No topics added yet. Start by listing what you need to study.</p>
                        )}
                      </div>

                      <p className="mt-5 text-xs font-bold text-zinc-500">
                        All topics listed here are included in the planner.
                      </p>
                    </div>

                    <div className="mt-6 rounded-[32px] border border-zinc-200 bg-zinc-50 p-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Confidence meter</p>
                      <h4 className="mt-2 text-xl font-black text-zinc-900">The purple slider is your confidence slider</h4>
                      <p className="mt-3 text-sm leading-7 text-zinc-600">
                        Move it lower for topics that feel weak and higher for topics you already know well. Lower-confidence topics are scheduled earlier and repeated more often in the study plan.
                      </p>

                      <div className="mt-6 space-y-4">
                        {activePlan.topics.map((topic) => (
                          <div key={`${topic.id}-confidence`} className="rounded-[24px] border border-zinc-200 bg-white p-5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-black text-zinc-900">{topic.name}</p>
                              <span className="text-xs font-black text-purple-600">{topic.confidence}% confidence</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={topic.confidence}
                              onChange={(e) => updateTopic(topic.id, { confidence: parseInt(e.target.value) })}
                              className="mt-4 w-full h-1.5 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                          </div>
                        ))}

                        {activePlan.topics.length === 0 && (
                          <div className="rounded-[24px] border border-dashed border-zinc-200 bg-white p-6 text-center">
                            <p className="text-sm font-bold text-zinc-400">Add topics first, then tune confidence here.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : activePlan.currentStep === 2 ? (
                  <div className={cn("bg-white border border-zinc-200 shadow-sm min-h-[400px]", isPhone ? "rounded-[28px] p-5" : "rounded-[40px] p-8")}>
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-black text-zinc-900">Plan of Attack</h3>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                        <Calendar size={14} />
                        Weekly Schedule
                      </div>
                    </div>

                    {activePlan.studySchedule && activePlan.studySchedule.length > 0 ? (
                      <div className="space-y-6">
                        <div className="rounded-[28px] border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-purple-50/30 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Generated study plan</p>
                              <h4 className="mt-2 text-lg font-black text-zinc-900">Weekly plan ready</h4>
                              <p className="mt-1 text-sm font-bold text-zinc-600">Work through the week below and tick each study block off in one place.</p>
                            </div>
                          </div>

                          <div className="mt-3 grid w-full gap-3 rounded-[22px] border border-white bg-white/80 p-3 text-left md:grid-cols-3">
                            <div className="rounded-[18px] border border-white bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Days planned</p>
                              <p className="mt-2 text-xl font-black text-zinc-900">{activePlan.studySchedule.length}</p>
                            </div>
                            <div className="rounded-[18px] border border-white bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Current focus</p>
                              <p className="mt-2 text-sm font-black text-zinc-900">
                                {selectedScheduleDay ? selectedScheduleDay.focusTopicNames.join(' + ') : 'Study week'}
                              </p>
                            </div>
                            <div className="rounded-[18px] border border-white bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Checklist progress</p>
                              <p className="mt-2 text-xl font-black text-zinc-900">
                                {completedScheduleChecklistItems}
                                <span className="ml-2 text-base text-zinc-400">
                                  / {totalScheduleChecklistItems}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                          <div className="overflow-hidden rounded-[32px] border border-zinc-200 bg-white">
                          <div className={cn("border-b border-zinc-200 bg-zinc-50/60", isPhone ? "p-4" : "p-6")}>
                            <div className={cn("flex items-center justify-between gap-4", isPhone && "flex-col items-start")}>
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Week view</p>
                              <p className="text-xs font-bold text-zinc-500">Tap a day to load its study block</p>
                            </div>
                            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                              {activePlan.studySchedule.map((day) => {
                                const completedItems = day.checklist.filter((item) => item.completed).length;
                                const isSelected = selectedScheduleDay?.id === day.id;
                                const shortFocus =
                                  day.focusTopicNames.length > 1
                                    ? `${day.focusTopicNames[0]} +${day.focusTopicNames.length - 1}`
                                    : day.focusTopicNames[0];
                                const isDone = day.checklist.length > 0 && completedItems === day.checklist.length;
                                const isCurrentDay = day.day === currentWeekdayLabel;
                                const statusClasses = isCurrentDay && !isDone
                                  ? 'border-rose-300 shadow-[0_0_0_1px_rgba(244,63,94,0.18),0_0_28px_rgba(244,63,94,0.18)]'
                                  : isDone
                                    ? 'border-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.16),0_0_28px_rgba(16,185,129,0.16)]'
                                    : 'border-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.16),0_0_28px_rgba(245,158,11,0.16)]';

                                return (
                                  <button
                                    key={day.id}
                                    type="button"
                                    onClick={() => setSelectedScheduleDayId(day.id)}
                                    className={cn(
                                      'w-[168px] min-w-[168px] rounded-[24px] border p-4 text-left transition-all',
                                      statusClasses,
                                      isSelected ? 'bg-white ring-2 ring-zinc-900/6' : 'bg-white/80 hover:bg-white'
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">{day.day}</p>
                                        <h4 className="mt-2 text-[28px] font-black leading-none text-zinc-900">{day.day.slice(0, 3)}</h4>
                                      </div>
                                      <span className="rounded-full bg-zinc-100 px-2.5 py-2 text-[11px] font-black text-zinc-600">
                                        {day.estimatedMinutes}m
                                      </span>
                                    </div>
                                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">
                                      Focus
                                    </p>
                                    <p className="mt-2 min-h-[44px] text-sm font-bold leading-5 text-zinc-700">
                                      {shortFocus}
                                    </p>
                                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] font-bold text-zinc-500">
                                      <span>{completedItems}/{day.checklist.length} done</span>
                                      <span>{day.focusTopicNames.length} topic{day.focusTopicNames.length > 1 ? 's' : ''}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className={cn("min-h-0", isPhone ? "p-4" : "p-8")}>
                            {selectedScheduleDay && (
                              <div className="space-y-6">
                                <div className={cn("grid gap-6", isPhone ? "grid-cols-1" : "xl:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)]")}>
                                  <div className="space-y-4">
                                    <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">{selectedScheduleDay.day}</p>
                                    <h4 className={cn("mt-2 font-black leading-none text-zinc-900", isPhone ? "text-[1.9rem]" : "text-[2.2rem]")}>{selectedScheduleDay.title}</h4>
                                    <div className="mt-4 flex flex-col items-start gap-2">
                                      <span className="rounded-full border border-purple-100 bg-purple-50 px-4 py-2 text-xs font-black text-purple-700">
                                        Study style: {selectedScheduleDay.studyStyle}
                                      </span>
                                      <span className="rounded-full border border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-black text-zinc-700">
                                        {selectedScheduleDay.estimatedMinutes} minute mission
                                      </span>
                                      <span className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">
                                        {selectedScheduleDay.focusTopicNames.length} focus topic{selectedScheduleDay.focusTopicNames.length > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <p className="max-w-[34rem] text-sm leading-7 text-zinc-600">{selectedScheduleDay.objective}</p>
                                    </div>

                                    <div className="space-y-3 xl:max-w-[34rem]">
                                      <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowAmbientMenu((current) => !current);
                                          setShowWallpaperMenu(false);
                                        }}
                                        className="group w-full overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/35 p-4 text-left shadow-[0_20px_56px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl transition-all hover:-translate-y-0.5 hover:bg-white/45"
                                      >
                                        <div className="mb-4 flex h-20 items-end gap-2 rounded-[1.25rem] border border-white/55 bg-gradient-to-br from-indigo-100/70 via-sky-100/65 to-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                          {[26, 46, 34, 56, 38, 68, 42].map((height, index) => (
                                            <span
                                              key={index}
                                              className="w-full rounded-full bg-indigo-500/70 shadow-[0_8px_16px_rgba(79,70,229,0.16)]"
                                              style={{ height }}
                                            />
                                          ))}
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                          <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Ambient sound</p>
                                            <h5 className="mt-2 text-lg font-black text-zinc-900">Sound for this study block</h5>
                                            <p className="mt-1 text-sm font-medium leading-5 text-zinc-600">Choose a loop that stays with the timer on this page.</p>
                                          </div>
                                          <span className="rounded-full bg-white/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                                            Tap
                                          </span>
                                        </div>
                                        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-sky-500/85 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(14,165,233,0.25),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-xl">
                                          {hasChosenAmbient ? 'Change Ambient Sound' : 'Choose Ambient Sound'}
                                        </div>
                                      </button>
                                      {hasChosenAmbient && (
                                        <div className="mt-3 flex items-center justify-between gap-3 rounded-[1.5rem] border border-sky-100 bg-white/75 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-2xl">
                                          <div className="min-w-0">
                                            <p className="text-sm font-black text-zinc-900">{selectedAmbient.label}</p>
                                            <p className="mt-1 text-xs font-medium text-zinc-500">{selectedAmbient.description}</p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (playingAmbientId === selectedAmbient.id) {
                                                stopAmbientSound();
                                              } else {
                                                void playAmbientSound(selectedAmbient.id);
                                              }
                                            }}
                                            className={cn(
                                              "shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all",
                                              playingAmbientId === selectedAmbient.id
                                                ? "bg-zinc-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                                                : "bg-sky-500 text-white shadow-[0_10px_24px_rgba(14,165,233,0.2)]"
                                            )}
                                          >
                                            {playingAmbientId === selectedAmbient.id ? 'Pause' : 'Play'}
                                          </button>
                                        </div>
                                      )}
                                      <AnimatePresence>
                                        {showAmbientMenu && (
                                          <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                            className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-20 rounded-[1.5rem] border border-white/70 bg-white/88 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl"
                                          >
                                            <div className="space-y-2">
                                              {AMBIENT_SOUND_OPTIONS.map((option) => (
                                                <div
                                                  key={option.id}
                                                  role="button"
                                                  tabIndex={0}
                                                  onClick={() => {
                                                    setSelectedAmbientId(option.id);
                                                    setHasChosenAmbient(true);
                                                    setShowAmbientMenu(false);
                                                  }}
                                                  onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                      event.preventDefault();
                                                      setSelectedAmbientId(option.id);
                                                      setHasChosenAmbient(true);
                                                      setShowAmbientMenu(false);
                                                    }
                                                  }}
                                                  className={cn(
                                                    "w-full rounded-2xl border px-4 py-3 text-left transition-all cursor-pointer",
                                                    selectedAmbientId === option.id
                                                      ? "border-sky-200 bg-sky-50 shadow-[0_10px_24px_rgba(14,165,233,0.14)]"
                                                      : "border-white bg-white/80 hover:bg-white"
                                                  )}
                                                >
                                                  <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                      <p className="text-sm font-black text-zinc-900">{option.label}</p>
                                                      <p className="mt-1 text-xs font-medium text-zinc-500">{option.description}</p>
                                                    </div>
                                                    <div
                                                      className={cn(
                                                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black transition-all",
                                                        selectedAmbientId === option.id
                                                          ? "border-sky-200 bg-sky-500 text-white shadow-[0_10px_24px_rgba(14,165,233,0.2)]"
                                                          : "border-zinc-200 bg-white text-zinc-300"
                                                      )}
                                                    >
                                                      {selectedAmbientId === option.id ? '✓' : ''}
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                      </div>

                                      <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowWallpaperMenu((current) => !current);
                                          setShowAmbientMenu(false);
                                        }}
                                        className="group w-full overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/35 p-4 text-left shadow-[0_20px_56px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl transition-all hover:-translate-y-0.5 hover:bg-white/45"
                                      >
                                        <div className="mb-4 grid h-20 grid-cols-[1.15fr_0.85fr] gap-3">
                                          <div className="overflow-hidden rounded-[1.25rem] border border-white/55 bg-[linear-gradient(135deg,rgba(14,165,233,0.62),rgba(16,185,129,0.48)_48%,rgba(250,204,21,0.52))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                            <div className="h-full rounded-[0.9rem] border border-white/40 bg-white/18" />
                                          </div>
                                          <div className="space-y-2.5">
                                            <div className="h-[36px] rounded-[1rem] border border-white/55 bg-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
                                            <div className="h-[36px] rounded-[1rem] border border-white/55 bg-rose-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]" />
                                          </div>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                          <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Wallpaper</p>
                                            <h5 className="mt-2 text-lg font-black text-zinc-900">{selectedWallpaper.label}</h5>
                                            <p className="mt-1 text-sm font-medium leading-5 text-zinc-600">Pick another timer background directly on this page.</p>
                                          </div>
                                          <span className="rounded-full bg-white/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                                            Tap
                                          </span>
                                        </div>
                                        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-emerald-500/85 py-3 text-sm font-bold text-white shadow-[0_14px_30px_rgba(16,185,129,0.22),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-xl">
                                          Choose Wallpaper
                                        </div>
                                      </button>
                                      <AnimatePresence>
                                        {showWallpaperMenu && (
                                          <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                            className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-20 rounded-[1.5rem] border border-white/70 bg-white/88 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-3xl"
                                          >
                                            <div className="grid gap-2">
                                              {BACKGROUND_PRESETS.slice(0, 8).map((preset) => (
                                                <button
                                                  key={preset.id}
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedWallpaperId(preset.id);
                                                    setShowWallpaperMenu(false);
                                                  }}
                                                  className={cn(
                                                    "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all",
                                                    selectedWallpaperId === preset.id
                                                      ? "border-emerald-200 bg-emerald-50 shadow-[0_10px_24px_rgba(16,185,129,0.14)]"
                                                      : "border-white bg-white/80 hover:bg-white"
                                                  )}
                                                >
                                                  <span
                                                    className="h-12 w-16 shrink-0 rounded-[1rem] border border-white/70 bg-cover bg-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
                                                    style={{ backgroundImage: `url(${preset.url})` }}
                                                  />
                                                  <div>
                                                    <p className="text-sm font-black text-zinc-900">{preset.label}</p>
                                                    <p className="mt-1 text-xs font-medium text-zinc-500">Apply to the timer scene</p>
                                                  </div>
                                                </button>
                                              ))}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                      </div>
                                    </div>
                                  </div>

                                  <div
                                    className={cn(
                                      "relative overflow-hidden rounded-[28px] border border-zinc-200 p-5 text-white shadow-[0_18px_36px_rgba(15,23,42,0.16)]",
                                      isPhone ? "min-h-[34rem]" : "xl:min-h-[46rem]"
                                    )}
                                    style={{
                                      backgroundImage: `linear-gradient(180deg, rgba(14,14,16,0.28), rgba(14,14,16,0.88)), url(${selectedWallpaper.url})`,
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center',
                                    }}
                                  >
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_44%)]" />
                                    <div className="relative xl:flex xl:h-full xl:flex-col">
                                      <div className={cn("flex items-start justify-between gap-4", isPhone && "flex-col")}>
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-100/80">Focus timer</p>
                                          <p className={cn("mt-3 font-mono font-black tracking-tight", isPhone ? "text-4xl" : "text-5xl")}>{formatFocusTimer(timeLeft)}</p>
                                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                                            <span className="rounded-full bg-white/12 px-3 py-1 backdrop-blur-sm">
                                              {timerMode === 'study' ? 'Study block' : 'Short break'}
                                            </span>
                                            <span className="rounded-full bg-black/25 px-3 py-1 backdrop-blur-sm">
                                              {selectedWallpaper.label}
                                            </span>
                                          </div>
                                        </div>

                                        <div className={cn("grid gap-2", isPhone && "w-full grid-cols-2")}>
                                          {TIMER_REVEAL_OPTIONS.map((option) => (
                                            <button
                                              key={option.id}
                                              type="button"
                                              onClick={() => setSelectedRevealId(option.id)}
                                              className={cn(
                                                "rounded-2xl px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur-sm transition-all",
                                                selectedRevealId === option.id
                                                  ? "bg-white text-zinc-900"
                                                  : "bg-black/30 text-zinc-100 hover:bg-black/40"
                                              )}
                                            >
                                              {option.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="mt-5 flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            if (!timerActive && timeLeft === 0) {
                                              syncTimerConfiguration(timerMode, timerMode === 'study' ? studyTimerMinutes * 60 : 5 * 60);
                                            }
                                            if (timerActive) {
                                              pauseFocusTimer();
                                              stopAmbientSound();
                                            } else {
                                              startFocusTimer();
                                            }
                                          }}
                                          className={cn(
                                            "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all backdrop-blur-sm",
                                            timerActive ? "bg-black/45 text-white hover:bg-black/55" : "bg-white text-zinc-900 hover:bg-white/90"
                                          )}
                                        >
                                          {timerActive ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                          {timerActive ? 'Pause' : 'Start'}
                                        </button>
                                        <button
                                          onClick={() => {
                                            stopAmbientSound();
                                            syncTimerConfiguration(timerMode, timerMode === 'study' ? studyTimerMinutes * 60 : 5 * 60);
                                          }}
                                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-black/35 text-zinc-100 transition hover:bg-black/45"
                                        >
                                          <RotateCcw size={16} />
                                        </button>
                                      </div>

                                      <div className="mt-3 grid grid-cols-2 gap-2">
                                        <button
                                          onClick={() => {
                                            stopAmbientSound();
                                            syncTimerConfiguration('study', (Math.max(1, Number(customTimerMinutes) || 25)) * 60);
                                          }}
                                          className={cn(
                                            "rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-sm",
                                            timerMode === 'study' ? "bg-white text-zinc-900" : "bg-black/35 text-zinc-100"
                                          )}
                                        >
                                          Study
                                        </button>
                                        <button
                                          onClick={() => {
                                            stopAmbientSound();
                                            syncTimerConfiguration('break', 5 * 60);
                                          }}
                                          className={cn(
                                            "rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-sm",
                                            timerMode === 'break' ? "bg-emerald-500 text-white" : "bg-black/35 text-zinc-100"
                                          )}
                                        >
                                          Break
                                        </button>
                                      </div>

                                      <div className="mt-4 space-y-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-100/70">Study time</p>
                                        <div className="flex flex-wrap gap-2">
                                          {TIMER_DURATION_OPTIONS.map((option) => (
                                            <button
                                              key={option.id}
                                              type="button"
                                              onClick={() => {
                                                setCustomTimerMinutes(String(option.minutes));
                                                if (timerMode === 'study') {
                                                  stopAmbientSound();
                                                  syncTimerConfiguration('study', option.minutes * 60);
                                                }
                                              }}
                                              className={cn(
                                                "rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all backdrop-blur-sm",
                                                Number(customTimerMinutes) === option.minutes
                                                  ? "bg-white text-zinc-900"
                                                  : "bg-black/30 text-zinc-100 hover:bg-black/40"
                                              )}
                                            >
                                              {option.label}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="number"
                                            min="1"
                                            max="180"
                                            value={customTimerMinutes}
                                            onChange={(event) => {
                                              setCustomTimerMinutes(event.target.value);
                                            }}
                                            onBlur={() => {
                                              const nextMinutes = Math.max(1, Number(customTimerMinutes) || 25);
                                              setCustomTimerMinutes(String(nextMinutes));
                                              if (timerMode === 'study') {
                                                stopAmbientSound();
                                                syncTimerConfiguration('study', nextMinutes * 60);
                                              }
                                            }}
                                            className="h-10 w-24 rounded-2xl border border-white/30 bg-black/25 px-3 text-sm font-black text-white outline-none backdrop-blur-sm focus:ring-2 focus:ring-white/40"
                                          />
                                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-100/70">
                                            Custom minutes
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mt-4 xl:mt-auto">
                                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-100/70">
                                          {TIMER_REVEAL_OPTIONS.find((option) => option.id === selectedRevealId)?.label} preview
                                        </p>
                                        <MiniRevealPreview
                                          revealId={selectedRevealId}
                                          progress={timerProgress}
                                          selectedRewardId={selectedRewardId}
                                          sessionComplete={sessionComplete}
                                          sweetVideoUrl={sweetVideoUrl}
                                          iceCubeVideoUrl={iceCubeVideoUrl}
                                        />
                                        {selectedRevealId === 'ice' && (
                                          <div className="mt-3 grid grid-cols-2 gap-2">
                                            {ICE_REWARDS.map((reward) => (
                                              <button
                                                key={reward.id}
                                                type="button"
                                                onClick={() => setSelectedRewardId(reward.id)}
                                                className={cn(
                                                  "rounded-2xl px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] transition-all backdrop-blur-sm",
                                                  selectedRewardId === reward.id
                                                    ? "bg-white text-zinc-900"
                                                    : "bg-black/30 text-zinc-100 hover:bg-black/40"
                                                )}
                                              >
                                                <span className="mr-2 text-base align-middle">{reward.emoji}</span>
                                                {reward.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-[28px] border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-purple-50/40 p-5 shadow-[0_20px_48px_rgba(245,158,11,0.08)]">
                                  <div className={cn("flex flex-col gap-2", isPhone ? "items-start" : "sm:flex-row sm:items-center sm:justify-between")}>
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-500">Start here</p>
                                      <h5 className={cn("mt-2 font-black text-zinc-900", isPhone ? "text-lg leading-tight" : "text-xl")}>Work through these study actions</h5>
                                    </div>
                                    <div className={cn("flex gap-3", isPhone ? "w-full flex-col" : "items-center")}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setInteractiveMode((current) => !current);
                                          setInteractiveIndex(0);
                                          setInteractiveStarted(false);
                                          setInteractiveCompleted(false);
                                        }}
                                        className={cn(
                                          "rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition-all",
                                          interactiveMode ? "bg-amber-500 text-white" : "bg-white text-zinc-700 border border-zinc-200"
                                        )}
                                      >
                                        {interactiveMode ? 'Interactive On' : 'Interactive Off'}
                                      </button>
                                      <div className={cn("rounded-full bg-zinc-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]", isPhone && "w-full text-center")}>
                                        6 action cards + checklist
                                      </div>
                                    </div>
                                  </div>
                                  <p className={cn("mt-3 font-bold text-zinc-600", isPhone ? "text-xs leading-6" : "text-sm")}>
                                    {interactiveMode
                                      ? 'Use the orange start button to isolate one step at a time, then move to the next card when finished.'
                                      : 'Move left to right through the cards below, then finish by ticking off the checklist for today.'}
                                  </p>
                                </div>

                                {interactiveMode ? (
                                  <div className="rounded-[28px] border border-amber-200 bg-white p-6 shadow-[0_0_0_1px_rgba(245,158,11,0.12),0_0_36px_rgba(245,158,11,0.14)]">
                                    {interactiveCompleted ? (
                                      <>
                                      <div className={cn("flex flex-col gap-4", !isPhone && "lg:flex-row lg:items-start lg:justify-between")}>
                                          <div>
                                            <div className="inline-flex rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                              Study complete
                                            </div>
                                            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">
                                              Session summary
                                            </p>
                                            <h5 className="mt-2 text-2xl font-black text-zinc-900">
                                              You completed this study sequence
                                            </h5>
                                            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-zinc-600">
                                              The guided steps are done. Review what you set out to achieve, reopen the plan if needed, or generate a fresh study block to keep going.
                                            </p>
                                          </div>
                                          <div className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                                            Complete
                                          </div>
                                        </div>
                                        <div className={cn("mt-6 grid gap-4", !isPhone && "lg:grid-cols-[1.1fr_0.9fr]")}>
                                          <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Goals achieved</p>
                                            <div className="mt-4 space-y-3">
                                              {studyGoals.map((goal) => (
                                                <div key={goal} className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-4">
                                                  <CheckCircle2 size={18} className="mt-0.5 text-emerald-500" />
                                                  <p className="text-sm font-bold leading-6 text-zinc-700">{goal}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Overview</p>
                                            <div className={cn("mt-4 grid gap-3", isPhone ? "grid-cols-1" : "sm:grid-cols-3")}>
                                              <div className="rounded-2xl bg-white px-4 py-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Focus topics</p>
                                                <p className="mt-2 text-2xl font-black text-zinc-900">{selectedScheduleDay.focusTopicNames.length}</p>
                                              </div>
                                              <div className="rounded-2xl bg-white px-4 py-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Action cards</p>
                                                <p className="mt-2 text-2xl font-black text-zinc-900">{Math.max(interactiveSteps.length - 2, 0)}</p>
                                              </div>
                                              <div className="rounded-2xl bg-white px-4 py-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Checklist done</p>
                                                <p className="mt-2 text-2xl font-black text-zinc-900">
                                                  {selectedScheduleDay.checklist.filter((item) => item.completed).length}/{selectedScheduleDay.checklist.length}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="mt-5 flex flex-wrap gap-3">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setInteractiveCompleted(false);
                                                  setInteractiveIndex(0);
                                                  setInteractiveStarted(false);
                                                }}
                                                className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-100"
                                              >
                                                See plan again
                                              </button>
                                              <button
                                                type="button"
                                                onClick={generateStudySchedule}
                                                className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(245,158,11,0.24)] transition hover:bg-amber-600"
                                              >
                                                Do more study
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                      <div className={cn("flex flex-col gap-4", !isPhone && "lg:flex-row lg:items-start lg:justify-between")}>
                                          <div>
                                            <div className="inline-flex rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                              {interactiveSteps[interactiveIndex]?.badge}
                                            </div>
                                            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">
                                              {interactiveSteps[interactiveIndex]?.eyebrow}
                                            </p>
                                            <h5 className="mt-2 text-2xl font-black text-zinc-900">
                                              {interactiveSteps[interactiveIndex]?.title}
                                            </h5>
                                          </div>
                                          <div className={cn("rounded-full bg-zinc-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white", isPhone && "self-start")}>
                                            Step {interactiveIndex + 1} / {interactiveSteps.length}
                                          </div>
                                        </div>
                                        <div className="mt-6">
                                          {interactiveSteps[interactiveIndex]?.render}
                                        </div>
                                        <div className={cn("mt-6 flex gap-3", isPhone ? "flex-col" : "flex-wrap items-center")}>
                                          {!interactiveStarted ? (
                                            <button
                                              type="button"
                                              onClick={() => setInteractiveStarted(true)}
                                              className={cn("rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(245,158,11,0.24)] transition hover:bg-amber-600", isPhone && "w-full")}
                                            >
                                              Start this step
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (interactiveIndex === interactiveSteps.length - 1) {
                                                  setInteractiveCompleted(true);
                                                  setInteractiveStarted(false);
                                                  return;
                                                }

                                                setInteractiveIndex((current) => current + 1);
                                                setInteractiveStarted(false);
                                              }}
                                              className={cn("rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(245,158,11,0.24)] transition hover:bg-amber-600", isPhone && "w-full")}
                                            >
                                              {interactiveIndex === interactiveSteps.length - 1 ? 'Finish sequence' : 'Done and next'}
                                            </button>
                                          )}
                                          {interactiveIndex > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setInteractiveIndex((current) => Math.max(0, current - 1));
                                                setInteractiveStarted(false);
                                              }}
                                              className={cn("rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50", isPhone && "w-full")}
                                            >
                                              Previous
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <div className={cn("grid gap-4", isPhone ? "grid-cols-1" : "md:grid-cols-3")}>
                                      <div className="rounded-[24px] border border-amber-200 bg-white p-5 shadow-[0_0_0_1px_rgba(245,158,11,0.12),0_0_28px_rgba(245,158,11,0.12)]">
                                        <div className="mb-4 inline-flex rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                          Start 1
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Focus topics</p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                          {selectedScheduleDay.focusTopicNames.map((topicName) => (
                                            <span key={topicName} className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700">
                                              {topicName}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="rounded-[24px] border border-amber-200 bg-white p-5 shadow-[0_0_0_1px_rgba(245,158,11,0.12),0_0_28px_rgba(245,158,11,0.12)]">
                                        <div className="mb-4 inline-flex rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                          Start 2
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Homework technique</p>
                                        <p className="mt-3 text-sm leading-7 text-zinc-700">{selectedScheduleDay.homeworkTechnique}</p>
                                      </div>
                                      <div className="rounded-[24px] border border-amber-200 bg-white p-5 shadow-[0_0_0_1px_rgba(245,158,11,0.12),0_0_28px_rgba(245,158,11,0.12)]">
                                        <div className="mb-4 inline-flex rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                          Start 3
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Textbook task</p>
                                        <p className="mt-3 text-sm leading-7 text-zinc-700">{selectedScheduleDay.textbookTask}</p>
                                      </div>
                                    </div>

                                    <div className={cn("grid gap-4", isPhone ? "grid-cols-1" : "md:grid-cols-3")}>
                                      {selectedScheduleDay.methods.map((method, index) => (
                                        <div key={method.id} className="rounded-[24px] border border-amber-200 bg-white p-5 shadow-[0_0_0_1px_rgba(245,158,11,0.12),0_0_28px_rgba(245,158,11,0.12)]">
                                          <div className="mb-4 inline-flex rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                            Start {index + 4}
                                          </div>
                                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">{method.type}</p>
                                          <h5 className="mt-2 text-base font-black text-zinc-900">{method.title}</h5>
                                          <p className="mt-3 text-sm leading-6 text-zinc-600">{method.description}</p>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="rounded-[28px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 p-6 shadow-[0_0_0_1px_rgba(16,185,129,0.10),0_0_32px_rgba(16,185,129,0.10)]">
                                      <div className={cn("mb-4 flex gap-4", isPhone ? "flex-col items-start" : "items-center justify-between")}>
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Finish here</p>
                                          <h5 className="mt-2 text-lg font-black text-zinc-900">Tick off for today</h5>
                                        </div>
                                        <div className={cn("rounded-full bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white", isPhone && "self-start")}>
                                          Final step
                                        </div>
                                      </div>
                                      <div className="mt-4 space-y-3">
                                        {selectedScheduleDay.checklist.map((item) => (
                                          <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => toggleScheduleChecklist(selectedScheduleDay.id, item.id)}
                                            className="flex w-full items-center gap-3 rounded-2xl border border-white bg-white px-4 py-4 text-left"
                                          >
                                            {item.completed ? (
                                              <CheckCircle2 size={18} className="text-emerald-500" />
                                            ) : (
                                              <Circle size={18} className="text-zinc-300" />
                                            )}
                                            <span className={cn('text-sm font-bold text-zinc-700', item.completed && 'text-zinc-400 line-through')}>
                                              {item.text}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-[32px] border border-zinc-200 bg-white p-6">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Study materials</p>
                              <h4 className="mt-2 text-xl font-black text-zinc-900">Recommended video help</h4>
                              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">
                                Three quick YouTube starting points for {selectedScheduleDay?.focusTopicNames.join(' + ') || activePlan.subject}. Each link opens in a new tab so the study planner stays open.
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            {buildYoutubeRecommendations(
                              activePlan.subject,
                              selectedScheduleDay?.focusTopicNames.length ? selectedScheduleDay.focusTopicNames : activePlan.topics.slice(0, 2).map((topic) => topic.name)
                            ).map((video) => (
                              <a
                                key={video.id}
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 transition hover:border-red-200 hover:bg-white hover:shadow-lg hover:shadow-zinc-100"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                                      <Youtube size={18} />
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">{video.provider}</p>
                                      <h5 className="mt-1 text-base font-black text-zinc-900">{video.label}</h5>
                                    </div>
                                  </div>
                                  <ExternalLink size={16} className="text-zinc-300 transition group-hover:text-zinc-500" />
                                </div>

                                <p className="mt-4 text-sm font-bold leading-6 text-zinc-700">{video.query}</p>
                                <p className="mt-3 text-sm leading-6 text-zinc-500">{video.description}</p>
                                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-zinc-700 border border-zinc-200">
                                  Open in new tab
                                  <ExternalLink size={12} />
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[32px] border border-zinc-200 bg-zinc-50 p-6">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Regenerate weekly plan</p>
                              <h4 className="mt-2 text-xl font-black text-zinc-900">Need a refreshed version?</h4>
                              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">
                                Rebuild the week from the current topic list if the student adds or removes topics.
                              </p>
                            </div>
                            <button
                              onClick={generateStudySchedule}
                              disabled={isGeneratingSchedule}
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 text-sm font-black text-white transition hover:bg-purple-700 disabled:opacity-60"
                            >
                              {isGeneratingSchedule ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                              {isGeneratingSchedule ? 'Rebuilding week...' : 'Regenerate Weekly Plan'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="rounded-[32px] border border-zinc-200 bg-zinc-50 p-6">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-zinc-400">Step 2 guide</p>
                              <h4 className="mt-2 text-xl font-black text-zinc-900">Build the week from the topics above</h4>
                              <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600">
                                Generate a weekly attack plan from the current topic list. Each day becomes a tappable study card with methods, textbook practice, and a homework technique to follow.
                              </p>
                            </div>
                            <button
                              onClick={generateStudySchedule}
                              disabled={isGeneratingSchedule}
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 text-sm font-black text-white transition hover:bg-purple-700 disabled:opacity-60"
                            >
                              {isGeneratingSchedule ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                              {isGeneratingSchedule ? 'Building study week...' : 'Generate Weekly Plan'}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[32px] border-2 border-dashed border-zinc-200 bg-zinc-50/70 p-12 text-center">
                          <Calendar className="mx-auto h-10 w-10 text-zinc-300" />
                          <h4 className="mt-4 text-xl font-black text-zinc-900">No weekly study plan yet</h4>
                          <p className="mt-3 text-sm leading-7 text-zinc-500">
                            Generate topics in step 1, then build a weekly attack plan here. Each day will open into methods, checklist items, and study guidance.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : activePlan.currentStep === 3 ? (
                  <div className="bg-white p-8 rounded-[40px] border border-zinc-200 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-black text-zinc-900">Active Revision</h3>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                        <Sparkles size={14} />
                        Active Recall & Flashcards
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-purple-50 p-8 rounded-[32px] border border-purple-100">
                        <h4 className="text-lg font-black text-zinc-900 mb-2">AI Flashcard Generator</h4>
                        <p className="text-zinc-500 text-sm mb-6">Instantly create flashcards based on your study topics.</p>
                        <button 
                          onClick={generateFlashcards}
                          disabled={isGeneratingFlashcards}
                          className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black text-sm hover:bg-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isGeneratingFlashcards ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                          {isGeneratingFlashcards ? 'Generating...' : 'Generate Flashcards'}
                        </button>
                      </div>

                      <div className="bg-zinc-50 p-8 rounded-[32px] border border-zinc-100">
                        <h4 className="text-lg font-black text-zinc-900 mb-2">Study Sessions</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-500">Total Sessions</span>
                            <span className="text-lg font-black text-zinc-900">{activePlan.focusSessions?.length || 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-500">Total Focus Time</span>
                            <span className="text-lg font-black text-zinc-900">
                              {Math.round((activePlan.focusSessions?.reduce((acc, s) => acc + s.duration, 0) || 0) / 60)}h
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Revision Tasks</h4>
                      {/* Reuse task list logic */}
                      <div className="flex gap-3 mb-6">
                        <input
                          type="text"
                          value={taskInput}
                          onChange={e => setTaskInput(e.target.value)}
                          placeholder="Add a revision task..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              addTask(3, taskInput);
                              setTaskInput('');
                            }
                          }}
                          className="flex-1 px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                        />
                        <button 
                          onClick={() => {
                            addTask(3, taskInput);
                            setTaskInput('');
                          }}
                          className="px-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                        >
                          Add
                        </button>
                      </div>
                      <div className="space-y-3">
                        {activePlan.steps[2].tasks.map(task => (
                          <div key={task.id} className="flex items-center gap-4 p-4 bg-white border border-zinc-100 rounded-2xl group">
                            <button onClick={() => toggleTask(3, task.id)} className={cn("transition-colors", task.completed ? "text-emerald-500" : "text-zinc-300 hover:text-purple-500")}>
                              {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                            </button>
                            <span className={cn("text-sm font-bold flex-1", task.completed && "line-through text-zinc-400")}>{task.text}</span>
                            <button onClick={() => deleteTask(3, task.id)} className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : activePlan.currentStep === 4 ? (
                  <div className="bg-white p-8 rounded-[40px] border border-zinc-200 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-black text-zinc-900">Mock Exams</h3>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                        <FileCheck size={14} />
                        Practice Papers & Tests
                      </div>
                    </div>

                    <div className="bg-zinc-50 p-8 rounded-[32px] border border-zinc-100 mb-8">
                      <h4 className="text-lg font-black text-zinc-900 mb-6">Log Mock Result</h4>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        addMockExam({
                          score: parseInt(formData.get('score') as string),
                          total: parseInt(formData.get('total') as string),
                          duration: parseInt(formData.get('duration') as string),
                          notes: formData.get('notes') as string
                        });
                        e.currentTarget.reset();
                      }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Score</label>
                          <input name="score" required type="number" className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total</label>
                          <input name="total" required type="number" className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Time (min)</label>
                          <input name="duration" required type="number" className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none" />
                        </div>
                        <div className="flex items-end">
                          <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-black text-xs hover:bg-zinc-800 transition-all">
                            Log Result
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Past Mock Results</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activePlan.mockExams?.map(mock => (
                          <div key={mock.id} className="p-6 bg-white border border-zinc-100 rounded-3xl shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-xs font-bold text-zinc-400">{new Date(mock.date).toLocaleDateString()}</span>
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                (mock.score / mock.total) >= 0.7 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                              )}>
                                {Math.round((mock.score / mock.total) * 100)}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileCheck size={16} className="text-zinc-400" />
                                <span className="text-lg font-black text-zinc-900">{mock.score} / {mock.total}</span>
                              </div>
                              <div className="flex items-center gap-2 text-zinc-400">
                                <Clock size={14} />
                                <span className="text-xs font-bold">{mock.duration}m</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(!activePlan.mockExams || activePlan.mockExams.length === 0) && (
                          <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-100 rounded-[32px]">
                            <p className="text-zinc-400 text-sm font-bold">No mock exams logged yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : activePlan.currentStep === 5 ? (
                  <div className="bg-white p-8 rounded-[40px] border border-zinc-200 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-black text-zinc-900">Final Polish: Mental Quiz</h3>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                        <Eye size={14} />
                        Self-Assessment
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-zinc-500 font-bold">Rate your confidence in each topic to optimize your final study plan.</p>
                      {activePlan.topics.map(topic => (
                        <div key={topic.id} className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-black text-zinc-900">{topic.name}</span>
                            <span className="text-xs font-black text-purple-600">{topic.confidence}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={topic.confidence}
                            onChange={(e) => updateTopic(topic.id, { confidence: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                          />
                        </div>
                      ))}
                      <button 
                        onClick={optimizePlanBasedOnConfidence}
                        className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
                      >
                        Optimize Plan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-[40px] border border-zinc-200 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-black text-zinc-900">{EXAM_STEPS[activePlan.currentStep - 1].title}</h3>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                        {EXAM_STEPS[activePlan.currentStep - 1].description}
                      </div>
                    </div>

                    <div className="flex gap-3 mb-8">
                      <input
                        type="text"
                        value={taskInput}
                        onChange={e => setTaskInput(e.target.value)}
                        placeholder="Add a study task..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addTask(activePlan.currentStep, taskInput);
                            setTaskInput('');
                          }
                        }}
                        className="flex-1 px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                      />
                      <button 
                        onClick={() => {
                          addTask(activePlan.currentStep, taskInput);
                          setTaskInput('');
                        }}
                        className="px-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                      >
                        Add
                      </button>
                    </div>

                    <div className="space-y-4">
                      {activePlan.steps[activePlan.currentStep - 1].tasks.map((task) => (
                        <div 
                          key={task.id}
                          className={cn(
                            "flex items-center gap-6 p-6 rounded-[32px] border transition-all group",
                            task.completed ? "bg-zinc-50 border-zinc-100" : "bg-white border-zinc-200 hover:border-purple-200 shadow-sm"
                          )}
                        >
                          <button 
                            onClick={() => toggleTask(activePlan.currentStep, task.id)}
                            className={cn(
                              "transition-colors",
                              task.completed ? "text-emerald-500" : "text-zinc-300 hover:text-purple-500"
                            )}
                          >
                            {task.completed ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                          </button>
                          <div className="flex-1">
                            <p className={cn(
                              "text-base font-bold",
                              task.completed && "line-through text-zinc-400"
                            )}>
                              {task.text}
                            </p>
                            {task.dueDate && (
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">
                                Due: {new Date(task.dueDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <button 
                            onClick={() => deleteTask(activePlan.currentStep, task.id)}
                            className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      ))}
                      {activePlan.steps[activePlan.currentStep - 1].tasks.length === 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-zinc-100 rounded-[40px]">
                          <p className="text-zinc-400 font-bold">No tasks yet. Use AI to generate a study plan!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              {activePlan.currentStep !== 2 && (
              <div className="space-y-6">
                {/* Focus Timer */}
                <div className="bg-[#151619] rounded-[40px] p-8 text-white shadow-2xl relative border border-white/5">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full animate-pulse",
                        timerActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-zinc-600"
                      )} />
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Focus Module v1.0</h4>
                    </div>
                    <Timer size={16} className="text-zinc-700" />
                  </div>

                  <div className="text-center mb-10 relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-5">
                      <div className="w-32 h-32 border-4 border-dashed border-white rounded-full animate-[spin_20s_linear_infinite]" />
                    </div>
                    <div className="text-7xl font-black tracking-tighter mb-2 font-mono tabular-nums">
                      {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                        timerMode === 'study' ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      )}>
                        {timerMode} mode
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 mb-10">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-zinc-600 uppercase tracking-widest">Target Topic</label>
                      <select 
                        value={selectedTopicId || ''}
                        onChange={e => setSelectedTopicId(e.target.value || null)}
                        className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl px-4 py-4 text-xs font-bold outline-none focus:ring-1 focus:ring-purple-500/50 transition-all appearance-none"
                      >
                        <option value="" className="bg-[#151619]">General Session</option>
                        {activePlan.topics.map(t => (
                          <option key={t.id} value={t.id} className="bg-[#151619]">{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          if (timerActive) {
                            pauseFocusTimer();
                            stopAmbientSound();
                          } else {
                            startFocusTimer();
                          }
                        }}
                        className={cn(
                          "flex-1 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                          timerActive 
                            ? "bg-zinc-800 text-white hover:bg-zinc-700" 
                            : "bg-white text-zinc-900 hover:scale-[1.02] active:scale-[0.98]"
                        )}
                      >
                        {timerActive ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        {timerActive ? 'Halt' : 'Engage'}
                      </button>
                      <button 
                        onClick={() => {
                          stopAmbientSound();
                          syncTimerConfiguration(timerMode, timerMode === 'study' ? studyTimerMinutes * 60 : 5 * 60);
                        }}
                        className="p-5 bg-zinc-800 text-zinc-400 rounded-2xl hover:text-white transition-all border border-white/5"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => {
                        stopAmbientSound();
                        syncTimerConfiguration('study', studyTimerMinutes * 60);
                      }}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                        timerMode === 'study' ? "bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]" : "bg-transparent border-zinc-800 text-zinc-600 hover:text-zinc-400"
                      )}
                    >
                      Pomodoro
                    </button>
                    <button 
                      onClick={() => {
                        stopAmbientSound();
                        syncTimerConfiguration('break', 5 * 60);
                      }}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                        timerMode === 'break' ? "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-transparent border-zinc-800 text-zinc-600 hover:text-zinc-400"
                      )}
                    >
                      Short Break
                    </button>
                  </div>
                </div>

              </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-black text-zinc-900 mb-8">New Exam Plan</h2>
              <form onSubmit={handleCreatePlan} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Exam Title</label>
                  <input
                    required
                    type="text"
                    value={newPlanData.title}
                    onChange={e => setNewPlanData({ ...newPlanData, title: e.target.value })}
                    placeholder="e.g., Midterm Exam"
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Subject</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      list="timetable-subjects"
                      value={newPlanData.subject}
                      onChange={e => setNewPlanData({ ...newPlanData, subject: e.target.value })}
                      placeholder="e.g., Biology"
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    />
                    <datalist id="timetable-subjects">
                      {timetableSubjects.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Year Level</label>
                  <select
                    required
                    value={newPlanData.yearLevel}
                    onChange={e => setNewPlanData({ ...newPlanData, yearLevel: e.target.value as '10' | '11' | '12' })}
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  >
                    <option value="10">Year 10</option>
                    <option value="11">Year 11</option>
                    <option value="12">Year 12</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Exam Date</label>
                  <input
                    required
                    type="date"
                    value={newPlanData.examDate}
                    onChange={e => setNewPlanData({ ...newPlanData, examDate: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Create Plan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
