-- Disposable Supabase only, migrations 001–008. Metadata fixtures are NOT actual file uploads.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok((select relrowsecurity from pg_class where oid='storage.objects'::regclass),'Storage objects RLS enabled');
select ok((select relrowsecurity from pg_class where oid='storage.buckets'::regclass),'Storage buckets RLS enabled');
select ok(not (select public from storage.buckets where id='avatars'),'avatars bucket is private');
select is((select file_size_limit from storage.buckets where id='avatars'),1048576::bigint,'Storage API enforces 1 MB limit');
select is((select allowed_mime_types from storage.buckets where id='avatars'),array['image/jpeg','image/png','image/webp'],'Storage API accepts only agreed MIME types');
select ok(not has_function_privilege('authenticated','private.validate_profile_avatar()','EXECUTE'),'trigger implementation closed');
insert into auth.users(id,email,raw_user_meta_data) values
 ('60000000-0000-4000-8000-000000000001','profile-a@example.test','{"name":"Avatar Alpha"}'),
 ('60000000-0000-4000-8000-000000000002','profile-b@example.test','{"name":"Avatar Beta"}');
create temp table avatar_ctx(label text primary key,path text);
insert into avatar_ctx values
 ('old','60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000001.png'),
 ('new','60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000002.png'),
 ('foreign','60000000-0000-4000-8000-000000000002/70000000-0000-4000-8000-000000000003.png'),
 ('invalid','60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000004.png'),
 ('invalid_mime','60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000005.png'),
 ('forged_owner','60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000006.png');
grant select on avatar_ctx to authenticated,anon;
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'avatars',path,split_part(path,'/',1),'{"mimetype":"image/png","size":128}'::jsonb from avatar_ctx where label in ('old','new','foreign');
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'avatars',path,split_part(path,'/',1),'{"mimetype":"image/png","size":1048577}'::jsonb from avatar_ctx where label='invalid';
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'avatars',path,split_part(path,'/',1),'{"mimetype":"image/svg+xml","size":128}'::jsonb from avatar_ctx where label='invalid_mime';
insert into storage.objects(bucket_id,name,owner_id,metadata)
 select 'avatars',path,'60000000-0000-4000-8000-000000000002','{"mimetype":"image/png","size":128}'::jsonb from avatar_ctx where label='forged_owner';
-- Deliberately broad fixture policies must not override the restrictive guards.
create policy avatar_test_bucket_update on storage.buckets for update to authenticated using(true) with check(true);
create policy avatar_test_bucket_delete on storage.buckets for delete to authenticated using(true);
create policy avatar_test_bucket_read on storage.buckets for select to authenticated using(true);
-- Some Storage versions guard metadata deletes. This test-only GUC does not bypass RLS.
select set_config('storage.allow_delete_query','true',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$update public.profiles set name='Нове ім’я',reminders_enabled=true where id=auth.uid()$$,'can update own editable fields');
select throws_ok($$update public.profiles set created_at=now()$$,'42501',null,'registration date protected');
select throws_ok($$update public.user_access set role='admin'$$,'42501',null,'profile form cannot elevate role');
select results_eq($$update public.profiles set name='Підміна' where id='60000000-0000-4000-8000-000000000002' returning id$$,array[]::uuid[],'cannot edit another profile');
select is((select count(*)::integer from storage.objects where bucket_id='avatars'),4,'only own objects readable');
select results_eq($$update storage.buckets set public=true where id='avatars' returning id$$,array[]::text[],'cannot make avatar bucket public even with permissive policy');
select results_eq($$delete from storage.buckets where id='avatars' returning id$$,array[]::text[],'cannot remove avatar bucket even with permissive policy');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) values('avatars','60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000007.png',auth.uid()::text,'{"mimetype":"image/png","size":128}')$$,'own new object insert allowed');
select results_eq($$delete from storage.objects where bucket_id='avatars' and name='60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000007.png' returning name$$,
 array['60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000007.png']::text[],'unattached upload can be cleaned');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('avatars','60000000-0000-4000-8000-000000000002/70000000-0000-4000-8000-000000000099.png',auth.uid()::text)$$,'42501',null,'cannot upload to another user folder');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('avatars','60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000099.png','60000000-0000-4000-8000-000000000002')$$,'42501',null,'cannot forge object owner');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('avatars','60000000-0000-4000-8000-000000000001/../forged.png',auth.uid()::text)$$,'42501',null,'path traversal rejected');
select lives_ok($$update public.profiles set avatar_path=(select path from avatar_ctx where label='old') where id=auth.uid()$$,'own uploaded object can be attached');
select throws_ok($$update public.profiles set avatar_path=(select path from avatar_ctx where label='foreign') where id=auth.uid()$$,'23514',null,'cannot bind another user avatar');
select throws_ok($$update public.profiles set avatar_path='https://example.test/private?token=fake' where id=auth.uid()$$,'23514',null,'URL cannot be stored as avatar path');
select throws_ok($$update public.profiles set avatar_path='60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000099.png' where id=auth.uid()$$,'23514',null,'missing file cannot be attached');
select throws_ok($$update public.profiles set avatar_path=(select path from avatar_ctx where label='invalid') where id=auth.uid()$$,'23514',null,'oversized object cannot be attached');
select throws_ok($$update public.profiles set avatar_path=(select path from avatar_ctx where label='invalid_mime') where id=auth.uid()$$,'23514',null,'unsafe MIME cannot be attached');
select throws_ok($$update public.profiles set avatar_path=(select path from avatar_ctx where label='forged_owner') where id=auth.uid()$$,'23514',null,'own folder does not bypass stored object owner check');
select results_eq($$delete from storage.objects where bucket_id='avatars' and name=(select path from avatar_ctx where label='old') returning name$$,array[]::text[],'current photo cannot be deleted before detaching');
select results_eq($$update storage.objects set metadata='{}' where bucket_id='avatars' returning name$$,array[]::text[],'in-place mutation forbidden; replacement uses a new UUID');
select lives_ok($$update public.profiles set avatar_path=(select path from avatar_ctx where label='new') where id=auth.uid()$$,'replace reference after new upload');
select results_eq($$delete from storage.objects where bucket_id='avatars' and name=(select path from avatar_ctx where label='old') returning name$$,
 $$select path from avatar_ctx where label='old'$$,'detached old object can be cleaned');
select results_eq($$delete from storage.objects where bucket_id='avatars' and name=(select path from avatar_ctx where label='foreign') returning name$$,array[]::text[],'cannot delete foreign object');
select lives_ok($$update public.profiles set avatar_path=null where id=auth.uid()$$,'photo reference can be removed');
select results_eq($$delete from storage.objects where bucket_id='avatars' and name=(select path from avatar_ctx where label='new') returning name$$,
 $$select path from avatar_ctx where label='new'$$,'photo can be deleted after reference cleared');
reset role;
update public.user_access set is_blocked=true where user_id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*)::integer from storage.objects where bucket_id='avatars'),0,'blocked account cannot read/sign new avatar URLs');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values('avatars','60000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000099.png',auth.uid()::text)$$,'42501',null,'blocked account cannot upload');
select results_eq($$delete from storage.objects where bucket_id='avatars' returning name$$,array[]::text[],'blocked account cannot delete');
select results_eq($$update public.profiles set name='Зміна' where id=auth.uid() returning id$$,array[]::uuid[],'blocked account cannot edit profile');
reset role;
update public.user_access set role='admin',is_blocked=false where user_id='60000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='avatars'),1,'admin does not gain access to other private avatars');
set local role anon;
select is((select count(*)::integer from storage.objects where bucket_id='avatars'),0,'guest cannot read avatars');
reset role;
select * from finish();
rollback;
