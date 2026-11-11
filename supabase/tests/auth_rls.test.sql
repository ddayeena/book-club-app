-- Run only on a disposable local Supabase database after both migrations.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

insert into auth.users(id, email, raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001', 'rls-a@example.test', '{"name":"Читач A","role":"admin","is_blocked":false}'),
 ('10000000-0000-4000-8000-000000000002', 'rls-b@example.test', '{"name":"Читач B"}');

select is((select count(*)::integer from public.profiles where id in
 ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')), 2, 'trigger creates profiles');
select is((select role from public.user_access where user_id = '10000000-0000-4000-8000-000000000001'), 'user', 'metadata cannot assign admin');
select ok(not (select reminders_enabled from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 'reminders default off');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.user_access'::regclass), 'access RLS enabled');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from public.profiles), 1, 'cannot read other profiles');
select is((select count(*)::integer from public.user_access), 1, 'cannot read other access records');
select lives_ok($$update public.profiles set name = 'Нове ім’я', reminders_enabled = true where id = '10000000-0000-4000-8000-000000000001'$$, 'can update own allowed fields');
select throws_ok($$update public.user_access set role = 'admin' where user_id = '10000000-0000-4000-8000-000000000001'$$, '42501', null, 'cannot elevate role');
select throws_ok($$update public.profiles set created_at = now()$$, '42501', null, 'cannot change protected columns');
select throws_ok($$insert into public.profiles(id, name) values ('10000000-0000-4000-8000-000000000003', 'Підміна')$$, '42501', null, 'cannot insert own identity');

reset role;
update public.user_access set is_blocked = true where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select results_eq($$update public.profiles set name = 'Заблокований' where id = '10000000-0000-4000-8000-000000000001' returning id$$,
 $$select null::uuid where false$$, 'blocked user cannot update profile');
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'guest cannot read private profiles');

reset role;
select * from finish();
rollback;
