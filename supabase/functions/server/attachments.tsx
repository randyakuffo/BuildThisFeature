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

function walkParts(payload: any, visit: (part: any) => void) {
  if (!payload) return;
  visit(payload);
  const parts = Array.isArray(payload.parts) ? payload.parts : [];
  for (const part of parts) walkParts(part, visit);
}

/** Collect downloadable file parts; skips multipart containers and nameless inline parts. */
export function extractAttachmentsFromPayload(
  payload: any,
  meta: {
    messageId: string;
    threadId: string;
    senderName: string;
    senderEmail: string;
    subject: string;
    receivedAt: string;
  },
): VaultAttachment[] {
  const found: VaultAttachment[] = [];

  walkParts(payload, (part) => {
    const filename = typeof part?.filename === "string" ? part.filename.trim() : "";
    const mimeType = typeof part?.mimeType === "string" ? part.mimeType : "application/octet-stream";
    const attachmentId = typeof part?.body?.attachmentId === "string" ? part.body.attachmentId : "";
    const size = Number(part?.body?.size) || 0;

    if (!filename || !attachmentId) return;
    if (mimeType.startsWith("multipart/")) return;
    // Skip tiny nameless-looking signature images under 5KB
    if (mimeType.startsWith("image/") && size > 0 && size < 5_000 && /^image\d*\./i.test(filename)) {
      return;
    }

    const category = categorizeAttachment(filename, mimeType);
    found.push({
      id: `${meta.messageId}:${attachmentId}`,
      messageId: meta.messageId,
      threadId: meta.threadId,
      attachmentId,
      filename,
      mimeType,
      size,
      category,
      senderName: meta.senderName,
      senderEmail: meta.senderEmail,
      subject: meta.subject,
      receivedAt: meta.receivedAt,
    });
  });

  return found;
}
