"use client";

import { PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { requestCorrection } from "@/server/actions/academics";

export function CorrectionButton({ resultId, subject, current }: { resultId: string; subject: string; current: { mse_marks: number | null; see_marks: number | null; grade_points: number | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [v, setV] = useState({ mse_marks: current.mse_marks?.toString() ?? "", see_marks: current.see_marks?.toString() ?? "", grade_points: current.grade_points?.toString() ?? "" });
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = () =>
    start(async () => {
      const proposed: Record<string, number | null> = {};
      for (const k of ["mse_marks", "see_marks", "grade_points"] as const) {
        const nv = v[k] === "" ? null : Number(v[k]);
        if (nv !== current[k]) proposed[k] = nv;
      }
      const r = await requestCorrection(resultId, proposed, reason);
      if (!r.ok) {
        setErr(r.error.fieldErrors ?? {});
        return void toast.error(r.error.message);
      }
      toast.success("Correction sent to your mentor");
      setOpen(false);
      router.refresh();
    });
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <PencilLine /> Request correction
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title={`Correct ${subject}`} description="Verified records change only after your mentor approves.">
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="MSE" htmlFor="c-mse">
              <Input inputMode="decimal" value={v.mse_marks} onChange={(e) => setV({ ...v, mse_marks: e.target.value })} />
            </Field>
            <Field label="SEE" htmlFor="c-see">
              <Input inputMode="decimal" value={v.see_marks} onChange={(e) => setV({ ...v, see_marks: e.target.value })} />
            </Field>
            <Field label="Points" htmlFor="c-gp">
              <Input inputMode="decimal" value={v.grade_points} onChange={(e) => setV({ ...v, grade_points: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason" htmlFor="c-reason" required error={err.reason ?? err["proposed"]} helper="For example: revaluation result, data entry mistake.">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button size="lg" onClick={submit} loading={pending}>
            Send for approval
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
