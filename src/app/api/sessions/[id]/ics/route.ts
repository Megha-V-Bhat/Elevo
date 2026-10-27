import { NextResponse } from "next/server";
import { currentUser } from "@/server/authz";
import { db } from "@/server/supabase";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** .ics download for a session the caller can see (RLS decides). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in first" } }, { status: 401 });
  const supabase = await db();
  const { data: s } = await supabase.from("mentoring_sessions").select("id, scheduled_at, duration_min, mode, location_or_link, agenda").eq("id", (await params).id).maybeSingle();
  if (!s) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
  const start = new Date(s.scheduled_at);
  const end = new Date(start.getTime() + s.duration_min * 60_000);
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elevo//Mentoring//EN",
    "BEGIN:VEVENT",
    `UID:${s.id}@elevo`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    "SUMMARY:Elevo mentoring session",
    `DESCRIPTION:${esc(s.agenda || "Mentoring session")}`,
    `LOCATION:${esc(s.location_or_link ?? (s.mode === "ONLINE" ? "Online" : "In person"))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="elevo-session.ics"` } });
}
