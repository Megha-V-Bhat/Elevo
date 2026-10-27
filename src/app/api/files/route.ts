import { NextResponse, type NextRequest } from "next/server";
import { assertCanViewStudent, currentUser } from "@/server/authz";
import { BUCKETS, type Bucket } from "@/server/files";
import { db } from "@/server/supabase";

/**
 * Authorised file access. Checks the caller (server guard), then asks Storage
 * for a 60-second signed URL — which Storage RLS also checks — and redirects.
 */
export async function GET(req: NextRequest) {
  const bucket = req.nextUrl.searchParams.get("b") as Bucket | null;
  const path = req.nextUrl.searchParams.get("p");
  const download = req.nextUrl.searchParams.get("dl") === "1";
  if (!bucket || !(bucket in BUCKETS) || !path || path.includes("..")) return NextResponse.json({ ok: false, error: { code: "VALIDATION", message: "Bad file request" } }, { status: 400 });
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in first" } }, { status: 401 });
  try {
    if (bucket === "ask-attachments" || bucket === "avatars") {
      const owner = path.split("/")[0];
      if (bucket === "ask-attachments" && me.role === "HOD") throw new Error("HOD has no access to question content");
      if (owner !== me.id) await assertCanViewStudent(owner);
    }
    const supabase = await db();
    const name = download ? path.split("/").pop()?.replace(/^[a-f0-9]{8}-/, "") : undefined;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, name ? { download: name } : undefined);
    if (error || !data) throw new Error("not allowed");
    return NextResponse.redirect(data.signedUrl);
  } catch {
    return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "You don't have access to this file." } }, { status: 403 });
  }
}
