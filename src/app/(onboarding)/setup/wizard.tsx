"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert, Cloud, Lock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { Logo } from "@/components/brand/logo";
import { ProgressRing } from "@/components/charts";
import { Illustration, type IllustrationName } from "@/components/illustrations";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/display";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import { hodSetup, issues, mentorSetup, studentAbout, studentAcademic, studentHistory, studentPersonal } from "@/lib/validators";
import type { Role } from "@/server/authz";
import { finishSetup, saveDraft } from "@/server/actions/profile";

type CatalogSubject = { id: string; code: string; name: string; semester: number | null; credits: number | null; mse_max: number | null; see_max: number | null };
type Data = Record<string, unknown>;
type Step = { key: string; title: string; hint: string; art: IllustrationName; schema?: z.ZodTypeAny; required: string[] };

const STEPS: Record<Role, Step[]> = {
  MENTEE: [
    { key: "personal", title: "Personal", hint: "How your mentor will know you", art: "onboard-personal", schema: studentPersonal, required: ["full_name", "phone"] },
    { key: "academic", title: "Academic identity", hint: "Your programme and section", art: "onboard-academic", schema: studentAcademic, required: ["usn", "program", "current_semester", "section", "admission_year", "expected_graduation_year"] },
    { key: "history", title: "Academic history", hint: "Past semesters, if you have them", art: "onboard-history", schema: studentHistory, required: [] },
    { key: "about", title: "About me", hint: "Skills, interests and goals", art: "onboard-about", schema: studentAbout, required: [] },
    { key: "review", title: "Review & finish", hint: "Check everything once", art: "onboard-review", required: [] },
  ],
  MENTOR: [
    { key: "profile", title: "Your profile", hint: "What your mentees will see", art: "onboard-personal", schema: mentorSetup, required: ["full_name", "official_email", "phone", "designation", "faculty_id"] },
    { key: "mentees", title: "Expertise & mentees", hint: "What you can help with", art: "onboard-about", required: [] },
    { key: "review", title: "Review & finish", hint: "Check everything once", art: "onboard-review", required: [] },
  ],
  HOD: [
    { key: "profile", title: "Your profile", hint: "A short profile for your department", art: "onboard-personal", schema: hodSetup, required: ["full_name", "phone"] },
    { key: "review", title: "Review & finish", hint: "Check everything once", art: "onboard-review", required: [] },
  ],
};

const LABELS: Record<string, string> = {
  full_name: "Full name",
  phone: "Phone",
  usn: "USN",
  program: "Program",
  current_semester: "Current semester",
  section: "Section",
  admission_year: "Admission year",
  expected_graduation_year: "Expected graduation",
  official_email: "Official email",
  designation: "Designation",
  faculty_id: "Faculty ID",
};

const STEP_OF: Record<string, string> = Object.fromEntries(
  Object.entries(STEPS).flatMap(([, steps]) => steps.flatMap((s) => s.required.map((r) => [r, s.key]))),
);

export function SetupWizard(props: {
  role: Role;
  email: string;
  department: string;
  sections: string[];
  optionalFields: Record<string, boolean>;
  initial: Data;
  avatarUrl: string | null;
  catalog: CatalogSubject[];
  mentorName: string | null;
  mentees: string[];
}) {
  const router = useRouter();
  const steps = STEPS[props.role];
  const [data, setData] = useState<Data>(() => ({ official_email: props.role === "MENTOR" ? props.email : undefined, semesters: [], skills: [], interests: [], expertise: [], ...props.initial }));
  const [step, setStep] = useState(() => Math.min(Number(props.initial._step ?? 0), steps.length - 1));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<{ at: Date | null; state: "idle" | "saving" | "error" }>({ at: props.initial._saved_at ? new Date(String(props.initial._saved_at)) : null, state: "idle" });
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const first = useRef(true);

  const set = useCallback((patch: Data) => {
    setData((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(patch)) delete n[k];
      return n;
    });
  }, []);

  // Debounced autosave + local backup so nothing is lost on refresh or network loss.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem("elevo:setup-draft", JSON.stringify({ data, step }));
    } catch {}
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaved((s) => ({ ...s, state: "saving" }));
      const r = await saveDraft(data, step);
      setSaved(r.ok ? { at: new Date(r.data), state: "idle" } : (s) => ({ ...s, state: "error" }));
    }, 800);
    return () => clearTimeout(timer.current);
  }, [data, step]);

  const missing = useMemo(
    () => steps.flatMap((s) => s.required).filter((k) => data[k] == null || String(data[k]).trim() === ""),
    [data, steps],
  );

  const validate = (i: number) => {
    const s = steps[i];
    if (!s.schema) return true;
    const r = s.schema.safeParse(data);
    if (r.success) return true;
    setErrors(issues(r.error));
    requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
    return false;
  };

  const next = () => {
    if (!validate(step)) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const jumpTo = (field: string) => {
    const idx = steps.findIndex((s) => s.key === STEP_OF[field]);
    if (idx >= 0) setStep(idx);
    setTimeout(() => document.getElementById(field)?.focus(), 60);
  };

  const finish = async () => {
    for (let i = 0; i < steps.length; i++) {
      if (!validate(i)) {
        setStep(i);
        return toast.error("A few details need attention before you finish.");
      }
    }
    setFinishing(true);
    const r = await finishSetup(data);
    setFinishing(false);
    if (!r.ok) {
      if (r.error.fieldErrors) setErrors(r.error.fieldErrors);
      return toast.error(r.error.message);
    }
    try {
      localStorage.removeItem("elevo:setup-draft");
    } catch {}
    setDone(r.data);
  };

  if (done)
    return (
      <main id="main" className="dot-grid grid min-h-dvh place-items-center p-4">
        <div className="w-full max-w-md text-center">
          <Illustration name="celebrate" className="mx-auto h-56" />
          <h1 className="mt-4 font-display text-display-l font-bold text-ink-900">You&apos;re all set.</h1>
          <p className="mt-2 text-body text-ink-500">
            {props.role === "MENTEE" ? "Your mentor can now see your profile. Records you added are saved as drafts — submit them for verification any time." : "Your profile is ready."}
          </p>
          <Button size="lg" className="mt-8 w-full" onClick={() => router.push(done)}>
            Go to my dashboard <ArrowRight />
          </Button>
        </div>
      </main>
    );

  const s = steps[step];
  const pct = Math.round(((step + (missing.length ? 0 : 0.5)) / (steps.length - 0.5)) * 100);
  const err = (k: string) => errors[k];
  const str = (k: string) => (data[k] == null ? "" : String(data[k]));

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/90 backdrop-blur-[14px]">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-3 px-4 md:h-16 md:px-8">
          <Logo size="sm" />
          <SaveIndicator saved={saved} />
        </div>
        <div className="h-1 bg-chart-track md:hidden">
          <div className="h-1 bg-pine-600 transition-[width] duration-500 ease-grow" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-6 md:grid-cols-[260px_1fr] md:px-8 md:py-10">
        <aside className="hidden md:block">
          <div className="sticky top-24">
            <div className="flex items-center gap-3">
              <ProgressRing value={pct} size={52} label="Setup progress" />
              <div>
                <p className="font-semibold text-ink-900">Set up your profile</p>
                <p className="text-small text-ink-500">About 5 minutes</p>
              </div>
            </div>
            <ol className="mt-6 grid gap-1">
              {steps.map((st, i) => (
                <li key={st.key}>
                  <button
                    type="button"
                    onClick={() => (i < step || validate(step)) && setStep(i)}
                    aria-current={i === step ? "step" : undefined}
                    className={cn("flex min-h-12 w-full items-center gap-3 rounded-control px-2 text-left", i === step ? "bg-pine-50" : "hover:bg-canvas-sunk")}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-label font-bold",
                        i < step ? "bg-pine-600 text-white" : i === step ? "bg-surface text-pine-700 ring-2 ring-pine-600" : "bg-canvas-sunk text-ink-500",
                      )}
                    >
                      {i < step ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span>
                      <span className={cn("block text-small font-semibold", i === step ? "text-pine-700" : "text-ink-900")}>{st.title}</span>
                      <span className="block text-[12px] text-ink-500">{st.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <main id="main" className="min-w-0">
          <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label-caps">
                Step {step + 1} of {steps.length}
              </p>
              <h1 className="mt-1 font-display text-[2rem] leading-10 font-bold text-ink-900 md:text-display-l">{s.title}</h1>
              <p className="mt-1 text-body text-ink-500">{s.hint}</p>
            </div>
            <Illustration name={s.art} className="h-24 w-auto shrink-0 md:h-28" />
          </div>

          {missing.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Chip tone="butter">
                <CircleAlert className="size-3.5" aria-hidden /> {missing.length} required field{missing.length > 1 ? "s" : ""} missing
              </Chip>
              {missing.slice(0, 4).map((m) => (
                <button key={m} type="button" onClick={() => jumpTo(m)} className="min-h-8 rounded-full px-2 text-small font-semibold text-pine-600 underline-offset-4 hover:underline">
                  {LABELS[m] ?? m}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-1 md:p-7" key={s.key}>
            <div className="grid animate-rise gap-5">
              {s.key === "personal" && (
                <>
                  <AvatarUploader name={str("full_name")} initialUrl={props.avatarUrl} />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full name" htmlFor="full_name" required error={err("full_name")}>
                      <Input value={str("full_name")} onChange={(e) => set({ full_name: e.target.value })} autoComplete="name" />
                    </Field>
                    <Field label="Phone" htmlFor="phone" required error={err("phone")}>
                      <Input value={str("phone")} onChange={(e) => set({ phone: e.target.value })} type="tel" inputMode="tel" autoComplete="tel" />
                    </Field>
                    <Field label="Email" htmlFor="email" helper="Your sign-in email. Ask your HOD to change it.">
                      <Input value={props.email} readOnly disabled />
                    </Field>
                    {props.optionalFields.dob && (
                      <Field label="Date of birth" htmlFor="dob" optional>
                        <Input type="date" value={str("dob")} onChange={(e) => set({ dob: e.target.value })} />
                      </Field>
                    )}
                    {props.optionalFields.gender && (
                      <Field label="Gender" htmlFor="gender" optional>
                        <Select value={str("gender")} onChange={(e) => set({ gender: e.target.value })}>
                          <option value="">Prefer not to say</option>
                          <option>Female</option>
                          <option>Male</option>
                          <option>Non-binary</option>
                          <option>Self-describe</option>
                        </Select>
                      </Field>
                    )}
                  </div>
                  {props.optionalFields.address && (
                    <Field label="Address" htmlFor="address" optional>
                      <Textarea rows={2} value={str("address")} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" />
                    </Field>
                  )}
                </>
              )}

              {s.key === "academic" && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="USN / Student ID" htmlFor="usn" required error={err("usn")} helper="Locked after setup.">
                      <Input value={str("usn")} onChange={(e) => set({ usn: e.target.value.toUpperCase() })} autoCapitalize="characters" />
                    </Field>
                    <Field label="Department" htmlFor="department" helper="Set by your HOD.">
                      <Input value={props.department} readOnly disabled />
                    </Field>
                    <Field label="Program" htmlFor="program" required error={err("program")}>
                      <Input value={str("program")} onChange={(e) => set({ program: e.target.value })} placeholder="B.E. Computer Science" />
                    </Field>
                    <Field label="Current semester" htmlFor="current_semester" required error={err("current_semester")}>
                      <Select value={str("current_semester")} onChange={(e) => set({ current_semester: e.target.value })}>
                        <option value="">Choose…</option>
                        {Array.from({ length: 8 }, (_, i) => (
                          <option key={i} value={i + 1}>
                            Semester {i + 1}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Section" htmlFor="section" required error={err("section")}>
                      {props.sections.length ? (
                        <Select value={str("section")} onChange={(e) => set({ section: e.target.value })}>
                          <option value="">Choose…</option>
                          {props.sections.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </Select>
                      ) : (
                        <Input value={str("section")} onChange={(e) => set({ section: e.target.value.toUpperCase() })} />
                      )}
                    </Field>
                    <Field label="Admission year" htmlFor="admission_year" required error={err("admission_year")}>
                      <Input inputMode="numeric" value={str("admission_year")} onChange={(e) => set({ admission_year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="2023" />
                    </Field>
                    <Field label="Expected graduation" htmlFor="expected_graduation_year" required error={err("expected_graduation_year")}>
                      <Input inputMode="numeric" value={str("expected_graduation_year")} onChange={(e) => set({ expected_graduation_year: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="2027" />
                    </Field>
                  </div>
                  <div className="flex items-start gap-3 rounded-panel bg-canvas-sunk p-4">
                    <Lock className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
                    <p className="text-small text-ink-700">
                      <span className="font-semibold text-ink-900">Mentor: {props.mentorName ?? "not assigned yet"}.</span> Assigned by your HOD — it isn&apos;t something you choose.
                    </p>
                  </div>
                </>
              )}

              {s.key === "history" && <HistoryStep data={data} set={set} catalog={props.catalog} upto={Number(data.current_semester) || 8} errors={errors} />}

              {s.key === "about" && (
                <>
                  <Field label="Skills" htmlFor="skills" optional helper="Press Enter after each one.">
                    <TagInput id="skills" value={(data.skills as string[]) ?? []} onChange={(v) => set({ skills: v })} suggestions={["Python", "Java", "C", "Web development", "Public speaking", "Data analysis"]} />
                  </Field>
                  <Field label="Interests" htmlFor="interests" optional>
                    <TagInput id="interests" value={(data.interests as string[]) ?? []} onChange={(v) => set({ interests: v })} suggestions={["AI/ML", "Robotics", "Competitive coding", "Design", "Research", "Sports"]} />
                  </Field>
                  <Field label="Career goals" htmlFor="career_goals" optional>
                    <Textarea rows={3} value={str("career_goals")} onChange={(e) => set({ career_goals: e.target.value })} placeholder="Where would you like to be after graduation?" />
                  </Field>
                  <Field label="Achievements" htmlFor="achievements" optional>
                    <Textarea rows={3} value={str("achievements")} onChange={(e) => set({ achievements: e.target.value })} />
                  </Field>
                  <Field label="Where would support help most?" htmlFor="support_areas" optional helper="Only your mentor sees this.">
                    <Textarea rows={2} value={str("support_areas")} onChange={(e) => set({ support_areas: e.target.value })} />
                  </Field>
                </>
              )}

              {s.key === "profile" && (
                <>
                  <AvatarUploader name={str("full_name")} initialUrl={props.avatarUrl} />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full name" htmlFor="full_name" required error={err("full_name")}>
                      <Input value={str("full_name")} onChange={(e) => set({ full_name: e.target.value })} autoComplete="name" />
                    </Field>
                    <Field label="Phone" htmlFor="phone" required error={err("phone")}>
                      <Input value={str("phone")} onChange={(e) => set({ phone: e.target.value })} type="tel" inputMode="tel" />
                    </Field>
                    {props.role === "MENTOR" && (
                      <>
                        <Field label="Official email" htmlFor="official_email" required error={err("official_email")}>
                          <Input type="email" value={str("official_email")} onChange={(e) => set({ official_email: e.target.value })} />
                        </Field>
                        <Field label="Faculty ID" htmlFor="faculty_id" required error={err("faculty_id")}>
                          <Input value={str("faculty_id")} onChange={(e) => set({ faculty_id: e.target.value })} />
                        </Field>
                      </>
                    )}
                    <Field label="Designation" htmlFor="designation" required={props.role === "MENTOR"} error={err("designation")}>
                      <Input value={str("designation")} onChange={(e) => set({ designation: e.target.value })} placeholder={props.role === "HOD" ? "Head of Department" : "Assistant Professor"} />
                    </Field>
                    <Field label="Department" htmlFor="department" helper="Set by the HOD.">
                      <Input value={props.department} readOnly disabled />
                    </Field>
                  </div>
                </>
              )}

              {s.key === "mentees" && (
                <>
                  <Field label="Areas of expertise" htmlFor="expertise" optional helper="Helps students know what to ask you about.">
                    <TagInput id="expertise" value={(data.expertise as string[]) ?? []} onChange={(v) => set({ expertise: v })} suggestions={["DBMS", "Operating systems", "Machine learning", "Placements", "Higher studies", "Research"]} />
                  </Field>
                  <div className="rounded-panel bg-canvas-sunk p-4">
                    <p className="flex items-center gap-2 font-semibold text-ink-900">
                      <Lock className="size-4 text-ink-500" aria-hidden /> Assigned mentees ({props.mentees.length})
                    </p>
                    <p className="mt-1 text-small text-ink-500">Your HOD manages assignments. You&apos;ll see each mentee&apos;s full profile once setup is done.</p>
                    {props.mentees.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {props.mentees.slice(0, 24).map((m, i) => (
                          <li key={i}>
                            <Chip>{m}</Chip>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}

              {s.key === "review" && <Review data={data} role={props.role} email={props.email} department={props.department} onEdit={(k) => setStep(steps.findIndex((x) => x.key === k))} />}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-[14px] md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
            {step > 0 && (
              <Button variant="secondary" size="lg" onClick={back} className="flex-1 md:flex-none">
                <ArrowLeft /> Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button size="lg" onClick={next} className="flex-1 md:ml-auto md:flex-none">
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button size="lg" onClick={finish} loading={finishing} disabled={missing.length > 0} className="flex-1 md:ml-auto md:flex-none">
                Finish setup <Check />
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function SaveIndicator({ saved }: { saved: { at: Date | null; state: string } }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  const ago = saved.at ? Math.round((Date.now() - saved.at.getTime()) / 60000) : null;
  return (
    <p role="status" aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-small font-semibold", saved.state === "error" ? "text-coral-700" : "text-ink-500")}>
      <Cloud className={cn("size-4", saved.state === "saving" && "animate-pulse")} aria-hidden />
      {saved.state === "saving"
        ? "Saving…"
        : saved.state === "error"
          ? "Not saved — we'll retry when you edit again"
          : ago == null
            ? "Changes save automatically"
            : `Saved · ${ago < 1 ? "just now" : `${ago} min ago`}`}
    </p>
  );
}

type Sem = z.infer<typeof studentHistory>["semesters"][number];

function HistoryStep({ data, set, catalog, upto, errors }: { data: Data; set: (p: Data) => void; catalog: CatalogSubject[]; upto: number; errors: Record<string, string> }) {
  const sems = (data.semesters as Sem[]) ?? [];
  const update = (i: number, patch: Partial<Sem>) => set({ semesters: sems.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addSem = () => {
    const used = new Set(sems.map((s) => s.semester_no));
    const no = Array.from({ length: Math.max(1, upto - 1) }, (_, i) => i + 1).find((n) => !used.has(n)) ?? sems.length + 1;
    const subjects = catalog.filter((c) => c.semester === no);
    set({
      semesters: [
        ...sems,
        { semester_no: no, academic_year: null, mode: subjects.length ? "subjects" : "sgpa", manual_sgpa: null, manual_credits: null, results: subjects.map((c) => ({ subject_id: c.id, mse_marks: null, see_marks: null, grade_points: null, grade: null })) },
      ],
    });
  };
  return (
    <div className="grid gap-5">
      <p className="text-body text-ink-700">
        Add semesters you&apos;ve already completed. They&apos;re saved as <span className="font-semibold">drafts</span> and your mentor verifies them later. Skip this if you&apos;re in your first semester.
      </p>
      {sems.map((s, i) => {
        const subjects = catalog.filter((c) => c.semester === s.semester_no);
        return (
          <fieldset key={i} className="rounded-panel border border-line p-4">
            <legend className="sr-only">Semester {s.semester_no}</legend>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Semester" htmlFor={`sem-${i}`} className="w-36">
                <Select
                  value={s.semester_no}
                  onChange={(e) => {
                    const no = Number(e.target.value);
                    const subs = catalog.filter((c) => c.semester === no);
                    update(i, { semester_no: no, results: subs.map((c) => ({ subject_id: c.id, mse_marks: null, see_marks: null, grade_points: null, grade: null })), mode: subs.length ? s.mode : "sgpa" });
                  }}
                >
                  {Array.from({ length: 8 }, (_, n) => (
                    <option key={n} value={n + 1}>
                      Semester {n + 1}
                    </option>
                  ))}
                </Select>
              </Field>
              <Segmented
                label="How do you want to add it?"
                value={s.mode}
                onChange={(m) => update(i, { mode: m })}
                options={[
                  { value: "subjects", label: "Subject marks" },
                  { value: "sgpa", label: "Just SGPA" },
                ]}
              />
              <Button type="button" variant="ghost" size="icon" className="ml-auto" aria-label={`Remove semester ${s.semester_no}`} onClick={() => set({ semesters: sems.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
            {s.mode === "sgpa" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="SGPA" htmlFor={`sgpa-${i}`} helper="Shown as “unverified” until your mentor checks it." error={errors[`semesters.${i}.manual_sgpa`]}>
                  <Input inputMode="decimal" value={s.manual_sgpa ?? ""} onChange={(e) => update(i, { manual_sgpa: e.target.value as unknown as number })} placeholder="8.2" />
                </Field>
                <Field label="Credits" htmlFor={`cred-${i}`} optional helper="Needed to include it in your CGPA.">
                  <Input inputMode="numeric" value={s.manual_credits ?? ""} onChange={(e) => update(i, { manual_credits: e.target.value as unknown as number })} placeholder="22" />
                </Field>
              </div>
            ) : subjects.length === 0 ? (
              <p className="mt-4 rounded-panel bg-butter-50 p-3 text-small text-butter-800">No subjects in the catalog for this semester yet. Use “Just SGPA”, or add subjects later from Academics.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-small">
                  <thead>
                    <tr className="text-left text-ink-500">
                      <th className="pb-2 font-semibold">Subject</th>
                      <th className="pb-2 font-semibold">MSE</th>
                      <th className="pb-2 font-semibold">SEE</th>
                      <th className="pb-2 font-semibold">Grade points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.results.map((r, k) => {
                      const c = catalog.find((x) => x.id === r.subject_id);
                      const patch = (p: Partial<typeof r>) => update(i, { results: s.results.map((x, j) => (j === k ? { ...x, ...p } : x)) });
                      return (
                        <tr key={r.subject_id} className="border-t border-line">
                          <td className="py-2 pr-3">
                            <span className="font-semibold text-ink-900">{c?.name}</span>
                            <span className="block text-ink-500">
                              {c?.code} · {c?.credits ?? "?"} cr
                            </span>
                          </td>
                          <td className="py-2 pr-2">
                            <Input aria-label={`${c?.name} MSE out of ${c?.mse_max}`} inputMode="decimal" className="h-10 w-20" value={r.mse_marks ?? ""} onChange={(e) => patch({ mse_marks: e.target.value as unknown as number })} placeholder={`/${c?.mse_max ?? ""}`} />
                          </td>
                          <td className="py-2 pr-2">
                            <Input aria-label={`${c?.name} SEE out of ${c?.see_max}`} inputMode="decimal" className="h-10 w-20" value={r.see_marks ?? ""} onChange={(e) => patch({ see_marks: e.target.value as unknown as number })} placeholder={`/${c?.see_max ?? ""}`} />
                          </td>
                          <td className="py-2">
                            <Input aria-label={`${c?.name} grade points`} inputMode="decimal" className="h-10 w-20" value={r.grade_points ?? ""} onChange={(e) => patch({ grade_points: e.target.value as unknown as number })} placeholder="auto" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-small text-ink-500">Leave grade points empty to calculate them from marks using your department&apos;s grading scheme.</p>
              </div>
            )}
          </fieldset>
        );
      })}
      <Button type="button" variant="tonal" onClick={addSem} disabled={sems.length >= 8} className="justify-self-start">
        <Plus /> Add a past semester
      </Button>
    </div>
  );
}

function Review({ data, role, email, department, onEdit }: { data: Data; role: Role; email: string; department: string; onEdit: (k: string) => void }) {
  const v = (k: string) => (Array.isArray(data[k]) ? (data[k] as string[]).join(", ") : data[k] ? String(data[k]) : "—");
  const sections =
    role === "MENTEE"
      ? [
          { key: "personal", title: "Personal", rows: [["Name", v("full_name")], ["Email", email], ["Phone", v("phone")]] },
          { key: "academic", title: "Academic identity", rows: [["USN", v("usn")], ["Department", department], ["Program", v("program")], ["Semester", v("current_semester")], ["Section", v("section")], ["Batch", `${v("admission_year")} – ${v("expected_graduation_year")}`]] },
          { key: "history", title: "Academic history", rows: [["Semesters added", String(((data.semesters as unknown[]) ?? []).length)]] },
          { key: "about", title: "About me", rows: [["Skills", v("skills")], ["Interests", v("interests")], ["Career goals", v("career_goals")]] },
        ]
      : [
          { key: "profile", title: "Profile", rows: [["Name", v("full_name")], ["Phone", v("phone")], ["Designation", v("designation")], ...(role === "MENTOR" ? [["Official email", v("official_email")], ["Faculty ID", v("faculty_id")]] : [])] },
          ...(role === "MENTOR" ? [{ key: "mentees", title: "Expertise", rows: [["Areas", v("expertise")]] }] : []),
        ];
  return (
    <div className="grid gap-4">
      {sections.map((s) => (
        <section key={s.key} className="rounded-panel border border-line p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-h3 font-semibold text-ink-900">{s.title}</h2>
            <Button variant="link" size="sm" onClick={() => onEdit(s.key)}>
              Edit
            </Button>
          </div>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {s.rows.map(([k, val]) => (
              <div key={k} className="min-w-0">
                <dt className="label-caps">{k}</dt>
                <dd className="truncate text-body text-ink-900">{val}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
