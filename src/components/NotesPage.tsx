import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Loader2, FolderPlus, MoreHorizontal } from 'lucide-react';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from '@/lib/portal-firestore';
import { Note } from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

const COLORS = ['bg-amber-100', 'bg-sky-100', 'bg-emerald-100', 'bg-rose-100', 'bg-purple-100'];

export default function NotesPage() {
  const { isPhone } = useResponsiveDevice();
  const [searchParams] = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('All Notes');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [openNoteMenuId, setOpenNoteMenuId] = useState<string | null>(null);
  const [phoneMenuPosition, setPhoneMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, 'notes'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'notes');
          setLoading(false);
        });
      } else {
        setLoading(false);
        setNotes([]);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribe();
    };
  }, []);

  const addNote = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'notes'), {
        userId: user.uid,
        title: 'New Note',
        text: '',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        folder: selectedFolder === 'All Notes' ? 'General' : selectedFolder,
        position: { x: 0, y: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes');
    } finally {
      setIsAdding(false);
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    try {
      await updateDoc(doc(db, 'notes', id), { ...updates, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notes/${id}`);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `notes/${id}`);
    }
  };

  const folders = useMemo(() => {
    const fromNotes = Array.from(new Set(notes.map((note) => note.folder || 'General')));
    return ['All Notes', ...Array.from(new Set(['General', ...customFolders, ...fromNotes]))];
  }, [customFolders, notes]);

  useEffect(() => {
    const requestedFolder = searchParams.get('folder');
    if (!requestedFolder) return;
    if (folders.includes(requestedFolder)) {
      setSelectedFolder(requestedFolder);
    }
  }, [folders, searchParams]);

  const visibleNotes = useMemo(() => {
    if (selectedFolder === 'All Notes') return notes;
    return notes.filter((note) => (note.folder || 'General') === selectedFolder);
  }, [notes, selectedFolder]);

  const createFolder = () => {
    const clean = newFolderName.trim();
    if (!clean) return;
    if (!customFolders.includes(clean)) {
      setCustomFolders((current) => [...current, clean]);
    }
    setSelectedFolder(clean);
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const openNoteMenu = (noteId: string, target: HTMLButtonElement) => {
    if (!isPhone) {
      setOpenNoteMenuId((current) => current === noteId ? null : noteId);
      return;
    }

    if (openNoteMenuId === noteId) {
      setOpenNoteMenuId(null);
      setPhoneMenuPosition(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const menuWidth = Math.min(220, window.innerWidth - 24);
    const estimatedHeight = 208;
    const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
    const top = rect.bottom + estimatedHeight + 12 > window.innerHeight
      ? Math.max(12, rect.top - estimatedHeight - 10)
      : rect.bottom + 8;

    setPhoneMenuPosition({ top, left });
    setOpenNoteMenuId(noteId);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className={cn("mx-auto max-w-7xl", isPhone ? "p-4" : "p-8")}>
      <div className={cn("mb-6 flex gap-4", isPhone ? "items-center justify-between" : "mb-8 items-center justify-between")}>
        <h1 className={cn("font-black text-zinc-900", isPhone ? "text-[1.8rem] leading-none" : "text-3xl")}>My Notes</h1>
        <button onClick={addNote} className={cn(
          "flex items-center gap-2 bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100",
          isPhone ? "rounded-2xl px-3.5 py-2.5 text-xs" : "rounded-2xl px-6 py-3"
        )}>
          <Plus className={cn(isPhone ? "h-4 w-4" : "h-5 w-5")} />
          Add Note
        </button>
      </div>

      <div className={cn("mb-5", isPhone ? "space-y-3" : "mb-8 space-y-4")}>
        <div className={cn("flex gap-2 overflow-x-auto pb-1", isPhone ? "" : "flex-wrap overflow-visible pb-0")}>
          {folders.map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setSelectedFolder(folder)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-all",
                selectedFolder === folder
                  ? "border-indigo-200 bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              )}
            >
              {folder}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowNewFolderInput((current) => !current)}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-600 hover:bg-zinc-50"
          >
            <span className="inline-flex items-center gap-2">
              <FolderPlus className="h-4 w-4" />
              Folder
            </span>
          </button>
        </div>

        {showNewFolderInput && (
          <div className={cn("flex gap-2", isPhone ? "flex-col" : "items-center")}>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createFolder();
              }}
              placeholder="Create a folder"
              className={cn(
                "rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10",
                isPhone ? "w-full text-sm" : "w-72 text-sm"
              )}
            />
            <button
              type="button"
              onClick={createFolder}
              className={cn(
                "rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800",
                isPhone && "w-full"
              )}
            >
              Save folder
            </button>
          </div>
        )}
      </div>

      <div className={cn("grid", isPhone ? "grid-cols-2 gap-4" : "grid-cols-4 gap-6")}>
        <AnimatePresence>
          {visibleNotes.map((note) => {
            const textLength = `${note.title} ${note.text}`.trim().length;
            const isLongNote = textLength > 90 || (note.text?.split(/\s+/).length || 0) > 14;

            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  "relative border shadow-sm flex flex-col gap-2",
                  isPhone
                    ? cn(
                        "rounded-[26px] p-4",
                        isLongNote ? "col-span-2 min-h-[168px]" : "aspect-[0.84] min-h-[188px]"
                      )
                    : "aspect-[3/4] rounded-3xl p-6",
                  note.color
                )}
              >
                <div className={cn("absolute", isPhone ? "right-2.5 top-2.5 z-20" : "right-4 top-4 z-10")}>
                  <button
                    type="button"
                    onClick={(e) => openNoteMenu(note.id, e.currentTarget)}
                    className={cn(
                      "rounded-full border border-zinc-200 bg-white/90 text-zinc-500 shadow-sm transition hover:bg-white hover:text-zinc-700",
                      isPhone ? "p-2" : "p-2"
                    )}
                  >
                    <MoreHorizontal className={cn(isPhone ? "h-4.5 w-4.5" : "h-4 w-4")} />
                  </button>

                  {openNoteMenuId === note.id && !isPhone && (
                    <div className="absolute right-0 top-12 w-52 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                      <p className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Move to folder</p>
                      <select
                        value={note.folder || 'General'}
                        onChange={(e) => {
                          updateNote(note.id, { folder: e.target.value });
                          setOpenNoteMenuId(null);
                        }}
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-700 outline-none"
                      >
                        {folders.filter((folder) => folder !== 'All Notes').map((folder) => (
                          <option key={folder} value={folder}>{folder}</option>
                        ))}
                      </select>

                      <p className="mt-4 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Change colour</p>
                      <div className="mt-2 flex items-center gap-2">
                        {COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              updateNote(note.id, { color });
                              setOpenNoteMenuId(null);
                            }}
                            className={cn(
                              "h-6 w-6 rounded-full border border-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
                              color
                            )}
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          setOpenNoteMenuId(null);
                          deleteNote(note.id);
                        }}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete note
                      </button>
                    </div>
                  )}
                </div>

                <input
                  value={note.title}
                  onChange={(e) => updateNote(note.id, { title: e.target.value })}
                  className={cn(
                    "bg-transparent font-black outline-none",
                    isPhone ? "pr-11 text-[1.05rem] leading-6" : "text-lg"
                  )}
                />
                <textarea
                  value={note.text}
                  onChange={(e) => updateNote(note.id, { text: e.target.value })}
                  className={cn(
                    "flex-1 bg-transparent outline-none resize-none",
                    isPhone ? "pr-7 text-sm leading-6" : "text-sm"
                  )}
                />
                <div className={cn("mt-1", isPhone ? "mt-auto pt-3" : "mt-auto pt-2")}>
                  <div className={cn(isPhone ? "flex items-center justify-between gap-2" : "flex min-w-0 items-center gap-2")}>
                    <span className={cn(
                      "rounded-full border border-zinc-200 bg-white/80 font-bold text-zinc-600",
                      isPhone ? "px-3 py-1.5 text-[11px]" : "px-3 py-1.5 text-xs"
                    )}>
                      {note.folder || 'General'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {isPhone && openNoteMenuId && (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Close note menu"
            className="absolute inset-0"
            onClick={() => {
              setOpenNoteMenuId(null);
              setPhoneMenuPosition(null);
            }}
          />
          <div
            className="absolute w-[188px] max-w-[calc(100vw-24px)] rounded-[20px] border border-zinc-200 bg-white/98 p-2.5 shadow-[0_16px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl"
            style={{
              top: phoneMenuPosition?.top ?? 12,
              left: phoneMenuPosition?.left ?? 12,
            }}
          >
            {(() => {
              const activeNote = notes.find((entry) => entry.id === openNoteMenuId);
              if (!activeNote) return null;

              return (
                <>
                  <p className="px-1 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">Move to folder</p>
                  <select
                    value={activeNote.folder || 'General'}
                    onChange={(e) => {
                      updateNote(activeNote.id, { folder: e.target.value });
                      setOpenNoteMenuId(null);
                      setPhoneMenuPosition(null);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] font-bold text-zinc-700 outline-none"
                  >
                    {folders.filter((folder) => folder !== 'All Notes').map((folder) => (
                      <option key={folder} value={folder}>{folder}</option>
                    ))}
                  </select>

                  <p className="mt-3 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">Change colour</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => {
                          updateNote(activeNote.id, { color });
                          setOpenNoteMenuId(null);
                          setPhoneMenuPosition(null);
                        }}
                        className={cn(
                          "h-9 w-9 rounded-full border-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
                          activeNote.color === color ? "border-zinc-900" : "border-zinc-200",
                          color
                        )}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setOpenNoteMenuId(null);
                      setPhoneMenuPosition(null);
                      deleteNote(activeNote.id);
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-black text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete note
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
