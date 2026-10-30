"use server";

import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cgpa, sgpa } from "@/lib/engine/grading";
import { IMPORT_SPECS, type ImportKind, type PreviewRow, validateRows } from "@/lib/imports";
import { requireRole } from "../authz";
import { loadAcademics } from "../queries/academics";
import { AppError, handle, must } from "../result";
import { db } from "../supabase";
import { createInvitedUser } from "./users";

const kindSchema = z.enum(["students", "mentors", "subjects", "results"]);

async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (file.size > 5 * 1024 * 1024) throw new AppError("VALIDATION", "Import files must be 5 MB or smaller.");
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const out = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy" });
    return out.data;
  }
  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const header: string[] = [];
    ws.getRow(1).eachCell((c, i) => (header[i] = String(c.text ?? "").trim()));
    const rows: Record<string, unknown>[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const r: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (c, i) => header[i] && (r[header[i]] = c.text ?? ""));
      if (Object.values(r).some((v) => String(v).trim())) rows.push(r);
    });
    return rows;
  }
  throw new AppError("VALIDATION", "Upload a .csv or .xlsx file (use the template).");
}

/** Step 1: parse + validate + detect duplicates against the database. Stages rows on an import job. */
export async function previewImport(form: FormData) {
  return handle(async () => {
    const hod = await requireRole("HOD");
    const kind = kindSchema.parse(form.get("kind"));
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a file to import.");
    const raw = await parseFile(file);
    if (!raw.length) throw new AppError("VALIDATION", "That file has no data rows.");
    if (raw.length > 2000) throw new AppError("VALIDATION", "Import up to 2,000 rows at a time.");
    const missing = IMPORT_SPECS[kind].required.filter((c) => !Object.keys(raw[0]).map((k) => k.trim().toLowerCase().replace(/\s+/g, "_")).includes(c));
    if (missing.length) throw new AppError("VALIDATION", `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template to check headers.`);
    const rows = validateRows(kind, raw);
    const supabase = await db();
    const valid = rows.filter((r) => r.status === "valid");
    // Database duplicates
    let existing = new Set<string>();
    if (kind === "students" && valid.length) {
      const { data } = await supabase.from("student_profiles").select("usn").in("usn", valid.map((r) => String(r.data.usn)));
      const { data: em } = await supabase.from("users").select("email").in("email", valid.map((r) => String(r.data.email)));
      existing = new Set([...(data ?? []).map((x) => String(x.usn)), ...(em ?? []).map((x) => x.email)]);
      valid.forEach((r) => (existing.has(String(r.data.usn)) || existing.has(String(r.data.email))) && Object.assign(r, { status: "duplicate", errors: ["Already in Elevo (USN or email)"] }));
    } else if (kind === "mentors" && valid.length) {
      const { data } = await supabase.from("users").select("email").in("email", valid.map((r) => String(r.data.email)));
      existing = new Set((data ?? []).map((x) => x.email));
      valid.forEach((r) => existing.has(String(r.data.email)) && Object.assign(r, { status: "duplicate", errors: ["Already in Elevo"] }));
    } else if (kind === "subjects" && valid.length) {
      const { data } = await supabase.from("subjects").select("code").eq("department_id", hod.department_id).in("code", valid.map((r) => String(r.data.code)));
      existing = new Set((data ?? []).map((x) => x.code));
      valid.forEach((r) => existing.has(String(r.data.code)) && Object.assign(r, { status: "duplicate", errors: ["Subject code already exists"] }));
    } else if (kind === "results" && valid.length) {
      const usns = [...new Set(valid.map((r) => String(r.data.usn)))];
      const { data: studs } = await supabase.from("student_profiles").select("user_id, usn").in("usn", usns);
      const known = new Map((studs ?? []).map((s) => [String(s.usn).toUpperCase(), s.user_id]));
      const { data: subs } = await supabase.from("subjects").select("id, code").eq("department_id", hod.department_id).in("code", [...new Set(valid.map((r) => String(r.data.subject_code)))]);
      const codes = new Map((subs ?? []).map((s) => [s.code, s.id]));
      const { data: have } = known.size
        ? await supabase.from("academic_semesters").select("student_id, semester_no, student_subject_results(subject_id)").in("student_id", [...known.values()])
        : { data: [] };
      const dup = new Set((have ?? []).flatMap((s) => ((s.student_subject_results as { subject_id: string }[]) ?? []).map((x) => `${s.student_id}|${s.semester_no}|${x.subject_id}`)));
      for (const r of valid) {
        const sid = known.get(String(r.data.usn));
        const sub = codes.get(String(r.data.subject_code));
        if (!sid) Object.assign(r, { status: "error", errors: ["Unknown USN — import the student first"] });
        else if (!sub) Object.assign(r, { status: "error", errors: ["Unknown subject code — import subjects first"] });
        else if (dup.has(`${sid}|${r.data.semester}|${sub}`)) Object.assign(r, { status: "duplicate", errors: ["A result already exists for this USN + subject + semester"] });
      }
    }
    const { data: job } = await supabase
      .from("import_jobs")
      .insert({
        created_by: hod.id,
        kind,
        file_name: file.name,
        total_rows: rows.length,
        valid_rows: rows.filter((r) => r.status === "valid").length,
        error_rows: rows.filter((r) => r.status === "error").length,
        errors: rows.filter((r) => r.status !== "valid").map((r) => ({ line: r.line, status: r.status, errors: r.errors })),
        rows,
      })
      .select("id")
      .single()
      .then((r) => ({ data: must(r) }));
    return { jobId: job!.id as string, rows: rows.slice(0, 500) as PreviewRow[], total: rows.length };
  });
}

/** Step 2: commit staged rows. Subjects/results are transactional; accounts are created per row with an error report. */
export async function commitImport(jobId: string, opts: { duplicates: "skip" | "update"; sendInvites: boolean }) {
  return handle(async () => {
    const hod = await requireRole("HOD");
    const supabase = await db();
    const { data: job } = await supabase.from("import_jobs").select("id, kind, status, rows").eq("id", z.string().uuid().parse(jobId)).maybeSingle();
    if (!job) throw new AppError("NOT_FOUND", "Import not found. Upload the file again.");
    if (job.status !== "PREVIEW") throw new AppError("CONFLICT", "This import was already committed.");
    const kind = job.kind as ImportKind;
    const rows = (job.rows as PreviewRow[]).filter((r) => r.status === "valid" || (opts.duplicates === "update" && r.status === "duplicate" && r.errors.every((e) => !/Unknown/.test(e))));
    const failures: { line: number; error: string }[] = [];
    let done = 0;

    if (kind === "subjects") {
      const { data, error } = await supabase.rpc("import_subjects", { p_rows: rows.map((r) => r.data), p_update: opts.duplicates === "update" });
      if (error) throw new AppError("CONFLICT", `Nothing was imported: ${error.message}`);
      done = (data as { inserted: number; updated: number }).inserted + (data as { updated: number }).updated;
    } else if (kind === "results") {
      const { data, error } = await supabase.rpc("import_results", { p_rows: rows.map((r) => r.data), p_update: opts.duplicates === "update" });
      if (error) throw new AppError("CONFLICT", `Nothing was imported: ${error.message}`);
      const res = data as { inserted: number; updated: number; students: string[] };
      done = res.inserted + res.updated;
      // Recompute SGPA/CGPA snapshots with the grading engine for every touched semester
      const summaries: Record<string, unknown> = {};
      for (const sid of res.students) {
        const a = await loadAcademics(sid, hod.department_id);
        for (const s of a.semesters.filter((x) => x.status === "VERIFIED")) {
          const sg = sgpa(s.results.map((r) => ({ credits: r.subject.credits, points: r.grade_points ?? r.derived_points })));
          const upTo = a.semesters.filter((x) => x.semester_no <= s.semester_no && x.results.length);
          const cg = cgpa(upTo.flatMap((x) => x.results.map((r) => ({ subject_key: r.subject.code, semester_no: x.semester_no, credits: r.subject.credits, points: r.grade_points ?? r.derived_points }))));
          summaries[s.id] = { sgpa: sg.value, cgpa_snapshot: cg.value?.cgpa ?? null, credits_registered: s.credits, credits_earned: s.credits_earned, computed: sg.value != null, computation_note: sg.reason ? `SGPA not calculated: ${sg.reason}` : null };
        }
      }
      if (Object.keys(summaries).length) must(await supabase.rpc("set_semester_summaries", { p_summaries: summaries }));
    } else {
      const { data: mentors } = kind === "students" ? await supabase.from("users").select("id, email").eq("role", "MENTOR") : { data: [] };
      const mentorByEmail = new Map((mentors ?? []).map((m) => [m.email, m.id]));
      const toAssign = new Map<string, string[]>();
      for (const r of rows) {
        if (r.status === "duplicate") continue; // accounts are never overwritten by import
        try {
          const d = r.data as Record<string, string | number | undefined>;
          const { id } =
            kind === "students"
              ? await createInvitedUser(hod.department_id, String(d.email), "MENTEE", String(d.full_name), opts.sendInvites, {
                  usn: d.usn,
                  current_semester: d.current_semester ?? null,
                  section: d.section ?? null,
                  admission_year: d.admission_year ?? null,
                  program: d.program ?? null,
                })
              : await createInvitedUser(hod.department_id, String(d.email), "MENTOR", String(d.full_name), opts.sendInvites, {
                  faculty_id: d.faculty_id ?? null,
                  designation: d.designation ?? null,
                  capacity: d.capacity ?? 20,
                });
          if (kind === "students" && d.mentor_email) {
            const m = mentorByEmail.get(String(d.mentor_email));
            if (m) toAssign.set(m, [...(toAssign.get(m) ?? []), id]);
            else failures.push({ line: r.line, error: `Created, but mentor ${d.mentor_email} wasn't found — assign on the board` });
          }
          done++;
        } catch (e) {
          failures.push({ line: r.line, error: e instanceof AppError ? e.message : "Failed" });
        }
      }
      for (const [mentor, ids] of toAssign) {
        const { error } = await supabase.rpc("assign_students", { p_student_ids: ids, p_mentor_id: mentor, p_reason: "Bulk import" });
        if (error) failures.push({ line: 0, error: `Assignment to a mentor failed: ${error.message}` });
      }
    }
    await supabase
      .from("import_jobs")
      .update({ status: "COMMITTED", committed_at: new Date().toISOString(), options: opts, errors: [...((job.rows as PreviewRow[]).filter((r) => r.status === "error").map((r) => ({ line: r.line, error: r.errors.join("; ") }))), ...failures] })
      .eq("id", job.id);
    revalidatePath("/hod", "layout");
    return { imported: done, failures };
  });
}
