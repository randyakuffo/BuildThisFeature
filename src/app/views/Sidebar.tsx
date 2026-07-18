import { Sparkles, RefreshCw, Sun, Moon, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import type { View, Stats, AIProcessingStatus } from "../types";
import { navItems } from "../types";
import { AIStatusBadge } from "../components/primitives";

export function Sidebar({
  view, setView, dark, setDark, collapsed, setCollapsed, stats, user, onSignOut, onSync, syncing, aiStatus, onReclassify, reclassifying,
}: {
  view: View; setView: (v: View) => void;
  dark: boolean; setDark: (d: boolean) => void;
  collapsed: boolean; setCollapsed: (c: boolean) => void;
  stats: Stats; user: any; onSignOut: () => void; onSync: () => void; syncing: boolean;
  aiStatus: AIProcessingStatus; onReclassify: () => void; reclassifying: boolean;
}) {
  const badgeCount = (item: typeof navItems[0]) => {
    if (item.badgeKey === "unread") return stats.unread || 0;
    return 0;
  };

  return (
    <aside
      className={`relative flex flex-col h-screen bg-[#0F172A] transition-all duration-300 ease-in-out flex-shrink-0 ${collapsed ? "w-16" : "w-60"}`}
      style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-14 border-b border-white/5 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-semibold text-sm tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>InboxOS</span>
            <span className="block text-[10px] text-slate-500 leading-none">AI Command Center</span>
          </div>
        )}
      </div>

      {/* Sync button */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={onSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 text-[11px] font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync Inbox"}
          </button>
        </div>
      )}

      {/* AI status badge */}
      {!collapsed && (
        <AIStatusBadge aiStatus={aiStatus} onReclassify={onReclassify} reclassifying={reclassifying} />
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          const badge = badgeCount(item);
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                active ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && badge > 0 && (
                <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${active ? "bg-indigo-500/30 text-indigo-300" : "bg-slate-700 text-slate-400"}`}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {collapsed && badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/5 p-2 space-y-1">
        <button
          onClick={() => setDark(!dark)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all"
        >
          {dark ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? "justify-center" : ""}`}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} className="w-7 h-7 rounded-full flex-shrink-0" alt="avatar" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">
                {(user?.user_metadata?.name || user?.email || "U").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">{user?.user_metadata?.name || "User"}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={onSignOut} title="Sign out" className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-all z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}

