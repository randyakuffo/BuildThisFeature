import type { GmailEmail, Insights } from "./normalize";

type HeuristicClassification = Pick<
  GmailEmail,
  "category" | "priority" | "status" | "requiresReply" | "actionItems" | "dueDate" | "aiSummary"
>;

const RULES = {
  newsletter: [
    /unsubscribe/i,
    /newsletter/i,
    /weekly digest/i,
    /no-?reply@/i,
    /promotions?@/i,
    /marketing@/i,
  ],
  finance: [
    /\binvoice\b/i,
    /\bbill(ing)?\b/i,
    /payment due/i,
    /amount due/i,
    /subscription renew/i,
    /your receipt/i,
    /statement (is )?ready/i,
    /billing@/i,
    /stripe\.com/i,
    /paypal/i,
  ],
  purchases: [
    /order confirm/i,
    /your order/i,
    /shipped/i,
    /out for delivery/i,
    /tracking (number|#)/i,
    /package (has|was) delivered/i,
    /delivery update/i,
  ],
  travel: [
    /\bflight\b/i,
    /itinerary/i,
    /boarding pass/i,
    /hotel reservation/i,
    /check-?in reminder/i,
    /car rental/i,
  ],
  security: [
    /verify your (account|email|identity)/i,
    /suspicious (activity|sign-?in|login)/i,
    /password reset/i,
    /security alert/i,
    /unusual (sign-?in|activity)/i,
    /two-?factor/i,
    /confirm it was you/i,
  ],
  calendar: [
    /meeting invite/i,
    /calendar invitation/i,
    /invited you to/i,
    /zoom meeting/i,
    /google meet/i,
    /teams meeting/i,
    /event: /i,
    /accepted:/i,
    /declined:/i,
  ],
  needsReply: [
    /\?/,
    /please reply/i,
    /let me know/i,
    /waiting for your (response|reply|feedback)/i,
    /could you (confirm|review|send)/i,
    /when can you/i,
    /your thoughts/i,
  ],
  actionRequired: [
    /action required/i,
    /complete by/i,
    /due by/i,
    /sign (the )?document/i,
    /review and approve/i,
    /please (complete|submit|fill)/i,
    /deadline/i,
  ],
  waiting: [
    /any update/i,
    /following up/i,
    /just checking in/i,
    /pending (your )?approval/i,
    /we('ll| will) get back to you/i,
    /awaiting (your )?response/i,
  ],
  followUp: [
    /i('ll| will) (send|get back|follow up|review)/i,
    /i('ll| will) let you know/i,
    /promised to/i,
    /by (monday|tuesday|wednesday|thursday|friday|tomorrow|end of (day|week))/i,
  ],
  urgent: [/urgent/i, /asap/i, /immediate(ly)?/i, /time sensitive/i],
} as const;

function emailText(email: GmailEmail): string {
  return [
    email.senderName,
    email.senderEmail,
    email.subject,
    email.snippet,
    email.aiSummary,
    ...(email.labels || []),
  ]
    .filter(Boolean)
    .join(" ");
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function extractAmount(text: string): number | null {
  const match = text.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function daysSince(isoDate: string): number {
  if (!isoDate) return 0;
  const received = new Date(isoDate);
  if (Number.isNaN(received.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - received.getTime()) / 86_400_000));
}

function hasStrongAiClassification(email: GmailEmail): boolean {
  return email.aiConfidence >= 0.6 && email.status !== "Information";
}

export function classifyWithHeuristics(email: GmailEmail): HeuristicClassification {
  const text = emailText(email);
  const gmailPromotions = (email.labels || []).includes("CATEGORY_PROMOTIONS");
  const gmailPersonal = (email.labels || []).includes("CATEGORY_PERSONAL");
  const gmailUpdates = (email.labels || []).includes("CATEGORY_UPDATES");

  let category = email.category;
  if (matchesAny(text, RULES.newsletter) || gmailPromotions) category = "Newsletter";
  else if (matchesAny(text, RULES.security)) category = "Security";
  else if (matchesAny(text, RULES.finance)) category = "Finance";
  else if (matchesAny(text, RULES.purchases)) category = "Purchases";
  else if (matchesAny(text, RULES.travel)) category = "Travel";
  else if (matchesAny(text, RULES.calendar)) category = "Calendar";
  else if (gmailPersonal) category = "Personal";
  else if (gmailUpdates && category === "Work") category = "Other";

  let status = email.status;
  if (matchesAny(text, RULES.needsReply) && !email.isRead) status = "Needs Reply";
  else if (matchesAny(text, RULES.actionRequired)) status = "Action Required";
  else if (matchesAny(text, RULES.waiting)) status = "Waiting";
  else if (category === "Newsletter") status = "No Action";
  else if (matchesAny(text, RULES.finance) && !matchesAny(text, [/payment due/i, /amount due/i, /overdue/i])) {
    status = "Information";
  }

  let priority = email.priority;
  if (email.isImportant || matchesAny(text, RULES.urgent) || category === "Security") priority = "High";
  else if (category === "Newsletter") priority = "Low";
  else if (status === "Needs Reply" || status === "Action Required") priority = "High";

  const requiresReply = status === "Needs Reply" || (matchesAny(text, RULES.needsReply) && !email.isRead);

  const actionItems: string[] = [];
  if (status === "Action Required") {
    actionItems.push(`Review: ${email.subject}`);
  } else if (requiresReply) {
    actionItems.push(`Reply to ${email.senderName}`);
  }

  const aiSummary = email.aiSummary || email.snippet || email.subject;

  return {
    category,
    priority,
    status,
    requiresReply,
    actionItems,
    dueDate: email.dueDate,
    aiSummary,
  };
}

/** Apply keyword rules when AI classification is missing or weak. */
export function applyHeuristicClassification(email: GmailEmail): GmailEmail {
  if (hasStrongAiClassification(email)) return email;

  const rules = classifyWithHeuristics(email);
  return {
    ...email,
    ...rules,
    actionItems: email.actionItems.length > 0 ? email.actionItems : rules.actionItems,
    aiConfidence: email.aiConfidence > 0 ? email.aiConfidence : 0.45,
  };
}

export function applyHeuristicClassificationBatch(emails: GmailEmail[]): GmailEmail[] {
  return emails.map(applyHeuristicClassification);
}

function dedupeByKey<T extends Record<string, unknown>>(items: T[], key: keyof T): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const value = String(item[key] ?? "");
    const dedupeKey = value || JSON.stringify(item);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(item);
  }
  return result;
}

export function generateHeuristicInsights(emails: GmailEmail[]): Insights {
  const actionItems: Record<string, unknown>[] = [];
  const waitingOn: Record<string, unknown>[] = [];
  const bills: Record<string, unknown>[] = [];
  const followUps: Record<string, unknown>[] = [];
  const calendar: Record<string, unknown>[] = [];
  const security: Record<string, unknown>[] = [];
  const purchases: Record<string, unknown>[] = [];

  const today = new Date().toISOString().split("T")[0];

  for (const email of emails) {
    const text = emailText(email);
    const classified = classifyWithHeuristics(email);

    if (classified.status === "Action Required" || classified.requiresReply) {
      actionItems.push({
        text: classified.actionItems[0] || `Review: ${email.subject}`,
        from: email.senderName,
        priority: classified.priority,
        dueDate: classified.dueDate,
        emailId: email.id,
      });
    }

    if (classified.status === "Waiting" || matchesAny(text, RULES.waiting)) {
      const days = daysSince(email.receivedAt);
      waitingOn.push({
        person: email.senderName,
        subject: email.subject,
        days,
        priority: days > 5 ? "High" : classified.priority,
        emailId: email.id,
        aiTip: days > 5 ? "Consider sending a polite follow-up." : "Waiting for their response.",
      });
    }

    if (classified.category === "Finance" || matchesAny(text, RULES.finance)) {
      const amount = extractAmount(text);
      const isDue = /payment due|amount due|overdue|past due/i.test(text);
      bills.push({
        name: email.senderName,
        amount,
        due: classified.dueDate,
        category: /subscription|renew/i.test(text) ? "Subscription" : "Bill",
        status: isDue ? "due_soon" : "upcoming",
        emailId: email.id,
      });
    }

    if (matchesAny(text, RULES.followUp)) {
      followUps.push({
        text: email.snippet || email.subject,
        person: email.senderName,
        dueDate: classified.dueDate,
        emailId: email.id,
        email_subject: email.subject,
        status: classified.dueDate && classified.dueDate < today ? "overdue" : "upcoming",
      });
    }

    if (classified.category === "Calendar" || matchesAny(text, RULES.calendar)) {
      calendar.push({
        title: email.subject,
        date: email.receivedAt ? email.receivedAt.split("T")[0] : null,
        time: email.timeDisplay || null,
        location: null,
        type: /travel|flight|hotel/i.test(text) ? "travel" : "meeting",
        emailId: email.id,
      });
    }

    if (classified.category === "Security" || matchesAny(text, RULES.security)) {
      const severity = /suspicious|unusual|alert/i.test(text) ? "high" : "medium";
      security.push({
        type: /password reset/i.test(text) ? "Password reset" : "Account verification",
        from: email.senderName,
        severity,
        description: email.snippet || email.subject,
        emailId: email.id,
      });
    }

    if (classified.category === "Purchases" || matchesAny(text, RULES.purchases)) {
      let status = "ordered";
      if (/delivered/i.test(text)) status = "delivered";
      else if (/shipped|out for delivery/i.test(text)) status = "shipped";
      purchases.push({
        item: email.subject,
        from: email.senderName,
        amount: extractAmount(text),
        date: email.receivedAt ? email.receivedAt.split("T")[0] : null,
        status,
        emailId: email.id,
      });
    }
  }

  return {
    actionItems,
    waitingOn,
    bills,
    followUps,
    calendar,
    security,
    purchases,
  };
}

/** Fill empty AI insight buckets with keyword-based detections. */
export function enrichInsights(emails: GmailEmail[], apiInsights: Insights): Insights {
  const heuristic = generateHeuristicInsights(emails);

  const pick = <T extends Record<string, unknown>>(api: unknown[], generated: T[]): T[] => {
    const apiItems = Array.isArray(api) ? (api as T[]) : [];
    if (apiItems.length > 0) return apiItems;
    return generated;
  };

  return {
    actionItems: dedupeByKey(
      [...pick(apiInsights.actionItems as Record<string, unknown>[], heuristic.actionItems as Record<string, unknown>[])],
      "emailId",
    ),
    waitingOn: dedupeByKey(
      [...pick(apiInsights.waitingOn as Record<string, unknown>[], heuristic.waitingOn as Record<string, unknown>[])],
      "emailId",
    ),
    bills: dedupeByKey(
      [...pick(apiInsights.bills as Record<string, unknown>[], heuristic.bills as Record<string, unknown>[])],
      "emailId",
    ),
    followUps: dedupeByKey(
      [...pick(apiInsights.followUps as Record<string, unknown>[], heuristic.followUps as Record<string, unknown>[])],
      "emailId",
    ),
    calendar: dedupeByKey(
      [...pick(apiInsights.calendar as Record<string, unknown>[], heuristic.calendar as Record<string, unknown>[])],
      "emailId",
    ),
    security: dedupeByKey(
      [...pick(apiInsights.security as Record<string, unknown>[], heuristic.security as Record<string, unknown>[])],
      "emailId",
    ),
    purchases: dedupeByKey(
      [...pick(apiInsights.purchases as Record<string, unknown>[], heuristic.purchases as Record<string, unknown>[])],
      "emailId",
    ),
  };
}
