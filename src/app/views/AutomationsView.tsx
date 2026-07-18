import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import type { GmailEmail } from "../types";
import { archiveEmail, supabase } from "../../lib/supabase";
import { Card, PageHeader } from "../components/primitives";
import {
  dismissSuggestion,
  enableSuggestionRule,
  loadAutomationRules,
  loadDismissedSuggestions,
  toggleRule,
  type AutomationRule,
} from "../../lib/automations";

export function AutomationsView({
  emails,
  userId,
  onArchive,
}: {
  emails?: GmailEmail[];
  userId: string;
  onArchive: (id: string) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState(userId);
  const emailArr = emails || [];

  useEffect(() => {
    if (userId) {
      setResolvedUserId(userId);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const id = data.session?.user?.id;
      if (id) setResolvedUserId(id);
    });

    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!resolvedUserId) return;
    setRules(loadAutomationRules(resolvedUserId));
    setDismissed(new Set(loadDismissedSuggestions(resolvedUserId)));
  }, [resolvedUserId]);

  const newsletterCount = emailArr.filter((e) => e.category === "Newsletter").length;
  const workCount = emailArr.filter((e) => e.category === "Work").length;
  const financeCount = emailArr.filter((e) => e.category === "Finance").length;
  const unreadImportant = emailArr.filter((e) => !e.isRead && e.isImportant).length;

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
  ].filter(Boolean).filter((s) => !dismissed.has(s!.id)) as Array<{ id: string; text: string; action: string }>;

  const handleEnableSuggestion = async (suggestion: { id: string; action: string }) => {
    if (!resolvedUserId) {
      setMessage("Sign in to enable automations.");
      return;
    }

    const next = enableSuggestionRule(resolvedUserId, suggestion.id, suggestion.action, suggestion.action);
    setRules(next);
    setDismissed(new Set(loadDismissedSuggestions(resolvedUserId)));
    setMessage(`Enabled: ${suggestion.action}`);

    if (suggestion.id === "newsletters") {
      setRunning(true);
      const newsletters = emailArr.filter((e) => e.category === "Newsletter");
      let archived = 0;
      for (const email of newsletters.slice(0, 20)) {
        try {
          await archiveEmail(email.id, userId);
          onArchive(email.id);
          archived += 1;
        } catch {
          // continue with remaining
        }
      }
      setMessage(
        archived > 0
          ? `Auto-archive enabled and archived ${archived} newsletter email${archived === 1 ? "" : "s"}.`
          : "Auto-archive enabled. No newsletters were archived this run.",
      );
      setRunning(false);
    }
  };

  const handleToggleRule = (ruleId: string) => {
    if (!resolvedUserId) {
      setMessage("Sign in to manage automations.");
      return;
    }

    const next = toggleRule(resolvedUserId, ruleId);
    setRules(next);
    const rule = next.find((r) => r.id === ruleId);
    setMessage(rule ? `${rule.name} is now ${rule.active ? "active" : "paused"}.` : "");
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    if (!resolvedUserId) return;
    const next = dismissSuggestion(resolvedUserId, suggestionId);
    setDismissed(new Set(next));
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Automations" subtitle="Active rules and AI-suggested automations for your inbox" />

      {message && (
        <div className="mb-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">AI Suggestions</p>
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700 dark:text-slate-300 flex-1">{s.text}</p>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEnableSuggestion(s)}
                    disabled={running}
                    className="text-[10px] font-semibold bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {running && s.id === "newsletters" ? "Running…" : s.action}
                  </button>
                  <button
                    onClick={() => handleDismissSuggestion(s.id)}
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
        {rules.map((r) => (
          <Card key={r.id} className="p-5 flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.active ? "bg-emerald-500" : "bg-gray-300"}`} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.name}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">If: {r.trigger}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Then: {r.action}</p>
            </div>
            <button
              onClick={() => handleToggleRule(r.id)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                r.active
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              {r.active ? "Active" : "Paused"}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
