import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auditEvent } from "@/server/admin/audit";
import { currentUser, isActiveMentorOf } from "@/server/authz";
import { buildReportData } from "@/server/pdf/report-data";
import { StudentReport } from "@/server/pdf/student-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deny = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

/** Student report PDF: only the student's CURRENT mentor or the HOD. Audited. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) return deny(400, "VALIDATION", "Invalid student id");
  const id = parsed.data;
  const me = await currentUser();
  if (!me || me.status === "SUSPENDED") return deny(401, "UNAUTHENTICATED", "Sign in first");
  const allowed = me.role === "HOD" || (me.role === "MENTOR" && (await isActiveMentorOf(me.id, id)));
  if (!allowed) return deny(403, "FORBIDDEN", "Only the student's current mentor or the HOD can download this report.");
  const data = await buildReportData(id);
  if (!data) return deny(404, "NOT_FOUND", "Student not found");
  const pdf = await renderToBuffer(<StudentReport d={data} />);
  await auditEvent(me.id, "pdf_report", "student_profiles", id);
  const file = `Elevo-Report-${(data.student.usn ?? data.student.name).replace(/[^\w-]+/g, "_")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("download") ? "attachment" : "inline"}; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
