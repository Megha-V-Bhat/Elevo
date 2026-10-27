"use client";

import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ArrowRight, GripVertical, Search, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { Button } from "@/components/ui/button";
import { Avatar, Meter } from "@/components/ui/display";
import { Field, Input, Segmented, Select } from "@/components/ui/form";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { assignStudents, type Moved, unassignStudents, undoAssignment } from "@/server/admin/actions";

export type BoardStudent = { id: string; name: string; usn: string | null; sem: number | null; section: string | null };
export type BoardMentor = { id: string; name: string; capacity: number };
export type HistoryRow = { id: string; student: string; mentor: string; started_at: string; ended_at: string | null; reason: string | null };

const POOL = "__unassigned__";

type Pending = { ids: string[]; to: string };

export function AssignmentBoard({
  students,
  mentors,
  initial,
  history,
  focusStudent,
  focusMentor,
}: {
  students: BoardStudent[];
  mentors: BoardMentor[];
  initial: Record<string, string>; // student → mentor
  history: HistoryRow[];
  focusStudent?: string;
  focusMentor?: string;
}) {
  const router = useRouter();
  const [map, setMap] = useState<Record<string, string>>(initial);
  const [mode, setMode] = useState<"board" | "table" | "grouped" | "history">("board");
  const [selected, setSelected] = useState<Set<string>>(new Set(focusStudent ? [focusStudent] : []));
  const [q, setQ] = useState("");
  const [sem, setSem] = useState("");
  const [section, setSection] = useState("");
  const [target, setTarget] = useState(focusMentor ?? "");
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [busy, start] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const mentorName = (id: string) => (id === POOL ? "Unassigned" : (mentors.find((m) => m.id === id)?.name ?? "Mentor"));
  const visible = students.filter(
    (s) => (!q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.usn ?? "").toLowerCase().includes(q.toLowerCase())) && (!sem || String(s.sem) === sem) && (!section || s.section === section),
  );
  const colOf = (mentorId: string) => visible.filter((s) => (map[s.id] ?? POOL) === mentorId);
  const count = (mentorId: string) => students.filter((s) => map[s.id] === mentorId).length;
  const toggle = (id: string) =>
    setSelected((x) => {
      const n = new Set(x);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const request = (ids: string[], to: string) => {
    const moving = ids.filter((id) => (map[id] ?? POOL) !== to);
    if (!moving.length) return;
    setReason("");
    setPending({ ids: moving, to });
  };

  const summary = pending
    ? Object.entries(
        pending.ids.reduce<Record<string, number>>((acc, id) => {
          const from = map[id] ?? POOL;
          acc[from] = (acc[from] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([from, n]) => `Move ${n} student${n > 1 ? "s" : ""} from ${mentorName(from)} to ${mentorName(pending.to)}`)
    : [];

  const confirm = () =>
    start(async () => {
      if (!pending) return;
      const before = { ...map };
      const next = { ...map };
      for (const id of pending.ids) {
        if (pending.to === POOL) delete next[id];
        else next[id] = pending.to;
      }
      setMap(next); // optimistic
      const res = pending.to === POOL ? await unassignStudents(pending.ids, reason || undefined) : await assignStudents(pending.ids, pending.to, reason || undefined);
      if (!res.ok) {
        setMap(before);
        return void toast.error(res.error.message);
      }
      const moved = res.data as Moved[];
      setPending(null);
      setSelected(new Set());
      toast.success(summary.join(" · "), {
        duration: 10_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const u = await undoAssignment(moved);
            if (!u.ok) return void toast.error(u.error.message);
            setMap(before);
            toast.success("Undone");
            router.refresh();
          },
        },
      });
      router.refresh();
    });

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const to = e.over?.id as string | undefined;
    if (!to) return;
    const id = e.active.id as string;
    const ids = selected.has(id) ? [...selected] : [id];
    request(ids, to);
  };

  const sems = [...new Set(students.map((s) => s.sem).filter(Boolean))].sort() as number[];
  const sections = [...new Set(students.map((s) => s.section).filter(Boolean))].sort() as string[];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          label="View"
          value={mode}
          onChange={setMode}
          options={[
            { value: "board", label: "Board" },
            { value: "table", label: "Table" },
            { value: "grouped", label: "Mentor → mentees" },
            { value: "history", label: "History" },
          ]}
        />
        {mode !== "history" && (
          <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto_auto] lg:ml-auto lg:max-w-xl">
            <label className="relative">
              <span className="sr-only">Filter students</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or USN" className="pl-9" />
            </label>
            <Select aria-label="Semester" value={sem} onChange={(e) => setSem(e.target.value)}>
              <option value="">Any sem</option>
              {sems.map((s) => (
                <option key={s} value={String(s)}>
                  Sem {s}
                </option>
              ))}
            </Select>
            <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">Any section</option>
              {sections.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {(mode === "board" || mode === "table") && (
        <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface/95 p-3 shadow-1 backdrop-blur">
          <span className="text-small font-semibold text-ink-900 tnum">{selected.size} selected</span>
          {selected.size > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select aria-label="Reassign to" value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 w-56">
              <option value="">Reassign to…</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({count(m.id)}/{m.capacity})
                </option>
              ))}
              <option value={POOL}>Unassigned pool</option>
            </Select>
            <Button size="sm" disabled={!selected.size || !target} onClick={() => request([...selected], target)}>
              Move <ArrowRight />
            </Button>
          </div>
        </div>
      )}

      {mode === "board" && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setDragging(e.active.id as string)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <p className="mb-3 text-small text-ink-500">Drag a student (or a selection) onto a mentor. Keyboard: focus a card, press Space, use arrow keys, press Space to drop.</p>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
            <Column id={POOL} title="Unassigned" subtitle={`${colOf(POOL).length} students`} tone="butter">
              {colOf(POOL).map((s) => (
                <Card key={s.id} s={s} selected={selected.has(s.id)} onToggle={() => toggle(s.id)} />
              ))}
            </Column>
            {mentors.map((m) => {
              const n = count(m.id);
              return (
                <Column
                  key={m.id}
                  id={m.id}
                  title={m.name}
                  subtitle={`${n}/${m.capacity}`}
                  meter={<Meter value={Math.min(n, m.capacity)} max={m.capacity} label={`${m.name} capacity`} tone={n > m.capacity ? "coral" : "pine"} />}
                  highlight={focusMentor === m.id}
                >
                  {colOf(m.id).map((s) => (
                    <Card key={s.id} s={s} selected={selected.has(s.id)} onToggle={() => toggle(s.id)} />
                  ))}
                </Column>
              );
            })}
          </div>
          <DragOverlay>{dragging && byId.get(dragging) ? <CardBody s={byId.get(dragging)!} count={selected.has(dragging) ? selected.size : 1} /> : null}</DragOverlay>
        </DndContext>
      )}

      {mode === "table" && (
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-1">
          <table className="w-full text-small">
            <caption className="sr-only">Assignments</caption>
            <thead className="bg-canvas-sunk text-left text-ink-700">
              <tr>
                <th scope="col" className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all visible"
                    className="size-5 accent-pine-600"
                    checked={visible.length > 0 && visible.every((s) => selected.has(s.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((s) => s.id)) : new Set())}
                  />
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">Student</th>
                <th scope="col" className="hidden px-3 py-3 font-semibold sm:table-cell">Sem · Section</th>
                <th scope="col" className="px-3 py-3 font-semibold">Mentor</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Select ${s.name}`} className="size-5 accent-pine-600" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-semibold text-ink-900">{s.name}</span>
                    <span className="block text-ink-500">{s.usn}</span>
                  </td>
                  <td className="hidden px-3 py-2 text-ink-700 sm:table-cell">
                    {s.sem ? `Sem ${s.sem}` : "—"} · {s.section ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Select aria-label={`Mentor for ${s.name}`} className="h-10" value={map[s.id] ?? POOL} onChange={(e) => request([s.id], e.target.value)}>
                      <option value={POOL}>Unassigned</option>
                      {mentors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === "grouped" && (
        <div className="grid gap-4 md:grid-cols-2">
          {mentors.map((m) => {
            const list = students.filter((s) => map[s.id] === m.id);
            return (
              <section key={m.id} className="rounded-card border border-line bg-surface p-4 shadow-1">
                <h3 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
                  <Avatar name={m.name} size={32} /> {m.name}
                  <span className="ml-auto text-small font-semibold text-ink-500 tnum">
                    {list.length}/{m.capacity}
                  </span>
                </h3>
                {list.length ? (
                  <ul className="mt-3 grid gap-1 text-small sm:grid-cols-2">
                    {list.map((s) => (
                      <li key={s.id} className="truncate text-ink-700">
                        • {s.name} <span className="text-ink-500">{s.usn}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-small text-ink-500">No mentees.</p>
                )}
              </section>
            );
          })}
          <section className="rounded-card border border-butter-100 bg-butter-50 p-4">
            <h3 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
              <UserMinus className="size-5 text-butter-800" aria-hidden /> Unassigned
              <span className="ml-auto text-small font-semibold text-ink-700 tnum">{students.filter((s) => !map[s.id]).length}</span>
            </h3>
            <ul className="mt-3 grid gap-1 text-small sm:grid-cols-2">
              {students
                .filter((s) => !map[s.id])
                .map((s) => (
                  <li key={s.id} className="truncate text-ink-700">
                    • {s.name}
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}

      {mode === "history" && (
        <ol className="grid gap-2">
          {history.length ? (
            history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-panel border border-line bg-surface px-4 py-3 text-small">
                <span className="font-semibold text-ink-900">{h.student}</span>
                <ArrowRight className="size-4 text-ink-500" aria-hidden />
                <span className="font-semibold text-pine-700">{h.mentor}</span>
                <span className="text-ink-500">
                  {fmtDate(h.started_at)} → {h.ended_at ? fmtDate(h.ended_at) : "now"}
                </span>
                {h.reason && <span className="text-ink-700">· {h.reason}</span>}
              </li>
            ))
          ) : (
            <p className="text-ink-500">No assignment history yet.</p>
          )}
        </ol>
      )}

      <BottomSheet open={!!pending} onOpenChange={(v) => !v && setPending(null)} title="Confirm reassignment" description="Access moves immediately: the previous mentor loses access to these students, including their questions.">
        <ul className="grid gap-2">
          {summary.map((s) => (
            <li key={s} className="rounded-panel bg-canvas-sunk px-3.5 py-2.5 font-semibold text-ink-900">
              {s}
            </li>
          ))}
        </ul>
        <Field label="Reason" htmlFor="asg-reason" optional className="mt-4">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Rebalancing load for semester 5" />
        </Field>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} onClick={confirm}>
            Confirm
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function Column({ id, title, subtitle, meter, tone, highlight, children }: { id: string; title: string; subtitle: string; meter?: React.ReactNode; tone?: "butter"; highlight?: boolean; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${title}, ${subtitle}`}
      className={cn(
        "flex max-h-[70vh] w-72 shrink-0 flex-col rounded-card border p-3 transition-colors",
        tone === "butter" ? "border-butter-100 bg-butter-50" : "border-line bg-canvas-sunk",
        isOver && "border-pine-600 bg-pine-50",
        highlight && "ring-2 ring-pine-600",
      )}
    >
      <header className="mb-2 px-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-semibold text-ink-900">{title}</h3>
          <span className="text-small font-semibold text-ink-700 tnum">{subtitle}</span>
        </div>
        {meter && <div className="mt-1.5">{meter}</div>}
      </header>
      <ul className="grid gap-2 overflow-y-auto">{children}</ul>
    </section>
  );
}

function Card({ s, selected, onToggle }: { s: BoardStudent; selected: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: s.id });
  return (
    <li ref={setNodeRef} className={cn("rounded-panel border bg-surface shadow-1", selected ? "border-pine-600" : "border-line", isDragging && "opacity-40")}>
      <div className="flex items-center gap-2 p-2">
        <input type="checkbox" aria-label={`Select ${s.name}`} checked={selected} onChange={onToggle} className="size-5 shrink-0 accent-pine-600" />
        <button type="button" {...listeners} {...attributes} aria-label={`Move ${s.name}`} className="flex min-h-11 min-w-0 flex-1 cursor-grab items-center gap-2 rounded-control text-left active:cursor-grabbing">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-small font-semibold text-ink-900">{s.name}</span>
            <span className="block truncate text-[12px] text-ink-500">{[s.usn, s.sem && `S${s.sem}`, s.section].filter(Boolean).join(" · ")}</span>
          </span>
          <GripVertical className="size-4 shrink-0 text-ink-400" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function CardBody({ s, count }: { s: BoardStudent; count: number }) {
  return (
    <div className="w-64 rounded-panel border border-pine-600 bg-surface p-3 shadow-dock">
      <p className="truncate text-small font-semibold text-ink-900">{s.name}</p>
      {count > 1 && <p className="text-[12px] font-semibold text-pine-700">+ {count - 1} more selected</p>}
    </div>
  );
}
