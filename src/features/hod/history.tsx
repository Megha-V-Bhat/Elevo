import { fmtDateTime } from "@/lib/dates";
import { db } from "@/server/supabase";

const SKIP = new Set(["id", "created_at", "updated_at", "draft"]);

/** Before/after diff for one audit row. */
export function AuditDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((k) => !SKIP.has(k) && JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (!keys.length) return <p className="text-small text-ink-500">No field changes.</p>;
  return (
    <table className="w-full text-small tnum">
      <thead className="text-left text-ink-500">
        <tr>
          <th scope="col" className="py-1 pr-3 font-semibold">Field</th>
          <th scope="col" className="py-1 pr-3 font-semibold">Before</th>
          <th scope="col" className="py-1 font-semibold">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="border-t border-line align-top">
            <td className="py-1.5 pr-3 text-ink-700">{k}</td>
            <td className="max-w-48 truncate py-1.5 pr-3 text-coral-700">{before?.[k] == null ? "—" : String(typeof before[k] === "object" ? JSON.stringify(before[k]) : before[k])}</td>
            <td className="max-w-48 truncate py-1.5 font-semibold text-pine-700">{after?.[k] == null ? "—" : String(typeof after[k] === "object" ? JSON.stringify(after[k]) : after[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** "History" drawer content for a set of entity ids (HOD only via RLS). */
export async function HistoryList({ entityIds, limit = 30 }: { entityIds: string[]; limit?: number }) {
  if (!entityIds.length) return <p className="text-small text-ink-500">No history yet.</p>;
  const supabase = await db();
  const { data } = await supabase.from("audit_logs").select("id, actor_id, action, entity_type, before, after, created_at").in("entity_id", entityIds.slice(0, 200)).order("created_at", { ascending: false }).limit(limit);
  const actors = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const [{ data: sp }, { data: mp }] = await Promise.all([
    actors.length ? supabase.from("student_profiles").select("user_id, full_name").in("user_id", actors) : Promise.resolve({ data: [] }),
    actors.length ? supabase.from("mentor_profiles").select("user_id, full_name").in("user_id", actors) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map([...(sp ?? []), ...(mp ?? [])].map((p) => [p.user_id, p.full_name]));
  if (!data?.length) return <p className="text-small text-ink-500">No history yet.</p>;
  return (
    <ol className="grid gap-3">
      {data.map((r) => (
        <li key={r.id} className="rounded-panel border border-line p-3">
          <p className="text-small">
            <span className="font-semibold text-ink-900">{r.actor_id ? (names.get(r.actor_id) ?? "Someone") : "System"}</span>
            <span className="text-ink-500">
              {" "}
              · {r.action} {r.entity_type.replace(/_/g, " ")} · {fmtDateTime(r.created_at)}
            </span>
          </p>
          <div className="mt-2">
            <AuditDiff before={r.before as Record<string, unknown> | null} after={r.after as Record<string, unknown> | null} />
          </div>
        </li>
      ))}
    </ol>
  );
}
