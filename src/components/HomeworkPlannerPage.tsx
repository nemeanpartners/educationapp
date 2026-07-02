import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  Milestone,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { geminiGenerateContent } from '../services/geminiProxy';
import { db, auth } from '../firebase';
import { doc, getDoc, onSnapshot, setDoc } from '@/lib/portal-firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { normalizePlan, HomeworkSession as NormalizedHomeworkSession } from '../lib/homework';
import { detectStudentPortalFromPath, studentPortalPath, studentPortalToolPath } from '@/lib/portal';
import {
  StudyPlanningAvailabilityBlock,
  StudyPlanningCommitment,
  StudyPlanningCourse,
  StudyPlanningGradeGoal,
  StudyPlanningProfile,
} from '../types';

interface HomeworkSession extends NormalizedHomeworkSession {}

interface SemesterDirectionMemo {
  overview: string;
  workloadVerdict: string;
  priorityCourses: {
    course: string;
    riskLevel: 'low' | 'medium' | 'high';
    why: string;
    weeklyFocusHours: number;
  }[];
  bottlenecks: string[];
  gradeGoalRisks: string[];
  nextActions: string[];
  guardrails: string[];
}

interface RecoveryPlanResult {
  rebuildSummary: string;
  plan: HomeworkSession[];
}

const STUDY_TECHNIQUES = [
  { id: 'pomodoro', name: 'Pomodoro Technique', desc: '25-min focus, 5-min break' },
  { id: 'feynman', name: 'Feynman Technique', desc: 'Teach it to understand it' },
  { id: 'active-recall', name: 'Active Recall', desc: 'Test yourself' },
  { id: 'spaced-repetition', name: 'Spaced Repetition', desc: 'Review at increasing intervals' },
  { id: 'blurting', name: 'Blurting', desc: 'Write down everything you know' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const ASSESSMENT_TYPES = ['assignment', 'exam', 'quiz', 'reading', 'project', 'other'] as const;

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyPlanningProfile(userId: string): StudyPlanningProfile {
  const now = new Date().toISOString();
  return {
    userId,
    courses: [],
    gradeGoals: [],
    availability: [],
    commitments: [],
    createdAt: now,
    updatedAt: now,
  };
}

function getTechniqueLabel(id: string) {
  return STUDY_TECHNIQUES.find((item) => item.id === id)?.name || id;
}

function minutesBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return Math.max(0, end - start);
}

function hoursLabel(minutes: number) {
  return `${(minutes / 60).toFixed(1)}h`;
}

function estimateAssessmentHours(type: string, weighting: number) {
  const typeBase =
    type === 'exam' ? 8 :
    type === 'project' ? 9 :
    type === 'assignment' ? 6 :
    type === 'quiz' ? 2 :
    type === 'reading' ? 1.5 :
    3;
  return Math.max(1, typeBase + weighting * 0.18);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function HomeworkPlannerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [preferences, setPreferences] = useState({
    studyTime: '',
    techniques: [] as string[],
    additionalNotes: '',
  });
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [newSlot, setNewSlot] = useState({ subject: '', technique: '', time: '', day: 'Monday' });
  const [generatedPlan, setGeneratedPlan] = useState<HomeworkSession[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showTechniqueModal, setShowTechniqueModal] = useState(false);
  const [modalAnswers, setModalAnswers] = useState({
    studyPreference: '',
    studyChallenge: '',
  });
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [planningProfile, setPlanningProfile] = useState<StudyPlanningProfile | null>(null);
  const [planningStatus, setPlanningStatus] = useState<string | null>(null);
  const [semesterDirection, setSemesterDirection] = useState<SemesterDirectionMemo | null>(null);
  const [directionLoading, setDirectionLoading] = useState(false);
  const [recoveryContext, setRecoveryContext] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<RecoveryPlanResult | null>(null);

  const [courseDraft, setCourseDraft] = useState({
    name: '',
    code: '',
    recommendedStudyHours: '4',
  });
  const [assessmentDraft, setAssessmentDraft] = useState({
    courseId: '',
    title: '',
    type: 'assignment' as StudyPlanningCourse['assessments'][number]['type'],
    dueDate: '',
    weighting: '20',
  });
  const [goalDraft, setGoalDraft] = useState({
    title: '',
    targetGrade: '',
    courseId: '',
  });
  const [availabilityDraft, setAvailabilityDraft] = useState({
    day: 'Monday',
    startTime: '09:00',
    endTime: '11:00',
  });
  const [commitmentDraft, setCommitmentDraft] = useState({
    title: '',
    day: 'Monday',
    startTime: '17:00',
    endTime: '18:30',
  });

  const persistPlanningProfile = async (nextProfile: StudyPlanningProfile) => {
    setPlanningProfile(nextProfile);
    setPlanningStatus('Saving planning inputs...');
    try {
      await setDoc(doc(db, 'studyPlanningProfiles', nextProfile.userId), nextProfile, { merge: true });
      setPlanningStatus('Planning inputs saved.');
      window.setTimeout(() => setPlanningStatus(null), 2000);
    } catch (error) {
      console.error('Failed to save planning profile:', error);
      setPlanningStatus('Could not save planning inputs.');
    }
  };

  useEffect(() => {
    let unsubHomework: (() => void) | undefined;
    let unsubPlanning: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setInitialLoading(false);
        return;
      }

      setInitialLoading(true);
      setLoadError(null);

      unsubHomework = onSnapshot(
        doc(db, 'homeworkPlans', user.uid),
        (docSnap) => {
          if (docSnap.exists()) {
            const planData = docSnap.data();
            const plan = normalizePlan(planData.plan || []);
            setGeneratedPlan(plan);
            setSemesterDirection((planData.strategy as SemesterDirectionMemo | null) || null);
            const savedRecovery = planData.recoveryPlan as RecoveryPlanResult | undefined;
            setRecoveryResult(
              savedRecovery
                ? {
                    ...savedRecovery,
                    plan: normalizePlan(savedRecovery.plan || []),
                  }
                : null,
            );
          }
          setInitialLoading(false);
        },
        () => {
          setLoadError('Failed to load your plan. Please try again.');
          setInitialLoading(false);
        },
      );

      unsubPlanning = onSnapshot(
        doc(db, 'studyPlanningProfiles', user.uid),
        (docSnap) => {
          if (docSnap.exists()) {
            setPlanningProfile(docSnap.data() as StudyPlanningProfile);
          } else {
            setPlanningProfile(createEmptyPlanningProfile(user.uid));
          }
        },
        () => {
          setPlanningProfile(createEmptyPlanningProfile(user.uid));
        },
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubHomework) unsubHomework();
      if (unsubPlanning) unsubPlanning();
    };
  }, []);

  const totalAvailableMinutes = useMemo(
    () => (planningProfile?.availability || []).reduce((sum, block) => sum + minutesBetween(block.startTime, block.endTime), 0),
    [planningProfile],
  );
  const totalCommitmentMinutes = useMemo(
    () => (planningProfile?.commitments || []).reduce((sum, block) => sum + minutesBetween(block.startTime, block.endTime), 0),
    [planningProfile],
  );
  const totalRecommendedStudyHours = useMemo(
    () => (planningProfile?.courses || []).reduce((sum, course) => sum + Number(course.recommendedStudyHours || 0), 0),
    [planningProfile],
  );
  const upcomingAssessments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (planningProfile?.courses || [])
      .flatMap((course) => course.assessments.map((assessment) => ({ ...assessment, courseName: course.name })))
      .filter((assessment) => assessment.dueDate >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [planningProfile]);
  const weeklyFreeHours = Math.max(0, totalAvailableMinutes - totalCommitmentMinutes) / 60;
  const overloadRisk = weeklyFreeHours > 0 && totalRecommendedStudyHours > weeklyFreeHours;
  const soonThreshold = addDays(new Date(), 14).toISOString().slice(0, 10);
  const coursePressure = useMemo(() => {
    return (planningProfile?.courses || []).map((course) => {
      const dueSoon = course.assessments.filter((assessment) => assessment.dueDate >= new Date().toISOString().slice(0, 10) && assessment.dueDate <= soonThreshold);
      const dueSoonWeighting = dueSoon.reduce((sum, assessment) => sum + assessment.weighting, 0);
      const dueSoonHours = dueSoon.reduce((sum, assessment) => sum + estimateAssessmentHours(assessment.type, assessment.weighting), 0);
      const linkedGoal = planningProfile?.gradeGoals.find((goal) => goal.courseId === course.id);
      const needsHighPerformance =
        linkedGoal && /(hd|high distinction|distinction|a\+|a|6|7|85|90)/i.test(linkedGoal.targetGrade);
      const riskLevel =
        dueSoonWeighting >= 50 || dueSoonHours >= 10 || (needsHighPerformance && course.recommendedStudyHours < 4)
          ? 'high'
          : dueSoonWeighting >= 25 || dueSoonHours >= 5
            ? 'medium'
            : 'low';

      return {
        courseId: course.id,
        courseName: course.name,
        recommendedStudyHours: course.recommendedStudyHours,
        dueSoon,
        dueSoonWeighting,
        dueSoonHours,
        linkedGoal,
        riskLevel,
      };
    });
  }, [planningProfile, soonThreshold]);
  const deadlineClusters = useMemo(() => {
    const counts = new Map<string, { total: number; labels: string[] }>();
    upcomingAssessments.forEach((assessment) => {
      const current = counts.get(assessment.dueDate) || { total: 0, labels: [] };
      counts.set(assessment.dueDate, {
        total: current.total + 1,
        labels: [...current.labels, `${assessment.courseName}: ${assessment.title}`],
      });
    });
    return Array.from(counts.entries())
      .filter(([, value]) => value.total >= 2)
      .map(([date, value]) => ({ date, total: value.total, labels: value.labels }));
  }, [upcomingAssessments]);
  const gradeGoalRiskNotes = useMemo(() => {
    if (!planningProfile) return [];
    return planningProfile.gradeGoals.flatMap((goal) => {
      const linkedCourse = planningProfile.courses.find((course) => course.id === goal.courseId);
      if (!linkedCourse) return [];
      const courseRisk = coursePressure.find((item) => item.courseId === linkedCourse.id);
      if (!courseRisk) return [];
      if (courseRisk.riskLevel === 'high') {
        return [`${linkedCourse.name} has a demanding next two weeks against the goal "${goal.targetGrade}".`];
      }
      if (linkedCourse.recommendedStudyHours < 3) {
        return [`${linkedCourse.name} is targeting "${goal.targetGrade}" but only has ${linkedCourse.recommendedStudyHours} recommended study hours saved.`];
      }
      return [];
    });
  }, [planningProfile, coursePressure]);

  const addManualSlot = async () => {
    if (!newSlot.subject || !newSlot.time || !newSlot.technique) return;
    const session: HomeworkSession = {
      subject: newSlot.subject,
      technique: newSlot.technique,
      duration: '1 hour',
      timeOfDay: newSlot.time,
      day: newSlot.day,
    };
    const updatedPlan = generatedPlan ? [...generatedPlan, session] : [session];
    const normalized = normalizePlan(updatedPlan);
    setGeneratedPlan(normalized);
    setNewSlot({ subject: '', technique: '', time: '', day: 'Monday' });
    setShowAddSlotModal(false);

    const user = auth.currentUser;
    if (user) {
      await setDoc(doc(db, 'homeworkPlans', user.uid), {
        userId: user.uid,
        plan: normalized,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    }
  };

  const getRecommendation = () => {
    if (modalAnswers.studyPreference === 'In short, focused bursts with breaks.') {
      setRecommendation('We recommend the Pomodoro Technique: 25 minutes of intense focus followed by a 5-minute break.');
    } else if (modalAnswers.studyPreference === 'By testing myself on what I know.') {
      setRecommendation('We recommend Active Recall: Actively test yourself on the material instead of passively rereading.');
    } else if (modalAnswers.studyPreference === 'By explaining concepts in simple terms.') {
      setRecommendation('We recommend the Feynman Technique: Try to explain the concept in simple terms as if teaching it to someone else.');
    } else {
      setRecommendation('Try a mix of techniques to see what works best for you.');
    }
  };

  const addCourse = async () => {
    const user = auth.currentUser;
    const currentProfile = planningProfile || (user ? createEmptyPlanningProfile(user.uid) : null);
    if (!user || !currentProfile || !courseDraft.name.trim()) return;

    const nextProfile: StudyPlanningProfile = {
      ...currentProfile,
      courses: [
        ...currentProfile.courses,
        {
          id: createId(),
          name: courseDraft.name.trim(),
          code: courseDraft.code.trim() || undefined,
          recommendedStudyHours: Math.max(0, Number(courseDraft.recommendedStudyHours) || 0),
          assessments: [],
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    setCourseDraft({ name: '', code: '', recommendedStudyHours: '4' });
    await persistPlanningProfile(nextProfile);
  };

  const removeCourse = async (courseId: string) => {
    if (!planningProfile) return;
    const nextProfile = {
      ...planningProfile,
      courses: planningProfile.courses.filter((course) => course.id !== courseId),
      gradeGoals: planningProfile.gradeGoals.filter((goal) => goal.courseId !== courseId),
      updatedAt: new Date().toISOString(),
    };
    await persistPlanningProfile(nextProfile);
  };

  const addAssessment = async () => {
    if (!planningProfile || !assessmentDraft.courseId || !assessmentDraft.title.trim() || !assessmentDraft.dueDate) return;
    const nextProfile = {
      ...planningProfile,
      courses: planningProfile.courses.map((course) =>
        course.id !== assessmentDraft.courseId
          ? course
          : {
              ...course,
              assessments: [
                ...course.assessments,
                {
                  id: createId(),
                  title: assessmentDraft.title.trim(),
                  type: assessmentDraft.type,
                  dueDate: assessmentDraft.dueDate,
                  weighting: Math.max(0, Number(assessmentDraft.weighting) || 0),
                },
              ],
            },
      ),
      updatedAt: new Date().toISOString(),
    };
    setAssessmentDraft({ courseId: '', title: '', type: 'assignment', dueDate: '', weighting: '20' });
    await persistPlanningProfile(nextProfile);
  };

  const removeAssessment = async (courseId: string, assessmentId: string) => {
    if (!planningProfile) return;
    const nextProfile = {
      ...planningProfile,
      courses: planningProfile.courses.map((course) =>
        course.id !== courseId ? course : { ...course, assessments: course.assessments.filter((item) => item.id !== assessmentId) },
      ),
      updatedAt: new Date().toISOString(),
    };
    await persistPlanningProfile(nextProfile);
  };

  const addGradeGoal = async () => {
    const user = auth.currentUser;
    const currentProfile = planningProfile || (user ? createEmptyPlanningProfile(user.uid) : null);
    if (!user || !currentProfile || !goalDraft.title.trim() || !goalDraft.targetGrade.trim()) return;

    const nextProfile = {
      ...currentProfile,
      gradeGoals: [
        ...currentProfile.gradeGoals,
        {
          id: createId(),
          title: goalDraft.title.trim(),
          targetGrade: goalDraft.targetGrade.trim(),
          courseId: goalDraft.courseId || undefined,
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    setGoalDraft({ title: '', targetGrade: '', courseId: '' });
    await persistPlanningProfile(nextProfile);
  };

  const removeGradeGoal = async (goalId: string) => {
    if (!planningProfile) return;
    const nextProfile = {
      ...planningProfile,
      gradeGoals: planningProfile.gradeGoals.filter((goal) => goal.id !== goalId),
      updatedAt: new Date().toISOString(),
    };
    await persistPlanningProfile(nextProfile);
  };

  const addAvailability = async () => {
    const user = auth.currentUser;
    const currentProfile = planningProfile || (user ? createEmptyPlanningProfile(user.uid) : null);
    if (!user || !currentProfile) return;
    const nextProfile = {
      ...currentProfile,
      availability: [
        ...currentProfile.availability,
        {
          id: createId(),
          ...availabilityDraft,
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    await persistPlanningProfile(nextProfile);
  };

  const removeAvailability = async (id: string) => {
    if (!planningProfile) return;
    const nextProfile = {
      ...planningProfile,
      availability: planningProfile.availability.filter((item) => item.id !== id),
      updatedAt: new Date().toISOString(),
    };
    await persistPlanningProfile(nextProfile);
  };

  const addCommitment = async () => {
    const user = auth.currentUser;
    const currentProfile = planningProfile || (user ? createEmptyPlanningProfile(user.uid) : null);
    if (!user || !currentProfile || !commitmentDraft.title.trim()) return;
    const nextProfile = {
      ...currentProfile,
      commitments: [
        ...currentProfile.commitments,
        {
          id: createId(),
          ...commitmentDraft,
          title: commitmentDraft.title.trim(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };
    setCommitmentDraft({ title: '', day: 'Monday', startTime: '17:00', endTime: '18:30' });
    await persistPlanningProfile(nextProfile);
  };

  const removeCommitment = async (id: string) => {
    if (!planningProfile) return;
    const nextProfile = {
      ...planningProfile,
      commitments: planningProfile.commitments.filter((item) => item.id !== id),
      updatedAt: new Date().toISOString(),
    };
    await persistPlanningProfile(nextProfile);
  };

  const generatePlanner = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const timetableDoc = await getDoc(doc(db, 'timetables', user.uid));
      const classTimetable = timetableDoc.exists() ? timetableDoc.data().entries : [];
      const profile = planningProfile || createEmptyPlanningProfile(user.uid);
      const commitmentSummary = profile.commitments.map((item) => `${item.day} ${item.startTime}-${item.endTime}: ${item.title}`);
      const availabilitySummary = profile.availability.map((item) => `${item.day} ${item.startTime}-${item.endTime}`);
      const courseSummary = profile.courses.map((course) => ({
        course: course.name,
        code: course.code || '',
        recommendedStudyHours: course.recommendedStudyHours,
        assessments: course.assessments,
      }));
      const gradeGoalSummary = profile.gradeGoals.map((goal) => ({
        title: goal.title,
        targetGrade: goal.targetGrade,
        course: profile.courses.find((course) => course.id === goal.courseId)?.name || 'General',
      }));

      const prompt = `Create a realistic weekly study plan.

Student preferences:
- Preferred study times: ${preferences.studyTime || 'Not specified'}
- Preferred techniques: ${preferences.techniques.map(getTechniqueLabel).join(', ') || 'Not specified'}
- Extra notes: ${preferences.additionalNotes || 'None'}

Academic inputs:
- Courses and workload: ${JSON.stringify(courseSummary)}
- Grade goals: ${JSON.stringify(gradeGoalSummary)}
- Weekly availability blocks: ${JSON.stringify(availabilitySummary)}
- Personal commitments: ${JSON.stringify(commitmentSummary)}
- Existing class timetable: ${JSON.stringify(classTimetable)}

Rules:
- Schedule only inside the student's availability blocks.
- Never place study sessions inside commitments or timetable classes.
- Prefer higher-weighted and closer assessments first.
- Balance urgent assessment work with ongoing weekly study.
- Use the student's preferred techniques where appropriate.
- Return a practical weekly plan as JSON only.

For each session include:
- subject: string
- technique: string
- duration: string
- timeOfDay: string (HH:mm)
- day: string`;

      const response = await geminiGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                technique: { type: 'string' },
                duration: { type: 'string' },
                timeOfDay: { type: 'string' },
                day: { type: 'string' },
              },
              required: ['subject', 'technique', 'duration', 'timeOfDay', 'day'],
            },
          },
        },
      });

      const plan: HomeworkSession[] = JSON.parse(response.text || '[]');
      const processedPlan = normalizePlan(plan);
      setGeneratedPlan(processedPlan);
      await setDoc(doc(db, 'homeworkPlans', user.uid), {
        userId: user.uid,
        plan: processedPlan,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSemesterDirection = async () => {
    const user = auth.currentUser;
    const profile = planningProfile;
    if (!user || !profile) return;
    setDirectionLoading(true);
    try {
      const courseSummary = profile.courses.map((course) => ({
        course: course.name,
        code: course.code || '',
        recommendedStudyHours: course.recommendedStudyHours,
        assessments: course.assessments,
      }));
      const gradeGoalSummary = profile.gradeGoals.map((goal) => ({
        title: goal.title,
        targetGrade: goal.targetGrade,
        course: profile.courses.find((course) => course.id === goal.courseId)?.name || 'General',
      }));

      const response = await geminiGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a study strategist. Build a semester direction memo from the student's real workload.

Academic inputs:
- Courses and workload: ${JSON.stringify(courseSummary)}
- Grade goals: ${JSON.stringify(gradeGoalSummary)}
- Weekly availability hours: ${weeklyFreeHours.toFixed(1)}
- Personal commitments: ${JSON.stringify(profile.commitments)}
- Course pressure snapshot: ${JSON.stringify(coursePressure)}
- Deadline clusters: ${JSON.stringify(deadlineClusters)}

Return JSON only. Keep it realistic, specific, and practical. Explain where the student should invest time this semester and where the main academic risks are.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              overview: { type: 'string' },
              workloadVerdict: { type: 'string' },
              priorityCourses: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    course: { type: 'string' },
                    riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
                    why: { type: 'string' },
                    weeklyFocusHours: { type: 'number' },
                  },
                  required: ['course', 'riskLevel', 'why', 'weeklyFocusHours'],
                },
              },
              bottlenecks: { type: 'array', items: { type: 'string' } },
              gradeGoalRisks: { type: 'array', items: { type: 'string' } },
              nextActions: { type: 'array', items: { type: 'string' } },
              guardrails: { type: 'array', items: { type: 'string' } },
            },
            required: ['overview', 'workloadVerdict', 'priorityCourses', 'bottlenecks', 'gradeGoalRisks', 'nextActions', 'guardrails'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as SemesterDirectionMemo;
      setSemesterDirection(parsed);
      await setDoc(doc(db, 'homeworkPlans', user.uid), {
        userId: user.uid,
        strategy: parsed,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Semester direction error:', error);
    } finally {
      setDirectionLoading(false);
    }
  };

  const rebuildWeek = async () => {
    const user = auth.currentUser;
    const profile = planningProfile;
    if (!user || !profile || !recoveryContext.trim()) return;
    setRecoveryLoading(true);
    try {
      const response = await geminiGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: `The student is behind and needs a recovery week.

Recovery context:
- What happened: ${recoveryContext}
- Current generated plan: ${JSON.stringify(generatedPlan || [])}
- Courses: ${JSON.stringify(profile.courses)}
- Grade goals: ${JSON.stringify(profile.gradeGoals)}
- Availability: ${JSON.stringify(profile.availability)}
- Commitments: ${JSON.stringify(profile.commitments)}
- Upcoming assessments: ${JSON.stringify(upcomingAssessments.slice(0, 10))}

Return JSON only.
Rules:
- Rebuild only the next 7 days.
- Focus on highest-impact work first.
- Protect at least one lighter recovery block if the workload is extreme.
- Cut low-value tasks before cutting high-weight assessments.
- Keep the plan realistic and concise.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              rebuildSummary: { type: 'string' },
              plan: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    subject: { type: 'string' },
                    technique: { type: 'string' },
                    duration: { type: 'string' },
                    timeOfDay: { type: 'string' },
                    day: { type: 'string' },
                  },
                  required: ['subject', 'technique', 'duration', 'timeOfDay', 'day'],
                },
              },
            },
            required: ['rebuildSummary', 'plan'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}') as RecoveryPlanResult;
      const normalized = normalizePlan(parsed.plan || []);
      const nextRecovery = {
        rebuildSummary: parsed.rebuildSummary,
        plan: normalized,
      };
      setRecoveryResult(nextRecovery);
      setGeneratedPlan(normalized);
      await setDoc(doc(db, 'homeworkPlans', user.uid), {
        userId: user.uid,
        plan: normalized,
        recoveryPlan: nextRecovery,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Recovery planner error:', error);
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight">Study Planning Studio</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium text-zinc-500">
            Build the planning inputs the AI actually needs: your courses, assessment weightings, grade goals, and your real weekly availability.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(studentPortalToolPath(activePortal, 'learning-profile'))}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-100 transition-all shadow-sm"
          >
            <Brain className="h-5 w-5" />
            Use My Learning Style
          </button>
          <button
            onClick={() => navigate(studentPortalPath(activePortal, '/homework-timetable'), { state: { prefillPlan: generatedPlan ?? [] } })}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Calendar className="h-5 w-5" />
            View Homework Timetable
          </button>
        </div>
      </div>

      {planningStatus ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">
          {planningStatus}
        </div>
      ) : null}

      <div className="space-y-8">
        <section className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Courses</p>
              <p className="mt-2 text-3xl font-black text-zinc-900">{planningProfile?.courses.length || 0}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Assessments</p>
              <p className="mt-2 text-3xl font-black text-zinc-900">{upcomingAssessments.length}</p>
            </div>
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Free weekly time</p>
              <p className="mt-2 text-3xl font-black text-zinc-900">{hoursLabel(totalAvailableMinutes - totalCommitmentMinutes)}</p>
            </div>
            <div className={`rounded-3xl border p-5 shadow-sm ${overloadRisk ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Workload signal</p>
              <p className="mt-2 text-lg font-black text-zinc-900">{overloadRisk ? 'Overloaded' : 'Feasible'}</p>
            </div>
          </div>

          {overloadRisk ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
                <div>
                  <p className="font-black text-rose-900">Your current study demand is higher than your saved weekly free time.</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-rose-700">
                    Recommended hours across courses are {totalRecommendedStudyHours.toFixed(1)}h, but your availability minus commitments is about {weeklyFreeHours.toFixed(1)}h.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="h-7 w-7 text-amber-500" />
              <div>
                <h2 className="text-2xl font-black text-zinc-900">Smart Workload Analysis</h2>
                <p className="text-sm font-medium text-zinc-500">Flag bottlenecks, course pressure, and grade-goal risk before the week collapses.</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Deadline bottlenecks</p>
                <div className="mt-4 space-y-3">
                  {deadlineClusters.length ? deadlineClusters.map((cluster) => (
                    <div key={cluster.date} className="rounded-2xl bg-white px-4 py-3">
                      <p className="font-black text-zinc-900">{cluster.date}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-600">{cluster.total} assessments collide on this date.</p>
                    </div>
                  )) : (
                    <p className="text-sm font-medium leading-6 text-zinc-500">No same-day deadline clusters are currently saved.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Course pressure</p>
                <div className="mt-4 space-y-3">
                  {coursePressure.length ? coursePressure.map((item) => (
                    <div key={item.courseId} className="rounded-2xl bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-zinc-900">{item.courseName}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                          item.riskLevel === 'high'
                            ? 'bg-rose-100 text-rose-700'
                            : item.riskLevel === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.riskLevel} pressure
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                        {item.dueSoon.length} upcoming items in the next 14 days, {item.dueSoonWeighting}% total weighting, about {item.dueSoonHours.toFixed(1)}h estimated focused work.
                      </p>
                    </div>
                  )) : (
                    <p className="text-sm font-medium leading-6 text-zinc-500">Add courses and assessments to calculate pressure by subject.</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Grade-goal risk</p>
                <div className="mt-4 space-y-3">
                  {gradeGoalRiskNotes.length ? gradeGoalRiskNotes.map((note) => (
                    <div key={note} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-600">
                      {note}
                    </div>
                  )) : (
                    <p className="text-sm font-medium leading-6 text-zinc-500">No immediate grade-goal risk is being flagged from the saved inputs.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Brain className="h-7 w-7 text-sky-500" />
              <div>
                <h2 className="text-2xl font-black text-zinc-900">Syllabus and Assessments</h2>
                <p className="text-sm font-medium text-zinc-500">Store subjects, assessment deadlines, weightings, and recommended weekly study hours.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.6fr_auto]">
              <input
                value={courseDraft.name}
                onChange={(event) => setCourseDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Course or subject name"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
              />
              <input
                value={courseDraft.code}
                onChange={(event) => setCourseDraft((current) => ({ ...current, code: event.target.value }))}
                placeholder="Code (optional)"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
              />
              <input
                type="number"
                min={0}
                value={courseDraft.recommendedStudyHours}
                onChange={(event) => setCourseDraft((current) => ({ ...current, recommendedStudyHours: event.target.value }))}
                placeholder="Hours"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
              />
              <button onClick={addCourse} className="rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-black text-white hover:bg-zinc-800">
                Add course
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {(planningProfile?.courses || []).map((course) => (
                <div key={course.id} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-zinc-900">{course.name}</h3>
                      <p className="mt-1 text-sm font-medium text-zinc-500">
                        {course.code ? `${course.code} • ` : ''}{course.recommendedStudyHours}h recommended weekly study
                      </p>
                    </div>
                    <button onClick={() => removeCourse(course.id)} className="rounded-xl p-2 text-zinc-400 hover:bg-white hover:text-zinc-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.8fr_0.8fr_0.6fr_auto]">
                    <input
                      value={assessmentDraft.courseId === course.id ? assessmentDraft.title : ''}
                      onChange={(event) => setAssessmentDraft({ ...assessmentDraft, courseId: course.id, title: event.target.value })}
                      placeholder="Assessment title"
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <select
                      value={assessmentDraft.courseId === course.id ? assessmentDraft.type : 'assignment'}
                      onChange={(event) => setAssessmentDraft({ ...assessmentDraft, courseId: course.id, type: event.target.value as typeof assessmentDraft.type })}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                    >
                      {ASSESSMENT_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={assessmentDraft.courseId === course.id ? assessmentDraft.dueDate : ''}
                      onChange={(event) => setAssessmentDraft({ ...assessmentDraft, courseId: course.id, dueDate: event.target.value })}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={assessmentDraft.courseId === course.id ? assessmentDraft.weighting : '20'}
                      onChange={(event) => setAssessmentDraft({ ...assessmentDraft, courseId: course.id, weighting: event.target.value })}
                      placeholder="Weight %"
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <button onClick={addAssessment} className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-white hover:bg-sky-600">
                      Add
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {course.assessments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-500">
                        No assessments saved yet.
                      </div>
                    ) : (
                      course.assessments.map((assessment) => (
                        <div key={assessment.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                          <div>
                            <p className="font-black text-zinc-900">{assessment.title}</p>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                              {assessment.type} • {assessment.weighting}% • due {assessment.dueDate}
                            </p>
                          </div>
                          <button onClick={() => removeAssessment(course.id, assessment.id)} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Target className="h-7 w-7 text-emerald-500" />
              <div>
                <h2 className="text-2xl font-black text-zinc-900">Grade Goals</h2>
                <p className="text-sm font-medium text-zinc-500">Define course or semester targets so planning can prioritise against real outcomes.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
              <input
                value={goalDraft.title}
                onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Goal title"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
              />
              <input
                value={goalDraft.targetGrade}
                onChange={(event) => setGoalDraft((current) => ({ ...current, targetGrade: event.target.value }))}
                placeholder="Target grade"
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
              />
              <select
                value={goalDraft.courseId}
                onChange={(event) => setGoalDraft((current) => ({ ...current, courseId: event.target.value }))}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none"
              >
                <option value="">General / semester</option>
                {(planningProfile?.courses || []).map((course) => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
              <button onClick={addGradeGoal} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700">
                Add goal
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {(planningProfile?.gradeGoals || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-500">
                  No grade goals saved yet.
                </div>
              ) : (
                planningProfile?.gradeGoals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div>
                      <p className="font-black text-zinc-900">{goal.title}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                        {goal.targetGrade} • {planningProfile.courses.find((course) => course.id === goal.courseId)?.name || 'General'}
                      </p>
                    </div>
                    <button onClick={() => removeGradeGoal(goal.id)} className="rounded-xl p-2 text-zinc-400 hover:bg-white hover:text-zinc-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-7 w-7 text-violet-500" />
              <div>
                <h2 className="text-2xl font-black text-zinc-900">Weekly Availability and Commitments</h2>
                <p className="text-sm font-medium text-zinc-500">Show the AI when you can realistically study and what time is already taken.</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                <h3 className="text-lg font-black text-zinc-900">Available study blocks</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <select
                    value={availabilityDraft.day}
                    onChange={(event) => setAvailabilityDraft((current) => ({ ...current, day: event.target.value }))}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                  >
                    {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                  <input
                    type="time"
                    value={availabilityDraft.startTime}
                    onChange={(event) => setAvailabilityDraft((current) => ({ ...current, startTime: event.target.value }))}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                  />
                  <input
                    type="time"
                    value={availabilityDraft.endTime}
                    onChange={(event) => setAvailabilityDraft((current) => ({ ...current, endTime: event.target.value }))}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                  />
                  <button onClick={addAvailability} className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white hover:bg-zinc-800">
                    Add block
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(planningProfile?.availability || []).map((block) => (
                    <div key={block.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                      <div>
                        <p className="font-black text-zinc-900">{block.day}</p>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{block.startTime} - {block.endTime}</p>
                      </div>
                      <button onClick={() => removeAvailability(block.id)} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                <h3 className="text-lg font-black text-zinc-900">Personal commitments</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    value={commitmentDraft.title}
                    onChange={(event) => setCommitmentDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Sport, work, family, commute..."
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none md:col-span-2"
                  />
                  <select
                    value={commitmentDraft.day}
                    onChange={(event) => setCommitmentDraft((current) => ({ ...current, day: event.target.value }))}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                  >
                    {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="time"
                      value={commitmentDraft.startTime}
                      onChange={(event) => setCommitmentDraft((current) => ({ ...current, startTime: event.target.value }))}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                    />
                    <input
                      type="time"
                      value={commitmentDraft.endTime}
                      onChange={(event) => setCommitmentDraft((current) => ({ ...current, endTime: event.target.value }))}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                    />
                  </div>
                  <button onClick={addCommitment} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700 md:col-span-2">
                    Add commitment
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(planningProfile?.commitments || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                      <div>
                        <p className="font-black text-zinc-900">{item.title}</p>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{item.day} • {item.startTime} - {item.endTime}</p>
                      </div>
                      <button onClick={() => removeCommitment(item.id)} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-zinc-900">Study Preferences</h2>
                <p className="text-sm font-medium text-zinc-500">These preferences shape how the planner allocates sessions.</p>
              </div>
              <button
                onClick={() => setShowTechniqueModal(true)}
                className="flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
              >
                <HelpCircle className="h-4 w-4" />
                Find Yours
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">When do you like to study?</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Morning', 'Afternoon', 'Evening', 'Late Night'].map((time) => (
                    <label key={time} className="flex items-center gap-3 cursor-pointer rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <input
                        type="checkbox"
                        name="studyTime"
                        value={time}
                        checked={preferences.studyTime.includes(time)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPreferences((current) => ({
                            ...current,
                            studyTime: event.target.checked
                              ? current.studyTime
                                ? `${current.studyTime}, ${value}`
                                : value
                              : current.studyTime.replace(new RegExp(`,? ?${value}`), ''),
                          }));
                        }}
                        className="accent-sky-500 h-5 w-5"
                      />
                      <span className="font-bold text-zinc-700">{time}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">Study Techniques</label>
                <div className="grid gap-3">
                  {STUDY_TECHNIQUES.map((technique) => (
                    <label key={technique.id} className="flex items-center gap-3 cursor-pointer rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={preferences.techniques.includes(technique.id)}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            techniques: event.target.checked
                              ? [...current.techniques, technique.id]
                              : current.techniques.filter((item) => item !== technique.id),
                          }))
                        }
                        className="accent-sky-500 h-5 w-5"
                      />
                      <div>
                        <div className="font-bold text-zinc-700">{technique.name}</div>
                        <div className="text-xs text-zinc-400">{technique.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">Anything else to add?</label>
                <textarea
                  value={preferences.additionalNotes}
                  onChange={(event) => setPreferences((current) => ({ ...current, additionalNotes: event.target.value }))}
                  placeholder="e.g. I work on Saturday mornings and want more buffer before major assessments."
                  className="w-full h-24 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <button
                onClick={generatePlanner}
                disabled={loading || !preferences.studyTime || !planningProfile}
                className="w-full py-4 bg-sky-500 text-white rounded-2xl font-black hover:bg-sky-600 transition-all shadow-lg shadow-sky-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {generatedPlan ? 'Regenerate Realistic Planner' : 'Build My Study Plan'}
              </button>
            </div>
          </div>

          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
              <div className="flex items-center gap-3">
                <Milestone className="h-7 w-7 text-indigo-500" />
                <div>
                  <h2 className="text-2xl font-black text-zinc-900">AI Semester Direction</h2>
                  <p className="text-sm font-medium text-zinc-500">One strategic layer above the weekly planner so effort goes where academic impact is highest.</p>
                </div>
              </div>
              <button
                onClick={generateSemesterDirection}
                disabled={directionLoading || !planningProfile?.courses.length}
                className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {directionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {semesterDirection ? 'Refresh Direction Memo' : 'Build Direction Memo'}
              </button>
            </div>

            {semesterDirection ? (
              <div className="space-y-5">
                <div className="rounded-3xl bg-indigo-50 px-5 py-4">
                  <p className="text-sm font-medium leading-7 text-indigo-950">{semesterDirection.overview}</p>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-indigo-500">{semesterDirection.workloadVerdict}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Priority courses</p>
                    <div className="mt-4 space-y-3">
                      {semesterDirection.priorityCourses.map((item) => (
                        <div key={item.course} className="rounded-2xl bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-black text-zinc-900">{item.course}</p>
                            <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{item.weeklyFocusHours}h / week</span>
                          </div>
                          <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{item.why}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Immediate actions</p>
                    <div className="mt-4 space-y-3">
                      {semesterDirection.nextActions.map((action) => (
                        <div key={action} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-600">
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Bottlenecks</p>
                    <div className="mt-4 space-y-3">
                      {semesterDirection.bottlenecks.length ? semesterDirection.bottlenecks.map((item) => (
                        <div key={item} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-600">{item}</div>
                      )) : <p className="text-sm font-medium leading-6 text-zinc-500">No major bottlenecks were identified.</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Grade-goal risks</p>
                    <div className="mt-4 space-y-3">
                      {semesterDirection.gradeGoalRisks.length ? semesterDirection.gradeGoalRisks.map((item) => (
                        <div key={item} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-600">{item}</div>
                      )) : <p className="text-sm font-medium leading-6 text-zinc-500">No major grade-goal risks were identified.</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Guardrails</p>
                    <div className="mt-4 space-y-3">
                      {semesterDirection.guardrails.map((item) => (
                        <div key={item} className="rounded-2xl bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-600">{item}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm font-medium leading-6 text-zinc-500">
                Generate a semester memo to see where effort should go, which courses need defending, and where the main bottlenecks are likely to emerge.
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="h-7 w-7 text-rose-500" />
              <div>
                <h2 className="text-2xl font-black text-zinc-900">Recovery Mode</h2>
                <p className="text-sm font-medium text-zinc-500">When you fall behind, rebuild only the next 7 days instead of pretending the original plan still works.</p>
              </div>
            </div>

            <textarea
              value={recoveryContext}
              onChange={(event) => setRecoveryContext(event.target.value)}
              placeholder="Example: I lost Monday and Tuesday to work shifts, my lab report is due Friday, and I need the week rebuilt around the highest-impact tasks."
              className="h-28 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700 outline-none"
            />
            <button
              onClick={rebuildWeek}
              disabled={recoveryLoading || !recoveryContext.trim() || !planningProfile}
              className="mt-4 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {recoveryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Rebuild My Week
            </button>

            {recoveryResult ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-3xl bg-rose-50 px-5 py-4 text-sm font-medium leading-7 text-rose-950">
                  {recoveryResult.rebuildSummary}
                </div>
                <div className="grid gap-3">
                  {recoveryResult.plan.map((session, index) => (
                    <div key={`${session.day}-${session.timeOfDay}-${session.subject}-${index}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-black text-zinc-900">{session.subject}</p>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{session.day} • {session.timeOfDay} • {session.duration}</p>
                      </div>
                      <p className="mt-1 text-sm font-medium text-zinc-600">{session.technique}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-8">
          <div className="bg-white p-8 rounded-[32px] border border-zinc-200 shadow-sm min-h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 text-sky-500">
                <Sparkles className="h-8 w-8" />
                <h2 className="text-2xl font-black text-zinc-900">Your Personalized Academic Success Plan</h2>
              </div>
              {generatedPlan && (
                <button
                  onClick={() => setShowAddSlotModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-100 text-sky-700 rounded-xl font-bold hover:bg-sky-200 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Add Slot
                </button>
              )}
            </div>

            {initialLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="h-12 w-12 text-sky-500 animate-spin" />
                <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Checking for existing plan...</p>
              </div>
            ) : loadError ? (
              <div className="text-center py-20 text-red-500 font-bold">{loadError}</div>
            ) : generatedPlan ? (
              <div className="grid grid-cols-1 gap-4">
                {generatedPlan.map((session, index) => (
                  <motion.div
                    key={`${session.day}-${session.timeOfDay}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="p-6 bg-white rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-14 w-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center font-black text-lg">
                        {session.timeOfDay.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-black text-zinc-900 text-lg">{session.subject}</h3>
                        <p className="text-xs font-bold text-zinc-500">{session.day}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      <span>{session.technique}</span>
                      <span>{session.duration}</span>
                      <span>{session.timeOfDay}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 py-12">
                <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
                  <p className="font-black text-zinc-900">The planner now uses your real planning inputs.</p>
                  <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                    Add courses, assessment weightings, grade goals, and weekly availability first, then generate a plan.
                  </p>
                </div>
                <div className="grid gap-3">
                  {upcomingAssessments.slice(0, 4).map((assessment) => (
                    <div key={assessment.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                      <p className="font-black text-zinc-900">{assessment.title}</p>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{assessment.courseName} • {assessment.weighting}% • due {assessment.dueDate}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showAddSlotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl relative"
            >
              <button onClick={() => setShowAddSlotModal(false)} className="absolute top-4 right-4 p-2 hover:bg-zinc-100 rounded-full">
                <X className="h-5 w-5 text-zinc-400" />
              </button>
              <h2 className="text-2xl font-black text-zinc-900 mb-6">Add Custom Slot</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Subject" value={newSlot.subject} onChange={(event) => setNewSlot((current) => ({ ...current, subject: event.target.value }))} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm" />
                <select value={newSlot.technique} onChange={(event) => setNewSlot((current) => ({ ...current, technique: event.target.value }))} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm">
                  <option value="">Select Technique</option>
                  {STUDY_TECHNIQUES.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                </select>
                <input type="time" value={newSlot.time} onChange={(event) => setNewSlot((current) => ({ ...current, time: event.target.value }))} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm" />
                <select value={newSlot.day} onChange={(event) => setNewSlot((current) => ({ ...current, day: event.target.value }))} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm">
                  {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
                <button onClick={addManualSlot} className="w-full py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all">Add Slot</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTechniqueModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl relative"
            >
              <button
                onClick={() => {
                  setShowTechniqueModal(false);
                  setRecommendation(null);
                  setModalAnswers({ studyPreference: '', studyChallenge: '' });
                }}
                className="absolute top-4 right-4 p-2 hover:bg-zinc-100 rounded-full"
              >
                <X className="h-5 w-5 text-zinc-400" />
              </button>
              {recommendation ? (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 text-sky-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-black text-zinc-900 mb-4">Your Recommendation</h2>
                  <p className="text-zinc-700 font-bold">{recommendation}</p>
                  <button
                    onClick={() => {
                      setShowTechniqueModal(false);
                      setRecommendation(null);
                      setModalAnswers({ studyPreference: '', studyChallenge: '' });
                    }}
                    className="mt-8 w-full py-3 bg-sky-500 text-white rounded-xl font-bold"
                  >
                    Got it!
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-black text-zinc-900 mb-2">Find Your Perfect Study Technique</h2>
                  <p className="text-zinc-500 mb-8">Answer these two questions to get a personalized recommendation.</p>
                  <div className="space-y-6">
                    <div>
                      <label className="block font-bold text-zinc-900 mb-3">How do you prefer to study?</label>
                      {['In short, focused bursts with breaks.', 'By testing myself on what I know.', 'By explaining concepts in simple terms.'].map((option) => (
                        <label key={option} className="flex items-center gap-3 mb-2 cursor-pointer">
                          <input type="radio" name="pref" checked={modalAnswers.studyPreference === option} onChange={() => setModalAnswers((current) => ({ ...current, studyPreference: option }))} className="accent-sky-500 h-5 w-5" />
                          <span className="text-sm text-zinc-700">{option}</span>
                        </label>
                      ))}
                    </div>
                    <div>
                      <label className="block font-bold text-zinc-900 mb-3">What is your biggest study challenge?</label>
                      {['Staying focused for long periods.', 'Forgetting information after a few days.', "Not knowing what I don't know."].map((option) => (
                        <label key={option} className="flex items-center gap-3 mb-2 cursor-pointer">
                          <input type="radio" name="challenge" checked={modalAnswers.studyChallenge === option} onChange={() => setModalAnswers((current) => ({ ...current, studyChallenge: option }))} className="accent-sky-500 h-5 w-5" />
                          <span className="text-sm text-zinc-700">{option}</span>
                        </label>
                      ))}
                    </div>
                    <button onClick={getRecommendation} disabled={!modalAnswers.studyPreference || !modalAnswers.studyChallenge} className="w-full py-3 bg-sky-500 text-white rounded-xl font-bold disabled:opacity-50">
                      Find My Technique
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
