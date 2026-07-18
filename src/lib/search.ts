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

export function searchCachedEmails(emails: GmailEmail[], query: string): GmailEmail[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  return emails.filter((email) => {
    const text = haystack(email);
    return terms.every((term) => text.includes(term));
  });
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
