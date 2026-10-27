"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { planInput } from "@/lib/validators";
import { requireRole } from "../authz";
import { handle, must } from "../result";
import { db } from "../supabase";

export async function savePlan(input: unknown) {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    const v = planInput.parse(input);
    const supabase = await db();
    must(await supabase.from("target_plans").insert({ student_id: u.id, ...v }));
    revalidatePath("/mentee/planner");
    return true;
  });
}

export async function sharePlan(id: string, share: boolean) {
  return handle(async () => {
    await requireRole("MENTEE");
    const supabase = await db();
    must(await supabase.from("target_plans").update({ shared_with_mentor: share }).eq("id", z.string().uuid().parse(id)));
    revalidatePath("/mentee/planner");
    return true;
  });
}

export async function deletePlan(id: string) {
  return handle(async () => {
    await requireRole("MENTEE");
    const supabase = await db();
    must(await supabase.from("target_plans").delete().eq("id", z.string().uuid().parse(id)));
    revalidatePath("/mentee/planner");
    return true;
  });
}
