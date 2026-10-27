import { z } from "zod";

const year = new Date().getFullYear();
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const tags = z.array(z.string().trim().min(1).max(40)).max(20).default([]);
const num = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number({ message: "Enter a number" }).min(min).max(max).nullable());

export const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{6,16}$/, "Enter a valid phone number");

// ───────────── Student setup ─────────────
export const studentPersonal = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  phone,
  dob: z.string().optional().nullable().transform((v) => (v ? v : null)),
  gender: optText(30),
  address: optText(300),
});

export const studentAcademic = z
  .object({
    usn: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6,15}$/, "USN should be 6–15 letters or numbers, e.g. 1XX22CS001"),
    program: z.string().trim().min(2, "Enter your program, e.g. B.E. Computer Science").max(80),
    current_semester: z.coerce.number({ message: "Choose your semester" }).int().min(1).max(12),
    section: z.string().trim().min(1, "Choose your section").max(10),
    admission_year: z.coerce.number({ message: "Enter your admission year" }).int().min(year - 12).max(year),
    expected_graduation_year: z.coerce.number({ message: "Enter the expected graduation year" }).int().min(year - 8).max(year + 8),
  })
  .refine((v) => v.expected_graduation_year > v.admission_year, { message: "Graduation must be after admission", path: ["expected_graduation_year"] });

export const historyResult = z.object({
  subject_id: z.string().uuid(),
  mse_marks: num(0, 1000),
  see_marks: num(0, 1000),
  grade_points: num(0, 10),
  grade: optText(4),
});
export const historySemester = z.object({
  semester_no: z.coerce.number().int().min(1).max(12),
  academic_year: optText(9),
  mode: z.enum(["subjects", "sgpa"]),
  manual_sgpa: num(0, 10),
  manual_credits: num(0, 60),
  results: z.array(historyResult).max(20).default([]),
});
export const studentHistory = z.object({ semesters: z.array(historySemester).max(12).default([]) });

export const studentAbout = z.object({
  skills: tags,
  interests: tags,
  career_goals: optText(600),
  achievements: optText(1000),
  support_areas: optText(600),
});

export const mentorSetup = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  official_email: z.string().trim().toLowerCase().email("Enter your official email"),
  phone,
  designation: z.string().trim().min(2, "Enter your designation").max(80),
  faculty_id: z.string().trim().min(2, "Enter your faculty ID").max(30),
  expertise: tags,
});

export const hodSetup = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  designation: z.string().trim().min(2).max(80).default("Head of Department"),
  phone,
});

// ───────────── Academics ─────────────
export const resultInput = z.object({
  id: z.string().uuid().optional(),
  subject_id: z.string().uuid(),
  mse_marks: num(0, 1000),
  mse_max: num(1, 1000),
  see_marks: num(0, 1000),
  see_max: num(1, 1000),
  ia: z
    .array(z.object({ label: z.string().max(30), marks: num(0, 1000), max: num(1, 1000) }))
    .max(6)
    .default([]),
  grade: optText(4),
  grade_points: num(0, 10),
  result: z.enum(["PASS", "FAIL", "PENDING", "ABSENT"]).default("PENDING"),
});

export const subjectInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,12}$/, "Use the subject code, e.g. 21CS51"),
  name: z.string().trim().min(2).max(80),
  credits: num(0, 10),
  semester: z.coerce.number().int().min(1).max(12),
  has_mse: z.boolean().default(true),
  has_see: z.boolean().default(true),
  mse_max: num(1, 1000).default(50),
  see_max: num(1, 1000).default(100),
});

// ───────────── Mentoring ─────────────
export const recommendationInput = z.object({
  student_id: z.string().uuid(),
  kind: z.enum(["RECOMMENDATION", "FEEDBACK", "GOAL", "ACTION_POINT", "STRENGTH", "IMPROVEMENT_AREA"]),
  category: z.enum(["ACADEMIC_PROGRESS", "CAREER_GUIDANCE", "PERSONAL_DEVELOPMENT", "STUDY_HABITS"]),
  title: z.string().trim().min(2, "Add a short title").max(160),
  body: z.string().trim().max(5000).default(""),
  subject_id: z.string().uuid().optional().nullable().or(z.literal("").transform(() => null)),
  due_date: z.string().optional().nullable().transform((v) => (v ? v : null)),
  review_date: z.string().optional().nullable().transform((v) => (v ? v : null)),
  visibility: z.enum(["SHARED", "PRIVATE_MENTOR"]).default("SHARED"),
  include_in_report: z.boolean().default(false),
  target: optText(200),
  steps: z.array(z.object({ label: z.string().trim().min(1).max(120), done: z.boolean().default(false) })).max(12).default([]),
  source: z.enum(["MANUAL", "ASK_THREAD", "PLANNER", "SESSION"]).default("MANUAL"),
  source_id: z.string().uuid().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
});

export const sessionInput = z.object({
  student_id: z.string().uuid(),
  scheduled_at: z.string().min(10, "Choose a date and time"),
  duration_min: z.coerce.number().int().min(5).max(480).default(30),
  mode: z.enum(["IN_PERSON", "ONLINE"]),
  location_or_link: optText(300),
  agenda: z.string().trim().max(2000).default(""),
  source_thread_id: z.string().uuid().optional().nullable(),
});

export const sessionComplete = z.object({
  id: z.string().uuid(),
  summary: z.string().trim().min(3, "Add a short summary").max(4000),
  action_items: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  next_follow_up_date: z.string().optional().nullable().transform((v) => (v ? v : null)),
});

// ───────────── New features ─────────────
export const pulseInput = z.object({
  mood: z.coerce.number().int().min(1, "Pick how the week felt").max(5),
  workload: z.enum(["LIGHT", "OKAY", "HEAVY"], { message: "Pick your workload" }),
  subject_confidence: z.array(z.object({ subject_id: z.string().uuid(), subject: z.string().max(80), score: z.number().int().min(1).max(5) })).max(15).default([]),
  help_note: optText(1000),
  share_note: z.boolean().default(true),
});

export const askThreadInput = z.object({
  title: z.string().trim().min(3, "Add a short title").max(140),
  body: z.string().trim().min(1, "Write your question").max(5000),
  subject_id: z.string().uuid().optional().nullable().or(z.literal("").transform(() => null)),
});

export const askReplyInput = z.object({
  thread_id: z.string().uuid(),
  body: z.string().trim().min(1, "Write a reply").max(5000),
  resource_id: z.string().uuid().optional().nullable(),
});

export const planInput = z.object({
  kind: z.enum(["CGPA", "SUBJECT"]),
  title: z.string().trim().min(1).max(120),
  inputs: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()),
  shared_with_mentor: z.boolean().default(false),
});

// ───────────── Admin ─────────────
export const inviteInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["MENTEE", "MENTOR", "HOD"]),
  full_name: z.string().trim().max(120).optional().default(""),
});

export const schemeInput = z.object({
  name: z.string().trim().min(2).max(60),
  bands: z
    .array(z.object({ min_pct: z.coerce.number().min(0).max(100), grade: z.string().trim().min(1).max(4), points: z.coerce.number().min(0).max(10) }))
    .min(2)
    .max(12),
  pass_pct: z.coerce.number().min(0).max(100),
  mse_weight: z.coerce.number().min(0).max(1),
  see_weight: z.coerce.number().min(0).max(1),
  ia_weight: z.coerce.number().min(0).max(1),
  see_min_pct: num(0, 100),
  max_points: z.coerce.number().min(1).max(10),
})
  .refine((v) => Math.abs(v.mse_weight + v.see_weight + v.ia_weight - 1) < 0.001, { message: "Weights must add up to 1", path: ["see_weight"] })
  .refine((v) => new Set(v.bands.map((b) => b.grade)).size === v.bands.length, { message: "Each grade can appear once", path: ["bands"] })
  .refine((v) => v.bands.some((b) => b.min_pct === 0), { message: "One band must start at 0%", path: ["bands"] });

export type Issues = Record<string, string>;
/** Flatten zod issues to { "path.to.field": "message" } for inline errors. */
export function issues(e: z.ZodError): Issues {
  const out: Issues = {};
  for (const i of e.issues) out[i.path.join(".") || "_"] ??= i.message;
  return out;
}
