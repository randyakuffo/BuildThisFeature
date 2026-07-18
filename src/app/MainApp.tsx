import React, { useState, useEffect, Suspense } from "react";
import {
  supabase,
  signOut,
  syncGmail,
  getCachedEmails,
  getInsights,
  getDailyBrief,
  reclassifyEmails,
  repairAIData,
  storeGoogleTokens,
  type GoogleSessionTokens,
} from "../lib/supabase";
import { normalizeEmail } from "../lib/normalize";
import type { View, AppState, Stats, DailyBrief, AIProcessingStatus, Insights } from "./types";
import { Spinner } from "./components/primitives";
import { EMPTY_INSIGHTS } from "./lib/helpers";
import * as Views from "./views";

function sessionTokens(session: { provider_token?: string | null; provider_refresh_token?: string | null } | null): GoogleSessionTokens | undefined {
  if (session?.provider_token) {
    return {
      googleProviderToken: session.provider_token,
      googleProviderRefreshToken: session.provider_refresh_token ?? null,
    };
  }
  try {
    const googleProviderToken = sessionStorage.getItem("inboxos-google-provider-token");
    if (!googleProviderToken) return undefined;
    return {
      googleProviderToken,
      googleProviderRefreshToken: sessionStorage.getItem("inboxos-google-provider-refresh-token"),
    };
  } catch {
    return undefined;
  }
}

export function MainApp() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<View>("dashboard");
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [emails, setEmails] = useState<ReturnType<typeof normalizeEmail>[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, important: 0, needsReply: 0, byCategory: {} });
  const [insights, setInsights] = useState<Insights>(EMPTY_INSIGHTS);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIProcessingStatus>({
    classificationStatus: "idle",
    classificationProvider: null,
    insightsStatus: "idle",
    insightsProvider: null,
    classifiedCount: 0,
    fallbackCount: 0,
  });
  const [reclassifying, setReclassifying] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const loadBrief = async (userId: string) => {
    setBriefLoading(true);
    try {
      const result = await getDailyBrief(userId);
      const normalizedBrief = {
        summary: typeof result?.summary === "string" ? result.summary : "",
        highlights: Array.isArray(result?.highlights)
          ? result.highlights.filter((item: unknown): item is string => typeof item === "string")
          : [],
      };
      setBrief(normalizedBrief);
    } catch (error) {
      console.error("InboxOS brief load failed:", error);
      setBrief({ summary: "", highlights: [] });
    } finally {
      setBriefLoading(false);
    }
  };

  const syncInbox = async (userId: string, tokens?: ReturnType<typeof sessionTokens>) => {
    setSyncing(true);
    setAiStatus((s) => ({ ...s, classificationStatus: "running", insightsStatus: "running" }));

    try {
      const result = await syncGmail(userId, tokens);

      if (!result?.success) {
        throw new Error(result?.error || "Gmail synchronization did not succeed.");
      }

      if (result.classification) {
        setAiStatus((s) => ({
          ...s,
          classificationStatus: result.classification.status,
          classificationProvider: result.classification.provider,
          classifiedCount: result.classification.classifiedCount ?? 0,
          fallbackCount: result.classification.fallbackCount ?? 0,
        }));
      }
      if (result.insights) {
        setAiStatus((s) => ({
          ...s,
          insightsStatus: result.insights.status,
          insightsProvider: result.insights.provider,
        }));
      }

      const fresh = await getCachedEmails(userId);

      setEmails(Array.isArray(fresh.emails) ? fresh.emails.map(normalizeEmail) : []);
      setStats(fresh.stats || { total: 0, unread: 0, important: 0, needsReply: 0, byCategory: {} });
      setLastSync(fresh.lastSync || new Date().toISOString());

      const newInsights = await getInsights(userId);
      setInsights({
        actionItems: Array.isArray(newInsights?.actionItems) ? newInsights.actionItems : [],
        waitingOn: Array.isArray(newInsights?.waitingOn) ? newInsights.waitingOn : [],
        bills: Array.isArray(newInsights?.bills) ? newInsights.bills : [],
        followUps: Array.isArray(newInsights?.followUps) ? newInsights.followUps : [],
        calendar: Array.isArray(newInsights?.calendar) ? newInsights.calendar : [],
        security: Array.isArray(newInsights?.security) ? newInsights.security : [],
        purchases: Array.isArray(newInsights?.purchases) ? newInsights.purchases : [],
      });

      void loadBrief(userId);
      setAppState("ready");
    } catch (error: unknown) {
      console.error("InboxOS Gmail sync failed:", error);
      setAiStatus((s) => ({ ...s, classificationStatus: "failed", insightsStatus: "failed" }));
      setAppState("error");
    } finally {
      setSyncing(false);
    }
  };

  const loadData = async (userId: string, tokens?: ReturnType<typeof sessionTokens>) => {
    setAppState("syncing");
    try {
      const cached = await getCachedEmails(userId);
      if (cached.emails?.length > 0) {
        setEmails(Array.isArray(cached.emails) ? cached.emails.map(normalizeEmail) : []);
        setStats(cached.stats || {});
        setLastSync(cached.lastSync);
        setAppState("ready");

        const ins = await getInsights(userId);
        setInsights({
          actionItems: Array.isArray(ins?.actionItems) ? ins.actionItems : [],
          waitingOn: Array.isArray(ins?.waitingOn) ? ins.waitingOn : [],
          bills: Array.isArray(ins?.bills) ? ins.bills : [],
          followUps: Array.isArray(ins?.followUps) ? ins.followUps : [],
          calendar: Array.isArray(ins?.calendar) ? ins.calendar : [],
          security: Array.isArray(ins?.security) ? ins.security : [],
          purchases: Array.isArray(ins?.purchases) ? ins.purchases : [],
        });

        void loadBrief(userId);

        const staleMs = 10 * 60 * 1000;
        if (!cached.lastSync || Date.now() - new Date(cached.lastSync).getTime() > staleMs) {
          void syncInbox(userId, tokens);
        }
      } else {
        await syncInbox(userId, tokens);
      }
    } catch (e) {
      console.error("Load error:", e);
      setAppState("ready");
    }
  };

  useEffect(() => {
    let mounted = true;
    let activatingUserId = "";

    async function activateSession(session: any) {
      if (!mounted || !session?.user) return;
      if (activatingUserId === session.user.id) return;
      activatingUserId = session.user.id;

      try {
        if (session?.provider_token) {
          try {
            await storeGoogleTokens(session.provider_token, session.provider_refresh_token ?? null);
          } catch (tokenError) {
            console.error("InboxOS store Google tokens failed:", tokenError);
          }
        }

        const tokens = sessionTokens(session);
        setUser(session.user);
        await loadData(session.user.id, tokens);
      } catch (error) {
        console.error("Failed to activate authenticated session:", error);
        if (mounted) setAppState("error");
      } finally {
        activatingUserId = "";
      }
    }

    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        if (session) {
          await activateSession(session);
        } else {
          setAppState("unauthenticated");
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        if (mounted) setAppState("unauthenticated");
      }
    }

    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (session) {
        void activateSession(session);
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setAppState("unauthenticated");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleReclassify = async () => {
    if (!user) return;
    setReclassifying(true);
    setAiStatus((s) => ({ ...s, classificationStatus: "running", insightsStatus: "running" }));
    try {
      const result = await reclassifyEmails();
      if (result?.classification) {
        setAiStatus((s) => ({
          ...s,
          classificationStatus: result.classification.status,
          classificationProvider: result.classification.provider,
          classifiedCount: result.classification.classifiedCount ?? 0,
          fallbackCount: result.classification.fallbackCount ?? 0,
        }));
      }
      if (result?.insights) {
        setAiStatus((s) => ({ ...s, insightsStatus: result.insights.status, insightsProvider: result.insights.provider }));
      }
      const fresh = await getCachedEmails(user.id);
      setEmails(Array.isArray(fresh.emails) ? fresh.emails.map(normalizeEmail) : []);
      setStats(fresh.stats || { total: 0, unread: 0, important: 0, needsReply: 0, byCategory: {} });
      const newInsights = await getInsights(user.id);
      setInsights({
        actionItems: Array.isArray(newInsights?.actionItems) ? newInsights.actionItems : [],
        waitingOn: Array.isArray(newInsights?.waitingOn) ? newInsights.waitingOn : [],
        bills: Array.isArray(newInsights?.bills) ? newInsights.bills : [],
        followUps: Array.isArray(newInsights?.followUps) ? newInsights.followUps : [],
        calendar: Array.isArray(newInsights?.calendar) ? newInsights.calendar : [],
        security: Array.isArray(newInsights?.security) ? newInsights.security : [],
        purchases: Array.isArray(newInsights?.purchases) ? newInsights.purchases : [],
      });
    } catch (e) {
      console.error("InboxOS reclassify failed:", e);
      setAiStatus((s) => ({ ...s, classificationStatus: "failed" }));
    } finally {
      setReclassifying(false);
    }
  };

  const handleSync = async () => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    void syncInbox(user.id, sessionTokens(session));
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setEmails([]);
    setStats({ total: 0, unread: 0, important: 0, needsReply: 0, byCategory: {} });
    setInsights(EMPTY_INSIGHTS);
    setBrief(null);
    setAppState("unauthenticated");
  };

  const handleArchive = (id: string) => {
    setEmails((e) => e.filter((x) => x.id !== id));
    setStats((s) => ({ ...s, total: s.total - 1 }));
  };

  const handleMarkRead = (id: string) => {
    setEmails((e) => e.map((x) => (x.id === id ? { ...x, isRead: true, status: "Read" } : x)));
    setStats((s) => ({ ...s, unread: Math.max(0, s.unread - 1) }));
  };

  const viewFallback = (
    <div className="flex items-center justify-center h-full py-20">
      <Spinner className="w-8 h-8" />
    </div>
  );

  if (appState === "loading") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0D0F1A] flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (appState === "unauthenticated") {
    return (
      <Suspense fallback={viewFallback}>
        <Views.LoginScreen />
      </Suspense>
    );
  }

  if (appState === "syncing" && emails.length === 0) {
    return (
      <Suspense fallback={viewFallback}>
        <Views.SyncingScreen email={user?.email || ""} />
      </Suspense>
    );
  }

  if (appState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Gmail could not be loaded</h2>
          <p className="text-sm text-gray-500 mb-5">
            Your Google account is connected, but InboxOS could not reach the Gmail synchronization service.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => void handleSync()}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => void handleSignOut()}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Reconnect Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0D0F1A] relative" style={{ fontFamily: "'Inter',sans-serif" }}>
      <Suspense fallback={viewFallback}>
        <Views.Sidebar
          view={view}
          setView={setView}
          dark={dark}
          setDark={setDark}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          stats={stats}
          user={user}
          onSignOut={() => void handleSignOut()}
          onSync={() => void handleSync()}
          syncing={syncing}
          aiStatus={aiStatus}
          onReclassify={() => void handleReclassify()}
          reclassifying={reclassifying}
        />
      </Suspense>
      <main className="flex-1 overflow-y-auto min-w-0">
        <Suspense fallback={viewFallback}>
          {view === "dashboard" && (
            <Views.DashboardView
              emails={emails}
              stats={stats}
              insights={insights}
              brief={brief}
              briefLoading={briefLoading}
              setView={setView}
              user={user}
              syncing={syncing}
            />
          )}
          {view === "inbox" && (
            <Views.InboxView
              emails={emails}
              onArchive={handleArchive}
              onMarkRead={handleMarkRead}
              userId={user?.id || ""}
              onRefresh={() => void handleSync()}
            />
          )}
          {view === "ai" && <Views.AIAssistantView userId={user?.id || ""} />}
          {view === "action" && <Views.ActionCenterView insights={insights} />}
          {view === "waiting" && <Views.WaitingOnView insights={insights} />}
          {view === "followup" && <Views.FollowUpsView insights={insights} />}
          {view === "bills" && <Views.BillsView insights={insights} />}
          {view === "calendar" && <Views.CalendarView insights={insights} />}
          {view === "purchases" && <Views.PurchasesView insights={insights} />}
          {view === "security" && <Views.SecurityView insights={insights} />}
          {view === "search" && <Views.SearchView />}
          {view === "analytics" && <Views.AnalyticsView emails={emails} stats={stats} />}
          {view === "settings" && (
            <Views.SettingsView
              user={user}
              onSignOut={() => void handleSignOut()}
              lastSync={lastSync}
              onRepairData={async () => {
                const r = await repairAIData();
                const fresh = await getCachedEmails(user!.id);
                setEmails(Array.isArray(fresh.emails) ? fresh.emails.map(normalizeEmail) : []);
                const ins = await getInsights(user!.id);
                setInsights({
                  actionItems: Array.isArray(ins?.actionItems) ? ins.actionItems : [],
                  waitingOn: Array.isArray(ins?.waitingOn) ? ins.waitingOn : [],
                  bills: Array.isArray(ins?.bills) ? ins.bills : [],
                  calendar: Array.isArray(ins?.calendar) ? ins.calendar : [],
                  security: Array.isArray(ins?.security) ? ins.security : [],
                  followUps: Array.isArray(ins?.followUps) ? ins.followUps : [],
                  purchases: Array.isArray(ins?.purchases) ? ins.purchases : [],
                });
                void loadBrief(user!.id);
                return r;
              }}
            />
          )}
          {view === "attachments" && <Views.AttachmentsView emails={emails} />}
          {view === "automations" && <Views.AutomationsView emails={emails} />}
        </Suspense>
      </main>
    </div>
  );
}
