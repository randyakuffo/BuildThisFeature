import { useState } from "react";
import { Search } from "lucide-react";
import type { GmailEmail } from "../types";
import { searchEmails } from "../../lib/supabase";
import { Card, PageHeader, Avatar } from "../components/primitives";

export function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GmailEmail[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { emails } = await searchEmails(query);
      setResults(emails || []);
    } catch { setResults([]); }
    setSearching(false);
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Smart Search" subtitle="Search anything across your entire inbox" />
      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
          <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search anything… invoices, names, topics, dates"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
          />
        </div>
        <button onClick={handleSearch} disabled={searching || !query.trim()} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-2xl transition-colors disabled:opacity-50 shadow-sm">
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {["Invoices", "Receipts", "Flight confirmation", "From my boss", "Last month", "Contracts"].map((s) => (
          <button key={s} onClick={() => { setQuery(s); }} className="text-xs bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 px-3 py-1.5 rounded-full hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
            {s}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 text-xs text-gray-400 dark:text-slate-500">
            {results.length} results for "{query}"
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
            {results.map((email) => (
              <div key={email.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer">
                <Avatar initials={email.initials} bg={email.avatarBg} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{email.senderName}</span>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">{email.timeDisplay}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300 mb-0.5 truncate">{email.subject}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 line-clamp-1">{email.snippet}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

