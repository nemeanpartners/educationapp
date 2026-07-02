import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, NotebookPen, Folder, FileText, ChevronLeft, ChevronRight, ChevronDown, Pencil, Sparkles, Loader2, ExternalLink, Brain, Target, Upload } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from '@/lib/portal-firestore';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { replaceInlineImagesWithStorageUrls, uploadEditorImage } from '../lib/editor-images';
import { geminiService, type LectureLiftResponse } from '../services/gemini';
import { geminiGenerateContent } from '../services/geminiProxy';
import { saveFlashcardSet } from '../lib/flashcards-storage';
import { savePracticeQuiz } from '../lib/practice-quiz-storage';
import { getOrCreateCachedAiResult } from '../lib/ai-result-cache';
import { detectStudentPortalFromPath, studentPortalToolPath } from '../lib/portal';

type Notebook = {
  id: string;
  title: string;
  userId: string;
  createdAt?: any;
};

type Section = {
  id: string;
  title: string;
  notebookId: string;
  userId: string;
  createdAt?: any;
};

type Page = {
  id: string;
  title: string;
  sectionId: string;
  userId: string;
  content: string;
  updatedAt?: any;
  createdAt?: any;
};

interface ClassNotesPageProps {
  initialTool?: 'lecture-lift';
  universityMode?: boolean;
}

export default function ClassNotesPage({ initialTool, universityMode = false }: ClassNotesPageProps = {}) {
  const { isPhone } = useResponsiveDevice();
  const navigate = useNavigate();
  const activePortal = detectStudentPortalFromPath(window.location.pathname);
  const [searchParams, setSearchParams] = useSearchParams();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [pageContent, setPageContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [panelMode, setPanelMode] = useState<'notebooks' | 'sections' | 'pages' | 'editor'>('notebooks');
  const [editingType, setEditingType] = useState<'notebook' | 'section' | 'page' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isNotebookMenuCollapsed, setIsNotebookMenuCollapsed] = useState(false);
  const [isLectureLiftOpen, setIsLectureLiftOpen] = useState(false);
  const [isLecturePagePickerOpen, setIsLecturePagePickerOpen] = useState(false);
  const [lectureTranscript, setLectureTranscript] = useState('');
  const [isLectureLiftLoading, setIsLectureLiftLoading] = useState(false);
  const [lectureLiftResult, setLectureLiftResult] = useState<LectureLiftResponse | null>(null);
  const [lectureLiftError, setLectureLiftError] = useState<string | null>(null);
  const [lectureSourceName, setLectureSourceName] = useState('');
  const [isLectureSourceLoading, setIsLectureSourceLoading] = useState(false);
  const [lectureLiftOutputTitle, setLectureLiftOutputTitle] = useState('');
  const [lectureLiftFlashcardsSaved, setLectureLiftFlashcardsSaved] = useState(false);
  const [lectureLiftQuizSaved, setLectureLiftQuizSaved] = useState(false);
  const [lectureLiftQuizMessage, setLectureLiftQuizMessage] = useState<string | null>(null);
  const editorRef = useRef<ReactQuill | null>(null);
  const imagePickerRef = useRef<HTMLInputElement | null>(null);
  const isPickingImageRef = useRef(false);
  const lectureFileInputRef = useRef<HTMLInputElement | null>(null);
  const lectureLiftSuggestedTitleRef = useRef('');

  useEffect(() => {
    let unsubNotebooks = () => {};
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setNotebooks([]);
        setSections([]);
        setPages([]);
        setActiveNotebookId(null);
        setActiveSectionId(null);
        setActivePageId(null);
        return;
      }

      const q = query(
        collection(db, 'classNotesNotebooks'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'asc')
      );
      unsubNotebooks = onSnapshot(q, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Notebook[];
        setNotebooks(items);
      });
    });
    return () => {
      unsubAuth();
      unsubNotebooks();
    };
  }, [activeNotebookId]);

  useEffect(() => {
    if (!activeNotebookId) {
      setSections([]);
      setActiveSectionId(null);
      return;
    }

    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, 'classNotesSections'),
      where('userId', '==', user.uid),
      where('notebookId', '==', activeNotebookId),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Section[];
      setSections(items);
    });
    return () => unsub();
  }, [activeNotebookId, activeSectionId]);

  useEffect(() => {
    if (!activeSectionId) {
      setPages([]);
      setActivePageId(null);
      setPageTitle('');
      setPageContent('');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, 'classNotesPages'),
      where('userId', '==', user.uid),
      where('sectionId', '==', activeSectionId),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Page[];
      setPages(items);
    });
    return () => unsub();
  }, [activeSectionId, activePageId]);

  useEffect(() => {
    const active = pages.find(p => p.id === activePageId);
    if (!active) return;
    setPageTitle(active.title || 'Untitled Page');
    setPageContent(active.content || '');
  }, [activePageId, pages]);

  useEffect(() => {
    if (!activeNotebookId) {
      setPanelMode('notebooks');
      return;
    }
    if (activeNotebookId && !activeSectionId) {
      setPanelMode('sections');
      return;
    }
    if (activeSectionId && !activePageId) {
      setPanelMode('pages');
      return;
    }
    if (activePageId) {
      setPanelMode('editor');
    }
  }, [activeNotebookId, activeSectionId, activePageId]);

  useEffect(() => {
    if (initialTool === 'lecture-lift' || searchParams.get('tool') === 'lecture-lift') {
      setIsLectureLiftOpen(true);
    }
  }, [initialTool, searchParams]);

  useEffect(() => {
    if (!activePageId) return;
    const timeout = setTimeout(async () => {
      const user = auth.currentUser;
      if (!user) return;
      setSaving(true);
      try {
        const nextContent = await replaceInlineImagesWithStorageUrls(pageContent, {
          userId: user.uid,
          scope: `class-notes/${activePageId}`,
        });
        if (nextContent !== pageContent) {
          setPageContent(nextContent);
        }
        await updateDoc(doc(db, 'classNotesPages', activePageId), {
          title: pageTitle || 'Untitled Page',
          content: nextContent,
          updatedAt: serverTimestamp(),
        });
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [pageTitle, pageContent, activePageId]);

  const insertImageFromFile = () => {
    const editor = editorRef.current?.getEditor?.();
    const user = auth.currentUser;
    if (!editor || !user || !activePageId) return;
    if (isPickingImageRef.current) return;
    isPickingImageRef.current = true;
    let input = imagePickerRef.current;
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      imagePickerRef.current = input;
      input.onchange = async () => {
        const file = input?.files?.[0];
        if (!file) {
          isPickingImageRef.current = false;
          return;
        }
        try {
          const uploadUrl = await uploadEditorImage({
            userId: user.uid,
            scope: `class-notes/${activePageId}`,
            file,
          });
          const range = editor.getSelection();
          const index = range ? range.index : editor.getLength();
          editor.insertEmbed(index, 'image', uploadUrl, 'user');
          editor.setSelection(index + 1, 0);
        } catch (error) {
          console.error('Class notes image upload failed:', error);
        } finally {
          if (input) input.value = '';
          isPickingImageRef.current = false;
        }
      };
    }
    input.value = '';
    input.click();
    window.setTimeout(() => {
      if (input && !input.files?.length) {
        isPickingImageRef.current = false;
      }
    }, 500);
  };

  const quillModules = useMemo(() => ({
    toolbar: {
      container: '#class-notes-toolbar',
      handlers: {
        image: insertImageFromFile,
      },
    },
  }), [activePageId]);

  const createNotebook = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const ref = await addDoc(collection(db, 'classNotesNotebooks'), {
      userId: user.uid,
      title: 'New Notebook',
      createdAt: serverTimestamp(),
    });
    setActiveNotebookId(ref.id);
  };

  const createSection = async () => {
    const user = auth.currentUser;
    if (!user || !activeNotebookId) return;
    const ref = await addDoc(collection(db, 'classNotesSections'), {
      userId: user.uid,
      notebookId: activeNotebookId,
      title: 'New Section',
      createdAt: serverTimestamp(),
    });
    setActiveSectionId(ref.id);
  };

  const createPage = async () => {
    const user = auth.currentUser;
    if (!user || !activeSectionId) return;
    const ref = await addDoc(collection(db, 'classNotesPages'), {
      userId: user.uid,
      sectionId: activeSectionId,
      title: 'Untitled Page',
      content: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setActivePageId(ref.id);
  };

  const activeNotebook = useMemo(() => notebooks.find(n => n.id === activeNotebookId), [notebooks, activeNotebookId]);
  const activeSection = useMemo(() => sections.find(s => s.id === activeSectionId), [sections, activeSectionId]);
  const activePage = useMemo(() => pages.find(p => p.id === activePageId), [pages, activePageId]);

  const plainTextFromHtml = (html: string) => {
    if (!html) return '';
    if (typeof window === 'undefined') return html;
    const container = document.createElement('div');
    container.innerHTML = html;
    return container.textContent || container.innerText || '';
  };

  const escapeHtml = (value: string) => (
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );

  const lectureLiftTextToHtml = (title: string, body: string, bullets: string[]) => {
    const noteParagraphs = body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const bulletHtml = bullets.length
      ? `<h2>Key Takeaways</h2><ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>`
      : '';

    return `<h1>${escapeHtml(title)}</h1>${bulletHtml}${noteParagraphs}`;
  };

  const lectureLiftQuestionsToHtml = (questions: string[]) => {
    if (!questions.length) return '';
    return `<h2>Practice Questions</h2><ol>${questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ol>`;
  };

  const formatLectureLiftErrorMessage = (error: unknown) => {
    if (!(error instanceof Error)) {
      return 'Lecture Lift could not enhance these notes right now. Try again in a moment.';
    }

    const raw = error.message || '';
    try {
      const parsed = JSON.parse(raw);
      const message = parsed?.error?.message || parsed?.message;
      if (typeof message === 'string' && message.trim()) {
        if (/PERMISSION_DENIED/i.test(message)) {
          return 'Lecture Lift could not reach the AI service, so a fallback summary was used instead.';
        }
        return message.trim();
      }
    } catch {
      // Ignore non-JSON error payloads.
    }

    return raw || 'Lecture Lift could not enhance these notes right now. Try again in a moment.';
  };

  const getLectureLiftSuggestedTitle = (baseTitle?: string) => `${baseTitle || 'Enhanced Notes'} · Lecture Lift`;

  const readFileAsDataUrl = (file: File) => (
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read the uploaded file.'));
      reader.readAsDataURL(file);
    })
  );

  const inlineDataFromDataUrl = (dataUrl: string) => {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid uploaded file format.');
    }
    return {
      mimeType: match[1],
      data: match[2],
    };
  };

  const isOfficeTranscriptFile = (file: File) => {
    const mimeType = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      name.endsWith('.docx') ||
      name.endsWith('.pptx')
    );
  };

  const extractLectureSourceText = async (file: File) => {
    const loweredName = file.name.toLowerCase();
    if (loweredName.endsWith('.txt') || file.type === 'text/plain') {
      return await file.text();
    }

    if (isOfficeTranscriptFile(file)) {
      const fileDataUrl = await readFileAsDataUrl(file);
      return getOrCreateCachedAiResult(
        {
          scope: 'lecture-lift-document-text',
          input: {
            fileName: file.name,
            mimeType: file.type,
            fileDataUrl,
          },
        },
        async () => {
          const response = await fetch('/api/document-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataUrl: fileDataUrl,
              fileName: file.name,
              mimeType: file.type,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.error || 'Could not read the uploaded file.');
          }
          return String(data?.text || '').trim();
        },
      );
    }

    const fileDataUrl = await readFileAsDataUrl(file);
    return getOrCreateCachedAiResult(
      {
        scope: 'lecture-lift-document-extraction',
        input: {
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
                  text: `Extract the readable lecture content from this file for Lecture Lift.

Rules:
- Return plain text only.
- Preserve headings, dot points, key definitions, formulas, and examples when present.
- Remove decoration, duplicate headers/footers, and navigation junk.
- Keep the output suitable to merge with a student's rough notes.`,
                },
                { inlineData: inlineDataFromDataUrl(fileDataUrl) },
              ],
            },
          ],
        });
        return String(response.text || '').trim();
      },
    );
  };

  const openLectureLift = () => {
    setLectureLiftError(null);
    setLectureLiftResult(null);
    setIsLecturePagePickerOpen(!activePageId);
    setLectureLiftFlashcardsSaved(false);
    setLectureLiftQuizSaved(false);
    setLectureLiftQuizMessage(null);
    const suggestedTitle = getLectureLiftSuggestedTitle(pageTitle || activePage?.title || 'Enhanced Notes');
    lectureLiftSuggestedTitleRef.current = suggestedTitle;
    setLectureLiftOutputTitle(suggestedTitle);
    setIsLectureLiftOpen(true);
    setSearchParams({ tool: 'lecture-lift' });
  };

  const closeLectureLift = () => {
    setIsLectureLiftOpen(false);
    setLectureLiftError(null);
    setIsLecturePagePickerOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tool');
    setSearchParams(nextParams);
  };

  const handleLectureSourceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLectureLiftError(null);
      setIsLectureSourceLoading(true);
      setLectureSourceName(file.name);
      const extractedText = await extractLectureSourceText(file);
      if (!extractedText) {
        throw new Error('The uploaded file did not contain readable lecture text.');
      }
      setLectureTranscript(extractedText);
    } catch (error) {
      console.error('Lecture source upload failed:', error);
      setLectureLiftError(error instanceof Error ? error.message : 'Could not read the uploaded lecture file.');
      setLectureSourceName('');
    } finally {
      setIsLectureSourceLoading(false);
      event.target.value = '';
    }
  };

  const generateLectureLift = async () => {
    const user = auth.currentUser;
    const rawNotes = plainTextFromHtml(pageContent).trim();
    if (!user || !activeSectionId || !activePageId) {
      setLectureLiftError('Open a class notes page first.');
      return;
    }
    if (!rawNotes) {
      setLectureLiftError('Add your lecture notes to this page before using Lecture Lift.');
      return;
    }
    if (!lectureTranscript.trim()) {
      setLectureLiftError('Paste the lecture transcript so Lecture Lift can fill the gaps.');
      return;
    }

    setIsLectureLiftLoading(true);
    setLectureLiftError(null);
    try {
      const result = await geminiService.lectureLift({
        pageTitle: pageTitle || activePage?.title || 'Lecture Notes',
        shorthandNotes: rawNotes,
        transcript: lectureTranscript.trim(),
      });
      setLectureLiftResult(result);
      if (!lectureLiftOutputTitle.trim() || lectureLiftOutputTitle === lectureLiftSuggestedTitleRef.current) {
        const suggestedTitle = getLectureLiftSuggestedTitle(result.title || pageTitle || activePage?.title || 'Enhanced Notes');
        lectureLiftSuggestedTitleRef.current = suggestedTitle;
        setLectureLiftOutputTitle(suggestedTitle);
      }
    } catch (error) {
      console.error('Lecture Lift failed:', error);
      setLectureLiftError(formatLectureLiftErrorMessage(error));
    } finally {
      setIsLectureLiftLoading(false);
    }
  };

  const createLectureLiftPage = async () => {
    const user = auth.currentUser;
    if (!user || !activeSectionId || !lectureLiftResult) return;
    const outputTitle = lectureLiftOutputTitle.trim() || getLectureLiftSuggestedTitle(lectureLiftResult.title || pageTitle || activePage?.title || 'Enhanced Notes');
    const html = lectureLiftTextToHtml(
      outputTitle,
      lectureLiftResult.enhancedNotes,
      lectureLiftResult.summaryBullets,
    );
    const ref = await addDoc(collection(db, 'classNotesPages'), {
      userId: user.uid,
      sectionId: activeSectionId,
      title: outputTitle,
      content: html,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setActivePageId(ref.id);
    closeLectureLift();
  };

  const createLectureLiftPageWithQuestions = async () => {
    const user = auth.currentUser;
    if (!user || !activeSectionId || !lectureLiftResult) return;
    const outputTitle = lectureLiftOutputTitle.trim() || getLectureLiftSuggestedTitle(lectureLiftResult.title || pageTitle || activePage?.title || 'Enhanced Notes');
    const html = `${lectureLiftTextToHtml(
      outputTitle,
      lectureLiftResult.enhancedNotes,
      lectureLiftResult.summaryBullets,
    )}${lectureLiftQuestionsToHtml(lectureLiftResult.suggestedQuestions)}`;
    const ref = await addDoc(collection(db, 'classNotesPages'), {
      userId: user.uid,
      sectionId: activeSectionId,
      title: outputTitle,
      content: html,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setActivePageId(ref.id);
    closeLectureLift();
  };

  const replaceCurrentWithLectureLift = async () => {
    if (!activePageId || !lectureLiftResult) return;
    const outputTitle = lectureLiftOutputTitle.trim() || getLectureLiftSuggestedTitle(lectureLiftResult.title || pageTitle || activePage?.title || 'Enhanced Notes');
    const html = lectureLiftTextToHtml(
      outputTitle,
      lectureLiftResult.enhancedNotes,
      lectureLiftResult.summaryBullets,
    );
    setPageContent(html);
    setPageTitle(outputTitle);
    await updateDoc(doc(db, 'classNotesPages', activePageId), {
      title: outputTitle,
      content: html,
      updatedAt: serverTimestamp(),
    });
    closeLectureLift();
  };

  const saveLectureLiftFlashcards = async () => {
    const user = auth.currentUser;
    if (!user || !lectureLiftResult?.flashcards?.length) return;
    await saveFlashcardSet({
      userId: user.uid,
      title: `${pageTitle || activePage?.title || 'Lecture Notes'} Flashcards`,
      description: `Lecture Lift flashcards for ${pageTitle || activePage?.title || 'Class Notes'}`,
      cards: lectureLiftResult.flashcards,
      createdAt: new Date().toISOString(),
    });
    setLectureLiftFlashcardsSaved(true);
  };

  const openLibrarySearch = (keyword: string) => {
    navigate(`${studentPortalToolPath(activePortal, 'library')}?q=${encodeURIComponent(keyword)}`);
  };

  const openResourceSearch = (keyword: string) => {
    navigate(`${studentPortalToolPath(activePortal, 'resources')}?q=${encodeURIComponent(keyword)}`);
  };

  const saveLectureLiftQueuedQuiz = (topic: string, seededQuestions?: string[]) => {
    const savedQuiz = savePracticeQuiz({
      title: `${topic} Quiz`,
      topic,
      subject: 'General',
      instructions: 'Saved from Lecture Lift.',
      sourceText: [lectureLiftResult?.enhancedNotes || '', ...(lectureLiftResult?.summaryBullets || [])].join('\n\n'),
      questions: (seededQuestions?.length ? seededQuestions : [topic]).map((question, index) => ({
        question,
        options: [
          'Review your notes and answer this question.',
          'Use transcript evidence to support your answer.',
        ],
        correctAnswer: 'Review your notes and answer this question.',
        explanation: `Saved from Lecture Lift prompt ${index + 1}.`,
      })),
    });
    setLectureLiftQuizSaved(true);
    setLectureLiftQuizMessage(`Quiz saved. Open Practice Quiz later with saved set ${savedQuiz.title}.`);
    return savedQuiz;
  };

  const openPracticeQuiz = (topic: string) => {
    saveLectureLiftQueuedQuiz(topic, [topic]);
  };

  const saveLectureLiftPracticeQuiz = () => {
    if (!lectureLiftResult?.suggestedQuestions?.length) return;
    saveLectureLiftQueuedQuiz(
      lectureLiftResult.title || pageTitle || activePage?.title || 'Lecture Lift',
      lectureLiftResult.suggestedQuestions,
    );
  };

  useEffect(() => {
    if (!isLectureLiftOpen) return;
    const suggestedTitle = getLectureLiftSuggestedTitle(pageTitle || activePage?.title || 'Enhanced Notes');
    if (!lectureLiftOutputTitle.trim() || lectureLiftOutputTitle === lectureLiftSuggestedTitleRef.current) {
      lectureLiftSuggestedTitleRef.current = suggestedTitle;
      setLectureLiftOutputTitle(suggestedTitle);
    }
  }, [isLectureLiftOpen, activePageId, pageTitle, activePage?.title]);

  const beginRename = (type: 'notebook' | 'section' | 'page', id: string, current: string) => {
    setEditingType(type);
    setEditingId(id);
    setEditingValue(current);
  };

  const commitRename = async () => {
    if (!editingType || !editingId) return;
    const nextTitle = editingValue.trim();
    if (!nextTitle) {
      setEditingType(null);
      setEditingId(null);
      return;
    }
    const collectionName =
      editingType === 'notebook'
        ? 'classNotesNotebooks'
        : editingType === 'section'
        ? 'classNotesSections'
        : 'classNotesPages';
    await updateDoc(doc(db, collectionName, editingId), {
      title: nextTitle,
      updatedAt: serverTimestamp(),
    });
    setEditingType(null);
    setEditingId(null);
  };

  return (
    <div className={cn("w-full max-w-none space-y-6", isPhone ? "p-4" : "p-8")}>
      <div className={cn("flex justify-between", isPhone ? "items-start gap-3" : "items-center")}>
        <div className={cn("flex", isPhone ? "items-start gap-2.5" : "items-center gap-3")}>
          <div className={cn("rounded-2xl bg-indigo-50 text-indigo-600", isPhone ? "p-2.5" : "p-3")}>
            <NotebookPen className={cn(isPhone ? "h-5 w-5" : "h-6 w-6")} />
          </div>
          <div className="min-w-0">
            <h1 className={cn("font-black text-zinc-900", isPhone ? "text-[2.2rem] leading-[0.9]" : "text-3xl")}>Class Notes</h1>
            <p className={cn("text-zinc-500", isPhone ? "mt-1 max-w-[11rem] text-sm leading-5" : "text-sm")}>Organize notebooks, sections, and pages like OneNote.</p>
            <div className={cn("mt-2 flex flex-wrap items-center", isPhone ? "gap-1.5 text-[11px]" : "gap-2 text-xs")}>
              <button
                onClick={() => {
                  setPanelMode('notebooks');
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border shadow-sm transition",
                  isPhone ? "px-3 py-1.5 text-[11px]" : "px-4 py-1.5 text-xs",
                  activeNotebook
                    ? "bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200"
                    : "bg-zinc-100 text-zinc-500 border-zinc-200"
                )}
              >
                {activeNotebook?.title || 'No notebook'}
              </button>
              <button
                onClick={() => {
                  if (!activeNotebookId) return;
                  setPanelMode('sections');
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border shadow-sm transition",
                  isPhone ? "px-3 py-1.5 text-[11px]" : "px-4 py-1.5 text-xs",
                  activeSection
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200"
                    : "bg-zinc-100 text-zinc-500 border-zinc-200"
                )}
                disabled={!activeNotebookId}
              >
                {activeSection?.title || 'No section'}
              </button>
              <button
                onClick={() => {
                  if (!activeSectionId) return;
                  setPanelMode('pages');
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border shadow-sm transition",
                  isPhone ? "px-3 py-1.5 text-[11px]" : "px-4 py-1.5 text-xs",
                  activePage
                    ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200"
                    : "bg-zinc-100 text-zinc-500 border-zinc-200"
                )}
                disabled={!activeSectionId}
              >
                {activePage?.title || 'No page'}
              </button>
            </div>
          </div>
        </div>
        <div className={cn("flex", isPhone ? "flex-col gap-2" : "items-center gap-3")}>
          <button
            onClick={openLectureLift}
            disabled={!activePageId}
            className={cn(
              "rounded-xl border font-bold flex items-center gap-2 transition",
              isPhone ? "px-3 py-2 text-sm" : "px-4 py-2 text-sm",
              activePageId
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-zinc-200 bg-zinc-100 text-zinc-400"
            )}
            title="Merge your shorthand notes with a lecture transcript"
          >
            <Sparkles className="h-4 w-4" />
            {isPhone ? 'Lift' : 'Lecture Lift'}
          </button>
          <button
            onClick={() => setIsNotebookMenuCollapsed((prev) => !prev)}
            className={cn(
              "rounded-xl border border-zinc-200 bg-white text-zinc-700 font-bold flex items-center gap-2 hover:bg-zinc-50",
              isPhone ? "px-3 py-2 text-sm" : "px-3 py-2 text-sm"
            )}
            title={isNotebookMenuCollapsed ? 'Expand notebooks menu' : 'Collapse notebooks menu'}
          >
            {isNotebookMenuCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {isPhone ? 'Menu' : isNotebookMenuCollapsed ? 'Expand Menu' : 'Collapse Menu'}
          </button>
          <button
            onClick={createNotebook}
            className={cn(
              "rounded-xl bg-zinc-900 text-white font-bold flex items-center gap-2",
              isPhone ? "px-3 py-2 text-sm" : "px-4 py-2 text-sm"
            )}
          >
            <Plus className="h-4 w-4" />
            {isPhone ? 'New' : 'New Notebook'}
          </button>
        </div>
      </div>

      {isLectureLiftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4">
          <div className={cn("flex w-full min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl", isPhone ? "max-h-[92vh]" : "max-h-[88vh] max-w-6xl")}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                  {universityMode ? 'University Lecture Tool' : 'Class Notes Tool'}
                </p>
                <h2 className="text-2xl font-black tracking-tight text-zinc-900">Lecture Lift</h2>
                <p className="mt-1 text-sm font-medium text-zinc-500">
                  {universityMode
                    ? 'Merge lecture notes with transcript context, then branch into references, flashcards, and university-level revision.'
                    : 'Merge your shorthand notes with the lecture transcript, then branch into flashcards, resources, and exam practice.'}
                </p>
              </div>
              <button
                onClick={closeLectureLift}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-500 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>

            <div className={cn("grid min-h-0 flex-1 gap-0 overflow-y-auto overflow-x-hidden", isPhone ? "grid-cols-1 p-4" : "grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]")}>
              <div className={cn("flex min-h-0 min-w-0 flex-col gap-4 overflow-x-hidden", isPhone ? "" : "border-r border-zinc-100 p-6")}>
                <div className="min-w-0 rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Current Page</p>
                      <p className="mt-2 truncate text-base font-black text-zinc-900">{pageTitle || activePage?.title || 'No page selected'}</p>
                    </div>
                    <button
                      onClick={() => setIsLecturePagePickerOpen((prev) => !prev)}
                      className="shrink-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-600 hover:bg-zinc-50"
                    >
                      {activePageId ? 'Select' : 'Select Page'}
                    </button>
                  </div>
                  <p className="mt-2 max-h-16 overflow-y-auto whitespace-pre-wrap break-words text-xs font-medium leading-5 text-zinc-600">
                    {plainTextFromHtml(pageContent).trim() || 'Choose a Class Notes page to use as the base note.'}
                  </p>
                  {isLecturePagePickerOpen && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="min-w-0">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Notebook</label>
                        <select
                          value={activeNotebookId || ''}
                          onChange={(e) => {
                            const nextNotebookId = e.target.value || null;
                            setActiveNotebookId(nextNotebookId);
                            setActiveSectionId(null);
                            setActivePageId(null);
                          }}
                          className="min-w-0 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-emerald-400"
                        >
                          <option value="">Select notebook</option>
                          {notebooks.map((notebook) => (
                            <option key={notebook.id} value={notebook.id}>{notebook.title}</option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Section</label>
                        <select
                          value={activeSectionId || ''}
                          onChange={(e) => {
                            const nextSectionId = e.target.value || null;
                            setActiveSectionId(nextSectionId);
                            setActivePageId(null);
                          }}
                          className="min-w-0 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-emerald-400"
                          disabled={!activeNotebookId}
                        >
                          <option value="">Select section</option>
                          {sections.map((section) => (
                            <option key={section.id} value={section.id}>{section.title}</option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Page</label>
                        <select
                          value={activePageId || ''}
                          onChange={(e) => setActivePageId(e.target.value || null)}
                          className="min-w-0 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-bold text-zinc-800 outline-none focus:border-emerald-400"
                          disabled={!activeSectionId}
                        >
                          <option value="">Select page</option>
                          {pages.map((page) => (
                            <option key={page.id} value={page.id}>{page.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-w-0 rounded-3xl border border-zinc-200 bg-white p-4">
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                    Enhanced Note Title
                  </label>
                  <input
                    value={lectureLiftOutputTitle}
                    onChange={(e) => setLectureLiftOutputTitle(e.target.value)}
                    placeholder="Type the Class Notes title for the enhanced note..."
                    className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div className="min-w-0 rounded-3xl border border-zinc-200 bg-white p-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                        Lecture Source
                      </label>
                      <p className="mt-1 text-sm font-semibold text-zinc-500">Paste transcript text or upload a lecture file.</p>
                    </div>
                    <button
                      onClick={() => lectureFileInputRef.current?.click()}
                      disabled={isLectureSourceLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLectureSourceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload PDF or PPTX
                    </button>
                    <input
                      ref={lectureFileInputRef}
                      type="file"
                      accept=".pdf,.pptx,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={handleLectureSourceUpload}
                      className="hidden"
                    />
                  </div>
                  <div className="mt-3 truncate rounded-2xl bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-500">
                    {lectureSourceName ? `Loaded source: ${lectureSourceName}` : 'Supported files: PDF, PPTX, DOCX, TXT'}
                  </div>
                  <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                    Lecture Transcript
                  </label>
                  <textarea
                    value={lectureTranscript}
                    onChange={(e) => setLectureTranscript(e.target.value)}
                    placeholder="Paste the full lecture transcript here or upload a lecture file above..."
                    className="mt-2 min-h-[220px] max-h-[320px] w-full resize-y rounded-3xl border border-zinc-200 bg-white px-4 py-4 text-sm font-medium leading-6 text-zinc-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                {lectureLiftError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {lectureLiftError}
                  </div>
                )}

                <div className="mt-auto flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={generateLectureLift}
                    disabled={isLectureLiftLoading || isLectureSourceLoading}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
                  >
                    {isLectureLiftLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Enhance My Notes
                  </button>
                  <button
                    onClick={closeLectureLift}
                    className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm font-black text-zinc-600 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className={cn("min-h-0 min-w-0 space-y-4 overflow-x-hidden", isPhone ? "" : "overflow-y-auto p-6")}>
                {lectureLiftResult ? (
                  <>
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Enhanced Notes</p>
                      <h3 className="mt-2 text-xl font-black text-zinc-900">{lectureLiftResult.title}</h3>
                      <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-zinc-700">{lectureLiftResult.enhancedNotes}</p>
                    </div>

                    {lectureLiftResult.summaryBullets.length > 0 && (
                      <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Key Takeaways</p>
                        <ul className="mt-3 space-y-2 text-sm font-medium text-zinc-700">
                          {lectureLiftResult.summaryBullets.map((bullet, index) => (
                            <li key={`lift-bullet-${index}`} className="rounded-2xl bg-zinc-50 px-3 py-2">{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-indigo-500" />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Flashcards</p>
                        </div>
                        <div className="mt-3 space-y-2">
                          {lectureLiftResult.flashcards.slice(0, 4).map((card, index) => (
                            <div key={`lift-card-${index}`} className="rounded-2xl bg-zinc-50 px-3 py-3">
                              <p className="text-sm font-black text-zinc-900">{card.term}</p>
                              <p className="mt-1 text-xs font-medium leading-5 text-zinc-600">{card.definition}</p>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={saveLectureLiftFlashcards}
                          className="mt-3 w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700"
                        >
                          {lectureLiftFlashcardsSaved ? 'Flashcards Saved' : 'Save Flashcards'}
                        </button>
                        {lectureLiftFlashcardsSaved && (
                          <p className="mt-2 text-xs font-bold text-emerald-700">Saved to your flashcards.</p>
                        )}
                      </div>

                      <div className="rounded-3xl border border-zinc-200 bg-white p-4">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-violet-500" />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Resource Mapping</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {lectureLiftResult.keywords.map((keyword, index) => (
                            <div key={`lift-keyword-${index}`} className="flex flex-wrap gap-2">
                              <button
                                onClick={() => openLibrarySearch(keyword)}
                                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700"
                              >
                                Library: {keyword}
                              </button>
                              <button
                                onClick={() => openResourceSearch(keyword)}
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
                              >
                                Resources: {keyword}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {(lectureLiftResult.examFlags.length > 0 || lectureLiftResult.suggestedQuestions.length > 0) && (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-amber-600" />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">Question Bank Signals</p>
                        </div>
                        <div className="mt-3 space-y-3">
                          {lectureLiftResult.examFlags.map((flag, index) => (
                            <div key={`lift-flag-${index}`} className="rounded-2xl bg-white/85 px-3 py-3">
                              <p className="text-sm font-black text-zinc-900">{flag.topic}</p>
                              <p className="mt-1 text-xs font-medium leading-5 text-zinc-600">{flag.whyItMatters}</p>
                              <p className="mt-2 text-xs font-bold text-amber-700">{flag.suggestedQuestion}</p>
                              <button
                                onClick={() => openPracticeQuiz(flag.topic)}
                                className="mt-3 rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white hover:bg-amber-600"
                              >
                                Save Practice Quiz
                              </button>
                            </div>
                          ))}
                          {lectureLiftResult.suggestedQuestions.length > 0 && (
                            <div className="rounded-2xl bg-white/80 px-3 py-3">
                              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Suggested Questions</p>
                              <ul className="mt-2 space-y-2 text-sm font-medium text-zinc-700">
                                {lectureLiftResult.suggestedQuestions.map((question, index) => (
                                  <li key={`lift-question-${index}`}>{question}</li>
                                ))}
                              </ul>
                              <button
                                onClick={saveLectureLiftPracticeQuiz}
                                className="mt-3 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-black text-white hover:bg-zinc-800"
                              >
                                {lectureLiftQuizSaved ? 'Quiz Saved' : 'Save Quiz'}
                              </button>
                              {lectureLiftQuizMessage && (
                                <p className="mt-2 text-xs font-bold text-emerald-700">{lectureLiftQuizMessage}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={createLectureLiftPage}
                        className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white hover:bg-zinc-800"
                      >
                        Create Enhanced Copy
                      </button>
                      <button
                        onClick={createLectureLiftPageWithQuestions}
                        className="flex-1 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white hover:bg-amber-600"
                      >
                        Create Copy With Questions
                      </button>
                      <button
                        onClick={replaceCurrentWithLectureLift}
                        className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-50"
                      >
                        Replace Current Page
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 px-6 text-center">
                    <Sparkles className="h-9 w-9 text-emerald-500" />
                    <h3 className="mt-4 text-2xl font-black text-zinc-900">Lecture Lift is ready</h3>
                    <p className="mt-2 max-w-md text-sm font-medium leading-6 text-zinc-500">
                      Paste the transcript on the left, then Lecture Lift will expand your shorthand into revision-ready notes and branch it into flashcards, resources, and exam practice.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={cn(
        "grid grid-cols-1 gap-6 w-full max-w-none items-start",
        isPhone ? "" : isNotebookMenuCollapsed ? "lg:grid-cols-[74px_1fr]" : "lg:grid-cols-[260px_1fr]"
      )}>
        <div className={cn(
          "bg-white rounded-3xl border border-zinc-200 w-full max-w-none overflow-auto",
          isPhone ? "max-h-[520px] p-3" : "lg:sticky lg:top-6 h-[680px]",
          isNotebookMenuCollapsed ? "p-2" : "p-4"
        )}>
          <div className="flex items-center justify-between mb-4">
            {!isNotebookMenuCollapsed ? (
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Notebooks</h3>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Menu</span>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNotebookMenuCollapsed((prev) => !prev)}
                className="text-zinc-400 hover:text-zinc-900"
                title={isNotebookMenuCollapsed ? 'Expand notebooks menu' : 'Collapse notebooks menu'}
              >
                {isNotebookMenuCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
              <button onClick={createNotebook} className="text-zinc-400 hover:text-zinc-900">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {isNotebookMenuCollapsed && (
            <div className="space-y-2">
              {notebooks.map((nb) => (
                <button
                  key={nb.id}
                  onClick={() => {
                    setActiveNotebookId(nb.id);
                    setActiveSectionId(null);
                    setActivePageId(null);
                    setPanelMode('sections');
                    setIsNotebookMenuCollapsed(false);
                  }}
                  className={cn(
                    "w-full h-10 rounded-xl border flex items-center justify-center",
                    activeNotebookId === nb.id
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                  )}
                  title={nb.title}
                >
                  <Folder className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}
          {!isNotebookMenuCollapsed && (
          <div className="space-y-2">
            {notebooks.map(nb => {
              const isOpen = activeNotebookId === nb.id;
              return (
                <div key={nb.id} className="rounded-2xl border border-zinc-100 bg-zinc-50/60">
                  <button
                    onClick={() => {
                      if (isOpen) {
                        setActiveNotebookId(null);
                        setActiveSectionId(null);
                        setActivePageId(null);
                        setPanelMode('notebooks');
                      } else {
                        setActiveNotebookId(nb.id);
                        setActiveSectionId(null);
                        setActivePageId(null);
                        setPanelMode('sections');
                      }
                    }}
                  className={cn(
                    "w-full text-left rounded-2xl font-black flex items-center justify-between",
                    isPhone ? "px-3 py-2.5 text-[15px]" : "px-4 py-3 text-sm",
                    isOpen ? "bg-indigo-50 text-indigo-700" : "text-zinc-700 hover:bg-zinc-100"
                  )}
                  >
                    <span className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      {editingType === 'notebook' && editingId === nb.id ? (
                        <input
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                          className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-bold w-40"
                          autoFocus
                        />
                      ) : (
                        nb.title
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          beginRename('notebook', nb.id, nb.title);
                        }}
                        className="text-zinc-400 hover:text-zinc-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Sections</span>
                        <button onClick={createSection} className="text-zinc-400 hover:text-zinc-900">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {sections.length === 0 && (
                        <p className="text-xs text-zinc-400">Add a section to {nb.title}.</p>
                      )}
                      {sections.map(sec => {
                        const isSectionOpen = activeSectionId === sec.id;
                        return (
                          <div key={sec.id} className="rounded-xl border border-zinc-100 bg-white">
                            <button
                              onClick={() => {
                                if (isSectionOpen) {
                                  setActiveSectionId(null);
                                  setActivePageId(null);
                                  setPanelMode('sections');
                                } else {
                                  setActiveSectionId(sec.id);
                                  setActivePageId(null);
                                  setPanelMode('pages');
                                }
                              }}
                            className={cn(
                                "w-full text-left rounded-xl font-bold flex items-center justify-between",
                                isPhone ? "px-3 py-2.5 text-[15px]" : "px-3 py-2 text-sm",
                                isSectionOpen ? "bg-emerald-50 text-emerald-700" : "text-zinc-700 hover:bg-zinc-50"
                              )}
                            >
                              <span>
                                {editingType === 'section' && editingId === sec.id ? (
                                  <input
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onBlur={commitRename}
                                    onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                                    className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-bold w-36"
                                    autoFocus
                                  />
                                ) : (
                                  sec.title
                                )}
                              </span>
                              <span className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    beginRename('section', sec.id, sec.title);
                                  }}
                                  className="text-zinc-400 hover:text-zinc-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                {isSectionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </span>
                            </button>
                            {isSectionOpen && (
                              <div className="px-3 pb-3 pt-2 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Pages</span>
                                  <button onClick={createPage} className="text-zinc-400 hover:text-zinc-900">
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                                {pages.length === 0 && (
                                  <p className="text-xs text-zinc-400">Add a page to {sec.title}.</p>
                                )}
                                {pages.map(pg => (
                                  <button
                                    key={pg.id}
                                    onClick={() => {
                                      setActivePageId(pg.id);
                                      setPanelMode('editor');
                                    }}
                                    className={cn(
                                      "w-full text-left rounded-lg font-bold flex items-center gap-2",
                                      isPhone ? "px-3 py-2.5 text-[13px]" : "px-3 py-2 text-xs",
                                      activePageId === pg.id ? "bg-blue-50 text-blue-700" : "hover:bg-zinc-50 text-zinc-700"
                                    )}
                                  >
                                    <FileText className="h-4 w-4" />
                                    {editingType === 'page' && editingId === pg.id ? (
                                      <input
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={commitRename}
                                        onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                                        className="bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-bold w-32"
                                        autoFocus
                                      />
                                    ) : (
                                      pg.title || 'Untitled Page'
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        beginRename('page', pg.id, pg.title || 'Untitled Page');
                                      }}
                                      className="ml-auto text-zinc-400 hover:text-zinc-700"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {notebooks.length === 0 && (
              <p className="text-xs text-zinc-400">Create your first notebook.</p>
            )}
          </div>
          )}
        </div>

        {panelMode === 'editor' && (
        <div className="w-full space-y-6">
          <div className={cn("bg-white rounded-2xl border border-zinc-200 shadow-sm", isPhone ? "px-4 py-3" : "px-6 py-4")}>
            <div className={cn("flex justify-between", isPhone ? "flex-col gap-3" : "items-center")}>
              <div className={cn("flex", isPhone ? "flex-wrap gap-2" : "items-center gap-2")}>
                <button className="px-3 py-1.5 rounded-lg bg-zinc-100 text-xs font-bold text-zinc-700">
                  Insert ▾
                </button>
                <span className="text-xs font-bold text-zinc-600">
                  {activePage?.title || 'Untitled Page'}
                </span>
                <button className="px-3 py-1.5 rounded-lg bg-zinc-100 text-xs font-bold text-zinc-700">
                  Smart Report Off
                </button>
                {!isPhone && <span className="text-xs text-zinc-400">Use highlight from the toolbar (marker icon).</span>}
              </div>
              {saving && <span className="text-xs text-zinc-400">Saving…</span>}
            </div>
            <div id="class-notes-toolbar" className={cn("ql-toolbar ql-snow rounded-xl border border-zinc-200 mt-4", isPhone && "overflow-x-auto") }>
              <span className="ql-formats">
                <select className="ql-header">
                  <option value="1"></option>
                  <option value="2"></option>
                  <option value="3"></option>
                  <option selected></option>
                </select>
              </span>
              <span className="ql-formats">
                <button className="ql-bold"></button>
                <button className="ql-italic"></button>
                <button className="ql-underline"></button>
                <button className="ql-strike"></button>
              </span>
              <span className="ql-formats">
                <select className="ql-color"></select>
                <select className="ql-background"></select>
              </span>
              <span className="ql-formats">
                <button className="ql-list" value="ordered"></button>
                <button className="ql-list" value="bullet"></button>
              </span>
              <span className="ql-formats">
                <button className="ql-link"></button>
                <button className="ql-image"></button>
                <button className="ql-formula"></button>
              </span>
              <span className="ql-formats">
                <button className="ql-clean"></button>
              </span>
            </div>
          </div>
          <div className={cn("bg-zinc-100 rounded-2xl border border-zinc-200 w-full", isPhone ? "p-3" : "p-6")}>
            <div className={cn("bg-white rounded-2xl border border-zinc-200 shadow-sm w-full", isPhone ? "min-h-[70vh] p-4" : "min-h-[1123px] p-8")}>
              <ReactQuill
                theme="snow"
                value={pageContent}
                onChange={setPageContent}
                ref={editorRef}
                modules={quillModules}
                className={cn("w-full class-notes-editor", isPhone ? "min-h-[58vh]" : "h-[calc(100%-40px)]")}
                readOnly={!activePageId}
              />
            </div>
          </div>
        </div>
        )}
        {panelMode !== 'editor' && (
        <div className={cn("bg-white rounded-3xl border border-zinc-200 w-full max-w-none flex items-center justify-center", isPhone ? "min-h-[280px] p-4" : "h-[520px] p-6")}>
          <div className="text-center space-y-3">
            <p className="text-sm font-bold text-zinc-500">Select a page to start editing.</p>
            <div className={cn("flex items-center justify-center gap-3", isPhone && "flex-wrap")}>
              <button onClick={createNotebook} className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold">New Notebook</button>
              <button onClick={createSection} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold" disabled={!activeNotebookId}>New Section</button>
              <button onClick={createPage} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold" disabled={!activeSectionId}>New Page</button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
