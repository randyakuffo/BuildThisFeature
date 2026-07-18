import type { GmailEmail, Insights } from "../types";
import type { Stats } from "../types";

export const EMPTY_INSIGHTS: Insights = {
  actionItems: [],
  waitingOn: [],
  bills: [],
  followUps: [],
  calendar: [],
  security: [],
  purchases: [],
};

export const colorMap: Record<string, { bg: string; icon: string; stroke: string }> = {
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/40", icon: "text-indigo-600 dark:text-indigo-400", stroke: "#6366F1" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/40", icon: "text-amber-600 dark:text-amber-400", stroke: "#F59E0B" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/40", icon: "text-violet-600 dark:text-violet-400", stroke: "#7C3AED" },
  sky: { bg: "bg-sky-50 dark:bg-sky-950/40", icon: "text-sky-600 dark:text-sky-400", stroke: "#0EA5E9" },
  red: { bg: "bg-red-50 dark:bg-red-950/40", icon: "text-red-600 dark:text-red-400", stroke: "#EF4444" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: "text-emerald-600 dark:text-emerald-400", stroke: "#10B981" },
  slate: { bg: "bg-slate-100 dark:bg-slate-800/40", icon: "text-slate-600 dark:text-slate-400", stroke: "#64748B" },
};

export function computeWorkHealthScore(
  emails: GmailEmail[],
  insights: Insights,
  _stats: Stats,
): { score: number; label: string; color: string; ringColor: string; bgColor: string } {
  let score = 100;
  const secArr = (Array.isArray(insights.security) ? insights.security : []) as { severity?: string }[];
  const billArr = (Array.isArray(insights.bills) ? insights.bills : []) as { status?: string }[];
  const fupArr = (Array.isArray(insights.followUps) ? insights.followUps : []) as { status?: string }[];
  const waitArr = (Array.isArray(insights.waitingOn) ? insights.waitingOn : []) as { days?: number }[];
  const actArr = (Array.isArray(insights.actionItems) ? insights.actionItems : []) as { priority?: string }[];

  score -= emails.filter((e) => !e.isRead && e.isImportant).length * 3;
  score -= secArr.filter((a: { severity?: string }) => a.severity === "high").length * 15;
  score -= secArr.filter((a: { severity?: string }) => a.severity === "medium").length * 5;
  score -= billArr.filter((b: { status?: string }) => b.status === "overdue").length * 10;
  score -= billArr.filter((b: { status?: string }) => b.status === "due_soon").length * 4;
  score -= fupArr.filter((f: { status?: string }) => f.status === "overdue").length * 7;
  score -= waitArr.filter((w: { days?: number }) => (w.days || 0) > 5).length * 3;
  score -= actArr.filter((a: { priority?: string }) => a.priority === "High").length * 2;
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 85) return { score, label: "Excellent", color: "text-emerald-600 dark:text-emerald-400", ringColor: "#10B981", bgColor: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (score >= 70) return { score, label: "Good", color: "text-sky-600 dark:text-sky-400", ringColor: "#0EA5E9", bgColor: "bg-sky-50 dark:bg-sky-950/30" };
  if (score >= 50) return { score, label: "Needs Attention", color: "text-amber-600 dark:text-amber-400", ringColor: "#F59E0B", bgColor: "bg-amber-50 dark:bg-amber-950/30" };
  return { score, label: "Critical", color: "text-red-600 dark:text-red-400", ringColor: "#EF4444", bgColor: "bg-red-50 dark:bg-red-950/30" };
}

export function getTodaysFocus(emails: GmailEmail[], insights: Insights) {
  type Scored = { text: string; priority: "high" | "medium" | "low"; type: string; score: number };
  type SecurityItem = { severity?: string; type?: string; from?: string };
  type BillItem = { status?: string; name?: string; amount?: number; due?: string };
  type FollowUpItem = { status?: string; person?: string; text?: string };
  type ActionInsight = { priority?: string; text?: string };
  type WaitingItem = { days?: number; person?: string };
  type CalendarItem = { title?: string; time?: string };

  const items: Scored[] = [];

  const security = (Array.isArray(insights.security) ? insights.security : []) as SecurityItem[];
  security.filter((a) => a.severity === "high").forEach((a) => {
    items.push({ text: `Security alert: ${a.type} from ${a.from}`, priority: "high", type: "security", score: 100 });
  });

  const bills = (Array.isArray(insights.bills) ? insights.bills : []) as BillItem[];
  bills.filter((b) => b.status === "overdue").forEach((b) => {
    items.push({ text: `Overdue: ${b.name}${b.amount ? ` — $${Number(b.amount).toFixed(0)}` : ""}`, priority: "high", type: "bill", score: 95 });
  });

  const followUps = (Array.isArray(insights.followUps) ? insights.followUps : []) as FollowUpItem[];
  followUps.filter((f) => f.status === "overdue").slice(0, 2).forEach((f) => {
    items.push({ text: `Overdue promise to ${f.person}: "${f.text}"`, priority: "high", type: "followup", score: 90 });
  });

  const actionItems = (Array.isArray(insights.actionItems) ? insights.actionItems : []) as ActionInsight[];
  actionItems.filter((a) => a.priority === "High").slice(0, 2).forEach((a) => {
    items.push({ text: a.text || "", priority: "high", type: "action", score: 85 });
  });

  emails.filter((e) => e.priority === "High" && e.requiresReply && !e.isRead).slice(0, 2).forEach((e) => {
    items.push({ text: `Reply needed: "${e.subject}" from ${e.senderName}`, priority: "high", type: "reply", score: 80 });
  });

  bills.filter((b) => b.status === "due_soon").slice(0, 1).forEach((b) => {
    items.push({ text: `Bill due soon: ${b.name}${b.due ? ` on ${b.due}` : ""}`, priority: "medium", type: "bill", score: 72 });
  });

  const waitingOn = (Array.isArray(insights.waitingOn) ? insights.waitingOn : []) as WaitingItem[];
  waitingOn.filter((w) => (w.days || 0) > 5).slice(0, 1).forEach((w) => {
    items.push({ text: `${w.person} hasn't replied in ${w.days} days`, priority: "medium", type: "waiting", score: 65 });
  });

  const calendar = (Array.isArray(insights.calendar) ? insights.calendar : []) as CalendarItem[];
  calendar.slice(0, 1).forEach((c) => {
    items.push({ text: `Meeting: ${c.title}${c.time ? ` at ${c.time}` : ""}`, priority: "low", type: "calendar", score: 60 });
  });
  return items.sort((a, b) => b.score - a.score).slice(0, 5).map(({ score: _s, ...rest }) => rest);
}

export function getEstimatedReplyTime(email: GmailEmail): string {
  if (!email.requiresReply) return "";
  const len = (email.snippet || "").length + (email.actionItems || []).length * 50;
  if (len > 500) return "~5 min";
  if (len > 200) return "~2 min";
  return "~30 sec";
}

export function getSuggestedAction(email: GmailEmail): string {
  if (email.status === "Needs Reply") return "Reply";
  if (email.status === "Action Required") return "Act";
  if (email.status === "Waiting") return "Wait";
  if (email.status === "No Action" || email.category === "Newsletter") return "Archive";
  if (email.priority === "Low") return "Archive";
  return "Review";
}
