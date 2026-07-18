export type AttachmentCategory =
  | "pdf"
  | "image"
  | "spreadsheet"
  | "receipt"
  | "contract"
  | "document"
  | "other";

export interface VaultAttachment {
  id: string;
  messageId: string;
  threadId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  category: AttachmentCategory;
  senderName: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
}

const CATEGORIES: AttachmentCategory[] = [
  "pdf",
  "image",
  "spreadsheet",
  "receipt",
  "contract",
  "document",
  "other",
];

export function categorizeAttachment(filename: string, mimeType: string): AttachmentCategory {
  const name = filename.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (/invoice|receipt|bill|payment|statement/.test(name)) return "receipt";
  if (/contract|agreement|nda|msa|sow/.test(name)) return "contract";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    mime.includes("csv") ||
    /\.(xlsx?|csv|ods)$/.test(name)
  ) {
    return "spreadsheet";
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    mime.includes("msword") ||
    /\.(docx?|rtf|txt|pages)$/.test(name)
  ) {
    return "document";
  }
  return "other";
}

export function normalizeAttachment(raw: unknown): VaultAttachment | null {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object") return null;

  const messageId = typeof r.messageId === "string" ? r.messageId : "";
  const attachmentId = typeof r.attachmentId === "string" ? r.attachmentId : "";
  const filename = typeof r.filename === "string" ? r.filename.trim() : "";
  if (!messageId || !attachmentId || !filename) return null;

  const mimeType = typeof r.mimeType === "string" ? r.mimeType : "application/octet-stream";
  const categoryRaw = typeof r.category === "string" ? r.category : "";
  const category = CATEGORIES.includes(categoryRaw as AttachmentCategory)
    ? (categoryRaw as AttachmentCategory)
    : categorizeAttachment(filename, mimeType);

  return {
    id: typeof r.id === "string" && r.id ? r.id : `${messageId}:${attachmentId}`,
    messageId,
    threadId: typeof r.threadId === "string" ? r.threadId : "",
    attachmentId,
    filename,
    mimeType,
    size: Number.isFinite(Number(r.size)) ? Number(r.size) : 0,
    category,
    senderName: typeof r.senderName === "string" ? r.senderName : "Unknown",
    senderEmail: typeof r.senderEmail === "string" ? r.senderEmail : "",
    subject: typeof r.subject === "string" ? r.subject : "(No subject)",
    receivedAt: typeof r.receivedAt === "string" ? r.receivedAt : "",
  };
}

export function normalizeAttachmentsResponse(raw: unknown): VaultAttachment[] {
  const source = raw as Record<string, unknown>;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(source?.attachments)
      ? source.attachments
      : [];
  return list
    .map(normalizeAttachment)
    .filter((item): item is VaultAttachment => Boolean(item));
}

/** Flatten attachment arrays nested on email objects (client fallback). */
export function flattenAttachmentsFromEmails(emails: unknown[]): VaultAttachment[] {
  const byId = new Map<string, VaultAttachment>();
  for (const email of emails) {
    const e = email as Record<string, unknown>;
    const nested = Array.isArray(e?.attachments) ? e.attachments : [];
    for (const item of nested) {
      const normalized = normalizeAttachment(
        typeof item === "object" && item
          ? {
              ...(item as object),
              messageId: (item as VaultAttachment).messageId || e.id,
              threadId: (item as VaultAttachment).threadId || e.threadId,
              senderName: (item as VaultAttachment).senderName || e.senderName,
              senderEmail: (item as VaultAttachment).senderEmail || e.senderEmail,
              subject: (item as VaultAttachment).subject || e.subject,
              receivedAt: (item as VaultAttachment).receivedAt || e.receivedAt,
            }
          : item,
      );
      if (normalized) byId.set(normalized.id, normalized);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type AttachmentFilter = "all" | AttachmentCategory;
export type AttachmentSort = "newest" | "largest" | "name";

export function filterAndSortAttachments(
  items: VaultAttachment[],
  opts: { query?: string; filter?: AttachmentFilter; sort?: AttachmentSort },
): VaultAttachment[] {
  const query = (opts.query || "").trim().toLowerCase();
  const filter = opts.filter || "all";
  const sort = opts.sort || "newest";

  let next = items.filter((item) => {
    if (filter !== "all" && item.category !== filter) return false;
    if (!query) return true;
    return (
      item.filename.toLowerCase().includes(query) ||
      item.senderName.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query)
    );
  });

  next = [...next].sort((a, b) => {
    if (sort === "name") return a.filename.localeCompare(b.filename);
    if (sort === "largest") return b.size - a.size;
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });

  return next;
}

/** Decode Gmail base64url attachment payload into a Blob. */
export function attachmentDataToBlob(base64url: string, mimeType: string): Blob {
  const normalized = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}
