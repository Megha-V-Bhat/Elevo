-- Audit trail, notification triggers and transactional workflow functions.

-- ───────────── Audit ─────────────
create or replace function app.audit_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  rec_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  rec_after jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  key_col text := coalesce(tg_argv[0], 'id');
begin
  if tg_op = 'UPDATE' and rec_before = rec_after then return new; end if;
  -- Strip noisy/private columns
  rec_before := rec_before - 'draft' - 'updated_at';
  rec_after := rec_after - 'draft' - 'updated_at';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(rec_after ->> key_col, rec_before ->> key_col), rec_before, rec_after);
  return coalesce(new, old);
end $$;

create trigger audit_semesters after insert or update or delete on public.academic_semesters
  for each row execute function app.audit_row();
create trigger audit_results after insert or update or delete on public.student_subject_results
  for each row execute function app.audit_row();
create trigger audit_summaries after insert or update on public.semester_summaries
  for each row execute function app.audit_row('academic_semester_id');
create trigger audit_assignments after insert or update on public.mentor_assignments
  for each row execute function app.audit_row();
create trigger audit_recs after insert or update or delete on public.mentor_recommendations
  for each row execute function app.audit_row();
create trigger audit_schemes after insert or update on public.grading_schemes
  for each row execute function app.audit_row();
create trigger audit_settings after insert or update on public.app_settings
  for each row execute function app.audit_row('key');
create trigger audit_users_role after update of role, status, department_id on public.users
  for each row execute function app.audit_row();
create trigger audit_ask_edits after update on public.ask_messages
  for each row execute function app.audit_row();
create trigger audit_change_requests after update on public.record_change_requests
  for each row execute function app.audit_row();

-- ───────────── Notifications ─────────────
create or replace function app.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_entity_type text, p_entity_id uuid
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link, entity_type, entity_id)
  values (p_user, p_type, p_title, coalesce(p_body, ''), p_link, p_entity_type, p_entity_id);
end $$;

create or replace function app.display_name(p_user uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    nullif((select full_name from public.mentor_profiles where user_id = p_user), ''),
    nullif((select full_name from public.student_profiles where user_id = p_user), ''),
    (select split_part(email, '@', 1) from public.users where id = p_user)
  )
$$;

create or replace function app.on_recommendation() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.visibility = 'SHARED' and (tg_op = 'INSERT' or old.visibility <> 'SHARED') then
    perform app.notify(new.student_id, 'feedback', 'New ' || lower(replace(new.kind::text, '_', ' ')) || ' from your mentor',
      new.title, '/mentee/mentoring?item=' || new.id, 'mentor_recommendations', new.id);
  elsif tg_op = 'UPDATE' and new.status <> old.status and new.visibility = 'SHARED' then
    if auth.uid() = new.student_id then
      perform app.notify(app.active_mentor_of(new.student_id), 'status', app.display_name(new.student_id) || ' updated a goal',
        new.title || ' → ' || replace(new.status::text, '_', ' '), '/mentor/mentees/' || new.student_id || '?tab=mentoring', 'mentor_recommendations', new.id);
    else
      perform app.notify(new.student_id, 'status', 'Status updated', new.title || ' → ' || replace(new.status::text, '_', ' '),
        '/mentee/mentoring?item=' || new.id, 'mentor_recommendations', new.id);
    end if;
  end if;
  return new;
end $$;
create trigger notify_recommendation after insert or update on public.mentor_recommendations
  for each row execute function app.on_recommendation();

create or replace function app.on_resource() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare s uuid;
begin
  if new.student_id is not null then
    perform app.notify(new.student_id, 'resource', 'New study material', new.title, '/mentee/resources', 'learning_resources', new.id);
  else
    for s in select student_id from public.mentor_assignments where mentor_id = new.mentor_id and ended_at is null loop
      perform app.notify(s, 'resource', 'New study material', new.title, '/mentee/resources', 'learning_resources', new.id);
    end loop;
  end if;
  return new;
end $$;
create trigger notify_resource after insert on public.learning_resources for each row execute function app.on_resource();

create or replace function app.on_session() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    perform app.notify(new.student_id, 'session', 'Mentoring session scheduled',
      to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM'), '/mentee/sessions', 'mentoring_sessions', new.id);
  elsif new.scheduled_at <> old.scheduled_at or new.status <> old.status then
    perform app.notify(new.student_id, 'session',
      case when new.status = 'CANCELLED' then 'Session cancelled' when new.status = 'COMPLETED' then 'Session summary added' else 'Session rescheduled' end,
      to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM'), '/mentee/sessions', 'mentoring_sessions', new.id);
  end if;
  return new;
end $$;
create trigger notify_session after insert or update on public.mentoring_sessions for each row execute function app.on_session();

create or replace function app.on_semester() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'SUBMITTED' then
    perform app.notify(app.active_mentor_of(new.student_id), 'verification', 'Semester submitted for verification',
      app.display_name(new.student_id) || ' · Semester ' || new.semester_no, '/mentor/verifications', 'academic_semesters', new.id);
  elsif new.status = 'VERIFIED' then
    perform app.notify(new.student_id, 'verification', 'Semester ' || new.semester_no || ' verified',
      'Your records are now verified.', '/mentee/academics/' || new.semester_no, 'academic_semesters', new.id);
  elsif new.status = 'DRAFT' and old.status = 'SUBMITTED' and auth.uid() <> new.student_id then
    perform app.notify(new.student_id, 'verification', 'Semester ' || new.semester_no || ' returned for edits',
      'Your mentor asked you to review this semester.', '/mentee/academics/' || new.semester_no, 'academic_semesters', new.id);
  end if;
  return new;
end $$;
create trigger notify_semester after update on public.academic_semesters for each row execute function app.on_semester();

create or replace function app.on_change_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.notify(app.active_mentor_of(new.student_id), 'verification', 'Correction requested',
    app.display_name(new.student_id) || ': ' || left(new.reason, 80), '/mentor/verifications?tab=corrections', 'record_change_requests', new.id);
  return new;
end $$;
create trigger notify_change_request after insert on public.record_change_requests for each row execute function app.on_change_request();

create or replace function app.on_assignment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    perform app.notify(new.student_id, 'assignment', 'Your mentor is ' || app.display_name(new.mentor_id),
      'Assigned by your HOD.', '/mentee', 'mentor_assignments', new.id);
    perform app.notify(new.mentor_id, 'assignment', 'New mentee: ' || app.display_name(new.student_id),
      coalesce(new.reason, ''), '/mentor/mentees/' || new.student_id, 'mentor_assignments', new.id);
  elsif new.ended_at is not null and old.ended_at is null then
    perform app.notify(new.mentor_id, 'assignment', app.display_name(new.student_id) || ' was reassigned',
      coalesce(new.reason, 'Assignment ended by the HOD.'), '/mentor/mentees', 'mentor_assignments', new.id);
  end if;
  return new;
end $$;
create trigger notify_assignment after insert or update on public.mentor_assignments for each row execute function app.on_assignment();

create or replace function app.on_ask_thread() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.notify(new.mentor_id_at_creation, 'ask', app.display_name(new.student_id) || ' asked a question',
    new.title, '/mentor/inbox/' || new.id, 'ask_threads', new.id);
  return new;
end $$;
create trigger notify_ask_thread after insert on public.ask_threads for each row execute function app.on_ask_thread();

create or replace function app.on_ask_message() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.ask_threads;
begin
  select * into t from public.ask_threads where id = new.thread_id;
  perform set_config('app.rpc', 'on', true);
  if new.author_id = t.student_id then
    update public.ask_threads set last_activity_at = now(),
      status = case when status = 'RESOLVED' then 'OPEN' else status end
    where id = t.id;
    -- the opening message is covered by the thread notification
    if exists (select 1 from public.ask_messages where thread_id = t.id and id <> new.id) then
      perform app.notify(app.active_mentor_of(t.student_id), 'ask', 'New reply from ' || app.display_name(t.student_id),
        t.title, '/mentor/inbox/' || t.id, 'ask_threads', t.id);
    end if;
  else
    update public.ask_threads set last_activity_at = now(), last_answer_at = now(), status = 'ANSWERED',
      first_response_at = coalesce(first_response_at, now())
    where id = t.id;
    perform app.notify(t.student_id, 'ask', 'Your mentor replied', t.title, '/mentee/ask/' || t.id, 'ask_threads', t.id);
  end if;
  perform set_config('app.rpc', '', true);
  return new;
end $$;
create trigger notify_ask_message after insert on public.ask_messages for each row execute function app.on_ask_message();

create or replace function app.on_plan_shared() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.shared_with_mentor and (tg_op = 'INSERT' or not old.shared_with_mentor) then
    perform app.notify(app.active_mentor_of(new.student_id), 'plan', app.display_name(new.student_id) || ' shared a goal plan',
      new.title, '/mentor/mentees/' || new.student_id || '?tab=planner', 'target_plans', new.id);
  end if;
  return new;
end $$;
create trigger notify_plan after insert or update on public.target_plans for each row execute function app.on_plan_shared();

-- ───────────── Assignment workflow (HOD only, transactional) ─────────────
create or replace function public.assign_students(p_student_ids uuid[], p_mentor_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  sid uuid;
  prev uuid;
  moved jsonb := '[]'::jsonb;
begin
  if not app.is_hod() then raise exception 'Only the HOD can assign mentors' using errcode = '42501'; end if;
  if not exists (select 1 from public.users where id = p_mentor_id and role = 'MENTOR' and status <> 'SUSPENDED') then
    raise exception 'Choose an active mentor' using errcode = 'P0001';
  end if;
  perform set_config('app.rpc', 'on', true);
  foreach sid in array p_student_ids loop
    if not exists (select 1 from public.users where id = sid and role = 'MENTEE') then
      raise exception 'Not a student: %', sid using errcode = 'P0001';
    end if;
    select mentor_id into prev from public.mentor_assignments where student_id = sid and ended_at is null for update;
    if prev = p_mentor_id then continue; end if;
    update public.mentor_assignments set ended_at = now(), reason = coalesce(p_reason, reason)
      where student_id = sid and ended_at is null;
    insert into public.mentor_assignments (mentor_id, student_id, assigned_by, reason)
      values (p_mentor_id, sid, auth.uid(), p_reason);
    moved := moved || jsonb_build_object('student_id', sid, 'previous_mentor_id', prev);
  end loop;
  perform set_config('app.rpc', '', true);
  return moved;
end $$;

create or replace function public.unassign_students(p_student_ids uuid[], p_reason text default null)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if not app.is_hod() then raise exception 'Only the HOD can change assignments' using errcode = '42501'; end if;
  update public.mentor_assignments set ended_at = now(), reason = coalesce(p_reason, reason)
    where student_id = any (p_student_ids) and ended_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────── Verification workflow ─────────────
-- p_summaries: { "<semester_id>": { sgpa, cgpa_snapshot, credits_registered, credits_earned, computed, computation_note } }
create or replace function public.verify_semesters(p_ids uuid[], p_summaries jsonb default '{}'::jsonb)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.academic_semesters;
  sm jsonb;
  n int := 0;
begin
  perform set_config('app.rpc', 'on', true);
  for s in select * from public.academic_semesters where id = any (p_ids) for update loop
    if not (app.is_hod() or app.is_active_mentor_of(s.student_id)) then
      raise exception 'You can only verify records of your own mentees' using errcode = '42501';
    end if;
    if s.status <> 'SUBMITTED' then continue; end if;
    update public.academic_semesters set status = 'VERIFIED', verified_by = auth.uid(), verified_at = now() where id = s.id;
    sm := p_summaries -> s.id::text;
    if sm is not null then
      insert into public.semester_summaries (academic_semester_id, sgpa, cgpa_snapshot, credits_registered, credits_earned, computed, computation_note)
      values (s.id, (sm ->> 'sgpa')::numeric, (sm ->> 'cgpa_snapshot')::numeric, (sm ->> 'credits_registered')::numeric,
              (sm ->> 'credits_earned')::numeric, coalesce((sm ->> 'computed')::boolean, false), sm ->> 'computation_note')
      on conflict (academic_semester_id) do update set
        sgpa = excluded.sgpa, cgpa_snapshot = excluded.cgpa_snapshot, credits_registered = excluded.credits_registered,
        credits_earned = excluded.credits_earned, computed = excluded.computed, computation_note = excluded.computation_note,
        updated_at = now();
    end if;
    n := n + 1;
  end loop;
  perform set_config('app.rpc', '', true);
  return n;
end $$;

create or replace function public.return_semester(p_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.academic_semesters;
begin
  select * into s from public.academic_semesters where id = p_id for update;
  if s.id is null or not (app.is_hod() or app.is_active_mentor_of(s.student_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if s.status <> 'SUBMITTED' then raise exception 'Only submitted semesters can be returned' using errcode = 'P0001'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.academic_semesters set status = 'DRAFT', submitted_at = null where id = p_id;
  perform app.notify(s.student_id, 'verification', 'Note from your mentor on Semester ' || s.semester_no, p_note,
    '/mentee/academics/' || s.semester_no, 'academic_semesters', s.id);
  perform set_config('app.rpc', '', true);
end $$;

create or replace function public.finalize_semester(p_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not app.is_hod() then raise exception 'Only the HOD can finalize records' using errcode = '42501'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.academic_semesters set status = 'FINALIZED', finalized_by = auth.uid(), finalized_at = now()
    where id = p_id and status = 'VERIFIED';
  if not found then raise exception 'Only verified semesters can be finalized' using errcode = 'P0001'; end if;
  perform set_config('app.rpc', '', true);
end $$;

create or replace function public.decide_change_request(p_id uuid, p_approve boolean, p_note text default null, p_summary jsonb default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.record_change_requests;
  allowed text[] := array['mse_marks','mse_max','see_marks','see_max','ia','grade','grade_points','result','credits_earned'];
  k text;
  sem_id uuid;
begin
  select * into r from public.record_change_requests where id = p_id for update;
  if r.id is null or not (app.is_hod() or app.is_active_mentor_of(r.student_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if r.status <> 'PENDING' then raise exception 'This request was already decided' using errcode = 'P0001'; end if;
  perform set_config('app.rpc', 'on', true);
  if p_approve then
    for k in select jsonb_object_keys(r.proposed) loop
      if not (k = any (allowed)) then raise exception 'Field % cannot be changed', k using errcode = 'P0001'; end if;
    end loop;
    update public.student_subject_results t set
      mse_marks = case when r.proposed ? 'mse_marks' then (r.proposed ->> 'mse_marks')::numeric else t.mse_marks end,
      mse_max = case when r.proposed ? 'mse_max' then (r.proposed ->> 'mse_max')::numeric else t.mse_max end,
      see_marks = case when r.proposed ? 'see_marks' then (r.proposed ->> 'see_marks')::numeric else t.see_marks end,
      see_max = case when r.proposed ? 'see_max' then (r.proposed ->> 'see_max')::numeric else t.see_max end,
      ia = case when r.proposed ? 'ia' then r.proposed -> 'ia' else t.ia end,
      grade = case when r.proposed ? 'grade' then r.proposed ->> 'grade' else t.grade end,
      grade_points = case when r.proposed ? 'grade_points' then (r.proposed ->> 'grade_points')::numeric else t.grade_points end,
      result = case when r.proposed ? 'result' then (r.proposed ->> 'result')::public.subject_result else t.result end,
      credits_earned = case when r.proposed ? 'credits_earned' then (r.proposed ->> 'credits_earned')::numeric else t.credits_earned end
    where t.id = r.target_id
    returning academic_semester_id into sem_id;
    if p_summary is not null and sem_id is not null then
      update public.semester_summaries set sgpa = (p_summary ->> 'sgpa')::numeric, cgpa_snapshot = (p_summary ->> 'cgpa_snapshot')::numeric,
        computed = coalesce((p_summary ->> 'computed')::boolean, computed), computation_note = p_summary ->> 'computation_note', updated_at = now()
      where academic_semester_id = sem_id;
    end if;
  end if;
  update public.record_change_requests set status = case when p_approve then 'APPROVED'::public.request_status else 'REJECTED' end,
    reviewer_id = auth.uid(), reviewer_note = p_note, reviewed_at = now() where id = p_id;
  perform app.notify(r.student_id, 'verification', 'Correction ' || case when p_approve then 'approved' else 'declined' end,
    coalesce(p_note, ''), '/mentee/academics', 'record_change_requests', r.id);
  perform set_config('app.rpc', '', true);
end $$;

-- ───────────── Mentoring: student-side updates ─────────────
create or replace function public.student_update_item(p_id uuid, p_status public.rec_status, p_steps jsonb default null, p_reflection text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.mentor_recommendations;
begin
  select * into r from public.mentor_recommendations where id = p_id for update;
  if r.id is null or r.student_id <> auth.uid() or r.visibility <> 'SHARED' then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- Goals are confirmed complete by the mentor; other items can be completed by the student.
  if r.kind = 'GOAL' and p_status = 'COMPLETED' then
    raise exception 'Your mentor confirms when a goal is complete' using errcode = 'P0001';
  end if;
  perform set_config('app.rpc', 'on', true);
  update public.mentor_recommendations set
    status = p_status,
    steps = coalesce(p_steps, steps),
    reflection = coalesce(left(p_reflection, 2000), reflection)
  where id = p_id;
  perform set_config('app.rpc', '', true);
end $$;

-- ───────────── Pulse: mentor read (help note only when shared) ─────────────
create or replace function public.mentor_pulse(p_student uuid, p_weeks int default 12)
returns table (id uuid, week_start date, mood smallint, workload public.workload, subject_confidence jsonb,
               help_note text, note_shared boolean, seen_by_mentor_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_active_mentor_of(p_student) then
    raise exception 'Pulse is visible only to the student''s current mentor' using errcode = '42501';
  end if;
  return query
    select p.id, p.week_start, p.mood, p.workload, p.subject_confidence,
           case when p.share_note then p.help_note end, p.share_note and p.help_note is not null, p.seen_by_mentor_at
    from public.pulse_checkins p
    where p.student_id = p_student and p.week_start > app.today() - (p_weeks * 7)
    order by p.week_start;
end $$;

create or replace function public.mentor_pulse_overview(p_weeks int default 12)
returns table (student_id uuid, week_start date, mood smallint, workload public.workload, subject_confidence jsonb, has_note boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.student_id, p.week_start, p.mood, p.workload, p.subject_confidence, (p.share_note and p.help_note is not null)
  from public.pulse_checkins p
  join public.mentor_assignments a on a.student_id = p.student_id and a.ended_at is null and a.mentor_id = auth.uid()
  where p.week_start > app.today() - (p_weeks * 7)
  order by p.student_id, p.week_start
$$;

create or replace function public.mark_pulse_seen(p_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare sid uuid;
begin
  select student_id into sid from public.pulse_checkins where id = p_id;
  if sid is null or not app.is_active_mentor_of(sid) then raise exception 'Not allowed' using errcode = '42501'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.pulse_checkins set seen_by_mentor_at = now() where id = p_id and seen_by_mentor_at is null;
  perform set_config('app.rpc', '', true);
end $$;

-- ───────────── HOD aggregates (no row-level content) ─────────────
create or replace function public.hod_mentor_activity()
returns table (mentor_id uuid, full_name text, designation text, capacity int, mentees int,
               feedback_30d int, sessions_30d int, last_activity timestamptz,
               median_first_response_hours numeric, pulse_participation_pct numeric, open_threads int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_hod() then raise exception 'HOD only' using errcode = '42501'; end if;
  return query
  with m as (
    select u.id, coalesce(mp.full_name, u.email) as full_name, mp.designation, coalesce(mp.capacity, 20) as capacity
    from public.users u left join public.mentor_profiles mp on mp.user_id = u.id
    where u.role = 'MENTOR' and u.status <> 'SUSPENDED'
  ), act as (
    select a.mentor_id, a.student_id from public.mentor_assignments a where a.ended_at is null
  )
  select m.id, m.full_name, m.designation, m.capacity,
    (select count(*)::int from act where act.mentor_id = m.id),
    (select count(*)::int from public.mentor_recommendations r where r.mentor_id = m.id and r.created_at > now() - interval '30 days'),
    (select count(*)::int from public.mentoring_sessions s where s.mentor_id = m.id and s.scheduled_at > now() - interval '30 days'),
    greatest(
      (select max(r.created_at) from public.mentor_recommendations r where r.mentor_id = m.id),
      (select max(s.updated_at) from public.mentoring_sessions s where s.mentor_id = m.id),
      (select max(x.created_at) from public.ask_messages x where x.author_id = m.id)),
    (select round((percentile_cont(0.5) within group (order by extract(epoch from (t.first_response_at - t.created_at)) / 3600))::numeric, 1)
       from public.ask_threads t join act on act.student_id = t.student_id and act.mentor_id = m.id
       where t.first_response_at is not null),
    (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where exists (
              select 1 from public.pulse_checkins p where p.student_id = act.student_id and p.week_start > app.today() - 28)) / count(*), 0) end
       from act where act.mentor_id = m.id),
    (select count(*)::int from public.ask_threads t join act on act.student_id = t.student_id and act.mentor_id = m.id
       where t.status = 'OPEN')
  from m order by m.full_name;
end $$;

create or replace function public.hod_pulse_participation()
returns table (section text, students int, participation_pct numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_hod() then raise exception 'HOD only' using errcode = '42501'; end if;
  return query
  select coalesce(sp.section, '—'), count(*)::int,
    round(100.0 * count(*) filter (where exists (select 1 from public.pulse_checkins p
      where p.student_id = sp.user_id and p.week_start > app.today() - 28)) / greatest(count(*), 1), 0)
  from public.student_profiles sp join public.users u on u.id = sp.user_id and u.status <> 'SUSPENDED'
  group by 1 order by 1;
end $$;

create or replace function public.hod_ask_summary()
returns table (open_threads int, unanswered_48h int, median_first_response_hours numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not app.is_hod() then raise exception 'HOD only' using errcode = '42501'; end if;
  return query
  select count(*) filter (where status = 'OPEN')::int,
         count(*) filter (where status = 'OPEN' and first_response_at is null and created_at < now() - interval '48 hours')::int,
         round((percentile_cont(0.5) within group (order by extract(epoch from (first_response_at - created_at)) / 3600))::numeric, 1)
  from public.ask_threads;
end $$;

-- Mentor's own Ask stats (for /mentor/analytics)
create or replace function public.mentor_ask_stats()
returns table (open_threads int, unanswered_48h int, median_first_response_hours numeric, pulse_participation_pct numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with act as (select student_id from public.mentor_assignments where mentor_id = auth.uid() and ended_at is null)
  select
    (select count(*)::int from public.ask_threads t where t.student_id in (select student_id from act) and t.status = 'OPEN'),
    (select count(*)::int from public.ask_threads t where t.student_id in (select student_id from act) and t.status = 'OPEN'
       and t.first_response_at is null and t.created_at < now() - interval '48 hours'),
    (select round((percentile_cont(0.5) within group (order by extract(epoch from (t.first_response_at - t.created_at)) / 3600))::numeric, 1)
       from public.ask_threads t where t.student_id in (select student_id from act) and t.first_response_at is not null),
    (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where exists (
       select 1 from public.pulse_checkins p where p.student_id = act.student_id and p.week_start > app.today() - 28)) / count(*), 0) end from act)
$$;

-- ───────────── Service-only helpers ─────────────
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, now(), 0) on conflict (key) do nothing;
  select * into r from public.rate_limits where key = p_key for update;
  if r.window_start < now() - make_interval(secs => p_window_seconds) then
    update public.rate_limits set window_start = now(), count = 1 where key = p_key;
    return true;
  end if;
  update public.rate_limits set count = count + 1 where key = p_key;
  return r.count + 1 <= p_limit;
end $$;

create or replace function public.auto_resolve_threads()
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare t record; n int := 0;
begin
  perform set_config('app.rpc', 'on', true);
  for t in update public.ask_threads set status = 'RESOLVED'
           where status = 'ANSWERED' and last_answer_at < now() - interval '7 days' returning id, student_id, title loop
    perform app.notify(t.student_id, 'ask', 'Question marked resolved', t.title || ' — reply any time to reopen it.',
      '/mentee/ask/' || t.id, 'ask_threads', t.id);
    n := n + 1;
  end loop;
  perform set_config('app.rpc', '', true);
  return n;
end $$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
revoke execute on function public.auto_resolve_threads() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.auto_resolve_threads() to service_role;
revoke execute on all functions in schema app from anon;
