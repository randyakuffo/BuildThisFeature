Improve the AI email sorting and classification system. The current code does not actually use AI to sort individual emails. Categories are currently derived from Gmail labels, priority is based only on Gmail’s IMPORTANT label, every unread message becomes Needs Reply, and aiSummary is always null.

Do not redesign the UI. Preserve authentication, Gmail sync, Edge Function authorization, existing dashboard, inbox, AI assistant, search, archive, reply, analytics, and all current functionality.

Modify:

supabase/functions/server/index.tsx
src/lib/supabase.ts
src/app/App.tsx
1. Add per-email AI classification

After Gmail messages are fetched, classify each email using OpenAI.

Each classified email must contain:

interface EmailClassification {
  category:
    | "Work"
    | "Personal"
    | "Finance"
    | "Purchases"
    | "Travel"
    | "Newsletter"
    | "Security"
    | "Calendar"
    | "Other";

  priority: "High" | "Medium" | "Low";

  status:
    | "Needs Reply"
    | "Action Required"
    | "Waiting"
    | "Information"
    | "No Action";

  aiSummary: string;
  requiresReply: boolean;
  actionItems: string[];
  dueDate: string | null;
  confidence: number;
}

Do not treat every unread email as requiring a reply.

An email should only be Needs Reply when the content clearly asks the user a question, requests information, requests confirmation, or requires a direct response.

Use Action Required when the user must do something but does not necessarily need to reply.

Use Waiting only when the email clearly indicates that another person or organization owes the user a response, delivery, approval, document, or result.

Use Information for useful messages requiring no action.

Use No Action for promotions, routine newsletters, automated notifications, and low-value content.

2. Analyze useful email content

For each email, provide the AI:

Sender name
Sender email
Subject
Snippet
Received date
Gmail labels
Read status
Important status

When the snippet is too short or ambiguous, fetch the text/plain email body before classification.

Do not send attachments to OpenAI.

Strip HTML and limit body content to a safe maximum length such as 4,000 characters.

3. Batch classification

Do not make one OpenAI request per email.

Classify emails in batches of 10.

Return strict JSON:

{
  "emails": [
    {
      "id": "gmail-message-id",
      "category": "Work",
      "priority": "High",
      "status": "Needs Reply",
      "aiSummary": "The sender needs approval for the revised proposal.",
      "requiresReply": true,
      "actionItems": ["Review the revised proposal", "Reply with approval"],
      "dueDate": "2026-07-16",
      "confidence": 0.93
    }
  ]
}

Use the Gmail message ID to merge classifications back into the correct emails.

4. Use structured output and validation

Validate all AI results before saving them.

Allowed categories:

Work
Personal
Finance
Purchases
Travel
Newsletter
Security
Calendar
Other

Allowed priorities:

High
Medium
Low

Allowed statuses:

Needs Reply
Action Required
Waiting
Information
No Action

Clamp confidence between 0 and 1.

Invalid or missing values must use safe defaults:

category: existing Gmail-derived category || "Other"
priority: isImportant ? "High" : "Medium"
status: "Information"
aiSummary: snippet
requiresReply: false
actionItems: []
dueDate: null
confidence: 0

Do not allow malformed AI output to fail the Gmail sync.

5. Improve the AI system prompt

Use instructions equivalent to:

Classify only from evidence explicitly present in the email.

Never invent a due date, amount, person, commitment, security threat,
meeting, purchase, or required reply.

A promotional call-to-action is not an action item.

An unread email does not automatically require a reply.

A receipt is not necessarily a bill.

A shipping advertisement is not a purchase.

A login notification is not automatically a security threat unless the
email indicates suspicious, unauthorized, blocked, or unusual activity.

Return null for unknown due dates.

Use confidence below 0.6 when the evidence is ambiguous.
6. Save the classified emails

Replace the original rule-only values with the validated AI classification before storing:

{
  ...email,
  category: classification.category,
  priority: classification.priority,
  status: classification.status,
  aiSummary: classification.aiSummary,
  requiresReply: classification.requiresReply,
  actionItems: classification.actionItems,
  dueDate: classification.dueDate,
  aiConfidence: classification.confidence
}

Update the frontend GmailEmail interface with:

requiresReply: boolean;
actionItems: string[];
dueDate: string | null;
aiConfidence: number;
7. Correct stats

Calculate:

needsReply: emails.filter(
  email => email.requiresReply
).length

Do not calculate needsReply from unread plus important.

Calculate important from:

email.priority === "High"

Calculate categories from the final AI categories.

8. Fix the AI-insights race condition

The current Gmail sync starts generateInsights() without waiting for it.

Replace the fire-and-forget behavior with:

await generateInsights(
  classifiedEmails,
  authenticatedUserId,
  apiKey
);

The sync response must not report full completion until email classification and insights generation are finished.

Return progress information such as:

{
  "success": true,
  "count": 25,
  "classified": 25,
  "insightsReady": true
}

If insights fail but email sync succeeds, return:

{
  "success": true,
  "count": 25,
  "classified": 25,
  "insightsReady": false,
  "insightsError": "safe error message"
}

Do not discard synced emails because an AI call failed.

9. Generate insights from classified records

Build aggregate insights primarily from the structured classifications instead of asking AI to rediscover everything from snippets.

Action Center should use:

email.actionItems

Needs Reply should use:

email.requiresReply

Daily priorities should be ordered by:

High priority with due date today or overdue
High priority requiring reply
High priority action required
Medium priority due soon
Other medium priority
Low priority

Use AI only where cross-email reasoning is required.

10. Prevent stale data

Before generating new insights, overwrite the prior insight arrays for the user.

Add an analysis timestamp:

analysisCompletedAt: new Date().toISOString()

Return it from the insights endpoint.

After sync completes, the frontend must fetch fresh emails and fresh insights.

11. Add safe diagnostics

Log only:

console.log("InboxOS AI classification:", {
  emailCount: emails.length,
  classifiedCount,
  fallbackCount,
  averageConfidence,
});
console.log("InboxOS insights generated:", {
  actionItems: insights.action_items.length,
  waitingOn: insights.waiting_on.length,
  bills: insights.bills.length,
  followUps: insights.follow_ups.length,
});

Never log email bodies, tokens, complete subjects, or personal email content.

12. AI availability

When OPENAI_API_KEY is missing:

Continue Gmail sync.
Use Gmail categories as fallback.
Use rule-based priority/status safely.
Set aiConfidence to 0.
Set aiSummary to the original snippet.
Return aiEnabled: false.
Do not show “AI Live” as active in the frontend.

When the key exists and classification succeeds, return aiEnabled: true.

13. Final verification

Confirm:

Unread does not automatically mean Needs Reply.
Gmail Important is not the sole priority signal.
Every classified email has a summary.
AI categories are saved and displayed.
Statistics use classified values.
Insights are ready before the frontend reloads them.
Empty or malformed OpenAI output uses fallbacks.
No actual token or full email body is logged.
TypeScript compiles without errors.
Existing Gmail sync and authorization remain working.

Apply the changes directly. Do not only explain them.