import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc } from '@/lib/portal-firestore';
import { ArrowLeft, GraduationCap, Loader2, School } from 'lucide-react';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { setStoredStudentPortal, studentPortalHome, type StudentPortalType } from '@/lib/portal';
import { saveGlobalUserProfile } from '@/lib/global-user-profile';

interface AccountSetupPageProps {
  user: User;
  profile: UserProfile | null;
  portal: StudentPortalType;
}

interface SchoolSuggestion {
  id: string;
  name: string;
  suburb: string;
  state: string;
  postcode: string;
  displayLabel: string;
}

const YEAR_LEVEL_OPTIONS = ['7', '8', '9', '10', '11', '12', 'University', 'TAFE', 'Other'];
const UNIVERSITY_STUDY_LEVEL_OPTIONS = [
  'Bachelor',
  'Double Degree',
  'Bachelor Honours',
  'Masters',
  'PhD',
  'Graduate Diploma',
  'Graduate Certificate',
  'Associate Degree',
  'Other',
];
const LEGACY_PLACEHOLDERS = {
  gradeLevel: '11',
  schoolName: 'Riverside State College',
  studentNumber: 'S28417',
};

function splitStudyItems(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const INSTITUTION_DOMAIN_MAP: Record<string, { name: string; gradeLevel?: string }> = {
  'qut.edu.au': { name: 'Queensland University of Technology', gradeLevel: 'University' },
  'uq.edu.au': { name: 'The University of Queensland', gradeLevel: 'University' },
  'griffith.edu.au': { name: 'Griffith University', gradeLevel: 'University' },
  'usq.edu.au': { name: 'University of Southern Queensland', gradeLevel: 'University' },
  'usc.edu.au': { name: 'University of the Sunshine Coast', gradeLevel: 'University' },
  'acu.edu.au': { name: 'Australian Catholic University', gradeLevel: 'University' },
};

function inferInstitutionFromEmail(email: string | null | undefined) {
  const domain = email?.split('@')[1]?.toLowerCase().trim();
  if (!domain) return null;

  if (INSTITUTION_DOMAIN_MAP[domain]) {
    return INSTITUTION_DOMAIN_MAP[domain];
  }

  if (domain.endsWith('.edu.au')) {
    const base = domain.replace(/\.edu\.au$/, '');
    const humanized = base
      .split(/[.-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    if (humanized) {
      return {
        name: humanized,
        gradeLevel: 'University',
      };
    }
  }

  return null;
}

export default function AccountSetupPage({ user, profile, portal }: AccountSetupPageProps) {
  const isUniversityPortal = portal === 'university';
  const [displayName, setDisplayName] = useState(profile?.displayName || user.displayName || 'Student');
  const [schoolName, setSchoolName] = useState(
    profile?.schoolName === LEGACY_PLACEHOLDERS.schoolName ? '' : (profile?.schoolName || ''),
  );
  const [gradeLevel, setGradeLevel] = useState(
    profile?.gradeLevel === LEGACY_PLACEHOLDERS.gradeLevel ? '' : (profile?.gradeLevel || ''),
  );
  const [institutionName, setInstitutionName] = useState(profile?.institutionName || profile?.schoolName || '');
  const [universityStudyLevel, setUniversityStudyLevel] = useState(profile?.universityStudyLevel || 'Bachelor');
  const [degreeProgram, setDegreeProgram] = useState(profile?.degreeProgram || '');
  const [secondDegreeProgram, setSecondDegreeProgram] = useState(profile?.secondDegreeProgram || '');
  const [majorsInput, setMajorsInput] = useState((profile?.majors || []).join(', '));
  const [minorsInput, setMinorsInput] = useState((profile?.minors || []).join(', '));
  const [studentNumber, setStudentNumber] = useState(
    profile?.studentNumber === LEGACY_PLACEHOLDERS.studentNumber ? '' : (profile?.studentNumber || ''),
  );
  const [schoolSuggestions, setSchoolSuggestions] = useState<SchoolSuggestion[]>([]);
  const [isSearchingSchools, setIsSearchingSchools] = useState(false);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const searchRequestIdRef = useRef(0);
  const portalName = isUniversityPortal ? 'University Portal' : 'High School Portal';
  const portalEditionLabel = isUniversityPortal ? 'EducationRev University' : 'EducationRev High School';

  const resolvedDisplayName = useMemo(() => displayName.trim() || profile?.displayName || user.displayName || 'Student', [displayName, profile?.displayName, user.displayName]);

  useEffect(() => {
    setStoredStudentPortal(portal);
  }, [portal]);

  useEffect(() => {
    if (isUniversityPortal) return;
    const inferredInstitution = inferInstitutionFromEmail(profile?.email || user.email);
    if (!inferredInstitution) return;

    setSchoolName((current) => current.trim() ? current : inferredInstitution.name);
    if (inferredInstitution.gradeLevel) {
      setGradeLevel((current) => current.trim() ? current : inferredInstitution.gradeLevel || '');
    }
  }, [isUniversityPortal, profile?.email, user.email]);

  useEffect(() => {
    if (!isUniversityPortal) return;
    const inferredInstitution = inferInstitutionFromEmail(profile?.email || user.email);
    if (!inferredInstitution) return;
    setInstitutionName((current) => current.trim() ? current : inferredInstitution.name);
  }, [isUniversityPortal, profile?.email, user.email]);

  useEffect(() => {
    if (isUniversityPortal) return;
    const query = schoolName.trim();

    if (query.length < 2) {
      setSchoolSuggestions([]);
      setIsSearchingSchools(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = ++searchRequestIdRef.current;
      setIsSearchingSchools(true);
      try {
        const response = await fetch(`/api/school-search?q=${encodeURIComponent(query)}`);
        const payload = await response.json().catch(() => ({ schools: [] }));

        if (!response.ok) {
          throw new Error(payload?.error || 'School search failed.');
        }

        if (requestId === searchRequestIdRef.current) {
          setSchoolSuggestions(Array.isArray(payload?.schools) ? payload.schools : []);
          setShowSchoolSuggestions(true);
        }
      } catch (searchError) {
        console.error('School search failed:', searchError);
        if (requestId === searchRequestIdRef.current) {
          setSchoolSuggestions([]);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearchingSchools(false);
        }
      }
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [isUniversityPortal, schoolName]);

  const handleSave = async () => {
    const cleanSchool = schoolName.trim();
    const cleanGrade = gradeLevel.trim();
    const cleanInstitution = institutionName.trim();
    const cleanStudyLevel = universityStudyLevel.trim();
    const cleanDegree = degreeProgram.trim();
    const cleanSecondDegree = secondDegreeProgram.trim();
    const cleanMajors = splitStudyItems(majorsInput);
    const cleanMinors = splitStudyItems(minorsInput);
    const cleanDisplayName = displayName.trim();

    if (
      !cleanDisplayName ||
      (isUniversityPortal ? (!cleanInstitution || !cleanDegree) : (!cleanSchool || !cleanGrade))
    ) {
      setError(
        isUniversityPortal
          ? 'Name, institution, and degree are required before entering the university portal.'
          : 'Name, school, and year level are required before entering the app.',
      );
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const nextProfile = {
        uid: user.uid,
        email: profile?.email || user.email || '',
        displayName: cleanDisplayName,
        photoURL: profile?.photoURL || user.photoURL || '',
        role: profile?.role || 'student',
        createdAt: profile?.createdAt || new Date().toISOString(),
        accountType: profile?.accountType || 'member',
        aiAccessEnabled: typeof profile?.aiAccessEnabled === 'boolean' ? profile.aiAccessEnabled : true,
        username: profile?.username || '',
        usernameLower: profile?.usernameLower || '',
        pronouns: profile?.pronouns || 'prefer-not-to-say',
        schoolName: isUniversityPortal ? (profile?.schoolName || '') : cleanSchool,
        gradeLevel: isUniversityPortal ? (profile?.gradeLevel || '') : cleanGrade,
        institutionName: isUniversityPortal ? cleanInstitution : (profile?.institutionName || ''),
        universityStudyLevel: isUniversityPortal ? cleanStudyLevel : (profile?.universityStudyLevel || ''),
        degreeProgram: isUniversityPortal ? cleanDegree : (profile?.degreeProgram || ''),
        secondDegreeProgram: isUniversityPortal ? cleanSecondDegree : (profile?.secondDegreeProgram || ''),
        majors: isUniversityPortal ? cleanMajors : (profile?.majors || []),
        minors: isUniversityPortal ? cleanMinors : (profile?.minors || []),
        studentNumber: studentNumber.trim(),
      };

      await setDoc(doc(db, 'users', user.uid), {
        ...nextProfile,
      }, { merge: true });
      await saveGlobalUserProfile(user.uid, nextProfile);

      await setDoc(doc(db, 'userDirectory', user.uid), {
        uid: user.uid,
        displayName: nextProfile.displayName,
        email: nextProfile.email,
        emailLower: nextProfile.email.toLowerCase().trim(),
        photoURL: nextProfile.photoURL,
        schoolName: nextProfile.schoolName,
        gradeLevel: nextProfile.gradeLevel,
        institutionName: nextProfile.institutionName,
        universityStudyLevel: nextProfile.universityStudyLevel,
        degreeProgram: nextProfile.degreeProgram,
        secondDegreeProgram: nextProfile.secondDegreeProgram,
        majors: nextProfile.majors,
        minors: nextProfile.minors,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (isUniversityPortal) {
        await setDoc(doc(db, 'userDirectory', user.uid), {
          uid: user.uid,
          displayName: nextProfile.displayName,
          email: nextProfile.email,
          emailLower: nextProfile.email.toLowerCase().trim(),
          photoURL: nextProfile.photoURL,
          institutionName: nextProfile.institutionName,
          universityStudyLevel: nextProfile.universityStudyLevel,
          degreeProgram: nextProfile.degreeProgram,
          secondDegreeProgram: nextProfile.secondDegreeProgram,
          majors: nextProfile.majors,
          minors: nextProfile.minors,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      window.location.replace(studentPortalHome(portal));
    } catch (saveError) {
      console.error('Account setup save failed:', saveError);
      setError(
        isUniversityPortal
          ? 'Could not save your university details. Please try again.'
          : 'Could not save your school details. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackToPortalChoice = () => {
    window.location.assign('/auth?switch=1');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f4f7fb_100%)] p-4 font-sans">
      <div className="w-full max-w-2xl rounded-[36px] border border-white/70 bg-white/92 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
        <div className="rounded-[32px] border border-zinc-200/80 bg-white px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:px-8">
          <button
            type="button"
            onClick={handleBackToPortalChoice}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to portal choice
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200/70">
              <GraduationCap size={30} />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-zinc-400">{portalName}</p>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-zinc-950 sm:text-[2.6rem]">Finish account setup</h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-7 text-zinc-500">
              {isUniversityPortal
                ? 'You are entering the university portal. Confirm your institution and degree for this student account before continuing.'
                : 'You are entering the high school portal. Confirm your school and year level for this student account before continuing.'}
            </p>
            <div className={`mt-4 rounded-2xl border px-4 py-2 text-sm font-black ${
              isUniversityPortal
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-indigo-200 bg-indigo-50 text-indigo-700'
            }`}>
              {portalEditionLabel}
            </div>
          </div>

          <div className="mt-8 grid gap-5">
            <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
                  <School size={22} />
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Student profile</p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{resolvedDisplayName}</h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                      {isUniversityPortal
                        ? 'These university details are required before the app can finish university sign in and open the university dashboard.'
                        : 'These school details are required before the app can finish high school sign in and open the student dashboard.'}
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Name</span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {isUniversityPortal ? (
                      <>
                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Institution</span>
                          <input
                            type="text"
                            value={institutionName}
                            onChange={(event) => setInstitutionName(event.target.value)}
                            placeholder="Enter your university or institution"
                            autoComplete="organization"
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Study level</span>
                          <select
                            value={universityStudyLevel}
                            onChange={(event) => setUniversityStudyLevel(event.target.value)}
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          >
                            {UNIVERSITY_STUDY_LEVEL_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Degree</span>
                          <input
                            type="text"
                            value={degreeProgram}
                            onChange={(event) => setDegreeProgram(event.target.value)}
                            placeholder="What are you studying?"
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Second degree for double degree (optional)</span>
                          <input
                            type="text"
                            value={secondDegreeProgram}
                            onChange={(event) => setSecondDegreeProgram(event.target.value)}
                            placeholder="Example: Business, Laws, Design"
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Majors (optional)</span>
                          <input
                            type="text"
                            value={majorsInput}
                            onChange={(event) => setMajorsInput(event.target.value)}
                            placeholder="Comma separated, e.g. Civil Engineering, Finance"
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Minors (optional)</span>
                          <input
                            type="text"
                            value={minorsInput}
                            onChange={(event) => setMinorsInput(event.target.value)}
                            placeholder="Comma separated, e.g. Data Science, Media"
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="relative block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">School</span>
                          <input
                            type="text"
                            value={schoolName}
                            onChange={(event) => {
                              setSchoolName(event.target.value);
                              setShowSchoolSuggestions(true);
                            }}
                            onFocus={() => setShowSchoolSuggestions(true)}
                            onBlur={() => {
                              window.setTimeout(() => setShowSchoolSuggestions(false), 150);
                            }}
                            placeholder="Search your school"
                            autoComplete="off"
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                          {showSchoolSuggestions && (schoolSuggestions.length > 0 || isSearchingSchools) ? (
                            <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
                              {isSearchingSchools ? (
                                <div className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Searching Australian schools...
                                </div>
                              ) : null}
                              {!isSearchingSchools ? (
                                <div className="max-h-72 overflow-y-auto py-2">
                                  {schoolSuggestions.map((suggestion) => (
                                    <button
                                      key={suggestion.id}
                                      type="button"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => {
                                        setSchoolName(suggestion.name);
                                        setShowSchoolSuggestions(false);
                                      }}
                                      className="flex w-full flex-col px-4 py-3 text-left transition hover:bg-zinc-50"
                                    >
                                      <span className="text-sm font-black text-zinc-900">{suggestion.name}</span>
                                      <span className="text-xs font-semibold text-zinc-500">{[suggestion.suburb, suggestion.state, suggestion.postcode].filter(Boolean).join(' · ')}</span>
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Year level</span>
                          <select
                            value={gradeLevel}
                            onChange={(event) => setGradeLevel(event.target.value)}
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          >
                            <option value="">Select year level</option>
                            {YEAR_LEVEL_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
                      {isUniversityPortal ? 'Student ID (optional)' : 'Student number (optional)'}
                    </span>
                    <input
                      type="text"
                      value={studentNumber}
                      onChange={(event) => setStudentNumber(event.target.value)}
                      placeholder={isUniversityPortal ? 'Enter your university student ID' : 'Enter your student number'}
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    />
                  </label>

                  {error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                      {error}
                    </div>
                  ) : null}

                  <p className="text-xs font-semibold text-zinc-400">
                    {isUniversityPortal
                      ? 'University details save only to the university portal, so your high school and university profiles stay separate.'
                      : 'School search uses a free Australian school directory lookup and lets you keep typing manually if your school is not listed yet.'}
                  </p>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-4 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                    {isUniversityPortal ? 'Continue to University Portal' : 'Continue to High School Portal'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
