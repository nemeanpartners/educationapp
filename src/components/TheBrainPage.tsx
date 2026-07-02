import { useEffect, useState } from 'react';
import { Brain, Upload, FileText, Loader2 } from 'lucide-react';
import { storage, db, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, onSnapshot, orderBy, query, where } from '@/lib/portal-firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { geminiGenerateContent } from '../services/geminiProxy';

export default function TheBrainPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState('');
  const [definitions, setDefinitions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [pastSummaries, setPastSummaries] = useState<any[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [docType, setDocType] = useState<'lecture' | 'essay' | 'question' | 'other'>('lecture');
  const [lastSavedSummary, setLastSavedSummary] = useState<string>('');

  const parseSummarySections = (text: string) => {
    const sections = ['Purpose', 'Key Points', 'Important Details', 'Action Items'];
    const result: { title: string; items: string[] }[] = [];
    let current: { title: string; items: string[] } | null = null;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const header = sections.find(s => line.toLowerCase().startsWith(s.toLowerCase() + ':'));
      if (header) {
        if (current) result.push(current);
        current = { title: header, items: [] };
        const rest = line.slice(header.length + 1).trim();
        if (rest.startsWith('-')) {
          current.items.push(rest.replace(/^-+\s*/, ''));
        } else if (rest) {
          current.items.push(rest);
        }
        continue;
      }
      if (!current) {
        current = { title: 'Summary', items: [] };
      }
      if (line.startsWith('-')) {
        current.items.push(line.replace(/^-+\s*/, ''));
      } else {
        current.items.push(line);
      }
    }
    if (current) result.push(current);
    return result.filter(s => s.items.length > 0);
  };

  useEffect(() => {
    let unsubSummaries = () => {};
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setPastSummaries([]);
        setSelectedSummaryId(null);
        return;
      }
      const q = query(
        collection(db, 'pdf_summaries'),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc')
      );
      unsubSummaries = onSnapshot(q, (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPastSummaries(items);
        if (!selectedSummaryId && items.length > 0) {
          setSelectedSummaryId(items[0].id);
        }
      }, (err) => {
        console.error('Error loading past summaries:', err);
        setError('Could not load past summaries.');
      });
    });
    return () => {
      unsubAuth();
      unsubSummaries();
    };
  }, [selectedSummaryId]);

  const handleSaveSummary = async () => {
    if (!auth.currentUser) {
      setError('Please sign in to save summaries.');
      return;
    }
    if (!summary.trim()) return;
    if (summary === lastSavedSummary) {
      setSaveStatus('Saved successfully.');
      return;
    }
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const docRef = await addDoc(collection(db, 'pdf_summaries'), {
        userId: auth.currentUser.uid,
        fileName: file?.name || '',
        summary: summary,
        updatedAt: new Date().toISOString(),
      });
      setSaveStatus('Saved successfully.');
      setLastSavedSummary(summary);
      setSelectedSummaryId(docRef.id);
    } catch (err) {
      console.error('Error saving summary:', err);
      setSaveStatus('Failed to save summary.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const uploadedFile = e.target.files[0];
    if (!auth.currentUser) {
      console.error('User not authenticated');
      setError('Please sign in to upload and summarize PDFs.');
      return;
    }
    if (uploadedFile.size > 15 * 1024 * 1024) {
      setError('PDF too large. Please upload a file under 15MB.');
      return;
    }
    setError(null);
    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      // 1. Upload to Firebase Storage
      const storageRef = ref(storage, `pdfs/${auth.currentUser?.uid}/${uploadedFile.name}`);
      await uploadBytes(storageRef, uploadedFile);
      const downloadURL = await getDownloadURL(storageRef);

      // 2. Process with Gemini
      // Read file content as base64
      const reader = new FileReader();
      reader.readAsDataURL(uploadedFile);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const typeInstruction =
          docType === 'lecture'
            ? 'This is a lecture PDF. Focus on key concepts, definitions, and examples.'
            : docType === 'essay'
              ? 'This is an essay. Focus on the thesis, arguments, evidence, and conclusion.'
              : docType === 'question'
                ? 'This is a question sheet. Focus on the main tasks, requirements, and topics to prepare.'
                : 'General academic PDF. Focus on the main ideas and takeaways.';
        const prompt = `Summarize this PDF in sections with dot points only. Use exactly this format and nothing else:
Purpose:
- ...
Key Points:
- ...
Important Details:
- ...
Action Items:
- ...
Rules: Use short plain sentences. Start each bullet with a hyphen and space. No markdown, no asterisks, no bold/italics.
Context: ${typeInstruction}`;

        const tryGenerate = async (attempt: number): Promise<string> => {
          try {
            const response = await geminiGenerateContent({
              model: 'gemini-3-flash-preview',
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64Data,
                    },
                  },
                  { text: prompt },
                ],
              },
              config: {
                responseMimeType: 'text/plain',
              },
            });
            return response.text || '';
          } catch (err: any) {
            const message = typeof err?.message === 'string' ? err.message : '';
            if ((message.includes('503') || message.includes('UNAVAILABLE')) && attempt < 2) {
              await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
              return tryGenerate(attempt + 1);
            }
            throw err;
          }
        };

        try {
          const resultText = await tryGenerate(0);

          // 3. Store results in Firestore
          await addDoc(collection(db, 'brain_summaries'), {
            userId: auth.currentUser?.uid,
            fileName: uploadedFile.name,
            downloadURL,
            summary: resultText,
            createdAt: new Date().toISOString(),
          });

          setSummary(resultText);
        } catch (err: any) {
          console.error('Error summarizing PDF:', err);
          const message = typeof err?.message === 'string' ? err.message : '';
          if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
            setError('Gemini is rate-limited right now. Please wait 60 seconds and try again.');
          } else if (message.includes('UNAVAILABLE') || message.includes('503')) {
            setError('Gemini is busy right now. Please try again in a minute.');
          } else {
            setError('Failed to summarize this PDF. Please try again.');
          }
        } finally {
          setIsProcessing(false);
        }
      };
      reader.onerror = (err) => {
        console.error('Error reading PDF:', err);
        setError('Could not read the PDF. Please try another file.');
        setIsProcessing(false);
      };

    } catch (error) {
      console.error('Error processing PDF:', error);
      setError('Upload failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex items-center gap-4">
        <div className="rounded-2xl bg-purple-100 p-4 text-purple-600">
          <Brain size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-zinc-900">The Brain</h1>
          <p className="text-zinc-500">Upload your school PDFs and let AI summarize them.</p>
        </div>
      </header>

      <div className="rounded-3xl border-2 border-dashed border-zinc-200 bg-white p-12 text-center">
        <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" id="pdf-upload" />
        <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-4">
          <div className="rounded-full bg-zinc-100 p-6">
            <Upload size={32} className="text-zinc-500" />
          </div>
          <p className="text-lg font-bold text-zinc-900">Upload PDF</p>
          <p className="text-sm text-zinc-500">Click to upload your school notes or syllabus.</p>
        </label>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm">
        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">PDF Type</label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as any)}
          className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 focus:ring-1 focus:ring-indigo-500 outline-none"
        >
          <option value="lecture">Lecture Notes</option>
          <option value="essay">Essay</option>
          <option value="question">Question Sheet</option>
          <option value="other">Other</option>
        </select>
      </div>

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-zinc-500">
          <Loader2 className="animate-spin" />
          Processing PDF...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-2xl p-4 text-sm font-medium">
          {error}
        </div>
      )}

      {summary && (
        <div className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Summary</h2>
            <button
              onClick={handleSaveSummary}
              disabled={isSaving || summary === lastSavedSummary}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isSaving || summary === lastSavedSummary
                  ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {summary === lastSavedSummary ? 'Saved' : isSaving ? 'Saving...' : 'Save Summary'}
            </button>
          </div>
          {saveStatus && (
            <div className="mb-3 text-sm font-medium text-zinc-500">{saveStatus}</div>
          )}
          <div className="space-y-4">
            {parseSummarySections(summary).map((section) => (
              <div key={section.title}>
                <div className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-2">{section.title}</div>
                <ul className="list-disc pl-5 text-zinc-700 leading-relaxed">
                  {section.items.map((item, idx) => (
                    <li key={`${section.title}-${idx}`} className="mb-1">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {pastSummaries.length > 0 && (
        <div className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-lg">
          <h2 className="text-xl font-bold mb-4">Past Summaries</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pastSummaries.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedSummaryId(item.id)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  selectedSummaryId === item.id
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-zinc-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div className="text-sm font-bold text-zinc-900 line-clamp-2">
                  {item.fileName || 'PDF Summary'}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}
                </div>
              </button>
            ))}
          </div>

          {selectedSummaryId && (
            <div className="mt-6">
              {(() => {
                const selected = pastSummaries.find(s => s.id === selectedSummaryId);
                if (!selected?.summary) return null;
                return (
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6">
                    <div className="space-y-4">
                      {parseSummarySections(selected.summary).map((section) => (
                        <div key={section.title}>
                          <div className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-2">{section.title}</div>
                          <ul className="list-disc pl-5 text-zinc-700 leading-relaxed">
                            {section.items.map((item: string, idx: number) => (
                              <li key={`${section.title}-${idx}`} className="mb-1">{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
