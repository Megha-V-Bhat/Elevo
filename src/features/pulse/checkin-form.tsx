"use client";

import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Segmented, Switch, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { savePulse } from "@/server/actions/pulse";
import { MOOD_TEXT, MoodFace } from "./faces";

type Initial = {
  mood: number | null;
  workload: "LIGHT" | "OKAY" | "HEAVY" | null;
  subject_confidence: { subject_id: string; subject: string; score: number }[];
  help_note: string | null;
  share_note: boolean;
};

export function CheckinForm({ initial, subjects, mentorName }: { initial: Initial; subjects: { id: string; name: string }[]; mentorName: string | null }) {
  const router = useRouter();
  const [mood, setMood] = useState<number | null>(initial.mood);
  const [workload, setWorkload] = useState<Initial["workload"]>(initial.workload);
  const [conf, setConf] = useState<Record<string, number>>(Object.fromEntries(initial.subject_confidence.map((c) => [c.subject_id, c.score])));
  const [note, setNote] = useState(initial.help_note ?? "");
  const [share, setShare] = useState(initial.share_note);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const editing = initial.mood != null;

  const submit = () =>
    start(async () => {
      const r = await savePulse({
        mood,
        workload,
        subject_confidence: subjects.filter((s) => conf[s.id]).map((s) => ({ subject_id: s.id, subject: s.name, score: conf[s.id] })),
        help_note: note,
        share_note: share,
      });
      if (!r.ok) {
        setErrors(r.error.fieldErrors ?? {});
        return void toast.error(r.error.message);
      }
      setErrors({});
      toast.success(editing ? "Check-in updated" : "Thanks — see you next week");
      router.refresh();
    });

  return (
    <div className="grid gap-7">
      <fieldset>
        <legend className="font-display text-h3 font-semibold text-ink-900">1. How did this week feel?</legend>
        <div role="radiogroup" aria-label="How did this week feel?" className="mt-3 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mood === m}
              onClick={() => setMood(m)}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-panel border-2 bg-surface p-2 transition-all duration-[140ms] ease-grow",
                mood === m ? "border-pine-600 bg-pine-50 shadow-2" : "border-line hover:border-pine-100",
              )}
            >
              <MoodFace mood={m} size={40} className={cn("transition-transform", mood === m && "scale-110")} />
              <span className={cn("text-small font-semibold", mood === m ? "text-pine-700" : "text-ink-700")}>{MOOD_TEXT[m]}</span>
            </button>
          ))}
        </div>
        {errors.mood && <p className="mt-1.5 text-small font-medium text-coral-700">{errors.mood}</p>}
      </fieldset>

      <fieldset>
        <legend className="font-display text-h3 font-semibold text-ink-900">2. Workload</legend>
        <Segmented
          className="mt-3 w-full sm:w-auto [&>button]:flex-1 [&>button]:min-h-11 [&>button]:px-6"
          label="Workload"
          value={workload ?? ("" as "LIGHT")}
          onChange={(v) => setWorkload(v)}
          options={[
            { value: "LIGHT", label: "Light" },
            { value: "OKAY", label: "Okay" },
            { value: "HEAVY", label: "Heavy" },
          ]}
        />
        {errors.workload && <p className="mt-1.5 text-small font-medium text-coral-700">{errors.workload}</p>}
      </fieldset>

      {subjects.length > 0 && (
        <fieldset>
          <legend className="font-display text-h3 font-semibold text-ink-900">
            3. Confidence per subject <span className="text-body font-medium text-ink-500">(optional)</span>
          </legend>
          <p className="text-small text-ink-500">1 = not confident, 5 = very confident. Skip any you like.</p>
          <ul className="mt-3 grid gap-2">
            {subjects.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 rounded-panel bg-canvas-sunk p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-body font-semibold text-ink-900">{s.name}</span>
                <div role="radiogroup" aria-label={`Confidence in ${s.name}`} className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={conf[s.id] === n}
                      aria-label={`${n} of 5`}
                      onClick={() => setConf((c) => ({ ...c, [s.id]: c[s.id] === n ? 0 : n }))}
                      className={cn(
                        "size-11 rounded-full text-small font-bold tnum transition-colors",
                        conf[s.id] === n ? "bg-pine-600 text-white" : conf[s.id] > n ? "bg-mint-100 text-pine-700" : "border border-line bg-surface text-ink-700",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="grid gap-3">
        <Field label="I could use help with…" htmlFor="help_note" optional helper="A sentence is enough.">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
        <div className="rounded-panel border border-line p-3.5">
          <Switch id="share_note" checked={share} onChange={setShare} label={`Share this note with ${mentorName ?? "my mentor"}`} description="Off keeps the note private to you. Your mood and workload are always visible to your mentor." />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" onClick={submit} loading={pending} disabled={!mood || !workload}>
          <Check /> {editing ? "Update check-in" : "Send check-in"}
        </Button>
        <p className="flex items-center gap-1.5 text-small text-ink-500">
          <Lock className="size-3.5" aria-hidden /> Only you and your current mentor see check-ins. Never in reports, never ranked.
        </p>
      </div>
    </div>
  );
}
