import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  ChevronLeft,
  FileText,
  Search,
  PenTool,
  Eye,
  BookOpen,
  Loader2,
  Calendar,
  Sparkles,
  Wand2,
  Clock,
  AlertCircle,
  Link as LinkIcon,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  BarChart3,
  PlusCircle,
  ExternalLink,
  X,
  Quote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { geminiGenerateContent } from '../services/geminiProxy';
import { differenceInCalendarDays } from 'date-fns';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  writeBatch,
  serverTimestamp,
  orderBy,
  getDoc,
  getDocs
} from '@/lib/portal-firestore';
import { cn } from '../lib/utils';
import { AssignmentPlan } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import {
  detectStudentPortalFromPath,
  studentPortalAssignmentPortalPath,
  studentPortalStudyHubPath,
  studentPortalToolPath,
} from '@/lib/portal';

const STEP_CONFIGS: Record<string, { id: number; title: string; icon: any; description: string }[]> = {
  'Essay': [
    { id: 1, title: 'Pick Subject', icon: BookOpen, description: 'Define your topic and scope.' },
    { id: 2, title: 'Research', icon: Search, description: 'Topics, Articles & References, Key Points.' },
    { id: 3, title: 'Planning', icon: Calendar, description: 'Outline, structure, and schedule your work.' },
    { id: 4, title: 'Drafting', icon: PenTool, description: 'Consolidate research and write layout.' },
    { id: 5, title: 'Review', icon: Eye, description: 'Gather all research and polish.' }
  ],
  'Short Story': [
    { id: 1, title: 'Brainstorm', icon: BookOpen, description: 'Themes, genres, and core ideas.' },
    { id: 2, title: 'Topics & Themes', icon: Search, description: 'Setting the mood, motifs, and world-building.' },
    { id: 3, title: 'Plot & Characters', icon: Calendar, description: 'Character arcs and narrative structure.' },
    { id: 4, title: 'Creative Writing', icon: PenTool, description: 'First draft and narrative flow.' },
    { id: 5, title: 'Editing', icon: Eye, description: 'Refining prose and emotional impact.' }
  ],
  'Report': [
    { id: 1, title: 'Define Scope', icon: BookOpen, description: 'Objectives and boundaries.' },
    { id: 2, title: 'Data Collection', icon: Search, description: 'Gathering facts, stats, and evidence.' },
    { id: 3, title: 'Analysis', icon: Calendar, description: 'Organizing data and key findings.' },
    { id: 4, title: 'Technical Writing', icon: PenTool, description: 'Formal drafting and data visualization.' },
    { id: 5, title: 'Formatting', icon: Eye, description: 'Final check and professional layout.' }
  ],
  'Presentation': [
    { id: 1, title: 'Topic Selection', icon: BookOpen, description: 'Main message and audience.' },
    { id: 2, title: 'Visual Assets', icon: Search, description: 'Images, icons, and media research.' },
    { id: 3, title: 'Slide Outline', icon: Calendar, description: 'Storyboarding and slide flow.' },
    { id: 4, title: 'Design', icon: PenTool, description: 'Creating slides and speaker notes.' },
    { id: 5, title: 'Rehearsal', icon: Eye, description: 'Practice and final adjustments.' }
  ],
  'Case Study': [
    { id: 1, title: 'Identify Case', icon: BookOpen, description: 'Selecting the subject and context.' },
    { id: 2, title: 'Background', icon: Search, description: 'Historical context and initial research.' },
    { id: 3, title: 'Problem Analysis', icon: Calendar, description: 'Identifying key issues and solutions.' },
    { id: 4, title: 'Solution Drafting', icon: PenTool, description: 'Writing recommendations and findings.' },
    { id: 5, title: 'Final Review', icon: Eye, description: 'Ensuring clarity and logical flow.' }
  ],
  'Other': [
    { id: 1, title: 'Initial Phase', icon: BookOpen, description: 'Getting started and defining goals.' },
    { id: 2, title: 'Preparation', icon: Search, description: 'Gathering necessary information.' },
    { id: 3, title: 'Organization', icon: Calendar, description: 'Structuring the project.' },
    { id: 4, title: 'Execution', icon: PenTool, description: 'Doing the core work.' },
    { id: 5, title: 'Completion', icon: Eye, description: 'Final touches and review.' }
  ]
};

const getSteps = (type?: string) => {
  return STEP_CONFIGS[type as keyof typeof STEP_CONFIGS] || STEP_CONFIGS['Essay'];
};

export default function AssignmentPortalPage() {
  const { isPhone } = useResponsiveDevice();
  const location = useLocation();
  const navigate = useNavigate();
  const { planId } = useParams();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [plans, setPlans] = useState<AssignmentPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingReferences, setIsGeneratingReferences] = useState(false);
  const [showAIForm, setShowAIForm] = useState(false);
  const [aiFormDetails, setAiFormDetails] = useState({
    projectGoal: '',
    resourceCount: '5',
    finishResourcesDate: '',
    startWritingDate: '',
    otherMilestones: ''
  });
  const [taskInput, setTaskInput] = useState('');
  const [keyPointInput, setKeyPointInput] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'milestones' | 'schedule'>('milestones');
  const [openPhases, setOpenPhases] = useState<number[]>([1]);
  const [showPlanOverlay, setShowPlanOverlay] = useState(false);
  const [overlayTab, setOverlayTab] = useState<'plan' | 'research'>('plan');
  const [isExportingWorkbook, setIsExportingWorkbook] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [showReviewPulse, setShowReviewPulse] = useState(false);
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);
  const [newResource, setNewResource] = useState({
    title: '',
    url: '',
    takeaway: '',
    takeaways: [] as string[],
    section: 'Intro' as 'Intro' | 'Body' | 'Conclusion' | 'Other'
  });
  const reviewButtonRef = useRef<HTMLButtonElement | null>(null);

  const activePlan = useMemo(() => 
    plans.find(p => p.id === activePlanId) || null
  , [plans, activePlanId]);

  const currentSteps = useMemo(() => getSteps(activePlan?.assignmentType), [activePlan?.assignmentType]);
  const priorityStatus = useMemo(() => {
    if (!activePlan?.dueDate) return 'low' as const;
    const daysUntilDue = differenceInCalendarDays(new Date(activePlan.dueDate), new Date());
    const dueSoon = daysUntilDue <= 7;
    const completionRatio = (activePlan.currentStep || 0) / 6;
    if (!dueSoon) return 'low' as const;
    if (completionRatio < 0.5) return 'high' as const;
    return 'medium' as const;
  }, [activePlan?.dueDate, activePlan?.currentStep]);

  const isStepFilled = (stepId: number) => {
    if (!activePlan) return false;
    const step = activePlan.steps.find(s => s.id === stepId);
    if (!step) return false;

    switch (stepId) {
      case 1: // Phase 1
        return step.tasks.length > 0;
      case 2: // Phase 2
        const hasTasks = step.tasks.length > 0;
        const hasResources = activePlan.researchResources && activePlan.researchResources.length > 0;
        const hasKeyPoints = activePlan.researchKeyPoints && activePlan.researchKeyPoints.length > 0;
        return hasTasks || hasResources || hasKeyPoints;
      case 3: // Phase 3
        return step.tasks.length > 0;
      case 4: // Phase 4
        const hasDraft = (activePlan.draftContent && activePlan.draftContent.trim().length > 0) ||
                        (activePlan.draftIntro && activePlan.draftIntro.trim().length > 0) ||
                        (activePlan.draftBody && activePlan.draftBody.trim().length > 0) ||
                        (activePlan.draftConclusion && activePlan.draftConclusion.trim().length > 0);
        return hasDraft;
      case 5: // Phase 5
        return step.completed || (activePlan.generatedReferences && activePlan.generatedReferences.length > 0) || 
               step.tasks.some(t => t.completed);
      default:
        return false;
    }
  };

  const completedStepsCount = useMemo(() => {
    if (!activePlan) return 0;
    return activePlan.steps.filter((s) => isStepFilled(s.id)).length;
  }, [activePlan, currentSteps]);

  const handleExportToWorkbook = async () => {
    if (!auth.currentUser || !activePlan) return;
    const intro = activePlan.draftIntro?.trim();
    const body = activePlan.draftBody?.trim();
    const conclusion = activePlan.draftConclusion?.trim();
    const compiledHtml = [
      intro ? `<p><strong>Introduction</strong></p><p>${intro.replace(/\n+/g, '<br/>')}</p>` : '',
      body ? `<p><strong>Body</strong></p><p>${body.replace(/\n+/g, '<br/>')}</p>` : '',
      conclusion ? `<p><strong>Conclusion</strong></p><p>${conclusion.replace(/\n+/g, '<br/>')}</p>` : ''
    ].filter(Boolean).join('<p><br/></p>');
    const compiledText = [
      intro ? `Introduction\n${intro}` : '',
      body ? `Body\n${body}` : '',
      conclusion ? `Conclusion\n${conclusion}` : ''
    ].filter(Boolean).join('\n\n');

    if (!compiledHtml) {
      setExportStatus('Add draft content before exporting.');
      return;
    }

    setIsExportingWorkbook(true);
    setExportStatus(null);
    try {
      const uid = auth.currentUser.uid;
      const assignmentPlanId = activePlan.id;
      const MAX_PREVIEW_BYTES = 50_000;
      const truncateToBytes = (value: string, maxBytes: number) => {
        const encoder = new TextEncoder();
        if (encoder.encode(value).length <= maxBytes) return value;
        let low = 0;
        let high = value.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          const candidate = value.slice(0, mid);
          if (encoder.encode(candidate).length > maxBytes) {
            high = mid - 1;
          } else {
            low = mid;
          }
        }
        return value.slice(0, low);
      };
      const contentPreview = truncateToBytes(compiledText, MAX_PREVIEW_BYTES);

      const assignmentsRef = collection(db, 'assignments');
      const existingQuery = query(
        assignmentsRef,
        where('userId', '==', uid),
        where('assignmentPlanId', '==', assignmentPlanId)
      );
      const existingSnap = await getDocs(existingQuery);
      let assignmentId: string;
      if (!existingSnap.empty) {
        assignmentId = existingSnap.docs[0].id;
        await updateDoc(doc(db, 'assignments', assignmentId), {
          title: activePlan.title || 'Assignment Draft',
          content: contentPreview,
          assignmentPlanId,
          updatedAt: new Date().toISOString()
        });
      } else {
        const newDoc = await addDoc(assignmentsRef, {
          userId: uid,
          title: activePlan.title || 'Assignment Draft',
          content: contentPreview,
          assignmentPlanId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        assignmentId = newDoc.id;
      }

      const pagesRef = collection(db, 'assignments', assignmentId, 'pages');
      const pagesSnap = await getDocs(pagesRef);
      const batch = writeBatch(db);
      pagesSnap.forEach((p) => batch.delete(p.ref));
      const MAX_PAGE_CHARS = 3200;
      const paragraphBlocks = compiledHtml.split('<p><br/></p>').filter(Boolean);
      const compiledPages: string[] = [];
      let current = '';
      paragraphBlocks.forEach((block) => {
        const next = current ? `${current}<p><br/></p>${block}` : block;
        if (next.replace(/<[^>]*>/g, '').length > MAX_PAGE_CHARS && current) {
          compiledPages.push(current);
          current = block;
        } else {
          current = next;
        }
      });
      if (current) compiledPages.push(current);
      compiledPages.forEach((pageContent, index) => {
        batch.set(doc(pagesRef, `page-${index + 1}`), {
          index,
          content: pageContent,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();

      setExportStatus('Opened in Workbooks.');
      navigate(`${studentPortalToolPath(activePortal, 'report-builder')}?assignmentPlanId=${assignmentPlanId}`, {
        state: { openAssignmentId: assignmentId }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'assignments');
      setExportStatus('Export failed. Please try again.');
    } finally {
      setIsExportingWorkbook(false);
    }
  };

  const handleReviewWorkbook = async () => {
    if (!auth.currentUser || !activePlan) return;
    try {
      const uid = auth.currentUser.uid;
      const assignmentPlanId = activePlan.id;
      const existingQuery = query(
        collection(db, 'assignments'),
        where('userId', '==', uid),
        where('assignmentPlanId', '==', assignmentPlanId)
      );
      const existingSnap = await getDocs(existingQuery);
      if (existingSnap.empty) {
        setExportStatus('No workbook yet. Import in Step 4 first.');
        return;
      }
      const assignmentId = existingSnap.docs[0].id;
      navigate(`${studentPortalToolPath(activePortal, 'report-builder')}?assignmentPlanId=${assignmentPlanId}`, {
        state: { openAssignmentId: assignmentId }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'assignments');
    }
  };

  const handleFinishStep = () => {
    setShowFinishPrompt(true);
    setShowReviewPulse(true);
    if (activePlan) {
      const updatedSteps = activePlan.steps.map((step) =>
        step.id === 5 ? { ...step, completed: true } : step
      );
      updatePlan({ steps: updatedSteps });
    }
    reviewButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setShowReviewPulse(false), 1500);
  };

  // New Plan Form
  const [newPlanData, setNewPlanData] = useState({
    title: '',
    subject: '',
    assignmentType: 'Essay',
    dueDate: ''
  });

  const fetchAssignments = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const q = query(
        collection(db, 'assignmentPlans'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AssignmentPlan[];
      setPlans(list);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'assignmentPlans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (planId) {
      setActivePlanId(planId);
    } else {
      setActivePlanId(null);
    }
  }, [planId]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setIsCreating(true);
    try {
      const typeSteps = getSteps(newPlanData.assignmentType);
      const initialSteps = typeSteps.map(step => ({
        id: step.id,
        title: step.title,
        tasks: step.id === 5 ? [{
          id: crypto.randomUUID(),
          text: 'Get my references (IEEE or Harvard)',
          completed: false,
          priority: 'high'
        }] : [],
        completed: false
      }));

      const planRef = doc(collection(db, 'assignmentPlans'));
      const deadlineRef = doc(collection(db, 'deadlines'));
      const batch = writeBatch(db);

      batch.set(planRef, {
        userId: user.uid,
        ...newPlanData,
        currentStep: 1,
        steps: initialSteps,
        researchResources: [],
        researchKeyPoints: [],
        deadlineId: deadlineRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.set(deadlineRef, {
        userId: user.uid,
        title: newPlanData.title,
        course: newPlanData.subject,
        dueDate: new Date(newPlanData.dueDate),
        type: 'assignment',
        priority: 'medium',
        completed: false,
        assignmentPlanId: planRef.id,
        createdAt: serverTimestamp()
      });

      await batch.commit();

      await fetchAssignments();
      setShowCreateModal(false);
      setNewPlanData({ title: '', subject: '', assignmentType: 'Essay', dueDate: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'assignmentPlans');
    } finally {
      setIsCreating(false);
    }
  };

  const updatePlan = async (updates: Partial<AssignmentPlan>) => {
    if (!activePlan) return;

    // Optimistically update local state
    setPlans(prevPlans => prevPlans.map(p => 
      p.id === activePlan.id ? { ...p, ...updates } : p
    ));

    try {
      await updateDoc(doc(db, 'assignmentPlans', activePlan.id), {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `assignmentPlans/${activePlan.id}`);
      // Revert on error
      fetchAssignments();
    }
  };

  const addTask = (stepId: number, text: string) => {
    if (!activePlan || !text.trim()) return;
    const newSteps = activePlan.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          tasks: [...step.tasks, { 
            id: crypto.randomUUID(), 
            text, 
            completed: false,
            priority: 'medium' as const,
            estimatedTime: '30m',
            subtasks: []
          }]
        };
      }
      return step;
    });
    updatePlan({ steps: newSteps });
  };

  const togglePhase = (phase: number) => {
    setOpenPhases(prev => 
      prev.includes(phase) 
        ? prev.filter(p => p !== phase) 
        : [...prev, phase]
    );
  };

  const addKeyPoint = (text: string) => {
    if (!activePlan || !text.trim()) return;
    const currentKeyPoints = activePlan.researchKeyPoints || [];
    updatePlan({ researchKeyPoints: [...currentKeyPoints, text.trim()] });
  };

  const deleteKeyPoint = (index: number) => {
    if (!activePlan || !activePlan.researchKeyPoints) return;
    const newKeyPoints = activePlan.researchKeyPoints.filter((_, i) => i !== index);
    updatePlan({ researchKeyPoints: newKeyPoints });
  };

  const addResource = () => {
    if (!activePlan || !newResource.title.trim()) return;
    const resource = {
      id: crypto.randomUUID(),
      title: newResource.title,
      url: newResource.url,
      takeaways: newResource.takeaways,
      section: newResource.section
    };
    const currentResources = activePlan.researchResources || [];
    updatePlan({ researchResources: [...currentResources, resource] });
    setNewResource({ title: '', url: '', takeaway: '', takeaways: [], section: 'Intro' });
  };

  const deleteResource = (id: string) => {
    if (!activePlan) return;
    const newResources = (activePlan.researchResources || []).filter(r => r.id !== id);
    updatePlan({ researchResources: newResources });
  };

  const updateTask = (stepId: number, taskId: string, updates: Partial<AssignmentPlan['steps'][0]['tasks'][0]>) => {
    if (!activePlan) return;
    const newSteps = activePlan.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          tasks: step.tasks.map(task => 
            task.id === taskId ? { ...task, ...updates } : task
          )
        };
      }
      return step;
    });
    updatePlan({ steps: newSteps });
  };

  const addSubtask = (stepId: number, taskId: string, text: string) => {
    if (!activePlan || !text.trim()) return;
    const newSteps = activePlan.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          tasks: step.tasks.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                subtasks: [...(task.subtasks || []), { id: crypto.randomUUID(), text, completed: false }]
              };
            }
            return task;
          })
        };
      }
      return step;
    });
    updatePlan({ steps: newSteps });
  };

  const toggleSubtask = (stepId: number, taskId: string, subtaskId: string) => {
    if (!activePlan) return;
    const newSteps = activePlan.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          tasks: step.tasks.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                subtasks: task.subtasks?.map(st => 
                  st.id === subtaskId ? { ...st, completed: !st.completed } : st
                )
              };
            }
            return task;
          })
        };
      }
      return step;
    });
    updatePlan({ steps: newSteps });
  };

  const deleteSubtask = (stepId: number, taskId: string, subtaskId: string) => {
    if (!activePlan) return;
    const newSteps = activePlan.steps.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          tasks: step.tasks.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                subtasks: task.subtasks?.filter(st => st.id !== subtaskId)
              };
            }
            return task;
          })
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

  const deletePlan = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'assignmentPlans', id));
      if (activePlanId === id) setActivePlanId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `assignmentPlans/${id}`);
    }
  };

  const generateReferences = async () => {
    if (!activePlan || !activePlan.researchResources || activePlan.researchResources.length === 0) return;
    
    setIsGeneratingReferences(true);
    try {
      const style = activePlan.referenceStyle || 'Harvard';
      
      const resourcesList = activePlan.researchResources.map(r => `- Title: ${r.title}, URL: ${r.url}`).join('\n');
      
      const prompt = `Generate a formatted bibliography/reference list in ${style} style for the following resources. 
      Return ONLY the formatted list as a plain text string. Do not include any introductory or concluding remarks.
      
      Resources:
      ${resourcesList}`;

      const response = await geminiGenerateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const references = response.text || "Could not generate references.";
      await updatePlan({ generatedReferences: references });
    } catch (error) {
      console.error('Error generating references:', error);
    } finally {
      setIsGeneratingReferences(false);
    }
  };

  const generateAISuggestions = async () => {
    if (!activePlan) return;
    
    setIsGeneratingAI(true);
    try {
      const currentStep = currentSteps[activePlan.currentStep - 1];
      const isPlanStep = currentStep.id === 2 || currentStep.id === 3;
      
      if (isPlanStep) {
        // Master Plan Generation (Milestones)
        const prompt = `Create a comprehensive, high-level assignment roadmap for a ${activePlan.assignmentType || 'assignment'} titled "${activePlan.title}" in the subject "${activePlan.subject}", due on ${activePlan.dueDate}.
        
        User's specific goals and constraints:
        - Project Goal: ${aiFormDetails.projectGoal || 'Not specified'}
        - Target Number of Resources: ${aiFormDetails.resourceCount}
        - Finish Resources By: ${aiFormDetails.finishResourcesDate || 'Not specified'}
        - Start Writing By: ${aiFormDetails.startWritingDate || 'Not specified'}
        - Other Milestones/Notes: ${aiFormDetails.otherMilestones || 'Not specified'}
        
        The roadmap should follow these phases:
        1. ${currentSteps[1].title} (Focus on finding ${aiFormDetails.resourceCount} resources. If a date was provided, aim to finish by ${aiFormDetails.finishResourcesDate})
        2. ${currentSteps[2].title} (Detailed outline and structure. If a start writing date was provided, aim to start by ${aiFormDetails.startWritingDate})
        3. ${currentSteps[3].title} (Writing the layout structure, sections, and content)
        4. ${currentSteps[4].title} (Proofreading, citations, final check)
        
        For each phase, provide 3-5 specific, actionable tasks. 
        For each task, include:
        - text: the task description
        - priority: "low", "medium", or "high"
        - estimatedTime: a string like "30m", "1h", "2h"
        - dueDate: a suggested date in YYYY-MM-DD format (must be before ${activePlan.dueDate})
        - subtasks: a list of 2-3 even more granular steps for this task
        
        Return the result as a JSON object with exactly these keys: "milestone1", "milestone2", "milestone3", "milestone4". 
        Each key should map to an array of objects with "text", "priority", "estimatedTime", "dueDate", and "subtasks" (array of strings) keys.`;

        const response = await geminiGenerateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                milestone1: { 
                  type: "array", 
                  items: { 
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                      estimatedTime: { type: "string" },
                      dueDate: { type: "string" },
                      subtasks: { type: "array", items: { type: "string" } }
                    },
                    required: ["text", "priority", "estimatedTime", "dueDate", "subtasks"]
                  } 
                },
                milestone2: { 
                  type: "array", 
                  items: { 
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                      estimatedTime: { type: "string" },
                      dueDate: { type: "string" },
                      subtasks: { type: "array", items: { type: "string" } }
                    },
                    required: ["text", "priority", "estimatedTime", "dueDate", "subtasks"]
                  } 
                },
                milestone3: { 
                  type: "array", 
                  items: { 
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                      estimatedTime: { type: "string" },
                      dueDate: { type: "string" },
                      subtasks: { type: "array", items: { type: "string" } }
                    },
                    required: ["text", "priority", "estimatedTime", "dueDate", "subtasks"]
                  } 
                },
                milestone4: { 
                  type: "array", 
                  items: { 
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high"] },
                      estimatedTime: { type: "string" },
                      dueDate: { type: "string" },
                      subtasks: { type: "array", items: { type: "string" } }
                    },
                    required: ["text", "priority", "estimatedTime", "dueDate", "subtasks"]
                  } 
                }
              },
              required: ["milestone1", "milestone2", "milestone3", "milestone4"]
            }
          }
        });

        const fullPlan = JSON.parse(response.text || "{}");
        
        const newSteps = activePlan.steps.map(step => {
          let tasksToAdd: any[] = [];
          if (step.id === 2) tasksToAdd = fullPlan.milestone1 || [];
          if (step.id === 3) tasksToAdd = fullPlan.milestone2 || [];
          if (step.id === 4) tasksToAdd = fullPlan.milestone3 || [];
          if (step.id === 5) tasksToAdd = fullPlan.milestone4 || [];
          
          if (tasksToAdd.length > 0) {
            const newTasks = tasksToAdd.map(t => ({
              id: crypto.randomUUID(),
              text: t.text,
              priority: t.priority as "low" | "medium" | "high",
              estimatedTime: t.estimatedTime,
              dueDate: t.dueDate,
              completed: false,
              subtasks: t.subtasks.map((st: string) => ({ id: crypto.randomUUID(), text: st, completed: false }))
            }));
            return { ...step, tasks: newTasks };
          }
          return step;
        });

        await updatePlan({ steps: newSteps });
        setShowAIForm(false);
      } else {
        // Individual Step Suggestions
        const prompt = `Generate 3-5 specific, actionable tasks for the "${currentStep.title}" stage of an assignment titled "${activePlan.title}" for the subject "${activePlan.subject}". 
        The stage description is: "${currentStep.description}".
        For each task, include:
        - text: the task description
        - priority: "low", "medium", or "high"
        - estimatedTime: a string like "30m", "1h", "2h"
        - dueDate: a suggested date in YYYY-MM-DD format (must be before ${activePlan.dueDate})
        - subtasks: a list of 2-3 even more granular steps for this task
        Return the tasks as a JSON array of objects.`;

        const response = await geminiGenerateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: { 
                type: "object",
                properties: {
                  text: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                  estimatedTime: { type: "string" },
                  dueDate: { type: "string" },
                  subtasks: { type: "array", items: { type: "string" } }
                },
                required: ["text", "priority", "estimatedTime", "dueDate", "subtasks"]
              }
            }
          }
        });

        const suggestions = JSON.parse(response.text || "[]");
        
        if (suggestions.length > 0) {
          const newSteps = activePlan.steps.map(step => {
            if (step.id === activePlan.currentStep) {
              const newTasks = suggestions.map((t: any) => ({
                id: crypto.randomUUID(),
                text: t.text,
                priority: t.priority as "low" | "medium" | "high",
                estimatedTime: t.estimatedTime,
                dueDate: t.dueDate,
                completed: false,
                subtasks: t.subtasks.map((st: string) => ({ id: crypto.randomUUID(), text: st, completed: false }))
              }));
              return {
                ...step,
                tasks: [...step.tasks, ...newTasks]
              };
            }
            return step;
          });
          await updatePlan({ steps: newSteps });
        }
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className={cn("max-w-6xl mx-auto", isPhone ? "space-y-5 p-4" : "p-8")}>
      {!activePlan && (
        <div className={cn("mb-10", isPhone ? "space-y-3" : "flex items-center justify-between")}>
          <button 
            onClick={() => navigate(studentPortalStudyHubPath(activePortal))}
            className={cn(
              "flex items-center gap-3 bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 rounded-2xl font-black transition-all shadow-sm hover:shadow-md",
              isPhone ? "w-full justify-center px-4 py-2.5 text-sm" : "px-5 py-2.5"
            )}
          >
            <ArrowLeft size={20} /> Back to Hub
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              "bg-blue-600 text-white font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-3",
              isPhone ? "w-full justify-center rounded-[24px] px-5 py-3 text-sm" : "rounded-[32px] px-8 py-4"
            )}
          >
            <Plus size={22} /> New Assignment Plan
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!activePlan ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("grid gap-4", isPhone ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")}
          >
            {plans.map((plan) => (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                onClick={() => navigate(studentPortalAssignmentPortalPath(activePortal, plan.id))}
                className={cn(
                  "bg-white border border-zinc-200 shadow-sm text-left group relative cursor-pointer",
                  isPhone ? "rounded-[28px] p-5" : "rounded-[32px] p-8"
                )}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(studentPortalAssignmentPortalPath(activePortal, plan.id));
                  }
                }}
              >
                <div className={cn("flex items-center justify-between", isPhone ? "mb-4" : "mb-6")}>
                  <div className={cn("bg-blue-50 rounded-xl flex items-center justify-center text-blue-600", isPhone ? "h-11 w-11" : "w-12 h-12")}>
                    <FileText size={24} />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deletePlan(plan.id); }}
                    className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <h3 className={cn("font-black text-zinc-900 mb-2", isPhone ? "line-clamp-2 text-lg leading-6" : "text-xl truncate")}>{plan.title}</h3>
                <div className={cn("space-y-1", isPhone ? "mb-4" : "mb-6")}>
                  <p className={cn("text-zinc-500 font-bold", isPhone ? "text-sm leading-5" : "text-sm")}>{plan.subject}</p>
                  <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{plan.assignmentType}</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <span>Progress</span>
                    <span>Step {plan.currentStep} of 5</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${(plan.currentStep / 6) * 100}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}

            {plans.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="text-zinc-200" size={40} />
                </div>
                <h3 className="text-xl font-black text-zinc-900 mb-2">No Assignment Plans</h3>
                <p className="text-zinc-500">Create your first plan to start mastering your assignments.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(isPhone ? "space-y-6" : "space-y-8")}
          >
            {/* Header */}
            <div className={cn("grid items-stretch", isPhone ? "grid-cols-1 gap-3" : "grid-cols-1 lg:grid-cols-5 gap-6")}>
              <div className={cn("bg-white border border-zinc-200 shadow-sm flex flex-col overflow-hidden", isPhone ? "rounded-[28px] p-4 min-h-[160px]" : "p-7 rounded-[32px] h-[248px]")}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate(studentPortalAssignmentPortalPath(activePortal))}
                    className={cn("rounded-2xl border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 transition-colors flex items-center justify-center", isPhone ? "w-9 h-9" : "w-10 h-10")}
                    aria-label="Back to Hub"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className={cn("rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center", isPhone ? "w-10 h-10" : "w-11 h-11")}>
                    <BookOpen size={22} />
                  </div>
                </div>
                <div className="mt-4 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assignment</p>
                  <h2 className={cn("font-black text-zinc-900 leading-tight break-words", isPhone ? "mt-1 text-lg" : "mt-2 text-[19px] leading-[1.12] line-clamp-3 pr-2")}>{activePlan.title}</h2>
                </div>
                <div className="mt-5 flex flex-col gap-2 pb-1">
                  <span className="inline-flex max-w-full items-center gap-2 bg-zinc-50 px-3 py-1.5 rounded-full text-[11px] font-black text-zinc-600">
                    {activePlan.subject}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 leading-4">
                    {activePlan.assignmentType}
                  </span>
                </div>
              </div>

              <div className={cn("bg-white border border-zinc-200 shadow-sm flex flex-col justify-between", isPhone ? "rounded-[28px] p-4 min-h-[140px]" : "p-7 rounded-[32px] h-[248px]")}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Due Date</p>
                  <p className={cn("font-black text-zinc-900", isPhone ? "text-lg" : "text-xl")}>{new Date(activePlan.dueDate).toLocaleDateString()}</p>
                  <p className="text-[11px] font-bold text-zinc-400 mt-2">Plan your milestones early.</p>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stay on track</div>
              </div>

              <div className={cn("bg-white border border-zinc-200 shadow-sm overflow-hidden flex flex-col", isPhone ? "rounded-[28px] p-4 min-h-[140px]" : "p-7 rounded-[32px] h-[248px]")}>
                <p className={cn("text-[10px] font-black uppercase tracking-widest text-zinc-400", isPhone ? "mb-3" : "mb-4")}>Overall Progress</p>
                <div className={cn("flex flex-1 flex-col items-center", isPhone ? "justify-center gap-2" : "justify-start gap-4 pt-1 pb-2")}>
                  <div className={cn("rounded-full flex flex-col items-center justify-center relative bg-white shrink-0", isPhone ? "w-20 h-20" : "w-24 h-24")}>
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        className="text-zinc-100"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * completedStepsCount) / 5}
                        className="text-blue-600 transition-all duration-700"
                      />
                    </svg>
                    <span className={cn("font-black text-zinc-900", isPhone ? "text-sm" : "text-base")}>{Math.round((completedStepsCount / 5) * 100)}%</span>
                  </div>
                  <p className={cn("font-bold text-zinc-400 text-center", isPhone ? "text-[11px] leading-4" : "px-2 text-sm leading-5")}>{completedStepsCount} of 5 complete</p>
                </div>
              </div>

              <div className={cn("bg-white border border-zinc-200 shadow-sm", isPhone ? "rounded-[28px] p-4 min-h-[140px]" : "p-7 rounded-[32px] h-[248px]")}>
                <h4 className="text-base font-black text-zinc-900 mb-4 flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-500" />
                  Priority Load
                </h4>
                <div className="space-y-3">
                  {['high', 'medium', 'low'].map(priority => {
                    const tasks = activePlan.steps.flatMap(s => s.tasks).filter(t => t.priority === priority);
                    const completed = tasks.filter(t => t.completed).length;
                    const total = tasks.length;
                    const isActivePriority = priorityStatus === priority;
                    const percentage = isActivePriority ? 100 : 0;
                    const color = priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500';
                    
                    return (
                      <div key={priority} className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className={cn(
                            priority === 'high' ? "text-red-600" : priority === 'medium' ? "text-amber-600" : "text-blue-600"
                          )}>{priority}</span>
                          <span className="text-zinc-400">{isActivePriority ? 'Active' : `${completed}/${total}`}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-500", color)}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={cn("bg-zinc-900 text-white shadow-xl flex flex-col justify-between relative", isPhone ? "rounded-[28px] p-4 min-h-[150px]" : "rounded-[32px] p-7 h-[248px]")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-yellow-400" size={18} />
                    <h4 className="text-base font-black">AI Assistant</h4>
                  </div>
                </div>
                <p className="text-zinc-300 text-xs leading-relaxed">
                  {activePlan.currentStep === 2 || activePlan.currentStep === 3
                    ? "Generate a full roadmap with milestones and tasks."
                    : `Get suggestions for ${currentSteps[activePlan.currentStep - 1].title.toLowerCase()}.`}
                </p>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Personalized help</div>
                {!showAIForm && (
                  <button 
                    onClick={() => setShowAIForm(true)}
                    disabled={isGeneratingAI}
                    className="absolute top-4 right-4 px-3 py-2 bg-white text-zinc-900 rounded-xl font-black text-[10px] hover:bg-zinc-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Wand2 size={12} />
                    AI
                  </button>
                )}
              </div>
            </div>

            {/* Stepper */}
            <div>
              <div className={cn("gap-3", isPhone ? "grid grid-cols-2" : "grid grid-cols-5")}>
              {currentSteps.map((step) => {
                const isActive = activePlan.currentStep === step.id;
                const isCompleted = isStepFilled(step.id);
                const filled = isStepFilled(step.id);
                const Icon = step.icon;
                
                return (
                  <button
                    key={step.id}
                    onClick={() => updatePlan({ currentStep: step.id })}
                    className={cn(
                      "flex flex-col items-center border transition-all relative",
                      isPhone ? "min-w-0 rounded-2xl p-3" : "p-4 rounded-2xl",
                      isActive 
                        ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100" 
                        : isCompleted
                          ? filled 
                            ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                            : "bg-amber-50 border-amber-100 text-amber-600"
                          : "bg-white border-zinc-200 text-zinc-400 hover:border-blue-200"
                    )}
                  >
                    <Icon size={20} className="mb-2" />
                    <span className="text-[9px] font-black uppercase tracking-widest mb-1">Step {step.id}</span>
                    <span className={cn("font-bold text-center leading-tight", isPhone ? "text-[10px]" : "text-[11px]")}>{step.title}</span>
                    {isCompleted && (
                      <div className={cn(
                        "absolute -top-2 -right-2 w-5 h-5 text-white rounded-full flex items-center justify-center shadow-lg",
                        filled ? "bg-emerald-500" : "bg-amber-500"
                      )}>
                        {filled ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      </div>
                    )}
                  </button>
                );
              })}
              </div>
            </div>

            {showAIForm && (
              <div className="bg-zinc-900 rounded-[32px] p-6 text-white shadow-xl mb-12">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Project Goal</label>
                    <input 
                      type="text"
                      placeholder="e.g. Get an A, finish early..."
                      className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={aiFormDetails.projectGoal}
                      onChange={e => setAiFormDetails({...aiFormDetails, projectGoal: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Target Resources</label>
                    <input 
                      type="number"
                      className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={aiFormDetails.resourceCount}
                      onChange={e => setAiFormDetails({...aiFormDetails, resourceCount: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Finish Resources By</label>
                    <input 
                      type="date"
                      className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={aiFormDetails.finishResourcesDate}
                      onChange={e => setAiFormDetails({...aiFormDetails, finishResourcesDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Start Writing By</label>
                    <input 
                      type="date"
                      className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={aiFormDetails.startWritingDate}
                      onChange={e => setAiFormDetails({...aiFormDetails, startWritingDate: e.target.value})}
                    />
                  </div>
                  <div className="lg:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Other Milestones / Notes</label>
                    <input 
                      type="text"
                      placeholder="e.g. Peer review on Friday, check citations..."
                      className="w-full bg-zinc-800 border-zinc-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={aiFormDetails.otherMilestones}
                      onChange={e => setAiFormDetails({...aiFormDetails, otherMilestones: e.target.value})}
                    />
                  </div>

                  <div className="lg:col-span-3 flex flex-wrap items-center gap-4 py-4 border-y border-zinc-800 my-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Quick Suggestions:</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Get an A', field: 'projectGoal', value: 'Achieve an A grade with high-quality research' },
                        { label: 'Finish Early', field: 'projectGoal', value: 'Complete all tasks 2 days before deadline' },
                        { label: '10 Sources', field: 'resourceCount', value: '10' },
                        { label: 'Deep Analysis', field: 'otherMilestones', value: 'Include deep critical analysis of key theories' }
                      ].map(s => (
                        <button 
                          key={s.label}
                          onClick={() => setAiFormDetails({...aiFormDetails, [s.field]: s.value})}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-[10px] font-bold transition-all border border-zinc-700"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex justify-end gap-4 mt-4">
                    <button 
                      onClick={() => setShowAIForm(false)}
                      className="px-6 py-3 text-zinc-400 font-bold hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={generateAISuggestions}
                      disabled={isGeneratingAI}
                      className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 size={16} />}
                      Generate Plan
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Active Step Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className={cn("lg:col-span-3", isPhone ? "space-y-4" : "space-y-6")}>
                <div className={cn("bg-white border border-zinc-200 shadow-sm", isPhone ? "rounded-[28px] p-5 min-h-[320px]" : "p-8 rounded-[40px] min-h-[400px]")}>
                  <div className={cn("flex items-center justify-between", isPhone ? "mb-5 gap-3" : "mb-8")}>
                    <div>
                      <h3 className={cn("font-black text-zinc-900", isPhone ? "mb-1 text-[1.8rem] leading-9" : "text-3xl mb-2")}>
                        {currentSteps[activePlan.currentStep - 1].title}
                      </h3>
                      <p className={cn("text-zinc-500 font-bold", isPhone ? "text-sm leading-6" : "")}>{currentSteps[activePlan.currentStep - 1].description}</p>
                    </div>
                    <div className={cn("bg-zinc-50 rounded-full flex items-center justify-center text-zinc-400 font-black", isPhone ? "h-11 w-11 text-base" : "w-14 h-14 text-xl")}>
                      {currentSteps[activePlan.currentStep - 1].id}
                    </div>
                  </div>

                  {/* Task Input & List (Conditional for Step 1, 2 & 3) */}
                  {activePlan.currentStep === 1 ? (
                    <div className="space-y-8 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-zinc-50 p-8 rounded-[40px] border border-zinc-100 space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assignment Details</h4>
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Title</p>
                              <p className="text-xl font-black text-zinc-900">{activePlan.title}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Subject</p>
                              <p className="text-lg font-bold text-zinc-700">{activePlan.subject}</p>
                            </div>
                            <div className="flex gap-8">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Type</p>
                                <p className="text-sm font-bold text-zinc-700">{activePlan.assignmentType}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Due Date</p>
                                <p className="text-sm font-bold text-zinc-700">{activePlan.dueDate}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={cn(
                          "bg-blue-50/50 border border-blue-100 space-y-6",
                          isPhone ? "rounded-[28px] p-5" : "p-8 rounded-[40px]"
                        )}>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Quick Start</h4>
                          <p className="text-sm font-bold text-blue-900 leading-relaxed">
                            You've set up your assignment! Now it's time to dive into research. You can jump straight to the Research phase to start collecting articles and key points.
                          </p>
                          <button 
                            onClick={() => updatePlan({ currentStep: 2 })}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                          >
                            Start Researching
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>

                      <div className={cn(
                        "bg-white border border-zinc-200 space-y-6",
                        isPhone ? "rounded-[28px] p-5" : "p-8 rounded-[40px]"
                      )}>
                        <h4 className={cn("font-black text-zinc-900", isPhone ? "text-base" : "text-lg")}>Initial Tasks</h4>
                        <div className={cn("gap-4", isPhone ? "grid grid-cols-1" : "flex")}>
                          <input
                            type="text"
                            value={taskInput}
                            onChange={(e) => setTaskInput(e.target.value)}
                            placeholder="Add an initial task (e.g., Read assignment brief)..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                addTask(1, taskInput);
                                setTaskInput('');
                              }
                            }}
                            className={cn(
                              "bg-zinc-50 border border-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-400",
                              isPhone ? "w-full rounded-[24px] px-5 py-4 text-base" : "flex-1 rounded-[32px] px-8 py-5 text-base"
                            )}
                          />
                          <button 
                            onClick={() => {
                              addTask(1, taskInput);
                              setTaskInput('');
                            }}
                            className={cn(
                              "bg-zinc-900 text-white font-black hover:bg-zinc-800 transition-all shadow-lg",
                              isPhone ? "w-full rounded-[24px] px-5 py-4 text-sm" : "rounded-[32px] px-10 py-5"
                            )}
                          >
                            Add
                          </button>
                        </div>
                        <div className="space-y-4">
                          {activePlan.steps[0].tasks.map((task) => (
                            <div key={task.id} className="flex items-center gap-6 p-6 rounded-[32px] border border-zinc-100 bg-zinc-50">
                              <button onClick={() => toggleTask(1, task.id)} className={task.completed ? "text-emerald-500" : "text-zinc-300"}>
                                {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                              </button>
                              <span className={cn("flex-1 font-bold", task.completed && "line-through text-zinc-400")}>{task.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : activePlan.currentStep === 2 ? (
                    <div className="space-y-6 py-4">
                      {/* Phase 1: Topics & Key Points Section */}
                      <div className="bg-white rounded-[40px] border border-zinc-200 overflow-hidden transition-all">
                        <button 
                          onClick={() => togglePhase(1)}
                          className="w-full flex items-center justify-between p-8 hover:bg-zinc-50 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                              openPhases.includes(1) ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-zinc-100 text-zinc-400"
                            )}>
                              <span className="text-xs font-black">01</span>
                            </div>
                            <div className="text-left">
                              <h4 className="text-lg font-black text-zinc-900">PHASE 1: TOPICS & KEY POINTS</h4>
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Research Topics & Essential Takeaways</p>
                            </div>
                          </div>
                          <div className={cn("transition-transform duration-300", openPhases.includes(1) && "rotate-180")}>
                            <ChevronDown size={24} className="text-zinc-400" />
                          </div>
                        </button>

                        <AnimatePresence>
                          {openPhases.includes(1) && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-zinc-100"
                            >
                              <div className="p-8 space-y-10">
                                {/* Topics Subsection */}
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                                      <Search size={16} className="text-blue-600" />
                                      Research Topics
                                    </h5>
                                  </div>
                                  <div className="flex gap-4">
                                    <input
                                      type="text"
                                      value={taskInput}
                                      onChange={(e) => setTaskInput(e.target.value)}
                                      placeholder="Add a research topic..."
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          addTask(2, taskInput);
                                          setTaskInput('');
                                        }
                                      }}
                                      className="flex-1 px-8 py-5 bg-zinc-50 border border-zinc-200 rounded-[32px] text-base focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-400"
                                    />
                                    <button 
                                      onClick={() => {
                                        addTask(2, taskInput);
                                        setTaskInput('');
                                      }}
                                      className="px-10 py-5 bg-zinc-900 text-white rounded-[32px] font-black hover:bg-zinc-800 transition-all shadow-lg"
                                    >
                                      Add
                                    </button>
                                  </div>
                                  <div className="space-y-4">
                                    {activePlan.steps[1].tasks.map((task) => (
                                      <div key={task.id} className="flex items-center gap-6 p-6 rounded-[32px] border border-zinc-100 bg-zinc-50">
                                        <button onClick={() => toggleTask(2, task.id)} className={task.completed ? "text-emerald-500" : "text-zinc-300"}>
                                          {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                        </button>
                                        <span className={cn("flex-1 font-bold", task.completed && "line-through text-zinc-400")}>{task.text}</span>
                                      </div>
                                    ))}
                                    {activePlan.steps[1].tasks.length === 0 && (
                                      <div className="p-12 border-2 border-dashed border-zinc-100 rounded-[40px] text-center">
                                        <p className="text-zinc-400 font-bold">No topics added yet.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Key Points Subsection */}
                                <div className="space-y-6 pt-10 border-t border-zinc-100">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                                      <Sparkles size={16} className="text-amber-500" />
                                      Key Points & Findings
                                    </h5>
                                  </div>
                                  <div className="flex gap-4">
                                    <input
                                      type="text"
                                      value={keyPointInput}
                                      onChange={(e) => setKeyPointInput(e.target.value)}
                                      placeholder="Add a key finding or point..."
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          addKeyPoint(keyPointInput);
                                          setKeyPointInput('');
                                        }
                                      }}
                                      className="flex-1 px-8 py-5 bg-zinc-50 border border-zinc-200 rounded-[32px] text-base focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-400"
                                    />
                                    <button 
                                      onClick={() => {
                                        addKeyPoint(keyPointInput);
                                        setKeyPointInput('');
                                      }}
                                      className="px-10 py-5 bg-amber-500 text-white rounded-[32px] font-black hover:bg-amber-600 transition-all shadow-lg shadow-amber-100"
                                    >
                                      Add
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {activePlan.researchKeyPoints?.map((point, idx) => (
                                      <div key={idx} className="flex items-start gap-4 p-6 rounded-[32px] border border-zinc-100 bg-zinc-50 group">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-2.5 shrink-0" />
                                        <span className="flex-1 font-bold text-zinc-700">{point}</span>
                                        <button 
                                          onClick={() => deleteKeyPoint(idx)}
                                          className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    ))}
                                    {(activePlan.researchKeyPoints?.length || 0) === 0 && (
                                      <div className="md:col-span-2 p-12 border-2 border-dashed border-zinc-100 rounded-[40px] text-center">
                                        <p className="text-zinc-400 font-bold">No key points added yet.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Phase 2: Resources Section */}
                      <div className="bg-white rounded-[40px] border border-zinc-200 overflow-hidden transition-all">
                        <button 
                          onClick={() => togglePhase(2)}
                          className="w-full flex items-center justify-between p-8 hover:bg-zinc-50 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                              openPhases.includes(2) ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-zinc-100 text-zinc-400"
                            )}>
                              <span className="text-xs font-black">02</span>
                            </div>
                            <div className="text-left">
                              <h4 className="text-lg font-black text-zinc-900">PHASE 2: RESOURCES</h4>
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Articles, References & Links</p>
                            </div>
                          </div>
                          <div className={cn("transition-transform duration-300", openPhases.includes(2) && "rotate-180")}>
                            <ChevronDown size={24} className="text-zinc-400" />
                          </div>
                        </button>

                        <AnimatePresence>
                          {openPhases.includes(2) && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-zinc-100"
                            >
                              <div className="p-8 space-y-8">
                                <div className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100">
                                  <h4 className="text-lg font-black text-blue-900 mb-4 flex items-center gap-2">
                                    <PlusCircle size={20} />
                                    Add Research Resource
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Resource Title</label>
                                      <input 
                                        type="text"
                                        placeholder="e.g. Scientific American Article"
                                        value={newResource.title}
                                        onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Resource URL</label>
                                      <input 
                                        type="text"
                                        placeholder="https://..."
                                        value={newResource.url}
                                        onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 space-y-1.5">
                                      <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 ml-1">Assignment Section</label>
                                      <select 
                                        value={newResource.section}
                                        onChange={(e) => setNewResource({ ...newResource, section: e.target.value as any })}
                                        className="w-full px-4 py-2.5 bg-white border border-blue-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                      >
                                        <option value="Intro">Introduction</option>
                                        <option value="Body">Body Paragraphs</option>
                                        <option value="Conclusion">Conclusion</option>
                                        <option value="Other">Other / General</option>
                                      </select>
                                    </div>
                                    <button 
                                      onClick={addResource}
                                      disabled={!newResource.title}
                                      className="mt-6 px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
                                    >
                                      ADD RESOURCE
                                    </button>
                                  </div>
                                </div>

                                {/* Resource List grouped by section */}
                                <div className="space-y-8">
                                  {['Intro', 'Body', 'Conclusion', 'Other'].map(section => {
                                    const resources = activePlan.researchResources?.filter(r => r.section === section) || [];
                                    if (resources.length === 0 && section !== 'Other') return null;
                                    
                                    return (
                                      <div key={section} className="space-y-4">
                                        <div className="flex items-center gap-3">
                                          <div className="h-px flex-1 bg-zinc-100" />
                                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            {section === 'Intro' ? 'Introduction' : section === 'Body' ? 'Body Paragraphs' : section === 'Conclusion' ? 'Conclusion' : 'Other Resources'}
                                          </span>
                                          <div className="h-px flex-1 bg-zinc-100" />
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                          {resources.map(resource => (
                                            <div key={resource.id} className="bg-white rounded-[32px] border border-zinc-100 p-6 hover:border-blue-100 transition-all group">
                                              <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-3 mb-1">
                                                    <h5 className="font-black text-zinc-900">{resource.title}</h5>
                                                    {resource.url && (
                                                      <a 
                                                        href={resource.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-600"
                                                      >
                                                        <ExternalLink size={14} />
                                                      </a>
                                                    )}
                                                  </div>
                                                  <p className="text-[10px] font-bold text-zinc-400 truncate max-w-md">{resource.url}</p>
                                                </div>
                                                <button 
                                                  onClick={() => deleteResource(resource.id)}
                                                  className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                  <Trash2 size={16} />
                                                </button>
                                              </div>

                                              <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Key Takeaways</span>
                                                </div>
                                                <div className="space-y-2">
                                                  {resource.takeaways.map((takeaway, idx) => (
                                                    <div key={idx} className="flex items-start gap-3 bg-zinc-50 p-3 rounded-xl group/tk">
                                                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                                      <p className="flex-1 text-xs font-bold text-zinc-600">{takeaway}</p>
                                                      <button 
                                                        onClick={() => {
                                                          const newResources = activePlan.researchResources?.map(r => {
                                                            if (r.id === resource.id) {
                                                              return { ...r, takeaways: r.takeaways.filter((_, i) => i !== idx) };
                                                            }
                                                            return r;
                                                          });
                                                          updatePlan({ researchResources: newResources });
                                                        }}
                                                        className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover/tk:opacity-100 transition-all"
                                                      >
                                                        <X size={12} />
                                                      </button>
                                                    </div>
                                                  ))}
                                                  <div className="flex gap-2">
                                                    <input 
                                                      type="text"
                                                      placeholder="Add a key point..."
                                                      className="flex-1 text-xs font-bold bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          const input = e.currentTarget;
                                                          if (input.value.trim()) {
                                                            const newResources = activePlan.researchResources?.map(r => {
                                                              if (r.id === resource.id) {
                                                                return { ...r, takeaways: [...r.takeaways, input.value.trim()] };
                                                              }
                                                              return r;
                                                            });
                                                            updatePlan({ researchResources: newResources });
                                                            input.value = '';
                                                          }
                                                        }
                                                      }}
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                          {resources.length === 0 && section === 'Other' && (
                                            <div className="p-12 border-2 border-dashed border-zinc-100 rounded-[40px] text-center">
                                              <p className="text-zinc-400 font-bold">No research resources added yet. Start by adding a link or topic above!</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : activePlan.currentStep === 3 ? (
                    <div className="space-y-8 py-4">
                      <div className="space-y-6">
                        {/* Phase 1: Planning */}
                        {(() => {
                          const step = currentSteps[2]; // Planning
                          const stepData = activePlan.steps.find(s => s.id === step.id);
                          const isOpen = openPhases.includes(step.id);
                          
                          return (
                            <div key={step.id} className="bg-white rounded-[40px] border border-zinc-200 overflow-hidden transition-all">
                              <button 
                                onClick={() => togglePhase(step.id)}
                                className="w-full flex items-center justify-between p-8 hover:bg-zinc-50 transition-all"
                              >
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                                    isOpen ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-zinc-100 text-zinc-400"
                                  )}>
                                    <span className="text-xs font-black">01</span>
                                  </div>
                                  <div className="text-left">
                                    <h4 className="text-lg font-black text-zinc-900 uppercase">PHASE 1: {step.title}</h4>
                                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{step.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6">
                                  <div className="hidden md:flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Target:</span>
                                    <span className="text-[10px] font-bold text-zinc-600 bg-zinc-100 px-2 py-1 rounded-lg">
                                      {stepData?.milestoneDeadline ? new Date(stepData.milestoneDeadline).toLocaleDateString() : 'Not set'}
                                    </span>
                                  </div>
                                  <div className={cn("transition-transform duration-300", isOpen && "rotate-180")}>
                                    <ChevronDown size={24} className="text-zinc-400" />
                                  </div>
                                </div>
                              </button>

                              <AnimatePresence>
                                {isOpen && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-zinc-100"
                                  >
                                    <div className="p-8 space-y-6">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Set Milestone Deadline:</span>
                                          <input 
                                            type="date"
                                            value={stepData?.milestoneDeadline || ''}
                                            onChange={(e) => {
                                              const newSteps = activePlan.steps.map(s => 
                                                s.id === step.id ? { ...s, milestoneDeadline: e.target.value } : s
                                              );
                                              updatePlan({ steps: newSteps });
                                            }}
                                            className="text-[10px] font-bold bg-zinc-100 rounded-lg px-3 py-1.5 outline-none border-none focus:ring-2 focus:ring-blue-500"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-4">
                                        <div className="flex gap-3">
                                          <input
                                            type="text"
                                            placeholder={`Add a task to ${step.title}...`}
                                            className="flex-1 px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                const input = e.currentTarget;
                                                if (input.value.trim()) {
                                                  addTask(step.id, input.value);
                                                  input.value = '';
                                                }
                                              }
                                            }}
                                          />
                                        </div>

                                        <div className="space-y-3">
                                          {stepData?.tasks.map(task => (
                                            <div key={task.id} className="bg-white rounded-[24px] border border-zinc-100 group hover:border-blue-100 transition-all overflow-hidden shadow-sm">
                                              <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}>
                                                <button 
                                                  onClick={(e) => { e.stopPropagation(); toggleTask(step.id, task.id); }}
                                                  className={cn(
                                                    "transition-colors",
                                                    task.completed ? "text-emerald-500" : "text-zinc-300 hover:text-blue-500"
                                                  )}
                                                >
                                                  {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                                </button>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-3 mb-1">
                                                    <span className={cn(
                                                      "text-sm font-black truncate",
                                                      task.completed && "line-through text-zinc-400"
                                                    )}>
                                                      {task.text}
                                                    </span>
                                                    {task.priority && (
                                                      <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                                        task.priority === 'high' ? "bg-red-100 text-red-600" :
                                                        task.priority === 'medium' ? "bg-amber-100 text-amber-600" :
                                                        "bg-blue-100 text-blue-600"
                                                      )}>
                                                        {task.priority}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-400">
                                                    {task.estimatedTime && (
                                                      <span className="flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {task.estimatedTime}
                                                      </span>
                                                    )}
                                                    {task.dueDate && (
                                                      <span className="flex items-center gap-1">
                                                        <Calendar size={10} />
                                                        Due {new Date(task.dueDate).toLocaleDateString()}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <div className="p-2 text-zinc-300 group-hover:text-zinc-500 transition-all">
                                                    {expandedTaskId === task.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                  </div>
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); deleteTask(step.id, task.id); }}
                                                    className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                  >
                                                    <Trash2 size={16} />
                                                  </button>
                                                </div>
                                              </div>
                                              
                                              <AnimatePresence>
                                                {expandedTaskId === task.id && (
                                                  <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="px-5 pb-5 border-t border-zinc-100 pt-6 space-y-6 bg-zinc-50/30"
                                                  >
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                      <div className="space-y-4">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Settings</span>
                                                        <div className="grid grid-cols-2 gap-4">
                                                          <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold text-zinc-500 ml-1">Priority</label>
                                                            <select 
                                                              value={task.priority || 'medium'}
                                                              onChange={(e) => updateTask(step.id, task.id, { priority: e.target.value as any })}
                                                              className="w-full text-xs font-bold bg-white border border-zinc-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                            >
                                                              <option value="low">Low</option>
                                                              <option value="medium">Medium</option>
                                                              <option value="high">High</option>
                                                            </select>
                                                          </div>
                                                          <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold text-zinc-500 ml-1">Est. Time</label>
                                                            <input 
                                                              type="text"
                                                              value={task.estimatedTime || ''}
                                                              placeholder="e.g. 1h"
                                                              onChange={(e) => updateTask(step.id, task.id, { estimatedTime: e.target.value })}
                                                              className="w-full text-xs font-bold bg-white border border-zinc-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                          </div>
                                                        </div>
                                                      </div>
                                                      <div className="space-y-4">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Due Date</span>
                                                        <input 
                                                          type="date"
                                                          value={task.dueDate || ''}
                                                          onChange={(e) => updateTask(step.id, task.id, { dueDate: e.target.value })}
                                                          className="w-full text-xs font-bold bg-white border border-zinc-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                      </div>
                                                    </div>
                                                  </motion.div>
                                                )}
                                              </AnimatePresence>
                                            </div>
                                          ))}
                                          {(!stepData || stepData.tasks.length === 0) && (
                                            <div className="p-8 border-2 border-dashed border-zinc-100 rounded-[32px] text-center">
                                              <p className="text-zinc-400 text-sm font-bold">No tasks planned for this phase yet.</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })()}

                        {/* Phase 2: Schedule Overview */}
                        <div className="bg-zinc-900 rounded-[40px] border border-zinc-800 overflow-hidden transition-all">
                          <button 
                            onClick={() => togglePhase(999)}
                            className="w-full flex items-center justify-between p-8 hover:bg-zinc-800 transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                                openPhases.includes(999) ? "bg-blue-500 text-white shadow-lg shadow-blue-900/20" : "bg-zinc-800 text-zinc-500"
                              )}>
                                <Calendar size={20} />
                              </div>
                              <div className="text-left">
                                <h4 className="text-lg font-black text-white uppercase">PHASE 2: SCHEDULE & MILESTONES</h4>
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Timeline and key deadlines</p>
                              </div>
                            </div>
                            <div className={cn("transition-transform duration-300", openPhases.includes(999) && "rotate-180")}>
                              <ChevronDown size={24} className="text-zinc-500" />
                            </div>
                          </button>

                          <AnimatePresence>
                            {openPhases.includes(999) && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-zinc-800"
                              >
                                <div className="p-8 space-y-8 bg-zinc-900/50">
                                  {/* Suggested Milestones */}
                                  <div className="space-y-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Suggested Milestones</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {[
                                        { text: "First 5 resources gathered", daysBefore: 10 },
                                        { text: "Start writing first draft", daysBefore: 7 },
                                        { text: "Complete core body sections", daysBefore: 4 },
                                        { text: "Final review and citations", daysBefore: 1 }
                                      ].map((milestone, idx) => {
                                        const suggestedDate = activePlan.dueDate ? new Date(new Date(activePlan.dueDate).getTime() - milestone.daysBefore * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '';
                                        const exists = activePlan.steps.some(s => s.tasks.some(t => t.text === milestone.text));
                                        
                                        return (
                                          <button 
                                            key={idx}
                                            disabled={exists}
                                            onClick={() => {
                                              addTask(3, milestone.text);
                                              // We can't easily set the due date in one go with addTask, but it gives them a starting point
                                            }}
                                            className={cn(
                                              "p-4 rounded-2xl border text-left transition-all flex items-center justify-between group",
                                              exists ? "bg-zinc-800/50 border-zinc-700 opacity-50 cursor-not-allowed" : "bg-zinc-800 border-zinc-700 hover:border-blue-500/50"
                                            )}
                                          >
                                            <div>
                                              <p className="text-xs font-bold text-white mb-1">{milestone.text}</p>
                                              <p className="text-[10px] font-bold text-zinc-500">Suggested: {suggestedDate || 'Set due date'}</p>
                                            </div>
                                            {!exists && <Plus size={16} className="text-zinc-500 group-hover:text-blue-400" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="h-px bg-zinc-800" />

                                  {/* Timeline */}
                                  <div className="space-y-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Timeline</h5>
                                    {(() => {
                                      const allTasks = activePlan.steps.flatMap(s => s.tasks.map(t => ({ ...t, stepId: s.id })));
                                      const sortedTasks = [...allTasks].sort((a, b) => {
                                        if (!a.dueDate) return 1;
                                        if (!b.dueDate) return -1;
                                        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                                      });

                                      if (sortedTasks.length === 0) {
                                        return (
                                          <div className="p-12 border-2 border-dashed border-zinc-800 rounded-[40px] text-center">
                                            <p className="text-zinc-500 font-bold">No tasks with due dates yet. Add dates to your tasks above to see them in the timeline!</p>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="space-y-4">
                                          {sortedTasks.map(task => (
                                            <div key={task.id} className="bg-zinc-800/50 p-6 rounded-[32px] border border-zinc-700 flex items-center gap-6 group hover:border-blue-500/50 transition-all">
                                              <div className="flex flex-col items-center justify-center min-w-[60px] h-[60px] bg-zinc-900 rounded-2xl border border-zinc-700">
                                                {task.dueDate ? (
                                                  <>
                                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tighter">
                                                      {new Date(task.dueDate).toLocaleString('default', { month: 'short' })}
                                                    </span>
                                                    <span className="text-xl font-black text-white">
                                                      {new Date(task.dueDate).getDate()}
                                                    </span>
                                                  </>
                                                ) : (
                                                  <Calendar size={20} className="text-zinc-600" />
                                                )}
                                              </div>
                                              <div className="flex-1">
                                                <h5 className={cn(
                                                  "font-black text-white mb-1",
                                                  task.completed && "line-through text-zinc-500"
                                                )}>
                                                  {task.text}
                                                </h5>
                                                <div className="flex items-center gap-3">
                                                  <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                                    task.priority === 'high' ? "bg-red-900/30 text-red-400" :
                                                    task.priority === 'medium' ? "bg-amber-900/30 text-amber-400" :
                                                    "bg-blue-900/30 text-blue-400"
                                                  )}>
                                                    {task.priority || 'medium'}
                                                  </span>
                                                  <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {task.estimatedTime || 'No estimate'}
                                                  </span>
                                                </div>
                                              </div>
                                              <button 
                                                onClick={() => toggleTask(task.stepId, task.id)}
                                                className={cn(
                                                  "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                                                  task.completed ? "bg-emerald-900/30 text-emerald-400" : "bg-zinc-900 text-zinc-600 hover:bg-blue-900/30 hover:text-blue-400"
                                                )}
                                              >
                                                {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  ) : activePlan.currentStep === 4 ? (
                    <div className="space-y-8 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <h3 className="text-2xl font-black text-zinc-900">Drafting Workbook</h3>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={handleExportToWorkbook}
                            disabled={isExportingWorkbook}
                            className="px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <FileText size={16} />
                            {isExportingWorkbook ? 'Exporting…' : 'Import to Workbooks'}
                          </button>
                          <button 
                            onClick={() => setShowPlanOverlay(!showPlanOverlay)}
                            className={cn(
                              "px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2",
                              showPlanOverlay ? "bg-zinc-900 text-white" : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                            )}
                          >
                            <Calendar size={16} />
                            {showPlanOverlay ? 'Hide Plan' : 'Show Plan'}
                          </button>
                        </div>
                      </div>
                      {exportStatus && (
                        <div className="mb-4 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                          {exportStatus}
                        </div>
                      )}

                      <div className="flex gap-8 min-h-[800px]">
                        {/* Editor Area */}
                        <div className={cn(
                          "flex-1 space-y-8 transition-all",
                          showPlanOverlay ? "w-1/2" : "w-full"
                        )}>
                          {/* Intro Section */}
                          <div className="bg-white border border-zinc-200 rounded-[40px] p-8 shadow-sm flex flex-col">
                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100">
                              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                <FileText size={20} />
                              </div>
                              <div>
                                <h4 className="font-black text-zinc-900">Introduction</h4>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Hook, Context, Thesis</p>
                              </div>
                            </div>
                            <textarea 
                              value={activePlan.draftIntro || ''}
                              onChange={(e) => updatePlan({ draftIntro: e.target.value })}
                              placeholder="Write your introduction here..."
                              className="w-full min-h-[150px] bg-transparent outline-none border-none resize-none font-medium text-zinc-800 leading-relaxed placeholder:text-zinc-300"
                            />
                            {/* Hints for Intro */}
                            <div className="mt-4 p-6 bg-blue-50 rounded-[32px] border border-blue-100 shadow-inner">
                              <div className="flex items-center gap-2 mb-4">
                                <Sparkles size={16} className="text-blue-600" />
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Writing Suggestions & Resources</p>
                              </div>
                              <div className="space-y-3">
                                {activePlan.researchKeyPoints?.slice(0, 3).map((kp, idx) => (
                                  <div key={idx} className="flex items-start gap-3 text-[11px] font-bold text-blue-800 bg-white/50 p-3 rounded-xl border border-blue-100/50">
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                                    <p>💡 <span className="text-blue-900">Hook/Context Idea:</span> Try incorporating this key finding: "{kp}"</p>
                                  </div>
                                ))}
                                {activePlan.researchResources?.filter(r => r.section === 'Intro').map((r, idx) => (
                                  <div key={idx} className="flex flex-col gap-2 bg-white/50 p-3 rounded-xl border border-blue-100/50">
                                    <div className="flex items-start gap-3 text-[11px] font-bold text-blue-800">
                                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                                      <p>🔗 <span className="text-blue-900">Resource Integration:</span> Use "{r.title}" to provide context here.</p>
                                    </div>
                                    {r.takeaways.map((t, tIdx) => (
                                      <div key={tIdx} className="ml-6 flex items-start gap-2 text-[10px] text-blue-700 bg-blue-100/30 p-2 rounded-lg border border-blue-100/20">
                                        <div className="w-1 h-1 bg-blue-300 rounded-full mt-1.5 shrink-0" />
                                        <p>Suggestion: Add this point: <span className="italic font-medium">"{t}"</span> insert here.</p>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                                {(!activePlan.researchKeyPoints?.length && !activePlan.researchResources?.filter(r => r.section === 'Intro').length) && (
                                  <p className="text-[10px] font-bold text-blue-400 italic">Add research to see specific writing hints here!</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Body Section */}
                          <div className="bg-white border border-zinc-200 rounded-[40px] p-8 shadow-sm flex flex-col">
                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100">
                              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                                <FileText size={20} />
                              </div>
                              <div>
                                <h4 className="font-black text-zinc-900">Body Paragraphs</h4>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Evidence, Analysis, Transitions</p>
                              </div>
                            </div>
                            <textarea 
                              value={activePlan.draftBody || ''}
                              onChange={(e) => updatePlan({ draftBody: e.target.value })}
                              placeholder="Write your main body paragraphs here..."
                              className="w-full min-h-[300px] bg-transparent outline-none border-none resize-none font-medium text-zinc-800 leading-relaxed placeholder:text-zinc-300"
                            />
                            {/* Hints for Body */}
                            <div className="mt-4 p-6 bg-amber-50 rounded-[32px] border border-amber-100 shadow-inner">
                              <div className="flex items-center gap-2 mb-4">
                                <Sparkles size={16} className="text-amber-600" />
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Evidence & Analysis Prompts</p>
                              </div>
                              <div className="space-y-3">
                                {activePlan.researchKeyPoints?.slice(3, 8).map((kp, idx) => (
                                  <div key={idx} className="flex items-start gap-3 text-[11px] font-bold text-amber-800 bg-white/50 p-3 rounded-xl border border-amber-100/50">
                                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />
                                    <p>📝 <span className="text-amber-900">Argument Point:</span> Expand on "{kp}" using your evidence.</p>
                                  </div>
                                ))}
                                {activePlan.researchResources?.filter(r => r.section === 'Body').map((r, idx) => (
                                  <div key={idx} className="flex flex-col gap-2 bg-white/50 p-3 rounded-xl border border-amber-100/50">
                                    <div className="flex items-start gap-3 text-[11px] font-bold text-amber-800">
                                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />
                                      <p>📊 <span className="text-amber-900">Evidence Tip:</span> Use findings from "{r.title}" to support your claims.</p>
                                    </div>
                                    {r.takeaways.map((t, tIdx) => (
                                      <div key={tIdx} className="ml-6 flex items-start gap-2 text-[10px] text-amber-700 bg-amber-100/30 p-2 rounded-lg border border-amber-100/20">
                                        <div className="w-1 h-1 bg-amber-300 rounded-full mt-1.5 shrink-0" />
                                        <p>Suggestion: Add this {tIdx === 0 ? 'primary' : 'supporting'} point: <span className="italic font-medium">"{t}"</span> insert here.</p>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                                {(!activePlan.researchKeyPoints?.slice(3, 8).length && !activePlan.researchResources?.filter(r => r.section === 'Body').length) && (
                                  <p className="text-[10px] font-bold text-amber-400 italic">Your research points will appear here as you add them.</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Conclusion Section */}
                          <div className="bg-white border border-zinc-200 rounded-[40px] p-8 shadow-sm flex flex-col">
                            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100">
                              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                <FileText size={20} />
                              </div>
                              <div>
                                <h4 className="font-black text-zinc-900">Conclusion</h4>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Summary, Implications, Final Thought</p>
                              </div>
                            </div>
                            <textarea 
                              value={activePlan.draftConclusion || ''}
                              onChange={(e) => updatePlan({ draftConclusion: e.target.value })}
                              placeholder="Write your conclusion here..."
                              className="w-full min-h-[150px] bg-transparent outline-none border-none resize-none font-medium text-zinc-800 leading-relaxed placeholder:text-zinc-300"
                            />
                            {/* Hints for Conclusion */}
                            <div className="mt-4 p-6 bg-emerald-50 rounded-[32px] border border-emerald-100 shadow-inner">
                              <div className="flex items-center gap-2 mb-4">
                                <Sparkles size={16} className="text-emerald-600" />
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Synthesis & Final Thoughts</p>
                              </div>
                              <div className="space-y-3">
                                <div className="flex items-start gap-3 text-[11px] font-bold text-emerald-800 bg-white/50 p-3 rounded-xl border border-emerald-100/50">
                                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                                  <p>✨ <span className="text-emerald-900">Synthesis:</span> Revisit your thesis in light of the evidence you've presented.</p>
                                </div>
                                {activePlan.researchKeyPoints?.slice(-2).map((kp, idx) => (
                                  <div key={idx} className="flex items-start gap-3 text-[11px] font-bold text-emerald-800 bg-white/50 p-3 rounded-xl border border-emerald-100/50">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                                    <p>💡 <span className="text-emerald-900">Final Thought:</span> Consider concluding with this insight: "{kp}"</p>
                                  </div>
                                ))}
                                {activePlan.researchResources?.filter(r => r.section === 'Conclusion').map((r, idx) => (
                                  <div key={idx} className="flex flex-col gap-2 bg-white/50 p-3 rounded-xl border border-emerald-100/50">
                                    <div className="flex items-start gap-3 text-[11px] font-bold text-emerald-800">
                                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                                      <p>🏁 <span className="text-emerald-900">Closing Resource:</span> End with a strong point from "{r.title}".</p>
                                    </div>
                                    {r.takeaways.map((t, tIdx) => (
                                      <div key={tIdx} className="ml-6 flex items-start gap-2 text-[10px] text-emerald-700 bg-emerald-100/30 p-2 rounded-lg border border-emerald-100/20">
                                        <div className="w-1 h-1 bg-emerald-300 rounded-full mt-1.5 shrink-0" />
                                        <p>Suggestion: Add this final point: <span className="italic font-medium">"{t}"</span> insert here.</p>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Research Overlay in Step 4 */}
                          <AnimatePresence>
                            {showPlanOverlay && (
                              <motion.div 
                                initial={{ x: 300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 300, opacity: 0 }}
                                className="w-[400px] bg-zinc-50 border border-zinc-200 rounded-[40px] p-6 shadow-xl overflow-y-auto flex flex-col"
                              >
                                <div className="flex items-center justify-between mb-6">
                                  <h4 className="font-black text-zinc-900 flex items-center gap-2">
                                    <Search size={18} className="text-blue-600" />
                                    Research Summary
                                  </h4>
                                  <button onClick={() => setShowPlanOverlay(false)} className="text-zinc-400 hover:text-zinc-600">
                                    <ChevronRight size={20} />
                                  </button>
                                </div>

                                <div className="space-y-8 flex-1">
                                  {['Intro', 'Body', 'Conclusion', 'Other'].map(section => {
                                    const resources = activePlan.researchResources?.filter(r => r.section === section) || [];
                                    if (resources.length === 0) return null;
                                    
                                    return (
                                      <div key={section} className="space-y-4">
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2">
                                          {section}
                                        </h5>
                                        <div className="space-y-3">
                                          {resources.map(resource => (
                                            <div key={resource.id} className="bg-white p-4 rounded-2xl border border-zinc-100 space-y-3">
                                              <div className="flex items-center justify-between">
                                                <h6 className="text-[11px] font-black text-zinc-900 truncate">{resource.title}</h6>
                                                {resource.url && (
                                                  <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                                                    <ExternalLink size={12} />
                                                  </a>
                                                )}
                                              </div>
                                              <div className="space-y-1.5">
                                                {resource.takeaways.map((tk, idx) => (
                                                  <div key={idx} className="flex items-start gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                                    <p className="text-[10px] font-bold text-zinc-600 leading-relaxed">{tk}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {(!activePlan.researchResources || activePlan.researchResources.length === 0) && (
                                    <div className="p-8 border-2 border-dashed border-zinc-100 rounded-3xl text-center">
                                      <p className="text-zinc-400 text-[10px] font-bold">No research resources found.</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    ) : activePlan.currentStep === 5 ? (
                      <div className={cn("space-y-8 py-4", isPhone && "space-y-5 py-2")}>
                        <div className={cn("flex items-center justify-between mb-4", isPhone && "mb-2 flex-col items-stretch gap-3")}>
                          <h3 className={cn("text-2xl font-black text-zinc-900", isPhone && "text-xl")}>Review & Finalize</h3>
                          <div className={cn("flex items-center gap-3", isPhone && "grid grid-cols-1 gap-2")}>
                            <button
                              ref={reviewButtonRef}
                              onClick={handleReviewWorkbook}
                              className={cn(
                                "px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700",
                                isPhone && "w-full justify-center rounded-[22px] px-4 py-3 text-[11px]",
                                showReviewPulse && "shadow-[0_0_0_6px_rgba(16,185,129,0.25)] animate-pulse"
                              )}
                            >
                              <FileText size={16} />
                              Review in Workbooks
                            </button>
                            <button 
                              onClick={() => setShowPlanOverlay(!showPlanOverlay)}
                              className={cn(
                                "px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2",
                                isPhone && "w-full justify-center rounded-[22px] px-4 py-3 text-[11px]",
                                showPlanOverlay ? "bg-zinc-900 text-white" : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                              )}
                            >
                              <Search size={16} />
                              {showPlanOverlay ? 'Hide Research' : 'Show Research'}
                            </button>
                          </div>
                        </div>
                        {showFinishPrompt && (
                          <div className={cn("text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3", isPhone && "rounded-[22px] px-3 py-2.5 text-[11px]")}>
                            Click “Review in Workbooks” to finalize your draft.
                          </div>
                        )}

                        <div className={cn("flex gap-8", isPhone && "flex-col gap-5")}>
                          <div className={cn("flex-1 space-y-8 min-w-0", isPhone && "space-y-5")}>
                            {/* Full Final Draft Section */}
                            <div className={cn("bg-white rounded-[40px] border border-zinc-200 p-8 space-y-6 shadow-sm", isPhone && "rounded-[28px] p-5 space-y-4")}>
                              <div className={cn("flex items-center justify-between gap-4", isPhone && "flex-col items-start gap-2")}>
                                <h4 className={cn("text-lg font-black text-zinc-900 uppercase flex items-center gap-2", isPhone && "text-base leading-tight")}>
                                  <FileText size={20} className="text-blue-600" />
                                  Full Final Draft
                                </h4>
                                <span className={cn("text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-100 px-3 py-1 rounded-full", isPhone && "px-2.5 py-1 text-[9px] tracking-[0.18em]")}>
                                  Pre-populated from Step 4
                                </span>
                              </div>
                              
                              <div className={cn("space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar", isPhone && "max-h-none overflow-visible pr-0 space-y-4")}>
                                {activePlan.draftIntro && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Introduction</h5>
                                    <div className={cn("p-6 bg-zinc-50 rounded-2xl text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap italic", isPhone && "rounded-[22px] p-4 text-[13px] leading-6")}>
                                      {activePlan.draftIntro}
                                    </div>
                                  </div>
                                )}
                                
                                {activePlan.draftBody && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Body Paragraphs</h5>
                                    <div className={cn("p-6 bg-zinc-50 rounded-2xl text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap italic", isPhone && "rounded-[22px] p-4 text-[13px] leading-6")}>
                                      {activePlan.draftBody}
                                    </div>
                                  </div>
                                )}
                                
                                {activePlan.draftConclusion && (
                                  <div className="space-y-2">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Conclusion</h5>
                                    <div className={cn("p-6 bg-zinc-50 rounded-2xl text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap italic", isPhone && "rounded-[22px] p-4 text-[13px] leading-6")}>
                                      {activePlan.draftConclusion}
                                    </div>
                                  </div>
                                )}

                                {!activePlan.draftIntro && !activePlan.draftBody && !activePlan.draftConclusion && (
                                  <div className={cn("text-center py-12 bg-zinc-50 rounded-[32px] border-2 border-dashed border-zinc-200", isPhone && "rounded-[24px] px-4 py-8")}>
                                    <p className={cn("text-zinc-400 font-bold", isPhone && "text-sm leading-6")}>No draft content found. Complete Step 4 to see your draft here!</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Task Input */}
                            <div className={cn("flex gap-4", isPhone && "flex-col gap-3")}>
                              <input
                                type="text"
                                value={taskInput}
                                onChange={(e) => setTaskInput(e.target.value)}
                                placeholder={`Add a review task...`}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    addTask(activePlan.currentStep, taskInput);
                                    setTaskInput('');
                                  }
                                }}
                                className={cn("flex-1 px-8 py-5 bg-zinc-50 border border-zinc-200 rounded-[32px] text-base focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-zinc-400", isPhone && "w-full rounded-[24px] px-5 py-4 text-sm")}
                              />
                              <button 
                                onClick={() => {
                                  addTask(activePlan.currentStep, taskInput);
                                  setTaskInput('');
                                }}
                                className={cn("px-10 py-5 bg-zinc-900 text-white rounded-[32px] font-black hover:bg-zinc-800 transition-all shadow-lg", isPhone && "w-full rounded-[24px] px-5 py-4 text-sm")}
                              >
                                Add
                              </button>
                            </div>

                            {/* Tasks List */}
                            <div className="space-y-4">
                              {activePlan.steps[activePlan.currentStep - 1].tasks.map((task) => (
                                <div 
                                  key={task.id}
                                  className={cn(
                                    "flex items-center gap-6 p-6 rounded-[32px] border transition-all group",
                                    isPhone && "items-start gap-3 p-4 rounded-[24px]",
                                    task.completed ? "bg-zinc-50 border-zinc-100" : "bg-white border-zinc-200 hover:border-blue-200 shadow-sm"
                                  )}
                                >
                                  <button 
                                    onClick={() => toggleTask(activePlan.currentStep, task.id)}
                                    className={cn(
                                      "transition-colors",
                                      task.completed ? "text-emerald-500" : "text-zinc-300 hover:text-blue-500"
                                    )}
                                  >
                                    {task.completed ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                                  </button>
                                  <span className={cn(
                                    "flex-1 text-base font-bold",
                                    isPhone && "min-w-0 text-sm leading-6",
                                    task.completed && "line-through text-zinc-400"
                                  )}>
                                    {task.text}
                                  </span>
                                  <button 
                                    onClick={() => deleteTask(activePlan.currentStep, task.id)}
                                    className="p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              ))}
                              {activePlan.steps[activePlan.currentStep - 1].tasks.length === 0 && (
                                <div className={cn("text-center py-12 border-2 border-dashed border-zinc-100 rounded-[40px]", isPhone && "rounded-[24px] px-4 py-8")}>
                                  <p className={cn("text-zinc-400 font-bold", isPhone && "text-sm leading-6")}>No review tasks yet. Add some to finalize your work!</p>
                                </div>
                              )}
                            </div>

                            {/* References Section */}
                            <div className={cn("bg-white rounded-[40px] border border-zinc-200 p-8 space-y-6 shadow-sm", isPhone && "rounded-[28px] p-5 space-y-4")}>
                              <div className={cn("flex items-center justify-between gap-4", isPhone && "flex-col items-start gap-3")}>
                                <h4 className={cn("text-lg font-black text-zinc-900 uppercase flex items-center gap-2", isPhone && "text-base leading-tight")}>
                                  <Quote size={20} className="text-blue-600" />
                                  References & Bibliography
                                </h4>
                                <div className={cn("flex items-center gap-2", isPhone && "w-full flex-col items-stretch gap-2")}>
                                  <select 
                                    value={activePlan.referenceStyle || 'Harvard'}
                                    onChange={(e) => updatePlan({ referenceStyle: e.target.value as 'IEEE' | 'Harvard' })}
                                    className={cn("text-xs font-black bg-zinc-100 border-none rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500", isPhone && "w-full rounded-[18px] px-4 py-3 text-[11px]")}
                                  >
                                    <option value="Harvard">Harvard</option>
                                    <option value="IEEE">IEEE</option>
                                  </select>
                                  <button 
                                    onClick={generateReferences}
                                    disabled={isGeneratingReferences || !activePlan.researchResources?.length}
                                    className={cn("px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2", isPhone && "w-full justify-center rounded-[18px] px-4 py-3 text-[11px]")}
                                  >
                                    {isGeneratingReferences ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                    Generate
                                  </button>
                                </div>
                              </div>

                              {activePlan.generatedReferences ? (
                                <div className="relative group">
                                  <div className={cn("p-6 bg-zinc-50 rounded-2xl text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap font-mono border border-zinc-100", isPhone && "rounded-[22px] p-4 text-[12px] leading-6")}>
                                    {activePlan.generatedReferences}
                                  </div>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(activePlan.generatedReferences || '');
                                    }}
                                    className="absolute top-4 right-4 p-2 bg-white border border-zinc-200 rounded-lg text-zinc-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                    title="Copy to clipboard"
                                  >
                                    <FileText size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className={cn("text-center py-12 bg-zinc-50 rounded-[32px] border-2 border-dashed border-zinc-200", isPhone && "rounded-[24px] px-4 py-8")}>
                                  <p className={cn("text-zinc-400 font-bold", isPhone && "text-sm leading-6")}>No references generated yet. Select a style and click generate!</p>
                                  <p className={cn("text-zinc-400 text-[10px] mt-2", isPhone && "text-[11px] leading-5")}>Uses your research resources from Step 2</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Research Overlay in Step 5 */}
                          <AnimatePresence>
                            {showPlanOverlay && (
                              <motion.div 
                                initial={{ x: 300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 300, opacity: 0 }}
                                className={cn(
                                  "w-[400px] bg-zinc-50 border border-zinc-200 rounded-[40px] p-6 shadow-xl overflow-y-auto flex flex-col",
                                  isPhone && "w-full rounded-[28px] p-5 max-h-none overflow-visible"
                                )}
                              >
                                <div className="flex items-center justify-between mb-6">
                                  <h4 className="font-black text-zinc-900 flex items-center gap-2">
                                    <Search size={18} className="text-blue-600" />
                                    Research Summary
                                  </h4>
                                  <button onClick={() => setShowPlanOverlay(false)} className="text-zinc-400 hover:text-zinc-600">
                                    <ChevronRight size={20} />
                                  </button>
                                </div>

                                <div className="space-y-8 flex-1">
                                  {['Intro', 'Body', 'Conclusion', 'Other'].map(section => {
                                    const resources = activePlan.researchResources?.filter(r => r.section === section) || [];
                                    if (resources.length === 0) return null;
                                    
                                    return (
                                      <div key={section} className="space-y-4">
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-200 pb-2">
                                          {section}
                                        </h5>
                                        <div className="space-y-3">
                                          {resources.map(resource => (
                                            <div key={resource.id} className="bg-white p-4 rounded-2xl border border-zinc-100 space-y-3">
                                              <div className="flex items-center justify-between">
                                                <h6 className="text-[11px] font-black text-zinc-900 truncate">{resource.title}</h6>
                                                {resource.url && (
                                                  <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                                                    <ExternalLink size={12} />
                                                  </a>
                                                )}
                                              </div>
                                              <div className="space-y-1.5">
                                                {resource.takeaways.map((tk, idx) => (
                                                  <div key={idx} className="flex items-start gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                                    <p className="text-[10px] font-bold text-zinc-600 leading-relaxed">{tk}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {(!activePlan.researchResources || activePlan.researchResources.length === 0) && (
                                    <div className="p-8 border-2 border-dashed border-zinc-100 rounded-3xl text-center">
                                      <p className="text-zinc-400 text-[10px] font-bold">No research resources found.</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className={cn("border-t border-zinc-100", isPhone ? "mt-8 grid grid-cols-2 gap-3 pt-6" : "mt-12 flex justify-between pt-12")}>
                <button
                  disabled={activePlan.currentStep === 1}
                  onClick={() => updatePlan({ currentStep: activePlan.currentStep - 1 })}
                  className={cn(
                    "bg-white border border-zinc-200 text-zinc-600 font-black hover:bg-zinc-50 transition-all disabled:opacity-30 shadow-sm",
                    isPhone ? "min-w-0 rounded-[24px] px-4 py-3 text-sm" : "px-10 py-5 rounded-[32px]"
                  )}
                >
                  Previous Step
                </button>
                <button
                  onClick={() => {
                    if (activePlan.currentStep === 5) {
                      handleFinishStep();
                    } else {
                      updatePlan({ currentStep: activePlan.currentStep + 1 });
                    }
                  }}
                  className={cn(
                    "bg-blue-600 text-white font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100",
                    isPhone ? "min-w-0 rounded-[24px] px-4 py-3 text-sm" : "px-10 py-5 rounded-[32px]"
                  )}
                >
                  {activePlan.currentStep === 5 ? 'Finish' : 'Next Step'}
                </button>
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
              <h2 className="text-2xl font-black text-zinc-900 mb-8">New Assignment Plan</h2>
              <form onSubmit={handleCreatePlan} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Assignment Title</label>
                  <input
                    required
                    type="text"
                    value={newPlanData.title}
                    onChange={e => setNewPlanData({ ...newPlanData, title: e.target.value })}
                    placeholder="e.g., History Research Essay"
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Subject</label>
                  <input
                    required
                    type="text"
                    value={newPlanData.subject}
                    onChange={e => setNewPlanData({ ...newPlanData, subject: e.target.value })}
                    placeholder="e.g., Modern History"
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Assignment Type</label>
                  <select
                    required
                    value={newPlanData.assignmentType}
                    onChange={e => setNewPlanData({ ...newPlanData, assignmentType: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="Essay">Essay</option>
                    <option value="Short Story">Short Story</option>
                    <option value="Report">Report</option>
                    <option value="Presentation">Presentation</option>
                    <option value="Case Study">Case Study</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {newPlanData.assignmentType === 'Other' && (
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Custom Type</label>
                    <input
                      required
                      type="text"
                      onChange={e => setNewPlanData({ ...newPlanData, assignmentType: e.target.value })}
                      placeholder="e.g., Portfolio"
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Due Date</label>
                  <input
                    required
                    type="date"
                    value={newPlanData.dueDate}
                    onChange={e => setNewPlanData({ ...newPlanData, dueDate: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
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
