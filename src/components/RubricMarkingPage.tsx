import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  FileText,
  Loader2,
  NotebookPen,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@/lib/portal-firestore';
import { auth, db } from '../firebase';
import { Assignment, AssignmentPlan } from '../types';
import { geminiGenerateContent } from '../services/geminiProxy';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { getOrCreateCachedAiResult } from '../lib/ai-result-cache';
import { detectStudentPortalFromPath, studentPortalAssignmentCoachPath } from '@/lib/portal';

const GLASS_PANEL = 'border border-white/45 bg-white/58 backdrop-blur-2xl shadow-[0_22px_60px_rgba(15,23,42,0.12)]';
const GLASS_INSET = 'border border-white/50 bg-white/42 backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]';

type WorkbookPageDoc = {
  content: string;
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
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  );
}

function htmlToPlainText(html: string) {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

async function runDocumentExtraction(label: string, pastedText: string, file: File | null) {
  const trimmedText = pastedText.trim();
  if (!file) return trimmedText;

  if (isDocxFile(file)) {
    const fileDataUrl = await readFileAsDataUrl(file);
    return getOrCreateCachedAiResult(
      {
        scope: 'rubric-marking-document-text',
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
      scope: 'rubric-marking-document-extraction',
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
                text: `Extract the useful readable text from this ${label} for a rubric marking workflow.

Rules:
- Return plain text only.
- Preserve headings, criteria labels, descriptors, due dates, requirements, and instructions when present.
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
}

export default function RubricMarkingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { planId } = useParams();
  const { isPhone } = useResponsiveDevice();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingWorkbook, setIsLoadingWorkbook] = useState(false);
  const [isExtractingMarkingGuide, setIsExtractingMarkingGuide] = useState(false);
  const [isExtractingDraft, setIsExtractingDraft] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<AssignmentPlan | null>(null);
  const [markingGuideText, setMarkingGuideText] = useState('');
  const [draftText, setDraftText] = useState('');
  const [markingGuideFile, setMarkingGuideFile] = useState<File | null>(null);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [markingGuideSourceName, setMarkingGuideSourceName] = useState('');
  const [draftSourceName, setDraftSourceName] = useState('');
  const [sessionFeedback, setSessionFeedback] = useState<AssignmentPlan['rubricFeedback'] | null>(null);

  useEffect(() => {
  const loadPlan = async () => {
      if (!planId) {
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'assignmentPlans', planId));
        if (!snap.exists()) {
          setError('Assignment plan not found.');
          setLoading(false);
          return;
        }

        const data = { id: snap.id, ...snap.data() } as AssignmentPlan;
        setPlan(data);
        setMarkingGuideText('');
        setDraftText('');
        setMarkingGuideFile(null);
        setDraftFile(null);
        setMarkingGuideSourceName('');
        setDraftSourceName('');
        setSessionFeedback(null);
      } catch (loadError) {
        console.error('Failed to load rubric marking page:', loadError);
        setError('Could not load the rubric marking page.');
      } finally {
        setLoading(false);
      }
    };

    void loadPlan();
  }, [planId]);

  const feedback = sessionFeedback || null;

  const sectionsToChange = useMemo(() => {
    if (!feedback) return [];
    const criterionFixes = feedback.criteria.flatMap((criterion) =>
      criterion.fixes.slice(0, 2).map((fix) => ({
        criterion: criterion.criterion,
        estimatedBand: criterion.estimatedBand,
        fix,
      })),
    );
    return criterionFixes.slice(0, 8);
  }, [feedback]);

  const loadWorkbookDraft = async () => {
    const user = auth.currentUser;
    if (!user || !planId) return;

    setIsLoadingWorkbook(true);
    setError('');
    try {
      const workbookQuery = query(
        collection(db, 'assignments'),
        where('userId', '==', user.uid),
        where('assignmentPlanId', '==', planId),
      );
      const workbookSnap = await getDocs(workbookQuery);

      if (workbookSnap.empty) {
        setError('No workbook linked to this assignment yet.');
        return;
      }

      const workbook = { id: workbookSnap.docs[0].id, ...workbookSnap.docs[0].data() } as Assignment;
      const pagesRef = collection(db, 'assignments', workbook.id, 'pages');
      const pagesSnap = await getDocs(query(pagesRef, orderBy('index', 'asc')));
      const pageDocs = pagesSnap.docs.map((pageDoc) => pageDoc.data() as WorkbookPageDoc);
      const joinedHtml = pageDocs.length
        ? pageDocs.map((page) => page.content || '').join('\n\n')
        : workbook.content || '';
      const plainText = htmlToPlainText(joinedHtml);

      if (!plainText.trim()) {
      setError('The workbook is empty, so there is nothing to load into marking yet.');
        return;
      }

      setDraftText(plainText);
      setDraftSourceName('Workbook from app');
      setDraftFile(null);
      setSessionFeedback(null);
    } catch (loadError) {
      console.error('Failed to load workbook draft:', loadError);
      setError('Could not load the workbook draft right now.');
    } finally {
      setIsLoadingWorkbook(false);
    }
  };

  const extractUploadedDocument = async (
    label: string,
    file: File,
    currentText: string,
    setText: (value: string) => void,
    setSourceName: (value: string) => void,
    setLoadingState: (value: boolean) => void,
    setFile: (file: File | null) => void,
  ) => {
    setLoadingState(true);
    setError('');
    setSessionFeedback(null);
    setSourceName(file.name);
    setFile(file);
    try {
      const extractedText = await runDocumentExtraction(label, currentText, file);
      if (!extractedText.trim()) {
        throw new Error('The uploaded file did not contain readable text.');
      }
      setText(extractedText);
      setFile(null);
    } catch (uploadError) {
      console.error(`Failed to extract ${label}:`, uploadError);
      setSourceName('');
      setFile(null);
      setError(uploadError instanceof Error ? uploadError.message : 'Could not read the uploaded file.');
    } finally {
      setLoadingState(false);
    }
  };

  const runMarking = async () => {
    if (!plan) return;

    const guideInput = markingGuideText.trim();
    const draftInput = draftText.trim();

    if (!guideInput && !markingGuideFile) {
      setError('Upload or paste the marking guide before running the review.');
      return;
    }

    if (!draftInput && !draftFile) {
      setError('Upload, paste, or load the assignment draft before running the review.');
      return;
    }

    setIsRunning(true);
    setError('');

    try {
      const [markingGuideSource, draftSource] = await Promise.all([
        runDocumentExtraction('marking guide or rubric', markingGuideText, markingGuideFile),
        runDocumentExtraction('student assignment draft', draftText, draftFile),
      ]);

      const rubricFeedback = await getOrCreateCachedAiResult(
        {
          scope: 'rubric-marking-feedback',
          input: {
            markingGuideSource,
            draftSource,
          },
        },
        async () => {
          const response = await geminiGenerateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `You are reviewing a student's assignment draft against the teacher's marking guide.

Source-of-truth rules:
- Use the uploaded or pasted marking guide and uploaded or pasted draft as the only authoritative sources.
- Ignore any older saved assignment-plan details if they conflict with the uploaded documents.
- If the draft is off-topic compared with the marking guide, explain that based only on the uploaded documents.

Marking guide:
${markingGuideSource}

Student draft:
${draftSource}

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
- Base comments on the marking guide wherever possible.
- Give an estimated mark or band only from the evidence currently shown in the draft.
- Be specific about what needs to change.
- Do not rewrite the student's assignment for them.
- Focus on missing evidence, weak analysis, unclear structure, off-task content, and rubric gaps.
- "nextActions" must be practical revision steps the student can do next.`,
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

      await updateDoc(doc(db, 'assignmentPlans', plan.id), {
        rubricFeedback,
        updatedAt: serverTimestamp(),
      });

      setPlan((current) =>
        current
          ? {
              ...current,
              rubricFeedback,
            }
          : current,
      );
      setSessionFeedback(rubricFeedback);
      setMarkingGuideText(markingGuideSource);
      setDraftText(draftSource);
      setMarkingGuideFile(null);
      setDraftFile(null);
    } catch (markError) {
      console.error('Rubric marking failed:', markError);
      setError('Could not generate rubric marking feedback right now.');
    } finally {
      setIsRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <div className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
          <p className="text-sm font-bold text-rose-600">{error || 'Assignment plan not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto max-w-7xl', isPhone ? 'space-y-4 p-4' : 'space-y-6 p-8')}>
      <section className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
        <div className={cn('gap-4', isPhone ? 'space-y-4' : 'flex items-start justify-between')}>
          <div>
            <button
              type="button"
              onClick={() => navigate(studentPortalAssignmentCoachPath(activePortal, plan.id))}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/75 px-3 py-2 text-sm font-black text-zinc-700 transition hover:bg-white"
            >
              <ArrowLeft size={16} />
              Back to coach
            </button>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Manual rubric marking</p>
            <h1 className={cn('mt-2 font-black tracking-tight text-zinc-950', isPhone ? 'text-3xl' : 'text-5xl')}>
              Marked now
            </h1>
            <p className={cn('mt-3 max-w-4xl font-medium text-zinc-600', isPhone ? 'text-sm leading-6' : 'text-lg leading-8')}>
              Upload or paste the marking guide and the current assignment draft, or manually load a workbook from the app. Then run the review to get feedback, an estimated mark range, and the sections that still need work.
            </p>
          </div>
          <div className={cn('rounded-[24px] p-4', GLASS_INSET)}>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Assignment</p>
            <p className="mt-2 text-lg font-black text-zinc-950">{plan.title}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-500">
              {plan.subject} • {plan.assignmentType} • Due {plan.dueDate}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <section className={cn('rounded-[28px] p-4', GLASS_PANEL)}>
          <div className="flex items-start gap-3 text-rose-600">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        </section>
      ) : null}

      <section className={cn('gap-5', isPhone ? 'space-y-4' : 'grid xl:grid-cols-2')}>
        <div className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Marking guide</p>
              <h2 className="mt-1 text-2xl font-black text-zinc-950">Upload the criteria</h2>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium leading-6 text-zinc-600">
            Add the rubric, marking guide, or criteria sheet here. This review only runs when the student chooses to upload or paste it.
          </p>
          {markingGuideSourceName ? (
            <p className="mt-4 text-sm font-bold text-emerald-700">
              Uploaded document: {markingGuideSourceName}
            </p>
          ) : null}
          <textarea
            value={markingGuideText}
            onChange={(event) => {
              setMarkingGuideText(event.target.value);
              setMarkingGuideSourceName('');
              setMarkingGuideFile(null);
              setSessionFeedback(null);
            }}
            placeholder="Paste the marking guide or criteria here."
            className="mt-4 min-h-[220px] w-full rounded-[24px] border border-zinc-200 bg-white/80 px-4 py-4 text-sm font-medium text-zinc-700 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 bg-white/75 px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-white">
            {isExtractingMarkingGuide ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload size={16} />}
            {isExtractingMarkingGuide ? 'Extracting marking guide...' : 'Upload marking guide'}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.rtf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                void extractUploadedDocument(
                  'marking guide or rubric',
                  file,
                  '',
                  setMarkingGuideText,
                  setMarkingGuideSourceName,
                  setIsExtractingMarkingGuide,
                  setMarkingGuideFile,
                );
              }}
            />
          </label>
        </div>

        <div className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
          <div className="flex items-center gap-3">
            <NotebookPen className="h-6 w-6 text-indigo-600" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Assignment draft</p>
              <h2 className="mt-1 text-2xl font-black text-zinc-950">Add the work to review</h2>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium leading-6 text-zinc-600">
            Upload the current assignment, paste the draft, or manually pull in a workbook from inside the app.
          </p>
          {draftSourceName ? (
            <p className="mt-4 text-sm font-bold text-indigo-700">
              Uploaded document: {draftSourceName}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 bg-white/75 px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-white">
              {isExtractingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload size={16} />}
              {isExtractingDraft ? 'Extracting assignment...' : 'Upload assignment'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.rtf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  if (!file) return;
                  void extractUploadedDocument(
                    'student assignment draft',
                  file,
                  '',
                  setDraftText,
                  setDraftSourceName,
                  setIsExtractingDraft,
                    setDraftFile,
                  );
                }}
              />
            </label>
            <button
              type="button"
              onClick={loadWorkbookDraft}
              disabled={isLoadingWorkbook}
              className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingWorkbook ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen size={16} />}
              Load workbook from app
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftText(plan.draftContent || '');
                setDraftSourceName('Coach draft');
                setDraftFile(null);
                setSessionFeedback(null);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/75 px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-white"
            >
              <FileText size={16} />
              Use coach draft
            </button>
          </div>
          <textarea
            value={draftText}
            onChange={(event) => {
              setDraftText(event.target.value);
              setDraftSourceName('');
              setDraftFile(null);
              setSessionFeedback(null);
            }}
            placeholder="Paste the assignment draft here."
            className="mt-4 min-h-[220px] w-full rounded-[24px] border border-zinc-200 bg-white/80 px-4 py-4 text-sm font-medium text-zinc-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={runMarking}
            disabled={isRunning}
            className={cn(
              'mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60',
              isPhone && 'w-full',
            )}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 size={16} />}
            Marked now
          </button>
        </div>
      </section>

      <section className={cn('gap-5', isPhone ? 'space-y-4' : 'grid lg:grid-cols-[1.15fr_0.85fr]')}>
        <div className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Feedback summary</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-950">
            {feedback ? feedback.estimatedMarkRange : 'No mark estimate yet'}
          </h2>
          <p className="mt-3 text-base font-medium leading-8 text-zinc-600">
            {feedback ? feedback.overallVerdict : 'Run the manual rubric review to see the mark range and revision advice.'}
          </p>

          {feedback ? (
            <div className={cn('mt-5 gap-4', isPhone ? 'space-y-4' : 'grid md:grid-cols-2')}>
              <div className={cn('rounded-[24px] p-5', GLASS_INSET)}>
                <p className="text-base font-black text-zinc-950">Strengths</p>
                <ul className="mt-3 space-y-3 text-sm font-medium leading-6 text-zinc-700">
                  {feedback.strengths.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cn('rounded-[24px] p-5', GLASS_INSET)}>
                <p className="text-base font-black text-zinc-950">Missing requirements</p>
                <ul className="mt-3 space-y-3 text-sm font-medium leading-6 text-zinc-700">
                  {feedback.missingRequirements.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        <div className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Next changes</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-950">Sections to change</h2>
          {feedback ? (
            <div className="mt-4 space-y-3">
              {sectionsToChange.map((item, index) => (
                <div key={`${item.criterion}-${index}`} className={cn('rounded-[22px] p-4', GLASS_INSET)}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-zinc-950">{item.criterion}</p>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-indigo-700">
                      {item.estimatedBand || 'Review'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-zinc-700">{item.fix}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm font-medium leading-6 text-zinc-600">
              After you run the review, this panel will show the exact rubric sections and fixes to work on next.
            </p>
          )}
        </div>
      </section>

      {feedback ? (
        <>
          <section className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Revision actions</p>
            <h2 className="mt-2 text-2xl font-black text-zinc-950">What to change next</h2>
            <div className={cn('mt-5 gap-4', isPhone ? 'space-y-4' : 'grid md:grid-cols-2')}>
              <div className={cn('rounded-[24px] p-5', GLASS_INSET)}>
                <p className="text-base font-black text-zinc-950">Suggested improvements</p>
                <ul className="mt-3 space-y-3 text-sm font-medium leading-6 text-zinc-700">
                  {feedback.suggestedImprovements.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cn('rounded-[24px] p-5', GLASS_INSET)}>
                <p className="text-base font-black text-zinc-950">Next actions</p>
                <ul className="mt-3 space-y-3 text-sm font-medium leading-6 text-zinc-700">
                  {feedback.nextActions.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className={cn('rounded-[32px] p-6', GLASS_PANEL)}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Criterion breakdown</p>
            <h2 className="mt-2 text-2xl font-black text-zinc-950">Rubric-by-rubric feedback</h2>
            <div className="mt-5 space-y-4">
              {feedback.criteria.map((criterion) => (
                <article key={criterion.criterion} className={cn('rounded-[24px] p-5', GLASS_INSET)}>
                  <div className={cn('gap-3', isPhone ? 'space-y-3' : 'flex items-start justify-between')}>
                    <div>
                      <h3 className="text-lg font-black text-zinc-950">{criterion.criterion}</h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-zinc-700">{criterion.feedback}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                      {criterion.estimatedBand || 'Estimated band'}
                    </span>
                  </div>
                  <div className={cn('mt-4 gap-4', isPhone ? 'space-y-4' : 'grid md:grid-cols-2')}>
                    <div>
                      <p className="text-sm font-black text-zinc-950">What is working</p>
                      <ul className="mt-2 space-y-2 text-sm font-medium leading-6 text-zinc-700">
                        {criterion.strengths.map((item) => (
                          <li key={item} className="flex gap-3">
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-950">What to fix</p>
                      <ul className="mt-2 space-y-2 text-sm font-medium leading-6 text-zinc-700">
                        {criterion.fixes.map((item) => (
                          <li key={item} className="flex gap-3">
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
