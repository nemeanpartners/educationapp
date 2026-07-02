import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import $ from 'jquery';
import katex from 'katex';
import Formula from 'quill/formats/formula';
import 'mathquill/build/mathquill.css';
import 'mathquill4quill/mathquill4quill.css';
import 'katex/dist/katex.min.css';
import { UserProfile, Assignment } from '../types';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy, getDocs, writeBatch, deleteField, getDoc } from '@/lib/portal-firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import {
  CheckCheck,
  FileText,
  Save,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  ChevronRight,
  History,
  Download,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Hand,
  Type,
  Eraser
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';
import { geminiService } from '../services/gemini';
import { useResponsiveDevice } from '../hooks/use-responsive-device';
import { replaceInlineImagesWithStorageUrls, uploadEditorImage } from '../lib/editor-images';
import { Document as DocxDocument, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { detectStudentPortalFromPath } from '../lib/portal';

if (typeof window !== 'undefined' && Quill) {
  (window as any).Quill = Quill;
  (window as any).katex = katex;
  (window as any).jQuery = $;
  (window as any).$ = $;
  try {
    if (!(Quill as any).__formulaFormatRegistered) {
      Quill.register('formats/formula', Formula);
      (Quill as any).__formulaFormatRegistered = true;
    }
  } catch (error) {
    console.error('Quill registration failed', error);
  }
}

interface AssignmentEditorProps {
  profile: UserProfile | null;
  variant?: 'default' | 'university-report';
}

type PenMode = 'off' | 'free-draw' | 'write-to-text' | 'drawing-pad';
type PageLayer = 'free' | 'handwriting';
type WorkbookPageDoc = {
  content: string;
  freeDrawData?: string;
  handwritingData?: string;
};

export default function WorkbookPage({ profile, variant = 'default' }: AssignmentEditorProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isPhone } = useResponsiveDevice();
  const isUniversityReport = variant === 'university-report';
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const microsoftWordWorkbookPath = activePortal === 'university'
    ? '/uni/workbooks-uni/word'
    : '/workbooks/word';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentAssignment, setCurrentAssignment] = useState<Assignment | null>(null);
  const [content, setContent] = useState('');
  const [pages, setPages] = useState<string[]>(['']);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const quillRefs = useRef<Array<ReactQuill | null>>([]);
  const [activePage, setActivePage] = useState(0);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showEquationMenu, setShowEquationMenu] = useState(false);
  const [showCaptionMenu, setShowCaptionMenu] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);
  const [equationText, setEquationText] = useState('');
  const [equationTab, setEquationTab] = useState<'symbols' | 'structures' | 'presets'>('symbols');
  const [smartReportMode, setSmartReportMode] = useState(false);
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(false);
  const [penMode, setPenMode] = useState<PenMode>('off');
  const [showPenMenu, setShowPenMenu] = useState(false);
  const [penColor, setPenColor] = useState('#1f2937');
  const [penSize, setPenSize] = useState(3);
  const [pageFreeDrawings, setPageFreeDrawings] = useState<Record<number, string>>({});
  const [pageHandwriting, setPageHandwriting] = useState<Record<number, string>>({});
  const [isConvertingHandwriting, setIsConvertingHandwriting] = useState(false);
  const [drawingPadData, setDrawingPadData] = useState('');
  const equationInputRef = useRef<HTMLInputElement | null>(null);
  const smartReportLastRef = useRef<string>('');
  const imagePickerRef = useRef<HTMLInputElement | null>(null);
  const isPickingImageRef = useRef(false);
  const pageCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const freeDrawCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const handwritingCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const drawingPadRef = useRef<HTMLCanvasElement | null>(null);
  const drawStateRef = useRef<Record<string, { isDrawing: boolean; pointerId: number | null; lastX: number; lastY: number }>>({});
  const hasInkRef = useRef<Record<string, boolean>>({});
  const isSaveInFlightRef = useRef(false);
  const queuedAutosaveRef = useRef(false);
  const lastSavedSnapshotRef = useRef('');
  const imageResizeModule = undefined;
  const mathQuillReadyRef = useRef(false);

  const buildWorkbookSnapshot = (
    nextTitle = title,
    nextPages = pages,
    nextFreeDrawings = pageFreeDrawings,
    nextHandwriting = pageHandwriting,
    nextAssignmentId: string | null = currentAssignment?.id || null,
  ) => JSON.stringify({
    title: nextTitle.trim() || 'Untitled Workbook',
    pages: nextPages,
    freeDrawings: nextFreeDrawings,
    handwriting: nextHandwriting,
    assignmentId: nextAssignmentId,
  });
  const quillModules = {
    toolbar: {
      container: "#workbook-toolbar",
      handlers: {
        header: (value: string) => {
          const editor = getActiveEditor();
          if (!editor) return;
          editor.format('header', value || false);
          const range = editor.getSelection();
          if (!range) return;
          const [line] = editor.getLine(range.index);
          if (!line) return;
          const el = line.domNode as HTMLElement;
          if (!el) return;
          if (value) {
            el.dataset.smartHeading = 'true';
            el.classList.add('smart-heading');
          } else {
            delete el.dataset.smartHeading;
            el.classList.remove('smart-heading');
          }
        },
        image: () => insertImageFromFile()
      }
    }
  } as Record<string, any>;

  useEffect(() => {
    let cancelled = false;
    const loadMathQuill = async () => {
      if (typeof window === 'undefined' || mathQuillReadyRef.current) return;
      try {
        (window as any).jQuery = $;
        (window as any).$ = $;
        await import('mathquill/build/mathquill.js');
        await import('mathquill4quill');
        if (!cancelled) {
          mathQuillReadyRef.current = true;
        }
      } catch (error) {
        console.error('MathQuill load failed', error);
      }
    };
    loadMathQuill();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'assignments'),
      where('userId', '==', profile.uid),
      orderBy('updatedAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'assignments');
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const assignmentPlanId = searchParams.get('assignmentPlanId');
    const openAssignmentId = (location.state as any)?.openAssignmentId as string | undefined;
    const loadAssignment = async (assignment: Assignment) => {
      const fetched = await fetchWorkbookPages(assignment.id);
      const fallbackPages = (assignment as any).pages && Array.isArray((assignment as any).pages)
        ? (assignment as any).pages
        : [assignment.content || ''];
      const loadedPages = fetched?.map((page) => page.content) ?? fallbackPages;
      const loadedFreeDrawings =
        fetched?.reduce<Record<number, string>>((acc, page, index) => {
          if (page.freeDrawData) acc[index] = page.freeDrawData;
          return acc;
        }, {}) || {};
      const loadedHandwriting =
        fetched?.reduce<Record<number, string>>((acc, page, index) => {
          if (page.handwritingData) acc[index] = page.handwritingData;
          return acc;
        }, {}) || {};
      setCurrentAssignment(assignment);
      setTitle(assignment.title);
      setContent(loadedPages.join('\n\n') || assignment.content || '');
      setPages(loadedPages.length ? loadedPages : ['']);
      setPageFreeDrawings(loadedFreeDrawings);
      setPageHandwriting(loadedHandwriting);
      lastSavedSnapshotRef.current = buildWorkbookSnapshot(
        assignment.title,
        loadedPages.length ? loadedPages : [''],
        loadedFreeDrawings,
        loadedHandwriting,
        assignment.id,
      );
      setActivePage(0);
    };

    const openFromParams = async () => {
      if (openAssignmentId) {
        const snap = await getDoc(doc(db, 'assignments', openAssignmentId));
        if (snap.exists()) {
          await loadAssignment({ id: snap.id, ...snap.data() } as Assignment);
          return;
        }
      }
      if (assignmentPlanId) {
        const q = query(
          collection(db, 'assignments'),
          where('userId', '==', profile.uid),
          where('assignmentPlanId', '==', assignmentPlanId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          await loadAssignment({ id: snap.docs[0].id, ...snap.docs[0].data() } as Assignment);
        }
      }
    };

    openFromParams();
  }, [profile, location.state, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const editor = getActiveEditor();
      if (editor) enableImageResizing(editor);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activePage, pages.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.documentElement.setAttribute('lang', 'en-AU');
      quillRefs.current.forEach((ref) => {
        const editor = ref?.getEditor?.();
        const root = editor?.root as HTMLElement | undefined;
        if (!root) return;
        root.spellcheck = spellcheckEnabled;
        root.setAttribute('spellcheck', String(spellcheckEnabled));
        root.setAttribute('lang', 'en-AU');
        root.setAttribute('translate', 'no');
        root.setAttribute('autocorrect', spellcheckEnabled ? 'on' : 'off');
        root.setAttribute('autocapitalize', spellcheckEnabled ? 'sentences' : 'off');
        root.setAttribute('data-gramm', 'true');
        const container = root.closest('.ql-container') as HTMLElement | null;
        if (container) {
          container.setAttribute('lang', 'en-AU');
          container.spellcheck = spellcheckEnabled;
        }
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pages.length, activePage, currentAssignment?.id, spellcheckEnabled]);

  const triggerSpellcheck = () => {
    const editor = getActiveEditor();
    const root = editor?.root as HTMLElement | undefined;
    if (!root) return;
    if (!spellcheckEnabled) {
      setSpellcheckEnabled(true);
    }
    window.setTimeout(() => {
      root.spellcheck = false;
      root.setAttribute('spellcheck', 'false');
      window.setTimeout(() => {
        root.spellcheck = true;
        root.setAttribute('spellcheck', 'true');
        root.focus();
        const selection = window.getSelection();
        if (selection && root.lastChild) {
          const range = document.createRange();
          range.selectNodeContents(root);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }, 40);
    }, 0);
  };

  const getLayerCanvas = (layer: PageLayer, pageIndex: number) => (
    layer === 'free' ? freeDrawCanvasRefs.current[pageIndex] : handwritingCanvasRefs.current[pageIndex]
  );

  const getLayerSnapshot = (layer: PageLayer, pageIndex: number) => (
    layer === 'free' ? pageFreeDrawings[pageIndex] : pageHandwriting[pageIndex]
  );

  const setLayerSnapshot = (layer: PageLayer, pageIndex: number, dataUrl: string) => {
    if (layer === 'free') {
      setPageFreeDrawings((prev) => ({ ...prev, [pageIndex]: dataUrl }));
      return;
    }
    setPageHandwriting((prev) => ({ ...prev, [pageIndex]: dataUrl }));
  };

  const clearLayerSnapshot = (layer: PageLayer, pageIndex: number) => {
    if (layer === 'free') {
      setPageFreeDrawings((prev) => {
        const next = { ...prev };
        delete next[pageIndex];
        return next;
      });
      return;
    }
    setPageHandwriting((prev) => {
      const next = { ...prev };
      delete next[pageIndex];
      return next;
    });
  };

  const loadImageOnCanvas = (canvas: HTMLCanvasElement, dataUrl: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = dataUrl;
  };

  const resizeCanvasToContainer = (canvas: HTMLCanvasElement, container: HTMLElement, restoreDataUrl?: string) => {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    const nextW = Math.round(width * dpr);
    const nextH = Math.round(height * dpr);
    if (canvas.width === nextW && canvas.height === nextH) return;
    canvas.width = nextW;
    canvas.height = nextH;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (restoreDataUrl) {
      loadImageOnCanvas(canvas, restoreDataUrl);
    }
  };

  const registerPageCanvas = (layer: PageLayer, pageIndex: number, canvas: HTMLCanvasElement | null) => {
    if (layer === 'free') freeDrawCanvasRefs.current[pageIndex] = canvas;
    else handwritingCanvasRefs.current[pageIndex] = canvas;
    if (!canvas) return;
    const pageCard = pageCardRefs.current[pageIndex];
    if (!pageCard) return;
    const snapshot = getLayerSnapshot(layer, pageIndex);
    resizeCanvasToContainer(canvas, pageCard, snapshot);
    if (snapshot) hasInkRef.current[`${layer}-${pageIndex}`] = true;
  };

  useEffect(() => {
    const onResize = () => {
      pages.forEach((_page, idx) => {
        const card = pageCardRefs.current[idx];
        if (!card) return;
        const freeCanvas = freeDrawCanvasRefs.current[idx];
        const handwritingCanvas = handwritingCanvasRefs.current[idx];
        if (freeCanvas) resizeCanvasToContainer(freeCanvas, card, pageFreeDrawings[idx]);
        if (handwritingCanvas) resizeCanvasToContainer(handwritingCanvas, card, pageHandwriting[idx]);
      });
      const pad = drawingPadRef.current;
      if (pad && pad.parentElement) resizeCanvasToContainer(pad, pad.parentElement, drawingPadData);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pages, pageFreeDrawings, pageHandwriting, drawingPadData]);

  const getCanvasPoint = (canvas: HTMLCanvasElement, event: any) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const beginDrawing = (event: any, pageIndex: number, layer: PageLayer) => {
    const canvas = getLayerCanvas(layer, pageIndex);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(canvas, event);
    drawStateRef.current[`${layer}-${pageIndex}`] = {
      isDrawing: true,
      pointerId: event.pointerId,
      lastX: x,
      lastY: y
    };
    canvas.setPointerCapture(event.pointerId);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const continueDrawing = (event: any, pageIndex: number, layer: PageLayer) => {
    const stateKey = `${layer}-${pageIndex}`;
    const drawingState = drawStateRef.current[stateKey];
    if (!drawingState?.isDrawing || drawingState.pointerId !== event.pointerId) return;
    const canvas = getLayerCanvas(layer, pageIndex);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(canvas, event);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.beginPath();
    ctx.moveTo(drawingState.lastX, drawingState.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawStateRef.current[stateKey] = { ...drawingState, lastX: x, lastY: y };
    hasInkRef.current[stateKey] = true;
  };

  const endDrawing = (event: any, pageIndex: number, layer: PageLayer) => {
    const stateKey = `${layer}-${pageIndex}`;
    const drawingState = drawStateRef.current[stateKey];
    if (!drawingState?.isDrawing || drawingState.pointerId !== event.pointerId) return;
    const canvas = getLayerCanvas(layer, pageIndex);
    if (canvas) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
      if (hasInkRef.current[stateKey]) {
        setLayerSnapshot(layer, pageIndex, canvas.toDataURL('image/png'));
      }
    }
    drawStateRef.current[stateKey] = {
      isDrawing: false,
      pointerId: null,
      lastX: drawingState.lastX,
      lastY: drawingState.lastY
    };
  };

  const clearPageLayer = (layer: PageLayer, pageIndex: number) => {
    const canvas = getLayerCanvas(layer, pageIndex);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current[`${layer}-${pageIndex}`] = false;
    clearLayerSnapshot(layer, pageIndex);
  };

  const beginPadDraw = (event: any) => {
    const canvas = drawingPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(canvas, event);
    drawStateRef.current['pad'] = {
      isDrawing: true,
      pointerId: event.pointerId,
      lastX: x,
      lastY: y
    };
    canvas.setPointerCapture(event.pointerId);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const continuePadDraw = (event: any) => {
    const drawingState = drawStateRef.current['pad'];
    if (!drawingState?.isDrawing || drawingState.pointerId !== event.pointerId) return;
    const canvas = drawingPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(canvas, event);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.beginPath();
    ctx.moveTo(drawingState.lastX, drawingState.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawStateRef.current['pad'] = { ...drawingState, lastX: x, lastY: y };
    hasInkRef.current['pad'] = true;
  };

  const endPadDraw = (event: any) => {
    const drawingState = drawStateRef.current['pad'];
    if (!drawingState?.isDrawing || drawingState.pointerId !== event.pointerId) return;
    const canvas = drawingPadRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // noop
      }
      if (hasInkRef.current['pad']) {
        setDrawingPadData(canvas.toDataURL('image/png'));
      }
    }
    drawStateRef.current['pad'] = {
      isDrawing: false,
      pointerId: null,
      lastX: drawingState.lastX,
      lastY: drawingState.lastY
    };
  };

  const clearDrawingPad = () => {
    const canvas = drawingPadRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current['pad'] = false;
    setDrawingPadData('');
  };

  const insertDrawingPadIntoWorkbook = async () => {
    const editor = getActiveEditor();
    const canvas = drawingPadRef.current;
    if (!editor || !canvas || !profile) return;
    const dataUrl = canvas.toDataURL('image/png');
    const uploadUrl = await uploadEditorImage({
      userId: profile.uid,
      scope: `workbooks/${currentAssignment?.id || 'draft'}/page-${activePage + 1}`,
      dataUrl,
      fileName: `drawing-pad-page-${activePage + 1}.png`,
    });
    const range = editor.getSelection();
    const index = range ? range.index : editor.getLength();
    editor.insertEmbed(index, 'image', uploadUrl, 'user');
    editor.setSelection(index + 1, 0);
  };

  const convertHandwritingToText = async () => {
    const dataUrl = pageHandwriting[activePage];
    if (!dataUrl) return;
    setIsConvertingHandwriting(true);
    try {
      const text = await geminiService.handwritingToText(dataUrl);
      if (!text) return;
      const editor = getActiveEditor();
      if (!editor) return;
      const range = editor.getSelection();
      const index = range ? range.index : editor.getLength();
      editor.insertText(index, text, 'user');
      editor.setSelection(index + text.length, 0);
      clearPageLayer('handwriting', activePage);
    } catch (error) {
      console.error('Handwriting conversion failed:', error);
    } finally {
      setIsConvertingHandwriting(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    if (isSaveInFlightRef.current) {
      queuedAutosaveRef.current = true;
      return;
    }
    const safeTitle = title.trim() || 'Untitled Workbook';
    if (safeTitle !== title) setTitle(safeTitle);
    setIsSaving(true);
    isSaveInFlightRef.current = true;
    try {
      const sanitizedPages = await Promise.all(
        pages.map((pageContent, index) =>
          replaceInlineImagesWithStorageUrls(pageContent, {
            userId: profile.uid,
            scope: `workbooks/${currentAssignment?.id || 'draft'}/page-${index + 1}`,
          }),
        ),
      );
      if (sanitizedPages.some((page, index) => page !== pages[index])) {
        setPages(sanitizedPages);
      }
      const combined = sanitizedPages.join('\n\n');
      setContent(combined);
      let savedAssignmentId = currentAssignment?.id || null;
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
      const contentPreview = truncateToBytes(combined, MAX_PREVIEW_BYTES);
      if (currentAssignment) {
        await updateDoc(doc(db, 'assignments', currentAssignment.id), {
          title: safeTitle,
          content: contentPreview,
          pages: deleteField(),
          updatedAt: new Date().toISOString()
        });
        const batch = writeBatch(db);
        const pagesRef = collection(db, 'assignments', currentAssignment.id, 'pages');
        sanitizedPages.forEach((pageContent, index) => {
          batch.set(doc(pagesRef, `page-${index + 1}`), {
            index,
            content: pageContent,
            freeDrawData: pageFreeDrawings[index] || '',
            handwritingData: pageHandwriting[index] || '',
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
        savedAssignmentId = currentAssignment.id;
      } else {
        const existing = assignments.find((a) => a.title === safeTitle && a.userId === profile.uid);
        if (existing) {
          await updateDoc(doc(db, 'assignments', existing.id), {
            title: safeTitle,
            content: contentPreview,
            pages: deleteField(),
            updatedAt: new Date().toISOString()
          });
          const batch = writeBatch(db);
          const pagesRef = collection(db, 'assignments', existing.id, 'pages');
          sanitizedPages.forEach((pageContent, index) => {
            batch.set(doc(pagesRef, `page-${index + 1}`), {
              index,
              content: pageContent,
              freeDrawData: pageFreeDrawings[index] || '',
              handwritingData: pageHandwriting[index] || '',
              updatedAt: new Date().toISOString()
            });
          });
          await batch.commit();
          setCurrentAssignment(existing);
          savedAssignmentId = existing.id;
        } else {
          const newDoc = await addDoc(collection(db, 'assignments'), {
          userId: profile.uid,
          title: safeTitle,
          content: contentPreview,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
          const batch = writeBatch(db);
          const pagesRef = collection(db, 'assignments', newDoc.id, 'pages');
          sanitizedPages.forEach((pageContent, index) => {
            batch.set(doc(pagesRef, `page-${index + 1}`), {
              index,
              content: pageContent,
              freeDrawData: pageFreeDrawings[index] || '',
              handwritingData: pageHandwriting[index] || '',
              updatedAt: new Date().toISOString()
            });
          });
          await batch.commit();
          const nextAssignment = { id: newDoc.id, userId: profile.uid, title: safeTitle, content: combined, createdAt: '', updatedAt: '' };
          setCurrentAssignment(nextAssignment);
          savedAssignmentId = newDoc.id;
        }
      }
      lastSavedSnapshotRef.current = buildWorkbookSnapshot(
        safeTitle,
        sanitizedPages,
        pageFreeDrawings,
        pageHandwriting,
        savedAssignmentId,
      );
    } catch (error) {
      handleFirestoreError(error, currentAssignment ? OperationType.UPDATE : OperationType.CREATE, 'assignments');
    } finally {
      isSaveInFlightRef.current = false;
      setIsSaving(false);
      if (queuedAutosaveRef.current) {
        queuedAutosaveRef.current = false;
        const latestSnapshot = buildWorkbookSnapshot();
        if (latestSnapshot !== lastSavedSnapshotRef.current) {
          window.setTimeout(() => {
            void handleSave();
          }, 0);
        }
      }
    }
  };

  const handleAIImprove = async () => {
    const combined = pages.join('\n\n').trim();
    if (!combined) return;
    setIsAILoading(true);
    try {
      const improved = await geminiService.chat(`Improve this workbook content for clarity, grammar, and academic tone: ${combined}`);
      setContent(improved);
      setPages([improved]);
      setActivePage(0);
    } catch (error) {
      console.error('AI improvement failed:', error);
    } finally {
      setIsAILoading(false);
    }
  };

  const createNew = () => {
    setCurrentAssignment(null);
    setTitle('Untitled Workbook');
    setContent('');
    setPages(['']);
    setPageFreeDrawings({});
    setPageHandwriting({});
    lastSavedSnapshotRef.current = buildWorkbookSnapshot('Untitled Workbook', [''], {}, {}, null);
    setDrawingPadData('');
    setPenMode('off');
    setActivePage(0);
  };

  useEffect(() => {
    if (!profile) return;
    const snapshot = buildWorkbookSnapshot();
    if (snapshot === lastSavedSnapshotRef.current) return;
    const timeout = window.setTimeout(() => {
      void handleSave();
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [profile, title, pages, pageFreeDrawings, pageHandwriting, currentAssignment?.id]);

  const getActiveEditor = () => {
    const ref = quillRefs.current[activePage];
    try {
      return ref?.getEditor?.() ?? null;
    } catch (error) {
      return null;
    }
  };

  const insertTemplate = (template: string) => {
    const editor = getActiveEditor();
    if (!editor) return;
    const range = editor.getSelection();
    const index = range ? range.index : editor.getLength();
    editor.insertText(index, template);
    editor.setSelection(index + template.length, 0);
  };

  const insertTableTemplate = (rows = 2, cols = 2) => {
    const editor = getActiveEditor();
    if (!editor) return;
    const range = editor.getSelection();
    const index = range ? range.index : editor.getLength();
    const safeRows = Math.max(1, Math.min(10, rows));
    const safeCols = Math.max(1, Math.min(6, cols));
    let rowsHtml = '';
    for (let r = 0; r < safeRows; r++) {
      let cells = '';
      for (let c = 0; c < safeCols; c++) {
        cells += `<td>${r === 0 ? `Column ${c + 1}` : ''}</td>`;
      }
      rowsHtml += `<tr>${cells}</tr>`;
    }
    const tableHtml = `
      <div class="workbook-table-wrap">
        <table class="workbook-table">
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <p><br/></p>
    `;
    editor.clipboard.dangerouslyPasteHTML(index, tableHtml, 'user');
    editor.setSelection(index + 1, 0);
  };

  const insertQuestionTemplate = () => {
    insertTemplate('\nQ: \nA: \n');
  };

  const enableImageResizing = (editor: any) => {
    if (!editor || editor.__imageResizer) return;
    const root = editor.root as HTMLElement;
    const container = root as HTMLElement;
    container.style.position = container.style.position || 'relative';

    const overlay = document.createElement('div');
    overlay.className = 'image-resize-overlay';
    overlay.style.display = 'none';
    overlay.dataset.active = 'false';
    overlay.innerHTML = `
      <button class="image-resize-toggle" type="button" title="Resize image" data-action="toggle" aria-label="Resize image">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h14a1 1 0 1 1 0 2h-1v10h1a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2V7Zm3 0v10h10V7H6Zm1 1h1v2H7V8Zm2 0h1v2H9V8Zm2 0h1v2h-1V8Zm2 0h1v2h-1V8Zm-6 6h1v2H7v-2Zm2 0h1v2H9v-2Zm2 0h1v2h-1v-2Zm2 0h1v2h-1v-2Z" fill="currentColor"/>
        </svg>
      </button>
      <div class="handle tl" data-dir="tl"></div>
      <div class="handle tr" data-dir="tr"></div>
      <div class="handle bl" data-dir="bl"></div>
      <div class="handle br" data-dir="br"></div>
    `;
    container.appendChild(overlay);

    let activeImg: HTMLImageElement | null = null;
    let resizeActive = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let activeDir = 'br';

    const positionOverlay = () => {
      if (!activeImg) return;
      const imgRect = activeImg.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      overlay.style.left = `${imgRect.left - contRect.left}px`;
      overlay.style.top = `${imgRect.top - contRect.top}px`;
      overlay.style.width = `${imgRect.width}px`;
      overlay.style.height = `${imgRect.height}px`;
    };

    const hideOverlay = () => {
      overlay.style.display = 'none';
      overlay.classList.remove('active');
      overlay.dataset.active = 'false';
      resizeActive = false;
      activeImg = null;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!activeImg) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let newW = startW;
      let newH = startH;
      if (activeDir.includes('r')) newW = startW + dx;
      if (activeDir.includes('l')) newW = startW - dx;
      if (activeDir.includes('b')) newH = startH + dy;
      if (activeDir.includes('t')) newH = startH - dy;
      newW = Math.max(40, newW);
      newH = Math.max(40, newH);
      activeImg.style.width = `${newW}px`;
      activeImg.style.height = `${newH}px`;
      positionOverlay();
    };

    const stopResize = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopResize);
    };

    overlay.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      if (action === 'toggle') {
        e.preventDefault();
        resizeActive = !resizeActive;
        overlay.classList.toggle('active', resizeActive);
        overlay.dataset.active = resizeActive ? 'true' : 'false';
        positionOverlay();
        return;
      }
      const dir = target.dataset.dir;
      if (!dir || !activeImg || !resizeActive) return;
      e.preventDefault();
      activeDir = dir;
      startX = e.clientX;
      startY = e.clientY;
      startW = activeImg.getBoundingClientRect().width;
      startH = activeImg.getBoundingClientRect().height;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', stopResize);
    });

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'IMG') {
        activeImg = target as HTMLImageElement;
        overlay.style.display = 'block';
        overlay.classList.toggle('active', resizeActive);
        overlay.dataset.active = resizeActive ? 'true' : 'false';
        positionOverlay();
      } else if (!overlay.contains(target)) {
        hideOverlay();
      }
    };

    const onScroll = () => positionOverlay();
    root.addEventListener('click', onClick, true);
    root.addEventListener('mousedown', onClick, true);
    root.addEventListener('scroll', onScroll);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);

    editor.__imageResizer = {
      destroy: () => {
        root.removeEventListener('click', onClick);
        root.removeEventListener('scroll', onScroll);
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', onScroll);
        overlay.remove();
      }
    };
  };

  const insertImageFromFile = () => {
    const editor = getActiveEditor();
    if (!editor || !profile) return;
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
            userId: profile.uid,
            scope: `workbooks/${currentAssignment?.id || 'draft'}/page-${activePage + 1}`,
            file,
          });
          const range = editor.getSelection();
          const index = range ? range.index : editor.getLength();
          editor.insertEmbed(index, 'image', uploadUrl, 'user');
          editor.setSelection(index + 1, 0);
        } catch (error) {
          console.error('Workbook image upload failed:', error);
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

  const insertCaption = (type: 'figure' | 'table' | 'graph') => {
    const label = type === 'table' ? 'Table' : type === 'graph' ? 'Graph' : 'Figure';
    const editor = getActiveEditor();
    if (!editor) return;
    const range = editor.getSelection();
    const index = range ? range.index : editor.getLength();
    const html = `<p class="caption-line" data-caption-type="${type}">${label} X: </p>`;
    editor.clipboard.dangerouslyPasteHTML(index, html, 'user');
    editor.setSelection(index + 1, 0);
  };

  const escapeHtml = (value: string) => (
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  );

  const insertEquation = (mode: 'block' | 'inline' = 'block') => {
    const editor = getActiveEditor();
    if (!editor) return;
    const clean = equationText.trim();
    if (!clean) return;
    const range = editor.getSelection();
    const index = range ? range.index : editor.getLength();
    const safe = escapeHtml(clean);
    if (mode === 'block') {
      const html = `
        <p class="equation-block"><span class="equation-inline">${safe}</span></p>
        <p><br/></p>
      `;
      editor.clipboard.dangerouslyPasteHTML(index, html, 'user');
      editor.setSelection(index + 1, 0);
    } else {
      editor.insertText(index, clean);
      editor.setSelection(index + clean.length, 0);
    }
    setEquationText('');
  };

  const appendEquationText = (value: string) => {
    setEquationText((prev) => `${prev}${value}`);
    equationInputRef.current?.focus();
  };

  const setEquationTemplate = (value: string) => {
    setEquationText(value);
    equationInputRef.current?.focus();
  };

  const insertPageBreak = () => {
    setPages((prev) => {
      const next = [...prev, ''];
      setActivePage(next.length - 1);
      return next;
    });
  };

  const getTargetTable = () => {
    const editor = getActiveEditor();
    if (!editor) return null;
    const selection = window.getSelection();
    let node = selection?.anchorNode as Element | null;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const cell = node?.closest?.('td') as HTMLTableCellElement | null;
    const table = (cell?.closest?.('table.workbook-table') as HTMLTableElement | null)
      || (editor.root.querySelector('table.workbook-table') as HTMLTableElement | null);
    return { table, cell };
  };

  const addRow = () => {
    const target = getTargetTable();
    if (!target?.table) return;
    const row = target.table.rows[0];
    if (!row) return;
    const newRow = target.table.insertRow(-1);
    for (let i = 0; i < row.cells.length; i++) {
      const cell = newRow.insertCell(-1);
      cell.innerHTML = '';
    }
  };

  const addColumn = () => {
    const target = getTargetTable();
    if (!target?.table) return;
    Array.from(target.table.rows).forEach((r) => {
      const cell = r.insertCell(-1);
      cell.innerHTML = '';
    });
  };

  const deleteRow = () => {
    const target = getTargetTable();
    if (!target?.table || !target.cell) return;
    const row = target.cell.parentElement as HTMLTableRowElement | null;
    if (!row) return;
    row.remove();
  };

  const deleteColumn = () => {
    const target = getTargetTable();
    if (!target?.table || !target.cell) return;
    const cellIndex = target.cell.cellIndex;
    Array.from(target.table.rows).forEach((r) => {
      if (r.cells[cellIndex]) r.deleteCell(cellIndex);
    });
  };

  const fetchWorkbookPages = async (assignmentId: string) => {
    const pagesRef = collection(db, 'assignments', assignmentId, 'pages');
    const pageSnap = await getDocs(query(pagesRef, orderBy('index', 'asc')));
    if (pageSnap.empty) return null;
    return pageSnap.docs.map((d) => {
      const data = d.data() as any;
      return {
        content: data.content || '',
        freeDrawData: data.freeDrawData || '',
        handwritingData: data.handwritingData || ''
      } as WorkbookPageDoc;
    });
  };

  const applySmartReport = (html: string) => {
    if (typeof window === 'undefined') return html;
    const start = performance.now();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let h1 = 0;
    let h2 = 0;
    let h3 = 0;
    const stripLeadingNumber = (el: Element) => {
      el.querySelectorAll('span.auto-number').forEach((n) => n.remove());
      const first = el.firstChild;
      if (first && first.nodeType === Node.TEXT_NODE) {
        const text = (first.textContent || '').replace(/^\s*\d+(?:\.\d+)*\.\s*/g, '');
        first.textContent = text;
      }
    };
    const headingEls = doc.body.querySelectorAll('h1, h2, h3');
    headingEls.forEach((el) => {
      const isSmart = (el as HTMLElement).dataset.smartHeading === 'true';
      if (!isSmart) return;
      stripLeadingNumber(el);
      const rawText = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!rawText) return;
      if (el.tagName === 'H1') {
        h1 += 1; h2 = 0; h3 = 0;
        const num = `${h1}.`;
        const prefix = doc.createElement('span');
        prefix.className = 'auto-number';
        prefix.setAttribute('contenteditable', 'false');
        prefix.textContent = `${num} `;
        el.insertBefore(prefix, el.firstChild);
      }
      if (el.tagName === 'H2') {
        if (h1 === 0) h1 = 1;
        h2 += 1; h3 = 0;
        const num = `${h1}.${h2}`;
        const prefix = doc.createElement('span');
        prefix.className = 'auto-number';
        prefix.setAttribute('contenteditable', 'false');
        prefix.textContent = `${num} `;
        el.insertBefore(prefix, el.firstChild);
      }
      if (el.tagName === 'H3') {
        if (h1 === 0) h1 = 1;
        if (h2 === 0) h2 = 1;
        h3 += 1;
        const num = `${h1}.${h2}.${h3}`;
        const prefix = doc.createElement('span');
        prefix.className = 'auto-number';
        prefix.setAttribute('contenteditable', 'false');
        prefix.textContent = `${num} `;
        el.insertBefore(prefix, el.firstChild);
      }
    });

    const typeCounts: Record<string, number> = { figure: 0, table: 0, graph: 0 };
    const captionEls = doc.body.querySelectorAll<HTMLElement>('.caption-line[data-caption-type]');
    captionEls.forEach((el) => {
      const type = el.dataset.captionType || 'figure';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      const label = type === 'table' ? 'Table' : type === 'graph' ? 'Graph' : 'Figure';
      const raw = el.textContent || '';
      const cleaned = raw.replace(new RegExp(`^${label}\\s*\\d+\\s*:\\s*`, 'i'), '');
      el.textContent = `${label} ${typeCounts[type]}: ${cleaned}`;
    });

    const out = doc.body.innerHTML;
    const duration = Math.round(performance.now() - start);
    console.debug('[SmartReport] processed in', `${duration}ms`);
    return out;
  };

  const extractTextBlocks = (root: ParentNode) => {
    const blocks: Paragraph[] = [];
    const pushText = (value: string, options: Partial<ConstructorParameters<typeof Paragraph>[0]> = {}) => {
      const text = value.replace(/\s+/g, ' ').trim();
      if (!text) return;
      blocks.push(
        new Paragraph({
          children: [new TextRun(text)],
          spacing: { after: 180 },
          ...options,
        }),
      );
    };

    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        pushText(node.textContent || '');
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (!text) return;
      if (el.matches('h1')) {
        pushText(text, { heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 140 } });
        return;
      }
      if (el.matches('h2')) {
        pushText(text, { heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 120 } });
        return;
      }
      if (el.matches('h3')) {
        pushText(text, { heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 100 } });
        return;
      }
      if (el.matches('ul')) {
        Array.from(el.querySelectorAll(':scope > li')).forEach((li) => {
          pushText(li.textContent || '', { bullet: { level: 0 } });
        });
        return;
      }
      if (el.matches('ol')) {
        Array.from(el.querySelectorAll(':scope > li')).forEach((li, index) => {
          pushText(`${index + 1}. ${li.textContent || ''}`);
        });
        return;
      }
      if (el.matches('table')) {
        Array.from(el.querySelectorAll('tr')).forEach((row) => {
          const cells = Array.from(row.querySelectorAll('th, td'))
            .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);
          pushText(cells.join(' | '));
        });
        return;
      }
      pushText(text);
    });

    return blocks;
  };

  const exportAsDocx = async () => {
    await handleSave();
    const safeTitle = (title.trim() || 'Untitled Report').replace(/[\\/:*?"<>|]+/g, '-');
    const sourcePages = pages.map((page) => (smartReportMode ? applySmartReport(page) : page));
    const sections: Paragraph[] = [
      new Paragraph({
        text: safeTitle,
        heading: HeadingLevel.TITLE,
        spacing: { after: 280 },
      }),
    ];

    sourcePages.forEach((pageHtml, index) => {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(pageHtml, 'text/html');
      if (sourcePages.length > 1) {
        sections.push(
          new Paragraph({
            text: `Page ${index + 1}`,
            heading: HeadingLevel.HEADING_2,
            pageBreakBefore: index > 0,
            spacing: { before: index > 0 ? 240 : 120, after: 180 },
          }),
        );
      }
      sections.push(...extractTextBlocks(parsed.body));
    });

    const docxFile = new DocxDocument({
      sections: [
        {
          properties: {},
          children: sections.length
            ? sections
            : [new Paragraph({ text: 'This report is empty.', spacing: { after: 180 } })],
        },
      ],
    });

    const blob = await Packer.toBlob(docxFile);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeTitle}.docx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  };

  const openMicrosoftWordWorkspace = () => {
    const userId = profile?.uid || '';
    const target = userId
      ? `${microsoftWordWorkbookPath}?userId=${encodeURIComponent(userId)}`
      : microsoftWordWorkbookPath;
    navigate(target);
  };

  return (
    <div className={cn("flex min-h-[calc(100vh-6rem)] bg-zinc-50", isPhone ? "flex-col gap-3 p-3" : "gap-4 p-6")}>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={cn("mx-auto w-full", isPhone ? "mb-3 max-w-full px-1" : "mb-4 max-w-4xl")}>
          <div className="rounded-[28px] border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-4 shadow-sm">
            <div className={cn("flex", isPhone ? "flex-col gap-3" : "items-center justify-between gap-4")}>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600">Microsoft Word</p>
                <h2 className="mt-1 text-lg font-black text-zinc-950">Open this workbook in real Word</h2>
                <p className="mt-1 text-sm font-medium leading-6 text-zinc-500">
                  Use Word Online inside EduRevolution, or jump to the installed Word app from the Microsoft workspace screen.
                </p>
              </div>
              <button
                onClick={openMicrosoftWordWorkspace}
                className={cn("inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 font-black text-white transition hover:bg-sky-700", isPhone ? "w-full px-4 py-3 text-sm" : "px-5 py-3 text-sm")}
              >
                <ExternalLink size={18} />
                Open in Microsoft Word
              </button>
            </div>
          </div>
        </div>
        <div className={cn("mx-auto w-full", isPhone ? "mb-3 max-w-full px-1" : "mb-4 max-w-4xl")}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cn("w-full bg-transparent font-black text-zinc-900 focus:outline-none placeholder:text-zinc-300", isPhone ? "text-[1.65rem] leading-tight" : "text-3xl")}
            placeholder={isUniversityReport ? 'Report Title...' : 'Workbook Title...'}
          />
        </div>
        <div className={cn("mx-auto w-full", isPhone ? "mb-3 max-w-full px-1" : "mb-4 max-w-4xl")}>
          <div className={cn("flex", isPhone ? `grid ${isUniversityReport ? 'grid-cols-4' : 'grid-cols-3'} gap-2` : "items-center justify-end gap-3")}>
          <button
            onClick={createNew}
            className={cn("flex items-center justify-center gap-2 rounded-full bg-zinc-100 font-bold text-zinc-700 hover:bg-zinc-200 transition-all", isPhone ? "min-w-0 px-3 py-2 text-[0.8rem]" : "px-5 py-2.5 text-sm")}
          >
            <Plus size={18} />
            <span className="truncate">{isPhone ? 'New' : isUniversityReport ? 'New Report' : 'New Workbook'}</span>
          </button>
          <button
            onClick={handleAIImprove}
            disabled={isAILoading || !content}
            className={cn("flex items-center justify-center gap-2 rounded-full bg-violet-50 font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-all", isPhone ? "min-w-0 px-3 py-2 text-[0.8rem]" : "px-5 py-2.5 text-sm")}
          >
            {isAILoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            <span className="truncate">{isPhone ? 'Improve' : 'AI Improve'}</span>
          </button>
          {isUniversityReport && (
            <button
              onClick={exportAsDocx}
              className={cn("flex items-center justify-center gap-2 rounded-full bg-zinc-100 font-bold text-zinc-700 hover:bg-zinc-200 transition-all", isPhone ? "min-w-0 px-3 py-2 text-[0.8rem]" : "px-5 py-2.5 text-sm")}
            >
              <Download size={18} />
              <span className="truncate">{isPhone ? '.docx' : 'Download .docx'}</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn("flex items-center justify-center gap-2 rounded-full bg-indigo-600 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-all", isPhone ? "min-w-0 px-3 py-2 text-[0.8rem]" : "px-6 py-2.5 text-sm")}
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            <span className="truncate">{isPhone ? 'Save' : isUniversityReport ? 'Save Report' : 'Save Workbook'}</span>
          </button>
          </div>
        </div>

        <div className="flex-1">
          <style>{`
              .ql-editor .workbook-table-wrap {
                display: inline-block;
                max-width: 100%;
                resize: both;
                overflow: auto;
                margin: 8px 0 16px;
                border-radius: 8px;
              }
              .ql-editor table.workbook-table {
                width: 100%;
                border-collapse: collapse;
              }
              .ql-editor table.workbook-table td {
                border: 1px solid #d4d4d8;
                padding: 8px;
                min-width: 80px;
                vertical-align: top;
                resize: both;
                overflow: auto;
              }
              .ql-editor img {
                max-width: 100%;
                height: auto;
                display: inline-block;
                resize: both;
                overflow: auto;
              }
              .image-resize-overlay {
                position: absolute;
                border: 2px solid #6366f1;
                box-sizing: border-box;
                pointer-events: none;
                z-index: 200;
                box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                background: rgba(99, 102, 241, 0.08);
              }
              .image-resize-toggle {
                position: absolute;
                right: -12px;
                top: -36px;
                width: 28px;
                height: 28px;
                border-radius: 8px;
                border: 2px solid #6366f1;
                background: #fff;
                color: #4338ca;
                font-weight: 900;
                font-size: 14px;
                pointer-events: all;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .image-resize-overlay .handle {
                position: absolute;
                width: 10px;
                height: 10px;
                background: #6366f1;
                border: 2px solid #fff;
                box-sizing: border-box;
                pointer-events: all;
                display: none;
              }
              .image-resize-overlay.active .handle {
                display: block;
              }
              .image-resize-overlay:not([data-active="true"]) {
                border-style: dashed;
              }
              .image-resize-overlay .handle.tl { left: -6px; top: -6px; cursor: nwse-resize; }
              .image-resize-overlay .handle.tr { right: -6px; top: -6px; cursor: nesw-resize; }
              .image-resize-overlay .handle.bl { left: -6px; bottom: -6px; cursor: nesw-resize; }
              .image-resize-overlay .handle.br { right: -6px; bottom: -6px; cursor: nwse-resize; }
              .ql-toolbar {
                background: white;
                border-radius: 12px;
              }
              .ql-editor .page-break {
                border-top: 2px dashed #e4e4e7;
                margin: 40px 0;
                page-break-after: always;
              }
              .ql-editor p,
              .ql-editor h1,
              .ql-editor h2,
              .ql-editor h3,
              .ql-editor ul,
              .ql-editor ol,
              .ql-editor table {
                max-width: 100%;
              }
              .ql-editor .equation-inline {
                font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif;
                font-size: 1.05em;
              }
              .ql-editor .equation-block {
                margin: 8px 0 16px;
                padding: 10px 12px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
              }
              .ql-editor .caption-line {
                color: #52525b;
                font-size: 0.9em;
                font-style: italic;
                margin: 6px 0 14px;
              }
              .ql-editor .auto-number {
                font-weight: 700;
                color: #0f172a;
              }
              .ql-editor .smart-heading {
                position: relative;
              }
              .workbook-editor .ql-editor {
                min-height: 1123px;
              }
              .ql-editor {
                padding: 72px 64px;
              }
              .ql-editor .page-break {
                page-break-after: always;
                margin: 40px 0;
              }
              .workbook-page-layer {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                touch-action: none;
                z-index: 15;
              }
              @media (max-width: 768px) {
                .workbook-editor .ql-editor {
                  min-height: 62vh;
                }
                .ql-editor {
                  padding: 20px 18px;
                  font-size: 1.02rem;
                  line-height: 1.65;
                }
                #workbook-toolbar.ql-toolbar {
                  padding: 0.75rem !important;
                }
              }
            `}</style>
          <div className={cn("mx-auto w-full", isPhone ? "mb-3 max-w-full" : "mb-4 max-w-[794px]")}>
            <div className={cn("rounded-2xl border border-zinc-200 bg-white shadow-sm", isPhone ? "px-3 py-3" : "px-4 py-3")}>
              <div className="flex flex-wrap items-center gap-2 mb-3 relative">
                <button
                  onClick={() => {
                    setShowInsertMenu(!showInsertMenu);
                    setShowTableMenu(false);
                    setShowEquationMenu(false);
                    setShowCaptionMenu(false);
                    setShowPenMenu(false);
                  }}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-200 transition-all"
                >
                  Insert ▾
                </button>
                <button
                  onClick={() => {
                    setShowPenMenu(!showPenMenu);
                    setShowInsertMenu(false);
                    setShowTableMenu(false);
                    setShowEquationMenu(false);
                    setShowCaptionMenu(false);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5",
                    penMode === 'off' ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : "bg-blue-600 text-white"
                  )}
                >
                  <PenLine size={13} />
                  Pen ▾
                </button>
                <button
                  onClick={() => setSmartReportMode((prev) => !prev)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    smartReportMode ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  )}
                >
                  Smart Report {smartReportMode ? 'On' : 'Off'}
                </button>
                <button
                  onClick={triggerSpellcheck}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5",
                    spellcheckEnabled ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  )}
                  title="Turn on browser spellcheck for this workbook"
                >
                  <CheckCheck size={13} />
                  Spellcheck {spellcheckEnabled ? 'On' : 'Off'}
                </button>
              {showPenMenu && (
                <div className="absolute top-10 left-32 z-40 w-56 rounded-xl border border-zinc-200 bg-white shadow-lg p-2">
                  {([
                    { key: 'off', label: 'Off', icon: Type },
                    { key: 'free-draw', label: 'Free Draw', icon: PenLine },
                    { key: 'write-to-text', label: 'Write to Text', icon: Hand },
                    { key: 'drawing-pad', label: 'Drawing Pad', icon: Type }
                  ] as const).map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.key}
                        onClick={() => {
                          setPenMode(option.key);
                          setShowPenMenu(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-zinc-50 flex items-center gap-2",
                          penMode === option.key ? "bg-blue-50 text-blue-700" : ""
                        )}
                      >
                        <Icon size={15} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {showInsertMenu && (
                <div className="absolute top-10 left-0 z-40 w-48 rounded-xl border border-zinc-200 bg-white shadow-lg p-2">
                  <button
                    onClick={() => {
                      setShowTableMenu(true);
                      setShowEquationMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-zinc-50"
                  >
                    Table ▸
                  </button>
                  <button
                    onClick={() => {
                      insertQuestionTemplate();
                      setShowInsertMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-zinc-50"
                  >
                    Question
                  </button>
                  <button
                    onClick={() => {
                      setShowEquationMenu(true);
                      setShowTableMenu(false);
                      setShowCaptionMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-zinc-50"
                  >
                    Equation ▸
                  </button>
                  <button
                    onClick={() => {
                      setShowCaptionMenu(true);
                      setShowEquationMenu(false);
                      setShowTableMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-zinc-50"
                  >
                    Caption ▸
                  </button>
                </div>
              )}

              {showTableMenu && (
                <div className="absolute top-10 left-52 z-40 w-64 rounded-xl border border-zinc-200 bg-white shadow-lg p-3">
                  <div className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Table</div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={tableRows}
                      onChange={(e) => setTableRows(parseInt(e.target.value || '1', 10))}
                      className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-xs"
                      placeholder="Rows"
                    />
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={tableCols}
                      onChange={(e) => setTableCols(parseInt(e.target.value || '1', 10))}
                      className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-xs"
                      placeholder="Cols"
                    />
                    <button
                      onClick={() => {
                        insertTableTemplate(tableRows, tableCols);
                        setShowInsertMenu(false);
                        setShowTableMenu(false);
                      }}
                      className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                    >
                      Insert
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={addRow} className="px-2 py-1 rounded-lg bg-zinc-100 text-xs">Add Row</button>
                    <button onClick={addColumn} className="px-2 py-1 rounded-lg bg-zinc-100 text-xs">Add Column</button>
                    <button onClick={deleteRow} className="px-2 py-1 rounded-lg bg-zinc-100 text-xs">Delete Row</button>
                    <button onClick={deleteColumn} className="px-2 py-1 rounded-lg bg-zinc-100 text-xs">Delete Column</button>
                  </div>
                </div>
              )}

              {showCaptionMenu && (
                <div className="absolute top-10 left-52 z-40 w-56 rounded-xl border border-zinc-200 bg-white shadow-lg p-3">
                  <div className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Caption</div>
                  <div className="flex flex-col gap-2 text-xs">
                    <button
                      onClick={() => {
                        insertCaption('figure');
                        setShowInsertMenu(false);
                        setShowCaptionMenu(false);
                      }}
                      className="px-2 py-2 rounded-lg bg-zinc-100 text-left"
                    >
                      Figure caption
                    </button>
                    <button
                      onClick={() => {
                        insertCaption('table');
                        setShowInsertMenu(false);
                        setShowCaptionMenu(false);
                      }}
                      className="px-2 py-2 rounded-lg bg-zinc-100 text-left"
                    >
                      Table caption
                    </button>
                    <button
                      onClick={() => {
                        insertCaption('graph');
                        setShowInsertMenu(false);
                        setShowCaptionMenu(false);
                      }}
                      className="px-2 py-2 rounded-lg bg-zinc-100 text-left"
                    >
                      Graph caption
                    </button>
                  </div>
                </div>
              )}

              {showEquationMenu && (
                <div className="absolute top-10 left-52 z-40 w-[420px] rounded-xl border border-zinc-200 bg-white shadow-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-black uppercase tracking-widest text-zinc-400">Equation Builder</div>
                    <button
                      onClick={() => setEquationText('')}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      ref={equationInputRef}
                      type="text"
                      value={equationText}
                      onChange={(e) => setEquationText(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs"
                      placeholder="Type or build an equation..."
                    />
                    <button
                      onClick={() => {
                        insertEquation('block');
                        setShowInsertMenu(false);
                        setShowEquationMenu(false);
                      }}
                      className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                    >
                      Insert Block
                    </button>
                    <button
                      onClick={() => {
                        insertEquation('inline');
                        setShowInsertMenu(false);
                        setShowEquationMenu(false);
                      }}
                      className="px-2 py-1 rounded-lg bg-zinc-900 text-white text-xs font-bold"
                    >
                      Inline
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {(['symbols', 'structures', 'presets'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setEquationTab(tab)}
                        className={cn(
                          "px-2 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide",
                          equationTab === tab ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {equationTab === 'symbols' && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Operators</div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {['+','−','×','÷','±','√','^','_','%','∞','!'].map(sym => (
                          <button key={sym} onClick={() => appendEquationText(sym)} className="px-2 py-1 rounded-lg bg-zinc-100">
                            {sym}
                          </button>
                        ))}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Relations</div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {['=','≠','≈','≡','<','>','≤','≥','∝'].map(sym => (
                          <button key={sym} onClick={() => appendEquationText(sym)} className="px-2 py-1 rounded-lg bg-zinc-100">
                            {sym}
                          </button>
                        ))}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Greek</div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {['α','β','γ','θ','λ','μ','π','σ','φ','ω'].map(sym => (
                          <button key={sym} onClick={() => appendEquationText(sym)} className="px-2 py-1 rounded-lg bg-zinc-100">
                            {sym}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {equationTab === 'structures' && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Structures</div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {[
                          { label: 'Fraction', value: '(a)/(b)' },
                          { label: 'Exponent', value: 'x^2' },
                          { label: 'Subscript', value: 'x_1' },
                          { label: 'Root', value: '√(x)' },
                          { label: 'Nth Root', value: 'n√(x)' },
                          { label: 'Absolute', value: '|x|' },
                          { label: 'Brackets', value: '[ ]' },
                          { label: 'Parentheses', value: '( )' },
                          { label: 'Summation', value: '∑(i=1..n)' },
                          { label: 'Integral', value: '∫(a..b) f(x) dx' }
                        ].map(item => (
                          <button
                            key={item.label}
                            onClick={() => appendEquationText(item.value)}
                            className="px-2 py-1 rounded-lg bg-zinc-100"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {equationTab === 'presets' && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">High School Presets</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {[
                          { label: 'Pythagoras', value: 'a^2 + b^2 = c^2' },
                          { label: 'Quadratic Formula', value: 'x = (-b ± √(b^2 - 4ac)) / (2a)' },
                          { label: 'Slope-Intercept', value: 'y = mx + b' },
                          { label: 'Distance Formula', value: 'd = √((x2 - x1)^2 + (y2 - y1)^2)' },
                          { label: 'Midpoint', value: 'M = ((x1 + x2)/2 , (y1 + y2)/2)' },
                          { label: 'Circle Area', value: 'A = πr^2' },
                          { label: 'Circumference', value: 'C = 2πr' },
                          { label: 'Simple Interest', value: 'I = Prt' },
                          { label: 'Compound Interest', value: 'A = P(1 + r/n)^(nt)' },
                          { label: 'Mean', value: 'x̄ = (x1 + x2 + ... + xn) / n' },
                          { label: 'Standard Form', value: 'ax + by = c' },
                          { label: 'Trig (SOH)', value: 'sin(θ) = opp/hyp' }
                        ].map(item => (
                          <button
                            key={item.label}
                            onClick={() => setEquationTemplate(item.value)}
                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-left hover:border-indigo-300"
                          >
                            <div className="font-bold text-zinc-700">{item.label}</div>
                            <div className="text-zinc-400">{item.value}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

                <span className={cn("text-zinc-400", isPhone ? "text-[11px] leading-4" : "text-xs")}>Use highlight from the toolbar (marker icon).</span>
              </div>
              {(penMode === 'free-draw' || penMode === 'write-to-text') && (
                <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 inline-flex items-center gap-1">
                    {penMode === 'free-draw' ? <PenLine size={12} /> : <Hand size={12} />}
                    {penMode === 'free-draw' ? 'Free Draw' : 'Write to Text'}
                  </span>
                  <input
                    type="color"
                    value={penColor}
                    onChange={(e) => setPenColor(e.target.value)}
                    className="h-8 w-10 rounded border border-zinc-200 bg-white"
                    title="Pen color"
                  />
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={penSize}
                    onChange={(e) => setPenSize(parseInt(e.target.value, 10))}
                  />
                  <span className="text-xs text-zinc-500">{penSize}px</span>
                  <button
                    onClick={() => clearPageLayer(penMode === 'free-draw' ? 'free' : 'handwriting', activePage)}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-xs font-semibold text-zinc-600 inline-flex items-center gap-1"
                  >
                    <Eraser size={12} />
                    Clear Page Ink
                  </button>
                  {penMode === 'write-to-text' && (
                    <button
                      onClick={convertHandwritingToText}
                      disabled={isConvertingHandwriting || !pageHandwriting[activePage]}
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {isConvertingHandwriting ? <Loader2 size={12} className="animate-spin" /> : <Type size={12} />}
                      Convert to Text
                    </button>
                  )}
                  <span className="text-[11px] text-zinc-500">
                    {penMode === 'free-draw'
                      ? 'Draw directly on this workbook page with mouse, touch, or pen.'
                      : 'Write notes, then convert handwriting into editable text.'}
                  </span>
                </div>
              )}
              {penMode === 'drawing-pad' && (
                <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Drawing Pad Notes</span>
                    <input
                      type="color"
                      value={penColor}
                      onChange={(e) => setPenColor(e.target.value)}
                      className="h-8 w-10 rounded border border-zinc-200 bg-white"
                      title="Pen color"
                    />
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={penSize}
                      onChange={(e) => setPenSize(parseInt(e.target.value, 10))}
                    />
                    <span className="text-xs text-zinc-500">{penSize}px</span>
                    <button
                      onClick={clearDrawingPad}
                      className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-xs font-semibold text-zinc-600 inline-flex items-center gap-1"
                    >
                      <Eraser size={12} />
                      Clear Pad
                    </button>
                    <button
                      onClick={insertDrawingPadIntoWorkbook}
                      disabled={!drawingPadData}
                      className="px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      Insert into Workbook
                    </button>
                  </div>
                  <div className="relative h-52 rounded-lg border border-zinc-200 bg-[repeating-linear-gradient(to_bottom,#ffffff_0px,#ffffff_23px,#e5e7eb_24px)] overflow-hidden">
                    <canvas
                      ref={(el) => {
                        drawingPadRef.current = el;
                        if (el?.parentElement) resizeCanvasToContainer(el, el.parentElement, drawingPadData);
                        if (drawingPadData && el) hasInkRef.current['pad'] = true;
                      }}
                      className="absolute inset-0 touch-none"
                      onPointerDown={beginPadDraw}
                      onPointerMove={continuePadDraw}
                      onPointerUp={endPadDraw}
                      onPointerCancel={endPadDraw}
                      onPointerLeave={endPadDraw}
                    />
                  </div>
                </div>
              )}
              <div id="workbook-toolbar" className={cn("ql-toolbar ql-snow rounded-xl border border-zinc-200", isPhone && "overflow-x-auto")}>
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
          </div>

        <div className={cn("flex-1 bg-zinc-100", isPhone ? "rounded-[28px] p-3" : "p-6")}>
          <div className={cn("mx-auto space-y-6", isPhone ? "max-w-full space-y-4" : "max-w-[794px]")}>
            {pages.map((pageContent, idx) => (
              <div
                key={`page-${idx}`}
                ref={(el) => { pageCardRefs.current[idx] = el; }}
                className={cn("relative bg-white border border-zinc-200 shadow-sm", isPhone ? "min-h-[62vh] rounded-[24px] p-3" : "min-h-[1123px] rounded-2xl p-8")}
              >
                <canvas
                  ref={(el) => registerPageCanvas('free', idx, el)}
                  className={cn(
                    "workbook-page-layer",
                    penMode === 'free-draw' ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
                  )}
                  onPointerDown={(e) => {
                    setActivePage(idx);
                    beginDrawing(e, idx, 'free');
                  }}
                  onPointerMove={(e) => continueDrawing(e, idx, 'free')}
                  onPointerUp={(e) => endDrawing(e, idx, 'free')}
                  onPointerCancel={(e) => endDrawing(e, idx, 'free')}
                  onPointerLeave={(e) => endDrawing(e, idx, 'free')}
                />
                <canvas
                  ref={(el) => registerPageCanvas('handwriting', idx, el)}
                  className={cn(
                    "workbook-page-layer",
                    penMode === 'write-to-text' ? "cursor-crosshair pointer-events-auto bg-white/45" : "pointer-events-none opacity-0"
                  )}
                  onPointerDown={(e) => {
                    setActivePage(idx);
                    beginDrawing(e, idx, 'handwriting');
                  }}
                  onPointerMove={(e) => continueDrawing(e, idx, 'handwriting')}
                  onPointerUp={(e) => endDrawing(e, idx, 'handwriting')}
                  onPointerCancel={(e) => endDrawing(e, idx, 'handwriting')}
                  onPointerLeave={(e) => endDrawing(e, idx, 'handwriting')}
                />
                <ReactQuill
                  theme="snow"
                  value={pageContent}
                  onChange={(val) => {
                    setPages((prev) => {
                      const next = prev.map((p, i) => (i === idx ? val : p));
                      setContent(next.join('\n\n'));
                      return next;
                    });
                  }}
                  onBlur={() => {
                    if (!smartReportMode) return;
                    const editor = quillRefs.current[idx]?.getEditor();
                    const current = editor?.root?.innerHTML ?? pages[idx] ?? '';
                    const nextVal = applySmartReport(current);
                    if (nextVal === smartReportLastRef.current || nextVal === current) return;
                    smartReportLastRef.current = nextVal;
                    setPages((prev) => {
                      const next = prev.map((p, i) => (i === idx ? nextVal : p));
                      setContent(next.join('\n\n'));
                      return next;
                    });
                  }}
                  ref={(el) => { quillRefs.current[idx] = el; }}
                  onFocus={() => setActivePage(idx)}
                  onFocusCapture={() => {
                    const editor = quillRefs.current[idx]?.getEditor();
                    if (editor) enableImageResizing(editor);
                    const enable = (editor as any)?.enableMathQuillFormulaAuthoring;
                    if (enable && !(editor as any).__mqEnabled && mathQuillReadyRef.current) {
                      try {
                        enable.call(editor, {
                          operators: [
                            ['\\frac{\\square}{\\square}', '\\frac{\\square}{\\square}'],
                            ['\\sqrt{\\square}', '\\sqrt{\\square}'],
                            ['\\sqrt[\\square]{\\square}', '\\sqrt[\\square]{\\square}'],
                            ['\\sum_{\\square}^{\\square}', '\\sum_{\\square}^{\\square}'],
                            ['\\int_{\\square}^{\\square}', '\\int_{\\square}^{\\square}'],
                            ['\\pi', '\\pi'],
                            ['\\theta', '\\theta'],
                            ['\\alpha', '\\alpha'],
                            ['\\beta', '\\beta'],
                            ['\\neq', '\\neq'],
                            ['\\le', '\\le'],
                            ['\\ge', '\\ge']
                          ],
                          displayHistory: true
                        });
                        (editor as any).__mqEnabled = true;
                      } catch (error) {
                        console.error('MathQuill enable failed', error);
                      }
                    }
                  }}
                  className={cn("workbook-editor", isPhone ? "min-h-[calc(62vh-24px)]" : "h-[calc(100%-40px)]")}
                  modules={quillModules}
                />
              </div>
            ))}
          </div>
          <div className={cn("mx-auto mt-4 flex justify-center", isPhone ? "max-w-full" : "max-w-[794px]")}>
            <button
              onClick={insertPageBreak}
              className={cn("rounded-full bg-zinc-100 font-bold text-zinc-700 hover:bg-zinc-200 transition-all", isPhone ? "w-full px-4 py-2.5 text-sm" : "px-4 py-2 text-xs")}
            >
              Add Page
            </button>
          </div>
          {assignments.length > 0 && (
            <div className="max-w-4xl mx-auto mt-6 bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4">Saved Workbooks</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignments.map((a) => (
                  <button
                    key={a.id}
                    onClick={async () => {
                      const fetched = await fetchWorkbookPages(a.id);
                      const loadedPages = fetched?.map((page) => page.content) ?? ((a as any).pages && Array.isArray((a as any).pages) ? (a as any).pages : [a.content || '']);
                      setCurrentAssignment(a);
                      setTitle(a.title);
                      setContent(a.content || loadedPages.join('\n\n'));
                      setPages(loadedPages);
                      setPageFreeDrawings(
                        fetched?.reduce<Record<number, string>>((acc, page, index) => {
                          if (page.freeDrawData) acc[index] = page.freeDrawData;
                          return acc;
                        }, {}) || {}
                      );
                      setPageHandwriting(
                        fetched?.reduce<Record<number, string>>((acc, page, index) => {
                          if (page.handwritingData) acc[index] = page.handwritingData;
                          return acc;
                        }, {}) || {}
                      );
                      setActivePage(0);
                    }}
                    className={cn(
                      "flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50/30",
                      currentAssignment?.id === a.id ? "border-indigo-600 bg-indigo-50/40" : ""
                    )}
                  >
                    <span className="font-bold text-zinc-900 truncate">{a.title}</span>
                    <span className="text-xs text-zinc-400">{formatDate(a.updatedAt)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
