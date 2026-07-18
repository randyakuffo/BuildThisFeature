import { useState } from "react";
import { Search } from "lucide-react";
import type { GmailEmail } from "../types";
import { searchEmails } from "../../lib/supabase";
import {
  mergeSearchResults,
  sanitizeRemoteSearchResults,
  searchCachedEmails,
  toGmailQuery,
} from "../../lib/search";
import { Card, PageHeader, Avatar } from "../components/primitives";

export function SearchView({ emails }: { emails: GmailEmail[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GmailEmail[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [source, setSource] = useState<"local" | "gmail" | "both" | null>(null);
  const [error, setError] = useState("");

  const runSearch = async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setSearching(true);
    setError("");
    setSearched(true);

    const localResults = searchCachedEmails(emails, trimmed);
    setResults(localResults);
    setSource(localResults.length > 0 ? "local" : null);

    try {
      const gmailQuery = toGmailQuery(trimmed);
      const response = await searchEmails(gmailQuery);
      const rawRemote = Array.isArray(response?.emails) ? response.emails : [];
      const remoteResults = sanitizeRemoteSearchResults(rawRemote, trimmed);
      const merged = mergeSearchResults(trimmed, localResults, remoteResults);

      setResults(merged);
      if (localResults.length > 0 && remoteResults.length > 0) {
        setSource("both");
      } else if (remoteResults.length > 0) {
        setSource("gmail");
      } else if (localResults.length > 0) {
        setSource("local");
      } else {
        setSource(null);
      }

      if (response?.error && merged.length === 0) {
        setError(typeof response.error === "string" ? response.error : "Gmail search unavailable.");
      }
    } catch (err) {
      if (localResults.length === 0) {
        setError(err instanceof Error ? err.message : "Search failed.");
      }
    } finally {
      setSearching(false);
    }
  };

  const suggestions = ["Invoices", "Receipts", "Flight confirmation", "Contracts", "Last month"];

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Smart Search" subtitle="Search synced emails instantly, then query all of Gmail" />

      <div className="flex gap-3 mb-6">
        <div className="flex-1 bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-sm">
          <Search className="w-5 h-5 text-gray-400 dark:text-slate-500 flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
            placeholder="Search subject, sender, snippet, category…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
          />
        </div>
        <button
          onClick={() => runSearch(query)}
          disabled={searching || !query.trim()}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-2xl transition-colors disabled:opacity-50 shadow-sm"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => runSearch(s)}
            className="text-xs bg-white dark:bg-[#161928] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 px-3 py-1.5 rounded-full hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {source && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
          {source === "both" && "Results from synced inbox and Gmail search"}
          {source === "local" && "Results from synced inbox (Gmail search returned no extra matches)"}
          {source === "gmail" && "Results from Gmail search"}
        </p>
      )}

      {error && (
        <div className="mb-4 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {searched && results.length === 0 && !searching && (
        <Card className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          No emails matched "{query}". Try a sender name, subject keyword, or a preset chip above.
        </Card>
      )}

      {results.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 text-xs text-gray-400 dark:text-slate-500">
            {results.length} result{results.length === 1 ? "" : "s"} for "{query}"
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
