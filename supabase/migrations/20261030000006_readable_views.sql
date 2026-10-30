-- Readable views for the Supabase dashboard: the same data with names next to the ids.
-- They live in their own schema, which the Data API doesn't expose, and app roles get no access,
-- so they're for admins browsing the Table Editor / SQL Editor only. Nothing is stored twice:
-- each view reads the real tables, so names are always current.

create schema if not exists readable;
revoke all on schema readable from public, anon, authenticated;

create or replace view readable.students as
select sp.user_id as student_id,
       sp.full_name as student_name,
       sp.usn,
       u.email,
       u.status,
       sp.current_semester,
       sp.section,
       sp.program,
       mp.full_name as mentor_name,
       sp.profile_completion
from public.student_profiles sp
join public.users u on u.id = sp.user_id
left join public.mentor_assignments a on a.student_id = sp.user_id and a.ended_at is null
left join public.mentor_profiles mp on mp.user_id = a.mentor_id;

create or replace view readable.mentors as
select mp.user_id as mentor_id,
       mp.full_name as mentor_name,
       u.email,
       u.status,
       mp.designation,
       mp.faculty_id,
       mp.capacity,
       (select count(*) from public.mentor_assignments a where a.mentor_id = mp.user_id and a.ended_at is null) as active_mentees
from public.mentor_profiles mp
join public.users u on u.id = mp.user_id
where u.role = 'MENTOR';

create or replace view readable.semesters as
select s.id as semester_id,
       sp.full_name as student_name,
       sp.usn,
       s.semester_no,
       s.academic_year,
       s.status,
       ss.sgpa,
       ss.cgpa_snapshot as cgpa,
       ss.credits_earned,
       vp.full_name as verified_by_name,
       s.verified_at,
       s.updated_at,
       s.student_id
from public.academic_semesters s
join public.student_profiles sp on sp.user_id = s.student_id
left join public.semester_summaries ss on ss.academic_semester_id = s.id
left join public.mentor_profiles vp on vp.user_id = s.verified_by;

create or replace view readable.marks as
select sp.full_name as student_name,
       sp.usn,
       s.semester_no,
       s.status as semester_status,
       sub.code as subject_code,
       sub.name as subject_name,
       sub.credits,
       r.mse_marks, r.mse_max,
       r.see_marks, r.see_max,
       r.grade, r.grade_points, r.result,
       r.updated_at,
       r.id as result_id,
       r.academic_semester_id,
       r.subject_id,
       s.student_id
from public.student_subject_results r
join public.academic_semesters s on s.id = r.academic_semester_id
join public.student_profiles sp on sp.user_id = s.student_id
join public.subjects sub on sub.id = r.subject_id;

create or replace view readable.assignments as
select mp.full_name as mentor_name,
       sp.full_name as student_name,
       sp.usn,
       a.started_at,
       a.ended_at,
       a.ended_at is null as is_current,
       a.reason,
       a.mentor_id,
       a.student_id
from public.mentor_assignments a
join public.mentor_profiles mp on mp.user_id = a.mentor_id
join public.student_profiles sp on sp.user_id = a.student_id;

revoke all on all tables in schema readable from public, anon, authenticated;
