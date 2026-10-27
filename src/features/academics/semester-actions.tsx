"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shell/dock";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { createSemester } from "@/server/actions/academics";

export function AddSemesterButton({ existing, current }: { existing: number[]; current: number | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const options = Array.from({ length: 8 }, (_, i) => i + 1).filter((n) => !existing.includes(n));
  const [no, setNo] = useState(String(options.includes(current ?? 0) ? current : (options[0] ?? "")));
  const [year, setYear] = useState("");
  useEffect(() => {
    if (params.get("new") === "1") setOpen(true);
  }, [params]);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!options.length}>
        <Plus /> Add semester
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Add a semester" description="Subjects are pre-filled from your department catalog.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createSemester(Number(no), year || null);
              if (!r.ok) return void toast.error(r.error.message);
              toast.success(`Semester ${r.data.semester_no} added`);
              setOpen(false);
              router.push(`/mentee/academics/${r.data.semester_no}`);
            });
          }}
        >
          <Field label="Semester" htmlFor="new-sem" required>
            <Select value={no} onChange={(e) => setNo(e.target.value)}>
              {options.map((n) => (
                <option key={n} value={n}>
                  Semester {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Academic year" htmlFor="new-year" optional>
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026-27" />
          </Field>
          <Button type="submit" size="lg" loading={pending}>
            Add and enter marks
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
