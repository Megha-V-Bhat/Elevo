import "server-only";
import { revalidatePath } from "next/cache";
import { SITE_URL } from "@/lib/env";
import { AppError, must } from "../result";
import { adminDb } from "./client";

/** Plain-language reason for an auth email failure (Supabase's built-in sender is heavily limited). */
export function emailFailure(e: { status?: number; message?: string } | null) {
  const m = e?.message ?? "";
  if (e?.status === 429 || /rate limit/i.test(m)) return "The email limit is used up (Supabase's built-in email sends only a few an hour).";
  if (/not authori[sz]ed/i.test(m)) return "Supabase's built-in email only delivers to members of your Supabase organisation.";
  return "The email couldn't be sent. Check the SMTP settings in Supabase.";
}

/**
 * A one-time sign-in link the HOD can share themselves (WhatsApp, chat…). Needs no email and no
 * redirect allow-listing: it points straight at /auth/confirm with a token hash. "invite" creates
 * the auth user; "recovery" is for someone who already has one (e.g. still INVITED).
 */
export async function invitationLink(email: string, type: "invite" | "recovery", fullName?: string) {
  const { data, error } = await adminDb().auth.admin.generateLink(type === "invite" ? { type, email, options: { data: { full_name: fullName } } } : { type, email });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) {
    if (/already|registered|exists/i.test(error?.message ?? "")) throw new AppError("CONFLICT", `${email} already has an account.`);
    throw new AppError("INTERNAL", "We couldn't create an invite link. Try again in a minute.");
  }
  return { id: data.user.id, link: `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=${type}&next=/accept-invite` };
}

/**
 * Creates the auth user + Elevo user row + profile. NOT a server action —
 * callers must have already verified the HOD (inviteUser, bulk import, seed).
 * When the email can't be sent, the account is still created and `link` holds a
 * shareable invite link instead (`emailError` says why).
 */
export async function createInvitedUser(departmentId: string | null, email: string, role: "MENTEE" | "MENTOR" | "HOD", fullName: string, sendEmail: boolean, extra?: Record<string, unknown>) {
  const admin = adminDb();
  const created = await createAuthUser(email, fullName, sendEmail);
  const id = created.id;
  must(await admin.from("users").upsert({ id, email, role, status: "INVITED", department_id: departmentId }));
  const table = role === "MENTEE" ? "student_profiles" : "mentor_profiles";
  must(await admin.from(table).upsert({ user_id: id, full_name: fullName, department_id: departmentId, ...(extra ?? {}) }), "Couldn't create the profile (is that USN or faculty ID already used?).");
  revalidatePath("/hod", "layout");
  return created;
}

async function createAuthUser(email: string, fullName: string, sendEmail: boolean): Promise<{ id: string; link: string | null; emailError: string | null }> {
  const admin = adminDb();
  if (!sendEmail) {
    const res = await admin.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name: fullName } });
    if (res.error || !res.data.user) {
      if (/already|registered|exists/i.test(res.error?.message ?? "")) throw new AppError("CONFLICT", `${email} already has an account.`);
      throw new AppError("INTERNAL", "We couldn't create the account. Try again in a minute.");
    }
    return { id: res.data.user.id, link: null, emailError: null };
  }
  const res = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${SITE_URL}/auth/confirm?next=/accept-invite`, data: { full_name: fullName } });
  if (res.data.user) return { id: res.data.user.id, link: null, emailError: null };
  if (/already|registered|exists/i.test(res.error?.message ?? "")) throw new AppError("CONFLICT", `${email} already has an account.`);
  // Email failed (limit, unauthorised address, SMTP): still create the account, with a link to share.
  const { id, link } = await invitationLink(email, "invite", fullName);
  return { id, link, emailError: emailFailure(res.error) };
}
