import { UserProfile } from '../types';
import { useLocation } from 'react-router-dom';
import {
  Building2,
  Code,
  Palette,
  Database,
  Cloud,
  Video,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { detectStudentPortalFromPath } from '../lib/portal';

interface MediaToolsProps {
  profile: UserProfile | null;
}

export default function ProgramsPage({ profile }: MediaToolsProps) {
  const location = useLocation();
  const activePortal = detectStudentPortalFromPath(location.pathname);
  const mediaTools = [
    ...(activePortal === 'university'
      ? [{
          name: 'Apps Anywhere',
          icon: Building2,
          color: 'bg-emerald-600',
          description: 'University app launcher for institution software access.',
          href: 'https://www.appsanywhere.com/',
        }]
      : []),
    { name: 'Matlab', icon: Code, color: 'bg-orange-500', description: 'Numerical computing environment.' },
    { name: 'Canva', icon: Palette, color: 'bg-purple-500', description: 'Graphic design platform.' },
    { name: 'Python', icon: Database, color: 'bg-blue-500', description: 'Programming language.' },
    { name: 'OneDrive', icon: Cloud, color: 'bg-sky-500', description: 'Cloud storage service.' },
    { name: 'Zoom', icon: Video, color: 'bg-blue-600', description: 'Video meetings and online classes.' },
  ];

  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-4xl font-black text-zinc-900 tracking-tight">Programs</h1>
        <p className="text-zinc-500 mt-2">Access your essential software and tools.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mediaTools.map((tool) => (
          <motion.div
            key={tool.name}
            whileHover={{ y: -5 }}
            className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-4"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white", tool.color)}>
              <tool.icon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">{tool.name}</h3>
              <p className="text-sm text-zinc-500 mt-1">{tool.description}</p>
            </div>
            <a
              href={tool.href || '#'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
            >
              Launch <ExternalLink size={14} />
            </a>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
