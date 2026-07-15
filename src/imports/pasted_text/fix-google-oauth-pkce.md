Fix the Google OAuth PKCE double-exchange error.

The published app now returns from Google successfully and Local Storage contains:

inboxos-supabase-auth

with a valid Supabase session.

However, the app displays:

PKCE code verifier not found in storage

This happens because the Supabase client is configured with:

detectSessionInUrl: true

so Supabase automatically exchanges the returned ?code= for a session, but the top-level App() component also manually calls:

supabase.auth.exchangeCodeForSession(code)

The PKCE code is therefore being exchanged twice. Remove the manual exchange and let the Supabase client handle the callback once.

Do not redesign the application. Preserve all Gmail, inbox, dashboard, AI, synchronization, analytics, search, reply, archive, and Supabase functionality.

1. Keep the Supabase client configuration

In:

src/lib/supabase.ts

Keep a single Supabase client configured like this:

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: "inboxos-supabase-auth",
    },
  }
);

Use the existing project URL/key variable names if they differ.

There must be only one createClient() call.

Keep signInWithGoogle() as a full-page redirect:

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/`;

  try {
    localStorage.setItem("inboxos-storage-test", "working");

    console.log(
      "InboxOS localStorage test:",
      localStorage.getItem("inboxos-storage-test")
    );

    localStorage.removeItem("inboxos-storage-test");
  } catch (error) {
    console.error("InboxOS localStorage unavailable:", error);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
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
    console.error("Google OAuth start failed:", error);
    throw error;
  }

  return data;
}

Do not add:

skipBrowserRedirect
window.open
popup logic
postMessage
BroadcastChannel
2. Remove every manual PKCE code exchange

Search the entire project for:

exchangeCodeForSession

Remove every manual call.

There should be zero occurrences of:

supabase.auth.exchangeCodeForSession(...)

because detectSessionInUrl: true already performs the exchange.

Also remove the code that reads:

const code = url.searchParams.get("code");

for the purpose of exchanging the code.

The app may log that a code exists, but it must never exchange it manually.

3. Replace the top-level App() startup gate

In:

src/app/App.tsx

Replace the current top-level App() component with this implementation:

export default function App() {
  const [authReady, setAuthReady] = React.useState(false);
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    let active = true;

    async function waitForSupabaseInitialization() {
      try {
        const url = new URL(window.location.href);

        console.log("InboxOS OAuth return:", {
          hasCode: url.searchParams.has("code"),
          pathname: url.pathname,
          searchKeys: Array.from(url.searchParams.keys()),
        });

        /*
         * Do not call exchangeCodeForSession here.
         *
         * The Supabase client has detectSessionInUrl: true and will
         * automatically process the PKCE code and persist the session.
         */

        let session = null;

        // Give Supabase's automatic URL detection time to complete.
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const {
            data,
            error,
          } = await supabase.auth.getSession();

          if (error) {
            throw error;
          }

          session = data.session;

          if (session) {
            break;
          }

          await new Promise((resolve) =>
            window.setTimeout(resolve, 100)
          );
        }

        console.log(
          "InboxOS auth startup:",
          session ? "session found" : "no session"
        );

        if (session?.provider_token) {
          localStorage.setItem(
            "inboxos-google-provider-token",
            session.provider_token
          );
        }

        if (session?.provider_refresh_token) {
          localStorage.setItem(
            "inboxos-google-provider-refresh-token",
            session.provider_refresh_token
          );
        }

        /*
         * Remove the OAuth code only after Supabase has initialized.
         * Never remove the code before automatic detection completes.
         */
        if (session && url.searchParams.has("code")) {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      } catch (error) {
        console.error(
          "InboxOS OAuth initialization failed:",
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

    void waitForSupabaseInitialization();

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
        Completing sign-in…
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
            maxWidth: 520,
            textAlign: "center",
          }}
        >
          <h2>Google sign-in failed</h2>
          <p>{authError}</p>

          <button
            onClick={async () => {
              await supabase.auth.signOut();

              localStorage.removeItem(
                "inboxos-supabase-auth"
              );

              localStorage.removeItem(
                "inboxos-google-provider-token"
              );

              localStorage.removeItem(
                "inboxos-google-provider-refresh-token"
              );

              window.history.replaceState(
                {},
                document.title,
                window.location.pathname
              );

              window.location.reload();
            }}
          >
            Reset and try again
          </button>
        </div>
      </div>
    );
  }

  return <MainApp />;
}
4. Keep only one MainApp auth listener

Inside MainApp, keep one authentication effect using:

supabase.auth.getSession()

and one subscription using:

supabase.auth.onAuthStateChange()

Use this implementation:

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

      console.log(
        "InboxOS provider token available:",
        Boolean(providerToken)
      );

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
5. Do not clear the URL too early

Search for every call to:

window.history.replaceState

Ensure no code removes ?code= before Supabase has detected and exchanged it.

The code may be removed only after:

supabase.auth.getSession()

returns a valid session.

6. Final verification

Search the whole project.

This must return zero results:

exchangeCodeForSession
skipBrowserRedirect
window.open(
PopupAuthCallback
INBOXOS_AUTH_COMPLETE
BroadcastChannel
window.opener
/auth/callback

These must exist:

flowType: "pkce"
detectSessionInUrl: true
persistSession: true
storageKey: "inboxos-supabase-auth"
InboxOS auth startup:
InboxOS provider token available:

There must be:

One Supabase client
One getSession() initialization effect in MainApp
One onAuthStateChange() subscription in MainApp
No manual PKCE exchange
No popup authentication code

Check for TypeScript errors, duplicate listeners, invalid hooks, missing imports, and broken braces.

Apply the code changes directly. Do not merely explain them.