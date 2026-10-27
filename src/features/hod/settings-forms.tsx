"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { explain, type GradingScheme } from "@/lib/engine/grading";
import { saveDepartment, saveGradingScheme, saveSections, saveSetting, saveThresholds } from "@/server/admin/actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string; fieldErrors?: Record<string, string> } }>, msg: string, onErr?: (e: Record<string, string>) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        onErr?.(r.error?.fieldErrors ?? {});
        return void toast.error(r.error?.message ?? "Couldn't save");
      }
      toast.success(msg);
      router.refresh();
    });
  return { pending, run };
}

export function GradingEditor({ scheme, version }: { scheme: GradingScheme & { name: string }; version: number | null }) {
  const [s, setS] = useState(scheme);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [sample, setSample] = useState({ mse: "38", mseMax: "50", see: "61", seeMax: "100", ia: "17", iaMax: "20" });
  const { pending, run } = useRun();
  const preview = useMemo(() => {
    const n = (x: string) => (x === "" ? null : Number(x));
    return explain({ has_mse: true, has_see: true, mse_marks: n(sample.mse), mse_max: n(sample.mseMax), see_marks: n(sample.see), see_max: n(sample.seeMax), ia: s.ia_weight > 0 ? [{ label: "IA", marks: n(sample.ia), max: n(sample.iaMax) }] : [] }, s);
  }, [s, sample]);
  const sum = Math.round((s.mse_weight + s.see_weight + s.ia_weight) * 1000) / 1000;
  const setBand = (i: number, patch: Partial<GradingScheme["bands"][number]>) => setS({ ...s, bands: s.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  return (
    <Card>
      <h2 className="font-display text-h3 font-semibold text-ink-900">Grading scheme</h2>
      <p className="mt-1 text-small text-ink-500">
        Currently {version ? `version ${version}` : "using the built-in default"}. Saving creates a new version; finalized records are never rewritten.
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-4">
          <Field label="Scheme name" htmlFor="gs-name">
            <Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            {(["mse_weight", "see_weight", "ia_weight"] as const).map((k) => (
              <Field key={k} label={`${k.split("_")[0].toUpperCase()} weight`} htmlFor={`gs-${k}`} error={k === "see_weight" ? errs.see_weight : undefined}>
                <Input inputMode="decimal" value={s[k]} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) || 0 })} />
              </Field>
            ))}
          </div>
          <p className={`text-small ${Math.abs(sum - 1) < 0.001 ? "text-pine-700" : "font-semibold text-coral-700"}`}>Weights add up to {sum} {Math.abs(sum - 1) < 0.001 ? "✓" : "(must be 1)"}</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Pass %" htmlFor="gs-pass">
              <Input inputMode="decimal" value={s.pass_pct} onChange={(e) => setS({ ...s, pass_pct: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="SEE minimum %" htmlFor="gs-seemin" optional>
              <Input inputMode="decimal" value={s.see_min_pct ?? ""} onChange={(e) => setS({ ...s, see_min_pct: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Max points" htmlFor="gs-max">
              <Input inputMode="decimal" value={s.max_points} onChange={(e) => setS({ ...s, max_points: Number(e.target.value) || 10 })} />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-small font-semibold text-ink-900">Grade bands {errs.bands && <span className="font-medium text-coral-700">— {errs.bands}</span>}</legend>
            <div className="overflow-x-auto rounded-panel border border-line">
              <table className="w-full text-small">
                <thead className="bg-canvas-sunk text-left text-ink-700">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">From %</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Grade</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Points</th>
                    <th scope="col" className="px-3 py-2"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {s.bands.map((b, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-2 py-1.5">
                        <Input aria-label={`Band ${i + 1} from percent`} inputMode="decimal" className="h-9" value={b.min_pct} onChange={(e) => setBand(i, { min_pct: Number(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label={`Band ${i + 1} grade`} className="h-9" value={b.grade} onChange={(e) => setBand(i, { grade: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input aria-label={`Band ${i + 1} points`} inputMode="decimal" className="h-9" value={b.points} onChange={(e) => setBand(i, { points: Number(e.target.value) || 0 })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <Button variant="ghost" size="iconSm" aria-label={`Remove band ${b.grade}`} onClick={() => setS({ ...s, bands: s.bands.filter((_, j) => j !== i) })}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setS({ ...s, bands: [...s.bands, { min_pct: 0, grade: "", points: 0 }] })}>
              <Plus /> Add band
            </Button>
          </fieldset>
        </div>
        <div className="grid content-start gap-4 rounded-panel bg-mint-50 p-4">
          <h3 className="font-semibold text-ink-900">Live preview</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="MSE" htmlFor="pv-mse">
              <div className="flex items-center gap-1">
                <Input inputMode="decimal" value={sample.mse} onChange={(e) => setSample({ ...sample, mse: e.target.value })} className="h-10" />
                <span className="text-ink-500">/</span>
                <Input aria-label="MSE max" inputMode="decimal" value={sample.mseMax} onChange={(e) => setSample({ ...sample, mseMax: e.target.value })} className="h-10" />
              </div>
            </Field>
            <Field label="SEE" htmlFor="pv-see">
              <div className="flex items-center gap-1">
                <Input inputMode="decimal" value={sample.see} onChange={(e) => setSample({ ...sample, see: e.target.value })} className="h-10" />
                <span className="text-ink-500">/</span>
                <Input aria-label="SEE max" inputMode="decimal" value={sample.seeMax} onChange={(e) => setSample({ ...sample, seeMax: e.target.value })} className="h-10" />
              </div>
            </Field>
            {s.ia_weight > 0 && (
              <Field label="IA" htmlFor="pv-ia">
                <div className="flex items-center gap-1">
                  <Input inputMode="decimal" value={sample.ia} onChange={(e) => setSample({ ...sample, ia: e.target.value })} className="h-10" />
                  <span className="text-ink-500">/</span>
                  <Input aria-label="IA max" inputMode="decimal" value={sample.iaMax} onChange={(e) => setSample({ ...sample, iaMax: e.target.value })} className="h-10" />
                </div>
              </Field>
            )}
          </div>
          <p role="status" className="rounded-panel bg-surface p-3 font-semibold text-ink-900 tnum">
            {preview}
          </p>
          <div className="grid gap-2">
            <Button loading={pending} onClick={() => run(() => saveGradingScheme(s, true), "New scheme version is active — drafts will use it", setErrs)}>
              Save as new active version
            </Button>
            <Button variant="secondary" loading={pending} onClick={() => run(() => saveGradingScheme(s, false), "Saved as an inactive draft version", setErrs)}>
              Save as draft version
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

const T_LABELS: Record<string, [string, string]> = {
  strong_pct: ["Strong subject at or above (%)", "Both MSE and SEE must reach this"],
  decline_pts: ["Decline of at least (points)", "Between comparable MSE and SEE"],
  sgpa_change: ["SGPA change of at least", "Semester over semester"],
  needs_attention_pct: ["Needs attention below (%)", "Weighted total"],
  low_pct: ["Low mark below (%)", "For the repeated-low-marks flag"],
  low_count: ["Repeated low marks count", "Assessments below the low mark"],
  profile_incomplete_days: ["Incomplete profile after (days)", "Before it's flagged"],
};

export function ThresholdsForm({ initial }: { initial: Record<string, number> }) {
  const [v, setV] = useState(initial);
  const { pending, run } = useRun();
  return (
    <Card>
      <h2 className="font-display text-h3 font-semibold text-ink-900">Insight & risk thresholds</h2>
      <p className="mt-1 text-small text-ink-500">Transparent rules — every flag shows students and mentors which threshold it used.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.entries(T_LABELS).map(([k, [l, h]]) => (
          <Field key={k} label={l} htmlFor={`t-${k}`} helper={h}>
            <Input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
          </Field>
        ))}
      </div>
      <Button className="mt-5" loading={pending} onClick={() => run(() => saveThresholds(v), "Thresholds saved")}>
        Save thresholds
      </Button>
    </Card>
  );
}

export function StructureForm({ department, institution, sections, totalCredits }: { department: string; institution: string; sections: string[]; totalCredits: number }) {
  const [d, setD] = useState({ department, institution });
  const [secs, setSecs] = useState(sections);
  const [credits, setCredits] = useState(String(totalCredits));
  const { pending, run } = useRun();
  return (
    <Card>
      <h2 className="font-display text-h3 font-semibold text-ink-900">Department structure</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Department name" htmlFor="st-dept">
          <Input value={d.department} onChange={(e) => setD({ ...d, department: e.target.value })} />
        </Field>
        <Field label="Institution" htmlFor="st-inst" helper="Shown on PDF reports.">
          <Input value={d.institution} onChange={(e) => setD({ ...d, institution: e.target.value })} />
        </Field>
        <Field label="Sections" htmlFor="st-secs" helper="Press Enter after each.">
          <TagInput id="st-secs" value={secs} onChange={setSecs} />
        </Field>
        <Field label="Total programme credits" htmlFor="st-credits" helper="Used for credit paths and the planner.">
          <Input inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      <Button
        className="mt-5"
        loading={pending}
        onClick={() =>
          run(async () => {
            const a = await saveDepartment(d.department, d.institution);
            if (!a.ok) return a;
            const b = await saveSections(secs);
            if (!b.ok) return b;
            return saveSetting("program_total_credits", Number(credits));
          }, "Structure saved")
        }
      >
        Save structure
      </Button>
    </Card>
  );
}

export function ProfileFieldsForm({ initial }: { initial: { dob: boolean; gender: boolean; address: boolean } }) {
  const [v, setV] = useState(initial);
  const { pending, run } = useRun();
  return (
    <Card>
      <h2 className="font-display text-h3 font-semibold text-ink-900">Optional profile fields</h2>
      <p className="mt-1 text-small text-ink-500">Collect only what mentoring needs. These stay optional for students even when shown.</p>
      <div className="mt-5 grid gap-4">
        <Switch id="pf-dob" checked={v.dob} onChange={(x) => setV({ ...v, dob: x })} label="Date of birth" />
        <Switch id="pf-gender" checked={v.gender} onChange={(x) => setV({ ...v, gender: x })} label="Gender" />
        <Switch id="pf-address" checked={v.address} onChange={(x) => setV({ ...v, address: x })} label="Address" />
      </div>
      <Button className="mt-5" loading={pending} onClick={() => run(() => saveSetting("optional_profile_fields", v), "Profile fields saved")}>
        Save
      </Button>
    </Card>
  );
}

export function PulseForm({ weekStart, reminders }: { weekStart: number; reminders: boolean }) {
  const [day, setDay] = useState(String(weekStart));
  const [on, setOn] = useState(reminders);
  const { pending, run } = useRun();
  return (
    <Card>
      <h2 className="font-display text-h3 font-semibold text-ink-900">Weekly Pulse</h2>
      <p className="mt-1 text-small text-ink-500">The reminder goes out once on the first day of each Pulse week (the daily job runs at about 9:00 AM IST).</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Week starts on" htmlFor="pl-day">
          <Select value={day} onChange={(e) => setDay(e.target.value)}>
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <div className="self-end">
          <Switch id="pl-rem" checked={on} onChange={setOn} label="Send the weekly reminder" />
        </div>
      </div>
      <Button
        className="mt-5"
        loading={pending}
        onClick={() =>
          run(async () => {
            const a = await saveSetting("pulse_week_start", Number(day));
            if (!a.ok) return a;
            return saveSetting("pulse_reminder_enabled", on);
          }, "Pulse settings saved")
        }
      >
        Save
      </Button>
    </Card>
  );
}
