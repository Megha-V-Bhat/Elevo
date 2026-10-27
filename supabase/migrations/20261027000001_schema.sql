-- Elevo core schema. RLS policies live in the next migration.
create extension if not exists pgcrypto;
create schema if not exists app;

-- ───────────── Enums ─────────────
create type public.user_role as enum ('MENTEE', 'MENTOR', 'HOD');
create type public.user_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED');
create type public.semester_status as enum ('DRAFT', 'SUBMITTED', 'VERIFIED', 'FINALIZED');
create type public.subject_result as enum ('PASS', 'FAIL', 'PENDING', 'ABSENT');
create type public.rec_kind as enum ('RECOMMENDATION', 'FEEDBACK', 'GOAL', 'ACTION_POINT', 'STRENGTH', 'IMPROVEMENT_AREA');
create type public.rec_category as enum ('ACADEMIC_PROGRESS', 'CAREER_GUIDANCE', 'PERSONAL_DEVELOPMENT', 'STUDY_HABITS');
create type public.rec_status as enum ('PENDING', 'IN_PROGRESS', 'COMPLETED');
create type public.rec_visibility as enum ('SHARED', 'PRIVATE_MENTOR');
create type public.rec_source as enum ('MANUAL', 'ASK_THREAD', 'PLANNER', 'SESSION');
create type public.session_mode as enum ('IN_PERSON', 'ONLINE');
create type public.session_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');
create type public.request_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type public.workload as enum ('LIGHT', 'OKAY', 'HEAVY');
create type public.thread_status as enum ('OPEN', 'ANSWERED', 'RESOLVED');
create type public.plan_kind as enum ('CGPA', 'SUBJECT');
create type public.import_status as enum ('PREVIEW', 'COMMITTED', 'FAILED');

create or replace function app.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────── Structure ─────────────
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  institution text not null default 'Your Institution',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (department_id, name)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique, -- e.g. 2026-27
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  check (ends_on > starts_on)
);

-- ───────────── Users & profiles ─────────────
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role public.user_role not null,
  status public.user_status not null default 'INVITED',
  department_id uuid references public.departments (id),
  onboarding_completed_at timestamptz,
  last_seen_at timestamptz,
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_role_idx on public.users (role, status);

create table public.student_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  full_name text not null default '',
  avatar_path text,
  dob date,
  gender text,
  phone text,
  address text,
  usn text unique,
  department_id uuid references public.departments (id),
  program text,
  current_semester smallint check (current_semester between 1 and 12),
  section text,
  admission_year smallint check (admission_year between 1990 and 2100),
  expected_graduation_year smallint check (expected_graduation_year between 1990 and 2100),
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  career_goals text,
  achievements text,
  support_areas text,
  profile_completion int not null default 0 check (profile_completion between 0 and 100),
  draft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index student_profiles_filter_idx on public.student_profiles (department_id, current_semester, section);

create table public.mentor_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  full_name text not null default '',
  avatar_path text,
  official_email text,
  phone text,
  department_id uuid references public.departments (id),
  designation text,
  faculty_id text unique,
  expertise text[] not null default '{}',
  capacity int not null default 20 check (capacity between 1 and 200),
  draft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.users (id),
  student_id uuid not null references public.users (id),
  group_name text,
  assigned_by uuid references public.users (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  reason text,
  check (ended_at is null or ended_at >= started_at),
  check (mentor_id <> student_id)
);
create unique index one_active_assignment_per_student on public.mentor_assignments (student_id) where ended_at is null;
create index mentor_assignments_mentor_active_idx on public.mentor_assignments (mentor_id) where ended_at is null;

-- ───────────── Academics ─────────────
create table public.grading_schemes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments (id) on delete cascade,
  name text not null,
  version int not null default 1,
  bands jsonb not null,
  pass_pct numeric(5, 2) not null default 40,
  mse_weight numeric(4, 3) not null default 0.3,
  see_weight numeric(4, 3) not null default 0.5,
  ia_weight numeric(4, 3) not null default 0.2,
  see_min_pct numeric(5, 2),
  max_points numeric(4, 2) not null default 10,
  sgpa_formula text not null default 'CREDIT_WEIGHTED',
  active boolean not null default false,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mse_weight >= 0 and see_weight >= 0 and ia_weight >= 0 and mse_weight + see_weight + ia_weight > 0),
  unique (department_id, version)
);
create unique index one_active_scheme on public.grading_schemes (department_id) where active;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  code text not null,
  name text not null,
  credits numeric(4, 1) check (credits >= 0),
  semester smallint check (semester between 1 and 12),
  has_mse boolean not null default true,
  has_see boolean not null default true,
  mse_max numeric(6, 2) default 50 check (mse_max > 0),
  see_max numeric(6, 2) default 100 check (see_max > 0),
  ia_components jsonb not null default '[]'::jsonb,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  unique (department_id, code)
);

create table public.academic_semesters (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users (id) on delete cascade,
  semester_no smallint not null check (semester_no between 1 and 12),
  academic_year text,
  status public.semester_status not null default 'DRAFT',
  submitted_at timestamptz,
  verified_by uuid references public.users (id),
  verified_at timestamptz,
  finalized_by uuid references public.users (id),
  finalized_at timestamptz,
  grading_scheme_id uuid references public.grading_schemes (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, semester_no)
);
create index academic_semesters_status_idx on public.academic_semesters (status);

create table public.student_subject_results (
  id uuid primary key default gen_random_uuid(),
  academic_semester_id uuid not null references public.academic_semesters (id) on delete cascade,
  subject_id uuid not null references public.subjects (id),
  mse_marks numeric(6, 2),
  mse_max numeric(6, 2),
  see_marks numeric(6, 2),
  see_max numeric(6, 2),
  ia jsonb not null default '[]'::jsonb,
  grade text,
  grade_points numeric(4, 2),
  result public.subject_result not null default 'PENDING',
  credits_earned numeric(4, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_semester_id, subject_id),
  check (mse_marks is null or (mse_marks >= 0 and (mse_max is null or mse_marks <= mse_max))),
  check (see_marks is null or (see_marks >= 0 and (see_max is null or see_marks <= see_max))),
  check (grade_points is null or grade_points >= 0)
);

create table public.semester_summaries (
  academic_semester_id uuid primary key references public.academic_semesters (id) on delete cascade,
  sgpa numeric(4, 2),
  cgpa_snapshot numeric(4, 2),
  credits_registered numeric(5, 1),
  credits_earned numeric(5, 1),
  computed boolean not null default false,
  computation_note text,
  updated_at timestamptz not null default now()
);

create table public.record_change_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users (id) on delete cascade,
  target_table text not null check (target_table in ('student_subject_results')),
  target_id uuid not null,
  proposed jsonb not null,
  reason text not null check (length(reason) between 3 and 1000),
  status public.request_status not null default 'PENDING',
  reviewer_id uuid references public.users (id),
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index change_requests_pending_idx on public.record_change_requests (student_id) where status = 'PENDING';

-- ───────────── Mentoring ─────────────
create table public.mentor_recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users (id) on delete cascade,
  mentor_id uuid not null references public.users (id),
  kind public.rec_kind not null,
  category public.rec_category not null default 'ACADEMIC_PROGRESS',
  title text not null check (length(title) between 2 and 160),
  body text not null default '',
  subject_id uuid references public.subjects (id),
  status public.rec_status not null default 'PENDING',
  due_date date,
  review_date date,
  visibility public.rec_visibility not null default 'SHARED',
  include_in_report boolean not null default false,
  parent_id uuid references public.mentor_recommendations (id) on delete cascade,
  source public.rec_source not null default 'MANUAL',
  source_id uuid,
  target text, -- improvement plans: measurable target
  steps jsonb not null default '[]'::jsonb, -- [{label, done}]
  reflection text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recs_student_idx on public.mentor_recommendations (student_id, created_at desc);
create index recs_mentor_idx on public.mentor_recommendations (mentor_id, status);

create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.users (id),
  student_id uuid references public.users (id) on delete cascade, -- null = all my mentees
  title text not null check (length(title) between 2 and 160),
  instructions text not null default '',
  file_path text,
  mime text,
  size_bytes bigint check (size_bytes is null or size_bytes <= 26214400),
  external_url text check (external_url is null or external_url ~* '^https?://'),
  subject_id uuid references public.subjects (id),
  created_at timestamptz not null default now(),
  check (file_path is not null or external_url is not null)
);
create index resources_mentor_idx on public.learning_resources (mentor_id, created_at desc);
create index resources_student_idx on public.learning_resources (student_id);

create table public.mentoring_sessions (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.users (id),
  student_id uuid not null references public.users (id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_min int not null default 30 check (duration_min between 5 and 480),
  mode public.session_mode not null default 'IN_PERSON',
  location_or_link text,
  agenda text not null default '',
  summary text,
  action_items jsonb not null default '[]'::jsonb,
  next_follow_up_date date,
  status public.session_status not null default 'SCHEDULED',
  source_thread_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_mentor_idx on public.mentoring_sessions (mentor_id, scheduled_at);
create index sessions_student_idx on public.mentoring_sessions (student_id, scheduled_at);

-- ───────────── Platform ─────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_actor_idx on public.audit_logs (actor_id, created_at desc);

create table public.content_views (
  user_id uuid not null references public.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

create table public.risk_thresholds (
  department_id uuid not null references public.departments (id) on delete cascade,
  rule_key text not null,
  value jsonb not null,
  primary key (department_id, rule_key)
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users (id),
  kind text not null check (kind in ('students', 'mentors', 'subjects', 'results')),
  file_name text,
  status public.import_status not null default 'PREVIEW',
  total_rows int not null default 0,
  valid_rows int not null default 0,
  error_rows int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  committed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  scope text not null,
  name text not null check (length(name) between 1 and 60),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, scope, name)
);

-- Server-side rate limiting (called only with the service role).
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

-- ───────────── NEW-01 Weekly Pulse ─────────────
create table public.pulse_checkins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users (id) on delete cascade,
  week_start date not null,
  mood smallint not null check (mood between 1 and 5),
  workload public.workload not null,
  subject_confidence jsonb not null default '[]'::jsonb,
  help_note text check (help_note is null or length(help_note) <= 1000),
  share_note boolean not null default true,
  seen_by_mentor_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, week_start)
);

-- ───────────── NEW-02 Ask My Mentor ─────────────
create table public.ask_threads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users (id) on delete cascade,
  mentor_id_at_creation uuid references public.users (id),
  subject_id uuid references public.subjects (id),
  title text not null check (length(title) between 3 and 140),
  status public.thread_status not null default 'OPEN',
  first_response_at timestamptz,
  last_answer_at timestamptz,
  last_activity_at timestamptz not null default now(),
  converted_recommendation_id uuid references public.mentor_recommendations (id) on delete set null,
  converted_session_id uuid references public.mentoring_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ask_threads_student_idx on public.ask_threads (student_id, last_activity_at desc);
create index ask_threads_status_idx on public.ask_threads (status, last_activity_at);

create table public.ask_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ask_threads (id) on delete cascade,
  author_id uuid not null references public.users (id),
  body text not null check (length(body) between 1 and 5000),
  attachment_paths text[] not null default '{}' check (cardinality(attachment_paths) <= 3),
  resource_id uuid references public.learning_resources (id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index ask_messages_thread_idx on public.ask_messages (thread_id, created_at);

-- ───────────── NEW-03 Grade Goal Planner ─────────────
create table public.target_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users (id) on delete cascade,
  kind public.plan_kind not null,
  title text not null default '',
  inputs jsonb not null,
  result jsonb not null,
  shared_with_mentor boolean not null default false,
  created_at timestamptz not null default now()
);
create index target_plans_student_idx on public.target_plans (student_id, created_at desc);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['departments','users','student_profiles','mentor_profiles','grading_schemes',
    'academic_semesters','student_subject_results','mentor_recommendations','mentoring_sessions','pulse_checkins']
  loop
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;
