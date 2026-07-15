import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Inbox, Bot, CheckSquare, Clock, Users, Calendar,
  CreditCard, Package, Paperclip, Search, Zap, Shield, BarChart2,
  Settings, Bell, ChevronLeft, ChevronRight, Moon, Sun, Sparkles,
  TrendingUp, TrendingDown, ArrowRight, Mail, Star, AlertTriangle,
  RefreshCw, MoreHorizontal, Send, Plus, MessageSquare, Archive,
  Check, Reply, FileText, Image, DollarSign, Activity, Lock,
  ShieldAlert, Eye, User, Globe, X, ChevronDown, Filter,
  LogOut, RotateCcw, ExternalLink, Copy, Plane, ShoppingCart,
  CheckCircle2, Circle, Building
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  supabase, signInWithGoogle, signOut, syncGmail, getCachedEmails,
  getInsights, getDailyBrief, archiveEmail, markAsRead, searchEmails,
  aiChat, sendReply, fetchMessageBody, reclassifyEmails, regenerateInsights,
  repairAIData,
} from "../lib/supabase";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface GmailEmail {
  id: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  timeDisplay: string;
  isRead: boolean;
  isImportant: boolean;
  isStarred: boolean;
  category: string;
  priority: string;
  status: string;
  labels: string[];
  initials: string;
  avatarBg: string;
  aiSummary: string | null;
  requiresReply: boolean;
  actionItems: string[];
  dueDate: string | null;
  aiConfidence: number;
}

interface Insights {
  actionItems: any[];
  waitingOn: any[];
  bills: any[];
  followUps: any[];
  calendar: any[];
  security: any[];
  purchases: any[];
}

interface DailyBrief {
  summary: string;
  highlights: string[];
}

const EMPTY_INSIGHTS: Insights = {
  actionItems: [],
  waitingOn: [],
  bills: [],
  followUps: [],
  calendar: [],
  security: [],
  purchases: [],
};

function normalizeEmail(raw: any): GmailEmail {
  return {
    ...raw,
    id: typeof raw?.id === "string" ? raw.id : "",
    threadId: typeof raw?.threadId === "string" ? raw.threadId : "",
    senderName: typeof raw?.senderName === "string" ? raw.senderName : "Unknown Sender",
    senderEmail: typeof raw?.senderEmail === "string" ? raw.senderEmail : "",
    subject: typeof raw?.subject === "string" ? raw.subject : "(No subject)",
    snippet: typeof raw?.snippet === "string" ? raw.snippet : "",
    receivedAt: typeof raw?.receivedAt === "string" ? raw.receivedAt : "",
    timeDisplay: typeof raw?.timeDisplay === "string" ? raw.timeDisplay : "",
    isRead: Boolean(raw?.isRead),
    isImportant: Boolean(raw?.isImportant),
    isStarred: Boolean(raw?.isStarred),
    category: typeof raw?.category === "string" ? raw.category : "Other",
    priority: typeof raw?.priority === "string" ? raw.priority : "Medium",
    status: typeof raw?.status === "string" ? raw.status : "Information",
    labels: Array.isArray(raw?.labels)
      ? raw.labels.filter((item: unknown): item is string => typeof item === "string")
      : [],
    initials: typeof raw?.initials === "string" ? raw.initials : "?",
    avatarBg: typeof raw?.avatarBg === "string" ? raw.avatarBg : "#64748B",
    aiSummary: typeof raw?.aiSummary === "string" ? raw.aiSummary : null,
    requiresReply: Boolean(raw?.requiresReply),
    actionItems: Array.isArray(raw?.actionItems)
      ? raw.actionItems.filter((item: unknown): item is string => typeof item === "string")
      : [],
    dueDate: typeof raw?.dueDate === "string" ? raw.dueDate : null,
    aiConfidence: Number.isFinite(Number(raw?.aiConfidence)) ? Number(raw.aiConfidence) : 0,
  };
}

interface Stats {
  total: number;
  unread: number;
  important: number;
  needsReply: number;
  byCategory: Record<string, number>;
}

type View =
  | "dashboard" | "inbox" | "ai" | "action" | "waiting" | "followup"
  | "calendar" | "bills" | "purchases" | "attachments" | "search"
  | "automations" | "security" | "analytics" | "settings";

type AppState = "loading" | "unauthenticated" | "syncing" | "ready" | "error";

interface AIProcessingStatus {
  classificationStatus: "idle" | "running" | "completed" | "partial" | "failed" | "fallback";
  classificationProvider: "groq" | "gemini" | "fallback" | null;
  insightsStatus: "idle" | "running" | "completed" | "failed" | "fallback";
  insightsProvider: "groq" | "gemini" | "fallback" | null;
  classifiedCount: number;
  fallbackCount: number;
}

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────

const navItems: { id: View; label: string; icon: React.ComponentType<{ className?: string }>; badgeKey?: keyof Stats | string }[] = [
  { id: "dashboard",   label: "Dashboard",             icon: LayoutDashboard },
  { id: "inbox",       label: "Inbox",                 icon: Inbox,      badgeKey: "unread" },
  { id: "ai",          label: "AI Assistant",          icon: Bot },
  { id: "action",      label: "Action Center",         icon: CheckSquare },
  { id: "waiting",     label: "Waiting On",            icon: Clock },
  { id: "followup",    label: "Follow Ups",            icon: Users },
  { id: "calendar",    label: "Calendar",              icon: Calendar },
  { id: "bills",       label: "Bills & Subscriptions", icon: CreditCard },
  { id: "purchases",   label: "Purchases",             icon: Package },
  { id: "attachments", label: "Attachments",           icon: Paperclip },
  { id: "search",      label: "Search",                icon: Search },
  { id: "automations", label: "Automations",           icon: Zap },
  { id: "security",    label: "Security",              icon: Shield },
  { id: "analytics",   label: "Analytics",             icon: BarChart2 },
  { id: "settings",    label: "Settings",              icon: Settings },
];

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-[#161928] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Avatar({ initials, bg, size = "md" }: { initials: string; bg: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-11 h-11 text-sm" : "w-9 h-9 text-xs";
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`} style={{ background: bg }}>
      {initials}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const c: Record<string, string> = {
    High:   "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
    Medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    Low:    "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c[priority] ?? c.Low}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
    "Needs Reply":     "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400",
    "Action Required": "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
    "Info":            "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
    "Reminder":        "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    "Review":          "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
    "Read":            "bg-gray-50 text-gray-500 dark:bg-slate-800 dark:text-slate-400",
  };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c[status] ?? "bg-gray-50 text-gray-600"}`}>{status}</span>;
}

function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-indigo-500 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const colorMap: Record<string, { bg: string; icon: string; stroke: string }> = {
  indigo:  { bg: "bg-indigo-50 dark:bg-indigo-950/40",  icon: "text-indigo-600 dark:text-indigo-400",  stroke: "#6366F1" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-950/40",    icon: "text-amber-600 dark:text-amber-400",    stroke: "#F59E0B" },
  violet:  { bg: "bg-violet-50 dark:bg-violet-950/40",  icon: "text-violet-600 dark:text-violet-400",  stroke: "#7C3AED" },
  sky:     { bg: "bg-sky-50 dark:bg-sky-950/40",        icon: "text-sky-600 dark:text-sky-400",        stroke: "#0EA5E9" },
  red:     { bg: "bg-red-50 dark:bg-red-950/40",        icon: "text-red-600 dark:text-red-400",        stroke: "#EF4444" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40",icon: "text-emerald-600 dark:text-emerald-400",stroke: "#10B981" },
  slate:   { bg: "bg-slate-100 dark:bg-slate-800/40",   icon: "text-slate-600 dark:text-slate-400",    stroke: "#64748B" },
};

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────

function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const isConfigError = error.includes("not enabled") || error.includes("OAuth") || error.includes("configured");

  const handleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Google sign-in failed:", error);
      setError(error?.message || "Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0D0F1A] flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>InboxOS</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Your AI Command Center for Email</p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {[
            { icon: "✦", label: "AI Summaries" },
            { icon: "⚡", label: "Smart Triage" },
            { icon: "🔒", label: "Secure OAuth" },
          ].map((f) => (
            <div key={f.label} className="bg-white dark:bg-[#161928] rounded-xl p-3 text-center border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="text-base mb-0.5">{f.icon}</div>
              <p className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">{f.label}</p>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className={`mb-4 p-3 rounded-xl text-sm text-left ${isConfigError ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"}`}>
            {error}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-200 font-semibold py-3.5 px-5 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 mb-3"
        >
          {loading ? <Spinner className="w-5 h-5" /> : (
            <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "Connecting…" : "Continue with Google"}
        </button>

        <p className="text-center text-[11px] text-gray-400 dark:text-slate-600 mb-6">
          Secured by Google OAuth 2.0 · No passwords stored
        </p>

        {/* Developer setup — collapsed, only relevant for app owner */}
        <div className="border-t border-gray-100 dark:border-white/5 pt-4">
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="w-full flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            <span>App owner setup guide</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSetup ? "rotate-180" : ""}`} />
          </button>

          {showSetup && (
            <div className="mt-3 text-xs space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5 text-gray-600 dark:text-slate-400">
                <p className="font-semibold text-gray-800 dark:text-slate-200 mb-1">One-time setup — regular users just click the button above.</p>
                <p className="mb-3 text-[11px]">Think of it like how Notion set up Google login once for all their users. Only you (the app owner) does this.</p>

                <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Step 1 — Google Cloud Console</p>
                <ol className="list-decimal list-inside space-y-1 mb-3">
                  <li>Go to <strong>console.cloud.google.com</strong> → create or select a project</li>
                  <li>APIs & Services → Library → search <strong>Gmail API</strong> → Enable</li>
                  <li>Credentials → Create Credentials → <strong>OAuth 2.0 Client ID</strong> → Web application</li>
                  <li>Add authorized redirect URI:<br/>
                    <code className="block mt-1 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] break-all">https://kkveffyelwdenrlzymip.supabase.co/auth/v1/callback</code>
                  </li>
                  <li>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                </ol>

                <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Step 2 — Supabase Dashboard</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Supabase Dashboard → Authentication → Providers → <strong>Google</strong></li>
                  <li>Toggle Enable, paste Client ID + Client Secret → <strong>Save</strong></li>
                  <li className="text-[10px] text-indigo-500 dark:text-indigo-400 list-none mt-1">✓ No extra scopes needed — the app requests Gmail access automatically</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5 text-gray-600 dark:text-slate-400">
                <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Step 3 — AI Features (optional)</p>
                <p>Add <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">OPENAI_API_KEY</code> in Make Settings → Secrets to enable AI summaries, briefings, and assistant chat.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SYNCING SCREEN ───────────────────────────────────────────────────────────

function SyncingScreen({ email }: { email: string }) {
  const steps = ["Connecting to Gmail…", "Fetching your inbox…", "Running AI analysis…", "Almost ready…"];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0D0F1A] flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/30 mx-auto mb-6">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
          Setting up your inbox
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">{email}</p>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={s} className={`flex items-center gap-3 text-sm transition-all ${i <= step ? "opacity-100" : "opacity-20"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${i < step ? "bg-emerald-500" : i === step ? "bg-indigo-500 animate-pulse" : "bg-gray-200 dark:bg-slate-700"}`}>
                {i < step ? <Check className="w-3 h-3 text-white" /> : <span className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
              <span className={i <= step ? "text-gray-700 dark:text-slate-300" : "text-gray-400 dark:text-slate-600"}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────

function AIStatusBadge({ aiStatus, onReclassify, reclassifying }: { aiStatus: AIProcessingStatus; onReclassify: () => void; reclassifying: boolean }) {
  const { classificationStatus, classificationProvider, insightsProvider } = aiStatus;

  let label = "";
  let color = "text-slate-500";

  if (classificationStatus === "idle") return null;
  if (classificationStatus === "running") { label = "AI processing…"; color = "text-indigo-400"; }
  else if (classificationStatus === "completed" && classificationProvider === "groq") { label = "AI sorted · Groq"; color = "text-emerald-400"; }
  else if (classificationStatus === "completed" && classificationProvider === "gemini") { label = "AI sorted · Gemini"; color = "text-blue-400"; }
  else if (classificationStatus === "partial") { label = "AI partial sort"; color = "text-amber-400"; }
  else if (classificationStatus === "failed" || classificationStatus === "fallback") { label = "AI unavailable · basic sort"; color = "text-slate-500"; }

  return (
    <div className="px-3 pt-1 pb-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] font-medium ${color} truncate`}>{label}</span>
        <button
          onClick={onReclassify}
          disabled={reclassifying}
          title="Re-run AI sorting"
          className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-40 flex-shrink-0 transition-colors"
        >
          {reclassifying ? "…" : "Re-sort"}
        </button>
      </div>
      {insightsProvider && insightsProvider !== "fallback" && classificationStatus !== "running" && (
        <span className="text-[10px] text-slate-600">Insights · {insightsProvider}</span>
      )}
    </div>
  );
}

function Sidebar({
  view, setView, dark, setDark, collapsed, setCollapsed, stats, user, onSignOut, onSync, syncing, aiStatus, onReclassify, reclassifying,
}: {
  view: View; setView: (v: View) => void;
  dark: boolean; setDark: (d: boolean) => void;
  collapsed: boolean; setCollapsed: (c: boolean) => void;
  stats: Stats; user: any; onSignOut: () => void; onSync: () => void; syncing: boolean;
  aiStatus: AIProcessingStatus; onReclassify: () => void; reclassifying: boolean;
}) {
  const badgeCount = (item: typeof navItems[0]) => {
    if (item.badgeKey === "unread") return stats.unread || 0;
    return 0;
  };

  return (
    <aside
      className={`relative flex flex-col h-screen bg-[#0F172A] transition-all duration-300 ease-in-out flex-shrink-0 ${collapsed ? "w-16" : "w-60"}`}
      style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-14 border-b border-white/5 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-semibold text-sm tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>InboxOS</span>
            <span className="block text-[10px] text-slate-500 leading-none">AI Command Center</span>
          </div>
        )}
      </div>

      {/* Sync button */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={onSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 text-[11px] font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Inbox"}
          </button>
        </div>
      )}

      {/* AI status badge */}
      {!collapsed && (
        <AIStatusBadge aiStatus={aiStatus} onReclassify={onReclassify} reclassifying={reclassifying} />
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          const badge = badgeCount(item);
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                active ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && badge > 0 && (
                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${active ? "bg-indigo-500/30 text-indigo-300" : "bg-slate-700 text-slate-400"}`}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {collapsed && badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/5 p-2 space-y-1">
        <button
          onClick={() => setDark(!dark)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
        >
          {dark ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? "justify-center" : ""}`}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} className="w-7 h-7 rounded-full flex-shrink-0" alt="avatar" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">
                {(user?.user_metadata?.name || user?.email || "U").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">{user?.user_metadata?.name || "User"}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={onSignOut} title="Sign out" className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-all z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}

// ─── DASHBOARD VIEW ───────────────────────────────────────────────────────────

function DashboardView({
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

  const mkSpark = (vals: number[]) => vals.map((v) => ({ v }));

  const kpiCards = [
    { label: "Unread Emails", value: String(stats.unread || 0), icon: Mail, color: "indigo", spark: mkSpark([0, stats.unread || 0]) },
    { label: "Needs Attention", value: String(stats.important || 0), icon: Star, color: "amber", spark: mkSpark([0, stats.important || 0]) },
    { label: "Action Items", value: String(insights.actionItems.length), icon: CheckSquare, color: "violet", spark: mkSpark([0, insights.actionItems.length]) },
    { label: "Waiting On", value: String(insights.waitingOn.length), icon: Clock, color: "sky", spark: mkSpark([0, insights.waitingOn.length]) },
    { label: "Bills Detected", value: String(insights.bills.length), icon: CreditCard, color: "red", spark: mkSpark([0, insights.bills.length]) },
    { label: "Follow Ups", value: String(insights.followUps.length), icon: Users, color: "emerald", spark: mkSpark([0, insights.followUps.length]) },
    { label: "Total in Inbox", value: String(stats.total || 0), icon: Inbox, color: "slate", spark: mkSpark([0, stats.total || 0]) },
    { label: "Security Alerts", value: String(insights.security.length), icon: AlertTriangle, color: "red", spark: mkSpark([0, insights.security.length]) },
    { label: "Calendar Events", value: String(insights.calendar.length), icon: Calendar, color: "sky", spark: mkSpark([0, insights.calendar.length]) },
    { label: "Purchases", value: String(insights.purchases.length), icon: Package, color: "violet", spark: mkSpark([0, insights.purchases.length]) },
    { label: "Newsletters", value: String(stats.byCategory?.["Newsletters"] || 0), icon: Globe, color: "slate", spark: mkSpark([0, stats.byCategory?.["Newsletters"] || 0]) },
    { label: "Work Emails", value: String(stats.byCategory?.["Work"] || 0), icon: Building, color: "indigo", spark: mkSpark([0, stats.byCategory?.["Work"] || 0]) },
  ];

  const topEmails = emails.slice(0, 5);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Hero */}
      <div className="flex flex-col lg:flex-row gap-5 mb-6">
        <div className="flex-1">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">{today}</p>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white leading-tight" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1.5 text-sm">
            {syncing ? "Syncing your inbox…" : `Here's everything that needs your attention today.`}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {stats.unread > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full font-medium">
                <Mail className="w-3 h-3" /> {stats.unread} unread
              </div>
            )}
            {insights.security.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full font-medium">
                <AlertTriangle className="w-3 h-3" /> {insights.security.length} security alert{insights.security.length !== 1 ? "s" : ""}
              </div>
            )}
            {insights.bills.filter((b: any) => b.status === "overdue" || b.status === "due_soon").length > 0 && (
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
            <span className="text-white font-semibold text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Ask AI anything</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2.5 mb-3 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => setView("ai")}>
            <MessageSquare className="w-4 h-4 text-white/60 flex-shrink-0" />
            <span className="text-white/50 text-sm">What should I work on first?</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["What needs replies?", "Summarize today", "Find invoices", "Show promises", "Security check"].map((p) => (
              <button key={p} onClick={() => setView("ai")} className="text-[11px] bg-white/10 hover:bg-white/20 text-white/80 hover:text-white px-2.5 py-1 rounded-lg transition-colors">
                {p}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        {kpiCards.map((card) => {
          const { bg, icon: iconCls, stroke } = colorMap[card.color] ?? colorMap.slate;
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-2.5">
                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${iconCls}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                {card.value}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2 leading-tight">{card.label}</p>
              <div className="h-7">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={card.spark}>
                    <defs>
                      <linearGradient id={`g-${card.label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={stroke} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={stroke} fill={`url(#g-${card.label})`} strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
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

// ─── INBOX VIEW ────────────────────────────────────────────────────────────────

function InboxView({
  emails, onArchive, onMarkRead, accessToken, userId, onRefresh,
}: {
  emails: GmailEmail[];
  onArchive: (id: string) => void;
  onMarkRead: (id: string) => void;
  accessToken: string;
  userId: string;
  onRefresh: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyDone, setReplyDone] = useState<string | null>(null);

  const categories = ["All", ...Array.from(new Set(emails.map((e) => e.category))).filter(Boolean)];
  const filtered = activeCategory === "All" ? emails : emails.filter((e) => e.category === activeCategory);

  const handleArchive = async (id: string) => {
    await archiveEmail(accessToken, id, userId);
    onArchive(id);
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead(accessToken, id, userId);
    onMarkRead(id);
  };

  const handleReply = async (email: GmailEmail) => {
    if (!replyText.trim()) return;
    setReplySending(true);
    await sendReply(
      accessToken,
      email.senderEmail,
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
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Email snippet</p>
                        <p className="text-sm text-gray-700 dark:text-slate-300">{email.snippet}</p>
                      </div>
                    </div>

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

// ─── AI ASSISTANT VIEW ────────────────────────────────────────────────────────

function AIAssistantView({ userId }: { userId: string }) {
  const [messages, setMessages] = useState([{
    role: "assistant" as const,
    text: "Hi! I'm your InboxOS AI. I have full context of your inbox — ask me anything about your emails, tasks, or what to prioritize.",
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
    const userMsg = { role: "user" as const, text };
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
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>InboxOS AI</h2>
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

// ─── INSIGHTS-POWERED VIEWS ───────────────────────────────────────────────────

function ActionCenterView({ insights }: { insights: Insights }) {
  const [done, setDone] = useState<number[]>([]);
  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Action Center" subtitle="AI-extracted tasks from your inbox" />
      {insights.actionItems.length === 0 ? (
        <EmptyInsights icon={CheckSquare} label="No action items detected yet. Sync your inbox to extract tasks." />
      ) : (
        <div className="space-y-2">
          {insights.actionItems.map((item: any, i: number) => (
            <Card key={i} className={`p-4 flex items-start gap-4 transition-opacity ${done.includes(i) ? "opacity-40" : ""}`}>
              <button onClick={() => setDone((d) => d.includes(i) ? d.filter(x => x !== i) : [...d, i])} className="mt-0.5 flex-shrink-0">
                {done.includes(i) ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-gray-300 dark:text-slate-600" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium text-gray-900 dark:text-white ${done.includes(i) ? "line-through" : ""}`}>{item.text}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">From: {item.from}{item.dueDate ? ` · Due: ${item.dueDate}` : ""}</p>
              </div>
              <PriorityBadge priority={item.priority || "Medium"} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WaitingOnView({ insights }: { insights: Insights }) {
  const cols = [
    { label: "Waiting On Others", items: insights.waitingOn, color: "border-amber-400" },
    { label: "Waiting On Me", items: [] as any[], color: "border-red-400" },
    { label: "Completed", items: [] as any[], color: "border-emerald-400" },
  ];
  return (
    <div className="p-6">
      <PageHeader title="Waiting On" subtitle="AI-detected threads awaiting responses" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cols.map((col) => (
          <div key={col.label}>
            <div className={`flex items-center gap-2 mb-3 pb-3 border-b-2 ${col.color}`}>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{col.label}</h3>
              <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">{col.items.length}</span>
            </div>
            <div className="space-y-3">
              {col.items.map((item: any, i: number) => (
                <Card key={i} className="p-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{item.person}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">{item.company} · {item.subject}</p>
                  {item.days > 0 && (
                    <p className={`text-[11px] font-semibold mb-2 ${item.days >= 4 ? "text-red-500" : "text-amber-500"}`}>{item.days}d waiting</p>
                  )}
                  {item.ai_tip && (
                    <div className="flex items-start gap-1.5 mb-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2">
                      <Sparkles className="w-3 h-3 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-300">{item.ai_tip}</p>
                    </div>
                  )}
                  <PriorityBadge priority={item.priority || "Medium"} />
                </Card>
              ))}
              {col.items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Check className="w-6 h-6 text-emerald-400 mb-2" />
                  <p className="text-xs text-gray-400 dark:text-slate-500">All clear</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowUpsView({ insights }: { insights: Insights }) {
  const statusStyle = (s: string) =>
    s === "overdue" ? "bg-red-50 dark:bg-red-950/30 border-l-2 border-red-400" :
    s === "due_today" ? "bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400" :
    "bg-gray-50 dark:bg-[#1E2235] border-l-2 border-gray-200 dark:border-slate-700";

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Follow-Up Center" subtitle="Promises and commitments detected by AI" />
      {insights.followUps.length === 0 ? (
        <EmptyInsights icon={Users} label="No follow-ups detected yet. Sync your inbox to find commitments." />
      ) : (
        <div className="space-y-3">
          {insights.followUps.map((p: any, i: number) => (
            <div key={i} className={`rounded-2xl p-5 ${statusStyle(p.status)}`}>
              <p className="text-sm font-semibold text-gray-900 dark:text-white italic mb-1">"{p.text}"</p>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-slate-400 mb-3">
                <span><Users className="w-3 h-3 inline mr-1" />{p.person}</span>
                {p.dueDate && <span><Calendar className="w-3 h-3 inline mr-1" />Due {p.dueDate}</span>}
                <span><Mail className="w-3 h-3 inline mr-1" />{p.email_subject}</span>
              </div>
              <div className="flex gap-2">
                <button className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
                  <Send className="w-3 h-3" /> Send Follow-Up
                </button>
                <button className="text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                  <Check className="w-3 h-3" /> Mark Complete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BillsView({ insights }: { insights: Insights }) {
  const spendingData = (Array.isArray(insights.bills) ? insights.bills : []).map((b: any, i: number) => ({
    name: (b.name || "").slice(0, 8),
    amount: Number(b.amount) || 0,
  }));

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <PageHeader title="Bills & Subscriptions" subtitle="Financial commitments detected from your inbox" />
      {insights.bills.length === 0 ? (
        <EmptyInsights icon={CreditCard} label="No bills detected yet. Sync your inbox to find financial emails." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Detected Bills</h3>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                {insights.bills.map((bill: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{bill.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{bill.category} · Due {bill.due}</p>
                    </div>
                    <span className={`text-sm font-bold ${bill.status === "overdue" ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                      ${Number(bill.amount || 0).toFixed(2)}
                    </span>
                    {bill.status === "overdue" ? (
                      <span className="text-[10px] font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full">Overdue</span>
                    ) : bill.status === "due_soon" ? (
                      <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full">Due Soon</span>
                    ) : (
                      <button className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">Pay</button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {spendingData.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Bill Amounts</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendingData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1E2235", border: "none", borderRadius: 12, fontSize: 12, color: "#E2E8F0" }} />
                    <Bar dataKey="amount" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function CalendarView({ insights }: { insights: Insights }) {
  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Calendar Intelligence" subtitle="Events detected from your inbox by AI" />
      {insights.calendar.length === 0 ? (
        <EmptyInsights icon={Calendar} label="No calendar events detected yet. Sync your inbox to find meetings and events." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
            {insights.calendar.map((ev: any, i: number) => (
              <div key={i} className="flex gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="w-20 flex-shrink-0 text-right">
                  <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{ev.time}</span>
                </div>
                <div className="w-1 rounded-full bg-indigo-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{ev.title}</p>
                    <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{ev.type}</span>
                  </div>
                  {ev.location && <p className="text-xs text-gray-400 dark:text-slate-500">{ev.location}</p>}
                  {ev.date && <p className="text-xs text-gray-400 dark:text-slate-500">{ev.date}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PurchasesView({ insights }: { insights: Insights }) {
  const statusColor = (s: string) => ({
    ordered: "text-indigo-600 dark:text-indigo-400",
    shipped: "text-amber-600 dark:text-amber-400",
    delivered: "text-emerald-600 dark:text-emerald-400",
    returned: "text-red-600 dark:text-red-400",
  }[s] || "text-gray-500");

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Purchases" subtitle="Orders and shipments detected from your inbox" />
      {insights.purchases.length === 0 ? (
        <EmptyInsights icon={Package} label="No purchases detected yet. Sync your inbox to find order and shipment emails." />
      ) : (
        <div className="space-y-3">
          {insights.purchases.map((p: any, i: number) => (
            <Card key={i} className="p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{p.item}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{p.from} · {p.date}</p>
              </div>
              {p.amount && <span className="text-sm font-bold text-gray-900 dark:text-white">${Number(p.amount).toFixed(2)}</span>}
              <span className={`text-xs font-semibold capitalize ${statusColor(p.status)}`}>{p.status}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SecurityView({ insights }: { insights: Insights }) {
  const sevColor = (s: string) =>
    s === "high" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30" :
    s === "medium" ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" :
    "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30";

  const securityArr = Array.isArray(insights.security) ? insights.security : [];
  const score = Math.max(20, 100 - (securityArr.filter((a: any) => a.severity === "high").length * 20) - (securityArr.filter((a: any) => a.severity === "medium").length * 10));

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <PageHeader
        title="Security Center"
        subtitle="AI-powered email threat detection"
        action={
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${score >= 80 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"}`}>
            <Shield className="w-4 h-4" /> Health Score: {score}/100
          </div>
        }
      />
      {securityArr.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Inbox looks clean</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">No security threats detected in your recent emails.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {securityArr.map((alert: any, i: number) => (
            <Card key={i} className="p-5 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sevColor(alert.severity)}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{alert.type}</h4>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${sevColor(alert.severity)}`}>{alert.severity}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">From: {alert.from}</p>
                <p className="text-xs text-gray-600 dark:text-slate-300">{alert.description}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchView({ accessToken, userId }: { accessToken: string; userId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GmailEmail[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { emails } = await searchEmails(accessToken, query);
      setResults(emails || []);
    } catch { setResults([]); }
    setSearching(false);
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Smart Search" subtitle="Search anything across your entire inbox" />
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
          <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search anything… invoices, names, topics, dates"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
          />
        </div>
        <button onClick={handleSearch} disabled={searching || !query.trim()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-2xl transition-colors disabled:opacity-50 shadow-sm">
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {["Invoices", "Receipts", "Flight confirmation", "From my boss", "Last month", "Contracts"].map((s) => (
          <button key={s} onClick={() => { setQuery(s); }} className="text-xs bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 px-3 py-1.5 rounded-full hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
            {s}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 text-xs text-gray-400 dark:text-slate-500">
            {results.length} results for "{query}"
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
            {results.map((email) => (
              <div key={email.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer">
                <Avatar initials={email.initials} bg={email.avatarBg} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{email.senderName}</span>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">{email.timeDisplay}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300 mb-0.5 truncate">{email.subject}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 line-clamp-1">{email.snippet}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function AnalyticsView({ emails, stats }: { emails: GmailEmail[]; stats: Stats }) {
  const categoryData = Object.entries(stats.byCategory || {}).map(([name, count]) => ({ name, count }));

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <PageHeader title="Analytics" subtitle="Your email productivity overview" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Emails", value: stats.total || 0, icon: Mail, color: "indigo" },
          { label: "Unread", value: stats.unread || 0, icon: Inbox, color: "amber" },
          { label: "Important", value: stats.important || 0, icon: Star, color: "violet" },
          { label: "Read Rate", value: `${stats.total ? Math.round(((stats.total - (stats.unread || 0)) / stats.total) * 100) : 0}%`, icon: TrendingUp, color: "emerald" },
        ].map((s) => {
          const { bg, icon: iconCls } = colorMap[s.color] ?? colorMap.slate;
          return (
            <Card key={s.label} className="p-4">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${iconCls}`} />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.value}</div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
            </Card>
          );
        })}
      </div>
      {categoryData.length > 0 && (
        <Card className="p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Emails by Category</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#1E2235", border: "none", borderRadius: 12, fontSize: 12, color: "#E2E8F0" }} />
                <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

function SettingsView({ user, onSignOut, lastSync, onRepairData }: { user: any; onSignOut: () => void; lastSync: string | null; onRepairData: () => Promise<void> }) {
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairResult(null);
    try {
      const r = await onRepairData();
      setRepairResult(`Repaired ${(r as any)?.repairedEmails ?? 0} emails and ${(r as any)?.repairedInsights ?? 0} insight records.`);
    } catch (e: any) {
      setRepairResult(`Repair failed: ${e?.message || "unknown error"}`);
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="p-6 max-w-[700px] mx-auto">
      <PageHeader title="Settings" subtitle="Account and integration settings" />
      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Account</h3>
          <div className="flex items-center gap-4 mb-4">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-12 h-12 rounded-full" alt="avatar" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <span className="text-lg font-bold text-white">{(user?.user_metadata?.name || user?.email || "U").charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.user_metadata?.name || "User"}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{user?.email}</p>
              {lastSync && <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Last sync: {new Date(lastSync).toLocaleString()}</p>}
            </div>
          </div>
          <button onClick={onSignOut} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>AI Features</h3>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 mb-3">
            <p className="font-semibold mb-1">Groq · Gemini · Fallback</p>
            <p>Classification uses <strong>Groq</strong> (llama-3.3-70b). Insights and chat use <strong>Gemini</strong> (gemini-2.5-flash). Configure <code className="bg-indigo-100 dark:bg-indigo-900 px-1 rounded">GROQ_API_KEY</code> and <code className="bg-indigo-100 dark:bg-indigo-900 px-1 rounded">GEMINI_API_KEY</code> in Make Settings → Secrets.</p>
          </div>
          <div className="border-t border-gray-100 dark:border-white/5 pt-3">
            <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">If AI data caused display issues, repair stored records:</p>
            <button
              onClick={handleRepair}
              disabled={repairing}
              className="flex items-center gap-2 text-sm font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${repairing ? "animate-spin" : ""}`} />
              {repairing ? "Repairing…" : "Repair AI data"}
            </button>
            {repairResult && <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">{repairResult}</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Gmail OAuth Setup</h3>
          <ol className="space-y-2 text-xs text-gray-600 dark:text-slate-400 list-decimal list-inside">
            <li>Go to <strong>console.cloud.google.com</strong> → create/select a project</li>
            <li>Enable the <strong>Gmail API</strong> — APIs & Services → Library → Gmail API → Enable</li>
            <li>Create OAuth 2.0 credentials → Web application type</li>
            <li>Add redirect URI: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded text-[10px]">https://kkveffyelwdenrlzymip.supabase.co/auth/v1/callback</code></li>
            <li>In <strong>Supabase → Auth → Providers → Google</strong>: toggle Enable, paste Client ID + Secret, click Save</li>
            <li><em>No extra scopes needed in Supabase</em> — Gmail access is requested automatically at sign-in</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

function AttachmentsView({ emails }: { emails: GmailEmail[] }) {
  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Attachment Vault" subtitle="Files detected across your inbox" />
      <EmptyInsights icon={Paperclip} label="Attachment scanning coming soon. This will show all PDFs, receipts, and documents from your emails." />
    </div>
  );
}

function AutomationsView() {
  const rules = [
    { name: "Newsletter Filter", trigger: "Newsletter or unsubscribe link detected", action: "Label as Newsletters", active: true },
    { name: "Bill Tracker", trigger: "Invoice or bill keyword in subject", action: "Add to Bills tracker", active: true },
    { name: "Shipment Monitor", trigger: "Tracking number detected", action: "Add to Purchases", active: true },
  ];
  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Automations" subtitle="Active rules running on your inbox" />
      <div className="space-y-3">
        {rules.map((r, i) => (
          <Card key={i} className="p-5 flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.active ? "bg-emerald-500" : "bg-gray-300"}`} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.name}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">If: {r.trigger}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Then: {r.action}</p>
            </div>
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${r.active ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" : "bg-gray-100 dark:bg-slate-800 text-gray-500"}`}>
              {r.active ? "Active" : "Paused"}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyInsights({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-gray-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs">{label}</p>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "The application encountered an unexpected error." };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("InboxOS render failure:", { message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">InboxOS could not display this data</h2>
            <p className="text-sm text-gray-500 mb-5">Some AI-generated data had an unexpected format.</p>
            <button
              onClick={() => { this.setState({ hasError: false, message: "" }); window.location.reload(); }}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Reload InboxOS
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppStartup />
    </AppErrorBoundary>
  );
}

// ── Process OAuth tokens that land on the root URL after a full-page redirect ─
function AppStartup() {
  const [authReady, setAuthReady] = React.useState(false);
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    let active = true;

    async function waitForSupabaseInitialization() {
      try {
        const url = new URL(window.location.href);

        console.log("InboxOS OAuth return:", {
          hasCode: url.searchParams.has("code"),
          pathname: url.pathname,
          searchKeys: Array.from(url.searchParams.keys()),
        });

        /*
         * Do not call exchangeCodeForSession here.
         *
         * The Supabase client has detectSessionInUrl: true and will
         * automatically process the PKCE code and persist the session.
         */

        let session = null;

        // Give Supabase's automatic URL detection time to complete.
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            throw error;
          }

          session = data.session;

          if (session) {
            break;
          }

          await new Promise((resolve) => window.setTimeout(resolve, 100));
        }

        console.log("InboxOS auth startup:", session ? "session found" : "no session");

        if (session?.provider_token) {
          localStorage.setItem("inboxos-google-provider-token", session.provider_token);
        }

        if (session?.provider_refresh_token) {
          localStorage.setItem("inboxos-google-provider-refresh-token", session.provider_refresh_token);
        }

        /*
         * Remove the OAuth code only after Supabase has initialized.
         * Never remove the code before automatic detection completes.
         */
        if (session && url.searchParams.has("code")) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (error) {
        console.error("InboxOS OAuth initialization failed:", error);

        if (active) {
          setAuthError(error instanceof Error ? error.message : "Authentication failed.");
        }
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    }

    void waitForSupabaseInitialization();

    return () => {
      active = false;
    };
  }, []);

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", color: "#334155", fontFamily: "system-ui" }}>
        Completing sign-in…
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#F8FAFC", fontFamily: "system-ui" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h2>Google sign-in failed</h2>
          <p>{authError}</p>
          <button onClick={async () => {
            await supabase.auth.signOut();
            localStorage.removeItem("inboxos-supabase-auth");
            localStorage.removeItem("inboxos-google-provider-token");
            localStorage.removeItem("inboxos-google-provider-refresh-token");
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.reload();
          }}>
            Reset and try again
          </button>
        </div>
      </div>
    );
  }

  return <MainApp />;
}

function MainApp() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, important: 0, needsReply: 0, byCategory: {} });
  const [insights, setInsights] = useState<Insights>(EMPTY_INSIGHTS);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIProcessingStatus>({
    classificationStatus: "idle",
    classificationProvider: null,
    insightsStatus: "idle",
    insightsProvider: null,
    classifiedCount: 0,
    fallbackCount: 0,
  });
  const [reclassifying, setReclassifying] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // ── Auth init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let activatingUserId = "";

    async function activateSession(session: any) {
      if (!mounted || !session?.user) return;
      if (activatingUserId === session.user.id) return;
      activatingUserId = session.user.id;

      try {
        const providerToken =
          session.provider_token ||
          localStorage.getItem("inboxos-google-provider-token") ||
          "";

        if (session.provider_token) {
          localStorage.setItem("inboxos-google-provider-token", session.provider_token);
        }

        if (session.provider_refresh_token) {
          localStorage.setItem("inboxos-google-provider-refresh-token", session.provider_refresh_token);
        }

        console.log("InboxOS provider token available:", Boolean(providerToken));

        setUser(session.user);
        setAccessToken(providerToken);

        await loadData(session.user.id, providerToken);
      } catch (error) {
        console.error("Failed to activate authenticated session:", error);
        if (mounted) setAppState("error");
      } finally {
        activatingUserId = "";
      }
    }

    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;
        if (!mounted) return;

        if (session) {
          await activateSession(session);
        } else {
          setAppState("unauthenticated");
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        if (mounted) setAppState("unauthenticated");
      }
    }

    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("InboxOS Supabase auth event:", event);

      if (!mounted) return;

      if (session) {
        void activateSession(session);
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setAccessToken("");
        setAppState("unauthenticated");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadData = async (userId: string, token: string) => {
    setAppState("syncing");
    try {
      // Load cached data first
      const cached = await getCachedEmails(userId);
      if (cached.emails?.length > 0) {
        setEmails(Array.isArray(cached.emails) ? cached.emails.map(normalizeEmail) : []);
        setStats(cached.stats || {});
        setLastSync(cached.lastSync);
        setAppState("ready");

        // Load insights
        const ins = await getInsights(userId);
        setInsights({
          actionItems: Array.isArray(ins?.actionItems) ? ins.actionItems : [],
          waitingOn: Array.isArray(ins?.waitingOn) ? ins.waitingOn : [],
          bills: Array.isArray(ins?.bills) ? ins.bills : [],
          followUps: Array.isArray(ins?.followUps) ? ins.followUps : [],
          calendar: Array.isArray(ins?.calendar) ? ins.calendar : [],
          security: Array.isArray(ins?.security) ? ins.security : [],
          purchases: Array.isArray(ins?.purchases) ? ins.purchases : [],
        });

        // Load brief
        loadBrief(userId);

        // Sync in background if cache is stale (>10 min)
        const staleMs = 10 * 60 * 1000;
        if (!cached.lastSync || (Date.now() - new Date(cached.lastSync).getTime() > staleMs)) {
          if (token) syncInbox(userId, token);
        }
      } else if (token) {
        // No cache, do a full sync
        await syncInbox(userId, token);
      } else {
        // No token — OAuth scopes may not have been granted
        setAppState("ready");
      }
    } catch (e) {
      console.error("Load error:", e);
      setAppState("ready");
    }
  };

  const syncInbox = async (userId: string, googleProviderToken: string) => {
    if (!googleProviderToken) {
      console.error("InboxOS Gmail sync blocked: provider token missing.");
      setAppState("error");
      return;
    }

    setSyncing(true);
    setAiStatus((s) => ({ ...s, classificationStatus: "running", insightsStatus: "running" }));

    try {
      const result = await syncGmail(googleProviderToken, userId);

      console.log("InboxOS Gmail sync response:", {
        success: result?.success,
        count: result?.count,
        classificationProvider: result?.classification?.provider,
        insightsReady: result?.insights?.ready,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Gmail synchronization did not succeed.");
      }

      // Update AI status from response
      if (result.classification) {
        setAiStatus((s) => ({
          ...s,
          classificationStatus: result.classification.status,
          classificationProvider: result.classification.provider,
          classifiedCount: result.classification.classifiedCount ?? 0,
          fallbackCount: result.classification.fallbackCount ?? 0,
        }));
      }
      if (result.insights) {
        setAiStatus((s) => ({
          ...s,
          insightsStatus: result.insights.status,
          insightsProvider: result.insights.provider,
        }));
      }

      const fresh = await getCachedEmails(userId);

      setEmails(Array.isArray(fresh.emails) ? fresh.emails.map(normalizeEmail) : []);
      setStats(fresh.stats || { total: 0, unread: 0, important: 0, needsReply: 0, byCategory: {} });
      setLastSync(fresh.lastSync || new Date().toISOString());

      const newInsights = await getInsights(userId);
      setInsights({
        actionItems: Array.isArray(newInsights?.actionItems) ? newInsights.actionItems : [],
        waitingOn: Array.isArray(newInsights?.waitingOn) ? newInsights.waitingOn : [],
        bills: Array.isArray(newInsights?.bills) ? newInsights.bills : [],
        followUps: Array.isArray(newInsights?.followUps) ? newInsights.followUps : [],
        calendar: Array.isArray(newInsights?.calendar) ? newInsights.calendar : [],
        security: Array.isArray(newInsights?.security) ? newInsights.security : [],
        purchases: Array.isArray(newInsights?.purchases) ? newInsights.purchases : [],
      });

      void loadBrief(userId);

      setAppState("ready");
    } catch (error: any) {
      console.error("InboxOS Gmail sync failed:", {
        message: error?.message,
        name: error?.name,
        status: error?.status,
        context: error?.context,
      });

      setAiStatus((s) => ({ ...s, classificationStatus: "failed", insightsStatus: "failed" }));
      setAppState("error");
    } finally {
      setSyncing(false);
    }
  };

  const handleReclassify = async () => {
    if (!user) return;
    setReclassifying(true);
    setAiStatus((s) => ({ ...s, classificationStatus: "running", insightsStatus: "running" }));
    try {
      const result = await reclassifyEmails();
      if (result?.classification) {
        setAiStatus((s) => ({
          ...s,
          classificationStatus: result.classification.status,
          classificationProvider: result.classification.provider,
          classifiedCount: result.classification.classifiedCount ?? 0,
          fallbackCount: result.classification.fallbackCount ?? 0,
        }));
      }
      if (result?.insights) {
        setAiStatus((s) => ({ ...s, insightsStatus: result.insights.status, insightsProvider: result.insights.provider }));
      }
      const fresh = await getCachedEmails(user.id);
      setEmails(Array.isArray(fresh.emails) ? fresh.emails.map(normalizeEmail) : []);
      setStats(fresh.stats || { total: 0, unread: 0, important: 0, needsReply: 0, byCategory: {} });
      const newInsights = await getInsights(user.id);
      setInsights({
        actionItems: Array.isArray(newInsights?.actionItems) ? newInsights.actionItems : [],
        waitingOn: Array.isArray(newInsights?.waitingOn) ? newInsights.waitingOn : [],
        bills: Array.isArray(newInsights?.bills) ? newInsights.bills : [],
        followUps: Array.isArray(newInsights?.followUps) ? newInsights.followUps : [],
        calendar: Array.isArray(newInsights?.calendar) ? newInsights.calendar : [],
        security: Array.isArray(newInsights?.security) ? newInsights.security : [],
        purchases: Array.isArray(newInsights?.purchases) ? newInsights.purchases : [],
      });
    } catch (e) {
      console.error("InboxOS reclassify failed:", e);
      setAiStatus((s) => ({ ...s, classificationStatus: "failed" }));
    } finally {
      setReclassifying(false);
    }
  };

  const loadBrief = async (userId: string) => {
    setBriefLoading(true);
    try {
      const result = await getDailyBrief(userId);
      const normalizedBrief = {
        summary: typeof result?.summary === "string" ? result.summary : "",
        highlights: Array.isArray(result?.highlights)
          ? result.highlights.filter((item: unknown): item is string => typeof item === "string")
          : [],
      };
      console.log("InboxOS brief shape:", {
        summaryIsString: typeof normalizedBrief.summary === "string",
        highlightsIsArray: Array.isArray(normalizedBrief.highlights),
        highlightCount: normalizedBrief.highlights.length,
        rawHighlightsType: typeof result?.highlights,
      });
      setBrief(normalizedBrief);
    } catch (error) {
      console.error("InboxOS brief load failed:", error);
      setBrief({ summary: "", highlights: [] });
    } finally {
      setBriefLoading(false);
    }
  };

  const handleSync = () => {
    if (user && accessToken) syncInbox(user.id, accessToken);
  };

  const handleSignOut = async () => {
    localStorage.removeItem("inboxos-google-provider-token");
    localStorage.removeItem("inboxos-google-provider-refresh-token");
    await signOut();
    setUser(null);
    setAccessToken("");
    setEmails([]);
    setStats({ total: 0, unread: 0, important: 0, needsReply: 0, byCategory: {} });
    setInsights(EMPTY_INSIGHTS);
    setBrief(null);
    setAppState("unauthenticated");
  };

  const handleArchive = (id: string) => {
    setEmails((e) => e.filter((x) => x.id !== id));
    setStats((s) => ({ ...s, total: s.total - 1 }));
  };

  const handleMarkRead = (id: string) => {
    setEmails((e) => e.map((x) => x.id === id ? { ...x, isRead: true, status: "Read" } : x));
    setStats((s) => ({ ...s, unread: Math.max(0, s.unread - 1) }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (appState === "loading") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0D0F1A] flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (appState === "unauthenticated") return <LoginScreen />;

  if (appState === "syncing" && emails.length === 0) {
    return <SyncingScreen email={user?.email || ""} />;
  }

  if (appState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Gmail could not be loaded</h2>
          <p className="text-sm text-gray-500 mb-5">
            Your Google account is connected, but InboxOS could not reach the Gmail synchronization service.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleSync}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Reconnect Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log("InboxOS render array shapes:", {
    emails: Array.isArray(emails),
    briefHighlights: Array.isArray(brief?.highlights),
    actionItems: Array.isArray(insights?.actionItems),
    waitingOn: Array.isArray(insights?.waitingOn),
    bills: Array.isArray(insights?.bills),
    followUps: Array.isArray(insights?.followUps),
    calendar: Array.isArray(insights?.calendar),
    security: Array.isArray(insights?.security),
    purchases: Array.isArray(insights?.purchases),
  });

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0D0F1A] relative" style={{ fontFamily: "'Inter',sans-serif" }}>
      <Sidebar
        view={view}
        setView={setView}
        dark={dark}
        setDark={setDark}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        stats={stats}
        user={user}
        onSignOut={handleSignOut}
        onSync={handleSync}
        syncing={syncing}
        aiStatus={aiStatus}
        onReclassify={handleReclassify}
        reclassifying={reclassifying}
      />
      <main className="flex-1 overflow-y-auto min-w-0">
        {view === "dashboard"   && <DashboardView emails={emails} stats={stats} insights={insights} brief={brief} briefLoading={briefLoading} setView={setView} user={user} syncing={syncing} />}
        {view === "inbox"       && <InboxView emails={emails} onArchive={handleArchive} onMarkRead={handleMarkRead} accessToken={accessToken} userId={user?.id || ""} onRefresh={handleSync} />}
        {view === "ai"          && <AIAssistantView userId={user?.id || ""} />}
        {view === "action"      && <ActionCenterView insights={insights} />}
        {view === "waiting"     && <WaitingOnView insights={insights} />}
        {view === "followup"    && <FollowUpsView insights={insights} />}
        {view === "bills"       && <BillsView insights={insights} />}
        {view === "calendar"    && <CalendarView insights={insights} />}
        {view === "purchases"   && <PurchasesView insights={insights} />}
        {view === "security"    && <SecurityView insights={insights} />}
        {view === "search"      && <SearchView accessToken={accessToken} userId={user?.id || ""} />}
        {view === "analytics"   && <AnalyticsView emails={emails} stats={stats} />}
        {view === "settings"    && <SettingsView user={user} onSignOut={handleSignOut} lastSync={lastSync} onRepairData={async () => { const r = await repairAIData(); const fresh = await getCachedEmails(user!.id); setEmails(Array.isArray(fresh.emails) ? fresh.emails.map(normalizeEmail) : []); const ins = await getInsights(user!.id); setInsights({ actionItems: Array.isArray(ins?.actionItems) ? ins.actionItems : [], waitingOn: Array.isArray(ins?.waitingOn) ? ins.waitingOn : [], bills: Array.isArray(ins?.bills) ? ins.bills : [], followUps: Array.isArray(ins?.followUps) ? ins.followUps : [], calendar: Array.isArray(ins?.calendar) ? ins.calendar : [], security: Array.isArray(ins?.security) ? ins.security : [], purchases: Array.isArray(ins?.purchases) ? ins.purchases : [] }); void loadBrief(user!.id); return r; }} />}
        {view === "attachments" && <AttachmentsView emails={emails} />}
        {view === "automations" && <AutomationsView />}
      </main>
    </div>
  );
}
