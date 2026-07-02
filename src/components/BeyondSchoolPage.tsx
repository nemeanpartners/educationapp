import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  GraduationCap,
  Loader2,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  BeyondUniversityCareerDirection,
  BeyondUniversityCareerDirectionReport,
  UserProfile,
} from '../types';
import { detectStudentPortalFromPath } from '../lib/portal';
import { cn } from '../lib/utils';
import { getOrCreateCachedAiResult, setCachedAiResult } from '../lib/ai-result-cache';
import { geminiGenerateContent } from '../services/geminiProxy';
import { doc, setDoc } from '@/lib/portal-firestore';
import { db } from '../firebase';

type OpportunityDoor = {
  title: string;
  whyItFits: string;
  roles: string[];
  employers: string[];
  nextMoves: string[];
};

type DegreePlanStep = {
  window: string;
  focus: string;
  actions: string[];
};

type DegreeOpportunityReport = BeyondUniversityCareerDirectionReport;

const reportSchema = {
  type: 'object',
  properties: {
    overview: { type: 'string' },
    tailoredFor: { type: 'string' },
    degreeLens: { type: 'string' },
    confidenceNote: { type: 'string' },
    opportunityDoors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          whyItFits: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' } },
          employers: { type: 'array', items: { type: 'string' } },
          nextMoves: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'whyItFits', 'roles', 'employers', 'nextMoves'],
      },
    },
    highValueExperiences: { type: 'array', items: { type: 'string' } },
    strengthsToBuild: { type: 'array', items: { type: 'string' } },
    searchTerms: { type: 'array', items: { type: 'string' } },
    immediatePlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          window: { type: 'string' },
          focus: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
        },
        required: ['window', 'focus', 'actions'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'overview',
    'tailoredFor',
    'degreeLens',
    'confidenceNote',
    'opportunityDoors',
    'highValueExperiences',
    'strengthsToBuild',
    'searchTerms',
    'immediatePlan',
    'warnings',
  ],
} as const;

const schoolSnapshots = [
  {
    title: 'Choose a direction',
    body: 'Compare career lanes, pathway options, and what different subjects can lead into after school.',
  },
  {
    title: 'Map the pathway',
    body: 'Save courses, prerequisites, portfolio needs, or apprenticeships so the next step feels concrete.',
  },
  {
    title: 'Test the fit',
    body: 'Use projects, volunteering, tutoring, competitions, or work experience to see what actually suits you.',
  },
];

const sampleFocusPrompts = [
  'What graduate jobs fit this degree best?',
  'What industries should I target first?',
  'What internships or placements would make me employable?',
  'What doors can this degree open outside the obvious path?',
];

function normalizeReport(raw: DegreeOpportunityReport): DegreeOpportunityReport {
  return {
    overview: String(raw?.overview || '').trim(),
    tailoredFor: String(raw?.tailoredFor || '').trim(),
    degreeLens: String(raw?.degreeLens || '').trim(),
    confidenceNote: String(raw?.confidenceNote || '').trim(),
    opportunityDoors: Array.isArray(raw?.opportunityDoors)
      ? raw.opportunityDoors
          .map((door) => ({
            title: String(door?.title || '').trim(),
            whyItFits: String(door?.whyItFits || '').trim(),
            roles: Array.isArray(door?.roles) ? door.roles.map((item) => String(item).trim()).filter(Boolean).slice(0, 5) : [],
            employers: Array.isArray(door?.employers) ? door.employers.map((item) => String(item).trim()).filter(Boolean).slice(0, 5) : [],
            nextMoves: Array.isArray(door?.nextMoves) ? door.nextMoves.map((item) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
          }))
          .filter((door) => door.title && door.whyItFits)
          .slice(0, 6)
      : [],
    highValueExperiences: Array.isArray(raw?.highValueExperiences)
      ? raw.highValueExperiences.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : [],
    strengthsToBuild: Array.isArray(raw?.strengthsToBuild)
      ? raw.strengthsToBuild.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : [],
    searchTerms: Array.isArray(raw?.searchTerms)
      ? raw.searchTerms.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
      : [],
    immediatePlan: Array.isArray(raw?.immediatePlan)
      ? raw.immediatePlan
          .map((step) => ({
            window: String(step?.window || '').trim(),
            focus: String(step?.focus || '').trim(),
            actions: Array.isArray(step?.actions) ? step.actions.map((item) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
          }))
          .filter((step) => step.window && step.focus)
          .slice(0, 3)
      : [],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 4) : [],
  };
}

function buildDegreeKey(degree: string, institution: string) {
  return `${degree.trim().toLowerCase()}::${institution.trim().toLowerCase()}`;
}

function normalizeStudyItems(items?: string[]) {
  return Array.isArray(items) ? items.map((item) => item.trim()).filter(Boolean) : [];
}

function buildAcademicSetup(profile: UserProfile) {
  return {
    institution: profile.institutionName?.trim() || '',
    studyLevel: profile.universityStudyLevel?.trim() || '',
    degree: profile.degreeProgram?.trim() || '',
    secondDegree: profile.secondDegreeProgram?.trim() || '',
    majors: normalizeStudyItems(profile.majors),
    minors: normalizeStudyItems(profile.minors),
  };
}

function buildCompositeDegreeKey(profile: UserProfile) {
  const setup = buildAcademicSetup(profile);
  return JSON.stringify({
    institution: setup.institution.toLowerCase(),
    studyLevel: setup.studyLevel.toLowerCase(),
    degree: setup.degree.toLowerCase(),
    secondDegree: setup.secondDegree.toLowerCase(),
    majors: setup.majors.map((item) => item.toLowerCase()),
    minors: setup.minors.map((item) => item.toLowerCase()),
  });
}

function buildUniversityPrompt(profile: UserProfile, focusPrompt: string) {
  const setup = buildAcademicSetup(profile);
  const studentName = profile.displayName?.trim() || 'Student';
  const focus = focusPrompt.trim();
  const studyStructureSummary = [
    `Study level: ${setup.studyLevel || 'Not specified'}`,
    `Primary degree: ${setup.degree || 'Not specified'}`,
    setup.secondDegree ? `Second degree: ${setup.secondDegree}` : '',
    setup.majors.length ? `Majors: ${setup.majors.join(', ')}` : '',
    setup.minors.length ? `Minors: ${setup.minors.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n- ');

  return `You are EduRev University's career direction engine.

Create a personalized university opportunity map for this student.

Student:
- Name: ${studentName}
- Institution: ${setup.institution || 'Unknown institution'}
- ${studyStructureSummary}

Focus request from the student:
${focus || 'Give the strongest broad analysis of what this degree can lead to, where the student should look for opportunities, and what they should build next.'}

Return only valid JSON matching the schema.

Rules:
- Be realistic and degree-specific. Do not write generic filler.
- If the student has a double degree, second degree, majors, or minors, reflect that combination directly in the analysis.
- Explain what doors this degree can open, including adjacent paths beyond the obvious default job.
- Mention likely employers, industries, teams, or settings rather than vague phrases.
- Make the advice actionable for a current university student, not a high-school student.
- HighValueExperiences should focus on internships, placements, portfolio work, labs, societies, volunteer roles, competitions, certifications, or research.
- StrengthsToBuild should be concrete and employability-focused.
- SearchTerms should be useful phrases the student could literally search on LinkedIn, Seek, university career boards, or graduate program pages.
- ImmediatePlan should be staged and realistic.
- Warnings should name common traps or misconceptions for students in this degree.
- Do not use markdown.`;
}

async function generateDegreeOpportunityReport(profile: UserProfile, focusPrompt: string) {
  const response = await geminiGenerateContent({
    model: 'gemini-3-flash-preview',
    contents: buildUniversityPrompt(profile, focusPrompt),
    config: {
      responseMimeType: 'application/json',
      responseSchema: reportSchema,
    },
  });

  return normalizeReport(JSON.parse(response.text || '{}') as DegreeOpportunityReport);
}

function UniversityBeyondPage({ profile }: { profile: UserProfile | null }) {
  const [focusPrompt, setFocusPrompt] = useState('');
  const [report, setReport] = useState<DegreeOpportunityReport | null>(profile?.beyondUniversityCareerDirection?.report || null);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const academicSetup = useMemo(() => (profile ? buildAcademicSetup(profile) : {
    institution: '',
    studyLevel: '',
    degree: '',
    secondDegree: '',
    majors: [],
    minors: [],
  }), [profile]);
  const degree = academicSetup.degree;
  const institution = academicSetup.institution;
  const hasProfileContext = Boolean(profile?.uid && degree && institution);
  const activeDegreeKey = useMemo(() => (profile ? buildCompositeDegreeKey(profile) : buildDegreeKey(degree, institution)), [profile, degree, institution]);
  const savedCareerDirection = profile?.beyondUniversityCareerDirection || null;
  const hasSavedCareerDirection = Boolean(savedCareerDirection?.degreeKey === activeDegreeKey && savedCareerDirection?.report);

  const headerSubtitle = useMemo(() => {
    if (!degree) return 'Add your degree in account setup or settings so this page can personalize real post-university opportunities.';
    return `Built from your saved degree: ${degree}${institution ? ` at ${institution}` : ''}.`;
  }, [degree, institution]);

  useEffect(() => {
    if (hasSavedCareerDirection) {
      setReport(savedCareerDirection?.report || null);
      return;
    }

    if (!savedCareerDirection || savedCareerDirection.degreeKey !== activeDegreeKey) {
      setReport(null);
    }
  }, [activeDegreeKey, hasSavedCareerDirection, savedCareerDirection]);

  const persistCareerDirection = async (nextReport: DegreeOpportunityReport) => {
    if (!profile?.uid) return;

    const savedPayload: BeyondUniversityCareerDirection = {
      degreeKey: activeDegreeKey,
      generatedAt: new Date().toISOString(),
      report: nextReport,
    };

    await setDoc(
      doc(db, 'users', profile.uid),
      { beyondUniversityCareerDirection: savedPayload },
      { merge: true },
    );

    try {
      const cacheKey = 'edurev-user-profile-cache-university';
      const cachedRaw = window.localStorage.getItem(cacheKey);
      const cachedProfile = cachedRaw ? JSON.parse(cachedRaw) : {};
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          ...cachedProfile,
          ...(profile || {}),
          beyondUniversityCareerDirection: savedPayload,
        }),
      );
    } catch {
      // Ignore cache write failures.
    }
  };

  const runGeneration = async (nextFocusPrompt = focusPrompt) => {
    if (!profile || !hasProfileContext) return;
    if (hasSavedCareerDirection) return;

    setIsGenerating(true);
    setError('');

    try {
      const payload = {
        scope: 'beyond-university-opportunity-map',
        version: 2,
        input: {
          degreeProgram: degree,
          institutionName: institution,
          focusPrompt: nextFocusPrompt.trim(),
        },
      } as const;

      const result = await getOrCreateCachedAiResult(payload, () => generateDegreeOpportunityReport(profile, nextFocusPrompt));

      await setCachedAiResult(payload, result);
      await persistCareerDirection(result);
      setReport(result);
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : '';
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        setError('The AI is rate-limited right now. Wait a moment and try again.');
      } else if (message.includes('503') || message.includes('UNAVAILABLE')) {
        setError('The AI is busy right now. Try again shortly.');
      } else {
        setError(message || 'Could not generate a degree opportunity map right now.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!hasProfileContext || report || isGenerating || hasSavedCareerDirection) return;
    void runGeneration('');
  }, [hasProfileContext, report, isGenerating, hasSavedCareerDirection]);

  if (!hasProfileContext) {
    return (
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#f5f7fb] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-8">
        <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="relative mx-auto max-w-3xl rounded-[2rem] border border-white/70 bg-white/75 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
            <GraduationCap size={30} />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900">Beyond University</h1>
          <p className="mt-3 text-base font-medium leading-7 text-slate-600">
            This page becomes a real opportunity explorer once the student has saved their university details.
          </p>
          <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5 text-left">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Needed for personalization</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
              Save both the institution and degree in the account profile. Then this page can generate tailored career doors, likely graduate roles,
              target employers, relevant experiences, and search terms based on what the student is actually studying.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#eef3f6] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-8">
      <div className="pointer-events-none absolute left-[-4rem] top-[-5rem] h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-16 h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] left-1/3 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
                <Sparkles size={15} />
                Personalized from your saved degree
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">Beyond University</h1>
              <p className="mt-4 text-base font-medium leading-7 text-slate-600">{headerSubtitle}</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                This guidance is for exploration and idea generation only. It should support reflection, not replace formal academic, course, or career advice.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Degree</p>
                <p className="mt-2 text-lg font-black text-slate-900">{degree}</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Institution</p>
                <p className="mt-2 text-lg font-black text-slate-900">{institution}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-700">Academic setup</p>
              <h2 className="text-2xl font-black tracking-tight text-slate-950">How your university study is structured</h2>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AcademicSetupCard label="Study level" value={academicSetup.studyLevel || 'Not set'} />
            <AcademicSetupCard label="Primary degree" value={academicSetup.degree || 'Not set'} />
            {academicSetup.secondDegree ? <AcademicSetupCard label="Second degree" value={academicSetup.secondDegree} /> : null}
            <AcademicSetupCard
              label="Majors"
              value={academicSetup.majors.length ? academicSetup.majors.join(', ') : 'Not set'}
            />
            <AcademicSetupCard
              label="Minors"
              value={academicSetup.minors.length ? academicSetup.minors.join(', ') : 'Not set'}
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">Explore opportunities</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Ask what this degree can open</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                {hasSavedCareerDirection
                  ? 'This career direction has already been generated and saved for the current degree. It will regenerate only if the degree or institution changes.'
                  : 'Before the first generation, you can refine the prompt for a more specific read on roles, industries, placements, or adjacent career doors.'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Compass size={23} />
            </div>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50/75 p-4 md:p-5">
            <label htmlFor="focus-prompt" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Focus the analysis
            </label>
            <textarea
              id="focus-prompt"
              value={focusPrompt}
              onChange={(event) => setFocusPrompt(event.target.value)}
              placeholder="Example: What graduate roles fit this degree in Australia, and what should I build before I finish?"
              disabled={hasSavedCareerDirection}
              className="mt-3 min-h-32 w-full resize-none rounded-[1.25rem] border border-white/80 bg-white px-4 py-4 text-sm font-semibold leading-7 text-slate-900 outline-none ring-emerald-500/20 placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {sampleFocusPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setFocusPrompt(prompt)}
                  disabled={hasSavedCareerDirection}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => void runGeneration()}
                disabled={isGenerating || hasSavedCareerDirection}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                {hasSavedCareerDirection ? 'Saved to profile' : 'Generate opportunity map'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          {isGenerating && !report ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-emerald-700" />
              <p className="text-lg font-black text-slate-900">Building your degree opportunity map</p>
              <p className="max-w-xl text-sm font-medium leading-6 text-slate-500">
                Matching your degree to graduate lanes, employers, adjacent opportunities, and the strongest next moves.
              </p>
            </div>
          ) : report ? (
            <div>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-4xl">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">AI direction memo</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                    {report.tailoredFor || 'Degree-specific career direction'}
                  </h2>
                  <p className="mt-4 text-base font-medium leading-8 text-slate-600">{report.overview}</p>
                </div>
                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/90 px-5 py-4 xl:max-w-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Degree lens</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{report.degreeLens}</p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/85 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Confidence note</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{report.confidenceNote}</p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700">
                <Target size={30} />
              </div>
              <p className="mt-4 text-lg font-black text-slate-900">Your personalized opportunity map will appear here.</p>
              <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500">
                Use the saved degree details and optionally add a focus prompt to generate real graduate pathways and opportunity doors.
              </p>
            </div>
          )}
        </section>

        {report ? (
          <>
            <section className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <BriefcaseBusiness size={22} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Opportunity doors</p>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">Where this degree can take you</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {report.opportunityDoors.map((door, index) => (
                  <motion.div
                    key={`${door.title}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Door {index + 1}</p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{door.title}</h3>
                      </div>
                      <ArrowRight className="mt-1 h-5 w-5 text-slate-300" />
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{door.whyItFits}</p>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <DoorList title="Roles" items={door.roles} />
                      <DoorList title="Employers" items={door.employers} />
                      <DoorList title="Next moves" items={door.nextMoves} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
              <div className="space-y-6">
                <InfoPanel
                  icon={<CheckCircle2 size={20} />}
                  title="High-value experiences"
                  subtitle="Experiences that would make this degree convert into real employability."
                  items={report.highValueExperiences}
                  accent="emerald"
                />
                <InfoPanel
                  icon={<Target size={20} />}
                  title="Strengths to build"
                  subtitle="Capabilities the student should make visible before applications open."
                  items={report.strengthsToBuild}
                  accent="sky"
                />
              </div>

              <div className="space-y-6">
                <section className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Search size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Search phrases</p>
                      <h2 className="text-2xl font-black tracking-tight text-slate-950">Useful terms to search right now</h2>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {report.searchTerms.map((item) => (
                      <div key={item} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700">
                        {item}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-50 text-amber-700">
                  <Compass size={22} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Immediate plan</p>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">What to do next</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {report.immediatePlan.map((step, index) => (
                  <div key={`${step.window}-${index}`} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/85 p-6 shadow-sm">
                    <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-amber-100 text-lg font-black text-amber-800">
                      {index + 1}
                    </div>
                    <p className="mt-5 max-w-xs text-xs font-black uppercase tracking-[0.2em] leading-6 text-slate-400">{step.window}</p>
                    <h3 className="mt-3 max-w-xl text-3xl font-black leading-tight text-slate-950">{step.focus}</h3>
                    <div className="mt-5 space-y-4">
                      {step.actions.map((action) => (
                        <div key={action} className="flex items-start gap-3 text-base font-medium leading-8 text-slate-600">
                          <CheckCircle2 size={18} className="mt-1.5 shrink-0 text-amber-600" />
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {report.warnings.length ? (
                <div className="mt-6 rounded-[1.5rem] border border-rose-100 bg-rose-50/85 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-700">Watch-outs</p>
                  <div className="mt-3 space-y-2">
                    {report.warnings.map((warning) => (
                      <p key={warning} className="text-sm font-medium leading-6 text-slate-700">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SchoolBeyondPage() {
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#eef4f7] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-8">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-cyan-200/45 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="relative mx-auto max-w-5xl space-y-6">
        <section className="rounded-[2rem] border border-white/70 bg-white/70 p-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800">
              <GraduationCap size={15} />
              High school direction
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">Beyond School</h1>
            <p className="mt-4 text-base font-medium leading-7 text-slate-600">
              Use this space to compare future directions, course pathways, apprenticeships, and work experience ideas before graduation.
            </p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          {schoolSnapshots.map((item) => (
            <div key={item.title} className="rounded-[1.75rem] border border-white/70 bg-white/70 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur-2xl">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoorList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="text-sm font-bold leading-6 text-slate-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function AcademicSetupCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/85 p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-base font-black leading-7 text-slate-900">{value}</p>
    </div>
  );
}

function InfoPanel({
  icon,
  title,
  subtitle,
  items,
  accent,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  items: string[];
  accent: 'emerald' | 'sky';
}) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-2xl',
            accent === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700',
          )}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item} className="flex gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <CheckCircle2
              size={18}
              className={cn('mt-1 shrink-0', accent === 'emerald' ? 'text-emerald-600' : 'text-sky-600')}
            />
            <p className="text-sm font-medium leading-6 text-slate-700">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BeyondSchoolPage({ profile }: { profile?: UserProfile | null }) {
  const location = useLocation();
  const isUniversityPortal = detectStudentPortalFromPath(location.pathname) === 'university';

  return isUniversityPortal ? <UniversityBeyondPage profile={profile || null} /> : <SchoolBeyondPage />;
}
