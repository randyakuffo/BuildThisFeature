import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { signInWithGoogle } from "../../lib/supabase";
import { Spinner } from "../components/primitives";

function FloatingInboxArt() {
  return (
    <div className="login-art" aria-hidden="true">
      <div className="login-art__glow" />
      <svg
        className="login-art__svg"
        viewBox="0 0 520 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Back envelope */}
        <g className="login-art__env login-art__env--a">
          <rect x="70" y="120" width="280" height="190" rx="18" fill="#F7FFFB" stroke="#0D3B36" strokeWidth="3" />
          <path d="M70 148 L210 248 L350 148" stroke="#0D3B36" strokeWidth="3" strokeLinejoin="round" />
          <rect x="98" y="262" width="120" height="12" rx="6" fill="#B8E600" />
          <rect x="98" y="286" width="78" height="10" rx="5" fill="#9FD4C8" />
        </g>

        {/* Mid envelope */}
        <g className="login-art__env login-art__env--b">
          <rect x="160" y="180" width="290" height="200" rx="18" fill="#FFFFFF" stroke="#0D3B36" strokeWidth="3" />
          <path d="M160 210 L305 318 L450 210" stroke="#0D3B36" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="400" cy="250" r="28" fill="#FF5A5F" />
          <path d="M400 236 V264 M386 250 H414" stroke="white" strokeWidth="4" strokeLinecap="round" />
          <rect x="192" y="328" width="140" height="12" rx="6" fill="#0D3B36" opacity="0.18" />
          <rect x="192" y="350" width="96" height="10" rx="5" fill="#0D3B36" opacity="0.12" />
        </g>

        {/* Front card — triage chip */}
        <g className="login-art__env login-art__env--c">
          <rect x="40" y="300" width="240" height="120" rx="20" fill="#0D3B36" />
          <text x="68" y="348" fill="#B8E600" fontFamily="Syne, sans-serif" fontSize="22" fontWeight="700">
            12 sorted
          </text>
          <text x="68" y="380" fill="#E8F4F0" fontFamily="DM Sans, sans-serif" fontSize="16" fontWeight="500">
            while you slept
          </text>
          <circle cx="236" cy="360" r="18" fill="#B8E600" />
          <path d="M228 360 L234 366 L246 352" stroke="#0D3B36" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Orbiting stamp */}
        <g className="login-art__stamp">
          <circle cx="455" cy="120" r="42" fill="#FF5A5F" />
          <text
            x="455"
            y="126"
            textAnchor="middle"
            fill="white"
            fontFamily="Syne, sans-serif"
            fontSize="15"
            fontWeight="800"
          >
            AI
          </text>
        </g>
      </svg>
    </div>
  );
}

export function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSetup, setShowSetup] = useState(false);

  const isConfigError =
    error.includes("not enabled") || error.includes("OAuth") || error.includes("configured");

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
    <div className="login-page">
      <style>{`
        .login-page {
          --ink: #0D3B36;
          --mist: #E8F7F4;
          --sky: #D4EBF8;
          --citrus: #B8E600;
          --coral: #FF5A5F;
          --paper: #F7FFFB;
          --body: "DM Sans", system-ui, sans-serif;
          --display: "Syne", system-ui, sans-serif;
          min-height: 100vh;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: clamp(1.25rem, 4vw, 2.5rem);
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(1200px 700px at 85% 20%, rgba(184, 230, 0, 0.28), transparent 55%),
            radial-gradient(900px 600px at 10% 80%, rgba(255, 90, 95, 0.16), transparent 50%),
            linear-gradient(145deg, var(--mist) 0%, var(--sky) 48%, #F0FFF8 100%);
          color: var(--ink);
          font-family: var(--body);
        }

        .login-page::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(13, 59, 54, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(13, 59, 54, 0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 20%, transparent 75%);
          pointer-events: none;
        }

        .login-shell {
          position: relative;
          z-index: 1;
          width: min(1080px, 100%);
          display: grid;
          grid-template-columns: 1fr;
          gap: clamp(1.5rem, 4vw, 2.5rem);
          align-items: center;
        }

        @media (min-width: 900px) {
          .login-shell {
            grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
            gap: 1rem 3rem;
          }
        }

        .login-copy {
          max-width: 34rem;
          animation: login-rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .login-brand {
          font-family: var(--display);
          font-weight: 800;
          font-size: clamp(3.4rem, 9vw, 5.6rem);
          line-height: 0.92;
          letter-spacing: -0.04em;
          margin: 0 0 1.1rem;
          color: var(--ink);
        }

        .login-brand span {
          display: inline-block;
          background: linear-gradient(120deg, var(--ink) 40%, #167A6E 70%, #8DB800 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .login-headline {
          font-family: var(--display);
          font-weight: 700;
          font-size: clamp(1.35rem, 3.2vw, 1.85rem);
          line-height: 1.2;
          letter-spacing: -0.02em;
          margin: 0 0 0.75rem;
          max-width: 18ch;
        }

        .login-sub {
          margin: 0 0 1.75rem;
          font-size: 1.05rem;
          line-height: 1.55;
          color: rgba(13, 59, 54, 0.72);
          max-width: 34ch;
        }

        .login-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          min-height: 3.35rem;
          padding: 0.85rem 1.35rem;
          border: 2px solid var(--ink);
          border-radius: 1rem;
          background: var(--paper);
          color: var(--ink);
          font-family: var(--body);
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 180ms ease, background 180ms ease, box-shadow 180ms ease;
          box-shadow: 4px 4px 0 var(--ink);
        }

        .login-cta:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          background: var(--citrus);
          box-shadow: 6px 6px 0 var(--ink);
        }

        .login-cta:active:not(:disabled) {
          transform: translate(2px, 2px);
          box-shadow: 1px 1px 0 var(--ink);
        }

        .login-cta:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .login-note {
          margin: 0.85rem 0 0;
          font-size: 0.78rem;
          color: rgba(13, 59, 54, 0.5);
        }

        .login-error {
          margin: 0 0 1rem;
          padding: 0.85rem 1rem;
          border-radius: 0.85rem;
          font-size: 0.9rem;
          border: 1.5px solid transparent;
        }

        .login-error--config {
          background: rgba(184, 230, 0, 0.2);
          border-color: rgba(13, 59, 54, 0.2);
          color: var(--ink);
        }

        .login-error--fatal {
          background: rgba(255, 90, 95, 0.12);
          border-color: rgba(255, 90, 95, 0.35);
          color: #A01D22;
        }

        .login-art {
          position: relative;
          width: min(100%, 480px);
          margin-inline: auto;
          aspect-ratio: 1;
          animation: login-rise 900ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .login-art__glow {
          position: absolute;
          inset: 12% 10%;
          background: radial-gradient(circle, rgba(184, 230, 0, 0.35), transparent 68%);
          filter: blur(8px);
          animation: login-pulse 4.5s ease-in-out infinite;
        }

        .login-art__svg {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .login-art__env--a {
          transform-origin: 210px 215px;
          animation: login-float-a 5.5s ease-in-out infinite;
        }

        .login-art__env--b {
          transform-origin: 305px 280px;
          animation: login-float-b 6.2s ease-in-out infinite;
        }

        .login-art__env--c {
          transform-origin: 160px 360px;
          animation: login-float-c 4.8s ease-in-out infinite;
        }

        .login-art__stamp {
          transform-origin: 455px 120px;
          animation: login-orbit 7s ease-in-out infinite;
        }

        .login-setup {
          grid-column: 1 / -1;
          width: min(34rem, 100%);
          margin-top: 0.25rem;
          animation: login-rise 800ms 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .login-setup__toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.35rem 0;
          border: 0;
          background: transparent;
          color: rgba(13, 59, 54, 0.55);
          font: inherit;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .login-setup__toggle:hover {
          color: var(--ink);
        }

        .login-setup__chevron {
          transition: transform 200ms ease;
        }

        .login-setup__chevron.is-open {
          transform: rotate(180deg);
        }

        .login-setup__panel {
          margin-top: 0.75rem;
          display: grid;
          gap: 0.75rem;
          font-size: 0.78rem;
          line-height: 1.5;
          color: rgba(13, 59, 54, 0.72);
        }

        .login-setup__panel > div {
          padding: 0.9rem 1rem;
          border: 1.5px solid rgba(13, 59, 54, 0.12);
          border-radius: 0.9rem;
          background: rgba(247, 255, 251, 0.72);
          backdrop-filter: blur(6px);
        }

        .login-setup__panel strong {
          color: var(--ink);
        }

        .login-setup__panel code {
          display: inline-block;
          margin-top: 0.25rem;
          padding: 0.15rem 0.4rem;
          border-radius: 0.35rem;
          background: rgba(13, 59, 54, 0.08);
          font-size: 0.7rem;
          word-break: break-all;
        }

        .login-setup__hint {
          color: #167A6E;
          font-size: 0.72rem;
          list-style: none;
          margin-top: 0.35rem;
        }

        @keyframes login-rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes login-float-a {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-14px) rotate(1deg); }
        }

        @keyframes login-float-b {
          0%, 100% { transform: translateY(0) rotate(2deg); }
          50% { transform: translateY(-18px) rotate(-1.5deg); }
        }

        @keyframes login-float-c {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }

        @keyframes login-orbit {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-8px, 12px) rotate(8deg); }
        }

        @keyframes login-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-copy,
          .login-art,
          .login-setup,
          .login-art__env--a,
          .login-art__env--b,
          .login-art__env--c,
          .login-art__stamp,
          .login-art__glow {
            animation: none !important;
          }
        }
      `}</style>

      <div className="login-shell">
        <div className="login-copy">
          <h1 className="login-brand">
            <span>InboxOS</span>
          </h1>
          <p className="login-headline">Your inbox, finally on your side.</p>
          <p className="login-sub">
            Connect Gmail and let AI triage the chaos into actions, bills, and follow-ups.
          </p>

          {error && (
            <div className={`login-error ${isConfigError ? "login-error--config" : "login-error--fatal"}`}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="login-cta"
          >
            {loading ? (
              <Spinner className="w-5 h-5" />
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? "Connecting…" : "Continue with Google"}
          </button>
          <p className="login-note">Secured by Google OAuth 2.0 · No passwords stored</p>
        </div>

        <FloatingInboxArt />

        <div className="login-setup">
          <button
            type="button"
            onClick={() => setShowSetup(!showSetup)}
            className="login-setup__toggle"
            aria-expanded={showSetup}
          >
            <span>App owner setup guide</span>
            <ChevronDown className={`w-3.5 h-3.5 login-setup__chevron ${showSetup ? "is-open" : ""}`} />
          </button>

          {showSetup && (
            <div className="login-setup__panel">
              <div>
                <p className="font-semibold text-[0.85rem] mb-1" style={{ color: "var(--ink)" }}>
                  One-time setup — regular users just click the button above.
                </p>
                <p className="mb-3">
                  Think of it like how Notion set up Google login once for all their users. Only you (the app owner) does this.
                </p>

                <p className="font-semibold mb-1" style={{ color: "var(--ink)" }}>Step 1 — Google Cloud Console</p>
                <ol className="list-decimal list-inside space-y-1 mb-3">
                  <li>Go to <strong>console.cloud.google.com</strong> → create or select a project</li>
                  <li>APIs & Services → Library → search <strong>Gmail API</strong> → Enable</li>
                  <li>Credentials → Create Credentials → <strong>OAuth 2.0 Client ID</strong> → Web application</li>
                  <li>
                    Add authorized redirect URI:
                    <code>https://kkveffyelwdenrlzymip.supabase.co/auth/v1/callback</code>
                  </li>
                  <li>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                </ol>

                <p className="font-semibold mb-1" style={{ color: "var(--ink)" }}>Step 2 — Supabase Dashboard</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Supabase Dashboard → Authentication → Providers → <strong>Google</strong></li>
                  <li>Toggle Enable, paste Client ID + Client Secret → <strong>Save</strong></li>
                  <li className="login-setup__hint">No extra scopes needed — the app requests Gmail access automatically</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold mb-1" style={{ color: "var(--ink)" }}>Step 3 — AI Features (optional)</p>
                <p>
                  Add <code>OPENAI_API_KEY</code> in Make Settings → Secrets to enable AI summaries, briefings, and assistant chat.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
