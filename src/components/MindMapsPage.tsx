import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  GitBranch,
  Loader2,
  Map,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { geminiGenerateContent } from '../services/geminiProxy';
import { cn } from '../lib/utils';

type MindMapNode = {
  id: string;
  title: string;
  note: string;
  color: string;
  collapsed?: boolean;
  children: MindMapNode[];
};

const colors = ['#14b8a6', '#6366f1', '#f97316', '#ec4899', '#22c55e', '#0ea5e9', '#a855f7'];

const starterMap: MindMapNode = {
  id: 'root',
  title: 'Photosynthesis',
  note: 'How plants convert light energy into chemical energy.',
  color: colors[0],
  children: [
    {
      id: 'light',
      title: 'Light energy',
      note: 'Captured by chlorophyll in chloroplasts.',
      color: colors[1],
      children: [
        { id: 'chlorophyll', title: 'Chlorophyll', note: 'Green pigment that absorbs light.', color: colors[1], children: [] },
      ],
    },
    {
      id: 'inputs',
      title: 'Inputs',
      note: 'Carbon dioxide, water, and sunlight.',
      color: colors[2],
      children: [
        { id: 'co2', title: 'CO2', note: 'Enters through stomata.', color: colors[2], children: [] },
        { id: 'water', title: 'Water', note: 'Absorbed by roots.', color: colors[2], children: [] },
      ],
    },
    {
      id: 'outputs',
      title: 'Outputs',
      note: 'Glucose and oxygen.',
      color: colors[4],
      children: [
        { id: 'glucose', title: 'Glucose', note: 'Stored chemical energy.', color: colors[4], children: [] },
        { id: 'oxygen', title: 'Oxygen', note: 'Released as a by-product.', color: colors[4], children: [] },
      ],
    },
  ],
};

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function cloneMap(node: MindMapNode): MindMapNode {
  return {
    ...node,
    children: node.children.map(cloneMap),
  };
}

function updateNode(node: MindMapNode, id: string, updater: (node: MindMapNode) => MindMapNode): MindMapNode {
  if (node.id === id) return updater(node);
  return { ...node, children: node.children.map((child) => updateNode(child, id, updater)) };
}

function deleteNode(node: MindMapNode, id: string): MindMapNode {
  return {
    ...node,
    children: node.children
      .filter((child) => child.id !== id)
      .map((child) => deleteNode(child, id)),
  };
}

function findNode(node: MindMapNode, id: string): MindMapNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function countNodes(node: MindMapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

function maxDepth(node: MindMapNode, depth = 1): number {
  if (node.children.length === 0) return depth;
  return Math.max(...node.children.map((child) => maxDepth(child, depth + 1)));
}

function outlineText(node: MindMapNode, level = 0): string {
  const indent = '  '.repeat(level);
  const current = `${indent}- ${node.title}${node.note ? `: ${node.note}` : ''}`;
  if (node.collapsed) return current;
  return [current, ...node.children.map((child) => outlineText(child, level + 1))].join('\n');
}

function sanitizeGeneratedNode(raw: any, fallbackTitle: string, depth = 0): MindMapNode {
  const rawChildren = Array.isArray(raw?.children) ? raw.children.slice(0, depth === 0 ? 7 : 5) : [];
  return {
    id: createId(),
    title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 80) : fallbackTitle,
    note: typeof raw?.note === 'string' ? raw.note.trim().slice(0, 180) : '',
    color: colors[depth % colors.length],
    children: depth >= 3
      ? []
      : rawChildren.map((child: any, index: number) => sanitizeGeneratedNode(child, `Branch ${index + 1}`, depth + 1)),
  };
}

function buildPrompt(topic: string, className: string, detail: string) {
  return `Create a study mind map as JSON only.

Topic: ${topic}
Class: ${className}
Focus/details: ${detail || 'Core concepts, relationships, examples, and study cues.'}

Mind map rules:
- The central node should be the topic.
- Branches should group related ideas, not list random facts.
- Each child should connect logically to its parent.
- Include concise notes that explain why the idea matters.
- Use 4 to 7 main branches.
- Use up to 3 levels deep.

Return valid JSON only with this schema:
{
  "title": "Central topic",
  "note": "One sentence overview",
  "children": [
    {
      "title": "Branch",
      "note": "Why this branch matters",
      "children": [
        { "title": "Sub idea", "note": "Short explanation", "children": [] }
      ]
    }
  ]
}`;
}

export default function MindMapsPage() {
  const [map, setMap] = useState<MindMapNode>(() => cloneMap(starterMap));
  const [selectedId, setSelectedId] = useState('root');
  const [topic, setTopic] = useState('Photosynthesis');
  const [className, setClassName] = useState('Science');
  const [detail, setDetail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedNode = useMemo(() => findNode(map, selectedId) || map, [map, selectedId]);
  const nodeCount = useMemo(() => countNodes(map), [map]);
  const depth = useMemo(() => maxDepth(map), [map]);

  const addChild = (parentId = selectedId) => {
    const child: MindMapNode = {
      id: createId(),
      title: 'New idea',
      note: 'Add a short explanation.',
      color: colors[Math.floor(Math.random() * colors.length)],
      children: [],
    };
    setMap((current) => updateNode(current, parentId, (node) => ({ ...node, collapsed: false, children: [...node.children, child] })));
    setSelectedId(child.id);
  };

  const updateSelected = (patch: Partial<MindMapNode>) => {
    setMap((current) => updateNode(current, selectedId, (node) => ({ ...node, ...patch })));
  };

  const removeSelected = () => {
    if (selectedId === 'root') return;
    setMap((current) => deleteNode(current, selectedId));
    setSelectedId('root');
  };

  const generateMap = async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError('Add a topic first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await geminiGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: buildPrompt(trimmedTopic, className, detail.trim()),
        config: {
          responseMimeType: 'application/json',
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      const generated = sanitizeGeneratedNode(parsed, trimmedTopic);
      generated.id = 'root';
      generated.color = colors[0];
      setMap(generated);
      setSelectedId('root');
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : '';
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        setError('The AI is rate-limited right now. Wait a minute and try again.');
      } else if (message.includes('503') || message.includes('UNAVAILABLE')) {
        setError('The AI is busy right now. Try again shortly.');
      } else {
        setError(message || 'Could not generate a mind map.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyOutline = async () => {
    await navigator.clipboard.writeText(outlineText(map));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${map.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'mind-map'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative isolate -m-8 min-h-[calc(100vh-80px)] overflow-hidden bg-[#f4f5f7] p-6 sm:p-8 lg:p-12">
      <div className="pointer-events-none absolute left-[8%] top-16 h-56 w-56 rounded-full bg-teal-300/35 blur-3xl" />
      <div className="pointer-events-none absolute right-[12%] top-14 h-72 w-72 rounded-full bg-indigo-300/30 blur-[72px]" />
      <div className="pointer-events-none absolute bottom-16 left-[24%] h-48 w-72 rounded-full bg-amber-300/30 blur-[64px]" />
      <div className="pointer-events-none absolute bottom-24 right-[18%] h-52 w-52 rounded-full bg-emerald-300/25 blur-[70px]" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <header className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/60 bg-white/35 text-teal-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
                <Map size={30} />
              </div>
              <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-900">Mind Maps</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-600">
                Build interactive study maps that connect a central topic to key branches, examples, formulas, and memory cues.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
              <Stat label="Nodes" value={nodeCount} />
              <Stat label="Depth" value={depth} />
              <Stat label="Branches" value={map.children.length} />
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/55 bg-white/30 text-teal-600 backdrop-blur-xl">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900">Generate with AI</h2>
                  <p className="text-sm font-medium text-zinc-500">A good mind map groups ideas and shows relationships.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Topic</label>
                  <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-white/55 bg-white/45 px-4 py-3 text-sm font-bold text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Class</label>
                  <select
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-white/55 bg-white/45 px-4 py-3 text-sm font-bold text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl focus:ring-2 focus:ring-teal-500"
                  >
                    {['General', 'Science', 'Mathematics', 'English', 'History', 'Geography', 'Biology', 'Chemistry', 'Physics', 'Business'].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="mt-4 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Focus details</label>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="Optional: paste syllabus points, question text, textbook section, or what you need to remember."
                className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-white/55 bg-white/45 px-4 py-3 text-sm font-semibold leading-6 text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl placeholder:text-zinc-400 focus:ring-2 focus:ring-teal-500"
              />

              {error && (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
              )}

              <button
                onClick={generateMap}
                disabled={isGenerating || !topic.trim()}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-teal-200 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generate mind map
              </button>
            </div>

            <div className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/55 bg-white/30 text-teal-600 backdrop-blur-xl">
                  <GitBranch size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-zinc-900">Edit selected idea</h2>
                  <p className="text-sm font-medium text-zinc-500">Click any node in the map or outline.</p>
                </div>
              </div>

              <label className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Title</label>
              <input
                value={selectedNode.title}
                onChange={(event) => updateSelected({ title: event.target.value })}
                className="mt-3 w-full rounded-2xl border border-white/55 bg-white/45 px-4 py-3 text-sm font-bold text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl focus:ring-2 focus:ring-teal-500"
              />

              <label className="mt-4 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Note</label>
              <textarea
                value={selectedNode.note}
                onChange={(event) => updateSelected({ note: event.target.value })}
                className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-white/55 bg-white/45 px-4 py-3 text-sm font-semibold leading-6 text-zinc-900 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-xl focus:ring-2 focus:ring-teal-500"
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => addChild()} className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-200 transition hover:bg-teal-700">
                  <Plus size={17} />
                  Add child
                </button>
                <button onClick={() => updateSelected({ collapsed: !selectedNode.collapsed })} className="inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/35 px-4 py-3 text-sm font-black text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl transition hover:bg-white/55">
                  {selectedNode.collapsed ? <Eye size={17} /> : <EyeOff size={17} />}
                  {selectedNode.collapsed ? 'Expand' : 'Collapse'}
                </button>
                <button
                  onClick={removeSelected}
                  disabled={selectedId === 'root'}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={17} />
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-zinc-900">Interactive map</h2>
                  <p className="text-sm font-medium text-zinc-500">Use branches to chunk knowledge, compare ideas, and remember links.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={copyOutline} className="inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/35 px-4 py-2 text-xs font-black text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl transition hover:bg-white/55">
                    <Copy size={15} />
                    {copied ? 'Copied' : 'Copy outline'}
                  </button>
                  <button onClick={downloadJson} className="inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/35 px-4 py-2 text-xs font-black text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl transition hover:bg-white/55">
                    <Download size={15} />
                    Export
                  </button>
                </div>
              </div>

              <div className="min-h-[560px] overflow-auto rounded-3xl border border-white/55 bg-white/30 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                <MindMapCanvas node={map} selectedId={selectedId} onSelect={setSelectedId} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/60 bg-white/35 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-3xl">
              <h2 className="text-xl font-black text-zinc-900">Outline view</h2>
              <p className="mt-1 text-sm font-medium text-zinc-500">Collapse branches when revising one part at a time.</p>
              <div className="mt-4 space-y-2">
                <OutlineNode node={map} selectedId={selectedId} onSelect={setSelectedId} onToggle={(id) => setMap((current) => updateNode(current, id, (node) => ({ ...node, collapsed: !node.collapsed })))} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/35 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl">
      <p className="text-lg font-black text-zinc-900">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</p>
    </div>
  );
}

function MindMapCanvas({
  node,
  selectedId,
  onSelect,
}: {
  node: MindMapNode;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex min-w-[760px] items-center gap-10">
      <MindMapBubble node={node} selectedId={selectedId} onSelect={onSelect} root />
      {!node.collapsed && node.children.length > 0 && (
        <div className="flex flex-col gap-6">
          {node.children.map((child) => (
            <div key={child.id} className="flex items-center gap-6">
              <Connector color={child.color} />
              <MindMapBranch node={child} selectedId={selectedId} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MindMapBranch({
  node,
  selectedId,
  onSelect,
}: {
  node: MindMapNode;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-6">
      <MindMapBubble node={node} selectedId={selectedId} onSelect={onSelect} />
      {!node.collapsed && node.children.length > 0 && (
        <div className="flex flex-col gap-4">
          {node.children.map((child) => (
            <div key={child.id} className="flex items-center gap-4">
              <Connector color={child.color} small />
              <MindMapBranch node={child} selectedId={selectedId} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MindMapBubble({
  node,
  selectedId,
  onSelect,
  root = false,
}: {
  node: MindMapNode;
  selectedId: string;
  onSelect: (id: string) => void;
  root?: boolean;
}) {
  const selected = selectedId === node.id;
  return (
    <button
      onClick={() => onSelect(node.id)}
      className={cn(
        'shrink-0 rounded-[1.5rem] border bg-white/60 p-4 text-left shadow-[0_16px_35px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl transition hover:-translate-y-0.5',
        root ? 'w-60' : 'w-52',
        selected ? 'border-zinc-900 ring-4 ring-white/60' : 'border-white/60',
      )}
      style={{ borderTopColor: node.color, borderTopWidth: 5 }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: node.color }} />
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
          {root ? 'Central idea' : node.collapsed ? 'Collapsed' : 'Branch'}
        </span>
      </div>
      <p className={cn('font-black text-zinc-900', root ? 'text-xl' : 'text-base')}>{node.title}</p>
      {node.note ? <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-zinc-500">{node.note}</p> : null}
    </button>
  );
}

function Connector({ color, small = false }: { color: string; small?: boolean }) {
  return (
    <div className={cn('relative shrink-0', small ? 'w-10' : 'w-14')}>
      <div className="h-1 rounded-full" style={{ backgroundColor: color, opacity: 0.45 }} />
      <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
}

function OutlineNode({
  node,
  selectedId,
  onSelect,
  onToggle,
  level = 0,
}: {
  node: MindMapNode;
  selectedId: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  level?: number;
}) {
  const selected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div className="flex items-start gap-2" style={{ paddingLeft: level * 18 }}>
        <button
          onClick={() => hasChildren && onToggle(node.id)}
          className="mt-1 rounded-lg p-1 text-zinc-400 hover:bg-white/40 hover:text-zinc-900"
          aria-label={node.collapsed ? 'Expand branch' : 'Collapse branch'}
        >
          {hasChildren ? node.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} /> : <span className="block h-4 w-4" />}
        </button>
        <button
          onClick={() => onSelect(node.id)}
          className={cn(
            'flex-1 rounded-2xl border p-3 text-left transition',
            selected ? 'border-zinc-900 bg-white/60' : 'border-white/45 bg-white/25 hover:bg-white/40',
          )}
        >
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: node.color }} />
            <p className="font-black text-zinc-900">{node.title}</p>
          </div>
          {node.note ? <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">{node.note}</p> : null}
        </button>
      </div>
      {!node.collapsed && node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <OutlineNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} onToggle={onToggle} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
