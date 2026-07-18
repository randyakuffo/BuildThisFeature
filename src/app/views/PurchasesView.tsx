import { Package } from "lucide-react";
import type { Insights } from "../types";
import { normalizePurchase } from "../../lib/normalize";
import { Card, PageHeader, EmptyInsights } from "../components/primitives";

export function PurchasesView({ insights }: { insights: Insights }) {
  const purchases = (Array.isArray(insights.purchases) ? insights.purchases : []).map(normalizePurchase);

  const statusColor = (s: string) => ({
    ordered: "text-indigo-600 dark:text-indigo-400",
    shipped: "text-amber-600 dark:text-amber-400",
    delivered: "text-emerald-600 dark:text-emerald-400",
    returned: "text-red-600 dark:text-red-400",
  }[s] || "text-gray-500 dark:text-slate-400");

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Purchases" subtitle="Orders and shipments detected from your inbox" />
      {purchases.length === 0 ? (
        <EmptyInsights icon={Package} label="No purchases detected yet. Sync your inbox to find order and shipment emails." />
      ) : (
        <div className="space-y-3">
          {purchases.map((p, i) => {
            const meta = [p.from, p.date].filter(Boolean).join(" · ");
            return (
              <Card key={p.emailId || i} className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.item}</p>
                  {meta ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{meta}</p>
                  ) : null}
                </div>
                {p.amount != null && (
                  <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                    ${Number(p.amount).toFixed(2)}
                  </span>
                )}
                {p.status && p.status !== "unknown" && (
                  <span className={`text-xs font-semibold capitalize ${statusColor(p.status)}`}>
                    {p.status.replace(/_/g, " ")}
                  </span>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
