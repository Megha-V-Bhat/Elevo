import { beforeAll, describe, expect, it } from "vitest";
import { as, asService, type Db, freshDb, seedPeople } from "./harness";

let db: Db;
let P: Awaited<ReturnType<typeof seedPeople>>;
let subjectId: string;

beforeAll(async () => {
  db = await freshDb();
  P = await seedPeople(db);
  subjectId = (
    await asService<{ id: string }>(
      db,
      `insert into subjects (department_id, code, name, credits, semester) values ($1, 'CS501', 'DBMS', 4, 5) returning id`,
      [P.dept],
    )
  )[0].id;
}, 60_000);

const count = async (user: string, sql: string, params: unknown[] = []) => (await as(db, user, sql, params)).length;

describe("profiles & roles", () => {
  it("student sees own profile, not another student's", async () => {
    expect(await count(P.A, `select * from student_profiles where user_id = $1`, [P.A])).toBe(1);
    expect(await count(P.A, `select * from student_profiles where user_id = $1`, [P.B])).toBe(0);
  });
  it("only the active mentor sees a student's profile", async () => {
    expect(await count(P.X, `select * from student_profiles where user_id = $1`, [P.A])).toBe(1);
    expect(await count(P.Y, `select * from student_profiles where user_id = $1`, [P.A])).toBe(0);
  });
  it("HOD sees everyone", async () => expect(await count(P.H, `select * from student_profiles`)).toBe(2));
  it("student sees their mentor's profile only", async () => {
    expect(await count(P.A, `select * from mentor_profiles`)).toBe(1);
  });
  it("student cannot escalate their role", async () => {
    await expect(as(db, P.A, `update users set role = 'HOD' where id = $1`, [P.A])).rejects.toThrow(/Only the HOD/);
  });
  it("mentor cannot change their own capacity", async () => {
    await expect(as(db, P.X, `update mentor_profiles set capacity = 99 where user_id = $1`, [P.X])).rejects.toThrow(/capacity/);
  });
  it("the last HOD cannot be demoted", async () => {
    await expect(as(db, P.H, `update users set role = 'MENTOR' where id = $1`, [P.H])).rejects.toThrow(/at least one active HOD/);
  });
  it("HOD can change roles (audited)", async () => {
    await as(db, P.H, `update users set status = 'SUSPENDED' where id = $1`, [P.B]);
    await as(db, P.H, `update users set status = 'ACTIVE' where id = $1`, [P.B]);
    expect(await count(P.H, `select * from audit_logs where entity_type = 'users' and entity_id = $1`, [P.B])).toBe(2);
  });
  it("students cannot read the audit log", async () => expect(await count(P.A, `select * from audit_logs`)).toBe(0));
});

describe("assignments", () => {
  it("students cannot write assignments directly or via RPC", async () => {
    await expect(
      as(db, P.A, `insert into mentor_assignments (mentor_id, student_id) values ($1, $2)`, [P.Y, P.A]),
    ).rejects.toThrow();
    await expect(as(db, P.A, `select assign_students($1::uuid[], $2)`, [[P.A], P.Y])).rejects.toThrow(/Only the HOD/);
  });
  it("mentors cannot reassign", async () => {
    await expect(as(db, P.X, `select assign_students($1::uuid[], $2)`, [[P.B], P.X])).rejects.toThrow(/Only the HOD/);
  });
  it("history is kept and one active assignment per student", async () => {
    expect(await count(P.H, `select * from mentor_assignments where student_id = $1 and ended_at is null`, [P.A])).toBe(1);
  });
});

describe("academic records", () => {
  let semId: string;
  let resultId: string;
  it("student creates a draft and enters results", async () => {
    semId = (await as<{ id: string }>(db, P.A, `insert into academic_semesters (student_id, semester_no, status) values ($1, 5, 'VERIFIED') returning id, status`, [P.A]))[0].id;
    const s = await as<{ status: string }>(db, P.A, `select status from academic_semesters where id = $1`, [semId]);
    expect(s[0].status).toBe("DRAFT"); // forced back to DRAFT on insert
    resultId = (
      await as<{ id: string }>(
        db,
        P.A,
        `insert into student_subject_results (academic_semester_id, subject_id, mse_marks, mse_max, see_marks, see_max, grade, grade_points)
         values ($1, $2, 38, 50, 61, 100, 'B+', 7) returning id`,
        [semId, subjectId],
      )
    )[0].id;
  });
  it("marks above max are rejected", async () => {
    await expect(as(db, P.A, `update student_subject_results set mse_marks = 60 where id = $1`, [resultId])).rejects.toThrow();
  });
  it("other students and other mentors can't see the semester", async () => {
    expect(await count(P.B, `select * from academic_semesters where id = $1`, [semId])).toBe(0);
    expect(await count(P.Y, `select * from student_subject_results where id = $1`, [resultId])).toBe(0);
  });
  it("student cannot self-verify", async () => {
    await expect(
      as(db, P.A, `update academic_semesters set status = 'VERIFIED' where id = $1`, [semId]),
    ).rejects.toThrow();
  });
  it("submit locks the results", async () => {
    await as(db, P.A, `update academic_semesters set status = 'SUBMITTED' where id = $1`, [semId]);
    const updated = await as(db, P.A, `update student_subject_results set see_marks = 99 where id = $1 returning id`, [resultId]);
    expect(updated).toHaveLength(0);
  });
  it("another mentor cannot verify", async () => {
    await expect(as(db, P.Y, `select verify_semesters($1::uuid[])`, [[semId]])).rejects.toThrow(/own mentees/);
  });
  it("the active mentor verifies with a summary", async () => {
    const r = await as<{ verify_semesters: number }>(db, P.X, `select verify_semesters($1::uuid[], $2::jsonb)`, [
      [semId],
      JSON.stringify({ [semId]: { sgpa: 7, cgpa_snapshot: 7, computed: true } }),
    ]);
    expect(r[0].verify_semesters).toBe(1);
    const n = await as(db, P.A, `select * from notifications where user_id = $1 and type = 'verification'`, [P.A]);
    expect(n.length).toBeGreaterThan(0);
  });
  it("verified records are read-only for the student, even by direct call", async () => {
    const updated = await as(db, P.A, `update student_subject_results set see_marks = 99 where id = $1 returning id`, [resultId]);
    expect(updated).toHaveLength(0);
  });
  it("correction request → approval applies the change", async () => {
    const cr = await as<{ id: string }>(
      db,
      P.A,
      `insert into record_change_requests (student_id, target_table, target_id, proposed, reason, status)
       values ($1, 'student_subject_results', $2, '{"see_marks": 66}', 'Re-evaluation result', 'APPROVED') returning id, status`,
      [P.A, resultId],
    );
    expect(await as<{ status: string }>(db, P.A, `select status from record_change_requests where id = $1`, [cr[0].id])).toEqual([
      { status: "PENDING" },
    ]);
    await expect(as(db, P.Y, `select decide_change_request($1, true)`, [cr[0].id])).rejects.toThrow(/Not allowed/);
    await as(db, P.X, `select decide_change_request($1, true, 'Confirmed with exam cell')`, [cr[0].id]);
    const r = await as<{ see_marks: string }>(db, P.A, `select see_marks from student_subject_results where id = $1`, [resultId]);
    expect(Number(r[0].see_marks)).toBe(66);
  });
  it("cannot request corrections on someone else's record", async () => {
    await expect(
      as(db, P.B, `insert into record_change_requests (student_id, target_table, target_id, proposed, reason) values ($1, 'student_subject_results', $2, '{}', 'nope')`, [
        P.B,
        resultId,
      ]),
    ).rejects.toThrow(/your own verified/);
  });
});

describe("mentoring records", () => {
  it("PRIVATE_MENTOR notes never reach the student or HOD", async () => {
    await as(db, P.X, `insert into mentor_recommendations (student_id, mentor_id, kind, title, visibility) values ($1, $2, 'FEEDBACK', 'Private note', 'PRIVATE_MENTOR')`, [P.A, P.X]);
    await as(db, P.X, `insert into mentor_recommendations (student_id, mentor_id, kind, title) values ($1, $2, 'GOAL', 'Shared goal')`, [P.A, P.X]);
    expect((await as<{ title: string }>(db, P.A, `select title from mentor_recommendations`)).map((r) => r.title)).toEqual(["Shared goal"]);
    expect(await count(P.H, `select * from mentor_recommendations where visibility = 'PRIVATE_MENTOR'`)).toBe(0);
    expect(await count(P.X, `select * from mentor_recommendations where student_id = $1`, [P.A])).toBe(2);
  });
  it("a mentor cannot write for someone else's mentee", async () => {
    await expect(
      as(db, P.Y, `insert into mentor_recommendations (student_id, mentor_id, kind, title) values ($1, $2, 'FEEDBACK', 'x y')`, [P.A, P.Y]),
    ).rejects.toThrow();
  });
  it("student can progress but not self-complete a goal", async () => {
    const g = await as<{ id: string }>(db, P.A, `select id from mentor_recommendations where title = 'Shared goal'`);
    await as(db, P.A, `select student_update_item($1, 'IN_PROGRESS', '[{"label":"Revise","done":true}]', 'Going well')`, [g[0].id]);
    await expect(as(db, P.A, `select student_update_item($1, 'COMPLETED')`, [g[0].id])).rejects.toThrow(/mentor confirms/);
  });
  it("resources targeted at another mentee are invisible", async () => {
    await as(db, P.Y, `insert into learning_resources (mentor_id, student_id, title, external_url) values ($1, $2, 'For B only', 'https://x.org')`, [P.Y, P.B]);
    expect(await count(P.A, `select * from learning_resources where title = 'For B only'`)).toBe(0);
    expect(await count(P.B, `select * from learning_resources where title = 'For B only'`)).toBe(1);
  });
});

describe("Weekly Pulse", () => {
  it("student checks in; mentor sees help note only when shared", async () => {
    await as(db, P.A, `insert into pulse_checkins (student_id, week_start, mood, workload, help_note, share_note) values ($1, app.today(), 2, 'HEAVY', 'Struggling with joins', false)`, [P.A]);
    expect(await count(P.X, `select * from pulse_checkins`)).toBe(0); // no direct table access
    const rows = await as<{ help_note: string | null; mood: number }>(db, P.X, `select * from mentor_pulse($1)`, [P.A]);
    expect(rows).toHaveLength(1);
    expect(rows[0].help_note).toBeNull();
    await as(db, P.A, `update pulse_checkins set share_note = true where student_id = $1`, [P.A]);
    expect((await as<{ help_note: string }>(db, P.X, `select * from mentor_pulse($1)`, [P.A]))[0].help_note).toBe("Struggling with joins");
  });
  it("other mentors and the HOD get no rows; HOD gets aggregates", async () => {
    await expect(as(db, P.Y, `select * from mentor_pulse($1)`, [P.A])).rejects.toThrow(/current mentor/);
    await expect(as(db, P.H, `select * from mentor_pulse($1)`, [P.A])).rejects.toThrow();
    expect(await count(P.H, `select * from pulse_checkins`)).toBe(0);
    const agg = await as<{ participation_pct: string }>(db, P.H, `select * from hod_pulse_participation()`);
    expect(agg.length).toBeGreaterThan(0);
  });
  it("past weeks can't be back-filled", async () => {
    await expect(
      as(db, P.A, `insert into pulse_checkins (student_id, week_start, mood, workload) values ($1, app.today() - 30, 3, 'OKAY')`, [P.A]),
    ).rejects.toThrow();
  });
  it("students can't forge the seen marker", async () => {
    await expect(as(db, P.A, `update pulse_checkins set seen_by_mentor_at = now() where student_id = $1`, [P.A])).rejects.toThrow();
  });
});

describe("Grade Goal Planner", () => {
  it("unshared plans are private; shared ones reach only the active mentor", async () => {
    await as(db, P.A, `insert into target_plans (student_id, kind, title, inputs, result) values ($1, 'CGPA', 'Private', '{}', '{}')`, [P.A]);
    await as(db, P.A, `insert into target_plans (student_id, kind, title, inputs, result, shared_with_mentor) values ($1, 'CGPA', 'Shared', '{}', '{}', true)`, [P.A]);
    expect((await as<{ title: string }>(db, P.X, `select title from target_plans`)).map((r) => r.title)).toEqual(["Shared"]);
    expect(await count(P.Y, `select * from target_plans`)).toBe(0);
    expect(await count(P.H, `select * from target_plans`)).toBe(0);
  });
});

describe("Ask My Mentor + reassignment revocation", () => {
  let threadId: string;
  it("student asks, mentor answers, status flows", async () => {
    threadId = (await as<{ id: string }>(db, P.A, `insert into ask_threads (student_id, title) values ($1, 'How do I normalise?') returning id`, [P.A]))[0].id;
    await as(db, P.A, `insert into ask_messages (thread_id, author_id, body) values ($1, $2, 'Stuck on 3NF')`, [threadId, P.A]);
    await as(db, P.X, `insert into ask_messages (thread_id, author_id, body) values ($1, $2, 'Start from functional dependencies')`, [threadId, P.X]);
    const t = await as<{ status: string; first_response_at: string | null }>(db, P.A, `select status, first_response_at from ask_threads where id = $1`, [threadId]);
    expect(t[0].status).toBe("ANSWERED");
    expect(t[0].first_response_at).not.toBeNull();
  });
  it("other students, other mentors and the HOD can't read threads", async () => {
    expect(await count(P.B, `select * from ask_messages`)).toBe(0);
    expect(await count(P.Y, `select * from ask_threads`)).toBe(0);
    expect(await count(P.H, `select * from ask_messages`)).toBe(0);
    const s = await as<{ open_threads: number }>(db, P.H, `select * from hod_ask_summary()`);
    expect(s).toHaveLength(1);
  });
  it("student can only resolve, not rewrite, a thread", async () => {
    await expect(as(db, P.A, `update ask_threads set title = 'Rewritten title' where id = $1`, [threadId])).rejects.toThrow(/only resolve/);
    await as(db, P.A, `update ask_threads set status = 'OPEN' where id = $1`, [threadId]);
    await expect(as(db, P.A, `update ask_threads set status = 'ANSWERED' where id = $1`, [threadId])).rejects.toThrow(/only resolve/);
    await as(db, P.A, `update ask_threads set status = 'RESOLVED' where id = $1`, [threadId]);
  });
  it("edits close after 10 minutes", async () => {
    const m = await as<{ id: string }>(db, P.A, `select id from ask_messages where author_id = $1`, [P.A]);
    await as(db, P.A, `update ask_messages set body = 'Stuck on 3NF (edited)' where id = $1`, [m[0].id]);
    await asService(db, `update ask_messages set created_at = now() - interval '11 minutes' where id = $1`, [m[0].id]);
    await expect(as(db, P.A, `update ask_messages set body = 'late edit' where id = $1`, [m[0].id])).rejects.toThrow(/10 minutes/);
    expect(await count(P.H, `select * from audit_logs where entity_type = 'ask_messages'`)).toBeGreaterThan(0);
  });
  it("5 new threads per day", async () => {
    for (let i = 0; i < 4; i++) await as(db, P.A, `insert into ask_threads (student_id, title) values ($1, $2)`, [P.A, `Question ${i}`]);
    await expect(as(db, P.A, `insert into ask_threads (student_id, title) values ($1, 'Sixth')`, [P.A])).rejects.toThrow(/5 questions/);
  });
  it("reassignment revokes the old mentor everywhere and moves threads", async () => {
    await asService(db, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${P.A}/avatar.webp`]);
    expect(await count(P.X, `select * from storage.objects where bucket_id = 'avatars'`)).toBe(1);

    await as(db, P.H, `select assign_students($1::uuid[], $2, 'rebalance')`, [[P.A], P.Y]);

    expect(await count(P.X, `select * from student_profiles where user_id = $1`, [P.A])).toBe(0);
    expect(await count(P.X, `select * from academic_semesters where student_id = $1`, [P.A])).toBe(0);
    expect(await count(P.X, `select * from ask_threads where student_id = $1`, [P.A])).toBe(0);
    expect(await count(P.X, `select * from target_plans`)).toBe(0);
    expect(await count(P.X, `select * from mentor_recommendations where student_id = $1`, [P.A])).toBe(0);
    expect(await count(P.X, `select * from storage.objects where bucket_id = 'avatars'`)).toBe(0);
    await expect(as(db, P.X, `select * from mentor_pulse($1)`, [P.A])).rejects.toThrow();

    expect(await count(P.Y, `select * from ask_threads where student_id = $1`, [P.A])).toBeGreaterThan(0);
    expect(await count(P.Y, `select * from storage.objects where bucket_id = 'avatars'`)).toBe(1);
    // Old mentor's authored notes stay in the database
    expect(await count(P.H, `select * from mentor_recommendations where mentor_id = $1`, [P.X])).toBeGreaterThan(0);
  });
  it("HOD workload aggregate reports mentors", async () => {
    const rows = await as<{ mentees: number }>(db, P.H, `select * from hod_mentor_activity()`);
    expect(rows).toHaveLength(2);
    await expect(as(db, P.X, `select * from hod_mentor_activity()`)).rejects.toThrow(/HOD only/);
  });
});

describe("service-only functions", () => {
  it("rate limiter is not callable by users", async () => {
    await expect(as(db, P.A, `select rate_limit_hit('x', 1, 60)`)).rejects.toThrow();
    const r = await asService<{ rate_limit_hit: boolean }>(db, `select rate_limit_hit('k', 2, 60), rate_limit_hit('k', 2, 60), rate_limit_hit('k', 2, 60) as third`);
    expect(r[0]).toMatchObject({ third: false });
  });
});
