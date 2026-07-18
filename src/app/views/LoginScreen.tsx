import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Inbox,
  KeyRound,
  Lock,
  Mail,
  Menu,
  MessageSquare,
  Reply,
  Search,
  Send,
  Shield,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { signInWithGoogle } from "../../lib/supabase";
import { Spinner } from "../components/primitives";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#security", label: "Security" },
] as const;

const BENEFITS = [
  {
    icon: Bell,
    title: "The right nudge, right on time",
    body: "Surface what needs attention today—without drowning you in every unread message.",
  },
  {
    icon: Sparkles,
    title: "AI that understands context",
    body: "NudgeBox reads threads for intent, urgency, and next steps so you don’t have to re-scan the whole inbox.",
  },
  {
    icon: Reply,
    title: "Never drop a follow-up",
    body: "Track who you owe and who owes you, with gentle reminders before conversations go cold.",
  },
  {
    icon: Zap,
    title: "Email becomes action",
    body: "Turn messages into a clear checklist—replies, decisions, and tasks ranked by impact.",
  },
  {
    icon: CreditCard,
    title: "Bills without surprises",
    body: "Spot due dates and amounts early so payments don’t hide in promotional noise.",
  },
  {
    icon: MessageSquare,
    title: "Answers instantly",
    body: "Ask about your inbox in plain language and get grounded answers from your real email context.",
  },
] as const;

const STEPS = [
  {
    step: "01",
    icon: Mail,
    title: "Connect Gmail",
    body: "Sign in with Google OAuth in about a minute. NudgeBox only asks for the Gmail access it needs.",
  },
  {
    step: "02",
    icon: Search,
    title: "Let NudgeBox notice",
    body: "We quietly scan for replies, deadlines, bills, and follow-ups—then organize them into a calm daily plan.",
  },
  {
    step: "03",
    icon: CheckCircle2,
    title: "Follow the nudges",
    body: "Work through ranked priorities with confidence. Nothing sends unless you choose to act.",
  },
] as const;

const TRUST_POINTS = [
  {
    icon: KeyRound,
    title: "Secure Google OAuth",
    body: "Connect through Google’s trusted sign-in flow—no passwords stored by NudgeBox.",
  },
  {
    icon: Lock,
    title: "Tokens stay server-side",
    body: "Provider tokens are kept on the server so your Gmail credentials aren’t sitting in browser storage.",
  },
  {
    icon: Send,
    title: "You approve every send",
    body: "NudgeBox never sends messages automatically. Drafts and actions wait for your go-ahead.",
  },
  {
    icon: Shield,
    title: "Disconnect anytime",
    body: "Sign out and revoke access whenever you want. Your account stays under your control.",
  },
] as const;

const MOCK_NUDGES = [
  { rank: 1, label: "Reply to Maya about Q3 launch", meta: "Needs reply · High", tone: "coral" },
  { rank: 2, label: "Pay Stripe invoice due Friday", meta: "Bill · $240", tone: "amber" },
  { rank: 3, label: "Follow up with Jordan on contract", meta: "Follow-up · 3 days", tone: "purple" },
  { rank: 4, label: "Confirm Tuesday design review", meta: "Calendar · Tomorrow", tone: "navy" },
] as const;

function LogoMark({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <div
      className={`${className} rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center shadow-lg shadow-violet-500/25`}
    >
      <Bell className="w-[46%] h-[46%] text-white" strokeWidth={2.25} />
    </div>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-tight text-[#0F172A] ${className}`}
      style={{ fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif" }}
    >
      NudgeBox
    </span>
  );
}

function GoogleGlyph({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} flex-shrink-0`} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute -inset-4 sm:-inset-6 rounded-[2rem] bg-gradient-to-br from-violet-400/25 via-fuchsia-300/15 to-coral-400/20 blur-2xl pointer-events-none" style={{ background: "radial-gradient(circle at 20% 20%, rgba(124,58,237,0.22), transparent 45%), radial-gradient(circle at 80% 70%, rgba(249,115,115,0.2), transparent 40%)" }} />
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-violet-100 bg-white shadow-[0_30px_80px_-40px_rgba(76,29,149,0.45)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B]/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 text-[11px] sm:text-xs text-slate-400 font-medium truncate">app.nudgebox.ai / dashboard</span>
        </div>

        <div className="flex min-h-[360px] sm:min-h-[420px]">
          {/* Sidebar */}
          <aside className="hidden sm:flex w-[200px] flex-col bg-[#0F172A] text-slate-300 p-4 gap-1">
            <div className="flex items-center gap-2.5 mb-5 px-1">
              <LogoMark className="w-8 h-8" />
              <div>
                <p className="text-white text-sm font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>NudgeBox</p>
                <p className="text-[10px] text-slate-500">Daily nudges</p>
              </div>
            </div>
            {[
              { icon: Inbox, label: "Dashboard", active: true },
              { icon: Mail, label: "Inbox", badge: "18" },
              { icon: Zap, label: "Action Center" },
              { icon: Reply, label: "Follow-ups" },
              { icon: CreditCard, label: "Bills" },
              { icon: Sparkles, label: "AI Assistant" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium ${
                    item.active ? "bg-violet-500/20 text-violet-200" : "text-slate-400"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">{item.badge}</span>
                  )}
                </div>
              );
            })}
          </aside>

          {/* Main */}
          <div className="flex-1 p-4 sm:p-6 bg-gradient-to-b from-[#FAFBFF] to-white">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 mb-1">Saturday, July 18</p>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Good morning, Alex
                </h3>
                <p className="text-sm text-slate-500 mt-1">Here’s a calm plan for what’s waiting in your inbox.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: Mail, label: "18 unread", cls: "bg-violet-50 text-violet-700" },
                  { icon: Zap, label: "6 actions", cls: "text-[#E11D48]", style: { background: "rgba(255,107,107,0.12)", color: "#E11D48" } },
                  { icon: Reply, label: "4 follow-ups", cls: "bg-emerald-50 text-emerald-700" },
                  { icon: CreditCard, label: "2 bills due", cls: "bg-amber-50 text-amber-700" },
                ].map((chip) => {
                  const Icon = chip.icon;
                  return (
                    <span
                      key={chip.label}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full ${chip.cls}`}
                      style={chip.style}
                    >
                      <Icon className="w-3 h-3" />
                      {chip.label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 rounded-2xl border border-violet-100 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">Your nudges for today</p>
                      <p className="text-[11px] text-slate-500">4 ranked priorities · ~35 min</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">62% clear</span>
                </div>

                <div className="h-2 rounded-full bg-slate-100 mb-4 overflow-hidden">
                  <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-violet-500 to-[#FF6B6B]" />
                </div>

                <div className="space-y-2.5">
                  {MOCK_NUDGES.map((nudge) => (
                    <div
                      key={nudge.rank}
                      className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                    >
                      <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
                        {nudge.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{nudge.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{nudge.meta}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-transparent bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] p-4 sm:p-5 text-white shadow-lg shadow-violet-500/25">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-100" />
                  <p className="text-sm font-semibold">AI daily summary</p>
                </div>
                <p className="text-sm text-violet-50/95 leading-relaxed mb-4">
                  Three threads need a reply before lunch, one invoice is due Friday, and Jordan is waiting on the contract. Clear those and you’re ahead for the week.
                </p>
                <div className="space-y-2">
                  {["Reply to Maya first", "Schedule bill payment", "Nudge Jordan gently"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-violet-100/90 bg-white/10 rounded-xl px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FFB4A8]" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-violet-100/80">
                  <Clock className="w-3.5 h-3.5" />
                  Estimated completion: 35 minutes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isConfigError =
    error.includes("not enabled") || error.includes("OAuth") || error.includes("configured");

  const handleSignIn = async () => {
    setLoading(true);
    setError("");
    setMenuOpen(false);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error("Google sign-in failed:", err);
      setError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  const scrollTo = (href: string) => {
    setMenuOpen(false);
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="min-h-screen bg-[#FAFBFF] text-[#0F172A] overflow-x-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <style>{`
        .nb-display { font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif; }
        .nb-gradient-text {
          background: linear-gradient(120deg, #4C1D95 10%, #7C3AED 45%, #FF6B6B 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .nb-card {
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
        }
        .nb-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 40px -24px rgba(76, 29, 149, 0.35);
          border-color: rgba(124, 58, 237, 0.28);
        }
        .nb-btn-primary {
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }
        .nb-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px -12px rgba(124, 58, 237, 0.55);
        }
        .nb-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .nb-card, .nb-btn-primary { transition: none; }
          .nb-card:hover, .nb-btn-primary:hover:not(:disabled) { transform: none; }
        }
      `}</style>

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_10%_-10%,rgba(167,139,250,0.28),transparent),radial-gradient(800px_480px_at_90%_0%,rgba(255,107,107,0.16),transparent),radial-gradient(700px_400px_at_50%_100%,rgba(196,181,253,0.18),transparent)]" />
      </div>

      {/* Navigation */}
      <header
        className={`sticky top-0 z-50 transition-all duration-200 ${
          scrolled ? "bg-white/85 backdrop-blur-xl border-b border-violet-100/80 shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <a href="#top" className="flex items-center gap-2.5" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <LogoMark className="w-9 h-9" />
              <Wordmark className="text-lg" />
            </a>

            <nav className="hidden lg:flex items-center gap-7">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => scrollTo(link.href)}
                  className="text-sm font-medium text-slate-600 hover:text-violet-700 transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="hidden sm:flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="text-sm font-semibold text-slate-700 hover:text-violet-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-60"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="nb-btn-primary inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-semibold px-4 py-2.5 shadow-md shadow-violet-500/25 disabled:opacity-60"
              >
                {loading ? <Spinner className="w-4 h-4" /> : null}
                Get your first nudge
              </button>
            </div>

            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-violet-100 bg-white/80 text-[#0F172A]"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {menuOpen && (
            <div className="lg:hidden pb-4 border-t border-violet-100/80 pt-3 space-y-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => scrollTo(link.href)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-violet-50"
                >
                  {link.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-violet-50 disabled:opacity-60"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="nb-btn-primary w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold px-4 py-3 disabled:opacity-60"
              >
                {loading ? <Spinner className="w-4 h-4" /> : null}
                Get your first nudge
              </button>
            </div>
          )}
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative px-4 sm:px-6 pt-14 sm:pt-20 pb-16 sm:pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/80 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-violet-700 shadow-sm mb-6">
                <Sparkles className="w-3.5 h-3.5 text-[#FF6B6B]" />
                A calmer, smarter way to stay on top of email
              </div>

              <h1
                className="nb-display text-[2.35rem] sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.08] tracking-tight text-[#0F172A]"
              >
                Your inbox, <span className="nb-gradient-text">gently nudged</span> forward.
              </h1>

              <p className="mt-5 sm:mt-6 text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                NudgeBox finds the replies, deadlines, bills, and follow-ups hiding in your inbox—then gives you a clear plan to handle them.
              </p>

              {error && (
                <div
                  className={`mt-6 mx-auto max-w-xl text-left text-sm rounded-2xl px-4 py-3 border ${
                    isConfigError
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={loading}
                  className="nb-btn-primary inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-base font-semibold px-6 py-3.5 shadow-lg shadow-violet-500/30 disabled:opacity-60"
                >
                  {loading ? <Spinner className="w-5 h-5" /> : <GoogleGlyph />}
                  Show me what matters
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => scrollTo("#product")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white/90 text-[#0F172A] text-base font-semibold px-6 py-3.5 hover:border-violet-300 hover:bg-violet-50/60 transition-colors"
                >
                  See NudgeBox in action
                </button>
              </div>

              <p className="mt-5 text-sm text-slate-500">
                Free to try · Set up in 60 seconds · Nothing sends without you
              </p>
            </div>
          </div>
        </section>

        {/* Product preview */}
        <section id="product" className="px-4 sm:px-6 pb-20 sm:pb-28 scroll-mt-24">
          <div className="mx-auto max-w-6xl">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 mb-3">Product</p>
              <h2 className="nb-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
                Your day, organized into gentle nudges
              </h2>
              <p className="mt-3 text-slate-600">
                A productivity layer on top of Gmail—not another crowded inbox to manage.
              </p>
            </div>
            <DashboardPreview />
          </div>
        </section>

        {/* Benefits */}
        <section id="features" className="px-4 sm:px-6 py-20 sm:py-28 bg-white/70 border-y border-violet-100/70 scroll-mt-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl mb-10 sm:mb-14">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF6B6B] mb-3">Features</p>
              <h2 className="nb-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
                The important stuff in your inbox should find you.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article
                    key={benefit.title}
                    className="nb-card rounded-2xl border border-violet-100/90 bg-white p-6 shadow-sm"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="nb-display text-lg font-bold text-[#0F172A] mb-2">{benefit.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{benefit.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-4 sm:px-6 py-20 sm:py-28 scroll-mt-24">
          <div className="mx-auto max-w-6xl">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 mb-3">How It Works</p>
              <h2 className="nb-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
                From chaos to a clear plan—in three steps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {STEPS.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.step}
                    className="nb-card relative rounded-2xl border border-violet-100 bg-white p-6 sm:p-7 shadow-sm"
                  >
                    <span className="nb-display text-sm font-bold text-violet-500 mb-4 block">{item.step}</span>
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-[#FF6B6B] text-white flex items-center justify-center mb-4 shadow-md shadow-violet-500/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="nb-display text-xl font-bold text-[#0F172A] mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="px-4 sm:px-6 py-20 sm:py-28 bg-[#0F172A] text-white scroll-mt-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FFB4A8] mb-3">Security</p>
                <h2 className="nb-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                  Built to be trusted with your inbox
                </h2>
                <p className="text-slate-300 leading-relaxed mb-6">
                  NudgeBox is an AI productivity layer—not a mailbox that acts on its own. You stay in control of connections, actions, and every outgoing message.
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-sm text-violet-100">
                  <FileText className="w-4 h-4 text-[#FF6B6B]" />
                  Secure by design · Transparent by default
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TRUST_POINTS.map((point) => {
                  const Icon = point.icon;
                  return (
                    <article
                      key={point.title}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.08] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-200 flex items-center justify-center mb-3">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="nb-display font-bold text-white mb-1.5">{point.title}</h3>
                      <p className="text-sm text-slate-300 leading-relaxed">{point.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 sm:px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] border border-violet-200 bg-gradient-to-br from-white via-violet-50 to-[#FFE8E6] px-6 py-12 sm:px-12 sm:py-16 text-center shadow-[0_30px_80px_-48px_rgba(76,29,149,0.45)]">
              <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-[#FF6B6B]/15 blur-3xl pointer-events-none" />
              <div className="relative">
                <LogoMark className="w-12 h-12 mx-auto mb-5" />
                <h2 className="nb-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] mb-3">
                  A little nudge goes a long way.
                </h2>
                <p className="text-slate-600 max-w-xl mx-auto mb-8">
                  Connect Gmail, get your first daily plan, and feel your inbox start working with you.
                </p>
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={loading}
                  className="nb-btn-primary inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-base font-semibold px-7 py-3.5 shadow-lg shadow-violet-500/30 disabled:opacity-60"
                >
                  {loading ? <Spinner className="w-5 h-5" /> : <GoogleGlyph />}
                  Try NudgeBox free
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="footer" className="border-t border-violet-100 bg-white/80 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-6xl flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <LogoMark className="w-9 h-9" />
              <Wordmark className="text-lg" />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => scrollTo(link.href)}
                  className="hover:text-violet-700 transition-colors"
                >
                  {link.label}
                </button>
              ))}
              <a href="#security" onClick={(e) => { e.preventDefault(); scrollTo("#security"); }} className="hover:text-violet-700 transition-colors">
                Privacy
              </a>
              <a href="#security" onClick={(e) => { e.preventDefault(); scrollTo("#security"); }} className="hover:text-violet-700 transition-colors">
                Terms
              </a>
            </div>
          </div>
          <p className="text-sm text-slate-500">© 2026 NudgeBox. Stay ahead, calmly.</p>
        </div>
      </footer>
    </div>
  );
}
