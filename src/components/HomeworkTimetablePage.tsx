import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Calendar, 
  ChevronLeft
} from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, limit, addDoc, onSnapshot, doc, setDoc } from '@/lib/portal-firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { normalizePlan, HomeworkSession as NormalizedHomeworkSession } from '../lib/homework';

interface HomeworkSession extends NormalizedHomeworkSession {}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function HomeworkTimetablePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState<HomeworkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Calculate dynamic hours range
  const minHour = sessions.length > 0 ? Math.max(0, Math.min(...sessions.map(s => parseInt(s.timeOfDay.split(':')[0]))) - 1) : 8;
  const maxHour = sessions.length > 0 ? Math.min(23, Math.max(...sessions.map(s => parseInt(s.timeOfDay.split(':')[0]))) + 1) : 16;
  const HOURS = Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe = onSnapshot(doc(db, 'homeworkPlans', user.uid), (docSnap) => {
          if (docSnap.exists()) {
            setSessions(normalizePlan(docSnap.data().plan || []));
          }
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `homeworkPlans/${user.uid}`);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    const state = location.state as { prefillPlan?: HomeworkSession[] } | null;
    if (!sessions.length && state?.prefillPlan?.length) {
      const normalized = normalizePlan(state.prefillPlan);
      setSessions(normalized);
      handleSave(normalized);
    }
  }, [location.state, sessions.length]);

  const handleSave = async (updatedSessions: HomeworkSession[]) => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'homeworkPlans', auth.currentUser.uid), {
        userId: auth.currentUser.uid,
        plan: updatedSessions,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'homeworkPlans');
    }
  };

  const addSession = () => {
    setSessions([...sessions, { subject: 'New Task', technique: 'Pomodoro', duration: '1h', timeOfDay: '09:00', day: 'Monday' }]);
    setIsEditing(true);
  };

  const updateSession = (index: number, updates: Partial<HomeworkSession>) => {
    const newSessions = [...sessions];
    newSessions[index] = { ...newSessions[index], ...updates };
    setSessions(newSessions);
  };

  const removeSession = (index: number) => {
    setSessions(sessions.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 font-bold hover:text-zinc-900 transition-all"
        >
          <ChevronLeft size={20} />
          Back to Planner
        </button>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold text-sm"
        >
          {isEditing ? 'Save' : 'Edit'}
        </button>
      </div>

      <div className="bg-white rounded-[32px] border border-zinc-200 shadow-xl shadow-zinc-100 p-8">
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Weekly Homework Timetable</h1>
        
        <div className="grid grid-cols-8 border-t border-l border-zinc-100">
          <div className="p-4 border-b border-r border-zinc-100"></div>
          {DAYS.map(day => (
            <div key={day} className="p-4 text-center font-black text-zinc-900 border-b border-r border-zinc-100">{day}</div>
          ))}

          {HOURS.map(hour => (
            <React.Fragment key={hour}>
              <div className="p-4 text-right font-bold text-zinc-400 border-b border-r border-zinc-100 sticky left-0 bg-white">
                {hour.toString().padStart(2, '0')}:00
              </div>
              {DAYS.map(day => (
                <div key={`${day}-${hour}`} className="p-4 border-b border-r border-zinc-100 min-h-[80px] relative">
                  {sessions
                    .filter(s => s.day && s.day.toLowerCase() === day.toLowerCase() && parseInt(s.timeOfDay.split(':')[0]) === hour)
                    .map((session, index) => (
                      <motion.div 
                        key={`${day}-${hour}-${index}`} 
                        drag
                        dragElastic={0}
                        onDragEnd={(_, info) => {
                          const deltaX = Math.round(info.offset.x / 100); // Assuming column width is 100px
                          const deltaY = Math.round(info.offset.y / 80); // Assuming row height is 80px
                          
                          const dayIndex = DAYS.indexOf(day);
                          const newDay = DAYS[Math.max(0, Math.min(DAYS.length - 1, dayIndex + deltaX))];
                          const newHour = Math.max(minHour, Math.min(maxHour, hour + deltaY));
                          
                          const sessionIndex = sessions.findIndex(s => s === session);
                          updateSession(sessionIndex, { day: newDay, timeOfDay: `${newHour.toString().padStart(2, '0')}:00` });
                          // Fire and forget, don't await handleSave to prevent UI delay
                          handleSave(sessions.map((s, i) => i === sessionIndex ? { ...s, day: newDay, timeOfDay: `${newHour.toString().padStart(2, '0')}:00` } : s));
                        }}
                        className="absolute inset-1 bg-amber-200/50 rounded-xl p-2 text-xs font-bold text-zinc-900 cursor-grab active:cursor-grabbing"
                      >
                        {session.subject}
                        <div className="text-[10px] opacity-70">{session.technique}</div>
                      </motion.div>
                    ))}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {isEditing && (
        <div className="bg-white rounded-[32px] border border-zinc-200 p-8 space-y-4">
          <h2 className="text-xl font-black">Edit Sessions</h2>
          {sessions.map((session, index) => (
            <div key={index} className="grid grid-cols-5 gap-2">
              <input value={session.subject} onChange={e => updateSession(index, { subject: e.target.value })} className="border rounded-lg p-2" />
              <input value={session.day} onChange={e => updateSession(index, { day: e.target.value })} className="border rounded-lg p-2" />
              <input type="time" value={session.timeOfDay} onChange={e => updateSession(index, { timeOfDay: e.target.value })} className="border rounded-lg p-2" />
              <input value={session.duration} onChange={e => updateSession(index, { duration: e.target.value })} className="border rounded-lg p-2" />
              <button onClick={() => removeSession(index)} className="text-red-500">Remove</button>
            </div>
          ))}
          <button onClick={addSession} className="bg-zinc-900 text-white px-4 py-2 rounded-lg">Add Session</button>
          <button onClick={() => handleSave(sessions)} className="bg-sky-500 text-white px-4 py-2 rounded-lg">Save All</button>
        </div>
      )}
    </div>
  );
}
