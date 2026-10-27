"use client";

import { Check, CornerUpLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { decideChangeRequest, returnSemester, verifySemesters } from "@/server/actions/verification";

export function BulkVerify({ items, children }: { items: { id: string; label: string }[]; children: (sel: { selected: Set<string>; toggle: (id: string) => void }) => React.ReactNode }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const all = selected.size === items.length && items.length > 0;
  return (
    <div>
      <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface/95 p-3 shadow-1 backdrop-blur">
        <label className="flex min-h-11 items-center gap-2 px-1 text-small font-semibold text-ink-900">
          <input type="checkbox" className="size-5 accent-pine-600" checked={all} onChange={() => setSelected(all ? new Set() : new Set(items.map((i) => i.id)))} />
          Select all ({items.length})
        </label>
        <Button
          className="ml-auto"
          disabled={!selected.size}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await verifySemesters([...selected]);
              if (!r.ok) return void toast.error(r.error.message);
              toast.success(`${r.data} semester${r.data === 1 ? "" : "s"} verified — students notified`);
              setSelected(new Set());
              router.refresh();
            })
          }
        >
          <Check /> Verify {selected.size || ""} selected
        </Button>
      </div>
      {children({ selected, toggle })}
    </div>
  );
}

export function ReturnButton({ semesterId }: { semesterId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <CornerUpLeft /> Return with a note
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Return for edits" description="The semester goes back to draft and the student sees your note.">
        <div className="grid gap-4">
          <Field label="What should they fix?" htmlFor="ret-note" required>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="DBMS SEE marks look swapped with OS — please check your marks card." />
          </Field>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await returnSemester(semesterId, note);
                if (!r.ok) return void toast.error(r.error.message);
                toast.success("Returned to the student");
                setOpen(false);
                router.refresh();
              })
            }
          >
            Send back
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

export function DecideRequest({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await decideChangeRequest(id, approve, note || undefined);
      if (!r.ok) return void toast.error(r.error.message);
      toast.success(approve ? "Approved and applied — SGPA/CGPA recalculated" : "Declined — the student was notified");
      router.refresh();
    });
  return (
    <div className="grid gap-2">
      <label htmlFor={`note-${id}`} className="sr-only">
        Note to student
      </label>
      <Textarea id={`note-${id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to the student" />
      <div className="flex gap-2">
        <Button size="sm" loading={pending} onClick={() => decide(true)}>
          <Check /> Approve
        </Button>
        <Button size="sm" variant="secondary" loading={pending} onClick={() => decide(false)}>
          <X /> Decline
        </Button>
      </div>
    </div>
  );
}
