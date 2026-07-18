import * as kv from "./kv_store.tsx";

const RULES = {
  newsletter: [/unsubscribe/i, /newsletter/i, /weekly digest/i, /no-?reply@/i, /marketing@/i],
  finance: [/\binvoice\b/i, /\bbill(ing)?\b/i, /payment due/i, /amount due/i, /subscription renew/i, /your receipt/i, /statement (is )?ready/i],
  purchases: [/order confirm/i, /your order/i, /shipped/i, /out for delivery/i, /tracking (number|#)/i, /package (has|was) delivered/i],
  travel: [/\bflight\b/i, /itinerary/i, /boarding pass/i, /hotel reservation/i],
  security: [/verify your (account|email|identity)/i, /suspicious (activity|sign-?in|login)/i, /password reset/i, /security alert/i],
  calendar: [/meeting invite/i, /calendar invitation/i, /invited you to/i, /zoom meeting/i, /google meet/i, /teams meeting/i],
  needsReply: [/\?/, /please reply/i, /let me know/i, /waiting for your (response|reply|feedback)/i, /could you (confirm|review|send)/i],
  actionRequired: [/action required/i, /complete by/i, /due by/i, /sign (the )?document/i, /review and approve/i, /please (complete|submit|fill)/i],
  waiting: [/any update/i, /following up/i, /just checking in/i, /pending (your )?approval/i, /awaiting (your )?response/i],
  followUp: [/i('ll| will) (send|get back|follow up|review)/i, /i('ll| will) let you know/i],
  urgent: [/urgent/i, /asap/i, /immediate(ly)?/i],
};

function emailText(email: any): string {
  return [email.senderName, email.senderEmail, email.subject, email.snippet, email.aiSummary, ...(email.labels || [])]
    .filter(Boolean)
    .join(" ");
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
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

export function heuristicClassifyEmail(email: any) {
  const text = emailText(email);
  const gmailPromotions = (email.labels || []).includes("CATEGORY_PROMOTIONS");
  const gmailPersonal = (email.labels || []).includes("CATEGORY_PERSONAL");

  let category = email.category || "Work";
  if (matchesAny(text, RULES.newsletter) || gmailPromotions) category = "Newsletter";
  else if (matchesAny(text, RULES.security)) category = "Security";
  else if (matchesAny(text, RULES.finance)) category = "Finance";
  else if (matchesAny(text, RULES.purchases)) category = "Purchases";
  else if (matchesAny(text, RULES.travel)) category = "Travel";
  else if (matchesAny(text, RULES.calendar)) category = "Calendar";
  else if (gmailPersonal) category = "Personal";

  let status = email.status || "Information";
  if (matchesAny(text, RULES.needsReply) && !email.isRead) status = "Needs Reply";
  else if (matchesAny(text, RULES.actionRequired)) status = "Action Required";
  else if (matchesAny(text, RULES.waiting)) status = "Waiting";
  else if (category === "Newsletter") status = "No Action";

  let priority = email.priority || (email.isImportant ? "High" : "Medium");
  if (email.isImportant || matchesAny(text, RULES.urgent) || category === "Security") priority = "High";
  else if (category === "Newsletter") priority = "Low";
  else if (status === "Needs Reply" || status === "Action Required") priority = "High";

  const requiresReply = status === "Needs Reply" || (matchesAny(text, RULES.needsReply) && !email.isRead);
  const actionItems: string[] = [];
  if (status === "Action Required") actionItems.push(`Review: ${email.subject}`);
  else if (requiresReply) actionItems.push(`Reply to ${email.senderName}`);

  return {
    category,
    priority,
    status,
    requiresReply,
    actionItems,
    dueDate: email.dueDate ?? null,
    aiSummary: email.aiSummary || email.snippet || email.subject || "",
    confidence: 0.45,
  };
}

export function applyHeuristicClassifications(emails: any[]) {
  const now = new Date().toISOString();
  return emails.map((email) => {
    const hasStrongAi = Number(email.aiConfidence) >= 0.6 && email.status && email.status !== "Information";
    if (hasStrongAi && email.ai_version === "v2") return email;
    const rules = heuristicClassifyEmail(email);
    return {
      ...email,
      category: rules.category,
      priority: rules.priority,
      status: rules.status,
      requiresReply: rules.requiresReply,
      actionItems: Array.isArray(email.actionItems) && email.actionItems.length > 0 ? email.actionItems : rules.actionItems,
      dueDate: rules.dueDate,
      aiSummary: rules.aiSummary,
      aiConfidence: Number(email.aiConfidence) > 0 ? email.aiConfidence : rules.confidence,
      ai_version: email.ai_version || "heuristic",
      ai_provider: email.ai_provider || "fallback",
      ai_model: email.ai_model || "rules",
      ai_processed_at: email.ai_processed_at || now,
    };
  });
}

export function generateHeuristicInsights(emails: any[]) {
  const actionItems: any[] = [];
  const waitingOn: any[] = [];
  const bills: any[] = [];
  const followUps: any[] = [];
  const calendar: any[] = [];
  const security: any[] = [];
  const purchases: any[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const email of emails) {
    const text = emailText(email);
    const classified = heuristicClassifyEmail(email);

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
      bills.push({
        name: email.senderName,
        amount: extractAmount(text),
        due: classified.dueDate,
        category: /subscription|renew/i.test(text) ? "Subscription" : "Bill",
        status: /payment due|amount due|overdue|past due/i.test(text) ? "due_soon" : "upcoming",
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
        date: email.receivedAt ? String(email.receivedAt).split("T")[0] : null,
        time: email.timeDisplay || null,
        location: null,
        type: /travel|flight|hotel/i.test(text) ? "travel" : "meeting",
        emailId: email.id,
      });
    }

    if (classified.category === "Security" || matchesAny(text, RULES.security)) {
      security.push({
        type: /password reset/i.test(text) ? "Password reset" : "Account verification",
        from: email.senderName,
        severity: /suspicious|unusual|alert/i.test(text) ? "high" : "medium",
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
        date: email.receivedAt ? String(email.receivedAt).split("T")[0] : null,
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
    brief: {
      summary: `Rule-based scan found ${actionItems.length} actions, ${bills.length} bills, and ${purchases.length} purchases.`,
      highlights: [
        actionItems.length ? `${actionItems.length} action item(s) need attention` : "",
        bills.length ? `${bills.length} bill(s) detected` : "",
        security.length ? `${security.length} security notice(s)` : "",
      ].filter(Boolean),
    },
  };
}

function dedupeByKey(items: any[], key: string) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const item of items) {
    const value = String(item?.[key] ?? "");
    const dedupeKey = value || JSON.stringify(item);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(item);
  }
  return result;
}

export function enrichInsightsWithHeuristics(emails: any[], apiInsights: any) {
  const heuristic = generateHeuristicInsights(emails);
  const pick = (api: any[], generated: any[]) => (Array.isArray(api) && api.length > 0 ? api : generated);
  return {
    actionItems: dedupeByKey([...pick(apiInsights.actionItems, heuristic.actionItems)], "emailId"),
    waitingOn: dedupeByKey([...pick(apiInsights.waitingOn, heuristic.waitingOn)], "emailId"),
    bills: dedupeByKey([...pick(apiInsights.bills, heuristic.bills)], "emailId"),
    followUps: dedupeByKey([...pick(apiInsights.followUps, heuristic.followUps)], "emailId"),
    calendar: dedupeByKey([...pick(apiInsights.calendar, heuristic.calendar)], "emailId"),
    security: dedupeByKey([...pick(apiInsights.security, heuristic.security)], "emailId"),
    purchases: dedupeByKey([...pick(apiInsights.purchases, heuristic.purchases)], "emailId"),
    brief: apiInsights.brief?.summary ? apiInsights.brief : heuristic.brief,
  };
}

async function storeInsights(userId: string, insights: any, meta: Record<string, unknown>) {
  await kv.mset(
    [`insights:${userId}:action_items`, `insights:${userId}:waiting_on`, `insights:${userId}:bills`,
     `insights:${userId}:follow_ups`, `insights:${userId}:calendar`, `insights:${userId}:security`,
     `insights:${userId}:purchases`, `insights:${userId}:brief`, `insights:${userId}:meta`],
    [
      insights.actionItems, insights.waitingOn, insights.bills,
      insights.followUps, insights.calendar, insights.security,
      insights.purchases, insights.brief, meta,
    ],
  );
}

export async function persistHeuristicInsights(emails: any[], userId: string) {
  const insights = generateHeuristicInsights(emails);
  const now = new Date().toISOString();
  await storeInsights(userId, insights, {
    analysisCompletedAt: now,
    insights_provider: "fallback",
    insights_model: "rules",
    insights_generated_at: now,
    insights_version: "heuristic",
  });
  return insights;
}

export async function persistEnrichedInsights(emails: any[], userId: string, apiInsights: any, meta: Record<string, unknown>) {
  const insights = enrichInsightsWithHeuristics(emails, apiInsights);
  await storeInsights(userId, insights, meta);
  return insights;
}
