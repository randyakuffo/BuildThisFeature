import { describe, expect, it } from "vitest";
import {
  emailMatchesQuery,
  filterRelevantEmails,
  mergeEmailResults,
  mergeSearchResults,
  sanitizeRemoteSearchResults,
  searchCachedEmails,
  toGmailQuery,
} from "./search";
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

describe("emailMatchesQuery", () => {
  it("matches preset chips with related keywords", () => {
    expect(emailMatchesQuery(sample[0], "Invoices")).toBe(true);
    expect(emailMatchesQuery(sample[1], "Flight confirmation")).toBe(true);
  });

  it("rejects unrelated emails", () => {
    expect(emailMatchesQuery(sample[1], "invoice")).toBe(false);
    expect(emailMatchesQuery(sample[0], "flight")).toBe(false);
  });
});

describe("mergeSearchResults", () => {
  const junk = {
    ...sample[1],
    id: "junk",
    subject: "Team lunch on Friday",
    snippet: "Where should we go?",
    senderName: "Coworker",
    senderEmail: "coworker@company.com",
  };

  it("drops unrelated remote results after merge", () => {
    const merged = mergeSearchResults("invoice", sample, [junk]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("1");
  });
});

describe("sanitizeRemoteSearchResults", () => {
  const junk = {
    ...sample[1],
    id: "junk",
    subject: "Random newsletter",
    snippet: "Top stories this week",
    senderName: "News",
    senderEmail: "news@example.com",
  };

  it("filters polluted inbox dumps down to relevant matches", () => {
    const polluted = [sample[0], junk, junk, junk, junk, junk];
    const cleaned = sanitizeRemoteSearchResults(polluted, "invoice");
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].id).toBe("1");
  });

  it("keeps all results when every email matches", () => {
    expect(sanitizeRemoteSearchResults([sample[0]], "invoice")).toHaveLength(1);
  });

  it("returns empty when nothing matches", () => {
    expect(sanitizeRemoteSearchResults([sample[1]], "invoice")).toHaveLength(0);
  });
});

describe("filterRelevantEmails", () => {
  it("handles plural search terms", () => {
    expect(filterRelevantEmails(sample, "invoices")).toHaveLength(1);
  });
});
