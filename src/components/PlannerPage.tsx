import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  Trash2,
  Save,
  Layout as LayoutIcon,
  BookOpen,
  Coffee,
  Home,
  MoreHorizontal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from '@/lib/portal-firestore';
import { geminiGenerateContent } from '../services/geminiProxy';
import { cn } from '../lib/utils';
import { PlannerPlan, PlannerEntry } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { format, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from 'date-fns';

const PLAN_TYPES = [
  { id: 'day', label: 'Daily', icon: CalendarCheck },
  { id: 'week', label: 'Weekly', icon: CalendarDays },
  { id: 'term', label: 'Term', icon: CalendarRange },
  { id: 'semester', label: 'Semester', icon: LayoutIcon },
] as const;

const ENTRY_TYPES = [
  { id: 'study', label: 'Study', icon: BookOpen, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 'homework', label: 'Homework', icon: Home, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'break', label: 'Break', icon: Coffee, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'class', label: 'Class', icon: CalendarIcon, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'other', label: 'Other', icon: MoreHorizontal, color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
] as const;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

export default function PlannerPage() {
  const [activeTab, setActiveTab] = useState<typeof PLAN_TYPES[number]['id']>('week');
  const [plan, setPlan] = useState<PlannerPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<PlannerEntry> | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: endOfWeek(start, { weekStartsOn: 1 }) });
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const planRef = doc(db, 'planners', `${user.uid}_${activeTab}`);
    const unsubscribe = onSnapshot(planRef, (doc) => {
      if (doc.exists()) {
        setPlan(doc.data() as PlannerPlan);
      } else {
        // Initialize empty plan
        const newPlan: PlannerPlan = {
          id: `${user.uid}_${activeTab}`,
          userId: user.uid,
          title: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Plan`,
          type: activeTab,
          entries: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setPlan(newPlan);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `planners/${user.uid}_${activeTab}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  const handleSave = async (updatedPlan: PlannerPlan) => {
    const user = auth.currentUser;
    if (!user) return;

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'planners', updatedPlan.id), {
        ...updatedPlan,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `planners/${updatedPlan.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEntry = (day?: string, hour?: number, date?: Date) => {
    const newEntry: Partial<PlannerEntry> = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      startTime: hour ? `${hour.toString().padStart(2, '0')}:00` : '09:00',
      endTime: hour ? `${(hour + 1).toString().padStart(2, '0')}:00` : '10:00',
      day: day || (date ? format(date, 'EEEE') : 'Monday'),
      date: date ? format(date, 'yyyy-MM-dd') : undefined,
      type: 'study',
    };
    setEditingEntry(newEntry);
  };

  const handleSaveEntry = () => {
    if (!plan || !editingEntry) return;

    const updatedEntries = [...plan.entries];
    const index = updatedEntries.findIndex(e => e.id === editingEntry.id);

    if (index >= 0) {
      updatedEntries[index] = editingEntry as PlannerEntry;
    } else {
      updatedEntries.push(editingEntry as PlannerEntry);
    }

    const updatedPlan = { ...plan, entries: updatedEntries };
    setPlan(updatedPlan);
    handleSave(updatedPlan);
    setEditingEntry(null);
  };

  const handleDeleteEntry = (id: string) => {
    if (!plan) return;
    const updatedPlan = {
      ...plan,
      entries: plan.entries.filter(e => e.id !== id)
    };
    setPlan(updatedPlan);
    handleSave(updatedPlan);
  };

  const generateAIPlan = async () => {
    if (!aiPrompt || !plan) return;
    setIsAIGenerating(true);

    try {
      const result = await geminiGenerateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a ${activeTab} study and activity plan based on this request: "${aiPrompt}".
        Return the plan as a JSON array of entries with these fields:
        title (string), startTime (HH:mm), endTime (HH:mm), day (Monday-Sunday), type (study, homework, break, class, other).
        Ensure times are within 07:00 to 21:00.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                startTime: { type: "string" },
                endTime: { type: "string" },
                day: { type: "string" },
                type: { type: "string", enum: ['study', 'homework', 'break', 'class', 'other'] },
              },
              required: ['title', 'startTime', 'endTime', 'day', 'type']
            }
          }
        }
      });
      const newEntries = JSON.parse(result.text || '[]') as PlannerEntry[];
      
      const updatedPlan = {
        ...plan,
        entries: [...plan.entries, ...newEntries.map(e => ({ ...e, id: Math.random().toString(36).substr(2, 9) }))]
      };
      
      setPlan(updatedPlan);
      handleSave(updatedPlan);
      setShowAIModal(false);
      setAiPrompt('');
    } catch (error) {
      console.error("AI Generation Error:", error);
    } finally {
      setIsAIGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-indigo-600" />
            Planner
          </h1>
          
          <nav className="flex items-center bg-zinc-100 rounded-lg p-1">
            {PLAN_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveTab(type.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                  activeTab === type.id 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <type.icon className="h-4 w-4" />
                {type.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            AI Smart Plan
          </button>
          <button
            onClick={() => handleAddEntry()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'day' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                    className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-zinc-900">{format(selectedDate, 'EEEE, MMMM do')}</h2>
                    <p className="text-xs text-zinc-500">Daily Schedule</p>
                  </div>
                  <button 
                    onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                    className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <button 
                  onClick={() => setSelectedDate(new Date())}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Today
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="relative grid grid-cols-[100px_1fr]">
                  <div className="border-r border-zinc-200 bg-zinc-50/30">
                    {HOURS.map(hour => (
                      <div key={hour} className="h-24 border-b border-zinc-100 p-4 text-xs font-bold text-zinc-400 text-right">
                        {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                      </div>
                    ))}
                  </div>
                  <div className="relative">
                    {HOURS.map(hour => (
                      <div 
                        key={hour} 
                        className="h-24 border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer group"
                        onClick={() => handleAddEntry(undefined, hour, selectedDate)}
                      >
                        <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full transition-opacity">
                          <Plus className="h-5 w-5 text-zinc-200" />
                        </div>
                      </div>
                    ))}

                    {plan?.entries.filter(e => {
                      if (e.date) return e.date === format(selectedDate, 'yyyy-MM-dd');
                      return e.day === format(selectedDate, 'EEEE');
                    }).map(entry => {
                      const startHour = parseInt(entry.startTime.split(':')[0]);
                      const startMin = parseInt(entry.startTime.split(':')[1]);
                      const endHour = parseInt(entry.endTime.split(':')[0]);
                      const endMin = parseInt(entry.endTime.split(':')[1]);
                      
                      const top = (startHour - 7) * 96 + (startMin / 60) * 96;
                      const height = ((endHour - startHour) * 60 + (endMin - startMin)) / 60 * 96;
                      const typeInfo = ENTRY_TYPES.find(t => t.id === entry.type) || ENTRY_TYPES[4];

                      return (
                        <motion.div
                          layoutId={entry.id}
                          key={entry.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntry(entry);
                          }}
                          style={{ top, height }}
                          className={cn(
                            "absolute left-4 right-4 rounded-xl border p-4 shadow-md cursor-pointer overflow-hidden group z-10 transition-all hover:shadow-lg",
                            typeInfo.color
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-sm mb-1">{entry.title || 'Untitled'}</div>
                              <div className="flex items-center gap-2 opacity-70 text-xs">
                                <Clock className="h-3 w-3" />
                                {entry.startTime} - {entry.endTime}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEntry(entry.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'week' && (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-zinc-200">
                <div className="p-4 border-r border-zinc-200 bg-zinc-50/50"></div>
                {DAYS.map(day => (
                  <div key={day} className="p-4 text-center border-r border-zinc-200 last:border-r-0 bg-zinc-50/50">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{day.slice(0, 3)}</span>
                  </div>
                ))}
              </div>

              <div className="relative grid grid-cols-[80px_repeat(7,1fr)]">
                {/* Time labels */}
                <div className="border-r border-zinc-200">
                  {HOURS.map(hour => (
                    <div key={hour} className="h-20 border-b border-zinc-100 p-2 text-[10px] font-medium text-zinc-400 text-right">
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                    </div>
                  ))}
                </div>

                {/* Grid cells */}
                {DAYS.map(day => (
                  <div key={day} className="relative border-r border-zinc-200 last:border-r-0">
                    {HOURS.map(hour => (
                      <div 
                        key={hour} 
                        className="h-20 border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer group"
                        onClick={() => handleAddEntry(day, hour)}
                      >
                        <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full transition-opacity">
                          <Plus className="h-4 w-4 text-zinc-300" />
                        </div>
                      </div>
                    ))}

                    {/* Entries */}
                    {plan?.entries.filter(e => e.day === day).map(entry => {
                      const startHour = parseInt(entry.startTime.split(':')[0]);
                      const startMin = parseInt(entry.startTime.split(':')[1]);
                      const endHour = parseInt(entry.endTime.split(':')[0]);
                      const endMin = parseInt(entry.endTime.split(':')[1]);
                      
                      const top = (startHour - 7) * 80 + (startMin / 60) * 80;
                      const height = ((endHour - startHour) * 60 + (endMin - startMin)) / 60 * 80;
                      const typeInfo = ENTRY_TYPES.find(t => t.id === entry.type) || ENTRY_TYPES[4];

                      return (
                        <motion.div
                          layoutId={entry.id}
                          key={entry.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntry(entry);
                          }}
                          style={{ top, height }}
                          className={cn(
                            "absolute left-1 right-1 rounded-lg border p-2 text-xs shadow-sm cursor-pointer overflow-hidden group z-10",
                            typeInfo.color
                          )}
                        >
                          <div className="font-semibold truncate">{entry.title || 'Untitled'}</div>
                          <div className="flex items-center gap-1 opacity-70 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {entry.startTime} - {entry.endTime}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEntry(entry.id);
                            }}
                            className="absolute top-1 right-1 p-1 rounded-md hover:bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeTab === 'term' || activeTab === 'semester') && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-zinc-900">{format(currentMonth, 'MMMM yyyy')}</h2>
                    <p className="text-xs text-zinc-500">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Overview</p>
                  </div>
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <button 
                  onClick={() => setCurrentMonth(new Date())}
                  className="text-sm font-medium text-indigo-600 hover:underline"
                >
                  Current Month
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/50">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="p-4 text-center text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((day, i) => {
                    const dayEntries = plan?.entries.filter(e => e.date === format(day, 'yyyy-MM-dd')) || [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div 
                        key={day.toString()} 
                        className={cn(
                          "min-h-[140px] p-2 border-r border-b border-zinc-100 last:border-r-0 hover:bg-zinc-50/50 transition-colors cursor-pointer group relative",
                          !isCurrentMonth && "bg-zinc-50/30 opacity-40"
                        )}
                        onClick={() => handleAddEntry(undefined, undefined, day)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                            isToday ? "bg-indigo-600 text-white" : "text-zinc-400 group-hover:text-zinc-900"
                          )}>
                            {format(day, 'd')}
                          </span>
                          <Plus className="h-3 w-3 text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        
                        <div className="space-y-1">
                          {dayEntries.slice(0, 3).map(entry => {
                            const typeInfo = ENTRY_TYPES.find(t => t.id === entry.type) || ENTRY_TYPES[4];
                            return (
                              <div 
                                key={entry.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEntry(entry);
                                }}
                                className={cn(
                                  "px-2 py-1 rounded-md text-[10px] font-bold truncate border shadow-sm",
                                  typeInfo.color
                                )}
                              >
                                {entry.title || 'Untitled'}
                              </div>
                            );
                          })}
                          {dayEntries.length > 3 && (
                            <div className="text-[10px] font-bold text-zinc-400 pl-1">
                              + {dayEntries.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* AI Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-indigo-50/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">AI Smart Planner</h2>
                    <p className="text-xs text-zinc-500">Let AI map out your {activeTab} for you</p>
                  </div>
                </div>
                <button onClick={() => setShowAIModal(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="h-5 w-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6">
                <label className="block text-sm font-semibold text-zinc-700 mb-2">What are your goals for this {activeTab}?</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., I have a math exam on Friday. I want to study for 2 hours every day, include gym sessions, and make sure I have breaks."
                  className="w-full h-32 p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                />
                
                <div className="mt-4 flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    AI will generate a plan and add it to your current schedule. You can always edit or remove entries later.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 flex gap-3">
                <button
                  onClick={() => setShowAIModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={generateAIPlan}
                  disabled={!aiPrompt || isAIGenerating}
                  className="flex-[2] px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  {isAIGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Plan...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Plan
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Entry Modal */}
      <AnimatePresence>
        {editingEntry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-900">
                  {editingEntry.id ? 'Edit Entry' : 'New Entry'}
                </h2>
                <button onClick={() => setEditingEntry(null)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="h-5 w-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Title</label>
                  <input
                    type="text"
                    value={editingEntry.title}
                    onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                    placeholder="e.g., Study Math"
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Start Time</label>
                    <input
                      type="time"
                      value={editingEntry.startTime}
                      onChange={(e) => setEditingEntry({ ...editingEntry, startTime: e.target.value })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={editingEntry.endTime}
                      onChange={(e) => setEditingEntry({ ...editingEntry, endTime: e.target.value })}
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    value={editingEntry.date || ''}
                    onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value, day: format(new Date(e.target.value), 'EEEE') })}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Day (Fallback)</label>
                  <select
                    value={editingEntry.day}
                    onChange={(e) => setEditingEntry({ ...editingEntry, day: e.target.value })}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  >
                    {DAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ENTRY_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => setEditingEntry({ ...editingEntry, type: type.id })}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all",
                          editingEntry.type === type.id
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                            : "bg-white border-zinc-200 text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
                        )}
                      >
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-50 flex gap-3">
                <button
                  onClick={() => setEditingEntry(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEntry}
                  className="flex-[2] px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Entry
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Saving Indicator */}
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 right-8 bg-zinc-900 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-sm z-50"
          >
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            Saving changes...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
