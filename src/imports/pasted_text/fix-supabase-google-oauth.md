Fix the Supabase Google OAuth session persistence issue.

Google authentication succeeds, but after returning to the published site, the URL is only:

https://bee-skirr-52651902.figma.site/

There is no hash, no query code, no Supabase session, and Local Storage is empty.

The current implicit OAuth flow is not surviving the Figma-hosted redirect. Change the Supabase client to use PKCE so the OAuth result returns as ?code=... instead of #access_token=....

Do not redesign the application or remove existing Gmail, inbox, AI, dashboard, sync, search, reply, archive, analytics, or Supabase functionality.

1. Update the Supabase client initialization

In:

src/lib/supabase.ts

Find the existing createClient() call.

Replace it with a single exported Supabase client configured exactly like this, while preserving the existing Supabase URL and anon/publishable key variables:

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

Use the actual existing environment variable or constant names if they are not named SUPABASE_URL and SUPABASE_ANON_KEY.

There must be only one createClient() call and only one exported Supabase client.

Do not create a second client.

Supabase documents persistSession, autoRefreshToken, and detectSessionInUrl as supported browser-client authentication options.

2. Replace signInWithGoogle()

Use PKCE with a full-page redirect:

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/`;

  console.log("Starting Google OAuth:", {
    redirectTo,
    flowType: "pkce",
  });

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

Do not use:

skipBrowserRedirect
window.open
PopupAuthCallback
BroadcastChannel
postMessage
window.opener
#access_token parsing
/auth/callback
3. Simplify the top-level App startup gate

In:

src/app/App.tsx

The top-level App() must process only the PKCE code query parameter.

Replace the current top-level OAuth startup processor with:

export default function App() {
  const [authReady, setAuthReady] = React.useState(false);
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    let active = true;

    async function initializeOAuth() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        console.log("InboxOS OAuth return:", {
          hasCode: Boolean(code),
          pathname: url.pathname,
          searchKeys: Array.from(url.searchParams.keys()),
        });

        if (code) {
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          if (!data.session) {
            throw new Error(
              "PKCE code exchange completed without a Supabase session."
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

          console.log(
            "InboxOS PKCE exchange successful:",
            Boolean(data.session)
          );

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
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

    void initializeOAuth();

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
          fontFamily: "system-ui",
          background: "#F8FAFC",
          color: "#334155",
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
          fontFamily: "system-ui",
          background: "#F8FAFC",
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h2>Google sign-in failed</h2>
          <p>{authError}</p>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem(
                "inboxos-supabase-auth"
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

exchangeCodeForSession() is the supported Supabase method for exchanging a PKCE authorization code for a session.

4. Keep MainApp session initialization

Keep only one getSession() call and one onAuthStateChange() subscription.

When a session exists:

const providerToken =
  session.provider_token ||
  localStorage.getItem(
    "inboxos-google-provider-token"
  ) ||
  "";

setUser(session.user);
setAccessToken(providerToken);

await loadData(
  session.user.id,
  providerToken
);

When the auth event is INITIAL_SESSION and the session is null, show the login screen.

When the auth event is SIGNED_IN, activate the session.

Do not create duplicate listeners.

5. Add PKCE diagnostics

Immediately before calling signInWithOAuth(), log whether the browser has working storage:

try {
  localStorage.setItem(
    "inboxos-storage-test",
    "working"
  );

  console.log(
    "InboxOS localStorage test:",
    localStorage.getItem(
      "inboxos-storage-test"
    )
  );

  localStorage.removeItem(
    "inboxos-storage-test"
  );
} catch (error) {
  console.error(
    "InboxOS localStorage unavailable:",
    error
  );
}

Never log any real access token, refresh token, provider token, authorization code, or code verifier.

6. Final code verification

Search the whole project.

These must return zero results:

skipBrowserRedirect
window.open(
PopupAuthCallback
INBOXOS_AUTH_COMPLETE
BroadcastChannel
window.opener
/auth/callback
flowType: "implicit"

These must exist:

flowType: "pkce"
persistSession: true
detectSessionInUrl: true
storageKey: "inboxos-supabase-auth"
exchangeCodeForSession
InboxOS OAuth return:
InboxOS PKCE exchange successful:

Check for TypeScript errors and ensure there is only one Supabase client.

Apply the changes directly. Do not merely explain them