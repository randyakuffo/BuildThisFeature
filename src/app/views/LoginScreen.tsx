import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { signInWithGoogle } from "../../lib/supabase";
import { Spinner } from "../components/primitives";

export function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const isConfigError = error.includes("not enabled") || error.includes("OAuth") || error.includes("configured");

  const handleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Google sign-in failed:", error);
      setError(error?.message || "Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0D0F1A] flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>InboxOS</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Your AI Command Center for Email</p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {[
            { icon: "✦", label: "AI Summaries" },
            { icon: "⚡", label: "Smart Triage" },
            { icon: "🔒", label: "Secure OAuth" },
          ].map((f) => (
            <div key={f.label} className="bg-white dark:bg-[#161928] rounded-xl p-3 text-center border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="text-base mb-0.5">{f.icon}</div>
              <p className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">{f.label}</p>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className={`mb-4 p-3 rounded-xl text-sm text-left ${isConfigError ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"}`}>
            {error}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-slate-200 font-semibold py-3.5 px-5 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 mb-3"
        >
          {loading ? <Spinner className="w-5 h-5" /> : (
            <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "Connecting…" : "Continue with Google"}
        </button>

        <p className="text-center text-[11px] text-gray-400 dark:text-slate-600 mb-6">
          Secured by Google OAuth 2.0 · No passwords stored
        </p>

        {/* Developer setup — collapsed, only relevant for app owner */}
        <div className="border-t border-gray-100 dark:border-white/5 pt-4">
          <button
            onClick={() => setShowSetup(!showSetup)}
            className="w-full flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            <span>App owner setup guide</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSetup ? "rotate-180" : ""}`} />
          </button>

          {showSetup && (
            <div className="mt-3 text-xs space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5 text-gray-600 dark:text-slate-400">
                <p className="font-semibold text-gray-800 dark:text-slate-200 mb-1">One-time setup — regular users just click the button above.</p>
                <p className="mb-3 text-[11px]">Think of it like how Notion set up Google login once for all their users. Only you (the app owner) does this.</p>

                <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Step 1 — Google Cloud Console</p>
                <ol className="list-decimal list-inside space-y-1 mb-3">
                  <li>Go to <strong>console.cloud.google.com</strong> → create or select a project</li>
                  <li>APIs & Services → Library → search <strong>Gmail API</strong> → Enable</li>
                  <li>Credentials → Create Credentials → <strong>OAuth 2.0 Client ID</strong> → Web application</li>
                  <li>Add authorized redirect URI:<br/>
                    <code className="block mt-1 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] break-all">https://kkveffyelwdenrlzymip.supabase.co/auth/v1/callback</code>
                  </li>
                  <li>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                </ol>

                <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Step 2 — Supabase Dashboard</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Supabase Dashboard → Authentication → Providers → <strong>Google</strong></li>
                  <li>Toggle Enable, paste Client ID + Client Secret → <strong>Save</strong></li>
                  <li className="text-[10px] text-indigo-500 dark:text-indigo-400 list-none mt-1">✓ No extra scopes needed — the app requests Gmail access automatically</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5 text-gray-600 dark:text-slate-400">
                <p className="font-semibold text-gray-700 dark:text-slate-300 mb-1">Step 3 — AI Features (optional)</p>
                <p>Add <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">OPENAI_API_KEY</code> in Make Settings → Secrets to enable AI summaries, briefings, and assistant chat.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

