import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from '@/lib/portal-firestore';
import type { UserProfile } from '../types';
import { geminiService } from '../services/gemini';
import { db } from '../firebase';
import {
  AlertTriangle,
  Bot,
  Brain,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  User,
  Volume2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useResponsiveDevice } from '../hooks/use-responsive-device';

interface AIAssistantProps {
  profile: UserProfile | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isThinking?: boolean;
}

type SavedConversation = {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt?: unknown;
  updatedAt?: unknown;
};

const welcomeMessage: Message = {
  role: 'assistant',
  content: "Hi, I'm Study Buddy. Ask me about homework, exam prep, concepts, writing, maths, or study planning and I'll tutor you step by step.",
};

function titleFromMessage(message: string) {
  const compact = message.trim().replace(/\s+/g, ' ');
  if (!compact) return 'Study Buddy chat';
  return compact.length > 52 ? `${compact.slice(0, 52)}...` : compact;
}

export default function AIAssistant({ profile }: AIAssistantProps) {
  const { isPhone } = useResponsiveDevice();
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [showIntegrityNotice, setShowIntegrityNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.uid) {
      setSavedConversations([]);
      return;
    }

    const q = query(
      collection(db, 'assistantConversations'),
      where('userId', '==', profile.uid),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      setSavedConversations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as SavedConversation)));
    }, (error) => {
      console.error('Failed to load Study Buddy conversations', error);
    });
  }, [profile?.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const persistConversation = async (nextMessages: Message[], firstUserMessage: string) => {
    if (!profile?.uid) return null;

    const payload = {
      userId: profile.uid,
      title: titleFromMessage(firstUserMessage),
      messages: nextMessages,
      updatedAt: serverTimestamp(),
    };

    if (activeConversationId) {
      await updateDoc(doc(db, 'assistantConversations', activeConversationId), payload);
      return activeConversationId;
    }

    const created = await addDoc(collection(db, 'assistantConversations'), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    setActiveConversationId(created.id);
    return created.id;
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: 'user', content: trimmed };
    const baseMessages = [...messages, userMessage];
    setMessages(baseMessages);
    setInput('');
    setIsLoading(true);
    setSaveError(null);

    try {
      const previousChat = messages.filter((message) => message.role === 'user' || message.role === 'assistant');
      const responseText = isThinkingMode
        ? await geminiService.think(`You are Study Buddy, a careful tutor. Help the student step by step and ask a clarifying question if needed.\n\nStudent: ${trimmed}`)
        : await geminiService.tutorChat(trimmed, previousChat, profile || undefined);

      const nextMessages = [...baseMessages, { role: 'assistant' as const, content: responseText, isThinking: isThinkingMode }];
      setMessages(nextMessages);

      try {
        await persistConversation(nextMessages, trimmed);
      } catch (error) {
        console.error('Failed to save conversation', error);
        setSaveError('This chat could not be saved yet. You can keep chatting.');
      }
    } catch (error) {
      console.error('Chat failed:', error);
      setMessages((current) => [...current, { role: 'assistant', content: 'Sorry, I could not answer that. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([welcomeMessage]);
    setInput('');
    setSaveError(null);
  };

  const openConversation = (conversation: SavedConversation) => {
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages?.length ? conversation.messages : [welcomeMessage]);
    setInput('');
    setSaveError(null);
  };

  const handleTTS = (text: string, messageIndex: number) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMessageIndex === messageIndex) {
      window.speechSynthesis.cancel();
      setSpeakingMessageIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) => /siri|samantha|karen|google|microsoft/i.test(voice.name));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingMessageIndex(null);
    utterance.onerror = () => setSpeakingMessageIndex(null);
    setSpeakingMessageIndex(messageIndex);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={cn(
      "grid overflow-hidden border border-zinc-200 bg-white shadow-sm",
      isPhone
        ? "h-[calc(100dvh-8.4rem)] rounded-[24px]"
        : "h-[calc(100dvh-9rem)] min-h-[520px] rounded-3xl lg:grid-cols-[300px_1fr]"
    )}>
      <aside className="hidden border-r border-zinc-100 bg-zinc-50/70 p-4 lg:flex lg:flex-col">
        <button
          onClick={startNewConversation}
          className="mb-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-100 transition hover:bg-purple-700"
        >
          <Plus size={18} />
          New chat
        </button>
        <div className="mb-3 flex items-center gap-2 px-1 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
          <MessageSquare size={14} />
          Saved chats
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {savedConversations.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold leading-6 text-zinc-500">
              Saved conversations will appear here after your first message.
            </p>
          ) : (
            savedConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => openConversation(conversation)}
                className={cn(
                  'w-full rounded-2xl px-4 py-3 text-left transition',
                  activeConversationId === conversation.id ? 'bg-purple-50 text-purple-900' : 'bg-white text-zinc-700 hover:bg-zinc-100',
                )}
              >
                <p className="truncate text-sm font-black">{conversation.title}</p>
                <p className="mt-1 text-xs font-semibold text-zinc-400">{conversation.messages?.length || 0} messages</p>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col">
        <header className={cn(
          "shrink-0 border-b border-zinc-100 bg-zinc-50/50",
          isPhone ? "px-3 py-2.5" : "p-4"
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={cn("bg-purple-600 text-white", isPhone ? "rounded-[14px] p-2" : "rounded-xl p-2")}>
                <Bot size={isPhone ? 18 : 20} />
              </div>
              <div className={cn(isPhone ? "-mt-0.5" : "")}>
                <div className="flex items-center gap-2">
                  <h2 className={cn("font-bold text-zinc-900", isPhone ? "text-[1.45rem] leading-none" : "text-lg")}>Study Buddy</h2>
                  <div className="relative">
                    <button
                      type="button"
                      title="Do not use Study Buddy to complete assessments for you. It is designed to help like a tutor and guide."
                      aria-label="Academic integrity notice"
                      aria-expanded={showIntegrityNotice}
                      onClick={() => setShowIntegrityNotice((value) => !value)}
                      onBlur={() => {
                        window.setTimeout(() => setShowIntegrityNotice(false), 120);
                      }}
                      className={cn(
                        "inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600 transition hover:bg-amber-100",
                        isPhone ? "h-7 w-7" : "h-8 w-8"
                      )}
                    >
                      <AlertTriangle size={isPhone ? 14 : 15} />
                    </button>
                    {showIntegrityNotice && (
                      <div
                        className={cn(
                          "absolute z-20 rounded-2xl border border-amber-200 bg-white text-zinc-700 shadow-xl",
                          isPhone
                            ? "left-0 top-9 w-[240px] p-3 text-[11px] leading-4"
                            : "left-0 top-10 w-[280px] p-3.5 text-xs leading-5"
                        )}
                      >
                        Do not use or ask Study Buddy to complete your assessments for you. It is designed to help you like a tutor and guide.
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className={cn("font-medium text-zinc-500", isPhone ? "text-[11px] leading-none" : "text-xs")}>Gemini tutor with saved conversations</span>
                </div>
              </div>
            </div>

            <div className={cn("flex items-center", isPhone ? "gap-1.5 pt-0.5" : "gap-2")}>
            <button
              onClick={startNewConversation}
              className={cn(
                "inline-flex items-center rounded-xl bg-zinc-100 font-bold text-zinc-600 transition hover:bg-zinc-200 lg:hidden",
                isPhone ? "gap-1.5 px-2.5 py-2 text-xs" : "gap-2 px-3 py-2 text-sm"
              )}
            >
              <Plus size={isPhone ? 14 : 16} />
              New
            </button>
            <button
              onClick={() => setIsThinkingMode(!isThinkingMode)}
              className={cn(
                'flex items-center rounded-xl font-bold transition-all',
                isPhone ? 'gap-1.5 px-2.5 py-2 text-xs' : 'gap-2 px-4 py-2 text-sm',
                isThinkingMode
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200',
              )}
            >
              <Brain size={isPhone ? 14 : 16} />
              Thinking
            </button>
          </div>
          </div>
        </header>

        <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", isPhone ? "space-y-4 p-4" : "space-y-6 p-6")}>
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.role}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex gap-3', isPhone ? 'max-w-[92%]' : 'max-w-[88%] gap-4', msg.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
            >
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center',
                  isPhone ? 'h-7 w-7 rounded-full' : 'h-8 w-8 rounded-lg',
                  msg.role === 'assistant' ? 'bg-purple-100 text-purple-600' : 'bg-zinc-200 text-zinc-600',
                )}
              >
                {msg.role === 'assistant' ? <Bot size={isPhone ? 15 : 18} /> : <User size={isPhone ? 15 : 18} />}
              </div>
              <div className="space-y-2">
                <div
                  className={cn(
                    'whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed',
                    isPhone ? 'rounded-[20px]' : 'rounded-2xl',
                    msg.role === 'assistant'
                      ? 'border border-zinc-100 bg-zinc-50 text-zinc-900'
                      : 'bg-purple-600 text-white',
                  )}
                >
                  {msg.isThinking && (
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-violet-500">
                      <Brain size={12} />
                      Deep Reasoning Applied
                    </div>
                  )}
                  {msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleTTS(msg.content, i)}
                    className={cn("flex items-center gap-1.5 font-medium text-zinc-400 transition-colors hover:text-purple-600", isPhone ? "pl-1 text-[11px]" : "text-xs")}
                  >
                    <Volume2 size={14} />
                    {speakingMessageIndex === i ? 'Stop' : 'Listen'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className={cn("flex gap-3", isPhone ? "max-w-[92%]" : "max-w-[85%] gap-4")}>
              <div className={cn("flex items-center justify-center bg-purple-100 text-purple-600", isPhone ? "h-7 w-7 rounded-full" : "h-8 w-8 rounded-lg")}>
                <Bot size={isPhone ? 15 : 18} />
              </div>
              <div className={cn("flex items-center gap-2 border border-zinc-100 bg-zinc-50 px-4 py-3", isPhone ? "rounded-[20px]" : "rounded-2xl")}>
                <Loader2 className="animate-spin text-purple-600" size={16} />
                <span className={cn("font-medium text-zinc-500", isPhone ? "text-[13px]" : "text-sm")}>Study Buddy is thinking...</span>
              </div>
            </div>
          )}
        </div>

        <div className={cn("shrink-0 border-t border-zinc-100 bg-zinc-50/80 backdrop-blur", isPhone ? "p-3" : "p-4")}>
          {saveError && (
            <p className="mx-auto mb-3 max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
              {saveError}
            </p>
          )}
          <div className={cn("relative mx-auto flex max-w-4xl items-end gap-2", isPhone && "gap-1.5")}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Study Buddy to explain, quiz, plan, or check your understanding..."
              rows={1}
              className={cn(
                "flex-1 resize-none border border-zinc-200 bg-white text-zinc-900 shadow-sm transition-all focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/10",
                isPhone
                  ? "max-h-24 min-h-12 rounded-[18px] px-4 py-3 pr-12 text-[13px]"
                  : "max-h-28 min-h-14 rounded-2xl px-5 py-4 pr-14 text-sm"
              )}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={cn("absolute bg-purple-600 text-white shadow-lg shadow-purple-200 transition-all hover:bg-purple-700 disabled:opacity-50", isPhone ? "bottom-1.5 right-1.5 rounded-[14px] p-2" : "bottom-2 right-2 rounded-xl p-2.5")}
            >
              <Send size={isPhone ? 16 : 18} />
            </button>
          </div>
          <p className={cn("mt-2 text-center font-medium uppercase tracking-widest text-zinc-400", isPhone ? "text-[9px]" : "text-[10px]")}>
            Guided Gemini tutor. Conversations save to your account.
          </p>
        </div>
      </div>
    </div>
  );
}
