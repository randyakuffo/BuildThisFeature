import { describe, expect, it } from "vitest";
import { searchCachedEmails, toGmailQuery, mergeEmailResults } from "./search";
import type { GmailEmail } from "./normalize";

const sample: GmailEmail[] = [
  {
    id: "1",
    threadId: "t1",
    senderName: "Stripe",
    senderEmail: "billing@stripe.com",
    subject: "Your invoice for March",
    snippet: "Amount due $49",
    receivedAt: "",
    timeDisplay: "Today",
    isRead: false,
    isImportant: false,
    isStarred: false,
    category: "Finance",
    priority: "Medium",
    status: "Information",
    labels: [],
    initials: "ST",
    avatarBg: "#000",
    aiSummary: null,
    requiresReply: false,
    actionItems: [],
    dueDate: null,
    aiConfidence: 0,
  },
  {
    id: "2",
    threadId: "t2",
    senderName: "United Airlines",
    senderEmail: "noreply@united.com",
    subject: "Flight confirmation SFO to JFK",
    snippet: "Your trip is booked",
    receivedAt: "",
    timeDisplay: "Yesterday",
    isRead: true,
    isImportant: false,
    isStarred: false,
    category: "Travel",
    priority: "Low",
    status: "Information",
    labels: [],
    initials: "UA",
    avatarBg: "#111",
    aiSummary: null,
    requiresReply: false,
    actionItems: [],
    dueDate: null,
    aiConfidence: 0,
  },
];

describe("searchCachedEmails", () => {
  it("matches keywords across subject and sender", () => {
    expect(searchCachedEmails(sample, "invoice")).toHaveLength(1);
    expect(searchCachedEmails(sample, "flight confirmation")).toHaveLength(1);
    expect(searchCachedEmails(sample, "stripe invoice")).toHaveLength(1);
  });

  it("returns empty for no match", () => {
    expect(searchCachedEmails(sample, "contracts")).toHaveLength(0);
  });
});

describe("toGmailQuery", () => {
  it("maps preset chips to Gmail syntax", () => {
    expect(toGmailQuery("Invoices")).toContain("invoice");
    expect(toGmailQuery("Flight confirmation")).toContain("flight");
  });
});

describe("mergeEmailResults", () => {
  it("dedupes by id", () => {
    const merged = mergeEmailResults(sample, [{ ...sample[0], subject: "duplicate" }]);
    expect(merged).toHaveLength(2);
  });
});
