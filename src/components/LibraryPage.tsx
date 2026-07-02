import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Library,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';

type LibraryItem = {
  id: string;
  title: string;
  creator: string;
  subject: string;
  year: string;
  source: string;
  description: string;
  coverUrl: string | null;
  primaryUrl: string | null;
  readUrl: string | null;
  pdfUrl: string | null;
  accessLabel: string;
  type: 'book' | 'article';
};

type LibraryMode = 'all' | 'qcaa' | 'australia';

const quickSearches = ['algebra', 'biology', 'Rome', 'essay writing', 'chemistry', 'coding'];
const modeOptions: { id: LibraryMode; label: string; helper: string }[] = [
  { id: 'all', label: 'All', helper: 'General library results' },
  { id: 'qcaa', label: 'QCAA', helper: 'Queensland syllabus and QCAA-steered results' },
  { id: 'australia', label: 'Australia', helper: 'Australian curriculum and local relevance' },
];

export default function LibraryPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('algebra');
  const [searchInput, setSearchInput] = useState('algebra');
  const [mode, setMode] = useState<LibraryMode>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [books, setBooks] = useState<LibraryItem[]>([]);
  const [articles, setArticles] = useState<LibraryItem[]>([]);

  const runSearch = async (term = searchInput, selectedMode = mode) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) {
      setMessage('Type something to search first.');
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setQuery(cleanTerm);

    try {
      const response = await fetch(`/api/library-search?${new URLSearchParams({ q: cleanTerm, mode: selectedMode }).toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Library search failed.');
      setBooks(Array.isArray(data?.books) ? data.books : []);
      setArticles(Array.isArray(data?.articles) ? data.articles : []);
      if (!(data?.books?.length || data?.articles?.length)) {
        setMessage(selectedMode === 'all'
          ? 'No books or free articles matched this search.'
          : `No ${selectedMode === 'qcaa' ? 'QCAA / Queensland' : 'Australian'} results matched this search.`);
      }
    } catch (error) {
      console.error('Library search error:', error);
      setMessage(error instanceof Error ? error.message : 'Library search failed.');
      setBooks([]);
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const requestedQuery = searchParams.get('q')?.trim();
    const requestedMode = searchParams.get('mode') as LibraryMode | null;
    const nextMode = requestedMode && modeOptions.some((option) => option.id === requestedMode) ? requestedMode : 'all';
    const initialQuery = requestedQuery || 'algebra';
    setSearchInput(initialQuery);
    setMode(nextMode);
    runSearch(initialQuery, nextMode);
  }, [searchParams]);

  const totalResults = useMemo(() => books.length + articles.length, [books, articles]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <section className="rounded-[32px] border border-violet-200 bg-white p-8 shadow-xl shadow-violet-50">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] xl:items-center">
          <div className="min-w-0 max-w-3xl">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-violet-50 text-violet-600">
              <Library size={30} />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-zinc-900">Library</h1>
            <p className="mt-3 max-w-2xl text-lg font-medium leading-8 text-zinc-500">
              Browse real books and open-access articles from public online libraries. Search once, then open records, PDFs, or reading pages.
            </p>
          </div>

          <div className="w-full rounded-[28px] border border-zinc-200 bg-zinc-50 p-4">
            <label className="mb-3 block text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Search the library</label>
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') runSearch();
                  }}
                  placeholder="Search books, topics, authors, or study subjects..."
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />
              </div>
              <button
                onClick={() => runSearch()}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-violet-100 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none lg:min-w-[220px]"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Browse Library
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {modeOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setMode(option.id);
                    runSearch(searchInput, option.id);
                  }}
                  className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                    mode === option.id
                      ? 'border-violet-300 bg-violet-600 text-white'
                      : 'border-zinc-200 bg-white text-zinc-500 hover:border-violet-300 hover:text-violet-700'
                  }`}
                  title={option.helper}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchInput(term);
                    runSearch(term, mode);
                  }}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-black text-zinc-500 transition hover:border-violet-300 hover:text-violet-700"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Search term', value: query || 'None' },
          { label: 'Search mode', value: mode === 'all' ? 'All' : mode === 'qcaa' ? 'QCAA' : 'Australia' },
          { label: 'Books found', value: String(books.length) },
          { label: 'Free articles', value: String(articles.length) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">{stat.label}</p>
            <p className="mt-2 break-words text-3xl font-black text-zinc-900">{stat.value}</p>
          </div>
        ))}
      </section>

      {message && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-700">
          {message}
        </div>
      )}

      <section className="grid gap-8 2xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <BookOpen size={19} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-900">Books</h2>
              <p className="text-sm font-medium text-zinc-500">Open Library records and borrow/read links when available.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {books.length === 0 ? (
              <EmptyState text={isLoading ? 'Searching books...' : 'No books found yet.'} />
            ) : books.map((book) => (
              <ResourceCard key={book.id} item={book} />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <FileText size={19} />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-zinc-900">Free Articles</h2>
              <p className="text-sm font-medium text-zinc-500">Open-access articles and direct PDF links when the source provides them.</p>
            </div>
          </div>

          <div className="space-y-4">
            {articles.length === 0 ? (
              <EmptyState text={isLoading ? 'Searching articles...' : 'No free articles found yet.'} />
            ) : articles.map((article) => (
              <ResourceCard key={article.id} item={article} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-dashed border-zinc-200 bg-zinc-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Next step placeholder</p>
        <h3 className="mt-2 text-xl font-black text-zinc-900">Free PDF and article enrichment</h3>
        <p className="mt-2 text-sm font-medium leading-7 text-zinc-500">
          This library already uses public book and open-access article sources. If you want broader PDF discovery later, this is the place to plug in Google search or another indexed document source behind the backend.
        </p>
        <p className="mt-4 text-sm font-bold text-zinc-500">
          Current live result count: {totalResults}
        </p>
      </section>
    </div>
  );
}

function ResourceCard({ item, compact = false }: { item: LibraryItem; compact?: boolean }) {
  return (
    <article className={`rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm min-w-0 ${compact ? '' : 'lg:min-h-[320px]'}`}>
      <div className={`flex gap-4 min-w-0 ${compact ? 'items-start' : 'items-start'}`}>
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.title}
            className="h-28 w-20 shrink-0 rounded-2xl object-cover shadow-sm lg:h-36 lg:w-24"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 lg:h-20 lg:w-20">
            {item.type === 'book' ? <BookOpen size={22} /> : <FileText size={22} />}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${item.type === 'book' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {item.type}
            </span>
            {item.year && (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                {item.year}
              </span>
            )}
          </div>
          <h3 className="mt-3 text-xl font-black leading-tight text-zinc-900 lg:pr-3">{item.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm font-bold text-zinc-500">{item.creator}</p>
          <p className="mt-1 text-sm font-medium leading-6 text-zinc-500">{item.description}</p>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{item.source}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:mt-6">
        {item.primaryUrl && (
          <a
            href={item.primaryUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 lg:flex-1"
          >
            <ExternalLink size={16} />
            Open record
          </a>
        )}
        {item.readUrl && (
          <a
            href={item.readUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${item.type === 'article'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-violet-600 text-white shadow-lg shadow-violet-100 hover:bg-violet-700'
            } lg:flex-1`}
          >
            {item.type === 'article' ? <FileText size={16} /> : <BookOpen size={16} />}
            {item.accessLabel}
          </a>
        )}
        {!item.readUrl && !item.primaryUrl && (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-400">
            No direct reading link available yet.
          </div>
        )}
        {item.pdfUrl && (
          <a
            href={item.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 lg:flex-1"
          >
            <FileText size={16} />
            Open PDF
          </a>
        )}
      </div>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center text-sm font-bold text-zinc-400">
      {text}
    </div>
  );
}
