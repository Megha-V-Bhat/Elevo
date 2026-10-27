"use client";

import { Paperclip, Pencil, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createThread, editMessage, replyToThread, setThreadStatus } from "@/server/actions/ask";

function FilePicker({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        multiple
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          const tooBig = picked.find((f) => f.size > 10 * 1024 * 1024);
          if (tooBig) return void toast.error(`${tooBig.name} is over 10 MB`);
          setFiles([...files, ...picked].slice(0, 3));
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.click()} disabled={files.length >= 3}>
          <Paperclip /> Attach ({files.length}/3)
        </Button>
        {files.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-canvas-sunk py-1 pr-1 pl-3 text-small text-ink-700">
            <span className="max-w-40 truncate">{f.name}</span>
            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="flex size-7 items-center justify-center rounded-full hover:bg-line">
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>
      <p className="mt-1 text-[12px] text-ink-500">PDF or images, up to 10 MB each.</p>
    </div>
  );
}

const DRAFT_KEY = "elevo:ask-draft";

export function NewThreadForm({ subjects }: { subjects: { id: string; label: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (d) {
        setTitle(d.title ?? "");
        setBody(d.body ?? "");
        setSubject(d.subject ?? "");
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body, subject }));
    } catch {}
  }, [title, body, subject]);
  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("title", title);
        fd.set("body", body);
        fd.set("subject_id", subject);
        files.forEach((f) => fd.append("files", f));
        start(async () => {
          const r = await createThread(fd);
          if (!r.ok) {
            setErrs(r.error.fieldErrors ?? {});
            return void toast.error(r.error.message);
          }
          try {
            localStorage.removeItem(DRAFT_KEY);
          } catch {}
          toast.success("Sent to your mentor");
          router.push(`/mentee/ask/${r.data}`);
        });
      }}
    >
      <Field label="Title" htmlFor="title" required error={errs.title} helper="One line that sums up your question.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="How should I revise normalisation for SEE?" />
      </Field>
      <Field label="Subject" htmlFor="subject" optional>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">General / not subject-specific</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Your question" htmlFor="body" required error={errs.body}>
        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="What have you tried so far? Where exactly are you stuck?" />
      </Field>
      <FilePicker files={files} setFiles={setFiles} />
      <Button type="submit" size="lg" loading={pending} className="justify-self-start">
        <Send /> Send to my mentor
      </Button>
    </form>
  );
}

export function ReplyBox({ threadId, resources }: { threadId: string; resources?: { id: string; title: string }[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [resource, setResource] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 rounded-card border border-line bg-surface p-4 shadow-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("thread_id", threadId);
        fd.set("body", body);
        if (resource) fd.set("resource_id", resource);
        files.forEach((f) => fd.append("files", f));
        start(async () => {
          const r = await replyToThread(fd);
          if (!r.ok) return void toast.error(r.error.message);
          setBody("");
          setFiles([]);
          setResource("");
          router.refresh();
        });
      }}
    >
      <label htmlFor="reply" className="sr-only">
        Reply
      </label>
      <Textarea id="reply" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" maxLength={5000} />
      {resources && resources.length > 0 && (
        <Select aria-label="Attach one of your resources" value={resource} onChange={(e) => setResource(e.target.value)}>
          <option value="">Attach one of your resources (optional)</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </Select>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilePicker files={files} setFiles={setFiles} />
        <Button type="submit" loading={pending} disabled={!body.trim()}>
          <Send /> Send
        </Button>
      </div>
    </form>
  );
}

export function EditMessage({ id, body, createdAt }: { id: string; body: string; createdAt: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(body);
  const [pending, start] = useTransition();
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  if (!now || now - Date.parse(createdAt) > 10 * 60_000) return null;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-8 items-center gap-1 rounded-control px-2 text-small font-semibold text-ink-500 hover:bg-canvas-sunk">
        <Pencil className="size-3.5" /> Edit
      </button>
    );
  return (
    <div className="mt-2 grid gap-2">
      <Textarea aria-label="Edit message" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await editMessage(id, text);
              if (!r.ok) return void toast.error(r.error.message);
              setOpen(false);
              router.refresh();
            })
          }
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ResolveButton({ threadId, status }: { threadId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const resolve = status !== "RESOLVED";
  return (
    <Button
      variant={resolve ? "tonal" : "secondary"}
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await setThreadStatus(threadId, resolve ? "RESOLVED" : "OPEN");
          if (!r.ok) return void toast.error(r.error.message);
          toast.success(resolve ? "Marked resolved" : "Reopened");
          router.refresh();
        })
      }
    >
      {resolve ? "Mark resolved" : "Reopen"}
    </Button>
  );
}
