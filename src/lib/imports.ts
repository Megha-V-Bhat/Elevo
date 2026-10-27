import { z } from "zod";

export type ImportKind = "students" | "mentors" | "subjects" | "results";

const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === "" || v == null ? undefined : v), s.optional());
const num = (min: number, max: number) => z.coerce.number().min(min).max(max);
const bool = z.preprocess((v) => (typeof v === "string" ? ["true", "yes", "1", "y"].includes(v.trim().toLowerCase()) : v), z.boolean());

export const IMPORT_SPECS = {
  students: {
    label: "Students",
    columns: ["email", "full_name", "usn", "current_semester", "section", "admission_year", "program", "mentor_email"],
    required: ["email", "full_name", "usn"],
    example: ["ananya.rao@college.edu", "Ananya Rao", "1XX22CS001", "5", "A", "2022", "B.E. Computer Science", "iyer@college.edu"],
    key: (r: Record<string, unknown>) => String(r.usn ?? "").toUpperCase(),
    schema: z.object({
      email: z.string().trim().toLowerCase().email("Invalid email"),
      full_name: z.string().trim().min(2, "Name is required").max(120),
      usn: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,15}$/, "USN should be 6–15 letters/numbers"),
      current_semester: opt(z.coerce.number().int().min(1).max(12)),
      section: opt(z.string().trim().toUpperCase().max(10)),
      admission_year: opt(z.coerce.number().int().min(1990).max(2100)),
      program: opt(z.string().trim().max(80)),
      mentor_email: opt(z.string().trim().toLowerCase().email("Invalid mentor email")),
    }),
  },
  mentors: {
    label: "Mentors",
    columns: ["email", "full_name", "faculty_id", "designation", "capacity"],
    required: ["email", "full_name"],
    example: ["iyer@college.edu", "Dr. Meera Iyer", "FAC1042", "Associate Professor", "20"],
    key: (r: Record<string, unknown>) => String(r.email ?? "").toLowerCase(),
    schema: z.object({
      email: z.string().trim().toLowerCase().email("Invalid email"),
      full_name: z.string().trim().min(2, "Name is required").max(120),
      faculty_id: opt(z.string().trim().max(30)),
      designation: opt(z.string().trim().max(80)),
      capacity: opt(z.coerce.number().int().min(1).max(200)),
    }),
  },
  subjects: {
    label: "Subjects",
    columns: ["code", "name", "credits", "semester", "has_mse", "has_see", "mse_max", "see_max"],
    required: ["code", "name", "semester"],
    example: ["21CS51", "Database Management Systems", "4", "5", "yes", "yes", "50", "100"],
    key: (r: Record<string, unknown>) => String(r.code ?? "").toUpperCase(),
    schema: z.object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,12}$/, "Code should be 3–12 letters/numbers"),
      name: z.string().trim().min(2).max(80),
      credits: opt(num(0, 10)),
      semester: z.coerce.number().int().min(1).max(12),
      has_mse: opt(bool),
      has_see: opt(bool),
      mse_max: opt(num(1, 1000)),
      see_max: opt(num(1, 1000)),
    }),
  },
  results: {
    label: "Results",
    columns: ["usn", "semester", "academic_year", "subject_code", "mse_marks", "see_marks", "grade", "grade_points", "result"],
    required: ["usn", "semester", "subject_code"],
    example: ["1XX22CS001", "5", "2026-27", "21CS51", "38", "71", "A", "8", "PASS"],
    key: (r: Record<string, unknown>) => `${String(r.usn ?? "").toUpperCase()}|${r.semester}|${String(r.subject_code ?? "").toUpperCase()}`,
    schema: z.object({
      usn: z.string().trim().toUpperCase().min(6),
      semester: z.coerce.number().int().min(1).max(12),
      academic_year: opt(z.string().trim().max(9)),
      subject_code: z.string().trim().toUpperCase().min(3),
      mse_marks: opt(num(0, 1000)),
      see_marks: opt(num(0, 1000)),
      grade: opt(z.string().trim().max(4)),
      grade_points: opt(num(0, 10)),
      result: opt(z.enum(["PASS", "FAIL", "PENDING", "ABSENT"])),
    }),
  },
} as const;

export type PreviewRow = { line: number; status: "valid" | "error" | "duplicate"; data: Record<string, unknown>; errors: string[] };

/** Validate parsed rows, flag in-file duplicates. Database duplicates are flagged by the caller. */
export function validateRows(kind: ImportKind, raw: Record<string, unknown>[]): PreviewRow[] {
  const spec = IMPORT_SPECS[kind];
  const seen = new Map<string, number>();
  return raw.map((r, i) => {
    const norm = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, "_"), typeof v === "string" ? v.trim() : v]));
    const parsed = spec.schema.safeParse(norm);
    if (!parsed.success) return { line: i + 2, status: "error", data: norm, errors: parsed.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`) };
    const key = spec.key(parsed.data as Record<string, unknown>);
    if (seen.has(key)) return { line: i + 2, status: "duplicate", data: parsed.data, errors: [`Duplicate of line ${seen.get(key)} in this file`] };
    seen.set(key, i + 2);
    return { line: i + 2, status: "valid", data: parsed.data, errors: [] };
  });
}
