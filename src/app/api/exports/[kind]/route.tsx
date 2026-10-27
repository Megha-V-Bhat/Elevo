import { renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { fmtDate } from "@/lib/dates";
import { auditEvent } from "@/server/admin/audit";
import { currentUser } from "@/server/authz";
import { buildExport, EXPORTS, type ExportKind } from "@/server/exports";
import { TableReport } from "@/server/pdf/table-report";
import { db } from "@/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const kind = (await params).kind as ExportKind;
  const spec = EXPORTS[kind];
  if (!spec) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Unknown export" } }, { status: 404 });
  const me = await currentUser();
  if (!me || me.status === "SUSPENDED") return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in first" } }, { status: 401 });
  if (!spec.roles.includes(me.role)) return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "You can't download this export." } }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const t = await buildExport(kind, me, { sem: sp.get("sem") ?? undefined, section: sp.get("section") ?? undefined });
  const format = sp.get("format") ?? "csv";
  await auditEvent(me.id, `export_${format}`, "exports", null, { kind, rows: t.rows.length });
  const name = `elevo-${kind}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t.title.slice(0, 30));
    ws.addRow(t.columns);
    t.rows.forEach((r) => ws.addRow(r.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v))));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    ws.columns.forEach((c) => (c.width = 20));
    return new NextResponse(new Uint8Array(await wb.xlsx.writeBuffer()), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` },
    });
  }
  if (format === "pdf") {
    const supabase = await db();
    const { data: dept } = await supabase.from("departments").select("name").eq("id", me.department_id).maybeSingle();
    const pdf = await renderToBuffer(<TableReport t={t} department={dept?.name ?? "Department"} generated={fmtDate(new Date().toISOString())} />);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
  }
  const csv = [t.columns, ...t.rows].map((r) => r.map(csvCell).join(",")).join("\n");
  return new NextResponse(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
}
