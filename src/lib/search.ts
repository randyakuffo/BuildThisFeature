import type { GmailEmail } from "./normalize";
import { normalizeEmail } from "./normalize";

function haystack(email: GmailEmail): string {
  return [
    email.senderName,
    email.senderEmail,
    email.subject,
    email.snippet,
    email.aiSummary,
    email.category,
    ...(email.actionItems || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const PRESET_KEYWORDS: Record<string, string[]> = {
  invoices: ["invoice", "receipt", "billing", "payment due"],
  receipts: ["receipt", "order confirmation", "payment received"],
  "flight confirmation": ["flight", "itinerary", "boarding", "confirmation"],
  contracts: ["contract", "agreement", "nda", "signature required"],
  "from my boss": ["urgent", "action required", "important"],
};

function termMatches(text: string, term: string): boolean {
  if (text.includes(term)) return true;
  if (term.length > 3 && term.endsWith("s") && text.includes(term.slice(0, -1))) return true;
  if (!term.endsWith("s") && text.includes(`${term}s`)) return true;
  return false;
}

function isInLastMonth(email: GmailEmail): boolean {
  if (!email.receivedAt) return false;
  const received = new Date(email.receivedAt);
  if (Number.isNaN(received.getTime())) return false;
  const now = new Date();
  const after = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const before = new Date(now.getFullYear(), now.getMonth(), 1);
  return received >= after && received < before;
}

/** True when an email matches the user's search text (not Gmail query syntax). */
export function emailMatchesQuery(email: GmailEmail, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  const presetTerms = PRESET_KEYWORDS[lower];
  if (presetTerms) {
    const text = haystack(email);
    return presetTerms.some((term) => termMatches(text, term));
  }

  if (lower === "last month") return isInLastMonth(email);

  const terms = lower.split(/\s+/).filter(Boolean);
  const text = haystack(email);
  return terms.every((term) => termMatches(text, term));
}

export function filterRelevantEmails(emails: GmailEmail[], query: string): GmailEmail[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return emails.filter((email) => emailMatchesQuery(email, trimmed));
}

export function searchCachedEmails(emails: GmailEmail[], query: string): GmailEmail[] {
  return filterRelevantEmails(emails, query);
}

/** Map friendly UI queries to Gmail search syntax. */
export function toGmailQuery(query: string): string {
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  const presets: Record<string, string> = {
    invoices: "subject:(invoice OR receipt OR billing OR payment due)",
    invoice: "subject:(invoice OR receipt OR billing)",
    receipts: "subject:(receipt OR order confirmation OR payment received)",
    "flight confirmation": "subject:(flight OR itinerary OR boarding) OR subject:confirmation",
    contracts: "subject:(contract OR agreement OR NDA OR signature required)",
    "from my boss": "is:important OR subject:(urgent OR action required)",
  };

  if (presets[lower]) return presets[lower];

  if (lower === "last month") {
    const now = new Date();
    const after = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const before = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    return `after:${fmt(after)} before:${fmt(before)}`;
  }

  return trimmed;
}

export function mergeEmailResults(...lists: GmailEmail[][]): GmailEmail[] {
  const byId = new Map<string, GmailEmail>();
  for (const list of lists) {
    for (const raw of list) {
      const email = normalizeEmail(raw);
      if (email.id) byId.set(email.id, email);
    }
  }
  return Array.from(byId.values());
}

/** Merge result lists and keep only emails that match the user's query. */
export function mergeSearchResults(userQuery: string, ...lists: GmailEmail[][]): GmailEmail[] {
  return filterRelevantEmails(mergeEmailResults(...lists), userQuery);
}

/**
 * Detect when a Gmail API response looks like an unfiltered inbox dump
 * (common when the deployed backend ignores the search query).
 */
export function sanitizeRemoteSearchResults(
  remoteResults: GmailEmail[],
  userQuery: string,
): GmailEmail[] {
  if (!remoteResults.length) return [];

  const relevant = filterRelevantEmails(remoteResults, userQuery);
  if (!relevant.length) return [];

  const ratio = relevant.length / remoteResults.length;
  if (remoteResults.length >= 5 && ratio < 0.35) return relevant;
  if (remoteResults.length >= 3 && ratio < 0.5) return relevant;

  return relevant;
}
