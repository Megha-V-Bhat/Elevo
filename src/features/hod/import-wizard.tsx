"use client";

import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Illustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/display";
import { Segmented, Switch } from "@/components/ui/form";
import { IMPORT_SPECS, type ImportKind, type PreviewRow } from "@/lib/imports";
import { cn } from "@/lib/utils";
import { commitImport, previewImport } from "@/server/admin/imports";

const STEPS = ["Choose type", "Upload", "Preview", "Done"];

export function ImportWizard() {
  const [kind, setKind] = useState<ImportKind>("students");
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ jobId: string; rows: PreviewRow[]; total: number } | null>(null);
  const [dups, setDups] = useState<"skip" | "update">("skip");
  const [invites, setInvites] = useState(true);
  const [filter, setFilter] = useState<"all" | "error" | "duplicate">("all");
  const [result, setResult] = useState<{ imported: number; failures: { line: number; error: string }[] } | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const spec = IMPORT_SPECS[kind];
  const counts = preview ? { valid: preview.rows.filter((r) => r.status === "valid").length, error: preview.rows.filter((r) => r.status === "error").length, duplicate: preview.rows.filter((r) => r.status === "duplicate").length } : null;

  const errorReport = () => {
    const lines = [["line", "status", "message"], ...(preview?.rows.filter((r) => r.status !== "valid").map((r) => [r.line, r.status, r.errors.join("; ")]) ?? []), ...(result?.failures.map((f) => [f.line, "failed", f.error]) ?? [])];
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `elevo-${kind}-import-errors.csv`;
    a.click();
  };

  return (
    <div className="grid gap-5">
      <ol className="flex flex-wrap gap-2" aria-label="Import progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-small font-semibold", i < step ? "bg-mint-100 text-pine-700" : i === step ? "bg-pine-600 text-white" : "bg-canvas-sunk text-ink-500")}>
            <span className="tnum">{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card>
          <h2 className="font-display text-h3 font-semibold text-ink-900">What are you importing?</h2>
          <p className="mt-1 text-small text-ink-500">Tip: import subjects and mentors first, then students, then results.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(IMPORT_SPECS) as ImportKind[]).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={cn("rounded-card border-2 p-4 text-left transition-colors", kind === k ? "border-pine-600 bg-pine-50" : "border-line bg-surface hover:border-pine-100")}>
                <FileSpreadsheet className="size-6 text-pine-600" aria-hidden />
                <p className="mt-2 font-semibold text-ink-900">{IMPORT_SPECS[k].label}</p>
                <p className="mt-1 text-small text-ink-500">{IMPORT_SPECS[k].columns.slice(0, 4).join(", ")}…</p>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <a href={`/api/imports/template?kind=${kind}&format=xlsx`}>
                <Download /> Excel template
              </a>
            </Button>
            <Button asChild variant="ghost">
              <a href={`/api/imports/template?kind=${kind}&format=csv`}>
                <Download /> CSV template
              </a>
            </Button>
            <Button className="sm:ml-auto" onClick={() => setStep(1)}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h2 className="font-display text-h3 font-semibold text-ink-900">Upload {spec.label.toLowerCase()}</h2>
          <p className="mt-1 text-small text-ink-500">
            Columns: <span className="font-semibold text-ink-700">{spec.columns.join(", ")}</span>. Required: {spec.required.join(", ")}.
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className="mt-4 flex flex-col items-center rounded-panel border-2 border-dashed border-line-strong bg-canvas p-8 text-center"
          >
            <Upload className="size-7 text-pine-600" aria-hidden />
            <p className="mt-2 text-body text-ink-700">{file ? <span className="font-semibold text-ink-900">{file.name}</span> : "Drop a .csv or .xlsx file here"}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => ref.current?.click()}>
              Browse
            </Button>
            <input ref={ref} type="file" accept=".csv,.xlsx" className="sr-only" tabIndex={-1} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              className="ml-auto"
              disabled={!file}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const fd = new FormData();
                  fd.set("kind", kind);
                  fd.set("file", file!);
                  const r = await previewImport(fd);
                  if (!r.ok) return void toast.error(r.error.message);
                  setPreview(r.data);
                  setStep(2);
                })
              }
            >
              Check file
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && preview && counts && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-h3 font-semibold text-ink-900">Preview · {preview.total} rows</h2>
            <Chip tone="mint">{counts.valid} ready</Chip>
            {counts.duplicate > 0 && <Chip tone="butter">{counts.duplicate} duplicates</Chip>}
            {counts.error > 0 && <Chip tone="coral">{counts.error} with errors</Chip>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Segmented
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "error", label: "Errors" },
                { value: "duplicate", label: "Duplicates" },
              ]}
            />
            {(counts.error > 0 || counts.duplicate > 0) && (
              <Button size="sm" variant="ghost" onClick={errorReport}>
                <Download /> Error report
              </Button>
            )}
          </div>
          <div className="mt-4 max-h-[420px] overflow-auto rounded-panel border border-line">
            <table className="w-full text-small">
              <thead className="sticky top-0 bg-canvas-sunk text-left text-ink-700">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Line</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  {spec.columns.slice(0, 4).map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-semibold">
                      {c}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows
                  .filter((r) => filter === "all" || r.status === filter)
                  .map((r) => (
                    <tr key={r.line} className="border-t border-line align-top">
                      <td className="px-3 py-2 tnum text-ink-500">{r.line}</td>
                      <td className="px-3 py-2">
                        <Chip tone={r.status === "valid" ? "mint" : r.status === "duplicate" ? "butter" : "coral"}>{r.status}</Chip>
                      </td>
                      {spec.columns.slice(0, 4).map((c) => (
                        <td key={c} className="max-w-40 truncate px-3 py-2 text-ink-900">
                          {String(r.data[c] ?? "")}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-coral-700">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(kind === "subjects" || kind === "results") && (
              <div>
                <p className="mb-2 text-small font-semibold text-ink-900">Duplicates</p>
                <Segmented
                  label="Duplicate handling"
                  value={dups}
                  onChange={setDups}
                  options={[
                    { value: "skip", label: "Skip them" },
                    { value: "update", label: "Update existing" },
                  ]}
                />
              </div>
            )}
            {(kind === "students" || kind === "mentors") && <Switch id="send-invites" checked={invites} onChange={setInvites} label="Send invite emails now" description="Off creates accounts silently; resend invites later from Users." />}
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              className="ml-auto"
              disabled={!counts.valid && dups === "skip"}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await commitImport(preview.jobId, { duplicates: dups, sendInvites: invites });
                  if (!r.ok) return void toast.error(r.error.message);
                  setResult(r.data);
                  setStep(3);
                })
              }
            >
              Import {dups === "update" ? counts.valid + counts.duplicate : counts.valid} rows
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && result && (
        <Card className="text-center">
          <Illustration name="import-done" className="mx-auto h-36" />
          <h2 className="mt-3 flex items-center justify-center gap-2 font-display text-display-m font-bold text-ink-900">
            <CheckCircle2 className="size-7 text-pine-600" aria-hidden /> {result.imported} imported
          </h2>
          {result.failures.length > 0 && <p className="mt-2 text-body text-coral-700">{result.failures.length} rows need attention — download the error report.</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {(result.failures.length > 0 || (counts && counts.error > 0)) && (
              <Button variant="secondary" onClick={errorReport}>
                <Download /> Error report
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setStep(0);
                setFile(null);
                setPreview(null);
                setResult(null);
              }}
            >
              Import more
            </Button>
            <Button asChild>
              <Link href={kind === "students" || kind === "mentors" ? "/hod/assignments" : "/hod/students"}>{kind === "students" || kind === "mentors" ? "Go to assignments" : "View students"}</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
