"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentWeekStart } from "@/lib/dates";
import { pulseInput } from "@/lib/validators";
import { requireRole } from "../authz";
import { appSettings } from "../queries/settings";
import { handle, must } from "../result";
import { db } from "../supabase";

export async function savePulse(input: unknown) {
  return handle(async () => {
    const u = await requireRole("MENTEE");
    const v = pulseInput.parse(input);
    const { pulse_week_start } = await appSettings();
    const supabase = await db();
    must(
      await supabase.from("pulse_checkins").upsert(
        {
          student_id: u.id,
          week_start: currentWeekStart(pulse_week_start),
          mood: v.mood,
          workload: v.workload,
          subject_confidence: v.subject_confidence,
          help_note: v.help_note,
          share_note: v.share_note,
        },
        { onConflict: "student_id,week_start" },
      ),
      "We couldn't save your check-in. This week's check-in may have closed — try again next week.",
    );
    revalidatePath("/mentee/pulse");
    revalidatePath("/mentee");
    return true;
  });
}

export async function markPulseSeen(checkinId: string) {
  return handle(async () => {
    await requireRole("MENTOR");
    const supabase = await db();
    must(await supabase.rpc("mark_pulse_seen", { p_id: z.string().uuid().parse(checkinId) }));
    revalidatePath("/mentor", "layout");
    return true;
  });
}
