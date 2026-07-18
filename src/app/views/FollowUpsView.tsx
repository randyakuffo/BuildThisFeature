import { useState } from "react";
import { Users, Calendar, Mail, Send, Check, CheckCircle2, Circle } from "lucide-react";
import type { Insights } from "../types";
import { Card, PageHeader, EmptyInsights } from "../components/primitives";

export function FollowUpsView({ insights }: { insights: Insights }) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const followUps = Array.isArray(insights.followUps) ? insights.followUps : [];
  const overdue = followUps.filter((f: any) => f.status === "overdue");
  const dueToday = followUps.filter((f: any) => f.status === "due_today");
  const upcoming = followUps.filter((f: any) => f.status !== "overdue" && f.status !== "due_today");

  const renderFollowUp = (p: any, i: number, globalIdx: number) => (
    <Card key={i} className={`p-5 transition-opacity ${completed.has(globalIdx) ? "opacity-40" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => setCompleted(s => { const n = new Set(s); n.has(globalIdx) ? n.delete(globalIdx) : n.add(globalIdx); return n; })}
          className="flex-shrink-0 mt-0.5"
        >
          {completed.has(globalIdx)
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            : <Circle className="w-5 h-5 text-gray-300 dark:text-slate-600" />}
        </button>
        <div className="flex-1">
          <p className={`text-sm font-semibold text-gray-900 dark:text-white italic mb-1 ${completed.has(globalIdx) ? "line-through" : ""}`}>
            "{p.text}"
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-slate-400 mb-3">
            {p.person && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.person}</span>}
            {p.dueDate && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"><Calendar className="w-3 h-3" />Due {p.dueDate}</span>}
            {(p.email_subject || p.emailId) && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email_subject || `Email #${p.emailId?.slice(-4)}`}</span>}
          </div>
          {!completed.has(globalIdx) && (
            <div className="flex gap-2">
              <button className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
                <Send className="w-3 h-3" /> Generate Follow-Up
              </button>
              <button
                onClick={() => setCompleted(s => { const n = new Set(s); n.add(globalIdx); return n; })}
                className="text-xs bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3 h-3" /> Mark Complete
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  const renderGroup = (label: string, color: string, items: any[], offset: number) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</h3>
          <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <div className="space-y-3">{items.map((p, i) => renderFollowUp(p, i, offset + i))}</div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Follow-Up Center" subtitle="Promises and commitments detected by AI" />
      {followUps.length === 0 ? (
        <EmptyInsights icon={Users} label="No follow-ups detected yet. AI detects phrases like 'I'll send', 'I'll review', and 'I'll get back to you'." />
      ) : (
        <>
          {renderGroup("Overdue", "text-red-600 dark:text-red-400", overdue, 0)}
          {renderGroup("Due Today", "text-amber-600 dark:text-amber-400", dueToday, overdue.length)}
          {renderGroup("Upcoming", "text-sky-600 dark:text-sky-400", upcoming, overdue.length + dueToday.length)}
        </>
      )}
    </div>
  );
}

