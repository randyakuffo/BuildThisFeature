import { useMemo, useState } from "react";
import {
  Download,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Receipt,
  ScrollText,
  Search,
} from "lucide-react";
import {
  filterAndSortAttachments,
  formatFileSize,
  type AttachmentFilter,
  type AttachmentSort,
  type VaultAttachment,
} from "../../lib/attachments";
import { downloadAttachment } from "../../lib/supabase";
import { Card, EmptyInsights, PageHeader, Spinner } from "../components/primitives";

const FILTERS: { id: AttachmentFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pdf", label: "PDFs" },
  { id: "image", label: "Images" },
  { id: "spreadsheet", label: "Spreadsheets" },
  { id: "receipt", label: "Receipts" },
  { id: "contract", label: "Contracts" },
  { id: "document", label: "Docs" },
  { id: "other", label: "Other" },
];

function categoryIcon(category: VaultAttachment["category"]) {
  switch (category) {
    case "image":
      return FileImage;
    case "spreadsheet":
      return FileSpreadsheet;
    case "receipt":
      return Receipt;
    case "contract":
      return ScrollText;
    case "pdf":
    case "document":
      return FileText;
    default:
      return File;
  }
}

function categoryTone(category: VaultAttachment["category"]) {
  switch (category) {
    case "receipt":
      return "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300";
    case "contract":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
    case "image":
      return "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300";
    case "spreadsheet":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "pdf":
      return "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300";
    default:
      return "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
}

function formatReceivedAt(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function AttachmentsView({
  attachments,
  loading = false,
}: {
  attachments: VaultAttachment[];
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AttachmentFilter>("all");
  const [sort, setSort] = useState<AttachmentSort>("newest");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const visible = useMemo(
    () => filterAndSortAttachments(attachments, { query, filter, sort }),
    [attachments, query, filter, sort],
  );

  const handleDownload = async (item: VaultAttachment) => {
    setError("");
    setDownloadingId(item.id);
    try {
      await downloadAttachment(item);
    } catch (err: unknown) {
      console.error("Attachment download failed:", err);
      setError(err instanceof Error ? err.message : "Download failed. Try syncing again.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      <PageHeader
        title="Attachment Vault"
        subtitle="Files discovered across your inbox — indexed from Gmail, never re-hosted"
        action={
          attachments.length > 0 ? (
            <span className="text-xs font-semibold text-violet-700 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300 px-3 py-1.5 rounded-full">
              {attachments.length} file{attachments.length === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </div>
      ) : attachments.length === 0 ? (
        <EmptyInsights
          icon={Paperclip}
          label="No attachments found yet. Click Sync Inbox to scan Gmail for PDFs, receipts, and documents. If you just updated the server, sync once more to rebuild the vault."
        />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search filename, sender, or subject"
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161928] pl-10 pr-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as AttachmentSort)}
              className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161928] px-3 py-2.5 text-sm text-gray-700 dark:text-slate-200"
            >
              <option value="newest">Newest</option>
              <option value="largest">Largest</option>
              <option value="name">Name</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  filter === item.id
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {visible.length === 0 ? (
            <Card className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
              No files match your filters.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                {visible.map((item) => {
                  const Icon = categoryIcon(item.category);
                  const busy = downloadingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${categoryTone(item.category)}`}>
                        <Icon className="w-4.5 h-4.5 w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.filename}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">
                          {item.senderName} · {item.subject}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                            {item.category}
                          </span>
                          <span className="text-[11px] text-gray-400">{formatFileSize(item.size)}</span>
                          <span className="text-[11px] text-gray-400">{formatReceivedAt(item.receivedAt)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDownload(item)}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-1.5 self-start sm:self-center text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {busy ? <Spinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                        {busy ? "Downloading…" : "Download"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
