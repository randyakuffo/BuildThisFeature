import { Calendar, Clock, Globe, Sparkles, Mail } from "lucide-react";
import type { Insights } from "../types";
import { Card, PageHeader, EmptyInsights } from "../components/primitives";

export function CalendarView({ insights }: { insights: Insights }) {
  const calendarItems = Array.isArray(insights.calendar) ? insights.calendar : [];
  const typeColor = (type: string) => {
    if (type === "meeting") return "bg-indigo-500";
    if (type === "deadline") return "bg-red-500";
    if (type === "travel") return "bg-amber-500";
    return "bg-sky-500";
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <PageHeader title="Calendar Intelligence" subtitle="Events and meetings detected from your inbox by AI" />
      {calendarItems.length === 0 ? (
        <EmptyInsights icon={Calendar} label="No calendar events detected yet. Sync your inbox to find meetings, deadlines, and travel." />
      ) : (
        <div className="space-y-3">
          {calendarItems.map((ev: any, i: number) => (
            <Card key={i} className="p-5">
              <div className="flex items-start gap-4">
                <div className={`w-1 self-stretch rounded-full ${typeColor(ev.type)} flex-shrink-0`} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{ev.title}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-slate-500 mt-1">
                        {ev.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ev.date}</span>}
                        {ev.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ev.time}</span>}
                        {ev.location && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{ev.location}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full capitalize flex-shrink-0">{ev.type}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Prepare for this meeting
                    </button>
                    <button className="text-[10px] font-medium bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Related emails
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

