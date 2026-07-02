import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserProfile } from '../types';
import {
  ChevronDown,
  Clipboard,
  ExternalLink,
  FileText,
  Globe2,
  Link as LinkIcon,
  Loader2,
  Map,
  Quote,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { geminiGenerateContent } from '../services/geminiProxy';

interface ResourceHubProps {
  profile: UserProfile | null;
}

type ReferenceStyle = 'Harvard' | 'IEEE';

const suggestions = ['photosynthesis', 'ancient Rome', 'algebra help', 'climate change', 'Shakespeare', 'coding basics'];

declare global {
  interface Window {
    eduRevShell?: {
      isDesktopShell?: boolean;
      openGooglePage?: (payload: { url: string; bounds: { x: number; y: number; width: number; height: number } }) => void;
      updateGooglePageBounds?: (bounds: { x: number; y: number; width: number; height: number }) => void;
      closeGooglePage?: () => void;
    };
  }
}

function isDesktopWrapper() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.eduRevShell?.isDesktopShell) || /Electron/i.test(window.navigator.userAgent || '');
}

function buildGoogleUrl(term: string) {
  const trimmed = term.trim();
  if (!trimmed) return 'https://www.google.com/?igu=1';
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}&igu=1`;
}

export default function ResourceHub({ profile }: ResourceHubProps) {
  const [searchParams] = useSearchParams();
  const referencesRef = useRef<HTMLElement | null>(null);
  const googleResultsRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [isSearchingGoogle, setIsSearchingGoogle] = useState(false);
  const [isReferenceMenuOpen, setIsReferenceMenuOpen] = useState(false);
  const [showReferenceGenerator, setShowReferenceGenerator] = useState(false);
  const [referenceStyle, setReferenceStyle] = useState<ReferenceStyle>('Harvard');
  const [referenceInput, setReferenceInput] = useState({
    sourceType: 'Website',
    author: '',
    year: '',
    title: '',
    publisher: '',
    url: '',
    accessDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [generatedReference, setGeneratedReference] = useState('');
  const [isGeneratingReference, setIsGeneratingReference] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const desktopShell = useMemo(() => isDesktopWrapper(), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tool') === 'references') {
      setShowReferenceGenerator(true);
      setTimeout(() => {
        referencesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, []);

  useEffect(() => {
    const requestedQuery = searchParams.get('q')?.trim();
    if (requestedQuery) {
      setQuery(requestedQuery);
    }
  }, [searchParams]);

  const syncGoogleBounds = () => {
    if (!desktopShell || !googleResultsRef.current || !window.eduRevShell?.updateGooglePageBounds) return;
    const rect = googleResultsRef.current.getBoundingClientRect();
    window.eduRevShell.updateGooglePageBounds({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  useLayoutEffect(() => {
    if (!desktopShell || !googleResultsRef.current || !window.eduRevShell?.openGooglePage) return;
    const term = searchParams.get('q')?.trim() || query;
    const rect = googleResultsRef.current.getBoundingClientRect();
    window.eduRevShell.openGooglePage({
      url: buildGoogleUrl(term),
      bounds: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
    });

    const resizeObserver = new ResizeObserver(() => syncGoogleBounds());
    resizeObserver.observe(googleResultsRef.current);
    window.addEventListener('resize', syncGoogleBounds);
    window.addEventListener('scroll', syncGoogleBounds, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncGoogleBounds);
      window.removeEventListener('scroll', syncGoogleBounds, true);
      window.eduRevShell?.closeGooglePage?.();
    };
  }, [desktopShell]);

  const openReferenceGenerator = (style: ReferenceStyle) => {
    setReferenceStyle(style);
    setShowReferenceGenerator(true);
    setIsReferenceMenuOpen(false);
    setTimeout(() => {
      referencesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const searchGoogle = async () => {
    const term = query.trim();
    if (!term) {
      setMessage('Type something to search first.');
      return;
    }

    setIsSearchingGoogle(true);
    setMessage(null);

    try {
      if (desktopShell && googleResultsRef.current && window.eduRevShell?.openGooglePage) {
        const rect = googleResultsRef.current.getBoundingClientRect();
        window.eduRevShell.openGooglePage({
          url: buildGoogleUrl(term),
          bounds: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
        });
      } else {
        window.open(buildGoogleUrl(term), '_blank', 'noopener,noreferrer');
      }
      window.setTimeout(() => {
        googleResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (error) {
      console.error('Google search error:', error);
      setMessage(error instanceof Error ? error.message : 'Google search could not load inside the page.');
    } finally {
      setIsSearchingGoogle(false);
    }
  };

  const runSearch = async () => {
    await searchGoogle();
  };

  const generateReference = async () => {
    const hasInput = [
      referenceInput.author,
      referenceInput.year,
      referenceInput.title,
      referenceInput.publisher,
      referenceInput.url,
      referenceInput.notes,
    ].some((value) => value.trim().length > 0);

    if (!hasInput) {
      setMessage('Add at least a title, URL, author, publisher, or notes before generating a reference.');
      return;
    }

    setIsGeneratingReference(true);
    setMessage(null);

    try {
      const response = await geminiGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate one complete academic reference in ${referenceStyle} style.

Return only the finished reference as plain text. Do not include markdown, explanations, labels, or extra notes.

Source details:
- Source type: ${referenceInput.sourceType}
- Author or organisation: ${referenceInput.author || 'Not supplied'}
- Year or date: ${referenceInput.year || 'Not supplied'}
- Title: ${referenceInput.title || 'Not supplied'}
- Publisher, journal, website, or platform: ${referenceInput.publisher || 'Not supplied'}
- URL or DOI: ${referenceInput.url || 'Not supplied'}
- Access date: ${referenceInput.accessDate || 'Not supplied'}
- Extra notes: ${referenceInput.notes || 'Not supplied'}

Rules:
- If details are missing, format the reference using normal ${referenceStyle} conventions without inventing unknown facts.
- For Harvard, use author-date style and include accessed date for online sources.
- For IEEE, use numbered style and include access date for online sources.`,
      });

      setGeneratedReference(response.text || 'Could not generate a reference.');
    } catch (error) {
      console.error('Reference generation error:', error);
      setMessage('The AI reference generator could not run right now. Try again in a moment.');
    } finally {
      setIsGeneratingReference(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4">
      <section className="max-w-5xl rounded-[24px] border border-emerald-200 bg-white px-6 py-5 shadow-lg shadow-emerald-50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Map size={22} />
            </div>
            <h1 className="text-[2.35rem] font-black tracking-tight leading-none text-zinc-900">Resources</h1>
            <p className="mt-2 text-[15px] font-medium leading-6 text-zinc-500">Search to find. Get references.</p>
          </div>

          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:min-w-[240px]">
            <button
              onClick={runSearch}
              disabled={isSearchingGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
            >
              {isSearchingGoogle ? <Loader2 className="animate-spin" size={18} /> : <Globe2 size={18} />}
              Search Google
            </button>
            <div className="relative">
              <button
                onClick={() => setIsReferenceMenuOpen((isOpen) => !isOpen)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-zinc-200 transition hover:bg-zinc-800"
              >
                <Quote size={18} />
                Get my reference
                <ChevronDown size={17} className={isReferenceMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {isReferenceMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
                  <button
                    onClick={() => openReferenceGenerator('Harvard')}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-black text-zinc-700 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    <FileText size={17} />
                    Harvard generator
                  </button>
                  <button
                    onClick={() => openReferenceGenerator('IEEE')}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-black text-zinc-700 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    <LinkIcon size={17} />
                    IEEE generator
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {showReferenceGenerator && (
        <section ref={referencesRef} className="rounded-[32px] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-50">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Quote size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-zinc-900">References & Bibliography</h2>
                <p className="text-sm font-medium text-zinc-500">AI generator for full Harvard and IEEE references.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={referenceStyle}
                onChange={(event) => setReferenceStyle(event.target.value as ReferenceStyle)}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-3 text-sm font-black text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="Harvard">Harvard</option>
                <option value="IEEE">IEEE</option>
              </select>
              <button
                onClick={generateReference}
                disabled={isGeneratingReference}
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
              >
                {isGeneratingReference ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                Generate
              </button>
              <button
                onClick={() => setShowReferenceGenerator(false)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label="Close references generator"
                title="Close references generator"
              >
                <span className="text-xl font-black leading-none">x</span>
              </button>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Source type</span>
                <select
                  value={referenceInput.sourceType}
                  onChange={(event) => setReferenceInput((input) => ({ ...input, sourceType: event.target.value }))}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                >
                  <option>Website</option>
                  <option>Book</option>
                  <option>Journal article</option>
                  <option>Report</option>
                  <option>Video</option>
                  <option>Dataset</option>
                </select>
              </label>
              <ReferenceInput label="Author or organisation" value={referenceInput.author} onChange={(value) => setReferenceInput((input) => ({ ...input, author: value }))} placeholder="Smith, J. or NASA" />
              <ReferenceInput label="Year or date" value={referenceInput.year} onChange={(value) => setReferenceInput((input) => ({ ...input, year: value }))} placeholder="2026" />
              <ReferenceInput label="Title" value={referenceInput.title} onChange={(value) => setReferenceInput((input) => ({ ...input, title: value }))} placeholder="Article, chapter, page, or book title" />
              <ReferenceInput label="Publisher / site / journal" value={referenceInput.publisher} onChange={(value) => setReferenceInput((input) => ({ ...input, publisher: value }))} placeholder="Publisher, journal, website, platform" />
              <ReferenceInput label="URL or DOI" value={referenceInput.url} onChange={(value) => setReferenceInput((input) => ({ ...input, url: value }))} placeholder="https://... or DOI" />
              <ReferenceInput label="Access date" value={referenceInput.accessDate} onChange={(value) => setReferenceInput((input) => ({ ...input, accessDate: value }))} placeholder="2026-04-20" />
              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Extra details</span>
                <textarea
                  value={referenceInput.notes}
                  onChange={(event) => setReferenceInput((input) => ({ ...input, notes: event.target.value }))}
                  placeholder="Edition, pages, volume, issue, editor, database, or anything else the AI should use."
                  className="min-h-28 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex min-h-72 flex-col rounded-[28px] border-2 border-dashed border-zinc-200 bg-zinc-50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{referenceStyle} output</p>
                  <h3 className="text-lg font-black text-zinc-900">Generated reference</h3>
                </div>
                {generatedReference && (
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedReference)}
                    className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black text-zinc-500 transition hover:text-blue-600"
                    title="Copy generated reference"
                  >
                    <Clipboard size={15} />
                    Copy
                  </button>
                )}
              </div>
              {generatedReference ? (
                <div className="flex-1 whitespace-pre-wrap rounded-2xl border border-zinc-100 bg-white p-5 font-mono text-sm leading-7 text-zinc-700">
                  {generatedReference}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-2xl bg-white p-8 text-center">
                  <div>
                    <p className="text-lg font-black text-zinc-400">No reference generated yet.</p>
                    <p className="mt-2 text-sm font-medium text-zinc-400">Select Harvard or IEEE, add your source details, then generate.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="mb-3 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Search anything for school</label>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
                placeholder="Search topics, homework questions, people, places, concepts..."
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-4 pl-12 pr-4 text-sm font-bold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </div>
            <button
              onClick={runSearch}
              disabled={isSearchingGoogle}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
            >
              {isSearchingGoogle ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              Search Google
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                }}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-black text-zinc-500 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {message && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700">
              <Globe2 size={18} />
              {message}
            </div>
          )}

          <div ref={googleResultsRef} className="mt-6 border-t border-zinc-100 pt-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Globe2 size={19} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900">Google Results</h2>
                  <p className="text-xs font-medium text-zinc-500">
                    {desktopShell ? 'Google loads inside this page area in the desktop app.' : 'Browser mode opens Google directly.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-black text-zinc-400">
                <ExternalLink size={14} />
                {desktopShell ? 'Google stays in-app' : 'Opens Google in a new tab'}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
              <div
                ref={googleResultsRef}
                className="min-h-[420px] overflow-hidden rounded-2xl border border-dashed border-zinc-200 bg-white"
              >
                {desktopShell ? (
                  <div className="flex h-full min-h-[420px] items-center justify-center text-center">
                    <div className="px-6">
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">Google</p>
                      <p className="mt-3 text-base font-bold text-zinc-900">Search Google inside EduRev</p>
                      <p className="mt-2 text-sm font-medium text-zinc-500">
                        Use the search card above or search directly in the embedded Google page here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[420px] items-center justify-center text-center">
                    <div className="px-6">
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">Browser mode</p>
                      <p className="mt-3 text-base font-bold text-zinc-900">Google opens directly instead</p>
                      <p className="mt-2 text-sm font-medium text-zinc-500">
                        Browsers do not allow us to embed normal Google search results here reliably, so browser mode opens google.com directly.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ReferenceInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}
