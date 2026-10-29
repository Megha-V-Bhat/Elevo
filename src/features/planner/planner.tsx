"use client";

import { Calculator, CircleAlert, Save } from "lucide-react";
import Link from "@/components/ui/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { GoalCompass } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/display";
import { Field, Input, Segmented, Select, Switch } from "@/components/ui/form";
import type { GradingScheme } from "@/lib/engine/grading";
import { type Feasibility, planCgpa, planSubject, solveScenario } from "@/lib/engine/planner";
import { cn } from "@/lib/utils";
import { savePlan } from "@/server/actions/plans";

type SubjectOpt = { id: string; name: string; code: string; has_mse: boolean; mse_marks: number | null; mse_max: number | null; see_max: number | null; ia: { label: string; marks: number | null; max: number | null }[] };

const STATE: Record<Feasibility | "SECURED" | "REACHABLE", { label: string; tone: "mint" | "sky" | "butter" | "coral" | "pine" }> = {
  ACHIEVED: { label: "Already secured", tone: "pine" },
  COMFORTABLE: { label: "Comfortable", tone: "mint" },
  ON_TRACK: { label: "On track", tone: "sky" },
  STRETCH: { label: "Stretch", tone: "butter" },
  NOT_REACHABLE: { label: "Not reachable", tone: "coral" },
  SECURED: { label: "Already secured", tone: "pine" },
  REACHABLE: { label: "Reachable", tone: "mint" },
};

export function Planner(props: {
  earned_credits: number;
  current_points: number;
  cgpa: number | null;
  best_sgpa: number | null;
  scheme: GradingScheme;
  remaining_guess: number | null;
  remaining_semesters: { label: string; credits: number }[];
  subjects: SubjectOpt[];
}) {
  const [mode, setMode] = useState<"CGPA" | "SUBJECT">("CGPA");
  return (
    <div className="grid gap-5">
      <Segmented
        label="Planner mode"
        value={mode}
        onChange={setMode}
        className="self-start"
        options={[
          { value: "CGPA", label: "CGPA target" },
          { value: "SUBJECT", label: "Subject target" },
        ]}
      />
      {mode === "CGPA" ? <CgpaMode {...props} /> : <SubjectMode subjects={props.subjects} scheme={props.scheme} />}
    </div>
  );
}

function SaveRow({ kind, title, inputs, result, disabled }: { kind: "CGPA" | "SUBJECT"; title: string; inputs: Record<string, unknown>; result: Record<string, unknown>; disabled?: boolean }) {
  const [share, setShare] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="sm:max-w-sm">
        <Switch id={`share-${kind}`} checked={share} onChange={setShare} label="Share with my mentor" description="Your mentor can turn it into a goal with you." />
      </div>
      <Button
        disabled={disabled}
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await savePlan({ kind, title, inputs, result, shared_with_mentor: share });
            if (!r.ok) return void toast.error(r.error.message);
            toast.success(share ? "Saved and shared with your mentor" : "Plan saved");
          })
        }
      >
        <Save /> Save plan
      </Button>
    </div>
  );
}

function CgpaMode(p: Parameters<typeof Planner>[0]) {
  const max = p.scheme.max_points;
  const [target, setTarget] = useState(() => Math.min(max, Math.round(((p.cgpa ?? 7.5) + 0.3) * 10) / 10));
  const [remaining, setRemaining] = useState<string>(p.remaining_guess?.toString() ?? "");
  const [locked, setLocked] = useState<Record<number, number | null>>({});
  const rem = remaining === "" ? null : Number(remaining);
  const res = planCgpa({ target, earned_credits: p.earned_credits, current_points: p.current_points, remaining_credits: rem, best_sgpa: p.best_sgpa, max_points: max });
  const semesters = useMemo(() => (p.remaining_semesters.length ? p.remaining_semesters : rem ? [{ label: "Remaining", credits: rem }] : []), [p.remaining_semesters, rem]);
  const scenario = useMemo(
    () => solveScenario({ earned_credits: p.earned_credits, current_points: p.current_points, target, max_points: max }, semesters.map((s, i) => ({ ...s, sgpa: locked[i] ?? null }))),
    [p.earned_credits, p.current_points, target, max, semesters, locked],
  );
  const st = res.value ? STATE[res.value.state] : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <h2 className="font-display text-h3 font-semibold text-ink-900">Your target</h2>
        <div className="mt-4 grid gap-5">
          <Field label="Target CGPA" htmlFor="target">
            <div className="flex items-center gap-3">
              <input type="range" min={5} max={max} step={0.1} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="flex-1 accent-pine-600" aria-label="Target CGPA slider" />
              <Input id="target" inputMode="decimal" className="w-24 text-center font-display text-h3 font-bold tnum" value={target} onChange={(e) => setTarget(Math.min(max, Number(e.target.value) || 0))} />
            </div>
          </Field>
          <Field label="Credits still to come" htmlFor="remaining" helper={p.remaining_guess != null ? "Estimated from your programme total and the catalog. Edit if you know better." : "Enter the credits left in your programme."}>
            <Input inputMode="numeric" value={remaining} onChange={(e) => setRemaining(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <dl className="grid grid-cols-3 gap-3 rounded-panel bg-canvas-sunk p-3 text-small">
            <div>
              <dt className="text-ink-500">Current CGPA</dt>
              <dd className="font-display text-h3 font-bold text-ink-900 tnum">{p.cgpa?.toFixed(2) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Best SGPA</dt>
              <dd className="font-display text-h3 font-bold text-ink-900 tnum">{p.best_sgpa?.toFixed(2) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Credits done</dt>
              <dd className="font-display text-h3 font-bold text-ink-900 tnum">{p.earned_credits}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        {res.value == null ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <CircleAlert className="size-8 text-butter-800" aria-hidden />
            <p className="font-semibold text-ink-900">Not enough data</p>
            <p className="max-w-[36ch] text-small text-ink-700">{res.reason}.</p>
            {p.earned_credits === 0 && (
              <Link href="/mentee/academics" className="text-small font-semibold text-pine-600 hover:underline">
                Add your semesters first →
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="label-caps">Needed on average</p>
                <p className="font-display text-display-l font-bold text-ink-900 tnum">{res.value.required_avg_sgpa.toFixed(2)}</p>
                <p className="text-small text-ink-500">SGPA over {rem} remaining credits</p>
              </div>
              {st && <Chip tone={st.tone}>{st.label}</Chip>}
            </div>
            <GoalCompass current={p.cgpa} required={res.value.required_avg_sgpa} max={max} state={res.value.state} />
            <p className="text-center text-small text-ink-500">
              <span className="font-semibold text-pine-700">Needle</span>: your CGPA now · <span className="font-semibold text-ink-900">Arc</span>: SGPA you need
            </p>
            <p className="mt-3 rounded-panel bg-lilac-50 p-3.5 text-body text-ink-900">{res.value.message}</p>

            {semesters.length > 1 && (
              <div className="mt-5">
                <h3 className="font-semibold text-ink-900">Try a scenario</h3>
                <p className="text-small text-ink-500">Set what you expect in a semester; the rest adjust so the plan still reaches {target}.</p>
                <ul className="mt-3 grid gap-3">
                  {semesters.map((s, i) => {
                    const fixed = locked[i] != null;
                    const v = fixed ? (locked[i] as number) : scenario.value?.free_sgpa ?? 0;
                    return (
                      <li key={s.label} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-3">
                        <span className="text-small font-semibold text-ink-700">
                          {s.label}
                          <span className="block font-normal text-ink-500">{s.credits} cr</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={max}
                          step={0.1}
                          value={Math.min(v, max)}
                          aria-label={`${s.label} SGPA`}
                          onChange={(e) => setLocked((l) => ({ ...l, [i]: Number(e.target.value) }))}
                          className={cn("accent-pine-600", !fixed && "opacity-60")}
                        />
                        <button type="button" onClick={() => setLocked((l) => ({ ...l, [i]: null }))} className={cn("min-h-9 rounded-control text-right font-display font-bold tnum", v > max ? "text-coral-700" : "text-ink-900")} title={fixed ? "Click to let this one adjust" : "Adjusts automatically"}>
                          {v.toFixed(1)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {scenario.value && !scenario.value.reachable && <p className="mt-2 text-small font-semibold text-coral-700">With these choices the target isn&apos;t reachable — try raising another semester.</p>}
              </div>
            )}

            <details className="mt-5 rounded-panel bg-canvas-sunk p-3.5">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink-900">
                <Calculator className="size-4" aria-hidden /> How is this calculated?
              </summary>
              <div className="mt-2 grid gap-1 text-small text-ink-700 tnum">
                <p>Required SGPA = (target × (credits done + credits to come) − points so far) ÷ credits to come</p>
                <p>
                  = ({target} × ({p.earned_credits} + {rem}) − {p.current_points}) ÷ {rem} = <strong>{res.value.required_avg_sgpa.toFixed(2)}</strong>
                </p>
                <p className="text-ink-500">Points so far = Σ (credits × grade points) across your recorded semesters.</p>
              </div>
            </details>
            <SaveRow kind="CGPA" title={`Reach ${target} CGPA`} inputs={{ target, remaining_credits: rem }} result={{ required: res.value.required_avg_sgpa, state: res.value.state }} />
          </>
        )}
      </Card>
    </div>
  );
}

function SubjectMode({ subjects, scheme }: { subjects: SubjectOpt[]; scheme: GradingScheme }) {
  const [sid, setSid] = useState(subjects[0]?.id ?? "");
  const grades = [...scheme.bands].sort((a, b) => b.min_pct - a.min_pct).filter((b) => b.points > 0);
  const [grade, setGrade] = useState(grades[2]?.grade ?? grades[0]?.grade ?? "");
  const s = subjects.find((x) => x.id === sid);
  if (!subjects.length)
    return (
      <Card className="py-10 text-center">
        <CircleAlert className="mx-auto size-8 text-butter-800" aria-hidden />
        <p className="mt-2 font-semibold text-ink-900">Not enough data</p>
        <p className="mx-auto mt-1 max-w-[44ch] text-small text-ink-700">Subject targets need a current-semester subject with MSE marks recorded.</p>
        <Link href="/mentee/academics" className="mt-3 inline-block text-small font-semibold text-pine-600 hover:underline">
          Enter your MSE marks →
        </Link>
      </Card>
    );
  const res = s ? planSubject({ scheme, target_grade: grade, has_mse: s.has_mse, mse_marks: s.mse_marks, mse_max: s.mse_max, ia: s.ia, see_max: s.see_max }) : null;
  const st = res?.value ? STATE[res.value.state] : null;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
      <Card>
        <h2 className="font-display text-h3 font-semibold text-ink-900">Pick a subject</h2>
        <div className="mt-4 grid gap-5">
          <Field label="Subject" htmlFor="subj">
            <Select value={sid} onChange={(e) => setSid(e.target.value)}>
              {subjects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target grade" htmlFor="grade">
            <div role="radiogroup" aria-label="Target grade" className="flex flex-wrap gap-2">
              {grades.map((g) => (
                <button key={g.grade} type="button" role="radio" aria-checked={grade === g.grade} onClick={() => setGrade(g.grade)} className={cn("min-h-11 min-w-12 rounded-control border px-3 font-display font-bold", grade === g.grade ? "border-pine-600 bg-pine-600 text-white" : "border-line bg-surface text-ink-900 hover:border-pine-100")}>
                  {g.grade}
                </button>
              ))}
            </div>
          </Field>
          {s && (
            <p className="rounded-panel bg-canvas-sunk p-3 text-small text-ink-700">
              Recorded MSE: <strong className="tnum">{s.mse_marks ?? "—"}/{s.mse_max ?? "?"}</strong> · SEE out of <strong className="tnum">{s.see_max ?? "?"}</strong>
            </p>
          )}
        </div>
      </Card>
      <Card>
        {!res || res.value == null ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <CircleAlert className="size-8 text-butter-800" aria-hidden />
            <p className="font-semibold text-ink-900">Not enough data</p>
            <p className="text-small text-ink-700">{res?.reason}.</p>
            <Link href="/mentee/academics" className="text-small font-semibold text-pine-600 hover:underline">
              Fix it in Academics →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="label-caps">Minimum SEE for {grade}</p>
                <p className="font-display text-display-l font-bold text-ink-900 tnum">
                  {res.value.state === "NOT_REACHABLE" ? "—" : `${res.value.min_see_marks}/${res.value.see_max}`}
                </p>
              </div>
              {st && <Chip tone={st.tone}>{st.label}</Chip>}
            </div>
            <p className="mt-3 rounded-panel bg-lilac-50 p-3.5 text-body text-ink-900">
              {res.value.state === "NOT_REACHABLE"
                ? `${grade} isn't reachable this time — it would need more than ${res.value.see_max} in SEE. Aim for the next grade and talk it through with your mentor?`
                : res.value.state === "SECURED"
                  ? `You're in great shape: just clear the SEE minimum (${res.value.min_see_marks}/${res.value.see_max}) for ${grade}.`
                  : `You need at least ${res.value.min_see_marks}/${res.value.see_max} in SEE for ${grade} in ${s?.name}.`}
            </p>
            <details className="mt-5 rounded-panel bg-canvas-sunk p-3.5" open>
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink-900">
                <Calculator className="size-4" aria-hidden /> How is this calculated?
              </summary>
              <ol className="mt-2 grid list-decimal gap-1 pl-5 text-small text-ink-700 tnum">
                {res.value.steps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </details>
            <SaveRow kind="SUBJECT" title={`${grade} in ${s?.code}`} inputs={{ subject_id: sid, target_grade: grade }} result={{ min_see_marks: res.value.min_see_marks, see_max: res.value.see_max, state: res.value.state }} />
          </>
        )}
      </Card>
    </div>
  );
}
