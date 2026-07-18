import { Shield, ShieldAlert } from "lucide-react";
import type { Insights } from "../types";
import { Card, PageHeader } from "../components/primitives";

export function SecurityView({ insights }: { insights: Insights }) {
  const sevColor = (s: string) =>
    s === "high" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30" :
    s === "medium" ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" :
    "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30";

  const securityArr = Array.isArray(insights.security) ? insights.security : [];
  const score = Math.max(20, 100 - (securityArr.filter((a: any) => a.severity === "high").length * 20) - (securityArr.filter((a: any) => a.severity === "medium").length * 10));

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <PageHeader
        title="Security Center"
        subtitle="AI-powered email threat detection"
        action={
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${score >= 80 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"}`}>
            <Shield className="w-4 h-4" /> Health Score: {score}/100
          </div>
        }
      />
      {securityArr.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Inbox looks clean</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">No security threats detected in your recent emails.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {securityArr.map((alert: any, i: number) => (
            <Card key={i} className="p-5 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sevColor(alert.severity)}`}>
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{alert.type}</h4>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${sevColor(alert.severity)}`}>{alert.severity}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">From: {alert.from}</p>
                <p className="text-xs text-gray-600 dark:text-slate-300">{alert.description}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

