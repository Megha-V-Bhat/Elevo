import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { IMPORT_SPECS, type ImportKind } from "@/lib/imports";
import { currentUser } from "@/server/authz";

export const runtime = "nodejs";

/** Downloadable CSV/XLSX templates with headers and one example row. HOD only. */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me || me.role !== "HOD") return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: "HOD only" } }, { status: 403 });
  const kind = req.nextUrl.searchParams.get("kind") as ImportKind;
  const spec = IMPORT_SPECS[kind];
  if (!spec) return NextResponse.json({ ok: false, error: { code: "VALIDATION", message: "Unknown template" } }, { status: 400 });
  const name = `elevo-${kind}-template`;
  if (req.nextUrl.searchParams.get("format") === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(spec.label);
    ws.addRow([...spec.columns]);
    ws.addRow([...spec.example]);
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    ws.columns.forEach((c) => (c.width = 22));
    return new NextResponse(new Uint8Array(await wb.xlsx.writeBuffer()), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` },
    });
  }
  const csv = [spec.columns.join(","), spec.example.map((v) => (/[,"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
}
