import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDailyReminders } from "@/server/admin/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Bad cron secret" } }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, data: await runDailyReminders() });
  } catch (e) {
    console.error("[elevo] cron failed", e);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Daily job failed" } }, { status: 500 });
  }
}
