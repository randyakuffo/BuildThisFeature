import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { GmailEmail } from "../types";
import { Card, PageHeader } from "../components/primitives";

export function AutomationsView({ emails }: { emails?: GmailEmail[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const emailArr = emails || [];

  const rules = [
    { name: "Newsletter Filter", trigger: "Newsletter or unsubscribe link detected", action: "Label as Newsletters", active: true },
    { name: "Bill Tracker", trigger: "Invoice or bill keyword in subject", action: "Add to Bills tracker", active: true },
    { name: "Shipment Monitor", trigger: "Tracking number detected", action: "Add to Purchases", active: true },
  ];

  const newsletterCount = emailArr.filter(e => e.category === "Newsletter").length;
  const workCount = emailArr.filter(e => e.category === "Work").length;
  const financeCount = emailArr.filter(e => e.category === "Finance").length;
  const unreadImportant = emailArr.filter(e => !e.isRead && e.isImportant).length;

  const suggestions = [
    newsletterCount >= 5
      ? { id: "newsletters", text: `You have ${newsletterCount} newsletters. Auto-archive newsletters to reduce noise?`, action: "Enable Auto-Archive" }
      : null,
    financeCount >= 3
      ? { id: "finance", text: `${financeCount} finance emails detected this sync. Auto-tag as Finance?`, action: "Enable Auto-Tag" }
      : null,
    unreadImportant >= 5
      ? { id: "morning", text: `You have ${unreadImportant} unread important emails. Get a morning digest summary?`, action: "Enable Digest" }
      : null,
    workCount >= 10
      ? { id: "work", text: `${workCount} work emails found. Auto-prioritize work emails during business hours?`, action: "Enable Priority Hours" }
      : null,
  ].filter(Boolean).filter(s => !dismissed.has(s!.id)) as Array<{ id: string; text: string; action: string }>;

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Automations" subtitle="Active rules and AI-suggested automations for your inbox" />

      {suggestions.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">AI Suggestions</p>
          <div className="space-y-3">
            {suggestions.map(s => (
              <div key={s.id} className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 dark:text-slate-300 flex-1">{s.text}</p>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="text-[10px] font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors">
                    {s.action}
                  </button>
                  <button
                    onClick={() => setDismissed(d => new Set([...d, s.id]))}
                    className="text-[10px] text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 px-2 py-1 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Active Rules</p>
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

