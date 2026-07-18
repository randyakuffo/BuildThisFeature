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

export function storageKey(userId: string) {
  return `inboxos-automations:${userId}`;
}

export function loadAutomationRules(userId: string): AutomationRule[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_RULES.map((r) => ({ ...r }));
    const parsed = JSON.parse(raw) as AutomationRule[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_RULES.map((r) => ({ ...r }));
    }
    return parsed;
  } catch {
    return DEFAULT_RULES.map((r) => ({ ...r }));
  }
}

export function saveAutomationRules(userId: string, rules: AutomationRule[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(rules));
}

export function enableSuggestionRule(
  userId: string,
  suggestionId: string,
  label: string,
  action: string,
): AutomationRule[] {
  const rules = loadAutomationRules(userId);
  const mappedId = SUGGESTION_RULE_MAP[suggestionId] ?? `custom-${suggestionId}`;
  const existing = rules.find((r) => r.id === mappedId);

  if (existing) {
    existing.active = true;
    existing.enabledAt = new Date().toISOString();
  } else {
    rules.push({
      id: mappedId,
      name: label,
      trigger: `AI suggestion: ${suggestionId}`,
      action,
      active: true,
      enabledAt: new Date().toISOString(),
    });
  }

  saveAutomationRules(userId, rules);
  return rules;
}

export function toggleRule(userId: string, ruleId: string): AutomationRule[] {
  const rules = loadAutomationRules(userId);
  const next = rules.map((r) =>
    r.id === ruleId ? { ...r, active: !r.active } : r,
  );
  saveAutomationRules(userId, next);
  return next;
}
