import { Download, ExternalLink, FileText, Image as ImageIcon, Link2, Presentation, Sheet } from "lucide-react";
import { Chip } from "@/components/ui/display";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ResourceRow } from "@/server/queries/mentoring";

const iconFor = (r: ResourceRow) =>
  r.external_url ? Link2 : r.mime?.startsWith("image/") ? ImageIcon : r.mime?.includes("presentation") || r.mime?.includes("powerpoint") ? Presentation : r.mime?.includes("sheet") || r.mime?.includes("excel") ? Sheet : FileText;

const size = (b: number | null) => (b == null ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function ResourceCard({ r, isNew, footer, target }: { r: ResourceRow; isNew?: boolean; footer?: React.ReactNode; target?: string }) {
  const Icon = iconFor(r);
  const fileUrl = r.file_path ? `/api/files?b=resources&p=${encodeURIComponent(r.file_path)}` : null;
  const previewable = r.mime === "application/pdf" || r.mime?.startsWith("image/");
  return (
    <article className={cn("flex flex-col rounded-card border bg-surface p-4 shadow-1", isNew ? "border-pine-100" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-control bg-lilac-50 text-lilac-700">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
          {isNew && <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-surface bg-pine-600" aria-label="New" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink-900">{r.title}</h3>
          <p className="text-small text-ink-500">
            {fmtDate(r.created_at)}
            {r.size_bytes ? ` · ${size(r.size_bytes)}` : ""}
            {target ? ` · ${target}` : ""}
          </p>
        </div>
      </div>
      {r.instructions && <p className="mt-3 line-clamp-4 text-small text-ink-700">{r.instructions}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {r.subject && <Chip>{r.subject.code}</Chip>}
        {isNew && <Chip tone="pine">New</Chip>}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {r.external_url && (
          <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-small font-semibold text-ink-900 hover:border-pine-100 hover:bg-pine-50">
            <ExternalLink className="size-4" /> Open link
          </a>
        )}
        {fileUrl && previewable && (
          <a href={fileUrl} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-line px-3 text-small font-semibold text-ink-900 hover:border-pine-100 hover:bg-pine-50">
            <ExternalLink className="size-4" /> Preview
          </a>
        )}
        {fileUrl && (
          <a href={`${fileUrl}&dl=1`} className="inline-flex min-h-10 items-center gap-1.5 rounded-control bg-pine-600 px-3 text-small font-semibold text-white hover:bg-pine-700">
            <Download className="size-4" /> Download
          </a>
        )}
        {footer}
      </div>
    </article>
  );
}
