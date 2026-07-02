import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, User, GraduationCap, BookOpen, Users } from 'lucide-react';

const ROLES = [
  { level: 'App Admin', role: 'Global Overlord', icon: Shield, desc: 'Manage school subscriptions, update QCAA curriculum data, global analytics.' },
  { level: 'School Head', role: 'The "Principal"', icon: User, desc: 'Track teacher reliability, student grade trends, and curriculum coverage.' },
  { level: 'Teacher', role: 'The "Coach"', icon: BookOpen, desc: 'Input specific topics/focus areas, view class progress, set "Teacher Quizzes."' },
  { level: 'Student', role: 'The "Player"', icon: GraduationCap, desc: 'Completes Quizzes (App-gen vs. Teacher-gen), earns rewards, tracks personal growth.' },
];

export default function AdminSettingsPage() {
  const [activePortal, setActivePortal] = useState('App Admin');
  const navigate = useNavigate();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12">
      <h1 className="text-4xl font-black text-zinc-900 tracking-tight">Admin Portal</h1>

      {/* Hierarchy */}
      <section>
        <h2 className="text-2xl font-black text-zinc-900 mb-8 flex items-center gap-3">
          <Users className="text-indigo-600" />
          The Admin Hierarchy
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {ROLES.map((item) => (
            <div key={item.level} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <item.icon className="h-8 w-8 text-indigo-600 mb-4" />
              <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest">{item.level}</h3>
              <p className="text-lg font-bold text-zinc-900 mb-2">{item.role}</p>
              <p className="text-sm text-zinc-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Portal Switcher */}
      <section className="bg-white p-8 rounded-[32px] border border-zinc-200 shadow-sm">
        <h2 className="text-2xl font-black text-zinc-900 mb-8">Test Portals</h2>
        <div className="flex gap-4 mb-8">
          {ROLES.map(r => (
            <button
              key={r.level}
              onClick={() => {
                setActivePortal(r.level);
                const path = r.level.toLowerCase().replace(' ', '-');
                navigate(path === 'student' ? '/' : `/admin/${path}`);
              }}
              className={`px-6 py-3 rounded-2xl font-bold transition-all ${activePortal === r.level ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
            >
              {r.level} Portal
            </button>
          ))}
        </div>
        <div className="p-12 border-2 border-dashed border-zinc-200 rounded-3xl text-center">
          <p className="text-xl font-black text-zinc-900">Currently viewing: {activePortal} Portal</p>
          <p className="text-zinc-500 mt-2">Simulating interface for {activePortal} access level.</p>
        </div>
      </section>
    </div>
  );
}
