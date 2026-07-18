import { useState } from "react";
import { CheckSquare, CheckCircle2, Circle } from "lucide-react";
import type { Insights, ActionItem } from "../types";
import { Card, PageHeader, PriorityBadge, EmptyInsights } from "../components/primitives";

function asActionItems(items: unknown): ActionItem[] {
  return Array.isArray(items) ? (items as ActionItem[]) : [];
}

export function ActionCenterView({ insights }: { insights: Insights }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [snoozed, setSnoozed] = useState<Set<number>>(new Set());
  const actionItems = asActionItems(insights.actionItems);

  const today = new Date().toISOString().split("T")[0];
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const withIdx = actionItems.map((item, i) => ({ item, i })).filter(({ i }) => !snoozed.has(i));

  const urgent = withIdx.filter(({ item }) => item.priority === "High" || (item.dueDate && item.dueDate < today));
  const todayItems = withIdx.filter(({ item, i }) => !urgent.find(u => u.i === i) && item.dueDate === today);
  const thisWeek = withIdx.filter(({ item, i }) =>
    !urgent.find(u => u.i === i) && !todayItems.find(t => t.i === i) && item.dueDate && item.dueDate <= weekEnd
  );
  const later = withIdx.filter(({ item, i }) =>
    !urgent.find(u => u.i === i) && !todayItems.find(t => t.i === i) && !thisWeek.find(w => w.i === i)
  );

  const renderGroup = (label: string, color: string, dot: string, items: typeof withIdx) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <h3 className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</h3>
          <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500 px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <div className="space-y-2">
          {items.map(({ item, i }) => (
            <Card key={i} className={`p-4 flex items-start gap-4 transition-all ${done.has(i) ? "opacity-40" : ""}`}>
              <button onClick={() => setDone((d) => { const n = new Set(d); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="mt-0.5 flex-shrink-0">
                {done.has(i) ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-gray-300 dark:text-slate-600" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium text-gray-900 dark:text-white ${done.has(i) ? "line-through" : ""}`}>{item.text}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {item.from && <span className="text-[11px] text-gray-400 dark:text-slate-500">From: {item.from}</span>}
                  {item.dueDate && <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Due: {item.dueDate}</span>}
                  {item.emailId && <span className="text-[11px] text-indigo-500 dark:text-indigo-400">#{item.emailId?.slice(-4)}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <PriorityBadge priority={item.priority || "Medium"} />
                {!done.has(i) && (
                  <button
                    onClick={() => setSnoozed((s) => { const n = new Set(s); n.add(i); return n; })}
                    className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  >
                    Snooze
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader
        title="Action Center"
        subtitle="AI-extracted tasks from your inbox"
        action={
          done.size > 0 ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl">
              {done.size} completed
            </span>
          ) : undefined
        }
      />
      {actionItems.length === 0 ? (
        <EmptyInsights icon={CheckSquare} label="No action items detected yet. Sync your inbox to extract tasks automatically." />
      ) : (
        <>
          {renderGroup("Urgent", "text-red-600 dark:text-red-400", "bg-red-500", urgent)}
          {renderGroup("Today", "text-amber-600 dark:text-amber-400", "bg-amber-500", todayItems)}
          {renderGroup("This Week", "text-sky-600 dark:text-sky-400", "bg-sky-500", thisWeek)}
          {renderGroup("Later", "text-gray-500 dark:text-slate-500", "bg-gray-400", later)}
          {snoozed.size > 0 && (
            <button
              onClick={() => setSnoozed(new Set())}
              className="text-xs text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Show {snoozed.size} snoozed items
            </button>
          )}
        </>
      )}
    </div>
  );
}

