"use client";

import { CalendarPlus, CheckCircle2, PenLine, Plus, Trash2, Upload, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select, Switch, Textarea } from "@/components/ui/form";
import { linkThread } from "@/server/actions/ask";
import { completeSession, createRecommendation, rescheduleSession, scheduleSession, uploadResource } from "@/server/actions/mentoring";

type Opt = { id: string; label: string };

export type RecPrefill = { kind?: string; title?: string; body?: string; subject_id?: string; source?: "MANUAL" | "ASK_THREAD" | "PLANNER" | "SESSION"; source_id?: string; target?: string };

const KINDS = [
  ["FEEDBACK", "Feedback"],
  ["RECOMMENDATION", "Recommendation"],
  ["GOAL", "Goal / improvement plan"],
  ["ACTION_POINT", "Action point"],
  ["STRENGTH", "Strength"],
  ["IMPROVEMENT_AREA", "Area to improve"],
] as const;

export function RecComposer({
  students,
  studentId,
  subjects,
  prefill,
  trigger,
  autoOpenParam,
}: {
  students?: Opt[];
  studentId?: string;
  subjects: Opt[];
  prefill?: RecPrefill;
  trigger?: React.ReactNode;
  autoOpenParam?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const blank = { student_id: studentId ?? "", kind: prefill?.kind ?? "FEEDBACK", category: "ACADEMIC_PROGRESS", title: prefill?.title ?? "", body: prefill?.body ?? "", subject_id: prefill?.subject_id ?? "", due_date: "", review_date: "", visibility: "SHARED", include_in_report: false, target: prefill?.target ?? "" };
  const [v, setV] = useState(blank);
  const [steps, setSteps] = useState<string[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (autoOpenParam && params.get(autoOpenParam) === "1") setOpen(true);
  }, [params, autoOpenParam]);
  const isGoal = v.kind === "GOAL";
  const submit = () =>
    start(async () => {
      const r = await createRecommendation({
        ...v,
        subject_id: v.subject_id || null,
        steps: steps.filter(Boolean).map((label) => ({ label, done: false })),
        source: prefill?.source ?? "MANUAL",
        source_id: prefill?.source_id ?? null,
      });
      if (!r.ok) {
        setErrs(r.error.fieldErrors ?? {});
        return void toast.error(r.error.message);
      }
      toast.success(v.visibility === "SHARED" ? "Shared with the student" : "Private note saved");
      setOpen(false);
      setV(blank);
      setSteps([]);
      router.refresh();
    });
  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <PenLine /> {prefill?.source === "ASK_THREAD" ? "Convert to recommendation" : prefill?.source === "PLANNER" ? "Turn into a goal" : "New recommendation"}
        </Button>
      )}
      <BottomSheet open={open} onOpenChange={setOpen} title={prefill?.source === "PLANNER" ? "Set a goal from this plan" : "Write a recommendation"} description="Shared items notify the student. Private notes are visible only to you.">
        <div className="grid gap-4">
          {students && (
            <Field label="Mentee" htmlFor="rc-student" required error={errs.student_id}>
              <Select value={v.student_id} onChange={(e) => setV({ ...v, student_id: e.target.value })}>
                <option value="">Choose a mentee…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="rc-kind">
              <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
                {KINDS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category" htmlFor="rc-cat">
              <Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
                <option value="ACADEMIC_PROGRESS">Academic progress</option>
                <option value="CAREER_GUIDANCE">Career guidance</option>
                <option value="PERSONAL_DEVELOPMENT">Personal development</option>
                <option value="STUDY_HABITS">Study habits</option>
              </Select>
            </Field>
          </div>
          <Field label="Title" htmlFor="rc-title" required error={errs.title}>
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={160} />
          </Field>
          <Field label="Details" htmlFor="rc-body" optional>
            <Textarea rows={4} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} maxLength={5000} />
          </Field>
          {isGoal && (
            <>
              <Field label="Measurable target" htmlFor="rc-target" optional helper="e.g. “60%+ in DBMS SEE”">
                <Input value={v.target} onChange={(e) => setV({ ...v, target: e.target.value })} />
              </Field>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-small font-semibold text-ink-900">Steps</legend>
                {steps.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input aria-label={`Step ${i + 1}`} value={s} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? e.target.value : x)))} />
                    <Button variant="ghost" size="icon" aria-label={`Remove step ${i + 1}`} onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setSteps([...steps, ""])} disabled={steps.length >= 12}>
                  <Plus /> Add a step
                </Button>
              </fieldset>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Subject" htmlFor="rc-subj" optional>
              <Select value={v.subject_id} onChange={(e) => setV({ ...v, subject_id: e.target.value })}>
                <option value="">None</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date" htmlFor="rc-due" optional>
              <Input type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
            </Field>
            <Field label="Review date" htmlFor="rc-review" optional>
              <Input type="date" value={v.review_date} onChange={(e) => setV({ ...v, review_date: e.target.value })} />
            </Field>
          </div>
          <Segmented
            label="Visibility"
            value={v.visibility as "SHARED" | "PRIVATE_MENTOR"}
            onChange={(x) => setV({ ...v, visibility: x, include_in_report: x === "SHARED" && v.include_in_report })}
            options={[
              { value: "SHARED", label: "Share with student" },
              { value: "PRIVATE_MENTOR", label: "Private note" },
            ]}
          />
          {v.visibility === "SHARED" && <Switch id="rc-report" checked={v.include_in_report} onChange={(x) => setV({ ...v, include_in_report: x })} label="Include in PDF report" description="Only shared items can appear in the student report." />}
          <Button size="lg" loading={pending} onClick={submit}>
            Save
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

export function SessionScheduler({ students, studentId, sourceThreadId, autoOpenParam, label }: { students?: Opt[]; studentId?: string; sourceThreadId?: string; autoOpenParam?: string; label?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState({ student_id: studentId ?? "", date: "", time: "16:00", duration_min: "30", mode: "IN_PERSON" as "IN_PERSON" | "ONLINE", location_or_link: "", agenda: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (autoOpenParam && params.get(autoOpenParam) === "1") setOpen(true);
  }, [params, autoOpenParam]);
  return (
    <>
      <Button variant={sourceThreadId ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        <CalendarPlus /> {label ?? "Schedule a session"}
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Schedule a session" description="The student is notified and can add it to their calendar.">
        <div className="grid gap-4">
          {students && (
            <Field label="Mentee" htmlFor="ss-student" required error={errs.student_id}>
              <Select value={v.student_id} onChange={(e) => setV({ ...v, student_id: e.target.value })}>
                <option value="">Choose a mentee…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Date" htmlFor="ss-date" required error={errs.scheduled_at}>
              <Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
            </Field>
            <Field label="Time" htmlFor="ss-time" required>
              <Input type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} />
            </Field>
            <Field label="Minutes" htmlFor="ss-dur">
              <Select value={v.duration_min} onChange={(e) => setV({ ...v, duration_min: e.target.value })}>
                {[15, 30, 45, 60, 90].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Segmented
            label="Mode"
            value={v.mode}
            onChange={(m) => setV({ ...v, mode: m })}
            options={[
              { value: "IN_PERSON", label: "In person" },
              { value: "ONLINE", label: "Online" },
            ]}
          />
          <Field label={v.mode === "ONLINE" ? "Meeting link" : "Location"} htmlFor="ss-loc" optional>
            <Input value={v.location_or_link} onChange={(e) => setV({ ...v, location_or_link: e.target.value })} placeholder={v.mode === "ONLINE" ? "https://meet.google.com/…" : "Staff room, Block B"} />
          </Field>
          <Field label="Agenda" htmlFor="ss-agenda" optional>
            <Textarea rows={3} value={v.agenda} onChange={(e) => setV({ ...v, agenda: e.target.value })} />
          </Field>
          <Button
            size="lg"
            loading={pending}
            onClick={() =>
              start(async () => {
                if (!v.date) return void setErrs({ scheduled_at: "Choose a date" });
                const at = new Date(`${v.date}T${v.time}:00+05:30`).toISOString();
                const r = await scheduleSession({ ...v, scheduled_at: at, source_thread_id: sourceThreadId ?? null });
                if (!r.ok) {
                  setErrs(r.error.fieldErrors ?? {});
                  return void toast.error(r.error.message);
                }
                if (sourceThreadId) await linkThread(sourceThreadId, { session_id: r.data });
                toast.success("Session scheduled");
                setOpen(false);
                router.refresh();
              })
            }
          >
            Schedule
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

export function SessionActions({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState("");
  const [items, setItems] = useState<string[]>([""]);
  const [follow, setFollow] = useState("");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CheckCircle2 /> Complete
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          toast("Cancel this session?", {
            action: {
              label: "Cancel session",
              onClick: () =>
                start(async () => {
                  const r = await rescheduleSession(id, null, true);
                  if (!r.ok) return void toast.error(r.error.message);
                  toast.success("Session cancelled — the student was notified");
                  router.refresh();
                }),
            },
          })
        }
      >
        Cancel
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Complete session" description="Action items become trackable action points for the student.">
        <div className="grid gap-4">
          <Field label="Summary" htmlFor="cs-sum" required>
            <Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-small font-semibold text-ink-900">Action items</legend>
            {items.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input aria-label={`Action item ${i + 1}`} value={s} onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} />
                <Button variant="ghost" size="icon" aria-label={`Remove item ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setItems([...items, ""])}>
              <Plus /> Add an item
            </Button>
          </fieldset>
          <Field label="Next follow-up" htmlFor="cs-follow" optional>
            <Input type="date" value={follow} onChange={(e) => setFollow(e.target.value)} />
          </Field>
          <Button
            size="lg"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await completeSession({ id, summary, action_items: items.filter((x) => x.trim()), next_follow_up_date: follow || null });
                if (!r.ok) return void toast.error(r.error.message);
                toast.success("Session completed");
                setOpen(false);
                router.refresh();
              })
            }
          >
            Save summary
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

export function ResourceUploader({ students, subjects, studentId, autoOpenParam }: { students: Opt[]; subjects: Opt[]; studentId?: string; autoOpenParam?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState({ title: "", instructions: "", student_id: studentId ?? "", subject_id: "", external_url: "" });
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoOpenParam && params.get(autoOpenParam) === "1") setOpen(true);
  }, [params, autoOpenParam]);
  const pick = (f?: File | null) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return void toast.error("Files must be 25 MB or smaller.");
    setFile(f);
    if (!v.title) setV((x) => ({ ...x, title: f.name.replace(/\.[^.]+$/, "") }));
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload /> Upload resource
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Share a resource" description="PDF, slides, documents, spreadsheets or images up to 25 MB — or a link.">
        <div className="grid gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center justify-center rounded-panel border-2 border-dashed p-6 text-center transition-colors ${drag ? "border-pine-600 bg-pine-50" : "border-line-strong bg-canvas"}`}
          >
            <Upload className="size-6 text-pine-600" aria-hidden />
            {file ? (
              <p className="mt-2 font-semibold text-ink-900">
                {file.name} <span className="font-normal text-ink-500">· {(file.size / 1048576).toFixed(1)} MB</span>
              </p>
            ) : (
              <p className="mt-2 text-small text-ink-700">Drag a file here, or</p>
            )}
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}>
                {file ? "Choose another" : "Browse files"}
              </Button>
              {file && (
                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Remove
                </Button>
              )}
            </div>
            <input ref={ref} type="file" className="sr-only" tabIndex={-1} accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" onChange={(e) => pick(e.target.files?.[0])} />
            {errs.file && <p className="mt-2 text-small font-medium text-coral-700">{errs.file}</p>}
          </div>
          <Field label="…or a link" htmlFor="ru-url" optional error={errs.external_url}>
            <Input type="url" value={v.external_url} onChange={(e) => setV({ ...v, external_url: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Title" htmlFor="ru-title" required error={errs.title}>
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Instructions" htmlFor="ru-inst" optional helper="How should the student use this?">
            <Textarea rows={3} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Share with" htmlFor="ru-target">
              <Select value={v.student_id} onChange={(e) => setV({ ...v, student_id: e.target.value })}>
                <option value="">All my mentees</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject" htmlFor="ru-subj" optional>
              <Select value={v.subject_id} onChange={(e) => setV({ ...v, subject_id: e.target.value })}>
                <option value="">None</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button
            size="lg"
            loading={pending}
            onClick={() =>
              start(async () => {
                const fd = new FormData();
                Object.entries(v).forEach(([k, x]) => fd.set(k, x));
                if (file) fd.set("file", file);
                const r = await uploadResource(fd);
                if (!r.ok) {
                  setErrs(r.error.fieldErrors ?? {});
                  return void toast.error(r.error.message);
                }
                toast.success("Resource shared");
                setOpen(false);
                setFile(null);
                setV({ title: "", instructions: "", student_id: studentId ?? "", subject_id: "", external_url: "" });
                router.refresh();
              })
            }
          >
            {pending ? "Uploading…" : "Share resource"}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
