import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from '@/lib/portal-firestore';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { auth, db } from '../firebase';
import { geminiGenerateContent } from '../services/geminiProxy';
import { AssignmentPlan } from '../types';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { getOrCreateCachedAiResult } from '../lib/ai-result-cache';
import {
  detectStudentPortalFromPath,
  studentPortalAssignmentCoachPath,
  studentPortalAssignmentCoachRubricPath,
  studentPortalAssignmentPortalPath,
  studentPortalStudyHubPath,
} from '@/lib/portal';

const ASSIGNMENT_TYPES = ['Essay', 'Report', 'Presentation', 'Short Story', 'Case Study', 'Other'];
const YEAR_LEVEL_OPTIONS = ['7', '8', '9', '10', '11', '12', 'University', 'TAFE', 'Other'];
const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_OPTIONS = ['Before school', 'Lunchtime', 'Afternoon', 'Evening'];
const CALENDAR_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GLASS_PANEL = 'border border-white/40 bg-white/46 backdrop-blur-xl shadow-[0_18px_50px_rgba(15,23,42,0.08)]';
const GLASS_PANEL_STRONG = 'border border-white/45 bg-white/58 backdrop-blur-2xl shadow-[0_22px_60px_rgba(15,23,42,0.12)]';
const GLASS_INSET = 'border border-white/50 bg-white/40 backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]';

const STEP_THEME: Record<number, {
  accent: string;
  softBg: string;
  pill: string;
  ring: string;
  badge: string;
}> = {
  1: {
    accent: 'text-sky-600',
    softBg: 'border-sky-200 bg-sky-50/65',
    pill: 'text-sky-700',
    ring: 'hover:border-sky-300',
    badge: 'bg-sky-100 text-sky-700',
  },
  2: {
    accent: 'text-violet-600',
    softBg: 'border-violet-200 bg-violet-50/65',
    pill: 'text-violet-700',
    ring: 'hover:border-violet-300',
    badge: 'bg-violet-100 text-violet-700',
  },
  3: {
    accent: 'text-amber-600',
    softBg: 'border-amber-200 bg-amber-50/65',
    pill: 'text-amber-700',
    ring: 'hover:border-amber-300',
    badge: 'bg-amber-100 text-amber-700',
  },
  4: {
    accent: 'text-fuchsia-600',
    softBg: 'border-fuchsia-200 bg-fuchsia-50/65',
    pill: 'text-fuchsia-700',
    ring: 'hover:border-fuchsia-300',
    badge: 'bg-fuchsia-100 text-fuchsia-700',
  },
  5: {
    accent: 'text-emerald-600',
    softBg: 'border-emerald-200 bg-emerald-50/65',
    pill: 'text-emerald-700',
    ring: 'hover:border-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700',
  },
};

const DAY_TO_INDEX: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

type CoachFormState = {
  title: string;
  subject: string;
  assignmentType: string;
  dueDate: string;
  yearLevel: string;
  taskSheetText: string;
  rubricText: string;
  preferredDays: string[];
  preferredTimeLabel: string;
  sessionsPerWeek: number;
};

const EMPTY_FORM: CoachFormState = {
  title: '',
  subject: '',
  assignmentType: 'Essay',
  dueDate: '',
  yearLevel: '',
  taskSheetText: '',
  rubricText: '',
  preferredDays: ['Monday', 'Wednesday', 'Saturday'],
  preferredTimeLabel: 'Afternoon',
  sessionsPerWeek: 3,
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the uploaded file.'));
    reader.readAsDataURL(file);
  });
}

function inlineDataFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid uploaded file format.');
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function isDocxFile(file: File) {
  const mimeType = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  );
}

function buildStepTitles(assignmentType?: string) {
  switch (assignmentType) {
    case 'Presentation':
      return ['Understand Task', 'Research', 'Slide Planning', 'Drafting', 'Review'];
    case 'Short Story':
      return ['Understand Task', 'Theme Research', 'Planning', 'Drafting', 'Review'];
    default:
      return ['Understand Task', 'Research', 'Planning', 'Drafting', 'Review'];
  }
}

function buildFallbackSteps(form: CoachFormState, taskSummary: AssignmentPlan['extractedTask']) {
  const titles = buildStepTitles(form.assignmentType);
  const deliverables = taskSummary?.deliverables?.slice(0, 3) || [];
  const researchAreas = taskSummary?.researchAreas?.slice(0, 3) || [];
  const instructions = taskSummary?.keyInstructions?.slice(0, 3) || [];

  return titles.map((title, index) => {
    const id = index + 1;
    const genericTasks =
      id === 1
        ? [
            `Read the task sheet and list every required deliverable${deliverables[0] ? `, including ${deliverables[0]}` : ''}.`,
            `Confirm the due date, submission method, and ${taskSummary?.wordCount ? `word count (${taskSummary.wordCount})` : 'scope'}.`,
          ]
        : id === 2
          ? [
              `Find credible sources for ${researchAreas[0] || form.subject || 'the topic'}.`,
              `Collect quotes, evidence, or examples that answer the task directly.`,
            ]
          : id === 3
            ? [
                'Create an outline with section headings and key points for each part.',
                `Block out ${form.preferredDays.length || 3} study sessions before the due date.`,
              ]
            : id === 4
              ? [
                  'Write the first full draft from the outline.',
                  `Check that the draft follows ${instructions[0] || 'the task instructions'} before moving on.`,
                ]
              : [
                  'Compare the draft against the task sheet and rubric.',
                  'Fix weak sections, citations, formatting, and submission details.',
                ];

    return {
      id,
      title,
      tasks: genericTasks.map((text, taskIndex) => ({
        id: crypto.randomUUID(),
        text,
        completed: false,
        priority: taskIndex === 0 ? 'high' as const : 'medium' as const,
        estimatedTime: id <= 2 ? '45m' : '60m',
        notes: '',
        subtasks: [],
      })),
      completed: false,
    };
  });
}

function buildFallbackSchedule(preferredDays: string[], preferredTimeLabel: string, sessionsPerWeek: number, steps: AssignmentPlan['steps']) {
  const days = preferredDays.length ? preferredDays : ['Monday', 'Wednesday', 'Saturday'];
  const limit = Math.max(1, Math.min(sessionsPerWeek || 3, days.length, 7));
  const items: NonNullable<AssignmentPlan['coachSchedule']> = [];

  for (let index = 0; index < limit; index += 1) {
    const step = steps[index % steps.length];
    items.push({
      id: crypto.randomUUID(),
      day: days[index % days.length],
      timeLabel: preferredTimeLabel || 'Afternoon',
      focusStep: step.id,
      focus: step.title,
      objective: step.tasks[0]?.text || `Work through ${step.title.toLowerCase()}.`,
      isFocusDay: true,
      completed: false,
    });
  }

  return items;
}

function getEffectivePreferredDays(preferredDays: string[]) {
  return preferredDays.length ? preferredDays : ['Monday', 'Wednesday', 'Saturday'];
}

function clampSessionCount(preferredDays: string[], sessionsPerWeek: number) {
  const selectedDays = getEffectivePreferredDays(preferredDays);
  return Math.max(1, Math.min(sessionsPerWeek || selectedDays.length || 1, selectedDays.length, 7));
}

function buildSessionOptions(preferredDays: string[]) {
  const maxSessions = Math.min(getEffectivePreferredDays(preferredDays).length, 7);
  return Array.from({ length: maxSessions }, (_, index) => index + 1);
}

function uniqueScheduleItems(items: NonNullable<AssignmentPlan['coachSchedule']>) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.focusStep}:${item.focus}:${item.objective}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildScheduleTaskSequence(
  steps: AssignmentPlan['steps'],
  baseSchedule: NonNullable<AssignmentPlan['coachSchedule']>,
) {
  const hintItems = uniqueScheduleItems(
    baseSchedule
      .filter((item) => !item.scheduledDate && item.isFocusDay !== false && item.objective.trim())
      .map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        completed: false,
      })),
  );

  const stepTaskItems = uniqueScheduleItems(
    steps.flatMap((step) => {
      const primaryTasks = step.tasks.length
        ? step.tasks
        : [
            {
              id: crypto.randomUUID(),
              text: `Work through ${step.title.toLowerCase()}.`,
              completed: false,
            },
          ];

      return primaryTasks.map((task) => ({
        id: crypto.randomUUID(),
        day: '',
        timeLabel: '',
        focusStep: step.id,
        focus: step.title,
        objective: task.text,
        isFocusDay: true,
        completed: false,
      }));
    }),
  );

  return uniqueScheduleItems([...hintItems, ...stepTaskItems]);
}

function sampleScheduleSequence(
  sequence: NonNullable<AssignmentPlan['coachSchedule']>,
  targetCount: number,
) {
  if (targetCount <= 0) return [];
  if (sequence.length <= targetCount) {
    return sequence.slice(0, targetCount);
  }

  return Array.from({ length: targetCount }, (_, index) => {
    const sequenceIndex = Math.min(
      sequence.length - 1,
      Math.floor((index * sequence.length) / targetCount),
    );
    return sequence[sequenceIndex];
  });
}

function expandScheduleToCalendar(
  startDate: Date,
  dueDate: Date,
  preferredDays: string[],
  preferredTimeLabel: string,
  sessionsPerWeek: number,
  steps: AssignmentPlan['steps'],
  baseSchedule: NonNullable<AssignmentPlan['coachSchedule']>,
) {
  const normalizedStartDate = startOfLocalDay(startDate);
  const normalizedDueDate = startOfLocalDay(dueDate);
  const preferred = getEffectivePreferredDays(preferredDays);
  const preferredSet = new Set(preferred);
  const totalDays = Math.max(1, Math.floor((normalizedDueDate.getTime() - normalizedStartDate.getTime()) / 86400000) + 1);
  const taskSequence = buildScheduleTaskSequence(steps, baseSchedule);
  const previousCompletions = new Map(
    baseSchedule
      .filter((item) => item.scheduledDate)
      .map((item) => [
        `${item.scheduledDate}:${item.focusStep}:${item.focus}:${item.objective}`,
        item.completed,
      ]),
  );
  const selectedWorkDates: Array<{ scheduledDate: string; dayName: string }> = [];

  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDays(normalizedStartDate, offset);
    const scheduledDate = toDateKey(date);
    const dayName = date.toLocaleDateString('en-AU', { weekday: 'long' });
    const isDueDate = scheduledDate === toDateKey(normalizedDueDate);
    const isPreferredDay = preferredSet.has(dayName);

    if (!isDueDate && isPreferredDay) {
      selectedWorkDates.push({ scheduledDate, dayName });
    }
  }

  const normalizedSessionsPerWeek = clampSessionCount(preferred, sessionsPerWeek);
  const maxWorkSlots = Math.max(
    normalizedSessionsPerWeek,
    selectedWorkDates.length,
  );
  const sampledTasks = sampleScheduleSequence(
    taskSequence.length
      ? taskSequence
      : buildFallbackSchedule(preferred, preferredTimeLabel, normalizedSessionsPerWeek, steps),
    Math.min(selectedWorkDates.length, maxWorkSlots),
  );

  const datedItems: NonNullable<AssignmentPlan['coachSchedule']> = selectedWorkDates.map((workDate, index) => {
    const nextTask = sampledTasks[index] || sampledTasks[sampledTasks.length - 1];
    const completionKey = `${workDate.scheduledDate}:${nextTask.focusStep}:${nextTask.focus}:${nextTask.objective}`;
    return {
      ...nextTask,
      id: crypto.randomUUID(),
      day: workDate.dayName,
      scheduledDate: workDate.scheduledDate,
      timeLabel: nextTask.timeLabel || preferredTimeLabel || 'Afternoon',
      isFocusDay: true,
      completed: previousCompletions.get(completionKey) || false,
    };
  });

  const dueDateKey = toDateKey(normalizedDueDate);
  const dueDayName = normalizedDueDate.toLocaleDateString('en-AU', { weekday: 'long' });
  const dueCompletionKey = `${dueDateKey}:5:Final review and submit:Run the final rubric check, fix last issues, and submit the assignment today.`;
  datedItems.push({
    id: crypto.randomUUID(),
    day: dueDayName,
    scheduledDate: dueDateKey,
    timeLabel: preferredTimeLabel || 'Afternoon',
    focusStep: 5,
    focus: 'Final review and submit',
    objective: 'Run the final rubric check, fix last issues, and submit the assignment today.',
    isFocusDay: true,
    completed: previousCompletions.get(dueCompletionKey) || false,
  });

  return datedItems;
}

function buildScheduleSignature(schedule: NonNullable<AssignmentPlan['coachSchedule']>) {
  return JSON.stringify(
    schedule.map((item) => ({
      day: item.day,
      scheduledDate: item.scheduledDate || '',
      timeLabel: item.timeLabel,
      focusStep: item.focusStep,
      focus: item.focus,
      objective: item.objective,
      isFocusDay: Boolean(item.isFocusDay),
      completed: item.completed,
    })),
  );
}

function computeCurrentStep(steps: AssignmentPlan['steps']) {
  const firstIncomplete = steps.find((step) => !step.tasks.every((task) => task.completed));
  return firstIncomplete ? firstIncomplete.id : 5;
}

function countProgress(plan: AssignmentPlan) {
  const total = plan.steps.reduce((sum, step) => sum + step.tasks.length, 0);
  const completed = plan.steps.reduce(
    (sum, step) => sum + step.tasks.filter((task) => task.completed).length,
    0,
  );
  return { total, completed };
}

function cleanDate(value?: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function parseLocalDate(value?: string) {
  if (!value) return null;
  const cleaned = cleanDate(value);
  if (!cleaned) return null;
  const [year, month, day] = cleaned.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfCalendarWeek(date: Date) {
  const current = startOfLocalDay(date);
  const day = current.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(current, offset);
}

function endOfCalendarWeek(date: Date) {
  return addDays(startOfCalendarWeek(date), 6);
}

function nextMatchingWeekday(fromDate: Date, weekday: number, includeSameDay = true) {
  const base = new Date(fromDate);
  let delta = (weekday - base.getDay() + 7) % 7;
  if (!includeSameDay && delta === 0) delta = 7;
  return addDays(base, delta);
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function uniqueItems(items: string[], limit = 6) {
  return Array.from(
    new Set(
      items
        .map((item) =>
          item
            .replace(/\s+/g, ' ')
            .replace(/[_]+/g, ' ')
            .replace(/\s+([,.;:!?])/g, '$1')
            .trim(),
        )
        .filter((item) => item.length > 0),
    ),
  ).slice(0, limit);
}

function compactCoachItem(item: string, maxLength = 120) {
  const cleaned = item
    .replace(/\s+/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/^[A-Z][A-Z\s/&()\-]{5,}:\s*/, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/:\s*$/, '')
    .replace(/\.\.\.+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!cleaned) return '';
  const normalized = !/[.!?]$/.test(cleaned) && cleaned.split(' ').length >= 4
    ? `${cleaned}.`
    : cleaned;
  if (normalized.length <= maxLength) return normalized;
  const trimmed = cleaned.slice(0, maxLength);
  const lastSpace = trimmed.lastIndexOf(' ');
  return `${trimmed.slice(0, lastSpace > 40 ? lastSpace : maxLength).trim().replace(/[,:;\-–]\s*$/, '')}...`;
}

function compactCoachParagraph(item: string, maxLength = 520) {
  const cleaned = item
    .replace(/\s+/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\.\.\.+/g, '.')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLength && /[.!?]$/.test(cleaned)) return cleaned;

  const sentences = cleaned.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [cleaned];
  const collected: string[] = [];
  let totalLength = 0;

  for (const sentence of sentences) {
    const normalized = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
    if (totalLength + normalized.length > maxLength && collected.length > 0) {
      break;
    }
    collected.push(normalized);
    totalLength += normalized.length + 1;
    if (totalLength >= maxLength) {
      break;
    }
  }

  const result = collected.join(' ').trim();
  return result || `${cleaned.slice(0, maxLength).trim().replace(/[,:;\-–]\s*$/, '')}.`;
}

function isNoiseSummaryLine(line: string) {
  const text = line.trim();
  if (!text) return true;
  if (/chosen\s+(claim|topic|question|rq)\s*:/i.test(text)) return true;
  if (/^timeline\s*:/i.test(text)) return true;
  if (/\b(student free day|anzac day|labour day)\b/i.test(text)) return true;
  if (/\bcheckpoint\b/i.test(text)) return true;
  if (/\bweek\s+[mtwfs]/i.test(text)) return true;
  if (/^\d+[\s/,-]+\d+[\s/,-]+\d+/.test(text)) return true;
  if (/^(m|t|w|t|f|s|s)(\s+(m|t|w|t|f|s|s))+$/i.test(text.replace(/[^\w\s]/g, ' ').trim())) return true;
  return false;
}

function sanitizeOverviewSourceText(text: string, maxLength = 420) {
  const candidateLines = uniqueItems(
    text
      .replace(/\r/g, '\n')
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length >= 18)
      .filter((line) => !isNoiseSummaryLine(line))
      .map((line) => line.replace(/^summary\s*:\s*/i, '').trim()),
    12,
  );

  const meaningfulLines = candidateLines.filter((line) => {
    const lowered = line.toLowerCase();
    return (
      /\b(assignment|report|investigation|essay|presentation|response|analyse|analyze|evaluate|explain|discuss|research|evidence|sources|rubric|submit|submission|due)\b/.test(lowered) ||
      line.split(' ').length >= 7
    );
  });

  return compactCoachParagraph(meaningfulLines.slice(0, 3).join(' '), maxLength);
}

function isUsableOutlineOverview(text: string) {
  const cleaned = text.trim();
  if (!cleaned) return false;
  if (/chosen\s+(claim|topic|question|rq)\s*:/i.test(cleaned)) return false;
  if (/\b(student free day|anzac day|labour day|checkpoint)\b/i.test(cleaned)) return false;
  if (/^timeline\s*:/i.test(cleaned)) return false;
  return true;
}

function compactCoachList(items: string[], maxLength = 110) {
  return items
    .map((item) => compactCoachItem(item, maxLength))
    .filter(Boolean)
    .filter(isReadableCoachSentence);
}

function isReadableCoachSentence(item: string) {
  const text = item.trim();
  if (!text) return false;
  if (text.includes('...') || text.includes('?')) return false;
  if (text.split(' ').length < 3) return false;
  if (/^[a-z]/.test(text)) return false;
  if (/[,:;\-–]$/.test(text)) return false;
  if (/\b(must|then|and|or|to|of|the|a|an|is|are|be|will|with|for|by|from|into)\.?$/i.test(text)) return false;
  return true;
}

function buildOutlineOverviewSummary(
  plan: AssignmentPlan,
  extracted?: AssignmentPlan['extractedTask'] | null,
) {
  const deliverables = extracted?.deliverables?.slice(0, 2) || [];
  const topics = extracted?.topicsNeeded?.slice(0, 3) || [];
  const instructions = extracted?.keyInstructions?.slice(0, 2) || [];
  const formatting = extracted?.formattingRequirements?.slice(0, 2) || [];
  const submission = extracted?.submissionRequirements?.slice(0, 2) || [];
  const checklist = extracted?.successChecklist?.slice(0, 2) || [];
  const summaryLead = sanitizeOverviewSourceText(extracted?.summary?.trim() || '');

  const sentenceOne = summaryLead
    ? `${summaryLead.replace(/[.!?]*$/g, '')}.`
    : deliverables.length
      ? `This assignment requires the student to complete ${deliverables.join(' and ')}.`
      : `This assignment requires the student to respond directly to ${plan.title || 'the task'} using evidence and clear subject knowledge.`;

  const sentenceTwo = topics.length || instructions.length
    ? `The student should decide on the specific focus or claim, then make sure the response covers ${topics.length ? topics.join(', ') : 'the required task points'} while following ${instructions.length ? instructions.join(' and ').replace(/\.$/g, '') : 'the task directions clearly'}.`
    : `The main response should be organised around the task requirements, with each section clearly answering part of the question.`;

  const sentenceThree = formatting.length || submission.length || checklist.length
    ? `Before submission, the student should check ${formatting.concat(submission, checklist).slice(0, 3).join(', ').replace(/\.$/g, '')}.`
    : `Before submission, the student should check the rubric, confirm the format, and make sure every requirement has been covered.`;

  return compactCoachParagraph([sentenceOne, sentenceTwo, sentenceThree].join(' '), 520);
}

function normalizeCoachCollection(items: string[], fallback: string[], maxLength = 96, limit = 5) {
  const cleaned = compactCoachList(uniqueItems(items, limit * 2), maxLength).slice(0, limit);
  if (cleaned.length >= Math.min(2, limit)) return cleaned;
  return compactCoachList(uniqueItems([...cleaned, ...fallback], limit), maxLength).slice(0, limit);
}

function buildCandidateLines(text: string) {
  return uniqueItems(
    text
      .replace(/\r/g, '\n')
      .split(/\n+/)
      .flatMap((line) => line.split(/(?<=[.!?])\s+/))
      .map((line) => line.replace(/^[•*\-\d.)\s]+/, '').trim())
      .filter((line) => line.length >= 14),
    80,
  );
}

function pickLinesByKeywords(lines: string[], keywords: string[], fallback: string[], limit = 4) {
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const directMatches = lines.filter((line) => {
    const loweredLine = line.toLowerCase();
    return loweredKeywords.some((keyword) => loweredLine.includes(keyword));
  });
  return uniqueItems([...directMatches, ...fallback], limit);
}

function buildCoachInsights(plan: AssignmentPlan) {
  const extracted = plan.extractedTask;
  const candidateLines = buildCandidateLines(
    [plan.taskSheetText, plan.rubricText, extracted?.summary]
      .filter(Boolean)
      .join('\n'),
  );
  const deliverables = uniqueItems(extracted?.deliverables || [], 4);

  const keyInstructions = uniqueItems(
    extracted?.keyInstructions?.length
      ? extracted.keyInstructions
      : pickLinesByKeywords(
          candidateLines,
          ['must', 'required', 'analyse', 'explain', 'discuss', 'evaluate', 'create', 'complete', 'respond'],
          [
            `Break down exactly what the ${plan.assignmentType.toLowerCase()} needs to deliver.`,
            `Use the task sheet language directly when planning each section of ${plan.title}.`,
          ],
        ),
  );

  const researchAreas = uniqueItems(
    extracted?.researchAreas?.length
      ? extracted.researchAreas
      : pickLinesByKeywords(
          candidateLines,
          ['research', 'source', 'evidence', 'investigate', 'example', 'case study', 'theory', 'background'],
          [
            `Find credible sources tied directly to ${plan.subject}.`,
            `Collect evidence that supports each major point in ${plan.title}.`,
          ],
        ),
  );

  const topicsNeeded = uniqueItems(
    extracted?.topicsNeeded?.length
      ? extracted.topicsNeeded
      : pickLinesByKeywords(
          candidateLines,
          ['topic', 'theme', 'focus', 'issue', 'concept', 'question', 'problem'],
          [...researchAreas, ...deliverables],
          5,
        ),
    5,
  );

  const formattingRequirements = uniqueItems(
    extracted?.formattingRequirements?.length
      ? extracted.formattingRequirements
      : pickLinesByKeywords(
          candidateLines,
          ['word', 'format', 'reference', 'harvard', 'ieee', 'citation', 'paragraph', 'font', 'slide', 'presentation'],
          [
            extracted?.wordCount ? `Stay within the required word count: ${extracted.wordCount}.` : '',
            'Match the structure and formatting rules before final submission.',
          ],
        ),
  );

  const submissionRequirements = uniqueItems(
    extracted?.submissionRequirements?.length
      ? extracted.submissionRequirements
      : pickLinesByKeywords(
          candidateLines,
          ['submit', 'due', 'upload', 'turnitin', 'classroom', 'draft', 'final', 'deadline'],
          [
            plan.dueDate ? `Submit the final version by ${plan.dueDate}.` : '',
            'Check the exact submission method before the final upload.',
          ],
        ),
  );

  const successChecklist = uniqueItems(
    extracted?.successChecklist?.length
      ? extracted.successChecklist
      : [
          `Cover every required deliverable${deliverables[0] ? `, including ${deliverables[0]}` : ''}.`,
          extracted?.wordCount ? `Stay on target for ${extracted.wordCount}.` : 'Keep the response within the required length.',
          'Use evidence and examples that directly answer the task.',
          'Check the rubric line by line before submitting.',
        ],
    5,
  );

  const outlineOverviewSource = extracted?.outlineOverview?.trim() || '';
  const outlineOverview = compactCoachParagraph(
    isUsableOutlineOverview(outlineOverviewSource)
      ? outlineOverviewSource
      : buildOutlineOverviewSummary(plan, extracted),
    520,
  );

  return {
    keyInstructions: normalizeCoachCollection(keyInstructions, [
      `Answer the assignment question directly in each section.`,
      `Follow the task sheet requirements before you start drafting.`,
      `Use the rubric language to guide what strong evidence looks like.`,
    ]),
    researchAreas: normalizeCoachCollection(researchAreas, [
      `Find evidence that directly supports the main claim.`,
      `Use credible sources and record the strongest data points.`,
      `Collect examples you can analyse in the final response.`,
    ]),
    topicsNeeded: normalizeCoachCollection(topicsNeeded, [
      `Identify the main concepts the task expects you to explain.`,
      `Break the topic into clear sections you can research and write.`,
      `Focus on the ideas most relevant to the assignment question.`,
    ]),
    formattingRequirements: normalizeCoachCollection(formattingRequirements, [
      extracted?.wordCount ? `Keep the response within ${extracted.wordCount}.` : 'Keep the response within the required word count.',
      `Use the required structure, formatting, and referencing style.`,
      `Check layout and headings before final submission.`,
    ]),
    submissionRequirements: normalizeCoachCollection(submissionRequirements, [
      plan.dueDate ? `Submit the final version by ${plan.dueDate}.` : 'Submit the final version by the listed due date.',
      `Confirm the upload method and final file requirements.`,
      `Complete the final submission checks before you turn it in.`,
    ]),
    successChecklist: normalizeCoachCollection(successChecklist, [
      `Cover every required deliverable from the task sheet.`,
      `Use evidence that clearly supports your response.`,
      `Check the rubric line by line before submitting.`,
    ]),
    outlineOverview,
  };
}

interface AssignmentCoachPageProps {
  variant?: 'default' | 'university-studio';
}

export default function AssignmentCoachPage({ variant = 'default' }: AssignmentCoachPageProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { planId } = useParams();
  const { isPhone } = useResponsiveDevice();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const isUniversityStudio = variant === 'university-studio';

  const [plans, setPlans] = useState<AssignmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [isRefreshingRoutine, setIsRefreshingRoutine] = useState(false);
  const [error, setError] = useState('');
  const [createFormError, setCreateFormError] = useState('');
  const [createForm, setCreateForm] = useState<CoachFormState>(EMPTY_FORM);
  const [taskSheetFile, setTaskSheetFile] = useState<File | null>(null);
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [taskSheetTextInput, setTaskSheetTextInput] = useState('');
  const [rubricTextInput, setRubricTextInput] = useState('');
  const [draftTextInput, setDraftTextInput] = useState('');
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTimeLabel, setPreferredTimeLabel] = useState('Afternoon');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [taskDrafts, setTaskDrafts] = useState<Record<number, string>>({});
  const [showSourceDocuments, setShowSourceDocuments] = useState(false);
  const [showCalendarTimetable, setShowCalendarTimetable] = useState(true);
  const createFormRef = useRef<HTMLDivElement | null>(null);
  const uploadSectionRef = useRef<HTMLDivElement | null>(null);
  const workspaceAutosaveSnapshotRef = useRef('');
  const normalizedCalendarScheduleRef = useRef('');

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === activePlanId) || null,
    [plans, activePlanId],
  );
  const coachInsights = useMemo(
    () => (activePlan ? buildCoachInsights(activePlan) : null),
    [activePlan],
  );

  const openCreateForm = () => {
    setShowCreateForm(true);
    setActivePlanId(null);
    setCreateFormError('');
    navigate(studentPortalAssignmentCoachPath(activePortal));
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    });
  };

  const keepUploadSectionAnchored = () => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const anchorTop = uploadSectionRef.current?.getBoundingClientRect().top;
        if (typeof anchorTop !== 'number') return;
        window.scrollTo({
          top: Math.max(0, window.scrollY + anchorTop - 140),
          behavior: 'auto',
        });
      }, 40);
    });
  };

  useEffect(() => {
    const fetchPlans = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'assignmentPlans'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
          ),
        );

        const nextPlans = snapshot.docs.map((planDoc) => ({
          id: planDoc.id,
          ...planDoc.data(),
        })) as AssignmentPlan[];

        setPlans(nextPlans);
        if (planId) {
          setActivePlanId(planId);
        } else if (nextPlans[0]) {
          setActivePlanId(nextPlans[0].id);
        } else {
          setActivePlanId(null);
        }
        setShowCreateForm(nextPlans.length === 0);
      } catch (fetchError) {
        console.error('Failed to load assignment coach plans:', fetchError);
        setError('Could not load Assignment Coach plans.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [planId]);

  useEffect(() => {
    if (!activePlan) return;
    const loadedPreferredDays = activePlan.schedulePreferences?.preferredDays || ['Monday', 'Wednesday', 'Saturday'];
    const loadedSessionsPerWeek = clampSessionCount(
      loadedPreferredDays,
      activePlan.schedulePreferences?.sessionsPerWeek || 3,
    );

    setTaskSheetTextInput(activePlan.taskSheetText || '');
    setRubricTextInput(activePlan.rubricText || '');
    setDraftTextInput(activePlan.draftContent || '');
    setPreferredDays(loadedPreferredDays);
    setPreferredTimeLabel(activePlan.schedulePreferences?.preferredTimeLabel || 'Afternoon');
    setSessionsPerWeek(loadedSessionsPerWeek);
    setTaskDrafts({});
    setShowCreateForm(false);
    setError('');
    setCreateFormError('');
    workspaceAutosaveSnapshotRef.current = JSON.stringify({
      taskSheetText: activePlan.taskSheetText || '',
      rubricText: activePlan.rubricText || '',
      draftContent: activePlan.draftContent || '',
      preferredDays: loadedPreferredDays,
      preferredTimeLabel: activePlan.schedulePreferences?.preferredTimeLabel || 'Afternoon',
      sessionsPerWeek: loadedSessionsPerWeek,
    });
  }, [activePlan?.id]);

  useEffect(() => {
    if (!activePlan || !location.hash) return;

    const targetId = location.hash.replace('#', '');
    const scrollToTarget = () => {
      const element = document.getElementById(targetId);
      if (!element) return false;
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    };

    if (scrollToTarget()) return;

    const timer = window.setTimeout(scrollToTarget, 180);
    return () => window.clearTimeout(timer);
  }, [activePlan?.id, location.hash]);

  useEffect(() => {
    if (showCreateForm) return;
    const nextSessionsPerWeek = clampSessionCount(preferredDays, sessionsPerWeek);
    if (nextSessionsPerWeek !== sessionsPerWeek) {
      setSessionsPerWeek(nextSessionsPerWeek);
    }
  }, [preferredDays, sessionsPerWeek, showCreateForm]);

  useEffect(() => {
    const nextSessionsPerWeek = clampSessionCount(createForm.preferredDays, createForm.sessionsPerWeek);
    if (nextSessionsPerWeek !== createForm.sessionsPerWeek) {
      setCreateForm((current) => ({ ...current, sessionsPerWeek: nextSessionsPerWeek }));
    }
  }, [createForm.preferredDays, createForm.sessionsPerWeek]);

  useEffect(() => {
    if (showCreateForm || !activePlan) return;
    const normalizedSessionsPerWeek = clampSessionCount(preferredDays, sessionsPerWeek);

    const snapshot = JSON.stringify({
      taskSheetText: taskSheetTextInput.trim(),
      rubricText: rubricTextInput.trim(),
      draftContent: draftTextInput.trim(),
      preferredDays,
      preferredTimeLabel,
      sessionsPerWeek: normalizedSessionsPerWeek,
    });

    if (snapshot === workspaceAutosaveSnapshotRef.current) return;

    const timeout = window.setTimeout(async () => {
      workspaceAutosaveSnapshotRef.current = snapshot;
      const updates: Partial<AssignmentPlan> = {
        taskSheetText: taskSheetTextInput.trim(),
        rubricText: rubricTextInput.trim(),
        draftContent: draftTextInput.trim(),
        schedulePreferences: {
          preferredDays,
          preferredTimeLabel,
          sessionsPerWeek: normalizedSessionsPerWeek,
        },
      };

      setPlans((current) =>
        current.map((plan) => (plan.id === activePlan.id ? { ...plan, ...updates } : plan)),
      );

      try {
        await updateDoc(doc(db, 'assignmentPlans', activePlan.id), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
      } catch (autosaveError) {
        console.error('Failed to autosave assignment coach workspace:', autosaveError);
        setError('Could not save the latest change. Please try again.');
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    activePlan?.id,
    draftTextInput,
    preferredDays,
    preferredTimeLabel,
    rubricTextInput,
    sessionsPerWeek,
    showCreateForm,
    taskSheetTextInput,
  ]);

  useEffect(() => {
    if (!activePlan || showCreateForm) return;

    const startDate =
      parseLocalDate(activePlan.createdAt) ||
      parseLocalDate(activePlan.updatedAt) ||
      new Date();
    const dueDate = parseLocalDate(activePlan.dueDate) || addDays(startDate, 14);
    const existingSchedule = activePlan.coachSchedule || [];
    const normalizedSessionsPerWeek = clampSessionCount(preferredDays, sessionsPerWeek);
    const nextSchedule = expandScheduleToCalendar(
      startDate,
      dueDate,
      preferredDays,
      preferredTimeLabel,
      normalizedSessionsPerWeek,
      activePlan.steps,
      existingSchedule,
    );

    if (buildScheduleSignature(existingSchedule) === buildScheduleSignature(nextSchedule)) return;

    const fingerprint = `${activePlan.id}:${activePlan.dueDate}:${preferredDays.join('|')}:${preferredTimeLabel}:${normalizedSessionsPerWeek}:${buildScheduleSignature(nextSchedule)}`;
    if (normalizedCalendarScheduleRef.current === fingerprint) return;
    normalizedCalendarScheduleRef.current = fingerprint;

    void updatePlan({
      coachSchedule: nextSchedule,
      schedulePreferences: {
        preferredDays,
        preferredTimeLabel,
        sessionsPerWeek: normalizedSessionsPerWeek,
      },
    });
  }, [activePlan, preferredDays, preferredTimeLabel, sessionsPerWeek, showCreateForm]);

  useEffect(() => {
    if (!createFormError) return;
    setCreateFormError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    createForm.title,
    createForm.subject,
    createForm.assignmentType,
    createForm.dueDate,
    createForm.yearLevel,
    createForm.taskSheetText,
    createForm.rubricText,
    createForm.preferredDays,
    createForm.preferredTimeLabel,
    createForm.sessionsPerWeek,
    taskSheetFile,
    rubricFile,
  ]);

  const updatePlan = async (updates: Partial<AssignmentPlan>) => {
    if (!activePlan) return;

    setPlans((current) =>
      current.map((plan) => (plan.id === activePlan.id ? { ...plan, ...updates } : plan)),
    );

    try {
      await updateDoc(doc(db, 'assignmentPlans', activePlan.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (updateError) {
      console.error('Failed to update assignment coach plan:', updateError);
      setError('Could not save the latest change. Please try again.');
    }
  };

  const togglePreferredDay = (day: string) => {
    setPreferredDays((current) =>
      current.includes(day)
        ? (current.length === 1 ? current : current.filter((entry) => entry !== day))
        : [...current, day],
    );
  };

  const runDocumentExtraction = async (label: string, pastedText: string, file: File | null) => {
    const trimmedText = pastedText.trim();
    if (!file) {
      return trimmedText;
    }

    if (isDocxFile(file)) {
      const fileDataUrl = await readFileAsDataUrl(file);
      return getOrCreateCachedAiResult(
        {
          scope: 'assignment-coach-document-text',
          input: {
            label,
            trimmedText,
            fileName: file.name,
            mimeType: file.type,
            fileDataUrl,
          },
        },
        async () => {
          const response = await fetch('/api/document-text', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dataUrl: fileDataUrl,
              fileName: file.name,
              mimeType: file.type,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || 'Could not read the DOCX file.');
          }

          return [trimmedText, String(data?.text || '').trim()].filter(Boolean).join('\n\n').trim();
        },
      );
    }

    const fileDataUrl = await readFileAsDataUrl(file);
    return getOrCreateCachedAiResult(
      {
        scope: 'assignment-coach-document-extraction',
        input: {
          label,
          trimmedText,
          fileName: file.name,
          mimeType: file.type,
          fileDataUrl,
        },
      },
      async () => {
        const response = await geminiGenerateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Extract the useful readable text from this ${label} for an assignment planning app.

Rules:
- Return plain text only.
- Preserve headings, bullet points, criteria labels, due dates, word counts, and requirements when present.
- Remove decorative junk and repeated footer/header noise.
${trimmedText ? `- Also merge in this pasted text if it adds context:\n${trimmedText}` : ''}`,
                },
                { inlineData: inlineDataFromDataUrl(fileDataUrl) },
              ],
            },
          ],
        });

        return [trimmedText, response.text?.trim()].filter(Boolean).join('\n\n').trim();
      },
    );
  };

  const extractAssignmentTask = async (form: CoachFormState, taskSourceText: string, rubricSourceText: string) => {
    return getOrCreateCachedAiResult(
      {
        scope: 'assignment-coach-task-analysis',
        input: {
          form,
          taskSourceText,
          rubricSourceText,
        },
      },
      async () => {
        const response = await geminiGenerateContent({
          model: 'gemini-3-flash-preview',
          contents: `You are analysing a student assignment task sheet.

Student-confirmed details:
- Title: ${form.title || 'Not confirmed'}
- Subject: ${form.subject || 'Not confirmed'}
- Assignment type: ${form.assignmentType}
- Due date: ${form.dueDate || 'Not confirmed'}
- Year level: ${form.yearLevel || 'Not confirmed'}

Task sheet content:
${taskSourceText || 'No task sheet text was provided.'}

Rubric / criteria content:
${rubricSourceText || 'No rubric text was provided.'}

Return valid JSON only with this shape:
{
  "extractedTitle": "string",
  "subject": "string",
  "assignmentType": "string",
  "dueDate": "YYYY-MM-DD or empty string",
  "deliverables": ["string"],
  "wordCount": "string",
  "keyInstructions": ["string"],
  "researchAreas": ["string"],
  "topicsNeeded": ["string"],
  "formattingRequirements": ["string"],
  "submissionRequirements": ["string"],
  "successChecklist": ["string"],
  "outlineOverview": "string",
  "summary": "string"
}

Requirements:
- Prefer the task sheet over the form when the document is explicit.
- Keep the summary concise and concrete.
- Infer practical student-facing items from the task and rubric instead of returning empty arrays.
- Every list item must be a short, complete, student-facing summary of important task-sheet information.
- Rewrite fragments into clear standalone points. Do not copy unfinished worksheet text.
- Keep each bullet roughly 6-14 words where possible.
- Do not return labels, headings, dates by themselves, trailing colons, ellipses, or half-finished phrases.
- Do not return sentence fragments, question prompts, worksheet scaffolds, or unfinished stems like "This claim must", "Checkpoint -", or "Answer the questions...".
- If the task sheet contains questions or prompts, rewrite them as clear instructions for the student.
- "keyInstructions" should tell the student what they actually need to do.
- "researchAreas" should capture the knowledge or evidence areas they need to cover.
- "topicsNeeded" should list the big topics, concepts, or sections they need to understand.
- "successChecklist" should be a short submission-ready checklist.
- "summary" should explain the task in plain language without writing the answer for the student.
- "summary" must ignore worksheet timelines, checkpoint calendars, holiday notes, class scheduling rows, and any student-selected claim/topic text.
- "outlineOverview" should be a complete planning summary that explains what needs to be done, what the response should cover, and what to check before submission.
- "outlineOverview" must not draft paragraphs, thesis statements, topic sentences, or final wording the student could paste into the assignment.
- "outlineOverview" must not mention a chosen claim, chosen topic, chosen research question, or any decision the student still needs to make.
- "outlineOverview" must be 2-4 complete sentences and must not end with ellipses or unfinished thoughts.
- Only leave a field empty if the task and rubric genuinely give nothing useful.`,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        return {
          extractedTitle: parsed.extractedTitle || '',
          subject: parsed.subject || '',
          assignmentType: parsed.assignmentType || form.assignmentType,
          dueDate: cleanDate(parsed.dueDate),
          deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables.filter(Boolean) : [],
          wordCount: parsed.wordCount || '',
          keyInstructions: Array.isArray(parsed.keyInstructions) ? parsed.keyInstructions.filter(Boolean) : [],
          researchAreas: Array.isArray(parsed.researchAreas) ? parsed.researchAreas.filter(Boolean) : [],
          topicsNeeded: Array.isArray(parsed.topicsNeeded) ? parsed.topicsNeeded.filter(Boolean) : [],
          formattingRequirements: Array.isArray(parsed.formattingRequirements) ? parsed.formattingRequirements.filter(Boolean) : [],
          submissionRequirements: Array.isArray(parsed.submissionRequirements) ? parsed.submissionRequirements.filter(Boolean) : [],
          successChecklist: Array.isArray(parsed.successChecklist) ? parsed.successChecklist.filter(Boolean) : [],
          outlineOverview: parsed.outlineOverview || '',
          summary: parsed.summary || '',
        } satisfies NonNullable<AssignmentPlan['extractedTask']>;
      },
    );
  };

  const generateRoutine = async (
    form: CoachFormState,
    extractedTask: NonNullable<AssignmentPlan['extractedTask']>,
  ) => {
    const stepTitles = buildStepTitles(form.assignmentType);
    return getOrCreateCachedAiResult(
      {
        scope: 'assignment-coach-routine',
        input: {
          form,
          extractedTask,
          stepTitles,
        },
      },
      async () => {
        const response = await geminiGenerateContent({
          model: 'gemini-3-flash-preview',
          contents: `Create a personalised assignment routine for this student.

Assignment details:
- Title: ${extractedTask.extractedTitle || form.title}
- Subject: ${extractedTask.subject || form.subject}
- Type: ${extractedTask.assignmentType || form.assignmentType}
- Due date: ${extractedTask.dueDate || form.dueDate}
- Year level: ${form.yearLevel}
- Word count: ${extractedTask.wordCount || 'Not specified'}
- Summary: ${extractedTask.summary || 'Not specified'}
- Deliverables: ${(extractedTask.deliverables || []).join('; ') || 'Not specified'}
- Key instructions: ${(extractedTask.keyInstructions || []).join('; ') || 'Not specified'}
- Research areas: ${(extractedTask.researchAreas || []).join('; ') || 'Not specified'}
- Topics needed: ${(extractedTask.topicsNeeded || []).join('; ') || 'Not specified'}
- Formatting requirements: ${(extractedTask.formattingRequirements || []).join('; ') || 'Not specified'}
- Submission requirements: ${(extractedTask.submissionRequirements || []).join('; ') || 'Not specified'}
- Success checklist: ${(extractedTask.successChecklist || []).join('; ') || 'Not specified'}
- Outline overview: ${extractedTask.outlineOverview || 'Not specified'}

Student schedule preferences:
- Preferred days: ${form.preferredDays.join(', ')}
- Preferred time: ${form.preferredTimeLabel}
- Sessions per week: ${form.sessionsPerWeek}

Use this 5-step skeleton:
1. ${stepTitles[0]}
2. ${stepTitles[1]}
3. ${stepTitles[2]}
4. ${stepTitles[3]}
5. ${stepTitles[4]}

Return valid JSON only with this shape:
{
  "routineOverview": "string",
  "refinedTitle": "string",
  "refinedSubject": "string",
  "refinedAssignmentType": "string",
  "refinedDueDate": "YYYY-MM-DD or empty string",
  "steps": [
    {
      "stepId": 1,
      "tasks": [
        {
          "text": "string",
          "priority": "low|medium|high",
          "estimatedTime": "string",
          "notes": "string",
          "subtasks": ["string"]
        }
      ]
    }
  ],
  "weeklySchedule": [
    {
      "day": "string",
      "timeLabel": "string",
      "focusStep": 1,
      "focus": "string",
      "objective": "string"
    }
  ]
}

Rules:
- Keep "refinedTitle" identical to the student's provided title, or a very short generic assignment label from the task sheet if the student title is blank. Never expand it into a long polished title.
- Generate 2-4 useful tasks per step.
- Make the routine specific to the assignment, not generic fluff.
- Each step task must be concrete, different from the others, and tied to the real deliverable, topic, evidence, or structure from this assignment.
- Do not repeat generic tasks like "read the task sheet" or "understand task" across multiple steps unless the assignment details genuinely require a different specific action.
- Prefer task text like "Find 3 peer-reviewed sources about X", "Draft the introduction answering Y", "Build the slide outline with sections A/B/C", or "Check criterion Z against paragraph 2".
- Build the weeklySchedule as milestone hints only, with each item representing a different stage of completion.
- Weekly schedule items must not all use the same focus or objective.
- If there are more than 5 timetable sessions available, split the workload across multiple sessions inside the same step instead of inventing extra steps.
- Distribute larger steps across multiple sessions where helpful, and keep the focusStep value tied to the correct one of the 5 core steps.
- Honour the preferred days/time.
- Keep each objective action-oriented and helpful enough to place directly in a timetable card.`,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const parsed = JSON.parse(response.text || '{}');
        const fallbackSteps = buildFallbackSteps(form, extractedTask);

        const steps = fallbackSteps.map((step) => {
          const generated = Array.isArray(parsed.steps)
            ? parsed.steps.find((item: any) => Number(item?.stepId) === step.id)
            : null;

          if (!generated || !Array.isArray(generated.tasks) || generated.tasks.length === 0) {
            return step;
          }

          return {
            ...step,
            tasks: generated.tasks.map((task: any) => ({
              id: crypto.randomUUID(),
              text: String(task?.text || '').trim() || step.tasks[0]?.text || 'Complete this task.',
              completed: false,
              priority: task?.priority === 'low' || task?.priority === 'high' ? task.priority : 'medium',
              estimatedTime: String(task?.estimatedTime || '45m'),
              notes: String(task?.notes || ''),
              subtasks: Array.isArray(task?.subtasks)
                ? task.subtasks.filter(Boolean).map((subtask: string) => ({
                    id: crypto.randomUUID(),
                    text: subtask,
                    completed: false,
                  }))
                : [],
            })),
          };
        });

        const normalizedSessionsPerWeek = clampSessionCount(form.preferredDays, form.sessionsPerWeek);
        const baseSchedule = Array.isArray(parsed.weeklySchedule) && parsed.weeklySchedule.length > 0
          ? parsed.weeklySchedule.map((item: any) => ({
              id: crypto.randomUUID(),
              day: String(item?.day || form.preferredDays[0] || 'Monday'),
              timeLabel: String(item?.timeLabel || form.preferredTimeLabel || 'Afternoon'),
              focusStep: Number(item?.focusStep) || 1,
              focus: String(item?.focus || 'Assignment work'),
              objective: String(item?.objective || 'Make progress on the assignment.'),
              isFocusDay: true,
              completed: false,
            }))
          : buildFallbackSchedule(form.preferredDays, form.preferredTimeLabel, normalizedSessionsPerWeek, steps);

        const schedule = expandScheduleToCalendar(
          new Date(),
          parseLocalDate(cleanDate(parsed.refinedDueDate) || extractedTask.dueDate || form.dueDate) || addDays(new Date(), 14),
          form.preferredDays,
          form.preferredTimeLabel,
          normalizedSessionsPerWeek,
          steps,
          baseSchedule,
        );

        return {
          routineOverview: String(parsed.routineOverview || ''),
          refinedTitle: String(parsed.refinedTitle || '').trim(),
          refinedSubject: String(parsed.refinedSubject || '').trim(),
          refinedAssignmentType: String(parsed.refinedAssignmentType || '').trim(),
          refinedDueDate: cleanDate(parsed.refinedDueDate),
          steps,
          schedule,
        };
      },
    );
  };

  const handleCreatePlan = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!createForm.title.trim() || !createForm.subject.trim() || !createForm.dueDate || !createForm.yearLevel.trim()) {
      setCreateFormError('Title, subject, due date, and year level are required.');
      return;
    }

    setIsCreating(true);
    setError('');
    setCreateFormError('');

    try {
      const [taskSourceText, rubricSourceText] = await Promise.all([
        runDocumentExtraction('assignment task sheet', createForm.taskSheetText, taskSheetFile),
        runDocumentExtraction('rubric or criteria sheet', createForm.rubricText, rubricFile),
      ]);

      let extractedTask: NonNullable<AssignmentPlan['extractedTask']>;
      try {
        extractedTask = await extractAssignmentTask(createForm, taskSourceText, rubricSourceText);
      } catch (extractError) {
        console.error('Task extraction failed, falling back:', extractError);
        extractedTask = {
          extractedTitle: createForm.title,
          subject: createForm.subject,
          assignmentType: createForm.assignmentType,
          dueDate: createForm.dueDate,
          deliverables: [],
          wordCount: '',
          keyInstructions: [],
          researchAreas: [],
          topicsNeeded: [],
          formattingRequirements: [],
          submissionRequirements: [],
          successChecklist: [],
          outlineOverview: '',
          summary: sanitizeOverviewSourceText(taskSourceText, 420),
        };
      }

      let generatedRoutine;
      try {
        generatedRoutine = await generateRoutine(createForm, extractedTask);
      } catch (routineError) {
        console.error('Routine generation failed, falling back:', routineError);
        const fallbackSteps = buildFallbackSteps(createForm, extractedTask);
        generatedRoutine = {
          routineOverview: `Work through the assignment in five phases: understand the task, research, plan, draft, and review before submission on ${createForm.dueDate}.`,
          refinedTitle: createForm.title,
          refinedSubject: createForm.subject,
          refinedAssignmentType: createForm.assignmentType,
          refinedDueDate: createForm.dueDate,
          steps: fallbackSteps,
          schedule: buildFallbackSchedule(createForm.preferredDays, createForm.preferredTimeLabel, createForm.sessionsPerWeek, fallbackSteps),
        };
      }

      const finalTitle = createForm.title.trim();
      const finalSubject = generatedRoutine.refinedSubject || extractedTask.subject || createForm.subject;
      const finalType = generatedRoutine.refinedAssignmentType || extractedTask.assignmentType || createForm.assignmentType;
      const finalDueDate = generatedRoutine.refinedDueDate || extractedTask.dueDate || createForm.dueDate;
      const steps = generatedRoutine.steps as AssignmentPlan['steps'];

      const planRef = doc(collection(db, 'assignmentPlans'));
      const deadlineRef = doc(collection(db, 'deadlines'));
      const batch = writeBatch(db);

      batch.set(planRef, {
        userId: user.uid,
        title: finalTitle,
        subject: finalSubject,
        assignmentType: finalType,
        dueDate: finalDueDate,
        yearLevel: createForm.yearLevel,
        currentStep: computeCurrentStep(steps),
        steps,
        researchResources: [],
        researchKeyPoints: [],
        draftContent: '',
        taskSheetText: taskSourceText,
        taskSheetFileName: taskSheetFile?.name || '',
        rubricText: rubricSourceText,
        rubricFileName: rubricFile?.name || '',
        coachOverview: generatedRoutine.routineOverview,
        extractedTask,
        schedulePreferences: {
          preferredDays: createForm.preferredDays,
          preferredTimeLabel: createForm.preferredTimeLabel,
          sessionsPerWeek: createForm.sessionsPerWeek,
        },
        coachSchedule: generatedRoutine.schedule,
        deadlineId: deadlineRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(deadlineRef, {
        userId: user.uid,
        title: finalTitle,
        course: finalSubject,
        dueDate: new Date(finalDueDate),
        type: 'assignment',
        priority: 'high',
        completed: false,
        assignmentPlanId: planRef.id,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      const newPlan: AssignmentPlan = {
        id: planRef.id,
        userId: user.uid,
        title: finalTitle,
        subject: finalSubject,
        assignmentType: finalType,
        dueDate: finalDueDate,
        yearLevel: createForm.yearLevel,
        currentStep: computeCurrentStep(steps),
        steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        researchResources: [],
        researchKeyPoints: [],
        draftContent: '',
        taskSheetText: taskSourceText,
        taskSheetFileName: taskSheetFile?.name || '',
        rubricText: rubricSourceText,
        rubricFileName: rubricFile?.name || '',
        coachOverview: generatedRoutine.routineOverview,
        extractedTask,
        schedulePreferences: {
          preferredDays: createForm.preferredDays,
          preferredTimeLabel: createForm.preferredTimeLabel,
          sessionsPerWeek: createForm.sessionsPerWeek,
        },
        coachSchedule: generatedRoutine.schedule,
      };

      setPlans((current) => [newPlan, ...current]);
      setActivePlanId(planRef.id);
      setCreateForm(EMPTY_FORM);
      setTaskSheetFile(null);
      setRubricFile(null);
      setShowCreateForm(false);
      navigate(studentPortalAssignmentCoachPath(activePortal, planRef.id));
    } catch (createError) {
      console.error('Failed to create assignment coach plan:', createError);
      setCreateFormError(createError instanceof Error ? createError.message : 'Could not create Assignment Coach plan.');
    } finally {
      setIsCreating(false);
    }
  };

  const refreshRoutine = async () => {
    if (!activePlan) return;
    setIsRefreshingRoutine(true);
    setError('');
    try {
      const generatedRoutine = await generateRoutine(
        {
          title: activePlan.title,
          subject: activePlan.subject,
          assignmentType: activePlan.assignmentType,
          dueDate: activePlan.dueDate,
          yearLevel: activePlan.yearLevel || '',
          taskSheetText: taskSheetTextInput,
          rubricText: rubricTextInput,
          preferredDays,
          preferredTimeLabel,
          sessionsPerWeek,
        },
        activePlan.extractedTask || {
          extractedTitle: activePlan.title,
          subject: activePlan.subject,
          assignmentType: activePlan.assignmentType,
          dueDate: activePlan.dueDate,
          deliverables: [],
          wordCount: '',
          keyInstructions: [],
          researchAreas: [],
          topicsNeeded: [],
          formattingRequirements: [],
          submissionRequirements: [],
          successChecklist: [],
          outlineOverview: '',
          summary: sanitizeOverviewSourceText(taskSheetTextInput, 420),
        },
      );

      await updatePlan({
        title: activePlan.title,
        subject: generatedRoutine.refinedSubject || activePlan.subject,
        assignmentType: generatedRoutine.refinedAssignmentType || activePlan.assignmentType,
        dueDate: generatedRoutine.refinedDueDate || activePlan.dueDate,
        taskSheetText: taskSheetTextInput.trim(),
        rubricText: rubricTextInput.trim(),
        coachOverview: generatedRoutine.routineOverview,
        steps: generatedRoutine.steps,
        coachSchedule: generatedRoutine.schedule,
        schedulePreferences: {
          preferredDays,
          preferredTimeLabel,
          sessionsPerWeek,
        },
        currentStep: computeCurrentStep(generatedRoutine.steps),
      });
    } catch (refreshError) {
      console.error('Failed to refresh assignment coach routine:', refreshError);
      setError('Could not refresh the Assignment Coach routine.');
    } finally {
      setIsRefreshingRoutine(false);
    }
  };

  const runRubricFeedback = async () => {
    if (!activePlan) return;
    const draftText = draftTextInput.trim();

    if (!draftText && !draftFile) {
      setError('Paste or upload a draft before asking for rubric feedback.');
      return;
    }

    setIsGeneratingFeedback(true);
    setError('');

    try {
      const extractedDraftText = draftFile
        ? await runDocumentExtraction('student draft', draftTextInput, draftFile)
        : draftText;

      const rubricFeedback = await getOrCreateCachedAiResult(
        {
          scope: 'assignment-coach-rubric-feedback',
          input: {
            planId: activePlan.id,
            title: activePlan.title,
            subject: activePlan.subject,
            assignmentType: activePlan.assignmentType,
            yearLevel: activePlan.yearLevel || '',
            dueDate: activePlan.dueDate,
            taskSummary: activePlan.extractedTask?.summary || activePlan.taskSheetText || '',
            deliverables: activePlan.extractedTask?.deliverables || [],
            rubricText: rubricTextInput.trim() || activePlan.rubricText || '',
            draftText: extractedDraftText,
          },
        },
        async () => {
          const response = await geminiGenerateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `You are marking a student's assignment draft against the task and rubric.

Assignment:
- Title: ${activePlan.title}
- Subject: ${activePlan.subject}
- Type: ${activePlan.assignmentType}
- Year level: ${activePlan.yearLevel || 'Not specified'}
- Due date: ${activePlan.dueDate}

Task summary:
${activePlan.extractedTask?.summary || activePlan.taskSheetText || 'Not provided'}

Deliverables:
${activePlan.extractedTask?.deliverables?.join('\n') || 'Not provided'}

Rubric / criteria:
${rubricTextInput.trim() || activePlan.rubricText || 'No rubric provided. Use task requirements only.'}

Draft:
${extractedDraftText}

Return valid JSON only with this shape:
{
  "estimatedMarkRange": "string",
  "overallVerdict": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "missingRequirements": ["string"],
  "suggestedImprovements": ["string"],
  "nextActions": ["string"],
  "criteria": [
    {
      "criterion": "string",
      "estimatedBand": "string",
      "feedback": "string",
      "strengths": ["string"],
      "fixes": ["string"]
    }
  ]
}

Rules:
- Be direct and useful.
- Base comments on the rubric where possible.
- Identify what is missing, weak, or off-task.
- Give concrete next edits before submission.`,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const parsed = JSON.parse(response.text || '{}');
          return {
            estimatedMarkRange: String(parsed.estimatedMarkRange || 'Not enough evidence'),
            overallVerdict: String(parsed.overallVerdict || ''),
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter(Boolean) : [],
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter(Boolean) : [],
            missingRequirements: Array.isArray(parsed.missingRequirements) ? parsed.missingRequirements.filter(Boolean) : [],
            suggestedImprovements: Array.isArray(parsed.suggestedImprovements) ? parsed.suggestedImprovements.filter(Boolean) : [],
            nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.filter(Boolean) : [],
            criteria: Array.isArray(parsed.criteria)
              ? parsed.criteria.map((criterion: any) => ({
                  criterion: String(criterion?.criterion || 'Criterion'),
                  estimatedBand: String(criterion?.estimatedBand || ''),
                  feedback: String(criterion?.feedback || ''),
                  strengths: Array.isArray(criterion?.strengths) ? criterion.strengths.filter(Boolean) : [],
                  fixes: Array.isArray(criterion?.fixes) ? criterion.fixes.filter(Boolean) : [],
                }))
              : [],
            updatedAt: new Date().toISOString(),
          } satisfies NonNullable<AssignmentPlan['rubricFeedback']>;
        },
      );

      setDraftTextInput(extractedDraftText);
      setDraftFile(null);
      await updatePlan({
        draftContent: extractedDraftText,
        rubricText: rubricTextInput.trim(),
        rubricFeedback,
      });
    } catch (feedbackError) {
      console.error('Rubric feedback failed:', feedbackError);
      setError('Could not generate rubric feedback right now.');
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const addTask = async (stepId: number) => {
    if (!activePlan) return;
    const text = (taskDrafts[stepId] || '').trim();
    if (!text) return;

    const nextSteps = activePlan.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            tasks: [
              ...step.tasks,
              {
                id: crypto.randomUUID(),
                text,
                completed: false,
                priority: 'medium' as const,
                estimatedTime: '30m',
                notes: '',
                subtasks: [],
              },
            ],
          }
        : step,
    );

    setTaskDrafts((current) => ({ ...current, [stepId]: '' }));
    await updatePlan({ steps: nextSteps, currentStep: computeCurrentStep(nextSteps) });
  };

  const toggleTask = async (stepId: number, taskId: string) => {
    if (!activePlan) return;
    const nextSteps = activePlan.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            tasks: step.tasks.map((task) =>
              task.id === taskId ? { ...task, completed: !task.completed } : task,
            ),
          }
        : step,
    );

    await updatePlan({ steps: nextSteps, currentStep: computeCurrentStep(nextSteps) });
  };

  const updateTaskText = async (stepId: number, taskId: string, text: string) => {
    if (!activePlan) return;
    const nextSteps = activePlan.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            tasks: step.tasks.map((task) => (task.id === taskId ? { ...task, text } : task)),
          }
        : step,
    );

    await updatePlan({ steps: nextSteps });
  };

  const deleteTask = async (stepId: number, taskId: string) => {
    if (!activePlan) return;
    const nextSteps = activePlan.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            tasks: step.tasks.filter((task) => task.id !== taskId),
          }
        : step,
    );

    await updatePlan({ steps: nextSteps, currentStep: computeCurrentStep(nextSteps) });
  };

  const toggleScheduleItem = async (itemId: string) => {
    if (!activePlan?.coachSchedule) return;
    const nextSchedule = activePlan.coachSchedule.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );
    await updatePlan({ coachSchedule: nextSchedule });
  };

  const deletePlan = async (plan: AssignmentPlan) => {
    try {
      if (plan.deadlineId) {
        await deleteDoc(doc(db, 'deadlines', plan.deadlineId));
      }
      await deleteDoc(doc(db, 'assignmentPlans', plan.id));
      const nextPlans = plans.filter((item) => item.id !== plan.id);
      setPlans(nextPlans);
      const nextId = nextPlans[0]?.id || null;
      setActivePlanId(nextId);
      setShowCreateForm(nextPlans.length === 0);
      navigate(nextId ? studentPortalAssignmentCoachPath(activePortal, nextId) : studentPortalAssignmentCoachPath(activePortal));
    } catch (deleteError) {
      console.error('Failed to delete assignment coach plan:', deleteError);
      setError('Could not delete that assignment.');
    }
  };

  const progress = activePlan ? countProgress(activePlan) : { total: 0, completed: 0 };
  const nextWorkSession = useMemo(() => {
    if (!activePlan?.coachSchedule?.length) return null;
    return activePlan.coachSchedule.find((item) => !item.completed) || activePlan.coachSchedule[0];
  }, [activePlan]);
  const calendarTimetable = useMemo(() => {
    if (!activePlan) return null;

    const rawStartDate =
      parseLocalDate(activePlan.createdAt) ||
      parseLocalDate(activePlan.updatedAt) ||
      new Date();
    const startDate = startOfLocalDay(rawStartDate);
    const dueDate = startOfLocalDay(parseLocalDate(activePlan.dueDate) || addDays(startDate, 14));
    const safeDueDate = dueDate.getTime() < startDate.getTime() ? new Date(startDate) : dueDate;

    const existingSchedule = activePlan.coachSchedule || [];
    const scheduledItems = (existingSchedule.every((item) => item.scheduledDate)
      ? existingSchedule
          .filter((item) => {
            const date = parseLocalDate(item.scheduledDate);
            return date && date.getTime() >= startDate.getTime() && date.getTime() <= safeDueDate.getTime();
          })
          .map((item) => ({ ...item, scheduledDate: String(item.scheduledDate) }))
      : expandScheduleToCalendar(
          startDate,
          safeDueDate,
          activePlan.schedulePreferences?.preferredDays || ['Monday', 'Wednesday', 'Saturday'],
          activePlan.schedulePreferences?.preferredTimeLabel || 'Afternoon',
          activePlan.schedulePreferences?.sessionsPerWeek || 3,
          activePlan.steps,
          existingSchedule,
        )) as Array<NonNullable<AssignmentPlan['coachSchedule']>[number] & { scheduledDate: string }>;

    const itemsByDate = scheduledItems.reduce<Record<string, typeof scheduledItems>>((acc, item) => {
      acc[item.scheduledDate] = [...(acc[item.scheduledDate] || []), item];
      return acc;
    }, {});

    const gridStart = startOfCalendarWeek(startDate);
    const gridEnd = endOfCalendarWeek(safeDueDate);
    const weeks: Array<
      Array<{
        date: Date;
        dateKey: string;
        inRange: boolean;
        isAfterDue: boolean;
        isStart: boolean;
        isDue: boolean;
        isToday: boolean;
        items: typeof scheduledItems;
      }>
    > = [];

    for (let cursor = new Date(gridStart); cursor.getTime() <= gridEnd.getTime(); cursor = addDays(cursor, 7)) {
      weeks.push(
        Array.from({ length: 7 }, (_, offset) => {
          const date = addDays(cursor, offset);
          const normalizedDate = startOfLocalDay(date);
          const dateKey = toDateKey(date);
          return {
            date,
            dateKey,
            inRange: normalizedDate.getTime() >= startDate.getTime() && normalizedDate.getTime() <= safeDueDate.getTime(),
            isAfterDue: normalizedDate.getTime() > safeDueDate.getTime(),
            isStart: dateKey === toDateKey(startDate),
            isDue: dateKey === toDateKey(safeDueDate),
            isToday: dateKey === toDateKey(new Date()),
            items: itemsByDate[dateKey] || [],
          };
        }),
      );
    }

    const monthSections: Array<{ key: string; label: string; weeks: typeof weeks }> = [];
    weeks.forEach((week) => {
      const anchorDate = week.find((day) => day.inRange)?.date || week[0].date;
      const sectionKey = `${anchorDate.getFullYear()}-${anchorDate.getMonth()}`;
      const label = anchorDate.toLocaleDateString('en-AU', {
        month: 'long',
        year: 'numeric',
      });
      const existing = monthSections[monthSections.length - 1];
      if (!existing || existing.key !== sectionKey) {
        monthSections.push({ key: sectionKey, label, weeks: [week] });
        return;
      }
      existing.weeks.push(week);
    });

    return {
      startDate,
      dueDate: safeDueDate,
      startLabel: formatMonthDay(startDate),
      dueLabel: formatMonthDay(safeDueDate),
      scheduledItems,
      weeks,
      monthSections,
    };
  }, [activePlan]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className={cn(
      'mx-auto max-w-[1680px] rounded-[40px] border border-white/35 bg-[linear-gradient(180deg,rgba(244,244,246,0.82),rgba(229,231,235,0.58))] shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-2xl',
      isPhone ? 'space-y-5 p-4' : 'space-y-6 px-8 py-6',
    )}>
      <div className={cn('gap-4', isPhone ? 'space-y-3' : 'flex items-start justify-between')}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">
            {isUniversityStudio ? 'University workspace' : 'Flagship workflow'}
          </p>
          <div className={cn('gap-3', isPhone ? 'space-y-2' : 'mt-2 flex items-center gap-4')}>
            <h1 className={cn('font-black tracking-tight text-zinc-950', isPhone ? 'text-3xl' : 'text-5xl')}>
              {isUniversityStudio ? 'Assignment Studio' : 'Assignment Coach'}
            </h1>
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-700 shadow-sm">
              <ClipboardCheck className="h-4 w-4 text-indigo-500" />
              {plans.length} {isUniversityStudio ? 'studio projects' : 'coach assignments'}
            </div>
          </div>
          <p className={cn('mt-3 font-medium text-zinc-500', isPhone ? 'text-sm leading-6' : 'text-lg leading-8')}>
            {isUniversityStudio
              ? 'Build a university-grade assignment workflow with task sheets, drafting support, timetable planning, and rubric review before submission.'
              : 'Upload the task sheet, get a personalised routine, build a weekly timetable, and check your draft against the rubric before submission.'}
          </p>
        </div>
        <div className={cn('gap-3', isPhone ? 'grid grid-cols-1' : 'flex items-center')}>
          <button
            type="button"
            onClick={() => navigate(studentPortalStudyHubPath(activePortal))}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white font-black text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900',
              isPhone ? 'w-full px-4 py-3 text-sm' : 'px-5 py-3 text-sm',
            )}
          >
            <ArrowLeft size={18} />
            Back to Study Hub
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700',
              isPhone ? 'w-full px-4 py-3 text-sm' : 'px-5 py-3 text-sm',
            )}
          >
            <Plus size={18} />
            New Assignment
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
          {error}
        </div>
      ) : null}

      {showCreateForm ? (
        <div className="space-y-5">
          <div className={cn('gap-5', isPhone ? 'space-y-4' : 'grid grid-cols-[300px_minmax(0,1fr)] items-start')}>
            <div className={cn('rounded-[28px] p-5', GLASS_PANEL)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Coach assignments</p>
                  <h2 className="mt-1 text-2xl font-black text-zinc-950">{plans.length}</h2>
                </div>
                <ClipboardCheck className="h-8 w-8 text-indigo-500" />
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-zinc-500">
                Each plan links your task sheet, routine, timetable, and rubric feedback in one place.
              </p>
            </div>

            <div className={cn('rounded-[28px] p-4', GLASS_PANEL)}>
              <div className="space-y-3">
                {plans.length ? (
                  plans.slice(0, 3).map((plan) => {
                    const planProgress = countProgress(plan);
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setActivePlanId(plan.id);
                          setShowCreateForm(false);
                          navigate(studentPortalAssignmentCoachPath(activePortal, plan.id));
                        }}
                        className={cn('w-full rounded-[24px] p-4 text-left transition hover:border-white/60 hover:bg-white/56', GLASS_INSET)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-base font-black text-zinc-950">{plan.title}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">{plan.subject}</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-zinc-500">
                            {planProgress.completed}/{planProgress.total || 0}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="w-full rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center transition hover:border-indigo-200 hover:bg-indigo-50/40"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Step 1</p>
                    <p className="mt-2 text-lg font-black text-zinc-900">
                      {isUniversityStudio ? 'Create your first Assignment Studio project' : 'Create your first Assignment Coach plan'}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-zinc-500">
                      Fill in the <span className="font-black text-zinc-700">{isUniversityStudio ? 'Start Assignment Studio' : 'Start Assignment Coach'}</span> form below, upload the task sheet, then click <span className="font-black text-zinc-700">Create routine</span>.
                    </p>
                    <p className="mt-3 text-sm font-black text-indigo-600">Jump to form</p>
                  </button>
                )}
              </div>
            </div>
          </div>

          <main ref={createFormRef} className="space-y-5">
            <section className={cn('rounded-[32px] p-6 sm:p-7', GLASS_PANEL_STRONG)}>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Sparkles size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                    {isUniversityStudio ? 'New project' : 'New assignment'}
                  </p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
                    {isUniversityStudio ? 'Start Assignment Studio' : 'Start Assignment Coach'}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-zinc-500">
                    {isUniversityStudio
                      ? 'Upload the brief and rubric, define the project scope, then let the studio build a deeper routine and writing plan automatically.'
                      : 'Upload the assignment task and rubric, confirm the basics, then let the coach build the routine and weekly plan automatically.'}
                  </p>
                </div>
              </div>

              <div className={cn('mt-6 gap-4', isPhone ? 'space-y-4' : 'grid grid-cols-2')}>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Assignment title</span>
                  <input
                    value={createForm.title}
                    onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="e.g. Macbeth Analytical Essay"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Subject</span>
                  <input
                    value={createForm.subject}
                    onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="e.g. English"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Assignment type</span>
                  <select
                    value={createForm.assignmentType}
                    onChange={(event) => setCreateForm((current) => ({ ...current, assignmentType: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    {ASSIGNMENT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Due date</span>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(event) => setCreateForm((current) => ({ ...current, dueDate: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Year level</span>
                  <select
                    value={createForm.yearLevel}
                    onChange={(event) => setCreateForm((current) => ({ ...current, yearLevel: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    <option value="">Select year level</option>
                    {YEAR_LEVEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Preferred work blocks</span>
                  <div className="grid grid-cols-2 gap-2">
                    {DAY_OPTIONS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setCreateForm((current) => ({
                            ...current,
                            preferredDays: current.preferredDays.includes(day)
                              ? (current.preferredDays.length === 1
                                  ? current.preferredDays
                                  : current.preferredDays.filter((item) => item !== day))
                              : [...current.preferredDays, day],
                          }))
                        }
                        className={cn(
                          'rounded-2xl border px-3 py-2 text-sm font-bold transition',
                          createForm.preferredDays.includes(day)
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={cn('mt-5 gap-4', isPhone ? 'space-y-4' : 'grid grid-cols-[1fr_220px_160px]')}>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Preferred time</span>
                  <select
                    value={createForm.preferredTimeLabel}
                    onChange={(event) => setCreateForm((current) => ({ ...current, preferredTimeLabel: event.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    {TIME_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Sessions per week</span>
                  <select
                    value={String(createForm.sessionsPerWeek)}
                    onChange={(event) => setCreateForm((current) => ({ ...current, sessionsPerWeek: Number(event.target.value) }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  >
                    {buildSessionOptions(createForm.preferredDays).map((count) => (
                      <option key={count} value={count}>{count} sessions</option>
                    ))}
                  </select>
                </label>
              </div>

              <div ref={uploadSectionRef} className={cn('mt-6 gap-4', isPhone ? 'space-y-4' : 'grid grid-cols-2')}>
                <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="text-sm font-black text-zinc-950">Task sheet</p>
                      <p className="text-xs font-semibold text-zinc-500">Upload PDF, DOCX, image, or paste text.</p>
                    </div>
                  </div>
                  <textarea
                    value={createForm.taskSheetText}
                    onChange={(event) => setCreateForm((current) => ({ ...current, taskSheetText: event.target.value }))}
                    placeholder="Paste the task sheet instructions here if you want."
                    className="mt-4 min-h-[150px] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-zinc-300">
                    <Upload size={16} />
                    {taskSheetFile ? taskSheetFile.name : 'Upload task sheet'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,image/*,.txt,text/plain"
                      className="sr-only"
                      onChange={(event) => {
                        setTaskSheetFile(event.target.files?.[0] || null);
                        event.target.blur();
                        keepUploadSectionAnchored();
                      }}
                    />
                  </label>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="text-sm font-black text-zinc-950">Rubric / criteria</p>
                      <p className="text-xs font-semibold text-zinc-500">Optional now, but needed for criterion feedback.</p>
                    </div>
                  </div>
                  <textarea
                    value={createForm.rubricText}
                    onChange={(event) => setCreateForm((current) => ({ ...current, rubricText: event.target.value }))}
                    placeholder="Paste the rubric or criteria here if you have it."
                    className="mt-4 min-h-[150px] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-700 hover:border-zinc-300">
                    <Upload size={16} />
                    {rubricFile ? rubricFile.name : 'Upload rubric'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,image/*,.txt,text/plain"
                      className="sr-only"
                      onChange={(event) => {
                        setRubricFile(event.target.files?.[0] || null);
                        event.target.blur();
                        keepUploadSectionAnchored();
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className={cn('mt-6 rounded-[28px] border border-indigo-100 bg-indigo-50/50 p-4', isPhone ? 'space-y-3' : 'flex items-center justify-between gap-4')}>
                <div className="flex items-start gap-3">
                  <Wand2 className="mt-1 h-5 w-5 shrink-0 text-indigo-600" />
                  <p className="text-sm font-semibold leading-6 text-indigo-900">
                    Assignment Coach will analyse the task sheet, extract the real requirements, build the 5-step routine, and schedule study blocks on your selected days.
                  </p>
                </div>
                <div className={cn('shrink-0', isPhone ? 'space-y-3' : 'min-w-[320px] space-y-3')}>
                  {createFormError ? (
                    <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-700 shadow-sm">
                      {createFormError}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleCreatePlan}
                    disabled={isCreating}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60',
                      isPhone ? 'w-full px-4 py-3 text-sm' : 'w-full px-5 py-3 text-sm',
                    )}
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles size={16} />}
                    Create routine
                  </button>
                </div>
              </div>
            </section>
          </main>
        </div>
      ) : (
        <div className="space-y-5">
          <main className="space-y-5">
            {activePlan ? (
            <>
              <section className={cn('rounded-[28px] p-4', GLASS_PANEL)}>
                <div className={cn('gap-3', isPhone ? 'space-y-3' : 'grid 2xl:grid-cols-6 xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3')}>
                  {plans.map((plan) => {
                    const planProgress = countProgress(plan);
                    const selected = plan.id === activePlanId;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => {
                          setActivePlanId(plan.id);
                          setShowCreateForm(false);
                          navigate(studentPortalAssignmentCoachPath(activePortal, plan.id));
                        }}
                        className={cn(
                          'w-full rounded-[18px] border px-3 py-3 text-left transition',
                          selected
                            ? 'border-indigo-200 bg-indigo-50/70 shadow-sm'
                            : 'border-zinc-200 bg-zinc-50/80 hover:border-zinc-300 hover:bg-white',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-[0.95rem] font-black leading-5 text-zinc-950">
                              {plan.title}
                            </p>
                            <p className="mt-1 break-words text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                              {plan.subject}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              deletePlan(plan);
                            }}
                            className="shrink-0 rounded-full p-1.5 text-zinc-300 transition hover:bg-white hover:text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[12px] font-bold text-zinc-500">
                          <span className="min-w-0 break-words text-left">{plan.assignmentType}</span>
                          <span className="shrink-0">{planProgress.completed}/{planProgress.total || 0} tasks</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={cn('gap-5', isPhone ? 'space-y-4' : 'grid xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)] items-stretch')}>
                <div className={cn('min-w-0 overflow-hidden rounded-[28px] p-5', GLASS_PANEL_STRONG)}>
                  <div className="space-y-4 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <BookOpen size={24} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Assignment Coach</p>
                        <h2 className="mt-1 break-words text-[clamp(1.7rem,2.1vw,2.6rem)] font-black leading-[0.95] tracking-tight text-zinc-950">{activePlan.title}</h2>
                        <p className="mt-1 text-sm font-semibold text-zinc-500">
                          {activePlan.subject} · {activePlan.assignmentType} · Due {activePlan.dueDate}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm font-medium leading-6 text-zinc-600">
                      {activePlan.coachOverview || activePlan.extractedTask?.summary || 'Use the uploaded task sheet and rubric to drive the plan.'}
                    </p>

                    <div className={cn('gap-3', isPhone ? 'grid grid-cols-2' : 'grid grid-cols-4')}>
                      <div className={cn('rounded-[24px] p-3', GLASS_INSET)}>
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] leading-4 text-zinc-500">Next session</p>
                        <p className="mt-2 text-base font-black leading-6 text-zinc-950">
                          {nextWorkSession ? `${nextWorkSession.day} · ${nextWorkSession.timeLabel}` : 'Set timetable'}
                        </p>
                      </div>
                      <div className={cn('rounded-[24px] p-3', GLASS_INSET)}>
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] leading-4 text-zinc-500">Deliverables</p>
                        <p className="mt-2 text-xl font-black text-zinc-950">{activePlan.extractedTask?.deliverables?.length || 0}</p>
                      </div>
                      <div className={cn('rounded-[24px] p-3', GLASS_INSET)}>
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] leading-4 text-zinc-500">Progress</p>
                        <p className="mt-2 text-xl font-black text-zinc-950">{progress.completed}/{progress.total || 0}</p>
                      </div>
                      <div className={cn('rounded-[24px] p-3', GLASS_INSET)}>
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] leading-4 text-zinc-500">Word count</p>
                        <p className="mt-2 text-xl font-black text-zinc-950">{activePlan.extractedTask?.wordCount || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div id="rubric-marker" className={cn('rounded-[28px] p-5', GLASS_PANEL)}>
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-6 w-6 text-emerald-500" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Draft feedback</p>
                      <h3 className="mt-1 text-2xl font-black text-zinc-950">Rubric check</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm font-medium leading-6 text-zinc-500">
                    Manually upload the marking guide and assignment draft, or load a workbook from the app, to get feedback, an estimated mark range, and the sections to fix before submission.
                  </p>
                  <div className={cn('mt-4 rounded-[24px] p-4', GLASS_INSET)}>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Status</p>
                    <p className="mt-2 text-lg font-black text-zinc-950">
                      {activePlan.rubricFeedback ? activePlan.rubricFeedback.estimatedMarkRange : 'Ready to review'}
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">
                      {activePlan.rubricFeedback
                        ? activePlan.rubricFeedback.overallVerdict
                        : 'Upload or paste a draft to get criterion-by-criterion feedback.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(studentPortalAssignmentCoachRubricPath(activePortal, activePlan.id))}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-[24px] bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700"
                  >
                    <ClipboardCheck size={16} />
                    Marked now
                  </button>
                </div>
              </section>

              <section className={cn('rounded-[32px] p-6 min-w-0', GLASS_PANEL)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">What you need to do</p>
                    <h3 className="mt-2 text-2xl font-black text-zinc-950">Coach brief</h3>
                    <p className="mt-2 max-w-4xl text-base font-medium leading-8 text-zinc-500">
                      Assignment Coach extracts the brief, turns it into priorities, and shows what the student needs to understand before they start writing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={refreshRoutine}
                    disabled={isRefreshingRoutine}
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRefreshingRoutine ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 size={16} />}
                    Re-analyse brief
                  </button>
                </div>

                <div className={cn('mt-5 gap-4', isPhone ? 'space-y-4' : 'grid xl:grid-cols-2')}>
                  {[
                    ['Key instructions', coachInsights?.keyInstructions || []],
                    ['Research areas', coachInsights?.researchAreas || []],
                    ['Topics to cover', coachInsights?.topicsNeeded || []],
                    ['Formatting', coachInsights?.formattingRequirements || []],
                    ['Submission', coachInsights?.submissionRequirements || []],
                    ['Success checklist', coachInsights?.successChecklist || []],
                  ].map(([label, values]) => (
                    <div key={label} className={cn('rounded-[24px] p-5', GLASS_INSET)}>
                      <p className="text-base font-black text-zinc-900">{label}</p>
                      <ul className="mt-3 space-y-3 text-[0.98rem] font-medium leading-7 text-zinc-700">
                        {(values as string[]).slice(0, 5).map((value) => (
                          <li key={value} className="flex gap-3">
                            <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                            <span>{value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <section className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Coach outline</p>
                    <h3 className="mt-2 text-2xl font-black text-zinc-950">Overview to work from</h3>
                    <p className="mt-3 max-w-6xl text-base font-medium leading-8 text-zinc-600">
                      {coachInsights?.outlineOverview}
                    </p>
                  </div>
                </div>
              </section>

              <section className={cn('rounded-[32px] p-6 min-w-0', GLASS_PANEL_STRONG)}>
                <div className={cn('gap-4', isPhone ? 'space-y-3' : 'flex items-start justify-between')}>
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-6 w-6 text-indigo-500" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Calendar timetable</p>
                      <h3 className="mt-1 text-2xl font-black text-zinc-950">Assignment schedule</h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                        Full calendar view from {calendarTimetable?.startLabel || 'today'} to {calendarTimetable?.dueLabel || activePlan.dueDate}. Tap a scheduled block to mark it complete.
                      </p>
                    </div>
                  </div>
                  <div className={cn('space-y-2', isPhone ? '' : 'text-right')}>
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700">
                      {calendarTimetable?.scheduledItems?.length || 0} scheduled study blocks
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCalendarTimetable((current) => !current)}
                      className={cn(
                        'inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300',
                        isPhone && 'w-full',
                      )}
                    >
                      {showCalendarTimetable ? 'Collapse calendar' : 'Expand calendar'}
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className={cn('gap-2', isPhone ? 'grid grid-cols-2' : 'grid xl:grid-cols-7 md:grid-cols-4 grid-cols-3')}>
                    {DAY_OPTIONS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => togglePreferredDay(day)}
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-sm font-bold transition',
                          preferredDays.includes(day)
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>

                  <div className={cn('gap-3', isPhone ? 'grid grid-cols-2' : 'grid max-w-xl md:grid-cols-2')}>
                    <select
                      value={preferredTimeLabel}
                      onChange={(event) => setPreferredTimeLabel(event.target.value)}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    >
                      {TIME_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <select
                      value={String(sessionsPerWeek)}
                      onChange={(event) => setSessionsPerWeek(Number(event.target.value))}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    >
                      {buildSessionOptions(preferredDays).map((count) => (
                        <option key={count} value={count}>{count} sessions</option>
                      ))}
                    </select>
                  </div>
                </div>

                {showCalendarTimetable ? (
                  <div className="mt-5 space-y-4">
                    {(calendarTimetable?.monthSections || []).map((section) => {
                      const sectionDays = section.weeks.flatMap((week) => week);
                      const activeColumnSet = new Set(
                        sectionDays
                          .filter((day) => day.inRange && day.items.some((item) => item.isFocusDay))
                          .map((day) => day.date.getDay()),
                      );
                      const emphasizedColumnSet = new Set(
                        sectionDays
                          .filter((day) => day.inRange && (day.items.some((item) => item.isFocusDay) || day.isDue))
                          .map((day) => day.date.getDay()),
                      );
                      const sectionTemplateColumns = CALENDAR_DAY_LABELS.map((_, index) =>
                        emphasizedColumnSet.has((index + 1) % 7)
                          ? 'minmax(220px, 1.7fr)'
                          : 'minmax(78px, 0.48fr)',
                      ).join(' ');

                      return (
                        <div key={section.key} className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-lg font-black text-zinc-950">{section.label}</h4>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                              {sectionDays.filter((day) => day.inRange && day.items.length > 0).length} active days
                            </p>
                          </div>

                          <div className="overflow-x-auto pb-2">
                            <div className="min-w-[900px] space-y-2">
                              <div
                                className="grid gap-2"
                                style={{ gridTemplateColumns: sectionTemplateColumns }}
                              >
                                {CALENDAR_DAY_LABELS.map((label, index) => {
                                  const weekdayNumber = (index + 1) % 7;
                                  const isActiveColumn = activeColumnSet.has(weekdayNumber);
                                  return (
                                    <div
                                      key={label}
                                      className={cn(
                                        'rounded-2xl border px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.18em] transition',
                                        isActiveColumn
                                          ? 'border-indigo-200 bg-indigo-100 text-indigo-700'
                                          : 'border-zinc-200 bg-zinc-50 text-zinc-400',
                                      )}
                                    >
                                      {label}
                                    </div>
                                  );
                                })}
                              </div>

                              {section.weeks.map((week, weekIndex) => (
                                <div
                                  key={`${section.key}-week-${weekIndex}`}
                                  className="grid gap-2"
                                  style={{ gridTemplateColumns: sectionTemplateColumns }}
                                >
                                  {week.map((day) => {
                                    const isFocusColumn = day.items.some((item) => item.isFocusDay);
                                    if (day.isAfterDue) {
                                      return <div key={day.dateKey} className="min-h-[170px]" />;
                                    }

                                    return (
                                      <div
                                        key={day.dateKey}
                                        className={cn(
                                          'min-h-[170px] rounded-[24px] border p-3 transition',
                                          day.inRange ? 'border-zinc-200 bg-zinc-50/70' : 'border-zinc-100 bg-zinc-50/30 opacity-55',
                                          day.isToday && 'border-indigo-300',
                                          day.isDue && 'ring-2 ring-emerald-200',
                                          isFocusColumn && 'border-indigo-200 bg-indigo-50/40',
                                        )}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div>
                                            <p className={cn('text-sm font-black', day.inRange ? 'text-zinc-900' : 'text-zinc-400')}>
                                              {day.date.getDate()}
                                            </p>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400">
                                              {formatMonthDay(day.date)}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {day.isDue ? (
                                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600">
                                                Due
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>

                                        <div className="mt-3 space-y-2">
                                          {day.items.length ? (
                                            day.items.map((item) => (
                                              (() => {
                                                const theme = STEP_THEME[item.focusStep] || STEP_THEME[1];
                                                if (day.isDue && item.focusStep === 5) {
                                                  return (
                                                    <button
                                                      key={item.id}
                                                      type="button"
                                                      onClick={() => toggleScheduleItem(item.id)}
                                                      className={cn(
                                                        'w-full rounded-[24px] border px-5 py-5 text-left transition',
                                                        item.completed
                                                          ? 'border-emerald-200 bg-emerald-50/80'
                                                          : 'border-emerald-200 bg-white shadow-sm hover:border-emerald-300',
                                                      )}
                                                    >
                                                      <div className="flex items-start justify-between gap-4">
                                                        <div className="flex items-center gap-2 text-emerald-600">
                                                          {item.completed ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
                                                          <span className="text-[11px] font-black uppercase tracking-[0.18em]">
                                                            {item.timeLabel}
                                                          </span>
                                                        </div>
                                                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                                                          Submit
                                                        </span>
                                                      </div>
                                                      <p className="mt-4 text-xl font-black leading-tight text-zinc-950">
                                                        Final review and submit
                                                      </p>
                                                      <p className="mt-3 max-w-[22rem] text-sm font-medium leading-6 text-zinc-600">
                                                        Run the final rubric check, fix last issues, and submit the assignment today.
                                                      </p>
                                                    </button>
                                                  );
                                                }

                                                return (
                                                  <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => toggleScheduleItem(item.id)}
                                                    className={cn(
                                                      'w-full rounded-[18px] border p-3 text-left transition bg-white/92',
                                                      item.completed
                                                        ? 'border-emerald-200 bg-emerald-50/80'
                                                        : cn(theme.softBg, theme.ring),
                                                    )}
                                                  >
                                                    <div className="flex items-start gap-2">
                                                      <div className={cn('mt-0.5', item.completed ? 'text-emerald-600' : theme.accent)}>
                                                        {item.completed ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                                                      </div>
                                                      <div className="min-w-0">
                                                        <p className={cn('text-[10px] font-black uppercase tracking-[0.16em]', item.completed ? 'text-emerald-700' : theme.pill)}>
                                                          {item.timeLabel}
                                                        </p>
                                                        <p className="mt-1 text-sm font-black leading-5 text-zinc-950">
                                                          {item.focus}
                                                        </p>
                                                        <p className="mt-1 text-xs font-medium leading-5 text-zinc-700">
                                                          {item.objective}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </button>
                                                );
                                              })()
                                            ))
                                          ) : (
                                            <div
                                              className={cn(
                                                'rounded-[18px] border border-dashed border-zinc-200 bg-white/70 px-3 py-4 text-center text-xs font-semibold text-zinc-400',
                                                day.isStart && 'flex min-h-[92px] items-center justify-center',
                                              )}
                                            >
                                              {day.isStart ? (
                                                <span className="rounded-full bg-indigo-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600">
                                                  Start
                                                </span>
                                              ) : (
                                                'No session'
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-6 text-center text-sm font-semibold text-zinc-500">
                    {calendarTimetable?.scheduledItems?.length || 0} scheduled study blocks from {calendarTimetable?.startLabel || 'today'} to {calendarTimetable?.dueLabel || activePlan.dueDate}.
                  </div>
                )}
              </section>

              <section className={cn('gap-5', isPhone ? 'space-y-5' : 'space-y-5')}>
                <div className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Action plan</p>
                      <h3 className="mt-2 text-2xl font-black text-zinc-950">Your 5-step routine</h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                        This is the guided plan. Assignment Portal is the execution workspace where the student writes, saves, and works through the steps in detail.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {activePlan.steps.map((step) => {
                      const theme = STEP_THEME[step.id] || STEP_THEME[1];
                      return (
                      <div key={step.id} className={cn('rounded-[26px] border p-4 min-w-0', theme.softBg)}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className={cn('text-xs font-black uppercase tracking-[0.18em]', theme.accent)}>Step {step.id}</p>
                            <h4 className="mt-1 text-xl font-black text-zinc-950">{step.title}</h4>
                          </div>
                          <div className={cn('rounded-full px-3 py-1 text-xs font-black', GLASS_INSET, theme.pill)}>
                            {step.tasks.filter((task) => task.completed).length}/{step.tasks.length}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {step.tasks.map((task) => (
                            <div key={task.id} className={cn('rounded-2xl border bg-white/72 p-3', GLASS_INSET)}>
                              <div className="flex items-start gap-3">
                                <button type="button" onClick={() => toggleTask(step.id, task.id)} className={cn('mt-1', theme.accent)}>
                                  {task.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                </button>
                                <div className="min-w-0 flex-1 space-y-2">
                                  <input
                                    value={task.text}
                                    onChange={(event) => updateTaskText(step.id, task.id, event.target.value)}
                                    className={cn(
                                      'w-full border-none bg-transparent p-0 text-sm font-bold text-zinc-900 outline-none',
                                      task.completed && 'text-zinc-400 line-through',
                                    )}
                                  />
                                  <div className={cn('flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em]', theme.pill)}>
                                    {task.priority ? <span>{task.priority}</span> : null}
                                    {task.estimatedTime ? <span>{task.estimatedTime}</span> : null}
                                  </div>
                                </div>
                                <button type="button" onClick={() => deleteTask(step.id, task.id)} className="rounded-full p-2 text-zinc-300 transition hover:bg-zinc-50 hover:text-rose-500">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={cn('mt-4 gap-3', isPhone ? 'space-y-3' : 'flex items-center')}>
                          <input
                            value={taskDrafts[step.id] || ''}
                            onChange={(event) => setTaskDrafts((current) => ({ ...current, [step.id]: event.target.value }))}
                            placeholder={`Add a task for ${step.title.toLowerCase()}`}
                            className={cn('min-w-0 flex-1 rounded-2xl border bg-white/72 px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:ring-4', GLASS_INSET)}
                          />
                          <button
                            type="button"
                            onClick={() => addTask(step.id)}
                            className={cn(
                              'inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/72 px-4 py-3 text-sm font-black text-zinc-700 transition',
                              GLASS_INSET,
                              isPhone && 'w-full',
                            )}
                          >
                            <Plus size={16} />
                            Add task
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              </section>

              <section className={cn('gap-5', isPhone ? 'space-y-5' : 'grid lg:grid-cols-2 items-stretch')}>
                <div className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex h-full flex-col">
                    <div className={cn('gap-4', isPhone ? 'space-y-3' : 'flex items-start justify-between')}>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Assignment inputs</p>
                      <h3 className="mt-2 text-2xl font-black text-zinc-950">Source materials</h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                        Keep the original task sheet and rubric tucked away here for reference only. Assignment Coach uses them to drive the brief, routine, and rubric feedback.
                      </p>
                    </div>
                    <div className={cn('flex items-center gap-3', isPhone ? 'flex-col items-stretch' : '')}>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Auto-saved to your account</p>
                      <button
                        type="button"
                        onClick={() => setShowSourceDocuments((current) => !current)}
                        className={cn('inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300', isPhone && 'w-full')}
                      >
                        {showSourceDocuments ? 'Hide source text' : 'Check source text'}
                      </button>
                    </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {activePlan.taskSheetFileName ? (
                        <span className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">Task sheet: {activePlan.taskSheetFileName}</span>
                      ) : null}
                      {activePlan.rubricFileName ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">Rubric: {activePlan.rubricFileName}</span>
                      ) : null}
                    </div>

                    {showSourceDocuments ? (
                      <div className="mt-5 space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Task sheet text</span>
                          <textarea
                            value={taskSheetTextInput}
                            onChange={(event) => setTaskSheetTextInput(event.target.value)}
                            className="min-h-[170px] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Rubric / criteria text</span>
                          <textarea
                            value={rubricTextInput}
                            onChange={(event) => setRubricTextInput(event.target.value)}
                            className="min-h-[170px] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-8 text-center text-sm font-semibold text-zinc-500">
                        Source text is collapsed until the student needs to double-check the original brief or rubric.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[32px] border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex h-full flex-col">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Continue working</p>
                      <h3 className="mt-2 text-2xl font-black text-zinc-950">Open the assignment workspace</h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                        Move into Assignment Portal when the student is ready to write, save notes, and work through the routine step by step.
                      </p>
                    </div>
                    <div className="mt-6 flex-1 rounded-[24px] border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-8 text-center text-sm font-semibold text-zinc-500">
                      Open the full workspace to write, save notes, and complete the assignment step by step.
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(studentPortalAssignmentPortalPath(activePortal, activePlan.id))}
                      className={cn('mt-5 inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-4 text-base font-black text-white transition hover:bg-zinc-800', 'w-full')}
                    >
                      Open in Assignment Portal
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-[32px] border border-zinc-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <FileText size={30} />
              </div>
              <h2 className="mt-5 text-3xl font-black text-zinc-950">No assignment selected</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-zinc-500">
                Start a new Assignment Coach plan to upload the task sheet and build your personalised routine.
              </p>
            </section>
          )}
          </main>
        </div>
      )}
    </div>
  );
}
