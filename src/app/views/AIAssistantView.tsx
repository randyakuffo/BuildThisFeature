import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, Send, Search } from "lucide-react";
import { aiChat } from "../../lib/supabase";

type ChatMessage = { role: "user" | "assistant"; text: string };

export function AIAssistantView({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    text: "Hi! I'm your NudgeBox AI. I have full context of your inbox — ask me anything about your emails, tasks, or what to prioritize.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const prompts = [
    "What needs my attention?", "Which emails need replies?", "Summarize my inbox",
    "What am I waiting on?", "Find upcoming bills", "Show my action items",
  ];

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await aiChat(text, userId, [...messages, userMsg]);
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Something went wrong. Please try again." }]);
    }
    setLoading(false);
  }, [loading, messages, userId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const renderText = (text: string) =>
    text.split("**").map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
    );

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#161928] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>NudgeBox AI</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-gray-400 dark:text-slate-500">Live context · Your inbox</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC] dark:bg-[#0D0F1A]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-white dark:bg-[#161928] text-gray-800 dark:text-slate-200 border border-gray-100 dark:border-white/5 shadow-sm rounded-tl-sm"
              }`}>
                {renderText(msg.text)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white dark:bg-[#161928] border border-gray-100 dark:border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                <div className="flex gap-1.5 items-center h-4">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Prompts */}
        <div className="px-6 pt-3 pb-1 bg-white dark:bg-[#161928] border-t border-gray-100 dark:border-white/5">
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {prompts.map((p) => (
              <button key={p} onClick={() => send(p)} disabled={loading} className="text-[11px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors font-medium flex-shrink-0 disabled:opacity-50">
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="px-6 pb-6 pt-2 bg-white dark:bg-[#161928]">
          <div className="flex gap-3 items-end">
            <div className="flex-1 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
                placeholder="Ask me anything about your inbox…"
                className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
              />
            </div>
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center transition-colors shadow-sm"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-56 border-l border-gray-100 dark:border-white/5 bg-white dark:bg-[#161928] p-4 hidden xl:block overflow-y-auto space-y-5">
        <div>
          <h4 className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Try asking</h4>
          <div className="space-y-1">
            {["Invoice from this month", "My flight confirmation", "Emails from my boss", "Receipts over $100", "Contracts expiring"].map((s) => (
              <button key={s} onClick={() => send(s)} className="w-full text-left text-xs text-gray-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-1.5 flex items-center gap-2">
                <Search className="w-3 h-3 opacity-50" /> {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

