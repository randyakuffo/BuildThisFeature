import { Paperclip } from "lucide-react";
import type { GmailEmail } from "../types";
import { PageHeader, EmptyInsights } from "../components/primitives";

export function AttachmentsView({ emails }: { emails: GmailEmail[] }) {
  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Attachment Vault" subtitle="Files detected across your inbox" />
      <EmptyInsights icon={Paperclip} label="Attachment scanning coming soon. This will show all PDFs, receipts, and documents from your emails." />
    </div>
  );
}

