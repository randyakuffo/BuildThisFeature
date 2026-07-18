import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizeInsightsResponse,
  normalizeBriefResponse,
} from "./normalize";

describe("normalizeEmail", () => {
  it("fills defaults for missing fields", () => {
    const result = normalizeEmail({ id: "abc", subject: "Hello" });
    expect(result.id).toBe("abc");
    expect(result.subject).toBe("Hello");
    expect(result.senderName).toBe("Unknown Sender");
    expect(result.category).toBe("Other");
    expect(result.actionItems).toEqual([]);
    expect(result.aiConfidence).toBe(0);
  });

  it("filters non-string action items", () => {
    const result = normalizeEmail({
      id: "1",
      actionItems: ["valid", 42, null, "also valid"],
    });
    expect(result.actionItems).toEqual(["valid", "also valid"]);
  });
});

describe("normalizeInsightsResponse", () => {
  it("normalizes snake_case insight keys", () => {
    const result = normalizeInsightsResponse({
      action_items: [{ text: "Pay bill" }],
      waiting_on: [],
      follow_ups: [],
      bills: [],
      calendar: [],
      security: [],
      purchases: [],
      brief: { summary: "Busy day", highlights: ["3 unread"] },
    });
    expect(result.actionItems).toHaveLength(1);
    expect(result.brief.summary).toBe("Busy day");
    expect(result.brief.highlights).toEqual(["3 unread"]);
  });

  it("returns empty arrays for malformed input", () => {
    const result = normalizeInsightsResponse(null);
    expect(result.actionItems).toEqual([]);
    expect(result.brief.highlights).toEqual([]);
  });
});

describe("normalizeBriefResponse", () => {
  it("accepts array-only brief payloads", () => {
    const result = normalizeBriefResponse(["One", "Two"]);
    expect(result.summary).toBe("");
    expect(result.highlights).toEqual(["One", "Two"]);
  });

  it("reads nested brief objects", () => {
    const result = normalizeBriefResponse({
      brief: { summary: "Summary", highlights: ["A", "B"] },
    });
    expect(result.summary).toBe("Summary");
    expect(result.highlights).toEqual(["A", "B"]);
  });
});
