import "server-only";
import { revalidatePath } from "next/cache";
import { SITE_URL } from "@/lib/env";
import { AppError, must } from "../result";
import { adminDb } from "./client";

/**
 * Creates the auth user + Elevo user row + profile. NOT a server action —
 * callers must have already verified the HOD (inviteUser, bulk import, seed).
 */
export async function createInvitedUser(departmentId: string | null, email: string, role: "MENTEE" | "MENTOR" | "HOD", fullName: string, sendEmail: boolean, extra?: Record<string, unknown>) {
  const admin = adminDb();
  const redirectTo = `${SITE_URL}/auth/confirm?next=/accept-invite`;
  const res = sendEmail
    ? await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName } })
    : await admin.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name: fullName } });
  if (res.error || !res.data.user) {
    if (/already|registered|exists/i.test(res.error?.message ?? "")) throw new AppError("CONFLICT", `${email} already has an account.`);
    throw new AppError("INTERNAL", "We couldn't send the invite. Check the email settings (SMTP) and try again.");
  }
  const id = res.data.user.id;
  must(await admin.from("users").upsert({ id, email, role, status: "INVITED", department_id: departmentId }));
  const table = role === "MENTEE" ? "student_profiles" : "mentor_profiles";
  must(await admin.from(table).upsert({ user_id: id, full_name: fullName, department_id: departmentId, ...(extra ?? {}) }), "Couldn't create the profile (is that USN or faculty ID already used?).");
  revalidatePath("/hod", "layout");
  return id;
}
