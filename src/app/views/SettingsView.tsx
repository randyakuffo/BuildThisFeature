import { useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { Card, PageHeader } from "../components/primitives";

export function SettingsView({ user, onSignOut, lastSync, onRepairData }: { user: any; onSignOut: () => void; lastSync: string | null; onRepairData: () => Promise<void> }) {
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairResult(null);
    try {
      const r = await onRepairData();
      setRepairResult(`Repaired ${(r as any)?.repairedEmails ?? 0} emails and ${(r as any)?.repairedInsights ?? 0} insight records.`);
    } catch (e: any) {
      setRepairResult(`Repair failed: ${e?.message || "unknown error"}`);
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="p-6 max-w-[700px] mx-auto">
      <PageHeader title="Settings" subtitle="Account and integration settings" />
      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Account</h3>
          <div className="flex items-center gap-4 mb-4">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} className="w-12 h-12 rounded-full" alt="avatar" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <span className="text-lg font-bold text-white">{(user?.user_metadata?.name || user?.email || "U").charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.user_metadata?.name || "User"}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{user?.email}</p>
              {lastSync && <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Last sync: {new Date(lastSync).toLocaleString()}</p>}
            </div>
          </div>
          <button onClick={onSignOut} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:underline">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>AI Features</h3>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-xs text-indigo-700 dark:text-indigo-300 mb-3">
            <p className="font-semibold mb-1">Groq · Gemini · Fallback</p>
            <p>Classification uses <strong>Groq</strong> (llama-3.3-70b). Insights and chat use <strong>Gemini</strong> (gemini-2.5-flash). Configure <code className="bg-indigo-100 dark:bg-indigo-900 px-1 rounded">GROQ_API_KEY</code> and <code className="bg-indigo-100 dark:bg-indigo-900 px-1 rounded">GEMINI_API_KEY</code> in Make Settings → Secrets.</p>
          </div>
          <div className="border-t border-gray-100 dark:border-white/5 pt-3">
            <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">If AI data caused display issues, repair stored records:</p>
            <button
              onClick={handleRepair}
              disabled={repairing}
              className="flex items-center gap-2 text-sm font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${repairing ? "animate-spin" : ""}`} />
              {repairing ? "Repairing…" : "Repair AI data"}
            </button>
            {repairResult && <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">{repairResult}</p>}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Gmail OAuth Setup</h3>
          <ol className="space-y-2 text-xs text-gray-600 dark:text-slate-400 list-decimal list-inside">
            <li>Go to <strong>console.cloud.google.com</strong> → create/select a project</li>
            <li>Enable the <strong>Gmail API</strong> — APIs & Services → Library → Gmail API → Enable</li>
            <li>Create OAuth 2.0 credentials → Web application type</li>
            <li>Add redirect URI: <code className="bg-gray-100 dark:bg-slate-800 px-1 rounded text-[10px]">https://kkveffyelwdenrlzymip.supabase.co/auth/v1/callback</code></li>
            <li>In <strong>Supabase → Auth → Providers → Google</strong>: toggle Enable, paste Client ID + Secret, click Save</li>
            <li><em>No extra scopes needed in Supabase</em> — Gmail access is requested automatically at sign-in</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

