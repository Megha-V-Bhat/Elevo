import { BookOpen, Eye, FileText } from "lucide-react";
import { Avatar, Chip, StatusPill } from "@/components/ui/display";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { getThread } from "@/server/queries/ask";
import { EditMessage } from "./composer";

type Loaded = NonNullable<Awaited<ReturnType<typeof getThread>>>;

/** A calm conversation: no typing indicators, no read receipts beyond "Seen by your mentor". */
export function ThreadView({ data, meId, viewer }: { data: Loaded; meId: string; viewer: "MENTEE" | "MENTOR" }) {
  const { thread, messages, names, resources } = data;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusPill status={thread.status} />
        {thread.subject && <Chip tone="lilac">{thread.subject.code} · {thread.subject.name}</Chip>}
        {viewer === "MENTEE" && thread.mentor_seen_at && (
          <Chip tone="mint">
            <Eye className="size-3" aria-hidden /> Seen by your mentor
          </Chip>
        )}
      </div>
      <ol className="grid gap-4">
        {messages.map((m) => {
          const mine = m.author_id === meId;
          const isStudent = m.author_id === thread.student_id;
          const name = names.get(m.author_id) ?? (isStudent ? "Student" : "Mentor");
          const res = m.resource_id ? resources.get(m.resource_id) : null;
          return (
            <li key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")}>
              <Avatar name={name} size={36} className="mt-1" />
              <div className={cn("max-w-[min(640px,85%)] rounded-card border p-4", isStudent ? "border-line bg-surface" : "border-pine-100 bg-pine-50")}>
                <p className="text-small">
                  <span className="font-semibold text-ink-900">{mine ? "You" : name}</span>
                  <span className="text-ink-500">
                    {" "}
                    · {fmtDateTime(m.created_at)}
                    {m.edited_at && " · edited"}
                  </span>
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-body text-ink-900">{m.body}</p>
                {(m.attachment_paths.length > 0 || res) && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {m.attachment_paths.map((p) => (
                      <li key={p}>
                        <a href={`/api/files?b=ask-attachments&p=${encodeURIComponent(p)}`} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-small font-semibold text-ink-700 hover:border-pine-100">
                          <FileText className="size-4 text-pine-600" aria-hidden />
                          <span className="max-w-48 truncate">{p.split("/").pop()?.replace(/^[a-f0-9]{8}-/, "")}</span>
                        </a>
                      </li>
                    ))}
                    {res && (
                      <li>
                        <a
                          href={res.external_url ?? `/api/files?b=resources&p=${encodeURIComponent(res.file_path ?? "")}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-small font-semibold text-ink-700 hover:border-pine-100"
                        >
                          <BookOpen className="size-4 text-lilac-700" aria-hidden /> {res.title}
                        </a>
                      </li>
                    )}
                  </ul>
                )}
                {mine && <EditMessage id={m.id} body={m.body} createdAt={m.created_at} />}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
