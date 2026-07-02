import { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from '@/lib/portal-firestore';
import { BookOpen, Copy, ExternalLink, FileSearch, FlaskConical, FolderOpen, ListChecks, NotebookPen, Pencil, Plus, Quote, Save, Search, SquareStack, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { studentPortalToolPath } from '../lib/portal';

type ResearchSource = {
  id: string;
  title: string;
  url: string;
  note: string;
  citation: string;
  folder: string;
  status: 'to-read' | 'reading' | 'used' | 'cited';
};

type ResearchDeskProject = {
  id: string;
  userId: string;
  title: string;
  course: string;
  researchQuestion: string;
  citationStyle: string;
  synthesisNotes: string;
  folders: string[];
  workingOutline: string;
  evidenceMap: string;
  openQuestions: string;
  methodologyNotes: string;
  supervisorNotes: string;
  nextActions: string;
  sources: ResearchSource[];
  createdAt?: any;
  updatedAt?: any;
};

const EMPTY_SOURCE: ResearchSource = {
  id: '',
  title: '',
  url: '',
  note: '',
  citation: '',
  folder: '',
  status: 'to-read',
};

const SOURCE_STATUS_LABELS: Record<ResearchSource['status'], string> = {
  'to-read': 'To Read',
  reading: 'Reading',
  used: 'Used',
  cited: 'Cited',
};

const SOURCE_STATUS_STYLES: Record<ResearchSource['status'], string> = {
  'to-read': 'bg-zinc-100 text-zinc-600',
  reading: 'bg-sky-50 text-sky-700',
  used: 'bg-amber-50 text-amber-700',
  cited: 'bg-emerald-50 text-emerald-700',
};

export default function ResearchDeskPage() {
  const { isPhone } = useResponsiveDevice();
  const [projects, setProjects] = useState<ResearchDeskProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [draftSource, setDraftSource] = useState<ResearchSource>(EMPTY_SOURCE);
  const [saving, setSaving] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [sourceQuery, setSourceQuery] = useState('');
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [folderInput, setFolderInput] = useState('');
  const [activeFolder, setActiveFolder] = useState<string>('All');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'researchDeskProjects'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ResearchDeskProject[];
      setProjects(items);
      if (!activeProjectId && items[0]?.id) {
        setActiveProjectId(items[0].id);
      }
    });
    return () => unsub();
  }, [activeProjectId]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  const filteredSources = useMemo(() => {
    if (!activeProject) return [];
    const queryText = sourceQuery.trim().toLowerCase();
    return (activeProject.sources || []).filter((source) => {
      const folderMatch = activeFolder === 'All' || (source.folder || 'General') === activeFolder;
      if (!folderMatch) return false;
      if (!queryText) return true;
      return [source.title, source.url, source.note, source.citation, source.folder]
        .some((value) => value.toLowerCase().includes(queryText));
    });
  }, [activeProject, sourceQuery, activeFolder]);

  const bibliographyText = useMemo(() => {
    if (!activeProject?.sources?.length) return '';
    return activeProject.sources
      .map((source, index) => `${index + 1}. ${source.citation || source.title || 'Untitled source'}`)
      .join('\n\n');
  }, [activeProject]);

  const availableFolders = useMemo(() => {
    const built = new Set<string>(['All', ...(activeProject?.folders || [])]);
    (activeProject?.sources || []).forEach((source) => {
      if (source.folder?.trim()) built.add(source.folder.trim());
    });
    if (built.size === 1) built.add('General');
    return Array.from(built);
  }, [activeProject]);

  const createProject = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const payload = {
      userId: user.uid,
      title: 'Untitled Research Desk',
      course: '',
      researchQuestion: '',
      citationStyle: 'APA 7',
      synthesisNotes: '',
      folders: ['General'],
      workingOutline: '',
      evidenceMap: '',
      openQuestions: '',
      methodologyNotes: '',
      supervisorNotes: '',
      nextActions: '',
      sources: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, 'researchDeskProjects'), payload);
    setActiveProjectId(ref.id);
  };

  const patchProject = async (patch: Partial<ResearchDeskProject>) => {
    if (!activeProjectId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'researchDeskProjects', activeProjectId), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setSaving(false);
    }
  };

  const addSource = async () => {
    if (!activeProject || !draftSource.title.trim()) return;
    const normalizedFolder = draftSource.folder.trim() || 'General';
    if (editingSourceId) {
      await patchProject({
        sources: (activeProject.sources || []).map((source) =>
          source.id === editingSourceId ? { ...draftSource, id: editingSourceId, folder: normalizedFolder } : source,
        ),
        folders: Array.from(new Set([...(activeProject.folders || []), normalizedFolder])),
      });
    } else {
      const nextSource = { ...draftSource, id: crypto.randomUUID(), folder: normalizedFolder };
      await patchProject({
        sources: [...(activeProject.sources || []), nextSource],
        folders: Array.from(new Set([...(activeProject.folders || []), normalizedFolder])),
      });
    }
    setDraftSource(EMPTY_SOURCE);
    setEditingSourceId(null);
  };

  const removeSource = async (sourceId: string) => {
    if (!activeProject) return;
    await patchProject({ sources: (activeProject.sources || []).filter((source) => source.id !== sourceId) });
    if (editingSourceId === sourceId) {
      setEditingSourceId(null);
      setDraftSource(EMPTY_SOURCE);
    }
  };

  const startEditSource = (source: ResearchSource) => {
    setEditingSourceId(source.id);
    setDraftSource({
      id: source.id,
      title: source.title,
      url: source.url,
      note: source.note,
      citation: source.citation,
      folder: source.folder || 'General',
      status: source.status || 'to-read',
    });
  };

  const cancelSourceEdit = () => {
    setEditingSourceId(null);
    setDraftSource(EMPTY_SOURCE);
  };

  const deleteProject = async () => {
    if (!activeProjectId) return;
    const currentId = activeProjectId;
    const remainingProjects = projects.filter((project) => project.id !== currentId);
    await deleteDoc(doc(db, 'researchDeskProjects', currentId));
    setActiveProjectId(remainingProjects[0]?.id ?? null);
    setEditingSourceId(null);
    setDraftSource(EMPTY_SOURCE);
  };

  const copyBibliography = async () => {
    if (!bibliographyText) return;
    await navigator.clipboard.writeText(bibliographyText);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 1600);
  };

  const addFolder = async () => {
    const trimmed = folderInput.trim();
    if (!activeProject || !trimmed) return;
    const nextFolders = Array.from(new Set([...(activeProject.folders || []), trimmed]));
    await patchProject({ folders: nextFolders });
    setFolderInput('');
    setActiveFolder(trimmed);
  };

  const updateSourceStatus = async (sourceId: string, status: ResearchSource['status']) => {
    if (!activeProject) return;
    await patchProject({
      sources: (activeProject.sources || []).map((source) => (source.id === sourceId ? { ...source, status } : source)),
    });
  };

  const quickLinks = [
    { label: 'Google Scholar', href: 'https://scholar.google.com' },
    { label: 'Google Resources', href: studentPortalToolPath('university', 'resources') },
    { label: 'Library', href: studentPortalToolPath('university', 'library') },
    { label: 'Question Breakdown', href: studentPortalToolPath('university', 'question-breakdown') },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-[36px] border border-white/60 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_36%),radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))] p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">Research Desk</p>
            <h1 className="text-4xl font-black tracking-tight text-zinc-950">Build a real research workflow, not a loose pile of tabs.</h1>
            <p className="max-w-3xl text-lg leading-8 text-zinc-600">
              Organise source capture, folders, synthesis, scaffolding, and evidence tracking from a single university-grade research workspace.
            </p>
          </div>
          <button
            onClick={createProject}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-zinc-200 transition hover:bg-zinc-800"
          >
            <Plus size={16} />
            New Research Desk
          </button>
        </div>
      </div>

      <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Research desks</p>
          <p className="text-sm font-semibold text-zinc-500">{projects.length} active</p>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={cn(
                  'min-w-[220px] rounded-[20px] border px-4 py-3 text-left transition',
                  project.id === activeProjectId
                    ? 'border-emerald-300 bg-emerald-50/80 shadow-sm'
                    : 'border-zinc-200 bg-white hover:border-zinc-300',
                )}
              >
                <p className="truncate text-sm font-black text-zinc-900">{project.title || 'Untitled Research Desk'}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{project.course || 'Course not set'}</p>
              </button>
            ))}
            {!projects.length && (
              <div className="min-w-[320px] rounded-[20px] border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                Create your first research desk to start collecting sources and building a literature base.
              </div>
            )}
        </div>
      </div>

      <div className="rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        {activeProject ? (
          <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
                    {(activeProject.sources || []).length} sources
                  </div>
                  <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-black text-violet-700">
                    {(activeProject.sources || []).filter((source) => source.citation.trim()).length} citations ready
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={copyBibliography}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                  >
                    <Copy size={14} />
                    {copiedCitation ? 'Copied bibliography' : 'Copy bibliography'}
                  </button>
                  <button
                    onClick={deleteProject}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-600 transition hover:bg-rose-100"
                  >
                    <Trash2 size={14} />
                    Delete desk
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-sky-600" />
                    <h2 className="text-xl font-black text-zinc-950">Folders and capture lanes</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Organise sources by chapter, theme, method, or evidence stream so one research task does not turn into a flat list.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {availableFolders.map((folder) => (
                      <button
                        key={folder}
                        onClick={() => setActiveFolder(folder)}
                        className={cn(
                          'rounded-full px-4 py-2 text-sm font-black transition',
                          activeFolder === folder
                            ? 'bg-zinc-950 text-white'
                            : 'border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300',
                        )}
                      >
                        {folder}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input
                      value={folderInput}
                      onChange={(event) => setFolderInput(event.target.value)}
                      className="flex-1 rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 outline-none focus:border-sky-400"
                      placeholder="Add folder, theme, or chapter"
                    />
                    <button
                      onClick={addFolder}
                      className="rounded-full bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5">
                  <div className="flex items-center gap-2">
                    <SquareStack className="h-5 w-5 text-violet-600" />
                    <h2 className="text-xl font-black text-zinc-950">Research shortcuts</h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Jump straight into source discovery, background reading, and evidence support without leaving your desk.
                  </p>
                  <div className="mt-4 grid gap-3">
                    {quickLinks.map((link) => {
                      const isExternal = link.href.startsWith('http');
                      return (
                        <a
                          key={link.label}
                          href={link.href}
                          target={isExternal ? '_blank' : undefined}
                          rel={isExternal ? 'noreferrer' : undefined}
                          className="inline-flex items-center justify-between rounded-[18px] border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-zinc-300"
                        >
                          {link.label}
                          <ExternalLink size={14} />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Project title</span>
                  <input
                    value={activeProject.title || ''}
                    onChange={(event) => patchProject({ title: event.target.value })}
                    className="w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-emerald-400"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Course</span>
                  <input
                    value={activeProject.course || ''}
                    onChange={(event) => patchProject({ course: event.target.value })}
                    className="w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-emerald-400"
                    placeholder="e.g. 6.046 Design and Analysis"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_220px]">
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Research question</span>
                  <textarea
                    value={activeProject.researchQuestion || ''}
                    onChange={(event) => patchProject({ researchQuestion: event.target.value })}
                    className="min-h-[120px] w-full rounded-[24px] border border-zinc-200 bg-white px-4 py-4 text-base text-zinc-800 outline-none transition focus:border-emerald-400"
                    placeholder="What problem are you investigating?"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Citation style</span>
                  <select
                    value={activeProject.citationStyle || 'APA 7'}
                    onChange={(event) => patchProject({ citationStyle: event.target.value })}
                    className="w-full rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition focus:border-emerald-400"
                  >
                    <option>APA 7</option>
                    <option>IEEE</option>
                    <option>Harvard</option>
                    <option>MLA</option>
                    <option>Chicago</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.95fr)]">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-emerald-600" />
                        <h2 className="text-xl font-black text-zinc-950">Source register</h2>
                      </div>
                      <div className="relative min-w-[220px] flex-1 max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                          value={sourceQuery}
                          onChange={(event) => setSourceQuery(event.target.value)}
                          className="w-full rounded-full border border-zinc-200 bg-white px-10 py-2.5 text-sm text-zinc-800 outline-none transition focus:border-emerald-400"
                          placeholder="Filter sources"
                        />
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {filteredSources.map((source) => (
                        <div key={source.id} className="rounded-[22px] border border-zinc-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-base font-black text-zinc-900">{source.title}</p>
                                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
                                  {source.folder || 'General'}
                                </span>
                                <button
                                  onClick={() => updateSourceStatus(source.id, source.status === 'cited' ? 'to-read' : source.status)}
                                  className={cn('rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em]', SOURCE_STATUS_STYLES[source.status])}
                                >
                                  {SOURCE_STATUS_LABELS[source.status]}
                                </button>
                              </div>
                              {source.url && (
                                <a href={source.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline">
                                  Open source
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEditSource(source)}
                                className="rounded-full bg-zinc-100 p-2 text-zinc-600 transition hover:bg-zinc-200"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => removeSource(source.id)}
                                className="rounded-full bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          {source.note && <p className="mt-3 text-sm leading-6 text-zinc-600">{source.note}</p>}
                          {source.citation && (
                            <div className="mt-3 rounded-[18px] bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                              <span className="font-black text-zinc-800">Citation:</span> {source.citation}
                            </div>
                          )}
                        </div>
                      ))}
                      {!filteredSources.length && (
                        <div className="rounded-[22px] border border-dashed border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500">
                          No sources in this view yet. Add articles, papers, websites, and primary references here.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                      <div className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-cyan-600" />
                        <h2 className="text-xl font-black text-zinc-950">Add source</h2>
                      </div>
                      <div className="mt-4 space-y-3">
                        {editingSourceId ? (
                          <div className="rounded-[18px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                            Editing existing source entry
                          </div>
                        ) : null}
                        <input
                          value={draftSource.title}
                          onChange={(event) => setDraftSource((current) => ({ ...current, title: event.target.value }))}
                          className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 outline-none focus:border-cyan-400"
                          placeholder="Source title"
                        />
                        <input
                          value={draftSource.url}
                          onChange={(event) => setDraftSource((current) => ({ ...current, url: event.target.value }))}
                          className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 outline-none focus:border-cyan-400"
                          placeholder="URL or DOI"
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            value={draftSource.folder}
                            onChange={(event) => setDraftSource((current) => ({ ...current, folder: event.target.value }))}
                            className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 outline-none focus:border-cyan-400"
                          >
                            <option value="">Choose folder</option>
                            {availableFolders.filter((folder) => folder !== 'All').map((folder) => (
                              <option key={folder} value={folder}>
                                {folder}
                              </option>
                            ))}
                          </select>
                          <select
                            value={draftSource.status}
                            onChange={(event) =>
                              setDraftSource((current) => ({ ...current, status: event.target.value as ResearchSource['status'] }))
                            }
                            className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 outline-none focus:border-cyan-400"
                          >
                            <option value="to-read">To read</option>
                            <option value="reading">Reading</option>
                            <option value="used">Used in argument</option>
                            <option value="cited">Cited in draft</option>
                          </select>
                        </div>
                        <textarea
                          value={draftSource.note}
                          onChange={(event) => setDraftSource((current) => ({ ...current, note: event.target.value }))}
                          className="min-h-[96px] w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 outline-none focus:border-cyan-400"
                          placeholder="Why this source matters / takeaways"
                        />
                        <textarea
                          value={draftSource.citation}
                          onChange={(event) => setDraftSource((current) => ({ ...current, citation: event.target.value }))}
                          className="min-h-[80px] w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 outline-none focus:border-cyan-400"
                          placeholder="Paste or draft a citation"
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={addSource}
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
                          >
                            <Plus size={15} />
                            {editingSourceId ? 'Save source changes' : 'Add source'}
                          </button>
                          {editingSourceId ? (
                            <button
                              onClick={cancelSourceEdit}
                              className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-600 transition hover:border-zinc-300"
                            >
                              Cancel edit
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-5 w-5 text-slate-700" />
                        <h2 className="text-xl font-black text-zinc-950">Research scaffold</h2>
                      </div>
                      <div className="mt-4 space-y-3">
                        {[
                          'Clarify the exact research problem',
                          'Collect at least 5 credible sources',
                          'Separate background from core evidence',
                          'Mark which sources are cited in the draft',
                          'Record unresolved questions for follow-up',
                          'Track methodology and supervisor guidance',
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-3 rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                            <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-zinc-900" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-5">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-emerald-600" />
                      <h2 className="text-xl font-black text-zinc-950">Desk snapshot</h2>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[20px] border border-zinc-200 bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Active folder</p>
                        <p className="mt-2 text-xl font-black text-zinc-950">{activeFolder}</p>
                      </div>
                      <div className="rounded-[20px] border border-zinc-200 bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Scaffold folders</p>
                        <p className="mt-2 text-xl font-black text-zinc-950">{Math.max(availableFolders.length - 1, 0)}</p>
                      </div>
                      <div className="rounded-[20px] border border-zinc-200 bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Sources in view</p>
                        <p className="mt-2 text-xl font-black text-zinc-950">{filteredSources.length}</p>
                      </div>
                      <div className="rounded-[20px] border border-zinc-200 bg-white px-4 py-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Cited sources</p>
                        <p className="mt-2 text-xl font-black text-zinc-950">
                          {(activeProject.sources || []).filter((source) => source.status === 'cited').length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <NotebookPen className="h-5 w-5 text-slate-600" />
                      <h2 className="text-xl font-black text-zinc-950">Working outline</h2>
                    </div>
                    <textarea
                      value={activeProject.workingOutline || ''}
                      onChange={(event) => patchProject({ workingOutline: event.target.value })}
                      className="mt-4 min-h-[180px] w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-slate-400"
                      placeholder="Plan the report structure, sections, claims, and where evidence belongs."
                    />
                  </div>

                  <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-5 w-5 text-blue-600" />
                      <h2 className="text-xl font-black text-zinc-950">Evidence map</h2>
                    </div>
                    <textarea
                      value={activeProject.evidenceMap || ''}
                      onChange={(event) => patchProject({ evidenceMap: event.target.value })}
                      className="mt-4 min-h-[180px] w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-blue-400"
                      placeholder="Map claims to sources, counterarguments, data gaps, and what still needs verification."
                    />
                  </div>

                  <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-5 w-5 text-violet-600" />
                      <h2 className="text-xl font-black text-zinc-950">Synthesis notes</h2>
                    </div>
                    <textarea
                      value={activeProject.synthesisNotes || ''}
                      onChange={(event) => patchProject({ synthesisNotes: event.target.value })}
                      className="mt-4 min-h-[220px] w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-violet-400"
                      placeholder="Capture themes, contradictions, evidence gaps, and your working thesis."
                    />
                    <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-zinc-500">
                      <Save size={13} />
                      {saving ? 'Saving…' : 'Autosaves to your university research desk'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <FileSearch className="h-5 w-5 text-amber-600" />
                    <h2 className="text-xl font-black text-zinc-950">Open questions and gaps</h2>
                  </div>
                  <textarea
                    value={activeProject.openQuestions || ''}
                    onChange={(event) => patchProject({ openQuestions: event.target.value })}
                    className="mt-4 min-h-[180px] w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-amber-400"
                    placeholder="Track unresolved questions, missing evidence, supervisor follow-ups, and next research moves."
                  />
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <Pencil className="h-5 w-5 text-cyan-600" />
                    <h2 className="text-xl font-black text-zinc-950">Method and approach</h2>
                  </div>
                  <textarea
                    value={activeProject.methodologyNotes || ''}
                    onChange={(event) => patchProject({ methodologyNotes: event.target.value })}
                    className="mt-4 min-h-[180px] w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-cyan-400"
                    placeholder="Track methods, frameworks, datasets, models, and how you will approach the research."
                  />
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <Quote className="h-5 w-5 text-rose-600" />
                    <h2 className="text-xl font-black text-zinc-950">Supervisor notes and next actions</h2>
                  </div>
                  <textarea
                    value={activeProject.supervisorNotes || ''}
                    onChange={(event) => patchProject({ supervisorNotes: event.target.value })}
                    className="mt-4 min-h-[84px] w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-rose-400"
                    placeholder="Record supervisor guidance, tutorial notes, or feedback checkpoints."
                  />
                  <textarea
                    value={activeProject.nextActions || ''}
                    onChange={(event) => patchProject({ nextActions: event.target.value })}
                    className="mt-4 min-h-[84px] w-full rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-800 outline-none transition focus:border-rose-400"
                    placeholder="List the next concrete actions for the research task."
                  />
                </div>
              </div>
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center">
            <Quote className="mx-auto h-8 w-8 text-zinc-300" />
            <h2 className="mt-4 text-2xl font-black text-zinc-900">Create your first research desk</h2>
            <p className="mt-2 text-zinc-500">Set a question, collect sources, and build a real literature workflow.</p>
          </div>
        )}
      </div>
    </div>
  );
}
