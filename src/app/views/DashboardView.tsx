import {
  Sparkles, Mail, AlertTriangle, CreditCard, MessageSquare, Zap, CheckCircle2,
  Inbox, ArrowRight, CheckSquare, Users, Clock, Calendar, Reply,
} from "lucide-react";
import type { GmailEmail, Insights, Stats, View } from "../types";
import { Card, Avatar, PriorityBadge, StatusBadge, Spinner } from "../components/primitives";
import { colorMap, computeWorkHealthScore, getTodaysFocus } from "../lib/helpers";

export function DashboardView({
  emails, stats, insights, brief, briefLoading, setView, user, syncing,
}: {
  emails: GmailEmail[];
  stats: Stats;
  insights: Insights;
  brief: { highlights: string[]; summary: string } | null;
  briefLoading: boolean;
  setView: (v: View) => void;
  user: any;
  syncing: boolean;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const firstName = (user?.user_metadata?.name || "").split(" ")[0] || "there";

  const topEmails = emails.slice(0, 5);
  const health = computeWorkHealthScore(emails, insights, stats);
  const focus = getTodaysFocus(emails, insights);

  const focusPriorityStyle = (p: string) =>
    p === "high" ? "bg-red-50 dark:bg-red-950/30 border-l-2 border-red-400" :
    p === "medium" ? "bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400" :
    "bg-gray-50 dark:bg-[#1E2235] border-l-2 border-gray-200 dark:border-slate-700";

  const focusTypeIcon = (type: string) => {
    if (type === "security") return <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
    if (type === "bill") return <CreditCard className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
    if (type === "reply") return <Reply className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />;
    if (type === "action") return <CheckSquare className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />;
    if (type === "followup") return <Users className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
    if (type === "waiting") return <Clock className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />;
    return <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />;
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Hero */}
      <div className="flex flex-col lg:flex-row gap-5 mb-6">
        <div className="flex-1">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">{today}</p>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-tight" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            {greeting}, {firstName}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1.5 text-sm">
            {syncing ? "Syncing your inbox…" : "Here's your work command center."}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {stats.unread > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full font-medium">
                <Mail className="w-3 h-3" /> {stats.unread} unread
              </div>
            )}
            {(Array.isArray(insights.security) ? insights.security : []).length > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full font-medium">
                <AlertTriangle className="w-3 h-3" /> {insights.security.length} security alert{insights.security.length !== 1 ? "s" : ""}
              </div>
            )}
            {(Array.isArray(insights.bills) ? insights.bills : []).filter((b: any) => b.status === "overdue").length > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full font-medium">
                <CreditCard className="w-3 h-3" /> Bill overdue
              </div>
            )}
            {(Array.isArray(insights.bills) ? insights.bills : []).filter((b: any) => b.status === "due_soon").length > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full font-medium">
                <CreditCard className="w-3 h-3" /> Bill due soon
              </div>
            )}
          </div>
        </div>

        {/* AI Card */}
        <Card className="lg:w-96 p-5 bg-gradient-to-br from-indigo-600 to-blue-700 dark:from-indigo-700 dark:to-blue-900 border-0 shadow-lg shadow-indigo-500/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Work Copilot</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2.5 mb-3 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => setView("ai")}>
            <MessageSquare className="w-4 h-4 text-white/60 flex-shrink-0" />
            <span className="text-white/50 text-sm">What should I work on first?</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["What needs replies?", "Summarize today", "Who owes me?", "Show promises", "Prepare for meetings"].map((p) => (
              <button key={p} onClick={() => setView("ai")} className="text-[11px] bg-white/10 hover:bg-white/20 text-white/80 hover:text-white px-2.5 py-1 rounded-lg transition-colors">
                {p}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Work Health Score + Today's Focus + 6-metric summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Work Health Score */}
        <Card className="p-5 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Inbox Health Score</p>
          <div className="relative w-28 h-28 mb-3">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
              <circle cx="56" cy="56" r="44" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-slate-800" />
              <circle
                cx="56" cy="56" r="44" fill="none"
                stroke={health.ringColor} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - health.score / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{health.score}</span>
            </div>
          </div>
          <span className={`text-sm font-bold ${health.color}`}>{health.label}</span>
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Based on {stats.total} emails</p>
        </Card>

        {/* Today's Focus */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Today's Focus</h3>
              <span className="text-[10px] bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">{focus.length} priorities</span>
            </div>
          </div>
          {focus.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">All clear — no urgent priorities</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Sync your inbox to detect priorities</p>
            </div>
          ) : (
            <div className="space-y-2">
              {focus.map((item, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${focusPriorityStyle(item.priority)}`}>
                  {focusTypeIcon(item.type)}
                  <p className="text-xs text-gray-800 dark:text-slate-200 flex-1 leading-snug">{item.text}</p>
                  {item.type === "reply" && (
                    <button onClick={() => setView("inbox")} className="text-[10px] font-medium bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0">
                      Open
                    </button>
                  )}
                  {item.type === "action" && (
                    <button onClick={() => setView("action")} className="text-[10px] font-medium bg-violet-600 text-white px-2.5 py-1 rounded-lg hover:bg-violet-700 transition-colors flex-shrink-0">
                      View
                    </button>
                  )}
                  {item.type === "bill" && (
                    <button onClick={() => setView("bills")} className="text-[10px] font-medium bg-amber-600 text-white px-2.5 py-1 rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0">
                      View
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 6-metric summary row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Unread", value: stats.unread || 0, icon: Mail, color: "indigo", onClick: () => setView("inbox") },
          { label: "Action Items", value: (Array.isArray(insights.actionItems) ? insights.actionItems : []).length, icon: CheckSquare, color: "violet", onClick: () => setView("action") },
          { label: "Waiting On", value: (Array.isArray(insights.waitingOn) ? insights.waitingOn : []).length, icon: Clock, color: "sky", onClick: () => setView("waiting") },
          { label: "Bills", value: (Array.isArray(insights.bills) ? insights.bills : []).length, icon: CreditCard, color: "red", onClick: () => setView("bills") },
          { label: "Follow Ups", value: (Array.isArray(insights.followUps) ? insights.followUps : []).length, icon: Users, color: "emerald", onClick: () => setView("followup") },
          { label: "Security", value: (Array.isArray(insights.security) ? insights.security : []).length, icon: AlertTriangle, color: "red", onClick: () => setView("security") },
        ].map((card) => {
          const { bg, icon: iconCls } = colorMap[card.color] ?? colorMap.slate;
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={card.onClick}>
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-2.5`}>
                <Icon className={`w-4 h-4 ${iconCls}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                {card.value}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-tight">{card.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* AI Daily Brief */}
        <Card className="lg:col-span-1 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Today's AI Brief</h3>
            </div>
          </div>
          {briefLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : brief ? (
            <>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">{brief.summary}</p>
              <div className="space-y-2 mb-4">
                {(() => {
                  const safeBriefHighlights = Array.isArray(brief?.highlights)
                    ? brief.highlights.filter((item): item is string => typeof item === "string")
                    : [];
                  return safeBriefHighlights.slice(0, 5).map((highlight, index) => (
                    <div key={`${highlight}-${index}`} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                      <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">{highlight}</p>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView("ai")} className="flex-1 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 transition-colors">
                  Generate Replies
                </button>
                <button onClick={() => setView("ai")} className="flex-1 text-xs font-medium bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl py-2 transition-colors">
                  Ask AI More
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Sync your inbox to generate a brief.</p>
          )}
        </Card>

        {/* Smart Inbox Preview */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Smart Inbox</h3>
              {stats.unread > 0 && (
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full">
                  {stats.unread} unread
                </span>
              )}
            </div>
            <button onClick={() => setView("inbox")} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {topEmails.length > 0 ? (
            <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
              {topEmails.map((email) => (
                <div
                  key={email.id}
                  className={`flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer ${!email.isRead ? "bg-indigo-50/30 dark:bg-indigo-950/10" : ""}`}
                  onClick={() => setView("inbox")}
                >
                  <Avatar initials={email.initials} bg={email.avatarBg} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={`text-sm truncate ${!email.isRead ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-slate-300"}`}>
                        {email.senderName}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">{email.timeDisplay}</span>
                    </div>
                    <p className={`text-xs truncate mb-0.5 ${!email.isRead ? "font-medium text-gray-800 dark:text-slate-200" : "text-gray-600 dark:text-slate-400"}`}>
                      {email.subject}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{email.snippet}</p>
                  </div>
                  <StatusBadge status={email.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="w-8 h-8 text-gray-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-gray-400 dark:text-slate-500">
                {syncing ? "Loading emails…" : "No emails yet. Try syncing your inbox."}
              </p>
            </div>
          )}
        </Card>

        {/* Action Items */}
        {insights.actionItems.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Action Items</h3>
              <button onClick={() => setView("action")} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">View all</button>
            </div>
            <div className="space-y-2.5">
              {(Array.isArray(insights.actionItems) ? insights.actionItems : []).slice(0, 4).map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckSquare className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 dark:text-slate-300 font-medium leading-tight">{item.text}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{item.from}</p>
                  </div>
                  <PriorityBadge priority={item.priority || "Medium"} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Calendar Events */}
        {insights.calendar.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Calendar</h3>
              <button onClick={() => setView("calendar")} className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline">View all</button>
            </div>
            <div className="space-y-2.5">
              {(Array.isArray(insights.calendar) ? insights.calendar : []).slice(0, 4).map((ev: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1 h-10 rounded-full bg-indigo-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{ev.title}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">{ev.time} · {ev.location || ev.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

