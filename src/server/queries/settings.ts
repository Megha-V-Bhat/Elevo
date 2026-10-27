import "server-only";
import { cache } from "react";
import { db } from "../supabase";

export type AppSettings = {
  program_total_credits: number;
  pulse_week_start: number; // 0 = Sunday, 1 = Monday
  optional_profile_fields: { dob: boolean; gender: boolean; address: boolean };
  institution: string;
};

const DEFAULTS: AppSettings = {
  program_total_credits: 160,
  pulse_week_start: 1,
  optional_profile_fields: { dob: false, gender: false, address: false },
  institution: "Your Institution",
};

export const appSettings = cache(async (): Promise<AppSettings> => {
  const supabase = await db();
  const { data } = await supabase.from("app_settings").select("key, value");
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    program_total_credits: Number(m.program_total_credits ?? DEFAULTS.program_total_credits),
    pulse_week_start: Number(m.pulse_week_start ?? DEFAULTS.pulse_week_start),
    optional_profile_fields: { ...DEFAULTS.optional_profile_fields, ...(m.optional_profile_fields ?? {}) },
    institution: String(m.institution ?? DEFAULTS.institution),
  };
});
