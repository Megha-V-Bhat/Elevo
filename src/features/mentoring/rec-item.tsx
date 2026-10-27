"use client";

import { CalendarClock, Check, EyeOff, FileText, Lightbulb, ListChecks, MessageSquareText, Sprout, Target, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProgressRing } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Chip, StatusPill, type Tone } from "@/components/ui/display";
import { Select, Switch, Textarea } from "@/components/ui/form";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { deleteRecommendation, studentUpdateItem, updateRecommendation } from "@/server/actions/mentoring";
import type { RecRow } from "@/server/queries/mentoring";

const KIND: Record<RecRow["kind"], { label: string; icon: typeof Target; tone: Tone }> = {
  RECOMMENDATION: { label: "Recommendation", icon: Lightbulb, tone: "lilac" },
  FEEDBACK: { label: "Feedback", icon: MessageSquareText, tone: "sky" },
  GOAL: { label: "Goal", icon: Target, tone: "mint" },
  ACTION_POINT: { label: "Action point", icon: ListChecks, tone: "butter" },
  STRENGTH: { label: "Strength", icon: Sprout, tone: "mint" },
  IMPROVEMENT_AREA: { label: "Area to improve", icon: TriangleAlert, tone: "coral" },
};
const CATEGORY: Record<RecRow["category"], string> = {
  ACADEMIC_PROGRESS: "Academic progress",
  CAREER_GUIDANCE: "Career guidance",
  PERSONAL_DEVELOPMENT: "Personal development",
  STUDY_HABITS: "Study habits",
};

/** One mentoring item. Students tick steps, reflect and progress; mentors manage status and report inclusion. */
export function RecItem({ r, viewer, isNew }: { r: RecRow; viewer: "MENTEE" | "MENTOR"; isNew?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [steps, setSteps] = useState(r.steps);
  const [reflection, setReflection] = useState(r.reflection ?? "");
  const k = KIND[r.kind];
  const done = steps.filter((s) => s.done).length;
  const overdue = r.due_date && r.status !== "COMPLETED" && Date.parse(r.due_date) < Date.now();
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error?.message ?? "Something went wrong");
      toast.success(msg);
      router.refresh();
    });

  return (
    <article className={cn("rounded-card border bg-surface p-4 shadow-1 md:p-5", isNew ? "border-pine-100" : "border-line")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-control border border-line", { mint: "text-pine-600", lilac: "text-lilac-700", sky: "text-sky-700", butter: "text-butter-800", coral: "text-coral-700", pine: "text-pine-700", neutral: "text-ink-700" }[k.tone])}>
          <k.icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={k.tone}>{k.label}</Chip>
            <Chip>{CATEGORY[r.category]}</Chip>
            {r.subject && <Chip>{r.subject.code}</Chip>}
            {r.visibility === "PRIVATE_MENTOR" && (
              <Chip tone="neutral">
                <EyeOff className="size-3" aria-hidden /> Private note
              </Chip>
            )}
            {isNew && <Chip tone="pine">New</Chip>}
          </div>
          <h3 className="mt-2 font-display text-h3 font-semibold text-ink-900">{r.title}</h3>
          {r.body && <p className="mt-1 whitespace-pre-wrap text-body text-ink-700">{r.body}</p>}
          {r.target && (
            <p className="mt-2 text-small text-ink-700">
              <span className="font-semibold text-ink-900">Target:</span> {r.target}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-ink-500">
            <StatusPill status={r.status} />
            {r.due_date && (
              <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-coral-700")}>
                <CalendarClock className="size-3.5" aria-hidden /> {overdue ? "Overdue · " : "Due "}
                {fmtDate(r.due_date)}
              </span>
            )}
            {r.review_date && <span>Review {fmtDate(r.review_date)}</span>}
            <span>Added {fmtDate(r.created_at)}</span>
            {r.include_in_report && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5" aria-hidden /> In report
              </span>
            )}
          </div>
        </div>
        {steps.length > 0 && <ProgressRing value={(done / steps.length) * 100} size={48} label={`${r.title} progress`} />}
      </div>

      {steps.length > 0 && (
        <ul className="mt-4 grid gap-1.5 border-t border-line pt-3">
          {steps.map((s, i) => (
            <li key={i}>
              <label className={cn("flex min-h-11 items-center gap-3 rounded-control px-2", viewer === "MENTEE" && r.visibility === "SHARED" && "cursor-pointer hover:bg-canvas-sunk")}>
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={viewer !== "MENTEE" || pending}
                  onChange={(e) => {
                    const next = steps.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x));
                    setSteps(next);
                    run(() => studentUpdateItem(r.id, r.status === "PENDING" ? "IN_PROGRESS" : r.status, next), e.target.checked ? "Step done" : "Step reopened");
                  }}
                  className="size-5 accent-pine-600"
                />
                <span className={cn("text-body", s.done ? "text-ink-500 line-through" : "text-ink-900")}>{s.label}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {viewer === "MENTEE" && r.visibility === "SHARED" && (r.kind === "GOAL" || r.kind === "ACTION_POINT" || r.kind === "RECOMMENDATION") && (
        <div className="mt-4 grid gap-3 border-t border-line pt-4">
          {(r.kind === "GOAL" || reflection) && (
            <div>
              <label htmlFor={`refl-${r.id}`} className="text-small font-semibold text-ink-900">
                Your reflection
              </label>
              <Textarea id={`refl-${r.id}`} rows={2} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="How is it going? What helped?" className="mt-1.5" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {r.status === "PENDING" && (
              <Button size="sm" variant="tonal" loading={pending} onClick={() => run(() => studentUpdateItem(r.id, "IN_PROGRESS", steps, reflection), "Marked in progress")}>
                Start
              </Button>
            )}
            {r.kind !== "GOAL" && r.status !== "COMPLETED" && (
              <Button size="sm" loading={pending} onClick={() => run(() => studentUpdateItem(r.id, "COMPLETED", steps, reflection), "Marked done")}>
                <Check /> Mark done
              </Button>
            )}
            {reflection !== (r.reflection ?? "") && (
              <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => studentUpdateItem(r.id, r.status, steps, reflection), "Reflection saved")}>
                Save reflection
              </Button>
            )}
            {r.kind === "GOAL" && r.status !== "COMPLETED" && <p className="self-center text-small text-ink-500">Your mentor confirms when a goal is complete.</p>}
          </div>
        </div>
      )}

      {viewer === "MENTOR" && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          {r.reflection && (
            <p className="text-small text-ink-700 sm:max-w-md">
              <span className="font-semibold text-ink-900">Student reflection:</span> {r.reflection}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            {r.visibility === "SHARED" && (
              <div className="w-56">
                <Switch id={`rep-${r.id}`} checked={r.include_in_report} onChange={(v) => run(() => updateRecommendation(r.id, { include_in_report: v }), v ? "Included in PDF report" : "Removed from PDF report")} label="Include in report" />
              </div>
            )}
            <Select aria-label="Status" className="h-10 w-40" value={r.status} disabled={pending} onChange={(e) => run(() => updateRecommendation(r.id, { status: e.target.value }), "Status updated")}>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </Select>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label="Delete"
              onClick={() =>
                toast("Delete this item?", {
                  description: r.title,
                  action: { label: "Delete", onClick: () => run(() => deleteRecommendation(r.id), "Deleted") },
                })
              }
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
