-- Private storage buckets with policies that mirror table RLS, plus realtime for notifications.
-- Path conventions:
--   avatars/<user_id>/<file>
--   resources/<mentor_id>/<uuid>-<file>
--   ask-attachments/<student_id>/<thread_id>/<uuid>-<file>

create or replace function app.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function app.path_owner(p_name text) returns uuid
language sql immutable as $$ select app.try_uuid(split_part(p_name, '/', 1)) $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('resources', 'resources', false, 26214400, array[
    'application/pdf', 'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'image/png', 'image/jpeg']),
  ('ask-attachments', 'ask-attachments', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- avatars
create policy avatars_read on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (
    app.path_owner(name) = auth.uid() or app.is_hod() or app.is_active_mentor_of(app.path_owner(name))
    or app.path_owner(name) = app.active_mentor_of(auth.uid())
  )
);
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and app.path_owner(name) = auth.uid());
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and app.path_owner(name) = auth.uid());
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and app.path_owner(name) = auth.uid());

-- resources: the uploading mentor, the HOD, and students the resource row targets
create policy resources_read on storage.objects for select to authenticated using (
  bucket_id = 'resources' and (
    app.path_owner(name) = auth.uid() or app.is_hod()
    or exists (select 1 from public.learning_resources r where r.file_path = storage.objects.name and (
      r.student_id = auth.uid() or (r.student_id is null and r.mentor_id = app.active_mentor_of(auth.uid()))))
  )
);
create policy resources_write on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and app.path_owner(name) = auth.uid() and app.user_role() = 'MENTOR');
create policy resources_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and app.path_owner(name) = auth.uid());

-- ask attachments: the student and their CURRENT mentor
create policy ask_files_read on storage.objects for select to authenticated using (
  bucket_id = 'ask-attachments' and (app.path_owner(name) = auth.uid() or app.is_active_mentor_of(app.path_owner(name)))
);
create policy ask_files_write on storage.objects for insert to authenticated with check (
  bucket_id = 'ask-attachments' and (app.path_owner(name) = auth.uid() or app.is_active_mentor_of(app.path_owner(name)))
);

-- realtime for the notification bell
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
