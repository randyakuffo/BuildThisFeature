import { describe, expect, it } from "vitest";
import type { GmailEmail } from "./normalize";
import {
  applyHeuristicClassification,
  enrichInsights,
  generateHeuristicInsights,
} from "./heuristics";

function makeEmail(overrides: Partial<GmailEmail> = {}): GmailEmail {
  return {
    id: "1",
    threadId: "t1",
    senderName: "Sender",
    senderEmail: "sender@example.com",
    subject: "Hello",
    snippet: "Just checking in",
    receivedAt: new Date().toISOString(),
    timeDisplay: "Today",
    isRead: false,
    isImportant: false,
    isStarred: false,
    category: "Work",
    priority: "Medium",
    status: "Information",
    labels: [],
    initials: "SE",
    avatarBg: "#000",
    aiSummary: null,
    requiresReply: false,
    actionItems: [],
    dueDate: null,
    aiConfidence: 0,
    ...overrides,
  };
}

describe("applyHeuristicClassification", () => {
  it("classifies invoice emails as Finance", () => {
    const email = applyHeuristicClassification(
      makeEmail({ subject: "Your invoice for March", snippet: "Amount due $49" }),
    );
    expect(email.category).toBe("Finance");
  });

  it("flags direct questions as Needs Reply", () => {
    const email = applyHeuristicClassification(
      makeEmail({ subject: "Quick question", snippet: "Can you review this by Friday?" }),
    );
    expect(email.status).toBe("Needs Reply");
    expect(email.requiresReply).toBe(true);
  });

  it("keeps strong AI classifications", () => {
    const email = applyHeuristicClassification(
      makeEmail({
        category: "Personal",
        status: "No Action",
        aiConfidence: 0.9,
        subject: "Your invoice",
      }),
    );
    expect(email.category).toBe("Personal");
  });
});

describe("generateHeuristicInsights", () => {
  it("populates bills, purchases, and security buckets", () => {
    const emails = [
      makeEmail({ id: "b1", subject: "Invoice from Stripe", snippet: "Payment due $20" }),
      makeEmail({ id: "p1", subject: "Your order has shipped", snippet: "Tracking number 123" }),
      makeEmail({ id: "s1", subject: "Suspicious sign-in attempt", snippet: "Verify your account" }),
    ];

    const insights = generateHeuristicInsights(emails);
    expect(insights.bills.length).toBeGreaterThan(0);
    expect(insights.purchases.length).toBeGreaterThan(0);
    expect(insights.security.length).toBeGreaterThan(0);
  });
});

describe("enrichInsights", () => {
  it("uses heuristics when API insights are empty", () => {
    const emails = [makeEmail({ id: "b1", subject: "Invoice due", snippet: "Amount due $15" })];
    const enriched = enrichInsights(emails, {
      actionItems: [],
      waitingOn: [],
      bills: [],
      followUps: [],
      calendar: [],
      security: [],
      purchases: [],
    });

    expect(enriched.bills.length).toBe(1);
  });

  it("prefers API insights when present", () => {
    const emails = [makeEmail({ id: "b1", subject: "Invoice due", snippet: "Amount due $15" })];
    const enriched = enrichInsights(emails, {
      actionItems: [],
      waitingOn: [],
      bills: [{ name: "AI Bill", amount: 99, emailId: "api-1" }],
      followUps: [],
      calendar: [],
      security: [],
      purchases: [],
    });

    expect(enriched.bills).toHaveLength(1);
    expect((enriched.bills[0] as { name?: string }).name).toBe("AI Bill");
  });
});
