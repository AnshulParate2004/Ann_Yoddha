import { useState, useRef, useEffect } from "react";
import * as speechsdk from "microsoft-cognitiveservices-speech-sdk";
import { Send, Loader2, Wheat, Plus, Clock, Sparkles, Mic, MicOff } from "lucide-react";
import { api } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

type Message = {
  id: string;
  role: "user" | "bot" | "status";
  content: string;
};

type Session = {
  session_id: string;
  first_message: string;
  created_at: string;
  message_count: number;
};

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function newSessionId() {
  return crypto.randomUUID();
}

const WELCOME: Message = {
  id: "welcome",
  role: "bot",
  content:
    "Hello! I am your completely agentic AI Agronomist. Ask me any question about wheat disease management and I will autonomously query your agronomy manual or fallback to a live web search!",
};

const Chat = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => newSessionId());
  const [currentSessionId, setCurrentSessionId] = useState<string>(activeSessionId);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"inactive" | "listening" | "thinking" | "speaking">("inactive");
  const [interimTranscript, setInterimTranscript] = useState("");
  const isVoiceModeActive = useRef(false);
  const recognizerRef = useRef<speechsdk.SpeechRecognizer | null>(null);
  const voiceSynthesizerRef = useRef<speechsdk.SpeechSynthesizer | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startListeningLoop = async () => {
    if (!isVoiceModeActive.current) return;
    setVoiceMode("listening");
    setInterimTranscript("");

    try {
      const { token, region } = await api.getSpeechToken();
      const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(token, region);
      const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
      const autoDetectSourceLanguageConfig = speechsdk.AutoDetectSourceLanguageConfig.fromLanguages(['en-IN', 'hi-IN', 'mr-IN', 'pa-IN']);
      
      const recognizer = speechsdk.SpeechRecognizer.FromConfig(speechConfig, autoDetectSourceLanguageConfig, audioConfig);
      recognizerRef.current = recognizer;
      
      recognizer.recognizing = (s, e) => {
        if (!isVoiceModeActive.current) return;
        if (e.result.reason === speechsdk.ResultReason.RecognizingSpeech) {
          setInterimTranscript(e.result.text);
        }
      };

      recognizer.recognizeOnceAsync(
        (result) => {
          if (!isVoiceModeActive.current) { setTimeout(() => recognizer.close(), 100); return; }
          
          if (result.reason === speechsdk.ResultReason.RecognizedSpeech && result.text.trim()) {
            setVoiceMode("thinking");
            setQuery(result.text);
            submitQuery(result.text);
          } else {
            setTimeout(() => { if (isVoiceModeActive.current) startListeningLoop(); }, 500);
          }
          setTimeout(() => recognizer.close(), 100);
        },
        (error) => {
          console.error(error);
          if (isVoiceModeActive.current) {
             setVoiceMode("inactive");
             isVoiceModeActive.current = false;
          }
          setTimeout(() => recognizer.close(), 100);
        }
      );
    } catch (error) {
      console.error(error);
      setVoiceMode("inactive");
      isVoiceModeActive.current = false;
    }
  };

  const playTextToSpeech = async (text: string) => {
    if (!isVoiceModeActive.current) return;
    setVoiceMode("speaking");

    try {
      const { token, region } = await api.getSpeechToken();
      const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechSynthesisVoiceName = "en-US-JennyMultilingualV2Neural";
      const synthesizer = new speechsdk.SpeechSynthesizer(speechConfig);
      voiceSynthesizerRef.current = synthesizer;
      
      const cleanText = text
        .replace(/[#*`~_]/g, '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '');
        
      synthesizer.speakTextAsync(
        cleanText, 
        () => {
          if (isVoiceModeActive.current) startListeningLoop();
          setTimeout(() => synthesizer.close(), 100);
        },
        (e) => { 
          console.error(e); 
          if (isVoiceModeActive.current) startListeningLoop();
          setTimeout(() => synthesizer.close(), 100);
        }
      );
    } catch (e) {
      console.error(e);
      if (isVoiceModeActive.current) startListeningLoop();
    }
  };

  const toggleVoiceMode = () => {
    if (voiceMode !== "inactive") {
      isVoiceModeActive.current = false;
      setVoiceMode("inactive");
      if (recognizerRef.current) setTimeout(() => recognizerRef.current?.close(), 100);
      if (voiceSynthesizerRef.current) setTimeout(() => voiceSynthesizerRef.current?.close(), 100);
    } else {
      isVoiceModeActive.current = true;
      startListeningLoop();
    }
  };

  useEffect(() => {
    return () => {
      isVoiceModeActive.current = false;
      if (recognizerRef.current) setTimeout(() => recognizerRef.current?.close(), 100);
      if (voiceSynthesizerRef.current) setTimeout(() => voiceSynthesizerRef.current?.close(), 100);
    };
  }, []);

  // Load sessions list on mount & auto-load latest
  useEffect(() => {
    const initChat = async () => {
      try {
        const { sessions: s } = await api.getChatSessions();
        setSessions(s);
        
        // If there's a recent session, load it automatically
        if (s && s.length > 0) {
          handleSelectSession(s[0].session_id);
        }
      } catch (err) {
        console.error("Failed to load chat sessions:", err);
      }
    };
    
    initChat();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleNewChat = () => {
    const newId = newSessionId();
    setActiveSessionId(newId);
    setCurrentSessionId(newId);
    setMessages([WELCOME]);
  };

  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setLoadingSession(true);
    setActiveSessionId(sessionId);
    setMessages([WELCOME]);
    try {
      const { messages: raw } = await api.getSessionMessages(sessionId);
      const formatted: Message[] = raw.map((m) => ({
        id: m.id.toString(),
        role: m.role as "user" | "bot",
        content: m.content,
      }));
      setMessages([WELCOME, ...formatted]);
    } catch {
      console.error("Failed to load session messages");
    } finally {
      setLoadingSession(false);
    }
  };

  const submitQuery = async (textToSubmit: string) => {
    if (!textToSubmit.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSubmit.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsStreaming(true);

    const botMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: botMessageId, role: "status", content: "Agent is analyzing your query..." },
    ]);

    try {
      const response = await api.streamChat(userMessage.content, activeSessionId);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) return;

      let finalAnswer = "";
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.event === "status") {
                setMessages((prev) => prev.map((msg) => msg.id === botMessageId ? { ...msg, role: "status", content: `⏳ ${data.message}` } : msg));
              } else if (data.event === "final_result") {
                finalAnswer = data.data.answer;
                setMessages((prev) => prev.map((msg) => msg.id === botMessageId ? { ...msg, role: "bot", content: finalAnswer } : msg));
                playTextToSpeech(finalAnswer);
              } else if (data.event === "error") {
                setMessages((prev) => prev.map((msg) => msg.id === botMessageId ? { ...msg, role: "status", content: `❌ Error: ${data.message}` } : msg));
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }

      api.getChatSessions().then(({ sessions: s }) => setSessions(s)).catch(console.error);
    } catch (err) {
      console.error(err);
      setMessages((prev) => prev.map((msg) => msg.id === botMessageId ? { ...msg, role: "status", content: "❌ Connection failed." } : msg));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(query);
  };

  const isViewingPast = activeSessionId !== currentSessionId;

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-2xl shadow-xl border border-border relative">

      {/* ── GEMINI VOICE OVERLAY ── */}
      {voiceMode !== "inactive" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-2xl transition-all duration-500 rounded-2xl animate-in fade-in zoom-in-95">
           <button 
             onClick={toggleVoiceMode}
             className="absolute top-6 right-6 p-4 rounded-full bg-white/50 dark:bg-black/50 hover:bg-white dark:hover:bg-black text-slate-800 dark:text-slate-100 transition-all border border-border/50 shadow-md backdrop-blur-md"
           >
             <div className="h-5 w-5 relative">
                <span className="absolute left-2 w-0.5 h-5 bg-current rotate-45 rounded-full" />
                <span className="absolute left-2 w-0.5 h-5 bg-current -rotate-45 rounded-full" />
             </div>
           </button>
           
           <div className="relative flex items-center justify-center h-64 w-64 mb-16">
              {voiceMode === "listening" && (
                <>
                   <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-2xl animate-ping" style={{ animationDuration: '3s' }} />
                   <div className="absolute inset-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-[0_0_80px_rgba(52,211,153,0.5)] animate-pulse" />
                   <Mic className="absolute h-14 w-14 text-white z-10" />
                </>
              )}
              {voiceMode === "thinking" && (
                <>
                   <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-3xl animate-pulse" />
                   <div className="absolute inset-8 rounded-full border-t-[6px] border-l-[6px] border-blue-500 animate-spin opacity-90 shadow-[0_0_60px_rgba(59,130,246,0.3)]" />
                   <Sparkles className="absolute h-14 w-14 text-blue-500 z-10 animate-pulse" />
                </>
              )}
              {voiceMode === "speaking" && (
                <>
                   <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-3xl animate-ping" style={{ animationDuration: '1.5s' }} />
                   <div className="absolute inset-6 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_100px_rgba(168,85,247,0.6)]" />
                   <div className="absolute h-12 w-12 rounded-full bg-white shadow-inner animate-bounce" style={{ animationDuration: '0.8s' }} />
                </>
              )}
           </div>
           
           <div className="text-center max-w-xl px-8">
             <h2 className={cn(
               "text-3xl font-extrabold mb-5 bg-clip-text text-transparent tracking-tight transition-colors duration-500",
               voiceMode === "listening" ? "bg-gradient-to-r from-emerald-500 to-green-600" :
               voiceMode === "thinking" ? "bg-gradient-to-r from-blue-500 to-indigo-600" :
               "bg-gradient-to-r from-purple-500 to-pink-600"
             )}>
               {voiceMode === "listening" ? "Listening..." : voiceMode === "thinking" ? "Thinking..." : "Speaking..."}
             </h2>
             <p className="text-2xl text-slate-700 dark:text-slate-200 min-h-[90px] leading-relaxed font-medium">
               {voiceMode === "listening" && (interimTranscript || "I am listening. What's on your mind?")}
               {voiceMode === "thinking" && "Processing your request..."}
               {voiceMode === "speaking" && "Agent is replying out loud..."}
             </p>
           </div>
        </div>
      )}

      {/* ── LEFT SIDEBAR ── */}
      <aside
        className={cn(
          "flex w-[240px] shrink-0 flex-col border-r",
          isDark ? "border-white/10" : "border-border bg-muted/40"
        )}
        style={isDark ? { background: "linear-gradient(180deg, #1a2e1a 0%, #0f1f0f 100%)" } : {}}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-2.5 px-5 py-5 border-b", isDark ? "border-white/10" : "border-border")}>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", isDark ? "bg-emerald-500/20" : "bg-primary/10")}>
            <Wheat className={cn("h-4 w-4", isDark ? "text-emerald-400" : "text-primary")} />
          </div>
          <span className={cn("font-semibold text-sm", isDark ? "text-white" : "text-foreground")}>Ann Yoddha</span>
        </div>

        {/* New Chat */}
        <div className="px-3 py-3">
          <button
            onClick={handleNewChat}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all",
              isDark
                ? "border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                : "border-border bg-background text-foreground hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Plus className="h-4 w-4" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Current session (unsaved) */}
        {!isViewingPast && (
          <div className="px-3 pb-1">
            <p className={cn("px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest", isDark ? "text-white/30" : "text-muted-foreground/60")}>Active</p>
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm",
                isDark ? "bg-emerald-600/30 text-emerald-300" : "bg-primary/10 text-primary font-medium"
              )}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-medium">Current session</span>
            </button>
          </div>
        )}

        {/* Past sessions */}
        {sessions.length > 0 && (
          <div className="mt-2 flex-1 overflow-y-auto px-3">
            <p className={cn("px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest", isDark ? "text-white/30" : "text-muted-foreground/60")}>History</p>
            <div className="flex flex-col gap-0.5">
              {sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => handleSelectSession(s.session_id)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                    activeSessionId === s.session_id
                      ? isDark ? "bg-emerald-600/30 text-emerald-300" : "bg-primary/10 text-primary font-medium"
                      : isDark ? "text-white/50 hover:bg-white/5 hover:text-white/80" : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                  )}
                >
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <div className={cn("text-[10px] mb-0.5", isDark ? "text-white/30" : "text-muted-foreground/60")}>
                      {formatDateLabel(s.created_at)} · {s.message_count}/100
                    </div>
                    <div className="truncate text-xs">{s.first_message || "Conversation"}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && isViewingPast === false && (
          <div className="flex flex-1 items-center justify-center px-4 text-center">
            <p className={cn("text-xs leading-relaxed", isDark ? "text-white/25" : "text-muted-foreground")}>
              Past conversations<br />will appear here
            </p>
          </div>
        )}

        {/* Footer */}
        <div className={cn("border-t px-5 py-3", isDark ? "border-white/10" : "border-border")}>
          <p className={cn("text-[10px]", isDark ? "text-white/20" : "text-muted-foreground/50")}>Powered by Azure OpenAI + RAG</p>
        </div>
      </aside>

      {/* ── MAIN CHAT ── */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#f8faf8] dark:bg-background">

        {/* Header */}
        <div className="flex items-center gap-3 border-b bg-white dark:bg-card px-6 py-4 shrink-0 shadow-sm">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-foreground text-sm">Ann Yoddha Agronomist</h3>
            <p className="text-xs text-slate-400 dark:text-muted-foreground flex items-center gap-1.5">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {isViewingPast ? `Viewing past conversation` : "Online · Agentic RAG + Live Web Search"}
            </p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {loadingSession ? (
            <div className="flex justify-center items-center h-32 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation...
            </div>
          ) : messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex items-end gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}
            >
              <div className={cn(
                "max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                m.role === "user"
                  ? "rounded-br-sm bg-gradient-to-br from-emerald-600 to-green-700 text-white"
                  : m.role === "status"
                  ? "ml-11 rounded-tl-sm border border-slate-200 bg-white/80 text-slate-500 italic text-xs dark:bg-muted dark:border-border dark:text-muted-foreground"
                  : "rounded-tl-sm border border-slate-100 bg-white text-slate-800 leading-relaxed dark:bg-card dark:border-border dark:text-foreground"
              )}>
                {m.role === "status" ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {m.content}
                  </span>
                ) : (
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => <h1 className="font-bold text-base mt-3 mb-1.5" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="font-semibold text-base mt-3 mb-1.5" {...props} />,
                      h3: ({ node, ...props }) => <h3 className={cn("font-semibold text-sm mt-3 mb-1", m.role === "user" ? "text-white/90" : "text-emerald-700 dark:text-emerald-400")} {...props} />,
                      p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0 leading-relaxed" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-3 space-y-1" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-3 space-y-1" {...props} />,
                      li: ({ node, ...props }) => <li className="pl-0.5" {...props} />,
                      strong: ({ node, ...props }) => <strong className={cn("font-semibold", m.role === "user" ? "text-white" : "text-emerald-700 dark:text-emerald-400")} {...props} />,
                      hr: () => <hr className="my-3 border-slate-100 dark:border-border" />,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex items-end">
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm dark:bg-card dark:border-border">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t bg-white dark:bg-card px-6 py-4 shrink-0">
          {isViewingPast && (
            <p className="mb-2 text-center text-xs text-slate-400">
              Viewing a past conversation.{" "}
              <button onClick={handleNewChat} className="text-emerald-600 font-medium hover:underline">
                Start new conversation →
              </button>
            </p>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-center gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isViewingPast ? "Start a new conversation to chat..." : (voiceMode !== "inactive" ? "Listening..." : "Ask the Agronomist Agent anything...")}
              className="flex-1 rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-5 pr-[100px] text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 focus:bg-white disabled:opacity-50 dark:bg-muted dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground"
              disabled={isStreaming || isViewingPast}
            />
            
            <div className="absolute right-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleVoiceMode}
                disabled={isStreaming || isViewingPast}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-all disabled:opacity-40",
                  voiceMode !== "inactive" 
                    ? "bg-emerald-500 text-white hover:bg-emerald-600 border border-emerald-600 dark:bg-emerald-600 dark:border-emerald-700 animate-pulse" 
                    : "bg-white text-slate-500 hover:bg-slate-50 hover:text-emerald-600 border border-slate-200 dark:bg-muted dark:border-border dark:text-muted-foreground dark:hover:text-emerald-400"
                )}
              >
                {voiceMode !== "inactive" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={!query.trim() || isStreaming || isViewingPast}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="h-4 w-4 ml-0.5" />
              </button>
            </div>
          </form>
          {!isViewingPast && (
            <p className="mt-2 text-center text-[10px] text-slate-300 dark:text-muted-foreground/40">
              Powered by Azure OpenAI · PageIndex RAG · Tavily Web Search
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
