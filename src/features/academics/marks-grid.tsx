"use client";

import { ChevronLeft, ChevronRight, Cloud, Plus, Send, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/display";
import { Field, Input, Select } from "@/components/ui/form";
import { gradeSubject, type GradingScheme } from "@/lib/engine/grading";
import { cn, fmt } from "@/lib/utils";
import { addSubjectToSemester, createSubject, deleteSemester, removeResult, saveResults, setSemesterStatus } from "@/server/actions/academics";

export type GridRow = {
  id: string;
  subject_id: string;
  code: string;
  name: string;
  credits: number | null;
  has_mse: boolean;
  has_see: boolean;
  mse_max: number | null;
  see_max: number | null;
  mse_marks: number | null;
  see_marks: number | null;
  grade_points: number | null;
  grade: string | null;
};

type Cell = "mse_marks" | "see_marks" | "grade_points";
const CELLS: Cell[] = ["mse_marks", "see_marks", "grade_points"];

const parse = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function MarksGrid({
  semesterId,
  semesterNo,
  rows: initial,
  scheme,
  catalog,
}: {
  semesterId: string;
  semesterNo: number;
  rows: GridRow[];
  scheme: GradingScheme;
  catalog: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [mobileIdx, setMobileIdx] = useState(0);
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const storageKey = `elevo:marks:${semesterId}`;

  // Restore a local backup if the page was closed mid-edit
  useEffect(() => {
    try {
      const b = localStorage.getItem(storageKey);
      if (b) {
        const saved = JSON.parse(b) as GridRow[];
        if (saved.length === initial.length) {
          setRows(saved);
          setState("dirty");
          toast.info("Restored marks you hadn't saved yet");
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(
    async (data: GridRow[]) => {
      setState("saving");
      const r = await saveResults(
        semesterId,
        data.map((x) => ({ subject_id: x.subject_id, mse_marks: x.mse_marks, mse_max: x.mse_max, see_marks: x.see_marks, see_max: x.see_max, grade_points: x.grade_points, grade: x.grade, ia: [] })),
      );
      if (!r.ok) {
        setState("error");
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries(r.error.fieldErrors ?? {})) {
          const [i, f] = k.split(".");
          fe[`${data[Number(i)]?.id}.${f}`] = v;
        }
        setErrors(fe);
        return toast.error(r.error.message);
      }
      setErrors({});
      setState("saved");
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      router.refresh();
    },
    [semesterId, router, storageKey],
  );

  const update = (rowId: string, cell: Cell, value: number | null) => {
    setRows((rs) => {
      const next = rs.map((r) => (r.id === rowId ? { ...r, [cell]: value } : r));
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(next), 1000);
      return next;
    });
    setState("dirty");
  };

  // Warn before leaving with unsaved edits
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (state === "dirty" || state === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [state]);

  const derived = useMemo(
    () =>
      rows.map((r) => {
        const g = gradeSubject({ has_mse: r.has_mse, has_see: r.has_see, mse_marks: r.mse_marks, mse_max: r.mse_max, see_marks: r.see_marks, see_max: r.see_max, ia: [] }, scheme);
        return { pct: g.value?.total_pct ?? null, grade: g.value?.grade ?? null, points: g.value?.points ?? null, note: g.value?.note ?? g.reason };
      }),
    [rows, scheme],
  );

  const sgpaPreview = useMemo(() => {
    const cp = rows.map((r, i) => ({ c: r.credits, p: r.grade_points ?? derived[i].points }));
    if (!cp.length || cp.some((x) => x.c == null || x.p == null)) return null;
    const cr = cp.reduce((a, x) => a + (x.c as number), 0);
    return cr ? cp.reduce((a, x) => a + (x.c as number) * (x.p as number), 0) / cr : null;
  }, [rows, derived]);

  // Spreadsheet navigation: Enter moves down, arrows move, paste fills a block
  const focusCell = (r: number, c: number) => document.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`)?.focus();
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === "Enter" || (e.key === "ArrowDown" && !e.altKey)) {
      e.preventDefault();
      focusCell(Math.min(r + 1, rows.length - 1), c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(Math.max(r - 1, 0), c);
    }
  };
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const grid = text.trim().split(/\r?\n/).map((l) => l.split("\t"));
    let next = rows;
    grid.forEach((line, dr) => {
      line.forEach((val, dc) => {
        const row = next[r + dr];
        const cell = CELLS[c + dc];
        if (row && cell) next = next.map((x) => (x.id === row.id ? { ...x, [cell]: parse(val) } : x));
      });
    });
    setRows(next);
    setState("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), 600);
    toast.success(`Pasted ${grid.length} row${grid.length > 1 ? "s" : ""}`);
  };

  const cellInput = (row: GridRow, i: number, cell: Cell, ci: number, cls?: string) => {
    const max = cell === "mse_marks" ? row.mse_max : cell === "see_marks" ? row.see_max : 10;
    const disabled = (cell === "mse_marks" && !row.has_mse) || (cell === "see_marks" && !row.has_see);
    const errKey = `${row.id}.${cell}`;
    const outOfRange = row[cell] != null && max != null && (row[cell] as number) > max;
    return (
      <Input
        data-cell={`${i}-${ci}`}
        aria-label={`${row.name} ${cell === "mse_marks" ? "MSE" : cell === "see_marks" ? "SEE" : "grade points"}${max ? ` out of ${max}` : ""}`}
        inputMode="decimal"
        disabled={disabled}
        value={row[cell] ?? ""}
        aria-invalid={outOfRange || !!errors[errKey] || undefined}
        placeholder={disabled ? "n/a" : cell === "grade_points" ? (derived[i].points != null ? String(derived[i].points) : "auto") : `/${max ?? "?"}`}
        onChange={(e) => update(row.id, cell, parse(e.target.value))}
        onKeyDown={(e) => onKey(e, i, ci)}
        onPaste={(e) => onPaste(e, i, ci)}
        className={cn("h-10 w-full min-w-16 px-2.5 text-right tnum", cls)}
      />
    );
  };

  const statusLabel =
    state === "saving" ? "Saving…" : state === "dirty" ? "Unsaved changes" : state === "error" ? "Couldn't save — fix the highlighted cells" : state === "saved" ? "All changes saved" : "Changes save automatically";

  const m = rows[mobileIdx];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p role="status" aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-small font-semibold", state === "error" ? "text-coral-700" : "text-ink-500")}>
          <Cloud className={cn("size-4", state === "saving" && "animate-pulse")} aria-hidden /> {statusLabel}
        </p>
        <span className="text-small text-ink-500">
          Draft SGPA: <span className="font-semibold text-ink-900 tnum">{sgpaPreview == null ? "not enough data" : sgpaPreview.toFixed(2)}</span>
        </span>
        <p className="hidden text-small text-ink-500 lg:ml-auto lg:block">Tip: paste a block straight from Excel or Sheets. Enter moves down.</p>
      </div>

      {/* Desktop / tablet grid */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-1 md:block">
        <table className="w-full text-small">
          <thead className="bg-canvas-sunk text-left text-ink-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
              <th scope="col" className="w-16 px-2 py-3 text-right font-semibold">Credits</th>
              <th scope="col" className="w-28 px-2 py-3 text-right font-semibold">MSE</th>
              <th scope="col" className="w-28 px-2 py-3 text-right font-semibold">SEE</th>
              <th scope="col" className="w-20 px-2 py-3 text-right font-semibold">Total %</th>
              <th scope="col" className="w-16 px-2 py-3 text-right font-semibold">Grade</th>
              <th scope="col" className="w-28 px-2 py-3 text-right font-semibold">Points</th>
              <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-t border-line align-middle hover:bg-canvas/60">
                <td className="px-4 py-2">
                  <span className="font-semibold text-ink-900">{r.name}</span>
                  <span className="block text-ink-500">{r.code}</span>
                </td>
                <td className="px-2 py-2 text-right tnum text-ink-700">{r.credits ?? "—"}</td>
                <td className="px-2 py-2">{cellInput(r, i, "mse_marks", 0)}</td>
                <td className="px-2 py-2">{cellInput(r, i, "see_marks", 1)}</td>
                <td className="px-2 py-2 text-right tnum text-ink-900" title={derived[i].note ?? undefined}>{derived[i].pct == null ? "—" : `${fmt(derived[i].pct, 1)}%`}</td>
                <td className="px-2 py-2 text-right font-semibold text-ink-900">{r.grade ?? derived[i].grade ?? "—"}</td>
                <td className="px-2 py-2">{cellInput(r, i, "grade_points", 2)}</td>
                <td className="px-2 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="iconSm"
                    aria-label={`Remove ${r.name}`}
                    onClick={() =>
                      start(async () => {
                        const res = await removeResult(r.id);
                        if (!res.ok) return void toast.error(res.error.message);
                        setRows((x) => x.filter((y) => y.id !== r.id));
                        toast.success(`${r.name} removed`);
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one subject per screen */}
      {m && (
        <div className="md:hidden">
          <div className="rounded-card border border-line bg-surface p-5 shadow-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-caps">
                  Subject {mobileIdx + 1} of {rows.length}
                </p>
                <h2 className="mt-1 font-display text-h3 font-semibold text-ink-900">{m.name}</h2>
                <p className="text-small text-ink-500">
                  {m.code} · {m.credits ?? "?"} credits
                </p>
              </div>
              <Chip tone="mint">{m.grade ?? derived[mobileIdx].grade ?? "—"}</Chip>
            </div>
            <div className="mt-5 grid gap-4">
              <Field label={`MSE (out of ${m.mse_max ?? "?"})`} htmlFor={`m-mse`}>{cellInput(m, mobileIdx, "mse_marks", 0, "h-12 text-left text-h3")}</Field>
              <Field label={`SEE (out of ${m.see_max ?? "?"})`} htmlFor={`m-see`}>{cellInput(m, mobileIdx, "see_marks", 1, "h-12 text-left text-h3")}</Field>
              <Field label="Grade points" htmlFor="m-gp" helper="Leave empty to calculate from marks.">{cellInput(m, mobileIdx, "grade_points", 2, "h-12 text-left text-h3")}</Field>
            </div>
            <p className="mt-3 text-small text-ink-500">Total: {derived[mobileIdx].pct == null ? derived[mobileIdx].note : `${fmt(derived[mobileIdx].pct, 1)}%`}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={mobileIdx === 0} onClick={() => setMobileIdx((x) => x - 1)}>
              <ChevronLeft /> Previous
            </Button>
            <Button variant="secondary" className="flex-1" disabled={mobileIdx >= rows.length - 1} onClick={() => setMobileIdx((x) => x + 1)}>
              Next <ChevronRight />
            </Button>
          </div>
          <ol className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Jump to subject">
            {rows.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-label={`${r.name}${r.mse_marks != null || r.see_marks != null ? ", has marks" : ""}`}
                  aria-current={i === mobileIdx ? "step" : undefined}
                  onClick={() => setMobileIdx(i)}
                  className={cn("size-3 rounded-full", i === mobileIdx ? "bg-pine-600" : r.mse_marks != null || r.see_marks != null ? "bg-mint-400" : "bg-line-strong")}
                />
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" onClick={() => setAddOpen(true)}>
          <Plus /> Add a subject
        </Button>
        <Button
          variant="ghost"
          className="text-coral-700"
          onClick={() =>
            toast("Delete this draft semester?", {
              description: "All subjects and marks in it will be removed.",
              action: {
                label: "Delete",
                onClick: () =>
                  start(async () => {
                    const r = await deleteSemester(semesterId);
                    if (!r.ok) return void toast.error(r.error.message);
                    toast.success(`Semester ${semesterNo} deleted`);
                    router.push("/mentee/academics");
                  }),
              },
            })
          }
        >
          <Trash2 /> Delete semester
        </Button>
        <Button
          className="sm:ml-auto"
          size="lg"
          loading={pending}
          disabled={state === "saving" || state === "dirty" || rows.length === 0}
          onClick={() =>
            start(async () => {
              const r = await setSemesterStatus(semesterId, "SUBMITTED");
              if (!r.ok) return void toast.error(r.error.message);
              toast.success("Submitted to your mentor for verification");
              router.refresh();
            })
          }
        >
          <Send /> Submit for verification
        </Button>
      </div>

      <AddSubjectSheet open={addOpen} onOpenChange={setAddOpen} semesterId={semesterId} semesterNo={semesterNo} catalog={catalog.filter((c) => !rows.some((r) => r.subject_id === c.id))} />
    </div>
  );
}

function AddSubjectSheet({ open, onOpenChange, semesterId, semesterNo, catalog }: { open: boolean; onOpenChange: (v: boolean) => void; semesterId: string; semesterNo: number; catalog: { id: string; code: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"pick" | "new">(catalog.length ? "pick" : "new");
  const [pick, setPick] = useState("");
  const [f, setF] = useState({ code: "", name: "", credits: "", mse_max: "50", see_max: "100" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = () =>
    start(async () => {
      let subjectId = pick;
      if (mode === "new") {
        const r = await createSubject({ ...f, semester: semesterNo, has_mse: true, has_see: true });
        if (!r.ok) {
          setErrs(r.error.fieldErrors ?? {});
          return void toast.error(r.error.message);
        }
        subjectId = r.data;
      }
      if (!subjectId) return void toast.error("Choose a subject");
      const r = await addSubjectToSemester(semesterId, subjectId);
      if (!r.ok) return void toast.error(r.error.message);
      toast.success("Subject added");
      onOpenChange(false);
      router.refresh();
    });
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Add a subject">
      <div className="grid gap-4">
        <div className="flex gap-2">
          <Button variant={mode === "pick" ? "tonal" : "ghost"} size="sm" onClick={() => setMode("pick")} disabled={!catalog.length}>
            From catalog
          </Button>
          <Button variant={mode === "new" ? "tonal" : "ghost"} size="sm" onClick={() => setMode("new")}>
            New subject
          </Button>
        </div>
        {mode === "pick" ? (
          <Field label="Subject" htmlFor="pick-subject">
            <Select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose…</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" htmlFor="ns-code" required error={errs.code}>
              <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="21CS51" />
            </Field>
            <Field label="Credits" htmlFor="ns-credits" error={errs.credits}>
              <Input inputMode="decimal" value={f.credits} onChange={(e) => setF({ ...f, credits: e.target.value })} placeholder="4" />
            </Field>
            <Field label="Name" htmlFor="ns-name" required error={errs.name} className="sm:col-span-2">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Database Management Systems" />
            </Field>
            <Field label="MSE max" htmlFor="ns-msemax">
              <Input inputMode="numeric" value={f.mse_max} onChange={(e) => setF({ ...f, mse_max: e.target.value })} />
            </Field>
            <Field label="SEE max" htmlFor="ns-seemax">
              <Input inputMode="numeric" value={f.see_max} onChange={(e) => setF({ ...f, see_max: e.target.value })} />
            </Field>
          </div>
        )}
        <Button size="lg" onClick={submit} loading={pending}>
          Add subject
        </Button>
      </div>
    </BottomSheet>
  );
}

export function WithdrawButton({ semesterId }: { semesterId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await setSemesterStatus(semesterId, "DRAFT");
          if (!r.ok) return void toast.error(r.error.message);
          toast.success("Moved back to draft — you can edit again");
          router.refresh();
        })
      }
    >
      <Undo2 /> Withdraw to edit
    </Button>
  );
}
