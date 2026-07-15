Fix the Google OAuth authentication flow in this project. The current implementation successfully authenticates with Google and Supabase, but after redirecting back to the published site, the app returns to the “Continue with Google” screen instead of loading the authenticated dashboard.

The published site is:

https://bee-skirr-52651902.figma.site/

The Supabase project callback is:

https://kkveffyelwdenrlzymip.supabase.co/auth/v1/callback

Do not redesign the UI. Preserve all existing inbox, Gmail, dashboard, synchronization, AI, analytics, email reply, archive, search, and Supabase functionality.

Files to modify

Modify only these existing files unless another file is absolutely required:

src/lib/supabase.ts
src/app/App.tsx
Part 1: Remove the popup authentication flow completely

Search the entire project and remove all custom popup OAuth logic, including any code that contains or uses:

skipBrowserRedirect
window.open
PopupAuthCallback
INBOXOS_AUTH_COMPLETE
INBOXOS_AUTH_ERROR
INBOXOS_AUTH_RESULT
INBOXOS_AUTH_TOKENS
BroadcastChannel
window.opener
postMessage
popup polling
popup.closed
/auth/callback

There must be no popup window and no popup-to-main-window handoff.

Google OAuth must use a full-page browser redirect.

Part 2: Replace signInWithGoogle() in src/lib/supabase.ts

Replace the existing signInWithGoogle() implementation with a full-page Supabase OAuth redirect.

Use this implementation:

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.send",
      ].join(" "),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    throw error;
  }
}

Important:

Do not use skipBrowserRedirect.
Do not use window.open.
Do not return a popup.
Do not redirect to /auth/callback.
Redirect only to:
`${window.location.origin}/`
Part 3: Add an OAuth startup gate before MainApp

In src/app/App.tsx, remove the existing popup callback component and replace the top-level App component with an authentication startup processor.

The app must process Supabase OAuth tokens before rendering MainApp.

Use this structure:

export default function App() {
  const [authReady, setAuthReady] = React.useState(false);
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    let active = true;

    async function processOAuthReturn() {
      try {
        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/, "")
        );

        const queryParams = new URLSearchParams(
          window.location.search
        );

        const returnedError =
          hashParams.get("error_description") ||
          hashParams.get("error") ||
          queryParams.get("error_description") ||
          queryParams.get("error");

        if (returnedError) {
          throw new Error(returnedError);
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const providerToken = hashParams.get("provider_token");
        const providerRefreshToken =
          hashParams.get("provider_refresh_token");

        const code = queryParams.get("code");

        if (code) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          if (!data.session) {
            throw new Error(
              "Supabase did not create a session from the OAuth code."
            );
          }

          if (data.session.provider_token) {
            localStorage.setItem(
              "inboxos-google-provider-token",
              data.session.provider_token
            );
          }

          if (data.session.provider_refresh_token) {
            localStorage.setItem(
              "inboxos-google-provider-refresh-token",
              data.session.provider_refresh_token
            );
          }
        } else if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          if (!data.session) {
            throw new Error(
              "Supabase did not create a session from the returned tokens."
            );
          }

          if (providerToken) {
            localStorage.setItem(
              "inboxos-google-provider-token",
              providerToken
            );
          }

          if (providerRefreshToken) {
            localStorage.setItem(
              "inboxos-google-provider-refresh-token",
              providerRefreshToken
            );
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        console.log(
          "InboxOS auth startup:",
          session ? "session found" : "no session"
        );

        if (
          window.location.hash ||
          window.location.search.includes("code=") ||
          window.location.search.includes("error=")
        ) {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      } catch (error) {
        console.error(
          "InboxOS OAuth startup processing failed:",
          error
        );

        if (active) {
          setAuthError(
            error instanceof Error
              ? error.message
              : "Authentication failed."
          );
        }
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    }

    processOAuthReturn();

    return () => {
      active = false;
    };
  }, []);

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8FAFC",
          color: "#334155",
          fontFamily: "system-ui",
        }}
      >
        <p>Completing sign-in…</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#F8FAFC",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            textAlign: "center",
          }}
        >
          <h2>Google sign-in failed</h2>
          <p>{authError}</p>

          <button
            onClick={() => {
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname
              );

              window.location.reload();
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <MainApp />;
}

Important:

Do not render MainApp until OAuth startup processing finishes.
Do not show the login screen while returned OAuth tokens are still being processed.
Support both Supabase implicit hash tokens and PKCE query-code callbacks.
Remove access tokens from the browser URL after processing them.
Store the Google provider token separately because Gmail API calls require the Google provider token, not the Supabase access token.
Part 4: Replace the authentication initialization inside MainApp

In MainApp, find the existing authentication useEffect that calls:

supabase.auth.getSession()

and:

supabase.auth.onAuthStateChange()

Replace that entire effect with the following logic:

useEffect(() => {
  let mounted = true;
  let activatingUserId = "";

  async function activateSession(session: any) {
    if (!mounted || !session?.user) {
      return;
    }

    if (activatingUserId === session.user.id) {
      return;
    }

    activatingUserId = session.user.id;

    try {
      const providerToken =
        session.provider_token ||
        localStorage.getItem(
          "inboxos-google-provider-token"
        ) ||
        "";

      if (session.provider_token) {
        localStorage.setItem(
          "inboxos-google-provider-token",
          session.provider_token
        );
      }

      if (session.provider_refresh_token) {
        localStorage.setItem(
          "inboxos-google-provider-refresh-token",
          session.provider_refresh_token
        );
      }

      setUser(session.user);
      setAccessToken(providerToken);

      await loadData(
        session.user.id,
        providerToken
      );
    } catch (error) {
      console.error(
        "Failed to activate authenticated session:",
        error
      );

      if (mounted) {
        setAppState("error");
      }
    } finally {
      activatingUserId = "";
    }
  }

  async function initializeAuth() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (!mounted) {
        return;
      }

      if (session) {
        await activateSession(session);
      } else {
        setAppState("unauthenticated");
      }
    } catch (error) {
      console.error(
        "Auth initialization failed:",
        error
      );

      if (mounted) {
        setAppState("unauthenticated");
      }
    }
  }

  void initializeAuth();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(
    (event, session) => {
      console.log(
        "InboxOS Supabase auth event:",
        event
      );

      if (!mounted) {
        return;
      }

      if (session) {
        void activateSession(session);
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setAccessToken("");
        setAppState("unauthenticated");
      }
    }
  );

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);

Important:

There must be only one getSession() initialization effect in MainApp.
There must be only one onAuthStateChange() subscription.
Do not add duplicate auth listeners.
Do not await directly inside the onAuthStateChange callback.
Use void activateSession(session) from the listener.
Use the stored provider token when session.provider_token is missing after a page reload.
Part 5: Update handleSignIn

The login button handler must use full-page redirect behavior.

Replace the current handleSignIn with:

const handleSignIn = async () => {
  setLoading(true);
  setError("");

  try {
    await signInWithGoogle();
  } catch (error: any) {
    console.error(
      "Google sign-in failed:",
      error
    );

    setError(
      error?.message ||
      "Google sign-in failed. Please try again."
    );

    setLoading(false);
  }
};

Do not add popup polling or popup-close detection.

Part 6: Update handleSignOut

Update sign-out so stored Google tokens are removed:

const handleSignOut = async () => {
  localStorage.removeItem(
    "inboxos-google-provider-token"
  );

  localStorage.removeItem(
    "inboxos-google-provider-refresh-token"
  );

  await signOut();

  setUser(null);
  setAccessToken("");
  setEmails([]);

  setStats({
    total: 0,
    unread: 0,
    important: 0,
    needsReply: 0,
    byCategory: {},
  });

  setInsights({
    actionItems: [],
    waitingOn: [],
    bills: [],
    followUps: [],
    calendar: [],
    security: [],
    purchases: [],
    brief: [],
  });

  setBrief(null);
  setAppState("unauthenticated");
};
Part 7: Preserve Gmail provider-token usage

The app currently passes accessToken into Gmail-related functions such as:

syncGmail
archiveEmail
markAsRead
searchEmails
sendReply

The accessToken state must contain the Google OAuth provider token.

It must not contain the Supabase session access token.

Use:

session.provider_token

or:

localStorage.getItem(
  "inboxos-google-provider-token"
)

for Gmail operations.

Part 8: Avoid showing login too early

The app must follow this order:

1. Page loads
2. Top-level App processes OAuth URL tokens
3. Supabase session is created or restored
4. OAuth tokens are removed from the URL
5. MainApp renders
6. MainApp calls getSession
7. Authenticated user is loaded
8. Existing loadData function runs
9. Dashboard or syncing screen appears

The login screen must only appear when:

supabase.auth.getSession()

has completed and returned no session.

Part 9: Add useful debug logs

Keep these console logs:

console.log(
  "InboxOS auth startup:",
  session ? "session found" : "no session"
);
console.log(
  "InboxOS Supabase auth event:",
  event
);
console.log(
  "InboxOS provider token available:",
  Boolean(providerToken)
);

Add the provider-token log inside activateSession.

Never log the actual access token, refresh token, or provider token.

Part 10: Final verification

After editing, search the entire project for these values:

skipBrowserRedirect
window.open(
PopupAuthCallback
INBOXOS_AUTH_COMPLETE
INBOXOS_AUTH_ERROR
BroadcastChannel
window.opener
/auth/callback

All must return zero results.

Then search for:

supabase.auth.setSession
supabase.auth.exchangeCodeForSession
inboxos-google-provider-token
InboxOS auth startup:
InboxOS Supabase auth event:

These must exist.

Check for TypeScript errors, duplicate functions, duplicate auth listeners, broken imports, missing braces, and invalid React hook usage.

Do not stop after explaining the changes. Apply the changes directly to the project code.

Do not redesign the application.

Do not create placeholder components.

Do not remove any existing functionality.

After completing the changes, summarize exactly what was changed in:

src/lib/supabase.ts
src/app/App.tsx