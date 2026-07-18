import React, { useEffect, useState } from "react";
import { supabase, storeGoogleTokens } from "../lib/supabase";
import { MainApp } from "./MainApp";

export function AppStartup() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;

    async function waitForSupabaseInitialization() {
      try {
        const url = new URL(window.location.href);

        console.log("InboxOS OAuth return:", {
          hasCode: url.searchParams.has("code"),
          pathname: url.pathname,
          searchKeys: Array.from(url.searchParams.keys()),
        });

        let session = null;

        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();

          if (error) {
            throw error;
          }

          session = data.session;

          if (session) {
            break;
          }

          await new Promise((resolve) => window.setTimeout(resolve, 100));
        }

        console.log("InboxOS auth startup:", session ? "session found" : "no session");

        if (session?.provider_token) {
          await storeGoogleTokens(session.provider_token, session.provider_refresh_token ?? null);
        }

        if (session && url.searchParams.has("code")) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (error) {
        console.error("InboxOS OAuth initialization failed:", error);

        if (active) {
          setAuthError(error instanceof Error ? error.message : "Authentication failed.");
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", color: "#334155", fontFamily: "system-ui" }}>
        Completing sign-in…
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#F8FAFC", fontFamily: "system-ui" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h2>Google sign-in failed</h2>
          <p>{authError}</p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem("inboxos-supabase-auth");
              window.history.replaceState({}, document.title, window.location.pathname);
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
