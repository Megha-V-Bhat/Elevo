import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Minimal stand-ins for the parts of Supabase our migrations depend on. */
const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema auth, storage to authenticated, anon, service_role;
grant execute on all functions in schema auth to authenticated, anon, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, f), "utf8").replace(/create extension if not exists pgcrypto;/g, "");
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

export type Db = Awaited<ReturnType<typeof freshDb>>;

/** Run SQL as a signed-in user (role authenticated + JWT sub), then reset to the superuser. */
export async function as<T = Record<string, unknown>>(db: Db, userId: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`);
  if (userId) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)`, [
      userId,
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await db.exec("set role authenticated");
  }
  try {
    const r = await db.query<T>(sql, params);
    return r.rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claims', '', false);`);
  }
}

export const asService = <T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []) =>
  as<T>(db, null, sql, params);

let n = 0;
export const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export async function seedPeople(db: Db) {
  const dept = (await asService<{ id: string }>(db, `insert into departments (code, name) values ('CSE','Computer Science') returning id`))[0].id;
  const ids = { H: uid(), X: uid(), Y: uid(), A: uid(), B: uid(), dept };
  const people: [string, string, string][] = [
    [ids.H, "hod@x.edu", "HOD"],
    [ids.X, "x@x.edu", "MENTOR"],
    [ids.Y, "y@x.edu", "MENTOR"],
    [ids.A, "a@x.edu", "MENTEE"],
    [ids.B, "b@x.edu", "MENTEE"],
  ];
  for (const [id, email, role] of people) {
    await asService(db, `insert into auth.users (id, email) values ($1, $2)`, [id, email]);
    await asService(db, `insert into users (id, email, role, status, department_id) values ($1, $2, $3, 'ACTIVE', $4)`, [id, email, role, dept]);
    if (role === "MENTEE")
      await asService(db, `insert into student_profiles (user_id, full_name, usn, department_id) values ($1, $2, $3, $4)`, [
        id,
        `Student ${email[0]}`,
        `1XX${email[0]}`,
        dept,
      ]);
    if (role === "MENTOR")
      await asService(db, `insert into mentor_profiles (user_id, full_name, department_id) values ($1, $2, $3)`, [id, `Dr ${email[0]}`, dept]);
  }
  await as(db, ids.H, `select assign_students($1::uuid[], $2, 'initial')`, [[ids.A], ids.X]);
  await as(db, ids.H, `select assign_students($1::uuid[], $2, 'initial')`, [[ids.B], ids.Y]);
  return ids;
}
