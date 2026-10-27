-- Bulk import support: staged rows on the job, transactional commit functions (HOD only).

alter table public.import_jobs add column if not exists rows jsonb not null default '[]'::jsonb;
alter table public.import_jobs add column if not exists options jsonb not null default '{}'::jsonb;

-- Subjects: [{code, name, credits, semester, has_mse, has_see, mse_max, see_max}]
create or replace function public.import_subjects(p_rows jsonb, p_update boolean)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r jsonb;
  dept uuid := app.current_department();
  ins int := 0; upd int := 0; skip int := 0;
  existing uuid;
begin
  if not app.is_hod() then raise exception 'HOD only' using errcode = '42501'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    select id into existing from public.subjects where department_id = dept and code = r ->> 'code';
    if existing is null then
      insert into public.subjects (department_id, code, name, credits, semester, has_mse, has_see, mse_max, see_max, created_by)
      values (dept, r ->> 'code', r ->> 'name', (r ->> 'credits')::numeric, (r ->> 'semester')::smallint,
              coalesce((r ->> 'has_mse')::boolean, true), coalesce((r ->> 'has_see')::boolean, true),
              coalesce((r ->> 'mse_max')::numeric, 50), coalesce((r ->> 'see_max')::numeric, 100), auth.uid());
      ins := ins + 1;
    elsif p_update then
      update public.subjects set name = r ->> 'name', credits = (r ->> 'credits')::numeric, semester = (r ->> 'semester')::smallint,
        has_mse = coalesce((r ->> 'has_mse')::boolean, has_mse), has_see = coalesce((r ->> 'has_see')::boolean, has_see),
        mse_max = coalesce((r ->> 'mse_max')::numeric, mse_max), see_max = coalesce((r ->> 'see_max')::numeric, see_max)
      where id = existing;
      upd := upd + 1;
    else
      skip := skip + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'updated', upd, 'skipped', skip);
end $$;

-- Results from the exam cell: [{usn, semester, academic_year, subject_code, mse_marks, see_marks, grade, grade_points, result}]
-- Imported results are authoritative and land as VERIFIED (verified_by = the importing HOD). All-or-nothing.
create or replace function public.import_results(p_rows jsonb, p_update boolean)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r jsonb;
  dept uuid := app.current_department();
  sid uuid; subj public.subjects; sem_id uuid; sem_status public.semester_status;
  ins int := 0; upd int := 0; skip int := 0;
  touched uuid[] := '{}';
  existing uuid;
begin
  if not app.is_hod() then raise exception 'HOD only' using errcode = '42501'; end if;
  perform set_config('app.rpc', 'on', true);
  for r in select * from jsonb_array_elements(p_rows) loop
    select user_id into sid from public.student_profiles where upper(usn) = upper(r ->> 'usn');
    if sid is null then raise exception 'Unknown USN %', r ->> 'usn' using errcode = 'P0001'; end if;
    select * into subj from public.subjects where department_id = dept and code = r ->> 'subject_code';
    if subj.id is null then raise exception 'Unknown subject code %', r ->> 'subject_code' using errcode = 'P0001'; end if;
    select id, status into sem_id, sem_status from public.academic_semesters where student_id = sid and semester_no = (r ->> 'semester')::smallint;
    if sem_id is null then
      insert into public.academic_semesters (student_id, semester_no, academic_year, status, verified_by, verified_at)
      values (sid, (r ->> 'semester')::smallint, r ->> 'academic_year', 'VERIFIED', auth.uid(), now()) returning id into sem_id;
    elsif sem_status = 'FINALIZED' then
      raise exception 'Semester % for % is finalized; use a correction instead', r ->> 'semester', r ->> 'usn' using errcode = 'P0001';
    else
      update public.academic_semesters set status = 'VERIFIED', verified_by = auth.uid(), verified_at = now(),
        academic_year = coalesce(r ->> 'academic_year', academic_year) where id = sem_id;
    end if;
    select id into existing from public.student_subject_results where academic_semester_id = sem_id and subject_id = subj.id;
    if existing is not null and not p_update then
      skip := skip + 1;
      continue;
    end if;
    insert into public.student_subject_results (academic_semester_id, subject_id, mse_marks, mse_max, see_marks, see_max, grade, grade_points, result)
    values (sem_id, subj.id, (r ->> 'mse_marks')::numeric, subj.mse_max, (r ->> 'see_marks')::numeric, subj.see_max,
            nullif(r ->> 'grade', ''), (r ->> 'grade_points')::numeric, coalesce(nullif(r ->> 'result', '')::public.subject_result, 'PENDING'))
    on conflict (academic_semester_id, subject_id) do update set
      mse_marks = excluded.mse_marks, see_marks = excluded.see_marks, grade = excluded.grade,
      grade_points = excluded.grade_points, result = excluded.result;
    if existing is null then ins := ins + 1; else upd := upd + 1; end if;
    if not sid = any (touched) then touched := touched || sid; end if;
  end loop;
  perform set_config('app.rpc', '', true);
  return jsonb_build_object('inserted', ins, 'updated', upd, 'skipped', skip, 'students', to_jsonb(touched));
end $$;

-- Summaries for semesters written by the import (computed by the app's grading engine).
create or replace function public.set_semester_summaries(p_summaries jsonb)
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare k text; sm jsonb; n int := 0;
begin
  if not app.is_hod() then raise exception 'HOD only' using errcode = '42501'; end if;
  for k, sm in select * from jsonb_each(p_summaries) loop
    insert into public.semester_summaries (academic_semester_id, sgpa, cgpa_snapshot, credits_registered, credits_earned, computed, computation_note)
    values (k::uuid, (sm ->> 'sgpa')::numeric, (sm ->> 'cgpa_snapshot')::numeric, (sm ->> 'credits_registered')::numeric,
            (sm ->> 'credits_earned')::numeric, coalesce((sm ->> 'computed')::boolean, false), sm ->> 'computation_note')
    on conflict (academic_semester_id) do update set sgpa = excluded.sgpa, cgpa_snapshot = excluded.cgpa_snapshot,
      credits_registered = excluded.credits_registered, credits_earned = excluded.credits_earned,
      computed = excluded.computed, computation_note = excluded.computation_note, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
