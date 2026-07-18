import { useState } from "react";
import {
  Inbox, RefreshCw, Sparkles, CheckSquare, Send, Reply, Archive, Check, CheckCircle2,
} from "lucide-react";
import type { GmailEmail } from "../types";
import { archiveEmail, markAsRead, sendReply } from "../../lib/supabase";
import { Card, PageHeader, Avatar, PriorityBadge, Spinner } from "../components/primitives";
import { getEstimatedReplyTime, getSuggestedAction } from "../lib/helpers";

export function InboxView({ emails, onArchive, onMarkRead, userId, onRefresh }: { emails: GmailEmail[]; onArchive: (id: string) => void; onMarkRead: (id: string) => void; userId: string; onRefresh: () => void; }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyDone, setReplyDone] = useState<string | null>(null);

  const categories = ["All", ...Array.from(new Set(emails.map((e) => e.category))).filter(Boolean)];
  const filtered = activeCategory === "All" ? emails : emails.filter((e) => e.category === activeCategory);

  const handleArchive = async (id: string) => {
    await archiveEmail(id, userId);
    onArchive(id);
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead(id, userId);
    onMarkRead(id);
  };

  const handleReply = async (email: GmailEmail) => {
    if (!replyText.trim()) return;
    setReplySending(true);
    await sendReply(email.senderEmail,
      `Re: ${email.subject}`,
      replyText,
      email.threadId
    );
    setReplySending(false);
    setReplyDone(email.id);
    setReplyOpen(null);
    setReplyText("");
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <PageHeader
        title="Smart Inbox"
        subtitle="AI-powered triage — focus on what matters"
        action={
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="flex items-center gap-2 text-sm bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white dark:bg-[#161928] text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500"
            }`}
          >
            {cat}
            {cat !== "All" && <span className="ml-1 opacity-60">{emails.filter(e => e.category === cat).length}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No emails in this category.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
            {filtered.map((email) => (
              <div key={email.id}>
                {/* Row */}
                <div
                  className={`flex items-start gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer ${!email.isRead ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""}`}
                  onClick={() => {
                    setExpanded(expanded === email.id ? null : email.id);
                    if (!email.isRead) handleMarkRead(email.id);
                  }}
                >
                  <Avatar initials={email.initials} bg={email.avatarBg} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {!email.isRead && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 flex-shrink-0" />}
                      <span className={`text-sm ${!email.isRead ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-slate-300"}`}>
                        {email.senderName}
                      </span>
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 truncate">· {email.senderEmail}</span>
                    </div>
                    <p className={`text-sm mb-1 truncate ${!email.isRead ? "font-medium text-gray-800 dark:text-slate-100" : "text-gray-600 dark:text-slate-400"}`}>
                      {email.subject}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 line-clamp-1">{email.snippet}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">{email.timeDisplay}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{email.category}</span>
                      <PriorityBadge priority={email.priority} />
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {expanded === email.id && (
                  <div className="px-6 py-4 bg-indigo-50/40 dark:bg-indigo-950/10 border-t border-indigo-100 dark:border-indigo-900/30">
                    {/* AI metadata row */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {email.aiConfidence > 0 && (
                        <span className="text-[10px] font-medium bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                          {Math.round(email.aiConfidence * 100)}% confidence
                        </span>
                      )}
                      {getEstimatedReplyTime(email) && (
                        <span className="text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                          Reply: {getEstimatedReplyTime(email)}
                        </span>
                      )}
                      <span className="text-[10px] font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                        Suggested: {getSuggestedAction(email)}
                      </span>
                      {email.dueDate && (
                        <span className="text-[10px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                          Due: {email.dueDate}
                        </span>
                      )}
                    </div>
                    {/* AI summary or snippet */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                          {email.aiSummary ? "AI Summary" : "Preview"}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                          {email.aiSummary || email.snippet}
                        </p>
                      </div>
                    </div>
                    {/* Action items */}
                    {email.actionItems && email.actionItems.length > 0 && (
                      <div className="mb-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl px-4 py-3">
                        <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-2">Action Items</p>
                        <div className="space-y-1.5">
                          {email.actionItems.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <CheckSquare className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-gray-700 dark:text-slate-300">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {replyDone === email.id ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-3">
                        <CheckCircle2 className="w-4 h-4" /> Reply sent!
                      </div>
                    ) : replyOpen === email.id ? (
                      <div className="mb-4">
                        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl p-3 mb-2">
                          <div className="text-[11px] text-gray-400 dark:text-slate-500 mb-1.5">To: {email.senderEmail}</div>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write your reply…"
                            rows={3}
                            className="w-full text-sm text-gray-900 dark:text-white bg-transparent outline-none resize-none placeholder-gray-400 dark:placeholder-slate-500"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReply(email)}
                            disabled={replySending || !replyText.trim()}
                            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" /> {replySending ? "Sending…" : "Send"}
                          </button>
                          <button onClick={() => setReplyOpen(null)} className="text-xs text-gray-500 dark:text-slate-400 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button onClick={() => setReplyOpen(email.id)} className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
                          <Reply className="w-3 h-3" /> Reply
                        </button>
                        <button onClick={() => handleArchive(email.id)} className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                          <Archive className="w-3 h-3" /> Archive
                        </button>
                        <button onClick={() => handleMarkRead(email.id)} className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                          <Check className="w-3 h-3" /> Mark Read
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

