"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SITE_URL, hasSupabase } from "@/lib/env";
import { adminDb } from "../admin/client";
import { rateLimit } from "../admin/ratelimit";
import { HOME, type Role } from "../authz";
import { AppError, handle } from "../result";
import { db } from "../supabase";

const DB_NOT_CONFIGURED = "Database is not connected. Add your Supabase credentials to .env.local to enable authentication.";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/\d/, "Include a number");

const safeNext = (n: unknown) => (typeof n === "string" && /^\/(?!\/)[\w\-/?=&.]*$/.test(n) ? n : null);

export async function signIn(_: unknown, form: FormData) {
  const res = await handle(async () => {
    const input = z.object({ email, password: z.string().min(1, "Enter your password") }).parse({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!hasSupabase) throw new AppError("UNAUTHENTICATED", DB_NOT_CONFIGURED);
    if (!(await rateLimit("login", input.email, 8, 600)))
      throw new AppError("RATE_LIMITED", "Too many attempts. Wait 10 minutes and try again, or reset your password.");
    const supabase = await db();
    const { data, error } = await supabase.auth.signInWithPassword(input);
    if (error || !data.user) throw new AppError("UNAUTHENTICATED", "That email and password don't match. Check for typos or reset your password.");
    const { data: u } = await supabase.from("users").select("role, status, onboarding_completed_at").eq("id", data.user.id).maybeSingle();
    if (!u) {
      await supabase.auth.signOut();
      throw new AppError("FORBIDDEN", "Your account isn't set up in Elevo yet. Ask your HOD for an invite.");
    }
    if (u.status === "SUSPENDED") {
      await supabase.auth.signOut();
      throw new AppError("FORBIDDEN", "This account is suspended. Contact your HOD.");
    }
    if (u.status === "INVITED") await adminDb().from("users").update({ status: "ACTIVE" }).eq("id", data.user.id);
    return u.onboarding_completed_at ? (safeNext(form.get("next")) ?? HOME[u.role as Role]) : "/setup";
  });
  if (res.ok) redirect(res.data);
  return res;
}

export async function requestPasswordReset(_: unknown, form: FormData) {
  return handle(async () => {
    if (!hasSupabase) throw new AppError("UNAUTHENTICATED", DB_NOT_CONFIGURED);
    const e = email.parse(form.get("email"));
    if (!(await rateLimit("reset", e, 3, 3600))) throw new AppError("RATE_LIMITED", "Too many requests. Try again in an hour.");
    const supabase = await db();
    // Never reveal whether the address exists.
    await supabase.auth.resetPasswordForEmail(e, { redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password` });
    return "If that email is registered, a reset link is on its way. Check your inbox and spam folder.";
  });
}

export async function updatePassword(_: unknown, form: FormData) {
  const res = await handle(async () => {
    if (!hasSupabase) throw new AppError("UNAUTHENTICATED", DB_NOT_CONFIGURED);
    const input = z
      .object({ password, confirm: z.string() })
      .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] })
      .parse({ password: form.get("password"), confirm: form.get("confirm") });
    const supabase = await db();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new AppError("UNAUTHENTICATED", "This link has expired. Request a new one.");
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) throw new AppError("VALIDATION", error.message.includes("different") ? "Choose a password you haven't used before." : "We couldn't update your password. Try again.");
    const { data: u } = await supabase.from("users").select("role, status, onboarding_completed_at").eq("id", auth.user.id).maybeSingle();
    if (u?.status === "INVITED") await adminDb().from("users").update({ status: "ACTIVE" }).eq("id", auth.user.id);
    return !u ? "/login" : u.onboarding_completed_at ? HOME[u.role as Role] : "/setup";
  });
  if (res.ok) redirect(res.data);
  return res;
}
