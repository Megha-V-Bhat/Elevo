import { CircleHelp } from "lucide-react";
import { Chip } from "@/components/ui/display";
import { fmt } from "@/lib/utils";
import type { ResultView } from "@/server/queries/academics";

const pct = (v: number | null) => (v == null ? "—" : `${fmt(v, 1)}%`);
const marks = (m: number | null, max: number | null, applies: boolean) => (!applies ? "n/a" : m == null ? "—" : `${fmt(m, 1)}/${max ?? "?"}`);

/** Read-only results. Marks, %, grade and points are kept in clearly separate columns. Cards on mobile. */
export function ResultsTable({ results, action }: { results: ResultView[]; action?: (r: ResultView) => React.ReactNode }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-1 md:block">
        <table className="w-full text-small tnum">
          <caption className="sr-only">Subject results</caption>
          <thead className="bg-canvas-sunk text-left text-ink-700">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Credits</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">MSE marks</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">SEE marks</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                <span className="inline-flex items-center gap-1">
                  Total % <CircleHelp className="size-3.5 text-ink-500" aria-label="Weighted total of MSE, SEE and internal assessment per the grading scheme" />
                </span>
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Grade</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Points</th>
              <th scope="col" className="px-3 py-3 font-semibold">Result</th>
              {action && <th scope="col" className="px-3 py-3"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <span className="font-semibold text-ink-900">{r.subject.name}</span>
                  <span className="block text-ink-500">{r.subject.code}</span>
                </td>
                <td className="px-3 py-3 text-right">{r.subject.credits ?? "—"}</td>
                <td className="px-3 py-3 text-right">{marks(r.mse_marks, r.mse_max, r.subject.has_mse)}</td>
                <td className="px-3 py-3 text-right">{marks(r.see_marks, r.see_max, r.subject.has_see)}</td>
                <td className="px-3 py-3 text-right" title={r.total_pct == null ? (r.derived_note ?? undefined) : undefined}>{pct(r.total_pct)}</td>
                <td className="px-3 py-3 text-right font-semibold text-ink-900">{r.grade ?? r.derived_grade ?? "—"}</td>
                <td className="px-3 py-3 text-right">{fmt(r.grade_points ?? r.derived_points)}</td>
                <td className="px-3 py-3">
                  <ResultChip result={r.result} />
                </td>
                {action && <td className="px-3 py-3 text-right">{action(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden">
        {results.map((r) => (
          <li key={r.id} className="rounded-card border border-line bg-surface p-4 shadow-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{r.subject.name}</p>
                <p className="text-small text-ink-500">
                  {r.subject.code} · {r.subject.credits ?? "?"} cr
                </p>
              </div>
              <span className="font-display text-h3 font-bold text-ink-900">{r.grade ?? r.derived_grade ?? "—"}</span>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-small tnum">
              <div>
                <dt className="text-ink-500">MSE</dt>
                <dd className="font-semibold text-ink-900">{marks(r.mse_marks, r.mse_max, r.subject.has_mse)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">SEE</dt>
                <dd className="font-semibold text-ink-900">{marks(r.see_marks, r.see_max, r.subject.has_see)}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Total</dt>
                <dd className="font-semibold text-ink-900">{pct(r.total_pct)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2">
              <ResultChip result={r.result} />
              {action?.(r)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ResultChip({ result }: { result: ResultView["result"] }) {
  const tone = result === "PASS" ? "mint" : result === "FAIL" ? "coral" : result === "ABSENT" ? "butter" : "neutral";
  return <Chip tone={tone}>{result === "PASS" ? "Pass" : result === "FAIL" ? "Fail" : result === "ABSENT" ? "Absent" : "Pending"}</Chip>;
}
