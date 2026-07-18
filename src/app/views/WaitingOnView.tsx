import { Clock, Sparkles } from "lucide-react";
import type { Insights } from "../types";
import { Card, PageHeader, PriorityBadge, EmptyInsights } from "../components/primitives";

export function WaitingOnView({ insights }: { insights: Insights }) {
  const waitingItems = Array.isArray(insights.waitingOn) ? insights.waitingOn : [];
  const stale = waitingItems.filter((w: any) => (w.days || 0) > 5);
  const normal = waitingItems.filter((w: any) => (w.days || 0) <= 5);

  const staleColor = (days: number) =>
    days > 7 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400";

  const renderItem = (item: any, i: number) => (
    <Card key={i} className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.person}</p>
          {item.subject && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-1">{item.subject}</p>}
        </div>
        {(item.days || 0) > 0 && (
          <span className={`text-xs font-bold flex-shrink-0 ml-2 ${staleColor(item.days || 0)}`}>
            {item.days}d
          </span>
        )}
      </div>
      {(item.aiTip || item.ai_tip) && (
        <div className="flex items-start gap-1.5 mb-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2">
          <Sparkles className="w-3 h-3 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-indigo-700 dark:text-indigo-300">{item.aiTip || item.ai_tip}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <PriorityBadge priority={item.priority || "Medium"} />
        {(item.days || 0) > 3 && (
          <button className="text-[10px] font-medium bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors">
            Follow Up
          </button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <PageHeader title="Waiting On" subtitle="Threads where you're waiting for someone else to respond" />
      {waitingItems.length === 0 ? (
        <EmptyInsights icon={Clock} label="No pending threads detected. Sync your inbox to track conversations waiting for replies." />
      ) : (
        <div className="space-y-6">
          {stale.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Stale — No Reply Over 5 Days</h3>
                <span className="text-[10px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">{stale.length}</span>
              </div>
              <div className="space-y-3">{stale.map(renderItem)}</div>
            </div>
          )}
          {normal.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Waiting On Others</h3>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">{normal.length}</span>
              </div>
              <div className="space-y-3">{normal.map(renderItem)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

