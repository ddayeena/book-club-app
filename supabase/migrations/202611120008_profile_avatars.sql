begin;
-- Managed Storage must retain RLS; fail closed if the installation differs.
do $$
begin
 if not exists(select 1 from pg_catalog.pg_class where oid='storage.objects'::regclass and relrowsecurity)
 or not exists(select 1 from pg_catalog.pg_class where oid='storage.buckets'::regclass and relrowsecurity) then
   raise exception 'Storage RLS must be enabled before installing avatars';
 end if;
end; $$;
-- Fail rather than silently changing an existing bucket or its data.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',false,1048576,array['image/jpeg','image/png','image/webp']);

-- Keep unrelated permissive bucket policies from weakening these settings.
create policy avatars_bucket_config_guard on storage.buckets as restrictive for update to anon,authenticated
 using(id<>'avatars') with check(id<>'avatars');
create policy avatars_bucket_delete_guard on storage.buckets as restrictive for delete to anon,authenticated
 using(id<>'avatars');

create function private.owns_avatar(p_name text,p_owner text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active_user() and p_owner=auth.uid()::text
 and p_name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$');
$$;
create function private.can_delete_avatar(p_name text,p_owner text) returns boolean
language plpgsql security definer set search_path='' as $$
declare actor uuid; current_path text;
begin
 if not private.owns_avatar(p_name,p_owner) then return false; end if;
 actor := private.require_actor();
 -- Storage may already hold the object lock before evaluating DELETE policies.
 -- Never wait on a busy profile (which may itself be waiting to attach this object).
 begin
   select avatar_path into current_path from public.profiles where id=actor for update nowait;
 exception when lock_not_available then return false;
 end;
 return found and current_path is distinct from p_name;
end; $$;
revoke all on function private.owns_avatar(text,text),private.can_delete_avatar(text,text) from public,anon,authenticated;
grant execute on function private.owns_avatar(text,text),private.can_delete_avatar(text,text) to authenticated;

-- Restrictive guards prevent unrelated permissive policies from exposing this bucket.
create policy avatars_guard on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'avatars' or private.owns_avatar(name,owner_id))
 with check(bucket_id<>'avatars' or private.owns_avatar(name,owner_id));
create policy avatars_anon_guard on storage.objects as restrictive for all to anon
 using(bucket_id<>'avatars') with check(bucket_id<>'avatars');
create policy avatars_read on storage.objects for select to authenticated
 using(bucket_id='avatars' and private.owns_avatar(name,owner_id));
create policy avatars_upload on storage.objects for insert to authenticated
 with check(bucket_id='avatars' and private.owns_avatar(name,owner_id));
-- Replacement uploads a new UUID path. In-place mutation/renaming is intentionally denied.
create policy avatars_immutable on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'avatars') with check(bucket_id<>'avatars');
create policy avatars_delete_guard on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'avatars' or private.can_delete_avatar(name,owner_id));
create policy avatars_delete on storage.objects for delete to authenticated
 using(bucket_id='avatars' and private.owns_avatar(name,owner_id));

create function private.validate_profile_avatar() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if tg_op='UPDATE' and new.avatar_path is not distinct from old.avatar_path then return new; end if;
 if new.avatar_path is null then return new; end if;
 actor := private.require_actor();
 if new.id is distinct from actor or not private.owns_avatar(new.avatar_path,actor::text) then
 raise exception 'Некоректний власник аватара' using errcode='23514'; end if;
 perform 1 from storage.objects where bucket_id='avatars' and name=new.avatar_path and owner_id=actor::text
 and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
 and (metadata->>'size')::bigint between 1 and 1048576 for share;
 if not found then raise exception 'Аватар не завантажено або формат некоректний' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function private.validate_profile_avatar() from public,anon,authenticated;
create trigger profiles_validate_avatar before insert or update of avatar_path on public.profiles
 for each row execute function private.validate_profile_avatar();
-- Existing legacy paths are not rewritten; unchanged paths remain valid for name/reminder edits.
notify pgrst, 'reload schema';
commit;
