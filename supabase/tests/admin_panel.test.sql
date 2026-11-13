-- Disposable Supabase with migrations 001–007 only. Fixtures and trusted setup roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select is(pg_catalog.pg_get_function_result('private.require_actor()'::regprocedure),'uuid',
 'require_actor returns the UUID expected by require_admin');
select ok(has_schema_privilege('authenticated','private','USAGE'),'invoker wrapper resolves private implementation');
select ok(not has_function_privilege('authenticated','private.require_admin()','EXECUTE'),'raw admin helper closed');
select ok(not has_function_privilege('anon','public.admin_get_stats()','EXECUTE'),'guest wrapper closed');
select ok(not has_function_privilege('anon','private.admin_get_stats()','EXECUTE'),'guest implementation closed');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and p.proname in ('admin_get_stats','admin_list_users','admin_set_user_blocked','admin_list_clubs')),0,'public RPCs use invoker');
insert into auth.users(id,email,raw_user_meta_data) values
 ('50000000-0000-4000-8000-000000000001','admin-a@example.test','{"name":"Admin fixture Alpha"}'),
 ('50000000-0000-4000-8000-000000000002','admin-b@example.test','{"name":"Admin fixture Beta"}'),
 ('50000000-0000-4000-8000-000000000003','admin-u@example.test','{"name":"Admin fixture Reader"}');
update public.user_access set role='admin' where user_id in ('50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002');
create temp table admin_ctx(label text primary key,id uuid);
grant all on admin_ctx to authenticated,anon;
set local role anon;
select throws_ok($$select public.admin_get_stats()$$,'42501',null,'guest stats denied');
select throws_ok($$select public.admin_list_users()$$,'42501',null,'guest user listing denied');
select throws_ok($$select public.admin_list_clubs()$$,'42501',null,'guest clubs listing denied');
select throws_ok($$select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000003',true)$$,'42501',null,'guest writes denied');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.admin_get_stats()$$,'42501',null,'ordinary user cannot get admin stats');
select throws_ok($$select public.admin_list_users()$$,'42501',null,'ordinary user cannot list users');
select throws_ok($$select public.admin_list_clubs()$$,'42501',null,'ordinary user cannot list admin clubs');
select throws_ok($$select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000001',true)$$,'42501',null,'ordinary user cannot block admin');
insert into admin_ctx select 'club',(public.create_club('{"name":"Admin fixture club","genre":"Проза","description":"Читаємо разом і обговорюємо книги.","format":"online","language":"Українська","meetings_per_month":2}')).id;
insert into admin_ctx select 'one',(public.save_club_book((select id from admin_ctx where label='club'),'{"title":"First","author":"Author"}')).id;
insert into admin_ctx select 'two',(public.save_club_book((select id from admin_ctx where label='club'),'{"title":"Second","author":"Author"}')).id;
insert into admin_ctx select 'poll',(public.create_book_poll((select id from admin_ctx where label='club'),'Archive fixture',clock_timestamp()+interval '1 hour',array(select id from admin_ctx where label in ('one','two')))).id;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into admin_ctx select 'request',(public.submit_join_request(jsonb_build_object('club_id',(select id from admin_ctx where label='club'),
 'motivation','Хочу читати разом з усіма.','weekly_hours',2,'wants_reminders',false,'experience','regular','participation_format','any','contact_email',''))).id;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.admin_get_stats()$$,'admin stats allowed');
select is((select count(*)::integer from public.profiles),1,'admin still reads only own raw profile');
select is((select count(*)::integer from public.user_access),1,'admin still reads only own raw access row');
select throws_ok($$update public.user_access set role='admin'$$,'42501',null,'admin cannot directly change roles');
select throws_ok($$update public.user_access set is_blocked=true$$,'42501',null,'admin cannot directly change block state');
select is((public.admin_list_users('Admin fixture')->>'total')::integer,3,'search returns fixture profiles only');
select is((public.admin_list_users('Admin fixture','admin')->>'total')::integer,2,'role filter');
select is((public.admin_list_users('Admin fixture','user')->>'total')::integer,1,'ordinary role filter');
select is(jsonb_array_length(public.admin_list_users('Admin fixture','all','all',1,1)->'items'),1,'server page size');
select isnt((public.admin_list_users('Admin fixture','all','all',1,1)->'items'->0->>'id'),
 (public.admin_list_users('Admin fixture','all','all',2,1)->'items'->0->>'id'),'stable pages contain different records');
select is(jsonb_array_length(public.admin_list_users('Admin fixture','all','all',99,20)->'items'),0,'out of range page stays empty');
select is((public.admin_list_users('Admin fixture %')->>'total')::integer,0,'wildcard treated literally');
select ok(not exists(select 1 from jsonb_array_elements(public.admin_list_users('Admin fixture')->'items') r
 where r ?| array['email','password','encrypted_password','access_token','reminders_enabled','raw_user_meta_data']),'projection has no confidential fields');
select throws_ok($$select public.admin_list_users('','all','all',0,20)$$,'22023',null,'invalid page rejected');
select throws_ok($$select public.admin_list_users('','all','all',1,51)$$,'22023',null,'oversized page rejected');
select throws_ok($$select public.admin_list_users('','superadmin')$$,'22023',null,'invalid role rejected');
select throws_ok($$select public.admin_list_clubs('','invalid')$$,'22023',null,'invalid club state rejected');
select throws_ok($$select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000001',true)$$,'42501',null,'self blocking forbidden');
select throws_ok($$select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000099',true)$$,'P0002',null,'missing user rejected');
select throws_ok($$select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000003',null)$$,'22023',null,'null block state rejected');
select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000003',true);
select is((public.admin_list_users('Admin fixture','all','blocked')->>'total')::integer,1,'blocked filter reflects mutation');
select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000003',false);
select is((public.admin_list_users('Admin fixture','all','active')->>'total')::integer,3,'unblock preserves role and account');
select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.admin_get_stats()$$,'42501',null,'blocked admin stats denied');
select throws_ok($$select public.admin_list_users()$$,'42501',null,'blocked admin user listing denied');
select throws_ok($$select public.admin_list_clubs()$$,'42501',null,'blocked admin clubs denied');
select throws_ok($$select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000001',true)$$,'42501',null,'blocked admin cannot block last actor');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
-- Verify the last-active-admin INVARIANT, not independent coverage of the 55000 branch.
-- A permitted caller is itself an active admin. If the target is a different active
-- admin, there are at least two; if only one remains, the target is the caller and
-- the earlier self-block check rejects it. Do not mock authorization to force that branch.
-- Make Alpha the last active admin in this disposable transaction, including any pre-existing fixtures.
reset role;
update public.user_access set is_blocked=true where role='admin' and user_id<>'50000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000001',true)$$,'42501',null,'last active admin remains protected by self-block rule');
reset role;
select is((select count(*) from public.user_access where role='admin' and not is_blocked),1::bigint,
 'failed self-block preserves exactly one active admin');
select ok(not (select is_blocked from public.user_access where user_id='50000000-0000-4000-8000-000000000001'),
 'last admin remains unblocked');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000001',true)$$,'42501',null,
 'blocked second admin cannot disable the sole active admin');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.admin_set_user_blocked('50000000-0000-4000-8000-000000000002',false);
select is((public.admin_list_users('Admin fixture','admin','active')->>'total')::integer,2,'last admin can restore another admin');
select is((public.admin_list_clubs('Admin fixture club','active')->>'total')::integer,1,'active club listing');
select public.archive_club((select id from admin_ctx where label='club'));
select is((public.admin_list_clubs('Admin fixture club','archived')->>'total')::integer,1,'admin archives another owner club');
select is((select status from public.join_requests where id=(select id from admin_ctx where label='request')),'rejected','archive rejects pending requests');
select is((public.get_book_poll((select id from admin_ctx where label='poll'))->>'cancel_reason'),'club_archived','archive cancels unresolved poll');
select lives_ok($$select public.archive_club((select id from admin_ctx where label='club'))$$,'archive remains idempotent');
reset role;
select is((select count(*) from public.profiles),(public.admin_get_stats()->>'users')::bigint,'stats count profiles correctly');
-- Above admin_get_stats still derives identity from the authenticated JWT, not SQL role.
select ok(exists(select 1 from public.notifications where request_id=(select id from admin_ctx where label='request') and type='request_decision'),'archive notification retained');
select * from finish();
rollback;
