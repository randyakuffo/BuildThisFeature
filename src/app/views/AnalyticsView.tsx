import { Mail, TrendingUp, Star, Reply } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { GmailEmail, Stats } from "../types";
import { Card, PageHeader } from "../components/primitives";
import { colorMap } from "../lib/helpers";

export function AnalyticsView({ emails, stats }: { emails: GmailEmail[]; stats: Stats }) {
  const categoryData = Object.entries(stats.byCategory || {}).map(([name, count]) => ({ name, count }));
  const priorityData = [
    { name: "High", count: emails.filter(e => e.priority === "High").length },
    { name: "Medium", count: emails.filter(e => e.priority === "Medium").length },
    { name: "Low", count: emails.filter(e => e.priority === "Low").length },
  ].filter(d => d.count > 0);

  const readRate = stats.total ? Math.round(((stats.total - (stats.unread || 0)) / stats.total) * 100) : 0;
  const replyRate = emails.length ? Math.round((emails.filter(e => !e.requiresReply || e.isRead).length / emails.length) * 100) : 0;
  const importantRate = stats.total ? Math.round(((stats.important || 0) / stats.total) * 100) : 0;

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <PageHeader title="Analytics" subtitle="Your inbox intelligence and productivity overview" />

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Emails", value: stats.total || 0, icon: Mail, color: "indigo", sub: "in inbox" },
          { label: "Read Rate", value: `${readRate}%`, icon: TrendingUp, color: "emerald", sub: `${stats.total - (stats.unread || 0)} read` },
          { label: "Important", value: stats.important || 0, icon: Star, color: "violet", sub: `${importantRate}% of inbox` },
          { label: "Needs Reply", value: emails.filter(e => e.requiresReply && !e.isRead).length, icon: Reply, color: "amber", sub: "pending replies" },
        ].map((s) => {
          const { bg, icon: iconCls } = colorMap[s.color] ?? colorMap.slate;
          return (
            <Card key={s.label} className="p-4">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-5 h-5 ${iconCls}`} />
              </div>
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.value}</div>
              <p className="text-xs font-medium text-gray-700 dark:text-slate-300 mt-0.5">{s.label}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">{s.sub}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {categoryData.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Emails by Category</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1E2235", border: "none", borderRadius: 12, fontSize: 12, color: "#E2E8F0" }} />
                  <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        {priorityData.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Emails by Priority</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1E2235", border: "none", borderRadius: 12, fontSize: 12, color: "#E2E8F0" }} />
                  <Bar dataKey="count" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Health breakdown */}
      <Card className="mt-5 p-5">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Inbox Health Breakdown</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Read Rate", value: readRate, color: "bg-emerald-500" },
            { label: "Reply Rate", value: replyRate, color: "bg-indigo-500" },
            { label: "Low Priority", value: stats.total ? Math.round((emails.filter(e => e.priority === "Low").length / stats.total) * 100) : 0, color: "bg-slate-400" },
          ].map(m => (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-700 dark:text-slate-300">{m.label}</p>
                <p className="text-xs font-bold text-gray-900 dark:text-white">{m.value}%</p>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${m.color} rounded-full transition-all`} style={{ width: `${m.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

