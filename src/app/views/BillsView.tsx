import { CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Insights } from "../types";
import { Card, PageHeader, EmptyInsights } from "../components/primitives";

export function BillsView({ insights }: { insights: Insights }) {
  const spendingData = (Array.isArray(insights.bills) ? insights.bills : []).map((b: any, i: number) => ({
    name: (b.name || "").slice(0, 8),
    amount: Number(b.amount) || 0,
  }));

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <PageHeader title="Bills & Subscriptions" subtitle="Financial commitments detected from your inbox" />
      {insights.bills.length === 0 ? (
        <EmptyInsights icon={CreditCard} label="No bills detected yet. Sync your inbox to find financial emails." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Detected Bills</h3>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                {insights.bills.map((bill: any, i: number) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{bill.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">{bill.category} · Due {bill.due}</p>
                    </div>
                    <span className={`text-sm font-bold ${bill.status === "overdue" ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                      ${Number(bill.amount || 0).toFixed(2)}
                    </span>
                    {bill.status === "overdue" ? (
                      <span className="text-[10px] font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full">Overdue</span>
                    ) : bill.status === "due_soon" ? (
                      <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full">Due Soon</span>
                    ) : (
                      <button className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">Pay</button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
          {spendingData.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Bill Amounts</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendingData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1E2235", border: "none", borderRadius: 12, fontSize: 12, color: "#E2E8F0" }} />
                    <Bar dataKey="amount" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

