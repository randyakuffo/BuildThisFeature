export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  enabledAt?: string;
}

export const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "newsletter-filter",
    name: "Newsletter Filter",
    trigger: "Newsletter or unsubscribe link detected",
    action: "Label as Newsletters",
    active: true,
  },
  {
    id: "bill-tracker",
    name: "Bill Tracker",
    trigger: "Invoice or bill keyword in subject",
    action: "Add to Bills tracker",
    active: true,
  },
  {
    id: "shipment-monitor",
    name: "Shipment Monitor",
    trigger: "Tracking number detected",
    action: "Add to Purchases",
    active: true,
  },
];

const SUGGESTION_RULE_MAP: Record<string, string> = {
  newsletters: "newsletter-filter",
  finance: "bill-tracker",
  morning: "morning-digest",
  work: "priority-hours",
};

const SUGGESTION_LABELS: Record<string, { name: string; trigger: string; action: string }> = {
  "morning-digest": {
    name: "Morning Digest",
    trigger: "Unread important emails each morning",
    action: "Send daily digest summary",
  },
  "priority-hours": {
    name: "Priority Hours",
    trigger: "Work emails during business hours",
    action: "Boost work email priority 9am–5pm",
  },
};

export function storageKey(userId: string) {
  return `inboxos-automations:${userId}`;
}

export function dismissedStorageKey(userId: string) {
  return `inboxos-automations-dismissed:${userId}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("InboxOS automation persistence failed:", error);
  }
}

export function mergeAutomationRules(saved: AutomationRule[]): AutomationRule[] {
  const savedById = new Map(saved.map((rule) => [rule.id, rule]));
  const merged = DEFAULT_RULES.map((defaults) => {
    const stored = savedById.get(defaults.id);
    if (!stored) return { ...defaults };
    return {
      ...defaults,
      ...stored,
      name: defaults.name,
      trigger: defaults.trigger,
      action: defaults.action,
      active: Boolean(stored.active),
    };
  });

  for (const rule of saved) {
    if (DEFAULT_RULES.some((defaults) => defaults.id === rule.id)) continue;
    const template = SUGGESTION_LABELS[rule.id];
    merged.push({
      id: rule.id,
      name: template?.name || rule.name,
      trigger: template?.trigger || rule.trigger,
      action: template?.action || rule.action,
      active: Boolean(rule.active),
      enabledAt: rule.enabledAt,
    });
  }

  return merged;
}

export function loadAutomationRules(userId: string): AutomationRule[] {
  if (!userId) return DEFAULT_RULES.map((rule) => ({ ...rule }));

  const parsed = readJson<AutomationRule[]>(storageKey(userId));
  if (!Array.isArray(parsed)) {
    return DEFAULT_RULES.map((rule) => ({ ...rule }));
  }

  return mergeAutomationRules(parsed);
}

export function saveAutomationRules(userId: string, rules: AutomationRule[]) {
  if (!userId) {
    console.warn("InboxOS automations: skipped save because user id is missing.");
    return;
  }
  writeJson(storageKey(userId), rules);
}

export function loadDismissedSuggestions(userId: string): string[] {
  if (!userId) return [];
  const parsed = readJson<string[]>(dismissedStorageKey(userId));
  return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
}

export function saveDismissedSuggestions(userId: string, dismissed: Iterable<string>) {
  if (!userId) return;
  writeJson(dismissedStorageKey(userId), [...dismissed]);
}

export function dismissSuggestion(userId: string, suggestionId: string): string[] {
  const dismissed = new Set(loadDismissedSuggestions(userId));
  dismissed.add(suggestionId);
  const next = [...dismissed];
  saveDismissedSuggestions(userId, next);
  return next;
}

export function enableSuggestionRule(
  userId: string,
  suggestionId: string,
  label: string,
  action: string,
): AutomationRule[] {
  if (!userId) return DEFAULT_RULES.map((rule) => ({ ...rule }));

  const rules = loadAutomationRules(userId);
  const mappedId = SUGGESTION_RULE_MAP[suggestionId] ?? `custom-${suggestionId}`;
  const existing = rules.find((rule) => rule.id === mappedId);
  const now = new Date().toISOString();

  if (existing) {
    existing.active = true;
    existing.enabledAt = now;
  } else {
    const template = SUGGESTION_LABELS[mappedId];
    rules.push({
      id: mappedId,
      name: template?.name || label,
      trigger: template?.trigger || `AI suggestion: ${suggestionId}`,
      action: template?.action || action,
      active: true,
      enabledAt: now,
    });
  }

  saveAutomationRules(userId, rules);
  dismissSuggestion(userId, suggestionId);
  return rules;
}

export function toggleRule(userId: string, ruleId: string): AutomationRule[] {
  if (!userId) return DEFAULT_RULES.map((rule) => ({ ...rule }));

  const rules = loadAutomationRules(userId);
  const next = rules.map((rule) =>
    rule.id === ruleId ? { ...rule, active: !rule.active } : rule,
  );
  saveAutomationRules(userId, next);
  return next;
}
