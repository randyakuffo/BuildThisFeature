Fix the repeated 401 Unauthorized errors from the Supabase Gmail Edge Function.

Authentication is working. The console shows:

InboxOS Supabase auth event: SIGNED_IN
InboxOS provider token available: true

But requests to:

/gmail/sync

return:

401 Unauthorized

The application is likely using the Google provider token as the Edge Function Authorization header. This is incorrect.

The Supabase Edge Function request must use:

Authorization: Bearer <SUPABASE SESSION ACCESS TOKEN>

The Google OAuth provider token must be passed separately to the function for Gmail API requests.

Do not redesign the application. Preserve all dashboard, Gmail, inbox, AI, analytics, search, reply, archive, and synchronization functionality.

Part 1: Fix syncGmail() in src/lib/supabase.ts

Find the existing syncGmail() function.

It currently receives values similar to:

syncGmail(providerToken, userId)

Update it so it retrieves the current Supabase session first:

export async function syncGmail(
  googleProviderToken: string,
  userId: string
) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error(
      "No Supabase session access token is available."
    );
  }

  if (!googleProviderToken) {
    throw new Error(
      "No Google provider token is available."
    );
  }

  console.log("InboxOS Gmail sync credentials:", {
    hasSupabaseSessionToken: Boolean(session.access_token),
    hasGoogleProviderToken: Boolean(googleProviderToken),
    userIdAvailable: Boolean(userId),
  });

  const { data, error } = await supabase.functions.invoke(
    "server",
    {
      body: {
        action: "gmail-sync",
        userId,
        googleProviderToken,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  if (error) {
    console.error("InboxOS Gmail sync function error:", {
      message: error.message,
      name: error.name,
      context: error.context,
    });

    throw error;
  }

  return data;
}

Adapt the function name and route to the project’s existing Edge Function setup.

If the current code uses a direct fetch() call to a URL ending in:

/gmail/sync

use this pattern instead:

export async function syncGmail(
  googleProviderToken: string,
  userId: string
) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error(
      "No Supabase session access token is available."
    );
  }

  if (!googleProviderToken) {
    throw new Error(
      "No Google provider token is available."
    );
  }

  const response = await fetch(
    `${SUPABASE_FUNCTION_URL}/gmail/sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",

        // Supabase user JWT for the Edge Function gateway.
        Authorization: `Bearer ${session.access_token}`,

        // Required by Supabase when using direct fetch.
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        userId,
        googleProviderToken,
      }),
    }
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("InboxOS Gmail sync HTTP failure:", {
      status: response.status,
      statusText: response.statusText,
      result,
    });

    throw new Error(
      result?.error ||
      result?.message ||
      `Gmail sync failed with status ${response.status}.`
    );
  }

  return result;
}

Use the project’s existing Supabase URL, publishable/anon key, and function URL variable names.

Part 2: Never use the Google token as the Edge Function Authorization header

Search the entire project for code similar to:

Authorization: `Bearer ${googleProviderToken}`

or:

Authorization: `Bearer ${accessToken}`

inside requests to Supabase Edge Functions.

For calls to Supabase Edge Functions, replace it with:

Authorization: `Bearer ${session.access_token}`

The Google provider token should only be:

placed in the JSON request body, or
placed in a custom header such as X-Google-Access-Token

Preferred body format:

body: {
  userId,
  googleProviderToken,
}

Do not put the Google provider token in the standard Authorization header of the Edge Function request.

Part 3: Update the Edge Function request parsing

In the Supabase Edge Function, likely located at:

supabase/functions/server/index.tsx

find the Gmail sync handler.

Read the Google token from the JSON body:

const body = await req.json();

const {
  userId,
  googleProviderToken,
} = body;

Validate it:

if (!googleProviderToken) {
  return new Response(
    JSON.stringify({
      error: "Google provider token is missing.",
    }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

Use the Google provider token only when calling Gmail:

const gmailResponse = await fetch(
  "https://gmail.googleapis.com/gmail/v1/users/me/messages",
  {
    headers: {
      Authorization: `Bearer ${googleProviderToken}`,
    },
  }
);

Gmail returns 401 when the request does not contain a valid Google access token.

Part 4: Authenticate the Supabase user inside the Edge Function

At the start of the Edge Function handler, validate the Supabase JWT from the incoming request.

Use:

const authHeader = req.headers.get("Authorization");

if (!authHeader) {
  return new Response(
    JSON.stringify({
      error: "Missing Supabase authorization header.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

Create a Supabase client using the incoming authorization header:

const supabaseUserClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  }
);

Then verify the caller:

const {
  data: { user },
  error: userError,
} = await supabaseUserClient.auth.getUser();

if (userError || !user) {
  return new Response(
    JSON.stringify({
      error: "Invalid Supabase user session.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

Use:

user.id

as the trusted user ID instead of blindly trusting the userId sent from the browser.

If the body includes a userId, verify it matches:

if (userId && userId !== user.id) {
  return new Response(
    JSON.stringify({
      error: "User ID does not match authenticated session.",
    }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
Part 5: Ensure CORS allows the required headers

The Edge Function CORS headers must include:

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, GET, OPTIONS",
};

Handle preflight requests:

if (req.method === "OPTIONS") {
  return new Response("ok", {
    headers: corsHeaders,
  });
}

Include corsHeaders on every success and error response.

Part 6: Improve frontend error reporting

In syncInbox() inside src/app/App.tsx, do not silently switch to the ready state after a failed sync.

Use:

const syncInbox = async (
  userId: string,
  googleProviderToken: string
) => {
  if (!googleProviderToken) {
    console.error(
      "InboxOS Gmail sync blocked: provider token missing."
    );

    setAppState("error");
    return;
  }

  setSyncing(true);

  try {
    const result = await syncGmail(
      googleProviderToken,
      userId
    );

    console.log("InboxOS Gmail sync response:", {
      success: result?.success,
      count: result?.count,
      error: result?.error,
    });

    if (!result?.success) {
      throw new Error(
        result?.error ||
        "Gmail synchronization did not succeed."
      );
    }

    const fresh = await getCachedEmails(userId);

    setEmails(fresh.emails || []);
    setStats(
      fresh.stats || {
        total: 0,
        unread: 0,
        important: 0,
        needsReply: 0,
        byCategory: {},
      }
    );

    setLastSync(
      fresh.lastSync || new Date().toISOString()
    );

    const newInsights = await getInsights(userId);
    setInsights(newInsights);

    void loadBrief(userId);

    setAppState("ready");
  } catch (error: any) {
    console.error("InboxOS Gmail sync failed:", {
      message: error?.message,
      name: error?.name,
      status: error?.status,
      context: error?.context,
    });

    setAppState("error");
  } finally {
    setSyncing(false);
  }
};
Part 7: Add a visible error/reconnect screen

When:

appState === "error"

show a clear message rather than an empty dashboard:

if (appState === "error") {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Gmail could not be loaded
        </h2>

        <p className="text-sm text-gray-500 mb-5">
          Your Google account is connected, but InboxOS could
          not reach the Gmail synchronization service.
        </p>

        <div className="flex justify-center gap-3">
          <button
            onClick={handleSync}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white"
          >
            Try Again
          </button>

          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-xl border border-gray-200"
          >
            Reconnect Google
          </button>
        </div>
      </div>
    </div>
  );
}
Part 8: Verify the route name

The screenshot shows calls ending in:

/gmail/sync

Confirm that the deployed Edge Function actually exposes this route.

Search the server code for:

gmail/sync

and verify the frontend path exactly matches the server route.

For example, if the server expects:

/gmail-sync

but the frontend calls:

/gmail/sync

correct the mismatch.

Part 9: Final verification

Search the project for Edge Function calls.

For every Supabase function request:

Authorization

must contain the Supabase session access token.

For every Gmail API request:

Authorization

must contain the Google provider token.

Expected separation:

// Browser → Supabase Edge Function
Authorization: `Bearer ${session.access_token}`

// Edge Function → Gmail API
Authorization: `Bearer ${googleProviderToken}`

Never log either token.

Add these safe logs:

console.log("InboxOS Edge Function auth:", {
  hasSupabaseJwt: Boolean(session?.access_token),
  hasGoogleProviderToken: Boolean(googleProviderToken),
});
console.log("InboxOS Gmail handler:", {
  authenticatedUser: Boolean(user),
  hasGoogleProviderToken: Boolean(googleProviderToken),
});

After editing, check for TypeScript errors, duplicate functions, mismatched route names, and broken imports.

Apply the changes directly. Do not only explain them.