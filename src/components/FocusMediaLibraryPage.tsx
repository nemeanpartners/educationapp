import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Headphones,
  Image as ImageIcon,
  Music,
  PlayCircle,
  Search,
  Video,
} from 'lucide-react';
import { detectStudentPortalFromPath, studentPortalToolPath } from '../lib/portal';

type LibraryType = 'soundscapes' | 'wallpapers';

type MediaOption = {
  title: string;
  description: string;
  query: string;
  kind: 'Audio' | 'Image' | 'Video';
  tone: string;
};

const soundscapeOptions: MediaOption[] = [
  {
    title: 'Rain for Deep Focus',
    description: 'Soft rain loops for homework, reading, and longer writing blocks.',
    query: 'rain sounds for studying focus no music',
    kind: 'Audio',
    tone: 'from-sky-500/80 to-indigo-500/70',
  },
  {
    title: 'Brown Noise',
    description: 'Low, steady noise for blocking distractions without a strong melody.',
    query: 'brown noise for studying 10 hours',
    kind: 'Audio',
    tone: 'from-stone-500/80 to-zinc-700/75',
  },
  {
    title: 'White Noise',
    description: 'Clean static-style background sound for simple concentration.',
    query: 'white noise for studying focus',
    kind: 'Audio',
    tone: 'from-slate-300/90 to-sky-400/80',
  },
  {
    title: 'Cafe Ambience',
    description: 'Gentle coffee shop chatter and room tone for a busy but calm study feel.',
    query: 'cafe ambience study background sounds',
    kind: 'Audio',
    tone: 'from-amber-500/80 to-rose-500/70',
  },
  {
    title: 'Library Ambience',
    description: 'Quiet pages, soft room noise, and study hall atmosphere.',
    query: 'library ambience study sounds',
    kind: 'Audio',
    tone: 'from-emerald-500/75 to-teal-600/75',
  },
  {
    title: 'Forest and Birds',
    description: 'Nature soundscapes with leaves, birds, and outdoor calm.',
    query: 'forest sounds birds study ambience',
    kind: 'Audio',
    tone: 'from-lime-500/80 to-emerald-700/75',
  },
  {
    title: 'Ocean Waves',
    description: 'Slow coastal waves for relaxed revision and low-pressure work.',
    query: 'ocean waves study ambience',
    kind: 'Audio',
    tone: 'from-cyan-500/80 to-blue-700/75',
  },
  {
    title: 'Fireplace',
    description: 'Crackling fire sounds for evening study and calm reading sessions.',
    query: 'fireplace sounds study ambience',
    kind: 'Audio',
    tone: 'from-orange-500/80 to-red-600/75',
  },
  {
    title: 'Thunderstorm',
    description: 'Deeper weather ambience for students who prefer stronger background sound.',
    query: 'thunderstorm sounds for studying',
    kind: 'Audio',
    tone: 'from-violet-600/75 to-slate-800/80',
  },
  {
    title: 'Keyboard and Desk',
    description: 'Typing, papers, and desk sounds for a virtual study partner feel.',
    query: 'study with me keyboard sounds ambience',
    kind: 'Audio',
    tone: 'from-zinc-600/75 to-slate-900/80',
  },
  {
    title: 'Binaural Focus',
    description: 'Headphone-friendly focus audio for structured concentration blocks.',
    query: 'binaural beats focus studying no ads',
    kind: 'Audio',
    tone: 'from-purple-500/75 to-indigo-700/75',
  },
  {
    title: 'Lo-fi Without Lyrics',
    description: 'Low-key instrumental study mixes when you want music in the background.',
    query: 'lofi study music no lyrics focus',
    kind: 'Audio',
    tone: 'from-pink-500/75 to-blue-500/70',
  },
];

const wallpaperOptions: MediaOption[] = [
  {
    title: 'Cozy Study Room',
    description: 'Warm desk scenes, windows, lamps, and calm background visuals.',
    query: 'cozy study room background video 4k',
    kind: 'Video',
    tone: 'from-amber-400/80 to-orange-600/75',
  },
  {
    title: 'Animated Study Desk',
    description: 'Looping desk wallpapers that feel alive without pulling focus.',
    query: 'animated study desk wallpaper youtube',
    kind: 'Video',
    tone: 'from-rose-400/75 to-purple-600/70',
  },
  {
    title: 'Rainy Window',
    description: 'Window rain visuals for quiet reading, planning, and writing.',
    query: 'rainy window study background video',
    kind: 'Video',
    tone: 'from-sky-500/75 to-slate-700/75',
  },
  {
    title: 'Minimal Desk Wallpaper',
    description: 'Clean image-style backgrounds for a less busy study screen.',
    query: 'minimal study desk wallpaper background',
    kind: 'Image',
    tone: 'from-zinc-300/90 to-slate-500/75',
  },
  {
    title: 'Forest Study View',
    description: 'Green outdoor scenes and calm nature backgrounds for focus.',
    query: 'forest study background video 4k',
    kind: 'Video',
    tone: 'from-lime-500/80 to-emerald-700/75',
  },
  {
    title: 'Ocean Desk View',
    description: 'Beach and ocean visuals for relaxed review sessions.',
    query: 'ocean study background video 4k',
    kind: 'Video',
    tone: 'from-cyan-400/80 to-blue-700/75',
  },
  {
    title: 'Night City Study',
    description: 'City lights, windows, and night ambience for late study sessions.',
    query: 'night city study background video',
    kind: 'Video',
    tone: 'from-indigo-500/75 to-zinc-950/80',
  },
  {
    title: 'Library Background',
    description: 'Book walls, desks, and academic study visuals.',
    query: 'library study background video',
    kind: 'Video',
    tone: 'from-emerald-600/75 to-amber-600/70',
  },
  {
    title: 'Space and Stars',
    description: 'Slow cosmic backgrounds for a darker, distraction-light setup.',
    query: 'space study background video 4k',
    kind: 'Video',
    tone: 'from-violet-600/75 to-slate-950/85',
  },
  {
    title: 'Aquarium',
    description: 'Fish tank loops and slow movement for a gentle background.',
    query: 'aquarium study background video',
    kind: 'Video',
    tone: 'from-teal-400/80 to-blue-700/75',
  },
  {
    title: 'Anime Study Room',
    description: 'Illustrated study spaces with calm movement and soft lighting.',
    query: 'anime study room background video',
    kind: 'Video',
    tone: 'from-pink-400/75 to-indigo-500/70',
  },
  {
    title: 'Static Study Wallpaper',
    description: 'Search for still backgrounds when you want no motion at all.',
    query: 'study wallpaper aesthetic desktop background',
    kind: 'Image',
    tone: 'from-fuchsia-400/70 to-sky-500/70',
  },
];

const pageCopy = {
  soundscapes: {
    title: 'Ambient Soundscapes',
    eyebrow: 'Sound Library',
    description: 'Open focused YouTube searches for background audio that supports reading, writing, and revision.',
    icon: Headphones,
    options: soundscapeOptions,
    accent: 'text-indigo-500',
  },
  wallpapers: {
    title: 'Study Wallpapers',
    eyebrow: 'Background Library',
    description: 'Choose image-style or video background searches for a calmer study screen.',
    icon: ImageIcon,
    options: wallpaperOptions,
    accent: 'text-emerald-500',
  },
} satisfies Record<LibraryType, {
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof Headphones;
  options: MediaOption[];
  accent: string;
}>;

function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export default function FocusMediaLibraryPage({ type }: { type: LibraryType }) {
  const copy = pageCopy[type];
  const Icon = copy.icon;
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const backLabel = activePortal === 'university' ? 'Back to Focus' : 'Back to Focus Mode';

  return (
    <div className="min-h-[calc(100vh-80px)] space-y-8 bg-[#f4f5f7] p-4 sm:p-6 lg:p-8">
      <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/45 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-3xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link
              to={studentPortalToolPath(activePortal, 'timer')}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-4 py-2 text-sm font-bold text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all hover:bg-white/80 hover:text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </Link>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{copy.eyebrow}</p>
            <h1 className="mt-3 flex items-center gap-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">
              <Icon className={`h-9 w-9 ${copy.accent}`} /> {copy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-zinc-600">{copy.description}</p>
          </div>
          <a
            href={youtubeSearchUrl(type === 'soundscapes' ? 'ambient sounds for studying focus' : 'study wallpaper background video')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/40 bg-zinc-900 px-5 py-3 font-bold text-white shadow-[0_16px_38px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:bg-zinc-800"
          >
            <Search className="h-5 w-5" /> Search YouTube
          </a>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {copy.options.map((option) => (
          <a
            key={option.title}
            href={youtubeSearchUrl(option.query)}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/45 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.09),inset_0_1px_0_rgba(255,255,255,0.84)] backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:bg-white/60"
          >
            <div className={`relative mb-4 h-36 overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${option.tone}`}>
              <div className="absolute inset-x-4 bottom-4 top-4 rounded-[1rem] border border-white/25 bg-white/15" />
              <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-white/25 px-3 py-1 text-xs font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                {option.kind}
              </div>
              <div className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                {option.kind === 'Audio' ? <Music className="h-5 w-5" /> : option.kind === 'Image' ? <ImageIcon className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-zinc-950">{option.title}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-zinc-600">{option.description}</p>
              </div>
              <ExternalLink className="mt-1 h-5 w-5 shrink-0 text-zinc-400 transition-all group-hover:text-zinc-900" />
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-zinc-900">
              <PlayCircle className="h-4 w-4" /> Open options
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}
