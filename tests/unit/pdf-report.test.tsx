import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { StudentReport } = await import("@/server/pdf/student-report");
type ReportData = Parameters<typeof StudentReport>[0]["d"];

async function pdfText(buf: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, disableFontFace: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    // pdf.js splits runs at glyph-run boundaries (e.g. "1" + "TT22CS001"), so join without separators.
    pages.push(c.items.map((x) => ("str" in x ? x.str : "")).join(""));
  }
  return { pages, text: pages.join("\n"), count: doc.numPages };
}

const base: ReportData = {
  institution: "Test Institute of Technology",
  department: "Computer Science",
  generatedAt: "27 Oct 2026",
  student: { name: "Ananya Rao", usn: "1TT22CS001", program: "B.E. CSE", semester: 5, section: "A", academicYear: "2026-27", email: null, photo: null },
  mentor: "Dr. Iyer",
  cgpa: 8.12,
  creditsCompleted: 88,
  semesters: [
    {
      no: 1,
      year: "2022-23",
      status: "VERIFIED",
      sgpa: 7.9,
      credits: 20,
      subjects: [{ code: "21MA11", name: "Engineering Mathematics", mse: "38", see: "71", max: "50/100", credits: "4", grade: "A", result: "Pass" }],
    },
  ],
  mentoring: [{ kind: "Goal", category: "Academic progress", title: "Revise DBMS weekly", body: "Two problem sets each week.", status: "In progress", date: "12 Oct 2026", due: "30 Nov 2026" }],
};

describe("student PDF report", () => {
  it("has the four sections, page numbers and the student's data", async () => {
    const { text } = await pdfText(await renderToBuffer(<StudentReport d={base} />));
    for (const s of ["Student Information", "Academic Summary", "Semester-wise Performance", "Mentoring Records", "Student Mentoring Report", "Ananya Rao", "1TT22CS001", "Engineering Mathematics", "Revise DBMS weekly", "Page 1 of 1", "Confidential"]) {
      expect(text).toContain(s);
    }
  }, 60_000);

  it("never contains website-only content", async () => {
    const { text } = await pdfText(await renderToBuffer(<StudentReport d={base} />));
    for (const banned of ["Insight", "Pulse", "Risk", "flag", "Planner", "Goal Compass", "Growth Rings", "Ask", "question", "Needs attention", "self-reported", "chart"]) {
      expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  }, 60_000);

  it("paginates 60+ subjects × 8 semesters with repeated headers and page numbers", async () => {
    const big: ReportData = {
      ...base,
      semesters: Array.from({ length: 8 }, (_, s) => ({
        no: s + 1,
        year: `20${22 + Math.floor(s / 2)}`,
        status: "FINALIZED" as const,
        sgpa: 8,
        credits: 24,
        subjects: Array.from({ length: 8 }, (_, k) => ({ code: `21CS${s}${k}`, name: `Subject ${s + 1}.${k + 1} with a longer descriptive name`, mse: "40", see: "80", max: "50/100", credits: "3", grade: "A", result: "Pass" })),
      })),
    };
    const { count, pages, text } = await pdfText(await renderToBuffer(<StudentReport d={big} />));
    expect(count).toBeGreaterThan(2);
    expect(text).toContain(`Page ${count} of ${count}`);
    expect(pages.every((p) => p.includes("Student Mentoring Report"))).toBe(true);
    // all 64 subject rows rendered, none lost across page breaks
    for (let s = 0; s < 8; s++) for (let k = 0; k < 8; k++) expect(text).toContain(`21CS${s}${k}`);
  }, 120_000);
});
