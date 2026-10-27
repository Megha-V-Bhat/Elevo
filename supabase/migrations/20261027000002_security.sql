-- Authorization: helper functions, column guards and Row Level Security on every table.

-- ───────────── Helpers (SECURITY DEFINER, fixed search_path) ─────────────
create or replace function app.is_service() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or (auth.uid() is null and current_user in ('postgres', 'supabase_admin', 'service_role'))
$$;

-- Named user_role() (not current_role(), which is a reserved SQL function).
create or replace function app.user_role() returns public.user_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.users where id = auth.uid() and status <> 'SUSPENDED'
$$;

create or replace function app.is_hod() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(app.user_role() = 'HOD', false)
$$;

create or replace function app.is_active_mentor_of(p_student uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.mentor_assignments a
    join public.users u on u.id = a.mentor_id
    where a.student_id = p_student and a.mentor_id = auth.uid()
      and a.ended_at is null and u.status <> 'SUSPENDED'
  )
$$;

create or replace function app.active_mentor_of(p_student uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select mentor_id from public.mentor_assignments where student_id = p_student and ended_at is null
$$;

create or replace function app.current_department() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select department_id from public.users where id = auth.uid()
$$;

-- Calendar date in the institution timezone (IST); Pulse weeks are defined in local time.
create or replace function app.today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- RPCs set this transaction-local flag so column guards let their writes through.
create or replace function app.in_rpc() returns boolean
language sql stable as $$ select coalesce(current_setting('app.rpc', true), '') = 'on' $$;

grant usage on schema app to authenticated, anon, service_role;
grant execute on all functions in schema app to authenticated, anon, service_role;

-- ───────────── Column guards (RLS is row-level only) ─────────────
create or replace function app.guard_users() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_service() or app.in_rpc() then return new; end if;
  if (new.role, new.status, new.department_id, new.email, new.id)
     is distinct from (old.role, old.status, old.department_id, old.email, old.id) then
    if not app.is_hod() then
      raise exception 'Only the HOD can change role, status or department' using errcode = '42501';
    end if;
    if old.role = 'HOD' and (new.role <> 'HOD' or new.status <> 'ACTIVE') and not exists (
      select 1 from public.users where role = 'HOD' and status = 'ACTIVE' and id <> old.id
    ) then
      raise exception 'Elevo needs at least one active HOD' using errcode = '42501';
    end if;
    if new.id = auth.uid() and new.status = 'SUSPENDED' then
      raise exception 'You cannot suspend your own account' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_users before update on public.users for each row execute function app.guard_users();

create or replace function app.guard_student_profile() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_service() or app.in_rpc() or app.is_hod() then return new; end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'Profile owner cannot change' using errcode = '42501';
  end if;
  -- Identity fields lock once onboarding is complete; corrections go through the HOD.
  if exists (select 1 from public.users where id = old.user_id and onboarding_completed_at is not null)
     and (new.usn, new.department_id) is distinct from (old.usn, old.department_id) then
    raise exception 'USN and department are locked after setup. Ask your HOD to change them.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_student_profile before update on public.student_profiles
  for each row execute function app.guard_student_profile();

create or replace function app.guard_mentor_profile() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_service() or app.in_rpc() or app.is_hod() then return new; end if;
  if new.capacity is distinct from old.capacity or new.user_id is distinct from old.user_id then
    raise exception 'Only the HOD can change mentor capacity' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_mentor_profile before update on public.mentor_profiles
  for each row execute function app.guard_mentor_profile();

create or replace function app.guard_semester() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_service() or app.in_rpc() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'DRAFT';
    new.verified_by := null; new.verified_at := null;
    new.finalized_by := null; new.finalized_at := null;
    return new;
  end if;
  if (new.verified_by, new.verified_at, new.finalized_by, new.finalized_at, new.student_id)
     is distinct from (old.verified_by, old.verified_at, old.finalized_by, old.finalized_at, old.student_id) then
    raise exception 'Verification fields are set by the verification workflow' using errcode = '42501';
  end if;
  if new.status = 'SUBMITTED' and old.status = 'DRAFT' then new.submitted_at := now(); end if;
  return new;
end $$;
create trigger guard_semester before insert or update on public.academic_semesters
  for each row execute function app.guard_semester();

create or replace function app.guard_ask_thread() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if app.is_service() or app.in_rpc() then return new; end if;
  if tg_op = 'INSERT' then
    select count(*) into n from public.ask_threads
      where student_id = new.student_id and created_at > now() - interval '24 hours';
    if n >= 5 then
      raise exception 'You can start up to 5 questions a day. Try again tomorrow, or add to an open thread.' using errcode = 'P0001';
    end if;
    new.mentor_id_at_creation := app.active_mentor_of(new.student_id);
    if new.mentor_id_at_creation is null then
      raise exception 'You don''t have an assigned mentor yet' using errcode = 'P0001';
    end if;
    new.status := 'OPEN';
    new.first_response_at := null; new.last_answer_at := null;
    new.converted_recommendation_id := null; new.converted_session_id := null; new.mentor_seen_at := null;
    return new;
  end if;
  if new.student_id is distinct from old.student_id or new.mentor_id_at_creation is distinct from old.mentor_id_at_creation
     or new.first_response_at is distinct from old.first_response_at then
    raise exception 'These thread fields are read-only' using errcode = '42501';
  end if;
  if old.student_id = auth.uid() then
    -- Students may only resolve (or reopen) their own thread.
    if (new.title, new.subject_id, new.converted_recommendation_id, new.converted_session_id, new.mentor_seen_at)
       is distinct from (old.title, old.subject_id, old.converted_recommendation_id, old.converted_session_id, old.mentor_seen_at)
       or (new.status is distinct from old.status and new.status not in ('RESOLVED', 'OPEN')) then
      raise exception 'Students can only resolve their own question' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_ask_thread before insert or update on public.ask_threads
  for each row execute function app.guard_ask_thread();

create or replace function app.guard_ask_message() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_service() or app.in_rpc() then return new; end if;
  if tg_op = 'INSERT' then
    new.edited_at := null;
    new.created_at := now();
    return new;
  end if;
  if old.author_id <> auth.uid() then raise exception 'Only the author can edit' using errcode = '42501'; end if;
  if old.created_at < now() - interval '10 minutes' then
    raise exception 'Messages can be edited for 10 minutes after sending' using errcode = '42501';
  end if;
  if (new.thread_id, new.author_id, new.created_at) is distinct from (old.thread_id, old.author_id, old.created_at) then
    raise exception 'Only the message text can change' using errcode = '42501';
  end if;
  new.edited_at := now();
  return new;
end $$;
create trigger guard_ask_message before insert or update on public.ask_messages
  for each row execute function app.guard_ask_message();

create or replace function app.guard_pulse() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_service() or app.in_rpc() then return new; end if;
  if tg_op = 'UPDATE' and (new.student_id, new.week_start, new.seen_by_mentor_at)
     is distinct from (old.student_id, old.week_start, old.seen_by_mentor_at) then
    raise exception 'Only the check-in answers can change' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then new.seen_by_mentor_at := null; end if;
  return new;
end $$;
create trigger guard_pulse before insert or update on public.pulse_checkins
  for each row execute function app.guard_pulse();

create or replace function app.guard_recommendation() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_service() or app.in_rpc() then return new; end if;
  if tg_op = 'UPDATE' and (new.student_id, new.mentor_id) is distinct from (old.student_id, old.mentor_id) then
    raise exception 'Student and author cannot change' using errcode = '42501';
  end if;
  if new.status = 'COMPLETED' and (tg_op = 'INSERT' or old.status <> 'COMPLETED') then new.completed_at := now(); end if;
  return new;
end $$;
create trigger guard_recommendation before insert or update on public.mentor_recommendations
  for each row execute function app.guard_recommendation();

create or replace function app.guard_change_request() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if app.is_service() or app.in_rpc() then return new; end if;
  new.status := 'PENDING'; new.reviewer_id := null; new.reviewed_at := null; new.reviewer_note := null;
  if not exists (
    select 1 from public.student_subject_results r
    join public.academic_semesters s on s.id = r.academic_semester_id
    where r.id = new.target_id and s.student_id = new.student_id and s.status in ('VERIFIED', 'FINALIZED')
  ) then
    raise exception 'Corrections can only be requested for your own verified records' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_change_request before insert on public.record_change_requests
  for each row execute function app.guard_change_request();

-- ───────────── Row Level Security: ON for every table ─────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- users
create policy users_select on public.users for select to authenticated using (
  id = auth.uid() or app.is_hod() or app.is_active_mentor_of(id) or id = app.active_mentor_of(auth.uid())
);
create policy users_update on public.users for update to authenticated
  using (id = auth.uid() or app.is_hod()) with check (id = auth.uid() or app.is_hod());

-- student_profiles
create policy sp_select on public.student_profiles for select to authenticated using (
  user_id = auth.uid() or app.is_hod() or app.is_active_mentor_of(user_id)
);
create policy sp_insert on public.student_profiles for insert to authenticated
  with check ((user_id = auth.uid() and app.user_role() = 'MENTEE') or app.is_hod());
create policy sp_update on public.student_profiles for update to authenticated
  using (user_id = auth.uid() or app.is_hod()) with check (user_id = auth.uid() or app.is_hod());

-- mentor_profiles
create policy mp_select on public.mentor_profiles for select to authenticated using (
  user_id = auth.uid() or app.is_hod() or user_id = app.active_mentor_of(auth.uid())
);
create policy mp_insert on public.mentor_profiles for insert to authenticated
  with check ((user_id = auth.uid() and app.user_role() = 'MENTOR') or app.is_hod());
create policy mp_update on public.mentor_profiles for update to authenticated
  using (user_id = auth.uid() or app.is_hod()) with check (user_id = auth.uid() or app.is_hod());

-- mentor_assignments: read-only to clients; writes go through assign_students()
create policy ma_select on public.mentor_assignments for select to authenticated using (
  app.is_hod() or mentor_id = auth.uid() or student_id = auth.uid()
);

-- reference data: everyone signed in can read; HOD writes
do $$
declare t text;
begin
  foreach t in array array['departments','sections','academic_years','grading_schemes','risk_thresholds','app_settings'] loop
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy %1$s_hod_write on public.%1$s for all to authenticated using (app.is_hod()) with check (app.is_hod())', t);
  end loop;
end $$;

-- subjects: anyone in the department can add to the catalog (setup wizard); only the HOD edits/deletes
create policy subjects_read on public.subjects for select to authenticated using (true);
create policy subjects_insert on public.subjects for insert to authenticated
  with check (app.is_hod() or department_id = app.current_department());
create policy subjects_hod_update on public.subjects for update to authenticated using (app.is_hod()) with check (app.is_hod());
create policy subjects_hod_delete on public.subjects for delete to authenticated using (app.is_hod());

-- academic_semesters
create policy sem_select on public.academic_semesters for select to authenticated using (
  student_id = auth.uid() or app.is_hod() or app.is_active_mentor_of(student_id)
);
create policy sem_insert on public.academic_semesters for insert to authenticated
  with check (student_id = auth.uid() and app.user_role() = 'MENTEE');
create policy sem_update on public.academic_semesters for update to authenticated
  using (student_id = auth.uid() and status in ('DRAFT', 'SUBMITTED'))
  with check (student_id = auth.uid() and status in ('DRAFT', 'SUBMITTED'));
create policy sem_delete on public.academic_semesters for delete to authenticated
  using (student_id = auth.uid() and status = 'DRAFT');

-- student_subject_results: student edits only while the semester is DRAFT
create policy ssr_select on public.student_subject_results for select to authenticated using (
  exists (select 1 from public.academic_semesters s where s.id = academic_semester_id
          and (s.student_id = auth.uid() or app.is_hod() or app.is_active_mentor_of(s.student_id)))
);
create policy ssr_write on public.student_subject_results for all to authenticated
  using (exists (select 1 from public.academic_semesters s where s.id = academic_semester_id
                 and s.student_id = auth.uid() and s.status = 'DRAFT'))
  with check (exists (select 1 from public.academic_semesters s where s.id = academic_semester_id
                      and s.student_id = auth.uid() and s.status = 'DRAFT'));

-- semester_summaries
create policy sum_select on public.semester_summaries for select to authenticated using (
  exists (select 1 from public.academic_semesters s where s.id = academic_semester_id
          and (s.student_id = auth.uid() or app.is_hod() or app.is_active_mentor_of(s.student_id)))
);
create policy sum_write on public.semester_summaries for all to authenticated
  using (exists (select 1 from public.academic_semesters s where s.id = academic_semester_id
                 and s.student_id = auth.uid() and s.status = 'DRAFT'))
  with check (exists (select 1 from public.academic_semesters s where s.id = academic_semester_id
                      and s.student_id = auth.uid() and s.status = 'DRAFT'));

-- record_change_requests
create policy rcr_select on public.record_change_requests for select to authenticated using (
  student_id = auth.uid() or app.is_hod() or app.is_active_mentor_of(student_id)
);
create policy rcr_insert on public.record_change_requests for insert to authenticated
  with check (student_id = auth.uid());

-- mentor_recommendations (PRIVATE_MENTOR never reaches the student)
create policy rec_select on public.mentor_recommendations for select to authenticated using (
  (student_id = auth.uid() and visibility = 'SHARED')
  or (app.is_active_mentor_of(student_id) and (visibility = 'SHARED' or mentor_id = auth.uid()))
  or (app.is_hod() and visibility = 'SHARED')
);
create policy rec_insert on public.mentor_recommendations for insert to authenticated
  with check (mentor_id = auth.uid() and app.is_active_mentor_of(student_id));
create policy rec_update on public.mentor_recommendations for update to authenticated
  using (app.is_active_mentor_of(student_id) and (visibility = 'SHARED' or mentor_id = auth.uid()))
  with check (app.is_active_mentor_of(student_id));
create policy rec_delete on public.mentor_recommendations for delete to authenticated
  using (mentor_id = auth.uid() and app.is_active_mentor_of(student_id));

-- learning_resources
create policy res_select on public.learning_resources for select to authenticated using (
  mentor_id = auth.uid() or app.is_hod() or student_id = auth.uid()
  or (student_id is null and mentor_id = app.active_mentor_of(auth.uid()))
);
create policy res_insert on public.learning_resources for insert to authenticated with check (
  mentor_id = auth.uid() and app.user_role() = 'MENTOR' and (student_id is null or app.is_active_mentor_of(student_id))
);
create policy res_update on public.learning_resources for update to authenticated
  using (mentor_id = auth.uid()) with check (mentor_id = auth.uid() and (student_id is null or app.is_active_mentor_of(student_id)));
create policy res_delete on public.learning_resources for delete to authenticated using (mentor_id = auth.uid());

-- mentoring_sessions
create policy ses_select on public.mentoring_sessions for select to authenticated using (
  student_id = auth.uid() or app.is_hod() or app.is_active_mentor_of(student_id)
);
create policy ses_insert on public.mentoring_sessions for insert to authenticated
  with check (mentor_id = auth.uid() and app.is_active_mentor_of(student_id));
create policy ses_update on public.mentoring_sessions for update to authenticated
  using (app.is_active_mentor_of(student_id)) with check (app.is_active_mentor_of(student_id));

-- notifications (rows are created by SECURITY DEFINER triggers / the service role)
create policy notif_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- audit_logs: insert-only via triggers; HOD reads
create policy audit_hod_read on public.audit_logs for select to authenticated using (app.is_hod());

create policy cv_own on public.content_views for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy import_hod on public.import_jobs for all to authenticated
  using (app.is_hod()) with check (app.is_hod() and created_by = auth.uid());
create policy sv_own on public.saved_views for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- rate_limits: no policies (service role only)

-- pulse_checkins: the student only. Mentors read through mentor_pulse(); HOD gets aggregates only.
create policy pulse_select on public.pulse_checkins for select to authenticated using (student_id = auth.uid());
create policy pulse_insert on public.pulse_checkins for insert to authenticated with check (
  student_id = auth.uid() and app.user_role() = 'MENTEE'
  and week_start > app.today() - 7 and week_start <= app.today()
);
create policy pulse_update on public.pulse_checkins for update to authenticated
  using (student_id = auth.uid() and week_start > app.today() - 7)
  with check (student_id = auth.uid() and week_start > app.today() - 7);

-- ask_threads / ask_messages: the student + their CURRENT active mentor
create policy ask_t_select on public.ask_threads for select to authenticated using (
  student_id = auth.uid() or app.is_active_mentor_of(student_id)
);
create policy ask_t_insert on public.ask_threads for insert to authenticated
  with check (student_id = auth.uid() and app.user_role() = 'MENTEE');
create policy ask_t_update on public.ask_threads for update to authenticated
  using (student_id = auth.uid() or app.is_active_mentor_of(student_id))
  with check (student_id = auth.uid() or app.is_active_mentor_of(student_id));

create policy ask_m_select on public.ask_messages for select to authenticated using (
  exists (select 1 from public.ask_threads t where t.id = thread_id
          and (t.student_id = auth.uid() or app.is_active_mentor_of(t.student_id)))
);
create policy ask_m_insert on public.ask_messages for insert to authenticated with check (
  author_id = auth.uid() and exists (select 1 from public.ask_threads t where t.id = thread_id
          and (t.student_id = auth.uid() or app.is_active_mentor_of(t.student_id)))
);
create policy ask_m_update on public.ask_messages for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- target_plans
create policy plan_select on public.target_plans for select to authenticated using (
  student_id = auth.uid() or (shared_with_mentor and app.is_active_mentor_of(student_id))
);
create policy plan_write on public.target_plans for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid() and app.user_role() = 'MENTEE');

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.rate_limits from authenticated, anon;
revoke insert, update, delete on public.audit_logs from authenticated;
