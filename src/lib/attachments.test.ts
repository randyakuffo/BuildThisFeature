import { describe, expect, it } from "vitest";
import {
  categorizeAttachment,
  filterAndSortAttachments,
  flattenAttachmentsFromEmails,
  formatFileSize,
  normalizeAttachment,
  normalizeAttachmentsResponse,
  type VaultAttachment,
} from "./attachments";

const sample = (overrides: Partial<VaultAttachment> = {}): VaultAttachment => ({
  id: "m1:a1",
  messageId: "m1",
  threadId: "t1",
  attachmentId: "a1",
  filename: "invoice-march.pdf",
  mimeType: "application/pdf",
  size: 2048,
  category: "receipt",
  senderName: "Billing",
  senderEmail: "billing@example.com",
  subject: "Your invoice",
  receivedAt: "2026-07-01T12:00:00.000Z",
  ...overrides,
});

describe("categorizeAttachment", () => {
  it("detects receipts and contracts from filename", () => {
    expect(categorizeAttachment("Receipt_12.pdf", "application/pdf")).toBe("receipt");
    expect(categorizeAttachment("NDA-final.docx", "application/msword")).toBe("contract");
  });

  it("uses mime type for images and spreadsheets", () => {
    expect(categorizeAttachment("photo.png", "image/png")).toBe("image");
    expect(categorizeAttachment("budget.xlsx", "application/vnd.ms-excel")).toBe("spreadsheet");
  });
});

describe("normalizeAttachment", () => {
  it("returns null for incomplete records", () => {
    expect(normalizeAttachment({ filename: "x.pdf" })).toBeNull();
  });

  it("fills category when missing", () => {
    const result = normalizeAttachment({
      messageId: "m",
      attachmentId: "a",
      filename: "notes.txt",
      mimeType: "text/plain",
    });
    expect(result?.category).toBe("document");
    expect(result?.id).toBe("m:a");
  });
});

describe("normalizeAttachmentsResponse", () => {
  it("reads nested attachments array", () => {
    const result = normalizeAttachmentsResponse({
      attachments: [sample(), { filename: "bad" }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("invoice-march.pdf");
  });
});

describe("flattenAttachmentsFromEmails", () => {
  it("flattens nested email attachments", () => {
    const list = flattenAttachmentsFromEmails([
      {
        id: "e1",
        senderName: "Alex",
        subject: "Files",
        receivedAt: "2026-07-02T00:00:00.000Z",
        attachments: [
          {
            attachmentId: "att",
            filename: "deck.pdf",
            mimeType: "application/pdf",
            size: 10,
          },
        ],
      },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].messageId).toBe("e1");
    expect(list[0].senderName).toBe("Alex");
  });
});

describe("filterAndSortAttachments", () => {
  const items = [
    sample({ id: "1", filename: "a.pdf", size: 100, receivedAt: "2026-07-03T00:00:00.000Z", category: "pdf" }),
    sample({ id: "2", filename: "z-receipt.pdf", size: 500, receivedAt: "2026-07-01T00:00:00.000Z", category: "receipt", senderName: "Stripe" }),
    sample({ id: "3", filename: "photo.png", size: 300, receivedAt: "2026-07-02T00:00:00.000Z", category: "image", mimeType: "image/png" }),
  ];

  it("filters by category and query", () => {
    const result = filterAndSortAttachments(items, { filter: "receipt", query: "stripe" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("sorts by size and name", () => {
    expect(filterAndSortAttachments(items, { sort: "largest" })[0].id).toBe("2");
    expect(filterAndSortAttachments(items, { sort: "name" })[0].filename).toBe("a.pdf");
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("—");
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });
});
