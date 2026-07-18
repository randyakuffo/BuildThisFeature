import React from "react";
import type { AIProcessingStatus } from "../types";

export function Card({
  children,
  className = "",
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={`bg-white dark:bg-[#161928] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
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

export function Avatar({ initials, bg, size = "md" }: { initials: string; bg: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : size === "lg" ? "w-11 h-11 text-sm" : "w-9 h-9 text-xs";
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`} style={{ background: bg }}>
      {initials}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const c: Record<string, string> = {
    High: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
    Medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    Low: "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c[priority] ?? c.Low}`}>{priority}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const c: Record<string, string> = {
    "Needs Reply": "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400",
    "Action Required": "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
    Info: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
    Reminder: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    Review: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
    Read: "bg-gray-50 text-gray-500 dark:bg-slate-800 dark:text-slate-400",
  };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c[status] ?? "bg-gray-50 text-gray-600"}`}>{status}</span>;
}

export function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-indigo-500 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function EmptyInsights({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-gray-400 dark:text-slate-500" />
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs">{label}</p>
    </div>
  );
}

export function AIStatusBadge({
  aiStatus,
  onReclassify,
  reclassifying,
}: {
  aiStatus: AIProcessingStatus;
  onReclassify: () => void;
  reclassifying: boolean;
}) {
  const { classificationStatus, classificationProvider, insightsProvider } = aiStatus;

  let label = "";
  let color = "text-slate-500";

  if (classificationStatus === "idle") return null;
  if (classificationStatus === "running") {
    label = "AI processing…";
    color = "text-indigo-400";
  } else if (classificationStatus === "completed" && classificationProvider === "groq") {
    label = "AI sorted · Groq";
    color = "text-emerald-400";
  } else if (classificationStatus === "completed" && classificationProvider === "gemini") {
    label = "AI sorted · Gemini";
    color = "text-blue-400";
  } else if (classificationStatus === "partial") {
    label = "AI partial sort";
    color = "text-amber-400";
  } else if (classificationStatus === "failed" || classificationStatus === "fallback") {
    label = "AI unavailable · basic sort";
    color = "text-slate-500";
  }

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
