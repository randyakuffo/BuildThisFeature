Paste everything below into Figma Make.

Redesign the AI backend so InboxOS uses Groq and Gemini for different functions.

The new API keys are already stored securely as Supabase Edge Function secrets:

GROQ_API_KEY
GEMINI_API_KEY

Do not expose these keys to the frontend.

Do not redesign the existing visual interface except for adding small AI-provider status indicators where useful.

Preserve all existing functionality:

Google authentication
Gmail synchronization
Email display
Reply
Archive
Mark read
Search
Dashboard
Action Center
Waiting On
Follow Ups
Bills
Purchases
Calendar
Security
Analytics
Dark mode
Supabase caching

Modify primarily:

supabase/functions/server/index.tsx
src/lib/supabase.ts
src/app/App.tsx
1. Remove direct OpenAI dependency

Search the entire project for:

OPENAI_API_KEY
api.openai.com
callOpenAI
OpenAI
gpt-4o
gpt-4o-mini

Replace direct OpenAI calls with a provider-neutral AI service.

Do not remove fallback compatibility unnecessarily, but OpenAI must no longer be required for the application to work.

Create a provider-neutral interface inside the Edge Function:

type AIProviderName =
  | "groq"
  | "gemini"
  | "fallback";

interface AIRequestOptions {
  task:
    | "email_classification"
    | "insight_generation"
    | "daily_brief"
    | "assistant_chat"
    | "thread_summary";

  systemPrompt: string;
  userPrompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
}

interface AIResult<T> {
  success: boolean;
  provider: AIProviderName;
  model: string;
  data: T | null;
  error: string | null;
  fallbackUsed: boolean;
}

Create these provider functions:

callGroq<T>(
  options: AIRequestOptions
): Promise<AIResult<T>>
callGemini<T>(
  options: AIRequestOptions
): Promise<AIResult<T>>
runAITask<T>(
  options: AIRequestOptions
): Promise<AIResult<T>>

runAITask() must route requests according to the task.

2. Provider routing rules

Use this routing table:

const taskRouting = {
  email_classification: {
    primary: "groq",
    secondary: "gemini",
  },

  insight_generation: {
    primary: "gemini",
    secondary: "groq",
  },

  daily_brief: {
    primary: "gemini",
    secondary: "groq",
  },

  assistant_chat: {
    primary: "gemini",
    secondary: "groq",
  },

  thread_summary: {
    primary: "gemini",
    secondary: "groq",
  },
} as const;

Rules:

Try the primary provider first.
If the primary fails because of quota, rate limit, timeout, provider outage, invalid JSON, or temporary server error, try the secondary provider.
If both providers fail, return a safe fallback result.
Do not fail Gmail synchronization because an AI provider failed.
Never retry indefinitely.
Maximum one retry per provider.
Use exponential delay only for temporary rate limits or server errors.
3. Groq integration

Use Groq for email classification.

Use Groq’s OpenAI-compatible endpoint:

https://api.groq.com/openai/v1/chat/completions

Use:

Authorization: `Bearer ${GROQ_API_KEY}`

Use a currently supported Groq model configured in one central constant:

const GROQ_CLASSIFICATION_MODEL =
  Deno.env.get("GROQ_CLASSIFICATION_MODEL") ||
  "llama-3.3-70b-versatile";

Do not scatter model names throughout the code.

The request should use structured JSON output where the selected model supports it.

Example request structure:

const response = await fetch(
  "https://api.groq.com/openai/v1/chat/completions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_CLASSIFICATION_MODEL,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxOutputTokens ?? 3000,
      messages: [
        {
          role: "system",
          content: options.systemPrompt,
        },
        {
          role: "user",
          content: options.userPrompt,
        },
      ],
      response_format: {
        type: "json_object",
      },
    }),
  }
);

Groq is OpenAI-compatible, but do not assume every OpenAI parameter is supported. Keep the request minimal.

4. Gemini integration

Use Gemini for reasoning, briefs, cross-email insights, assistant chat, and long summaries.

Use a central model constant:

const GEMINI_REASONING_MODEL =
  Deno.env.get("GEMINI_REASONING_MODEL") ||
  "gemini-2.5-flash";

Call:

https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_REASONING_MODEL}:generateContent

Pass the API key through:

x-goog-api-key

Use:

const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_REASONING_MODEL}:generateContent`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY!,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: options.systemPrompt,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: options.userPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens:
          options.maxOutputTokens ?? 4000,
        responseMimeType: options.schema
          ? "application/json"
          : "text/plain",
        ...(options.schema
          ? {
              responseJsonSchema:
                options.schema,
            }
          : {}),
      },
    }),
  }
);

Gemini supports structured outputs using JSON Schema. Use structured output for insights and briefs instead of relying on text parsing.

5. Email classification schema

Groq should classify emails in batches of 10.

Use this structure:

interface EmailClassification {
  id: string;

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

  priority:
    | "High"
    | "Medium"
    | "Low";

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

Return:

interface EmailClassificationResponse {
  emails: EmailClassification[];
}

The classification system prompt must include these instructions:

Classify only from evidence explicitly present in the email.

An unread email does not automatically require a reply.

A promotional call-to-action is not an action item.

A newsletter normally requires no action.

A receipt is not necessarily an unpaid bill.

A shipment advertisement is not a purchase.

Use Needs Reply only when the sender clearly asks the user
to answer, confirm, approve, provide information or make a
decision.

Use Action Required when the user must perform an action but
does not need to respond.

Use Waiting only when another person or organization owes the
user a response, approval, delivery, document or result.

Never invent a due date, amount, meeting, commitment, security
threat or required response.

Return null when a due date is unknown.

Use confidence below 0.6 for ambiguous classifications.
6. Classification input

For every email, provide:

Gmail message ID
Sender name
Sender email
Subject
Snippet
Received date
Gmail labels
Read status
Important status
Text body when available

Rules:

Do not send attachments.
Strip HTML.
Limit body text to 3,000 characters per email.
Do not include token values.
Do not log complete email content.
7. Validate AI responses

Never trust provider JSON directly.

Validate:

const allowedCategories = [
  "Work",
  "Personal",
  "Finance",
  "Purchases",
  "Travel",
  "Newsletter",
  "Security",
  "Calendar",
  "Other",
];

const allowedPriorities = [
  "High",
  "Medium",
  "Low",
];

const allowedStatuses = [
  "Needs Reply",
  "Action Required",
  "Waiting",
  "Information",
  "No Action",
];

Clamp confidence:

confidence = Math.max(
  0,
  Math.min(1, Number(confidence) || 0)
);

Use safe fallback classification when validation fails:

{
  id: email.id,
  category:
    gmailDerivedCategory || "Other",
  priority:
    email.isImportant ? "High" : "Medium",
  status: "Information",
  aiSummary:
    email.snippet || email.subject,
  requiresReply: false,
  actionItems: [],
  dueDate: null,
  confidence: 0,
}
8. Gemini insights

After classification is complete and saved, send Gemini a compact structured dataset rather than raw email bodies.

Include:

{
  id,
  senderName,
  senderEmail,
  subject,
  receivedAt,
  category,
  priority,
  status,
  aiSummary,
  requiresReply,
  actionItems,
  dueDate,
}

Gemini should produce:

interface GeneratedInsights {
  actionItems: Array<{
    text: string;
    from: string;
    priority: "High" | "Medium" | "Low";
    dueDate: string | null;
    emailId: string;
  }>;

  waitingOn: Array<{
    person: string;
    subject: string;
    days: number;
    priority: "High" | "Medium" | "Low";
    emailId: string;
    aiTip: string;
  }>;

  followUps: Array<{
    text: string;
    person: string;
    dueDate: string | null;
    emailId: string;
    status:
      | "overdue"
      | "due_today"
      | "upcoming";
  }>;

  bills: Array<{
    name: string;
    amount: number | null;
    due: string | null;
    category: string;
    status:
      | "overdue"
      | "due_soon"
      | "upcoming"
      | "unknown";
    emailId: string;
  }>;

  calendar: Array<{
    title: string;
    date: string | null;
    time: string | null;
    location: string | null;
    type: string;
    emailId: string;
  }>;

  security: Array<{
    type: string;
    from: string;
    severity:
      | "high"
      | "medium"
      | "low";
    description: string;
    emailId: string;
  }>;

  purchases: Array<{
    item: string;
    from: string;
    amount: number | null;
    date: string | null;
    status:
      | "ordered"
      | "shipped"
      | "delivered"
      | "returned"
      | "unknown";
    emailId: string;
  }>;

  brief: {
    summary: string;
    highlights: string[];
  };
}

Do not allow Gemini to invent information absent from the classifications.

9. Daily brief

Use Gemini for daily brief generation.

Order priorities:

Overdue high-priority actions
High-priority messages requiring a reply
High-priority action-required messages
Meetings and deadlines today
Items waiting longer than three days
Bills due soon
Security alerts

The daily brief should be concise and grounded in stored email records.

10. AI Assistant

Use Gemini as the primary provider for AI chat.

The assistant should receive only the most relevant cached email records.

Do not send the entire inbox on every request.

Retrieve relevant records first using:

sender match
subject match
category
priority
status
recent date
text search

Then send at most 20 relevant email summaries to Gemini.

If Gemini fails, use Groq as fallback.

Return:

{
  reply: string;
  provider: "gemini" | "groq" | "fallback";
  model: string;
  sourcesUsed: number;
}
11. AI status response

Every Gmail sync response must include:

{
  success: true,
  count: number,

  classification: {
    status:
      | "completed"
      | "partial"
      | "failed"
      | "fallback";

    provider:
      | "groq"
      | "gemini"
      | "fallback";

    classifiedCount: number;
    fallbackCount: number;
  },

  insights: {
    status:
      | "completed"
      | "failed"
      | "fallback";

    provider:
      | "gemini"
      | "groq"
      | "fallback";

    ready: boolean;
  },
}
12. Frontend AI status

Add frontend state:

interface AIProcessingStatus {
  classificationStatus:
    | "idle"
    | "running"
    | "completed"
    | "partial"
    | "failed"
    | "fallback";

  classificationProvider:
    | "groq"
    | "gemini"
    | "fallback"
    | null;

  insightsStatus:
    | "idle"
    | "running"
    | "completed"
    | "failed"
    | "fallback";

  insightsProvider:
    | "groq"
    | "gemini"
    | "fallback"
    | null;

  classifiedCount: number;
  fallbackCount: number;
}

Display a small status badge:

AI sorted with Groq
Insights generated with Gemini
AI fallback sorting active
AI processing partially completed
AI processing unavailable

Do not show “AI Live” unless a provider successfully completed the relevant task.

13. Re-run AI sorting

Add a backend route:

POST /ai/reclassify

It must:

Authenticate the Supabase user.
Load that user’s cached emails.
Run Groq classification in batches.
Use Gemini if Groq fails.
Update stored classifications.
Generate fresh Gemini insights.
Return provider and processing status.

Add a frontend button:

Re-run AI sorting

This must not download Gmail again.

14. Re-run insights

Add:

POST /ai/regenerate-insights

It must:

Authenticate the user.
Load classified cached email records.
Generate insights with Gemini.
Use Groq as fallback.
Replace previous insights.
Return provider and completion status.
15. Error normalization

Create:

interface NormalizedAIError {
  type:
    | "quota_exceeded"
    | "rate_limited"
    | "invalid_key"
    | "timeout"
    | "invalid_response"
    | "provider_error"
    | "unknown";

  retryable: boolean;
  safeMessage: string;
}

Detect common HTTP statuses:

401 → invalid_key
429 → quota_exceeded or rate_limited
408/504 → timeout
500/502/503 → provider_error

Never expose raw provider responses containing internal details.

16. Timeouts

Use request timeouts:

const controller = new AbortController();

const timeout = setTimeout(
  () => controller.abort(),
  30_000
);

Clear the timeout after the request.

Use:

30 seconds for classification
45 seconds for insights
45 seconds for assistant chat
17. Logging

Safe logs only:

console.log("InboxOS AI task:", {
  task,
  provider,
  model,
  success,
  fallbackUsed,
  durationMs,
});
console.log("InboxOS classification completed:", {
  emailCount,
  classifiedCount,
  fallbackCount,
  provider,
});

Never log:

API keys
Google tokens
Supabase tokens
full email bodies
entire AI prompts
provider responses containing email content
18. Database metadata

Store AI processing metadata:

{
  ai_provider: "groq" | "gemini" | "fallback",
  ai_model: string,
  ai_confidence: number,
  ai_processed_at: string,
  ai_version: "v2",
}

For insights, store:

{
  insights_provider:
    "gemini" | "groq" | "fallback",
  insights_model: string,
  insights_generated_at: string,
  insights_version: "v2",
}
19. Development cost controls

Add limits:

const MAX_EMAILS_PER_SYNC = 50;
const CLASSIFICATION_BATCH_SIZE = 10;
const MAX_BODY_CHARS = 3000;
const MAX_INSIGHT_EMAILS = 50;
const MAX_CHAT_CONTEXT_EMAILS = 20;

Do not classify unchanged emails repeatedly.

Skip AI processing when an email already has:

ai_version === "v2"

and the Gmail message has not changed.

Gemini currently offers free-tier access for some API models, but quotas and model availability vary. Do not assume unlimited free usage.

Groq also enforces organization-level rate limits, so batching and fallbacks are required.

20. Missing provider behavior

If only Groq is configured:

Classification works with Groq.
Brief and assistant use Groq fallback.
Return provider status honestly.

If only Gemini is configured:

Classification uses Gemini.
Insights and assistant use Gemini.

If neither is configured:

Gmail synchronization must still work.
Use basic Gmail-derived sorting.
Show AI unavailable — using basic sorting.
21. Final verification

Confirm all of the following:

OpenAI is not required.
Groq is primary for classification.
Gemini is primary for insights and chat.
Provider keys never reach the browser.
Gmail sync succeeds even when both AI providers fail.
Every AI result records its provider.
Structured results are validated.
Classification runs in batches.
Existing cached emails can be reclassified.
Insights can be regenerated independently.
Unchanged emails are not repeatedly classified.
The frontend accurately shows which provider was used.
No sensitive data is logged.
TypeScript builds without errors.
Existing authentication and Gmail authorization remain intact.

Apply these changes directly. Do not only explain them.

At the end, summarize:

Provider routing implemented
Groq model used
Gemini model used
Fallback rules
New routes added
Frontend status changes
Database metadata added