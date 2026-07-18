import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  DEFAULT_RULES,
  dismissSuggestion,
  enableSuggestionRule,
  loadAutomationRules,
  loadDismissedSuggestions,
  mergeAutomationRules,
  storageKey,
  dismissedStorageKey,
  toggleRule,
} from "./automations";

const USER_ID = "user-123";

function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("automations persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  it("persists toggled rule state across reloads", () => {
    toggleRule(USER_ID, "newsletter-filter");
    const reloaded = loadAutomationRules(USER_ID);
    const newsletter = reloaded.find((rule) => rule.id === "newsletter-filter");
    expect(newsletter?.active).toBe(false);

    toggleRule(USER_ID, "newsletter-filter");
    const enabledAgain = loadAutomationRules(USER_ID);
    expect(enabledAgain.find((rule) => rule.id === "newsletter-filter")?.active).toBe(true);
  });

  it("persists enabled suggestions and dismissed cards", () => {
    enableSuggestionRule(USER_ID, "newsletters", "Enable Auto-Archive", "Enable Auto-Archive");

    expect(loadDismissedSuggestions(USER_ID)).toContain("newsletters");
    expect(loadAutomationRules(USER_ID).find((rule) => rule.id === "newsletter-filter")?.active).toBe(true);
    expect(localStorage.getItem(storageKey(USER_ID))).toBeTruthy();
    expect(localStorage.getItem(dismissedStorageKey(USER_ID))).toBeTruthy();
  });

  it("merges stored rules with defaults without dropping custom rules", () => {
    const saved = [
      { ...DEFAULT_RULES[0], active: false },
      {
        id: "morning-digest",
        name: "Morning Digest",
        trigger: "Unread important emails each morning",
        action: "Send daily digest summary",
        active: true,
        enabledAt: "2026-07-18T00:00:00.000Z",
      },
    ];

    const merged = mergeAutomationRules(saved);
    expect(merged.find((rule) => rule.id === "newsletter-filter")?.active).toBe(false);
    expect(merged.find((rule) => rule.id === "morning-digest")?.active).toBe(true);
    expect(merged.find((rule) => rule.id === "bill-tracker")).toBeTruthy();
  });

  it("does not save when user id is missing", () => {
    const setItem = vi.spyOn(localStorage, "setItem");
    toggleRule("", "newsletter-filter");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("persists dismissed suggestions", () => {
    dismissSuggestion(USER_ID, "finance");
    expect(loadDismissedSuggestions(USER_ID)).toEqual(["finance"]);
  });
});
