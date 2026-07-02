'use client';
import { db, auth } from '../firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  updateDoc,
  Timestamp,
  limit
} from '@/lib/portal-firestore';
import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, OnDragEndResponder } from '@hello-pangea/dnd';
import { NextStepsCards } from './NextStepsCards';
import type { LucideIcon } from 'lucide-react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  ClipboardCheck,
  Trophy, 
  ArrowRight, 
  Layout as LayoutIcon,
  Sparkles,
  ChevronRight,
  BookOpen,
  GraduationCap,
  CloudSun,
  Quote,
  Newspaper,
  TimerReset,
  MessageSquare,
  Brain,
  ClipboardList,
  Calculator,
  PenTool,
  Target,
  ListChecks,
  Library,
  Mail,
  Pencil,
  Settings,
  User as UserIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  DashboardLayoutSettings, 
  DashboardLayout, 
  CardId 
} from './DashboardLayoutSettings';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useAuth } from '@/hooks/use-auth';
import { useExamTimetableStore } from '@/hooks/use-exam-timetable-store';
import { useClassNotesStore } from '@/hooks/use-class-notes-store';
import { useStudyGameStore } from '@/hooks/use-study-game-store';
import { useAchievementsStore } from '@/hooks/use-achievements-store';
import { StudyPet } from './study-pet';
import { MoodHistoryChart } from './mood-history';
import { TodaysFocus } from './todays-focus';
import { DailyHomeworkPlan } from './daily-homework-plan';
import { GoalsVsActualChartPanel } from './my-progress/goals-vs-actual-chart';
import { ClassProgressChart } from './class-progress-chart';
import { FocusVsReviewChart, WeeklyActivityChartPanel } from './my-progress/waveform-chart';
import { MonthlyMoodChart } from './my-progress/monthly-mood-chart';
import { QuickActionCards } from './QuickActionCards';
import { DailyQuizCard } from './DailyQuizCard';
import { TodoTask, Deadline, Note, ExamPlan, AssignmentPlan } from '../types';
import { useSavedPageBackground } from '../lib/backgrounds';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import {
  detectStudentPortalFromPath,
  studentPortalPath,
  studentPortalAssignmentCoachPath,
  studentPortalExamPortalPath,
  studentPortalToolPath,
} from '@/lib/portal';

interface HomeworkSession {
  subject: string;
  technique: string;
  duration: string;
  timeOfDay: string;
  day: string;
}

interface QuickAccessItem {
  id: string;
  featureId: string;
}

function getQuickAccessFeatures(portal: ReturnType<typeof detectStudentPortalFromPath>) {
  return [
    { id: 'learning-profile', label: 'How I Learn Best', category: 'Planning', path: studentPortalToolPath(portal, 'learning-profile'), icon: Brain },
    { id: 'homework-planner', label: 'Homework Planner', category: 'Planning', path: studentPortalToolPath(portal, 'homework-planner'), icon: Calendar },
    { id: 'deadlines', label: 'Deadlines', category: 'Planning', path: studentPortalToolPath(portal, 'deadlines'), icon: ClipboardList },
    { id: 'daily-planner', label: 'Daily Planner', category: 'Planning', path: studentPortalToolPath(portal, 'daily-planner'), icon: Calendar },
    { id: 'todo', label: 'To-do List', category: 'Planning', path: studentPortalToolPath(portal, 'todo'), icon: ListChecks },
    { id: 'calculator', label: 'Calculator', category: 'Tools', path: studentPortalToolPath(portal, 'calculator'), icon: Calculator },
    { id: 'math-solver', label: 'Math Solver', category: 'Tools', path: studentPortalToolPath(portal, 'math-solver'), icon: PenTool },
    { id: 'practice-quiz', label: 'Practice Quiz', category: 'Study', path: studentPortalToolPath(portal, 'practice-quiz'), icon: Target },
    { id: 'class-notes', label: 'Class Notes', category: 'Study', path: studentPortalToolPath(portal, 'class-notes'), icon: BookOpen },
    { id: 'lecture-lift', label: 'Lecture Lift', category: 'Study', path: studentPortalToolPath(portal, 'lecture-lift'), icon: Sparkles },
    { id: 'library', label: 'Library', category: 'Study', path: studentPortalToolPath(portal, 'library'), icon: Library },
    { id: 'profile', label: 'Me', category: 'Personal', path: portal === 'university' ? '/uni/profile' : '/profile', icon: UserIcon },
    { id: 'email', label: 'Email', category: 'Support', path: portal === 'university' ? '/uni/email' : '/email', icon: Mail },
    { id: 'settings', label: 'Settings', category: 'Support', path: portal === 'university' ? '/uni/settings' : '/settings', icon: Settings },
  ];
}

const DEFAULT_LAYOUT: DashboardLayout = {
  columns: {
    left: ['studyPet'],
    center: ['focus'],
    right: ['achievements', 'continueWork'],
  },
  hidden: ['todo', 'deadlines'],
};

const dashboardGlassCard =
  "border border-white/60 bg-white/35 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl";

const dashboardGlassInset =
  "border border-white/45 bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-xl";

interface WeatherState {
  temperature: number | null;
  description: string;
  location: string;
  loading: boolean;
}

const weatherCodeDescriptions: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Storm',
  96: 'Storm',
  99: 'Storm',
};

const quoteChips = [
  { quote: 'The future depends on what you do today.', person: 'Mahatma Gandhi' },
  { quote: 'It always seems impossible until it is done.', person: 'Nelson Mandela' },
  { quote: 'Learning never exhausts the mind.', person: 'Leonardo da Vinci' },
  { quote: 'Do one thing well today.', person: 'Michelle Obama' },
  { quote: 'Stay hungry. Stay foolish.', person: 'Steve Jobs' },
  { quote: 'Success is the sum of small efforts, repeated day in and day out.', person: 'Robert Collier' },
  { quote: 'The expert in anything was once a beginner.', person: 'Helen Hayes' },
  { quote: 'Education is the passport to the future, for tomorrow belongs to those who prepare for it today.', person: 'Malcolm X' },
  { quote: 'You do not have to be great to start, but you have to start to be great.', person: 'Zig Ziglar' },
  { quote: 'Dreams do not work unless you do.', person: 'John C. Maxwell' },
  { quote: 'The beautiful thing about learning is that no one can take it away from you.', person: 'B.B. King' },
  { quote: 'The best way to predict your future is to create it.', person: 'Abraham Lincoln' },
  { quote: 'If you can dream it, you can do it.', person: 'Walt Disney' },
  { quote: 'The way to get started is to quit talking and begin doing.', person: 'Walt Disney' },
  { quote: 'I can accept failure, everyone fails at something. But I cannot accept not trying.', person: 'Michael Jordan' },
  { quote: 'Some people want it to happen, some wish it would happen, others make it happen.', person: 'Michael Jordan' },
  { quote: 'A person who never made a mistake never tried anything new.', person: 'Albert Einstein' },
  { quote: 'Strive not to be a success, but rather to be of value.', person: 'Albert Einstein' },
  { quote: 'Nothing is impossible. The word itself says possible.', person: 'Audrey Hepburn' },
  { quote: 'No pressure, no diamonds.', person: 'Thomas Carlyle' },
  { quote: 'Turn your wounds into wisdom.', person: 'Oprah Winfrey' },
  { quote: 'Doing the best at this moment puts you in the best place for the next moment.', person: 'Oprah Winfrey' },
  { quote: 'If my mind can conceive it, and my heart can believe it, then I can achieve it.', person: 'Muhammad Ali' },
  { quote: 'He who is not courageous enough to take risks will accomplish nothing in life.', person: 'Muhammad Ali' },
  { quote: 'The only limit to our realization of tomorrow is our doubts of today.', person: 'Franklin D. Roosevelt' },
  { quote: 'Believe you can and you are halfway there.', person: 'Theodore Roosevelt' },
  { quote: 'Do what you can, with what you have, where you are.', person: 'Theodore Roosevelt' },
  { quote: 'I have not failed. I have just found 10,000 ways that will not work.', person: 'Thomas Edison' },
  { quote: 'Opportunity is missed by most people because it is dressed in overalls and looks like work.', person: 'Thomas Edison' },
  { quote: 'Be so good they cannot ignore you.', person: 'Steve Martin' },
  { quote: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', person: 'Winston Churchill' },
  { quote: 'Continuous effort, not strength or intelligence, is the key to unlocking our potential.', person: 'Winston Churchill' },
  { quote: 'Make each day your masterpiece.', person: 'John Wooden' },
  { quote: 'Things work out best for those who make the best of how things work out.', person: 'John Wooden' },
  { quote: 'Done is better than perfect.', person: 'Sheryl Sandberg' },
  { quote: 'Always deliver more than expected.', person: 'Larry Page' },
  { quote: 'Have a healthy disregard for the impossible.', person: 'Larry Page' },
  { quote: 'We want Google to be the third half of your brain.', person: 'Sergey Brin' },
  { quote: 'Solving big problems is easier than solving little problems.', person: 'Sergey Brin' },
  { quote: 'Life is not about finding yourself. Life is about creating yourself.', person: 'George Bernard Shaw' },
  { quote: 'The secret of getting ahead is getting started.', person: 'Mark Twain' },
  { quote: 'The two most important days in your life are the day you are born and the day you find out why.', person: 'Mark Twain' },
  { quote: 'Keep your face always toward the sunshine and shadows will fall behind you.', person: 'Walt Whitman' },
  { quote: 'The most difficult thing is the decision to act, the rest is merely tenacity.', person: 'Amelia Earhart' },
  { quote: 'Never interrupt someone doing what you said could not be done.', person: 'Amelia Earhart' },
  { quote: 'The most effective way to do it, is to do it.', person: 'Amelia Earhart' },
  { quote: 'You have to expect things of yourself before you can do them.', person: 'Michael Jordan' },
  { quote: 'Find the good. It is all around you.', person: 'Alexandra Elle' },
  { quote: 'When you have a dream, you have got to grab it and never let go.', person: 'Carol Burnett' },
  { quote: 'Do not wait. The time will never be just right.', person: 'Napoleon Hill' },
  { quote: 'What the mind can conceive and believe, it can achieve.', person: 'Napoleon Hill' },
  { quote: 'It takes courage to grow up and become who you really are.', person: 'E.E. Cummings' },
  { quote: 'The future belongs to those who believe in the beauty of their dreams.', person: 'Eleanor Roosevelt' },
  { quote: 'You must do the thing you think you cannot do.', person: 'Eleanor Roosevelt' },
  { quote: 'Success is getting what you want, happiness is wanting what you get.', person: 'W.P. Kinsella' },
  { quote: 'Start where you are. Use what you have. Do what you can.', person: 'Arthur Ashe' },
  { quote: 'One important key to success is self-confidence. An important key to self-confidence is preparation.', person: 'Arthur Ashe' },
  { quote: 'The only way to do great work is to love what you do.', person: 'Steve Jobs' },
  { quote: 'Innovation distinguishes between a leader and a follower.', person: 'Steve Jobs' },
  { quote: 'When something is important enough, you do it even if the odds are not in your favor.', person: 'Elon Musk' },
  { quote: 'Persistence is very important. You should not give up unless you are forced to give up.', person: 'Elon Musk' },
  { quote: 'Act as if what you do makes a difference. It does.', person: 'William James' },
  { quote: 'Small deeds done are better than great deeds planned.', person: 'Peter Marshall' },
  { quote: 'The beginning is the most important part of the work.', person: 'Plato' },
  { quote: 'Well begun is half done.', person: 'Aristotle' },
  { quote: 'Pleasure in the job puts perfection in the work.', person: 'Aristotle' },
  { quote: 'To succeed in life, you need two things: ignorance and confidence.', person: 'Mark Twain' },
  { quote: 'If you can imagine it, you can achieve it. If you can dream it, you can become it.', person: 'William Arthur Ward' },
  { quote: 'Do not watch the clock; do what it does. Keep going.', person: 'Sam Levenson' },
  { quote: 'Aim above morality. Be not simply good, be good for something.', person: 'Henry David Thoreau' },
  { quote: 'However difficult life may seem, there is always something you can do and succeed at.', person: 'Stephen Hawking' },
  { quote: 'Intelligence is the ability to adapt to change.', person: 'Stephen Hawking' },
  { quote: 'I attribute my success to this: I never gave or took any excuse.', person: 'Florence Nightingale' },
  { quote: 'The Wright brothers flew right through the smoke screen of impossibility.', person: 'Charles Kettering' },
  { quote: 'The engine is the heart of an airplane, but the pilot is its soul.', person: 'Walter Raleigh' },
  { quote: 'Nothing in life is to be feared, it is only to be understood.', person: 'Marie Curie' },
  { quote: 'Be less curious about people and more curious about ideas.', person: 'Marie Curie' },
  { quote: 'That brain of mine is something more than merely mortal; as time will show.', person: 'Ada Lovelace' },
  { quote: 'We will always have STEM with us. Some things will drop out of the public eye and go away, but there will always be science, engineering, and technology.', person: 'Katherine Johnson' },
  { quote: 'The people who are crazy enough to think they can change the world are the ones who do.', person: 'Rob Siltanen' },
  { quote: 'You miss 100 percent of the shots you do not take.', person: 'Wayne Gretzky' },
  { quote: 'Everything you can imagine is real.', person: 'Pablo Picasso' },
  { quote: 'Great things are done by a series of small things brought together.', person: 'Vincent van Gogh' },
  { quote: 'The purpose of our lives is to be happy.', person: 'Dalai Lama' },
  { quote: 'Never be limited by other people is limited imaginations.', person: 'Mae Jemison' },
  { quote: 'The key to success is to start before you are ready.', person: 'Marie Forleo' },
  { quote: 'The greatest glory in living lies not in never falling, but in rising every time we fall.', person: 'Nelson Mandela' },
  { quote: 'In a gentle way, you can shake the world.', person: 'Mahatma Gandhi' },
  { quote: 'You learn something every day if you pay attention.', person: 'Ray LeBlond' },
  { quote: 'Nothing will work unless you do.', person: 'Maya Angelou' },
  { quote: 'Try to be a rainbow in someone else is cloud.', person: 'Maya Angelou' },
  { quote: 'The power of imagination makes us infinite.', person: 'John Muir' },
  { quote: 'I am not afraid of storms, for I am learning how to sail my ship.', person: 'Louisa May Alcott' },
  { quote: 'What we think, we become.', person: 'Buddha' },
  { quote: 'It is never too late to be what you might have been.', person: 'George Eliot' },
  { quote: 'I never dreamed about success. I worked for it.', person: 'Estee Lauder' },
  { quote: 'Make today so awesome that yesterday gets jealous.', person: 'Unknown' },
  { quote: 'Music can change the world because it can change people.', person: 'Bono' },
  { quote: 'The greatest education in the world is watching the masters at work.', person: 'Michael Jackson' },
  { quote: 'You can fool people. You can fool anybody any time of the day, but you cannot fool yourself.', person: 'Whitney Houston' },
  { quote: 'Power is not given to you. You have to take it.', person: 'Beyonce' },
  { quote: 'It all begins with your mindset.', person: 'Beyonce' },
  { quote: 'I am my own experiment. I am my own work of art.', person: 'Madonna' },
  { quote: 'No one can make you feel inferior without your consent.', person: 'Eleanor Roosevelt' },
];

export function DashboardClient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isPhone, isTablet } = useResponsiveDevice();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const isUniversityPortal = activePortal === 'university';
  const quickAccessFeatures = getQuickAccessFeatures(activePortal);
  const quickAccessCategories = Array.from(new Set(quickAccessFeatures.map((feature) => feature.category)));
  const {
    setting: dashboardBackground,
    style: dashboardBackgroundStyle,
    imageStyle: dashboardBackgroundImageStyle,
    hasImage: hasDashboardBackgroundImage,
  } = useSavedPageBackground('dashboard');
  const [layout, setLayout] = useLocalStorage<DashboardLayout>('dashboard-layout', DEFAULT_LAYOUT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());
  const [isArmyTime, setIsArmyTime] = useLocalStorage('dashboard-army-time', false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isQuotePreferencesOpen, setIsQuotePreferencesOpen] = useState(false);
  const [preferredQuotePeople, setPreferredQuotePeople] = useLocalStorage<string[]>(
    'dashboard-quote-people',
    ['Mahatma Gandhi', 'Nelson Mandela', 'Leonardo da Vinci', 'Michelle Obama', 'Steve Jobs', 'Albert Einstein', 'Michael Jackson'],
  );
  const [isQuoteDropdownOpen, setIsQuoteDropdownOpen] = useState(true);
  const [weather, setWeather] = useState<WeatherState>({
    temperature: null,
    description: 'Checking sky',
    location: 'Brisbane',
    loading: true,
  });

  // Stores
  const [timetableEntries, setTimetableEntries] = useState<any[]>([]);
  const [todos, setTodos] = useState<TodoTask[]>([]);
  const [assessments, setAssessments] = useState<Deadline[]>([]);
  const [recentNote, setRecentNote] = useState<Note | null>(null);
  const [nextHomeworkSession, setNextHomeworkSession] = useState<HomeworkSession | null>(null);
  const [examPlans, setExamPlans] = useState<ExamPlan[]>([]);
  const [assignmentCoachPlans, setAssignmentCoachPlans] = useState<AssignmentPlan[]>([]);
  const [quickAccessItems, setQuickAccessItems] = useLocalStorage<QuickAccessItem[]>('dashboard-quick-access', []);
  const [quickAccessDialogSlot, setQuickAccessDialogSlot] = useState<number | null>(null);
  const [selectedQuickAccessCategory, setSelectedQuickAccessCategory] = useState('Planning');
  const [selectedQuickAccessFeature, setSelectedQuickAccessFeature] = useState('learning-profile');
  const [isDeadlinesDialogOpen, setIsDeadlinesDialogOpen] = useState(false);

  const { achievements } = useAchievementsStore();
  const { notes } = useClassNotesStore();
  const { level, points } = useStudyGameStore();
  const quotePeople = useMemo(
    () => Array.from(new Set(quoteChips.map((chip) => chip.person))),
    [],
  );
  const activeQuotePeople = preferredQuotePeople.length
    ? preferredQuotePeople
    : quotePeople.slice(0, 8);
  const visibleQuotes = useMemo(() => {
    const filtered = quoteChips.filter((chip) => activeQuotePeople.includes(chip.person));
    return filtered.length ? filtered : quoteChips.slice(0, 5);
  }, [activeQuotePeople]);

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  const todayEntries = timetableEntries
    .filter(e => {
      const entryDay = e.day.trim().toLowerCase();
      const currentDay = day.trim().toLowerCase();
      const match = entryDay === currentDay;
      return match;
    })
    .sort((a, b) => {
      const startA = parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1]);
      const startB = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]);
      return startA - startB;
    });

  const currentClass = todayEntries.find(e => {
    const start = parseInt(e.startTime.split(':')[0]) * 60 + parseInt(e.startTime.split(':')[1]);
    const end = parseInt(e.endTime.split(':')[0]) * 60 + parseInt(e.endTime.split(':')[1]);
    return currentTime >= start && currentTime < end;
  });

  const nextClass = currentClass || todayEntries.find(e => {
    const start = parseInt(e.startTime.split(':')[0]) * 60 + parseInt(e.startTime.split(':')[1]);
    return start > currentTime;
  });

  const schoolDayStart = todayEntries.length > 0 
    ? Math.min(...todayEntries.map(e => parseInt(e.startTime.split(':')[0]) * 60 + parseInt(e.startTime.split(':')[1])))
    : 0;
  const schoolDayEnd = todayEntries.length > 0 
    ? Math.max(...todayEntries.map(e => parseInt(e.endTime.split(':')[0]) * 60 + parseInt(e.endTime.split(':')[1])))
    : 0;
  
  let schoolDayStatus = "left in the school day.";
  let schoolDayCountdown = "00:00:00";

  if (todayEntries.length === 0) {
    schoolDayStatus = "No classes today.";
    schoolDayCountdown = "00:00:00";
  } else if (currentTime < schoolDayStart) {
    const timeUntilStart = schoolDayStart - currentTime;
    const hoursUntil = Math.floor(timeUntilStart / 60);
    const minutesUntil = timeUntilStart % 60;
    schoolDayStatus = `Starts in ${hoursUntil}h ${minutesUntil}m`;
    schoolDayCountdown = "00:00:00";
  } else if (currentTime > schoolDayEnd) {
    schoolDayStatus = "School day is over.";
    schoolDayCountdown = "00:00:00";
  } else {
    const end = new Date(now);
    end.setHours(Math.floor(schoolDayEnd / 60), schoolDayEnd % 60, 0, 0);
    const timeLeftMs = Math.max(0, end.getTime() - now.getTime());
    const hoursLeft = Math.floor(timeLeftMs / 3600000);
    const minutesLeft = Math.floor((timeLeftMs % 3600000) / 60000);
    const secondsLeft = Math.floor((timeLeftMs % 60000) / 1000);
    schoolDayCountdown = `${hoursLeft.toString().padStart(2, '0')}:${minutesLeft.toString().padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`;
    schoolDayStatus = "left in the school day.";
  }

  const toggleTodo = async (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    try {
      await updateDoc(doc(db, 'todos', id), {
        completed: !todo.completed
      });
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNow(new Date()), 1000);
    
    let unsubscribeTimetable = () => {};
    let unsubscribeTodos = () => {};
    let unsubscribeDeadlines = () => {};
    let unsubscribeRecentNote = () => {};
    let unsubscribeHomework = () => {};
    let unsubscribeExamPlans = () => {};
    let unsubscribeAssignmentPlans = () => {};

    if (user) {
      unsubscribeTimetable = onSnapshot(doc(db, 'timetables', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setTimetableEntries(docSnap.data().entries || []);
        } else {
          setTimetableEntries([]);
        }
      }, (error) => {
        console.error("Timetable listener error:", error);
      });

      const todosQuery = query(
        collection(db, 'todos'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      unsubscribeTodos = onSnapshot(todosQuery, (snapshot) => {
        setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TodoTask)));
      }, (error) => {
        console.error("Todos listener error:", error);
      });

      const deadlinesQuery = query(
        collection(db, 'deadlines'),
        where('userId', '==', user.uid),
        orderBy('dueDate', 'asc')
      );

      unsubscribeDeadlines = onSnapshot(deadlinesQuery, (snapshot) => {
        setAssessments(snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate
          } as Deadline;
        }));
      }, (error) => {
        console.error("Deadlines listener error:", error);
      });

      const notesQuery = query(
        collection(db, 'notes'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      unsubscribeRecentNote = onSnapshot(notesQuery, (snapshot) => {
        if (!snapshot.empty) {
          setRecentNote({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Note);
        } else {
          setRecentNote(null);
        }
      }, (error) => {
        console.error("Notes listener error:", error);
      });

      unsubscribeHomework = onSnapshot(doc(db, 'homeworkPlans', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const sessions = data.plan || [];
          // Find next session
          const now = new Date();
          const day = now.toLocaleDateString('en-US', { weekday: 'long' });
          const currentTime = now.getHours() * 60 + now.getMinutes();
          
          const nextSession = sessions.find((s: HomeworkSession) => {
            const sessionTime = parseInt(s.timeOfDay.split(':')[0]) * 60 + parseInt(s.timeOfDay.split(':')[1]);
            return s.day.toLowerCase() === day.toLowerCase() && sessionTime >= currentTime;
          }) || sessions[0]; // Fallback to first session if none today
          
          setNextHomeworkSession(nextSession || null);
        } else {
          setNextHomeworkSession(null);
        }
      }, (error) => {
        console.error("Homework listener error:", error);
      });

      const examPlansQuery = query(
        collection(db, 'examPlans'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc')
      );

      unsubscribeExamPlans = onSnapshot(examPlansQuery, (snapshot) => {
        setExamPlans(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ExamPlan)));
      }, (error) => {
        console.error("Exam plans listener error:", error);
      });

      const assignmentPlansQuery = query(
        collection(db, 'assignmentPlans'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc'),
        limit(3)
      );

      unsubscribeAssignmentPlans = onSnapshot(assignmentPlansQuery, (snapshot) => {
        setAssignmentCoachPlans(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AssignmentPlan)));
      }, (error) => {
        console.error("Assignment Coach listener error:", error);
      });
    }

    return () => {
      clearInterval(timer);
      unsubscribeTimetable();
      unsubscribeTodos();
      unsubscribeDeadlines();
      unsubscribeRecentNote();
      unsubscribeHomework();
      unsubscribeExamPlans();
      unsubscribeAssignmentPlans();
    };
  }, [user]);

  useEffect(() => {
    if (schoolDayStatus === "School day is over.") {
      import('canvas-confetti').then((module) => {
        const confetti = module.default || module;
        if (typeof confetti === 'function') {
          try {
            confetti({
              particleCount: 150,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (e) {
            console.error("Confetti error:", e);
          }
        }
      });
    }
  }, [schoolDayStatus]);

  useEffect(() => {
    const quoteTimer = setInterval(() => {
      setQuoteIndex((index) => (index + 1) % visibleQuotes.length);
    }, 12000);

    return () => clearInterval(quoteTimer);
  }, [visibleQuotes.length]);

  useEffect(() => {
    setQuoteIndex(0);
  }, [visibleQuotes.length]);

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async (latitude: number, longitude: number, location: string) => {
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: 'temperature_2m,weather_code',
          timezone: 'auto',
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
        if (!response.ok) throw new Error('Weather request failed');
        const data = await response.json();
        if (cancelled) return;

        const code = Number(data?.current?.weather_code);
        setWeather({
          temperature: typeof data?.current?.temperature_2m === 'number' ? Math.round(data.current.temperature_2m) : null,
          description: weatherCodeDescriptions[code] || 'Current weather',
          location,
          loading: false,
        });
      } catch (error) {
        if (cancelled) return;
        setWeather({
          temperature: null,
          description: 'Weather unavailable',
          location,
          loading: false,
        });
      }
    };

    const fallbackToBrisbane = () => loadWeather(-27.4698, 153.0251, 'Brisbane');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => loadWeather(position.coords.latitude, position.coords.longitude, 'Near you'),
        fallbackToBrisbane,
        { timeout: 5000, maximumAge: 600000 },
      );
    } else {
      fallbackToBrisbane();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!quickAccessCategories.includes(selectedQuickAccessCategory)) {
      setSelectedQuickAccessCategory(quickAccessCategories[0] || 'Planning');
    }

    if (!quickAccessFeatures.some((feature) => feature.id === selectedQuickAccessFeature)) {
      setSelectedQuickAccessFeature(quickAccessFeatures[0]?.id || 'learning-profile');
    }
  }, [quickAccessCategories, quickAccessFeatures, selectedQuickAccessCategory, selectedQuickAccessFeature]);

  if (!mounted) return null;

  const latestExamPlan = examPlans[0] || null;
  const nextStudyTopic = latestExamPlan
    ? [...latestExamPlan.topics].sort((a, b) => a.confidence - b.confidence)[0] || null
    : null;

  const openExamHub = () => {
    if (isUniversityPortal) {
      navigate(studentPortalExamPortalPath(activePortal));
      return;
    }
    navigate(studentPortalExamPortalPath(activePortal), { state: { openExam: true } });
  };

  const renderCard = (cardId: CardId) => {
    switch (cardId) {
      case 'studyPet':
        return <StudyPet key={cardId} />;

      case 'focus':
        return <TodaysFocus key={cardId} />;

      case 'todo':
        return (
          <Card key={cardId} className={cn(dashboardGlassCard, "overflow-hidden rounded-[40px]")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                To-do List
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {todos.map((todo) => (
                    <div 
                      key={todo.id} 
                      className={cn("flex items-center gap-3 rounded-2xl p-3 transition-colors group cursor-pointer hover:bg-white/45", dashboardGlassInset)}
                      onClick={() => toggleTodo(todo.id)}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        todo.completed ? "bg-emerald-500 border-emerald-500" : "border-zinc-200 group-hover:border-emerald-500/50"
                      )}>
                        {todo.completed && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <span className={cn(
                        "text-sm font-bold transition-all",
                        todo.completed ? "text-zinc-400 line-through" : "text-zinc-900"
                      )}>
                        {todo.text}
                      </span>
                    </div>
                  ))}
                  {todos.length === 0 && (
                    <div className="text-center py-12 opacity-50">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">All caught up!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        );

      case 'deadlines':
        return (
          <Card key={cardId} className={cn(dashboardGlassCard, "overflow-hidden rounded-[40px]")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {assessments.slice(0, 3).map((assessment) => (
                  <div key={assessment.id} className={cn("flex items-center justify-between rounded-2xl p-3 transition-colors hover:bg-white/45", dashboardGlassInset)}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        assessment.priority === 'high' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : assessment.priority === 'medium' ? "bg-orange-500" : "bg-blue-500"
                      )} />
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{assessment.title}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{assessment.course}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest border-2 border-zinc-100 rounded-lg">
                      {assessment.dueDate}
                    </Badge>
                  </div>
                ))}
                {assessments.length === 0 && (
                  <div className="text-center py-10 opacity-50">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No deadlines</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'achievements':
        return (
          <Card key={cardId} className={cn(dashboardGlassCard, "overflow-hidden rounded-[40px]")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <span>Lvl {level} Progress</span>
                    <span>{points % 100}/100 XP</span>
                  </div>
                  <Progress value={points % 100} className="h-1.5 bg-zinc-100" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {achievements.slice(0, 4).map((achievement) => (
                    <div 
                      key={achievement.id} 
                      className={cn(
                        "aspect-square rounded-xl flex items-center justify-center text-xl transition-all duration-300",
                        achievement.unlockedAt ? "bg-amber-50 shadow-sm border border-amber-100 scale-100" : "bg-zinc-50 grayscale opacity-20 scale-90"
                      )}
                      title={achievement.title}
                    >
                      {achievement.icon}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'continueWork':
        return (
          <Card key={cardId} className={cn(dashboardGlassCard, "overflow-hidden rounded-[40px]")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                Recent Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentNote ? (
                <div className={cn("p-4 rounded-2xl transition-colors group cursor-pointer", recentNote.color)}>
                  <p className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">{recentNote.title}</p>
                  <p className="text-xs text-zinc-700 mt-1 line-clamp-2">{recentNote.text}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-2">{new Date(recentNote.updatedAt).toLocaleDateString()}</p>
                </div>
              ) : (
                <div className="text-center py-10 opacity-50">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No recent notes</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  const onDragEnd: OnDragEndResponder = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newLayout = { ...layout };
    const sourceCol = [...newLayout.columns[source.droppableId]];
    const destCol = source.droppableId === destination.droppableId 
      ? sourceCol 
      : [...newLayout.columns[destination.droppableId]];

    const [movedItem] = sourceCol.splice(source.index, 1);
    destCol.splice(destination.index, 0, movedItem);

    newLayout.columns[source.droppableId] = sourceCol;
    if (source.droppableId !== destination.droppableId) {
      newLayout.columns[destination.droppableId] = destCol;
    }

    setLayout(newLayout);
  };

  const topChipBaseClass =
    "group relative overflow-hidden border p-4 text-left shadow-[0_22px_60px_rgba(15,23,42,0.22),0_8px_24px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.78),inset_0_-18px_36px_rgba(255,255,255,0.12)] backdrop-blur-3xl backdrop-saturate-150 transition-all before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.38),rgba(255,255,255,0.08)_42%,rgba(255,255,255,0.18)_100%)] before:mix-blend-soft-light after:pointer-events-none after:absolute after:inset-px after:border after:border-white/35 after:shadow-[inset_0_0_30px_rgba(255,255,255,0.18)] hover:-translate-y-0.5 hover:shadow-[0_26px_70px_rgba(15,23,42,0.28),0_10px_28px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-18px_36px_rgba(255,255,255,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30";
  const topChipShapeClass = isUniversityPortal
    ? "rounded-[38px] before:rounded-[38px] after:rounded-[33px] shadow-[0_28px_80px_rgba(15,23,42,0.16),0_12px_32px_rgba(255,255,255,0.16),inset_0_1px_0_rgba(255,255,255,0.82),inset_0_-24px_42px_rgba(255,255,255,0.14)] hover:shadow-[0_34px_90px_rgba(15,23,42,0.18),0_14px_36px_rgba(255,255,255,0.2),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-24px_42px_rgba(255,255,255,0.18)]"
    : "rounded-2xl before:rounded-2xl after:rounded-[15px]";

  const getDesktopTopChipClass = () =>
    cn(
      topChipBaseClass,
      topChipShapeClass,
      isUniversityPortal ? "aspect-[0.95]" : "aspect-square",
    );

  const phoneTopChipClasses: Record<string, string> = {
    welcome: "col-span-1 min-h-[118px]",
    nextClass: "col-span-1 min-h-[96px]",
    schoolDay: "col-span-1 min-h-[118px]",
    assignment: "col-span-1 min-h-[96px]",
    nextTodo: "col-span-1 min-h-[118px]",
    studyNow: "col-span-1 min-h-[118px]",
    weather: "col-span-1 min-h-[118px]",
    quote: "col-span-1 min-h-[118px]",
    newsletter: "col-span-2 min-h-[116px]",
  };

  const getTopChipClass = (key: keyof typeof phoneTopChipClasses) =>
    cn(
      topChipBaseClass,
      topChipShapeClass,
      isPhone ? phoneTopChipClasses[key] : getDesktopTopChipClass(),
    );

  const WelcomeCard = () => (
    <Card className={cn(getTopChipClass('welcome'), "border-indigo-200/80 bg-indigo-600 text-white")}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.32),transparent_34%),linear-gradient(135deg,rgba(79,70,229,1),rgba(147,51,234,0.86))]" />
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className={cn("flex w-fit items-center rounded-full bg-white/20 font-bold text-white backdrop-blur-md", isPhone ? "px-2 py-1 text-[8px]" : "px-2 py-1 text-[9px]")}>
          <Sparkles className="h-3 w-3 mr-1" />
          Exam Season
        </div>
        <div className="space-y-1">
          <h1 className={cn("font-black leading-tight tracking-tight", isPhone ? "text-[1.7rem]" : "text-xl")}>
            Welcome back, {user?.displayName?.split(' ')[0] || 'Scholar'}!
          </h1>
          <p className={cn("font-semibold text-indigo-50", isPhone ? "text-[11px] leading-4" : "text-xs")}>
            85% of weekly goals complete.
          </p>
        </div>
      </div>
      <GraduationCap className="absolute -right-4 -bottom-4 h-20 w-20 text-white/15 -rotate-12" />
    </Card>
  );

  const nextTodoItem = todos.filter(t => !t.completed).sort((a, b) => {
    // Sort by createdAt desc to get the latest one, or just take the first from the query which is already sorted
    return 0; 
  })[0];
  
  const nextAssessmentItem = assessments
    .filter(a => !a.completed)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const nextAssessmentPriority = nextAssessmentItem?.priority
    ? `Priority: ${nextAssessmentItem.priority.charAt(0).toUpperCase()}${nextAssessmentItem.priority.slice(1)}`
    : 'Priority: None';

  const formatDueDateTime = (rawDate?: string) => {
    if (!rawDate) return { date: "None due", time: "" };
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return { date: rawDate, time: "" };

    const date = parsed.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = parsed.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return { date, time: `Due ${time}` };
  };

  const nextAssignmentDue = formatDueDateTime(nextAssessmentItem?.dueDate);
  const readableDate = now.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const readableTime = now.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !isArmyTime,
  });
  const currentQuote = visibleQuotes[quoteIndex % visibleQuotes.length];
  const assignmentDeadlines = assessments
    .filter((assessment) => !assessment.completed && assessment.type === 'assignment')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const visibleAssignmentDeadlines = assignmentDeadlines.slice(0, 2);
  const latestAssignmentPlan = assignmentCoachPlans[0] || null;
  const latestAssignmentPlanCompletedTasks = latestAssignmentPlan
    ? latestAssignmentPlan.steps.reduce((sum, step) => sum + step.tasks.filter((task) => task.completed).length, 0)
    : 0;
  const latestAssignmentPlanTaskCount = latestAssignmentPlan
    ? latestAssignmentPlan.steps.reduce((sum, step) => sum + step.tasks.length, 0)
    : 0;

  const openAssignmentCoach = () => {
    navigate(studentPortalAssignmentCoachPath(activePortal, latestAssignmentPlan?.id));
  };

  const openRubricMarker = () => {
    navigate(`${studentPortalAssignmentCoachPath(activePortal, latestAssignmentPlan?.id)}#rubric-marker`);
  };

  const selectedCategoryFeatures = quickAccessFeatures.filter(
    (feature) => feature.category === selectedQuickAccessCategory,
  );
  const selectedQuickAccess = quickAccessFeatures.find((feature) => feature.id === selectedQuickAccessFeature) || selectedCategoryFeatures[0];

  const TodayWeatherCard = () => (
    <Card className={cn(getTopChipClass('weather'), "border-teal-200/80 bg-white/70 text-zinc-950")}>
      <div className="relative z-10 flex h-full flex-col justify-start">
        <div className={cn("flex flex-col justify-between border-b border-teal-100/80", isPhone ? "pb-3" : "flex-[0.9] pb-2")}>
          <div className="flex items-center justify-between gap-2">
            <ChipLabel icon={TimerReset} className="text-amber-700">Today</ChipLabel>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-lg border-amber-200 bg-amber-50/80 px-2 text-[10px] font-black text-amber-800 hover:bg-amber-100"
              onClick={() => setIsArmyTime(!isArmyTime)}
            >
              {isArmyTime ? '12 HR' : '24 HR'}
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-xl font-black leading-none text-zinc-950">{readableTime}</p>
            <p className="truncate text-xs font-black text-amber-700">{readableDate}</p>
          </div>
        </div>

        <div className={cn("flex flex-col justify-start", isPhone ? "pt-3" : "flex-[0.95] pt-2")}>
          <ChipLabel icon={CloudSun} className="text-teal-700">Weather</ChipLabel>
          <div className="min-w-0 space-y-1 pt-1">
            <p className="text-2xl font-black leading-none text-teal-700">
              {weather.loading ? '--' : weather.temperature !== null ? `${weather.temperature}°C` : 'N/A'}
            </p>
            <p className="text-[11px] font-bold leading-4 text-teal-800 break-words">
              <span className="line-clamp-2 block">
                {weather.description} · {weather.location}
              </span>
            </p>
          </div>
        </div>
      </div>
    </Card>
  );

  const AssignmentCard = () => (
    <button className={cn(getTopChipClass('assignment'), "border-rose-200/80 bg-rose-600 text-white")} onClick={() => navigate(studentPortalToolPath(activePortal, 'deadlines'))}>
      <div className="flex h-full flex-col justify-between">
        <ChipLabel icon={Calendar} className="text-rose-50">Assignment</ChipLabel>
        <div className="space-y-1">
          <p className={cn("font-black uppercase tracking-wider text-rose-100", isPhone ? "text-[9px]" : "text-[10px]")}>
            {nextAssessmentPriority}
          </p>
          <p className={cn("line-clamp-2 font-black leading-tight text-white", isPhone ? "text-base" : "text-lg")}>{nextAssessmentItem ? nextAssessmentItem.title : "No assignments"}</p>
          <p className={cn("font-bold text-rose-50", isPhone ? "text-[11px]" : "text-xs")}>{nextAssignmentDue.date}</p>
        </div>
        <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-rose-100" />
      </div>
    </button>
  );

  const NextClassCard = () => (
    <button className={cn(getTopChipClass('nextClass'), "border-sky-200/80 bg-sky-50 text-sky-950")} onClick={() => navigate(studentPortalPath(activePortal, '/timetable'))}>
      <div className="flex h-full flex-col justify-between">
        <ChipLabel icon={Clock} className="text-sky-700">Next Class</ChipLabel>
        <div className="space-y-1">
          <p className={cn("truncate font-black text-sky-950", isPhone ? "text-base leading-tight" : "text-lg")}>{nextClass ? nextClass.subject : "No class"}</p>
          <p className={cn("font-bold text-sky-700", isPhone ? "text-[11px] leading-4" : "text-xs")}>{nextClass ? `${nextClass.startTime} - ${nextClass.endTime}` : "Enjoy your break"}</p>
        </div>
        <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-sky-500" />
      </div>
    </button>
  );

  const SchoolDayCard = () => (
    <Card className={cn(getTopChipClass('schoolDay'), "border-violet-200/80 bg-violet-600 text-white")}>
      <div className="flex h-full flex-col justify-between">
        <ChipLabel icon={Clock} className="text-violet-100">School Day</ChipLabel>
        <div className="space-y-1">
          <p className={cn("font-black text-white", isPhone ? "text-base leading-tight" : "text-lg")}>{schoolDayCountdown}</p>
          <p className={cn("line-clamp-2 font-bold text-violet-100", isPhone ? "text-[11px] leading-4" : "text-xs")}>{schoolDayStatus}</p>
        </div>
      </div>
    </Card>
  );

  const NextTodoCard = () => (
    <button className={cn(getTopChipClass('nextTodo'), "border-emerald-200/80 bg-emerald-50 text-emerald-950")} onClick={() => navigate(studentPortalToolPath(activePortal, 'todo'))}>
      <div className="flex h-full flex-col justify-between">
        <ChipLabel icon={CheckCircle2} className="text-emerald-700">Next To-Do</ChipLabel>
        <div className="space-y-1">
          <p className={cn("line-clamp-2 font-black leading-tight text-emerald-950", isPhone ? "text-base" : "text-lg")}>{nextTodoItem ? nextTodoItem.text : "All caught up"}</p>
          <p className={cn("font-bold text-emerald-700", isPhone ? "text-[11px]" : "text-xs")}>{nextTodoItem ? "Keep going" : "Great job"}</p>
        </div>
        <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-emerald-500" />
      </div>
    </button>
  );

  const StudyNowCard = () => (
    <button className={cn(getTopChipClass('studyNow'), "border-violet-200/80 bg-violet-50 text-violet-950")} onClick={openExamHub}>
      <div className="flex h-full flex-col justify-between">
        <ChipLabel icon={Sparkles} className="text-violet-700">Start Studying Now</ChipLabel>
        <div className="space-y-1">
          <p className={cn("line-clamp-3 font-black leading-tight text-violet-950", isPhone ? "text-[1.8rem]" : "text-2xl")}>
            Start studying now
          </p>
        </div>
        <ChevronRight className="absolute bottom-3 right-3 h-4 w-4 text-violet-500" />
      </div>
    </button>
  );

  const QuoteCard = () => (
    <Card className={cn(getTopChipClass('quote'), "border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-950")}>
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <ChipLabel icon={Quote} className="text-fuchsia-700">Quote</ChipLabel>
          <button
            type="button"
            aria-label="Edit quote people"
            onClick={(event) => {
              event.stopPropagation();
              setIsQuotePreferencesOpen(true);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-fuchsia-200 bg-white/85 text-fuchsia-700 shadow-sm transition hover:bg-fuchsia-100"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          <p className={cn("line-clamp-3 font-black leading-snug text-fuchsia-950", isPhone ? "text-[13px]" : "text-sm")}>"{currentQuote.quote}"</p>
          <p className={cn("truncate font-bold text-fuchsia-700", isPhone ? "text-[11px]" : "text-xs")}>{currentQuote.person}</p>
        </div>
      </div>
    </Card>
  );

  const NewsletterCard = () => (
    <Card className={cn(getTopChipClass('newsletter'), "border-zinc-300/80 bg-zinc-900 text-white")}>
      <div className="flex h-full flex-col justify-between">
        <ChipLabel icon={Newspaper} className="text-zinc-100">Newsletter</ChipLabel>
        <div className="space-y-1">
          <p className={cn("line-clamp-2 font-black leading-tight text-white", isPhone ? "text-base" : "text-lg")}>School newsletter</p>
          <p className={cn("line-clamp-2 font-bold text-zinc-200", isPhone ? "text-[11px] leading-4" : "text-xs")}>Exam tips, events, and weekly notices.</p>
        </div>
      </div>
    </Card>
  );

  const openQuickAccessDialog = (slot: number) => {
    const existingItem = quickAccessItems[slot];
    const existingFeature = quickAccessFeatures.find((feature) => feature.id === existingItem?.featureId);
    const defaultFeature = existingFeature || quickAccessFeatures[0];

    setSelectedQuickAccessCategory(defaultFeature.category);
    setSelectedQuickAccessFeature(defaultFeature.id);
    setQuickAccessDialogSlot(slot);
  };

  const saveQuickAccessItem = () => {
    if (quickAccessDialogSlot === null || !selectedQuickAccess) return;

    setQuickAccessItems((items) => {
      const nextItems = [...items];
      nextItems[quickAccessDialogSlot] = {
        id: `quick-access-${quickAccessDialogSlot}`,
        featureId: selectedQuickAccess.id,
      };
      return nextItems;
    });
    setQuickAccessDialogSlot(null);
  };

  const clearQuickAccessItem = () => {
    if (quickAccessDialogSlot === null) return;

    setQuickAccessItems((items) => {
      const nextItems = [...items];
      nextItems[quickAccessDialogSlot] = {
        id: `quick-access-${quickAccessDialogSlot}`,
        featureId: '',
      };
      return nextItems;
    });
    setQuickAccessDialogSlot(null);
  };

  const ChipLabel = ({ icon: Icon, children, className }: { icon: LucideIcon; children: ReactNode; className?: string }) => (
    <div className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider", className)}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );

  return (
    <div
      className={cn(
        "dashboard-glass relative isolate min-h-[calc(100vh-80px)] overflow-hidden bg-[#f4f5f7] pb-20",
        isPhone ? "-m-4 rounded-[28px] p-4" : isTablet ? "-m-6 rounded-[32px] p-6 sm:p-8" : "-m-8 p-6 sm:p-8 lg:p-12"
      )}
      style={dashboardBackgroundStyle}
    >
      {hasDashboardBackgroundImage ? (
        <div
          className={cn(
            'pointer-events-none absolute -inset-6 z-0',
            dashboardBackground.overlay === 'blur' ? 'scale-105 blur-xl opacity-80' : 'opacity-100',
          )}
          style={dashboardBackgroundImageStyle}
        />
      ) : null}
      {hasDashboardBackgroundImage && dashboardBackground.overlay !== 'blur' ? (
        <div className="pointer-events-none absolute inset-0 z-0 bg-white/12" />
      ) : null}
      <div className="pointer-events-none absolute left-[6%] top-20 z-0 h-52 w-52 rounded-full bg-sky-300/45 blur-3xl" />
      <div className="pointer-events-none absolute right-[10%] top-8 z-0 h-80 w-80 rounded-full bg-violet-300/30 blur-[76px]" />
      <div className="pointer-events-none absolute bottom-40 left-[18%] z-0 h-56 w-56 rounded-full bg-amber-300/35 blur-[64px]" />
      <div className="pointer-events-none absolute bottom-10 right-[18%] z-0 h-44 w-80 rounded-full bg-emerald-300/25 blur-[72px]" />
      <div className="pointer-events-none absolute left-[42%] top-[36%] z-0 h-72 w-72 rounded-[42%] bg-white/65 blur-3xl" />

      <div className={cn("relative z-10", isPhone ? "space-y-5" : "space-y-8")}>
      {/* Compact widget chips */}
      {isPhone ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="flex flex-col gap-3">
              <WelcomeCard />
              <SchoolDayCard />
              <NextTodoCard />
              <TodayWeatherCard />
            </div>
            <div className="flex flex-col gap-3">
              <NextClassCard />
              <AssignmentCard />
              <StudyNowCard />
              <QuoteCard />
            </div>
          </div>
          {!isUniversityPortal ? <NewsletterCard /> : null}
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-8">
        <WelcomeCard />
        <NextClassCard />
        <SchoolDayCard />
        <AssignmentCard />

        <NextTodoCard />
        <StudyNowCard />

        <TodayWeatherCard />

        <QuoteCard />
        {!isUniversityPortal ? <NewsletterCard /> : null}
      </div>
      )}

      <section className={cn('gap-4', isPhone ? 'space-y-4' : 'grid lg:grid-cols-3')}>
        <button
          type="button"
          onClick={() => navigate(studentPortalToolPath(activePortal, 'lecture-lift'))}
          className={cn(
            dashboardGlassCard,
            'group relative overflow-hidden rounded-[40px] p-6 text-left transition-all hover:-translate-y-0.5 hover:bg-white/45',
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_42%)]" />
          <div className="relative flex h-full flex-col justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/85 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                  <Sparkles className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">Lecture Lift</p>
                  <h2 className="mt-1 text-[clamp(1.5rem,2vw,2.15rem)] font-black leading-[1] tracking-tight text-zinc-950">Lecture Lift</h2>
                </div>
              </div>
              <p className="mt-5 text-base font-semibold leading-7 text-zinc-600">
                Enhance lecture notes with transcript context.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="max-w-[62%] text-sm font-black leading-6 text-zinc-950">
                Merge notes, flashcards, resources, and exam hints.
              </p>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
                Open Lift
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={openAssignmentCoach}
          className={cn(
            dashboardGlassCard,
            'group relative overflow-hidden rounded-[40px] p-6 text-left transition-all hover:-translate-y-0.5 hover:bg-white/45',
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.22),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.18),transparent_45%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="max-w-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100/85 text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                  <BookOpen className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-700">Assignment Coach</p>
                  <h2 className="mt-1 text-[clamp(1.8rem,2.4vw,2.8rem)] font-black leading-[0.95] tracking-tight text-zinc-950">Assignment Coach</h2>
                </div>
              </div>
              <p className="mt-5 text-base font-semibold leading-7 text-zinc-600">
                Start and plan an assignment now.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="max-w-[60%] text-sm font-black leading-6 text-zinc-950">
                Build the task breakdown and study routine.
              </p>
              <span className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
                Open coach
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={openRubricMarker}
          className={cn(
            dashboardGlassCard,
            'group relative overflow-hidden rounded-[40px] p-6 text-left transition-all hover:-translate-y-0.5 hover:bg-white/45',
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.16),transparent_42%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="max-w-xl">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/85 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                  <ClipboardCheck className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">Mark My Assignment</p>
                  <h2 className="mt-1 text-[clamp(1.6rem,2.2vw,2.5rem)] font-black leading-[0.98] tracking-tight text-zinc-950">Mark My Assignment</h2>
                </div>
              </div>
              <p className="mt-5 text-base font-semibold leading-7 text-zinc-600">
                Open the rubric marker and review the draft against the criteria.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="max-w-[62%] text-sm font-black leading-6 text-zinc-950">
                Get marked now
              </p>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white">
                Open marker
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </button>
      </section>

      {!isUniversityPortal ? (
        <section>
          <DailyQuizCard />
        </section>
      ) : null}

      <NextStepsCards />

      {/* Your Workspace Section */}
      <section className="space-y-6">
        {/* Dashboard Controls */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1">
            <h2 className={cn("font-black tracking-tight text-zinc-900", isPhone ? "text-2xl" : "text-3xl")}>Your Workspace</h2>
            <p className="text-sm font-medium text-zinc-500">Drag and drop cards to organize your perfect study environment.</p>
          </div>
          <Button 
            variant="outline" 
            size="lg" 
            onClick={() => setIsSettingsOpen(true)}
            className="h-12 rounded-2xl border border-white/60 bg-white/35 px-6 font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-all hover:bg-white/55"
          >
            <LayoutIcon className="mr-2 h-5 w-5 text-zinc-400" />
            Customize Layout
          </Button>
        </div>

        {/* Main Grid - 4x2 Layout */}
        <div className={cn("grid gap-4 lg:gap-6", isPhone ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4")}>
          {/* Next Homework Card */}
          <Card 
            className={cn(dashboardGlassCard, "group relative overflow-hidden rounded-[40px] transition-all hover:-translate-y-0.5 hover:bg-white/45")}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-emerald-500" />
                Exam Hub Focus
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextStudyTopic ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-lg font-bold text-zinc-900 line-clamp-2">{nextStudyTopic.name}</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1">
                      {latestExamPlan?.subject || 'Exam hub'} • {nextStudyTopic.confidence}% confidence
                    </p>
                  </div>
                  <Button 
                    onClick={openExamHub}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs h-8"
                  >
                    Open Study Hub
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={openExamHub}>
                  <p className="text-lg font-bold text-zinc-300 italic font-medium">No study topic yet</p>
                  <ChevronRight className="h-5 w-5 text-zinc-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card
            className={cn(dashboardGlassCard, "group relative overflow-hidden rounded-[40px] transition-all hover:-translate-y-0.5 hover:bg-white/45")}
            onClick={() =>
              navigate(
                studentPortalToolPath(
                  activePortal,
                  isUniversityPortal ? 'math-solver' : 'calculator',
                ),
              )
            }
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {isUniversityPortal ? (
                  <>
                    <PenTool className="h-4 w-4 text-cyan-500" />
                    Guided Math Solver
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 text-amber-500" />
                    Calculator
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-full min-h-[96px] flex-col justify-between space-y-3">
                <div>
                  <p className="text-lg font-bold leading-tight text-zinc-900">
                    {isUniversityPortal ? 'Open the guided math solver' : 'Open the calculator fast'}
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-zinc-500">
                    {isUniversityPortal
                      ? 'Work through equations, calculus, and proofs with checked steps directly from the university dashboard.'
                      : 'Jump straight into quick sums, formulas, and working without leaving the dashboard flow.'}
                  </p>
                </div>
                <div className={cn("inline-flex items-center gap-2 text-xs font-black", isUniversityPortal ? "text-cyan-600" : "text-amber-600")}>
                  {isUniversityPortal ? 'Open math solver' : 'Open calculator'} <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(dashboardGlassCard, "group relative overflow-hidden rounded-[40px] transition-all hover:-translate-y-0.5 hover:bg-white/45")}
            onClick={() => navigate(studentPortalToolPath(activePortal, 'learning-profile'))}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <Brain className="h-4 w-4 text-violet-500" />
                How Do I Learn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-full min-h-[120px] flex-col justify-between">
                <div>
                  <p className="text-lg font-bold leading-tight text-zinc-900">Find my best study method</p>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-zinc-500">
                    Build a learning profile for homework, quizzes, and revision.
                  </p>
                </div>
                <Button className="mt-4 h-8 w-full rounded-xl bg-violet-600 text-xs font-bold text-white hover:bg-violet-700">
                  Open Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(dashboardGlassCard, "group relative cursor-pointer overflow-hidden rounded-[40px] transition-all hover:-translate-y-0.5 hover:bg-white/45")}
            onClick={() => setIsDeadlinesDialogOpen(true)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  <ClipboardList className="h-4 w-4 text-rose-500" />
                  Deadlines
                </CardTitle>
                {assignmentDeadlines.length > 0 ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition-colors group-hover:bg-rose-600 group-hover:text-white">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {assignmentDeadlines.length > 0 ? (
                <div className="space-y-2">
                  {visibleAssignmentDeadlines.map((assignment) => {
                    const due = formatDueDateTime(assignment.dueDate);
                    return (
                      <div key={assignment.id} className="rounded-2xl border border-white/45 bg-white/35 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-zinc-900">{assignment.title}</p>
                            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-zinc-400">{assignment.course}</p>
                          </div>
                          <span className="shrink-0 rounded-lg bg-rose-50 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-rose-600">
                            {assignment.priority}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] font-bold text-rose-600">{due.date}</p>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between rounded-2xl border border-dashed border-rose-200/80 bg-rose-50/50 px-3 py-2 text-rose-700">
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {assignmentDeadlines.length > 2
                        ? `${assignmentDeadlines.length - 2} more deadline${assignmentDeadlines.length - 2 === 1 ? '' : 's'}`
                        : 'Tap for expanded view'}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[120px] flex-col justify-between">
                  <p className="text-lg font-bold text-zinc-300 italic">No assignments</p>
                  <div className="inline-flex items-center gap-2 text-xs font-black text-rose-600">
                    View deadlines <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {[0, 1, 2, 3].map((slot) => {
            const quickAccessItem = quickAccessItems[slot];
            const feature = quickAccessFeatures.find((item) => item.id === quickAccessItem?.featureId);
            const Icon = feature?.icon || Plus;

            return (
              <Card
                key={`quick-access-${slot}`}
                className={cn(
                  dashboardGlassCard,
                  "flex min-h-[180px] flex-col justify-center rounded-[40px] p-6 transition-all hover:-translate-y-0.5 hover:bg-white/45",
                  !feature && "items-center text-center opacity-80",
                )}
              >
                {feature ? (
                  <div className="flex h-full flex-col justify-between">
                    <button
                      type="button"
                      onClick={() => navigate(feature.path)}
                      className="flex flex-1 flex-col text-left"
                    >
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/55 text-emerald-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{feature.category}</p>
                      <p className="mt-2 text-lg font-black leading-tight text-zinc-900">{feature.label}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => openQuickAccessDialog(slot)}
                      className="mt-4 w-fit rounded-xl border border-white/55 bg-white/45 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:bg-white/70"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openQuickAccessDialog(slot)}
                    className="flex h-full flex-col items-center justify-center gap-3"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/35 text-zinc-400">
                      <Plus className="h-7 w-7" />
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Add Quick Access</p>
                      <p className="mt-1 text-xs font-semibold text-zinc-400">Choose a page or function.</p>
                    </div>
                  </button>
                )}
              </Card>
            );
          })}
        </div>

        <Dialog open={isDeadlinesDialogOpen} onOpenChange={setIsDeadlinesDialogOpen}>
          <DialogContent className="max-w-2xl rounded-[28px] border border-white/70 bg-white/90 shadow-2xl backdrop-blur-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight text-zinc-900">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                  <ClipboardList className="h-5 w-5" />
                </span>
                Assignment deadlines
              </DialogTitle>
              <DialogDescription className="text-sm font-medium leading-6 text-zinc-500">
                View the full assignment deadline list without stretching your dashboard card.
              </DialogDescription>
            </DialogHeader>

            {assignmentDeadlines.length > 0 ? (
              <ScrollArea className="max-h-[420px] pr-3">
                <div className="space-y-3">
                  {assignmentDeadlines.map((assignment) => {
                    const due = formatDueDateTime(assignment.dueDate);
                    return (
                      <button
                        key={`deadline-dialog-${assignment.id}`}
                        type="button"
                        onClick={() => navigate(studentPortalToolPath(activePortal, 'deadlines'))}
                        className="w-full rounded-3xl border border-zinc-100 bg-white/70 p-4 text-left transition hover:border-rose-200 hover:bg-rose-50/60"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-lg font-black text-zinc-900">{assignment.title}</p>
                            <p className="mt-1 truncate text-xs font-bold uppercase tracking-widest text-zinc-400">{assignment.course}</p>
                          </div>
                          <span className="shrink-0 rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600">
                            {assignment.priority}
                          </span>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-rose-600">{due.date}</p>
                          <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-zinc-400">
                            Open <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/80 p-8 text-center">
                <p className="text-lg font-black text-zinc-900">No assignment deadlines yet</p>
                <p className="mt-2 text-sm font-semibold text-zinc-500">Add one from the Deadlines page or Assignment Portal.</p>
              </div>
            )}

            <Button
              type="button"
              onClick={() => navigate(studentPortalToolPath(activePortal, 'deadlines'))}
              className="rounded-2xl bg-rose-600 font-black text-white hover:bg-rose-700"
            >
              Open Deadlines Page
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog open={quickAccessDialogSlot !== null} onOpenChange={(open) => !open && setQuickAccessDialogSlot(null)}>
          <DialogContent className="rounded-[28px] border border-white/70 bg-white/90 shadow-2xl backdrop-blur-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight text-zinc-900">Add quick access</DialogTitle>
              <DialogDescription className="text-sm font-medium leading-6 text-zinc-500">
                Pick a category, then choose the page or function you want pinned in this workspace slot.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div>
                <label htmlFor="quick-access-category" className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Category
                </label>
                <select
                  id="quick-access-category"
                  value={selectedQuickAccessCategory}
                  onChange={(event) => {
                    const nextCategory = event.target.value;
                    const nextFeature = quickAccessFeatures.find((feature) => feature.category === nextCategory);
                    setSelectedQuickAccessCategory(nextCategory);
                    setSelectedQuickAccessFeature(nextFeature?.id || quickAccessFeatures[0].id);
                  }}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-emerald-400"
                >
                  {quickAccessCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="quick-access-feature" className="mb-2 block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  Feature
                </label>
                <select
                  id="quick-access-feature"
                  value={selectedQuickAccessFeature}
                  onChange={(event) => setSelectedQuickAccessFeature(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-emerald-400"
                >
                  {selectedCategoryFeatures.map((feature) => (
                    <option key={feature.id} value={feature.id}>{feature.label}</option>
                  ))}
                </select>
              </div>

              {selectedQuickAccess ? (
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Preview</p>
                  <p className="mt-2 text-lg font-black text-zinc-900">{selectedQuickAccess.label}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-500">This will open {selectedQuickAccess.path} from your workspace.</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearQuickAccessItem}
                  className="rounded-2xl border-zinc-200 font-black text-zinc-500"
                >
                  Clear Slot
                </Button>
                <Button
                  type="button"
                  onClick={saveQuickAccessItem}
                  className="rounded-2xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700"
                >
                  Add Feature
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isQuotePreferencesOpen} onOpenChange={setIsQuotePreferencesOpen}>
          <DialogContent className="max-h-[88vh] overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-2xl">
            <div className="flex max-h-[88vh] flex-col">
            <DialogHeader>
              <div className="px-6 pt-6">
                <DialogTitle className="pr-10 text-2xl font-black tracking-tight text-zinc-900">Choose quote people</DialogTitle>
              </div>
              <DialogDescription className="px-6 text-sm font-medium leading-6 text-zinc-500">
                Pick as many people as you want. The quote card will rotate through everyone you tick.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="space-y-5">
              <div className="rounded-3xl border border-zinc-200 bg-white/90">
                <button
                  type="button"
                  onClick={() => setIsQuoteDropdownOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quote People</p>
                    <p className="mt-1 text-sm font-bold text-zinc-800">
                      {activeQuotePeople.length} selected
                    </p>
                  </div>
                  <ChevronRight className={cn("h-5 w-5 text-zinc-500 transition-transform", isQuoteDropdownOpen && "rotate-90")} />
                </button>

                {isQuoteDropdownOpen ? (
                  <div className="border-t border-zinc-100 px-3 pb-3 pt-2">
                    <ScrollArea className="h-72 pr-3">
                      <div className="space-y-1">
                        {quotePeople.map((person) => {
                          const isSelected = activeQuotePeople.includes(person);
                          return (
                            <label
                              key={person}
                              className={cn(
                                "flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-3 transition",
                                isSelected ? "bg-fuchsia-50" : "bg-transparent hover:bg-zinc-50",
                              )}
                            >
                              <span className="text-sm font-bold text-zinc-800">{person}</span>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setPreferredQuotePeople((current) => {
                                    const baseline = current.length ? current : quotePeople.slice(0, 8);
                                    if (baseline.includes(person)) {
                                      const next = baseline.filter((item) => item !== person);
                                      return next.length ? next : baseline;
                                    }
                                    return [...baseline, person];
                                  });
                                }}
                                className="h-4 w-4 rounded border-zinc-300 accent-fuchsia-600"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-fuchsia-100 bg-fuchsia-50/80 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-fuchsia-700">Selected</p>
                <p className="mt-2 text-sm font-semibold text-zinc-700">
                  {activeQuotePeople.length} people chosen
                </p>
              </div>
            </div>
            </div>

            <div className="border-t border-zinc-100 bg-white/95 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setIsQuotePreferencesOpen(false)}
                  className="rounded-2xl bg-fuchsia-600 px-5 font-black text-white hover:bg-fuchsia-700"
                >
                  Done
                </Button>
              </div>
            </div>
            </div>
          </DialogContent>
        </Dialog>
      </section>

      {/* Insights & Progress Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
            <div className="h-px w-8 bg-zinc-300" />
            Insights & Progress
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DailyHomeworkPlan />
            {/* Mood Tracker */}
            <MoodHistoryChart />
            <ClassProgressChart />
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">
            <div className="h-px w-8 bg-zinc-300" />
            Performance Analytics
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
            <Card className={cn(dashboardGlassCard, "relative overflow-hidden rounded-[34px]")}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.36),_transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03))] backdrop-blur-[3px]" />
              <CardContent className="relative z-10 flex h-full flex-col gap-3 p-4">
                <GoalsVsActualChartPanel />
                <WeeklyActivityChartPanel />
              </CardContent>
            </Card>
            <FocusVsReviewChart />
            <MonthlyMoodChart />
          </div>
        </section>

      <DashboardLayoutSettings 
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        layout={layout}
        onSave={setLayout}
      />
      </div>
    </div>
  );
}
