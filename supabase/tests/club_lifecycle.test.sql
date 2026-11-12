-- Disposable local/test Supabase only. All fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and p.proname in
 ('create_club','update_club','submit_join_request','update_join_request','cancel_join_request',
 'review_join_request','remove_club_member','archive_club','list_clubs','list_club_members')),0,
 'API RPCs never run as SECURITY DEFINER');
select ok(not has_function_privilege('authenticated','private.lock_club(uuid,boolean)','EXECUTE'),
 'raw locking helper cannot be called by authenticated');
select ok(not has_function_privilege('anon','private.require_actor()','EXECUTE'),
 'guest cannot call actor helper');
select ok(not has_function_privilege('anon','private.review_join_request(uuid,text,text)','EXECUTE'),
 'guest cannot call private review implementation');
select ok(not has_function_privilege('anon','public.review_join_request(uuid,text,text)','EXECUTE'),
 'guest cannot call review wrapper');
select ok(has_function_privilege('anon','public.list_clubs()','EXECUTE'),
 'guest retains public catalog API');
insert into auth.users(id,email,raw_user_meta_data) values
 ('20000000-0000-4000-8000-000000000001','owner@stage2.test','{"name":"Власник"}'),
 ('20000000-0000-4000-8000-000000000002','reader@stage2.test','{"name":"Читач"}'),
 ('20000000-0000-4000-8000-000000000003','admin@stage2.test','{"name":"Адмін"}');
create temp table ctx(label text primary key,id uuid);
create temp table inputs(club jsonb,request jsonb);
insert into inputs values(
 '{"name":"Клуб тестів","genre":"Поезія","description":"Читаємо разом і обговорюємо книги.","format":"online","language":"Українська","meetings_per_month":2,"next_meeting":"2027-01-01","owner_id":"20000000-0000-4000-8000-000000000002"}',
 '{"motivation":"Хочу читати книги разом із клубом.","weekly_hours":2,"wants_reminders":false,"experience":"regular","participation_format":"any","contact_email":""}');
grant all on ctx,inputs to authenticated,anon;
-- Migration 009 closes the legacy schedule writer; retain compatibility with earlier fixtures.
update inputs set club=club-'next_meeting' where to_regclass('public.club_meetings') is not null;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into ctx select 'club',(public.create_club((select club from inputs))).id;
select is((select owner_id from public.clubs where id=(select id from ctx where label='club')),
 '20000000-0000-4000-8000-000000000001'::uuid,'owner comes from Auth, not input');
select is((select count(*)::integer from public.club_members where club_id=(select id from ctx where label='club')),1,'owner membership atomic');
select lives_ok($$select public.create_club((select club from inputs))$$,'one owner may create multiple clubs');
insert into ctx select 'undated',(public.create_club((select club - 'next_meeting' from inputs))).id;
select ok((select next_meeting is null from public.clubs where id=(select id from ctx where label='undated')),
 'date can be omitted on create');
select lives_ok($$select public.update_club((select id from ctx where label='undated'),(select club || '{"next_meeting":""}'::jsonb from inputs))$$,
 'empty date on update becomes NULL');
select throws_ok($$select public.update_club((select id from ctx where label='undated'),(select club || '{"next_meeting":"infinity"}'::jsonb from inputs))$$,
 case when to_regclass('public.club_meetings') is null then '23514' else '55000' end,null,'legacy or infinite dates are forbidden');
update inputs set request=request || jsonb_build_object('club_id',(select id from ctx where label='club'));
select throws_ok($$select public.remove_club_member((select id from ctx where label='club'),auth.uid())$$,'42501',null,'owner cannot leave');
select throws_ok($$update public.clubs set owner_id='20000000-0000-4000-8000-000000000002'$$,'42501',null,'no direct owner change');
select throws_ok($$delete from public.clubs$$,'42501',null,'no physical deletion');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.club_members),0,'outsider cannot read roster');
select throws_ok($$select public.list_club_members((select id from ctx where label='club'))$$,'42501',null,'safe roster projection also checks access');
select throws_ok($$insert into public.club_members(club_id,user_id) select id,auth.uid() from ctx where label='club'$$,'42501',null,'cannot grant self membership');
select throws_ok($$select public.update_club((select id from ctx where label='club'),(select club from inputs))$$,'42501',null,'outsider cannot edit club');
insert into ctx select 'r1',(public.submit_join_request((select request from inputs))).id;
select throws_ok($$select public.submit_join_request((select request from inputs))$$,'23505',null,'duplicate pending request rejected');
select lives_ok($$select public.update_join_request((select id from ctx where label='r1'),(select request || '{"status":"approved","applicant_id":"20000000-0000-4000-8000-000000000001"}'::jsonb from inputs))$$,'own pending form editable');
select is((select status from public.join_requests where id=(select id from ctx where label='r1')),'pending','payload cannot approve request');
select throws_ok($$update public.join_requests set status='approved' where id=(select id from ctx where label='r1')$$,
 '42501',null,'client cannot update protected request status');
select lives_ok($$select public.cancel_join_request((select id from ctx where label='r1'))$$,'can cancel pending request');
select is((select status from public.join_requests where id=(select id from ctx where label='r1')),'cancelled','cancel preserves history');
insert into ctx select 'r2',(public.submit_join_request((select request from inputs))).id;
select throws_ok($$select public.review_join_request((select id from ctx where label='r2'),'approved')$$,'42501',null,'applicant cannot approve self');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.review_join_request((select id from ctx where label='r2'),'approved')$$,'42501',null,'unrelated user cannot review');
select is((select count(*)::integer from public.join_requests),0,'unrelated user cannot read applications');
select throws_ok($$select public.update_join_request((select id from ctx where label='r2'),(select request from inputs))$$,
 '42501',null,'stranger cannot edit private application through RPC');
select throws_ok($$select public.cancel_join_request((select id from ctx where label='r2'))$$,
 '42501',null,'stranger cannot cancel private application through RPC');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from public.notifications where type='new_request' and club_id=(select id from ctx where label='club')),2,'owner gets new-request notifications');
select lives_ok($$select public.review_join_request((select id from ctx where label='r2'),'rejected','Спробуйте ще раз')$$,'owner can reject');
select throws_ok($$select public.review_join_request((select id from ctx where label='r2'),'approved')$$,'55000',null,'decision cannot be repeated');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.notifications where request_id=(select id from ctx where label='r2')),1,'applicant gets decision');
select throws_ok($$update public.notifications set body='Підміна'$$,'42501',null,'notification body immutable');
select lives_ok($$update public.notifications set read_at=now()$$,'recipient can mark read');
select throws_ok($$select public.update_join_request((select id from ctx where label='r2'),(select request from inputs))$$,'42501',null,'reviewed form immutable');
insert into ctx select 'r3',(public.submit_join_request((select request from inputs))).id;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.review_join_request((select id from ctx where label='r3'),'approved')$$,'owner approves');
select is((select count(*)::integer from public.club_members where club_id=(select id from ctx where label='club')),2,'approval creates one membership');
select throws_ok($$select public.review_join_request((select id from ctx where label='r3'),'approved')$$,'55000',null,'duplicate approval cannot create membership or notice');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.list_club_members((select id from ctx where label='club'))),2,'member can read minimal roster');
select throws_ok($$select public.submit_join_request((select request from inputs))$$,'23505',null,'member cannot apply');
select lives_ok($$select public.remove_club_member((select id from ctx where label='club'),auth.uid())$$,'member can leave');
insert into ctx select 'r4',(public.submit_join_request((select request from inputs))).id;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.review_join_request((select id from ctx where label='r4'),'approved');
select lives_ok($$select public.remove_club_member((select id from ctx where label='club'),'20000000-0000-4000-8000-000000000002')$$,'owner can exclude member');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into ctx select 'r5',(public.submit_join_request((select request from inputs))).id;
reset role;
update public.user_access set role='admin' where user_id='20000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.update_club((select id from ctx where label='club'),(select club from inputs))$$,'admin can moderate club');
select lives_ok($$select public.archive_club((select id from ctx where label='club'))$$,'admin can archive');
select is((select status from public.join_requests where id=(select id from ctx where label='r5')),'rejected','archive resolves pending requests');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok(exists(select 1 from public.clubs where id=(select id from ctx where label='club')),
 'owner retains archived club access');
select is((select count(*)::integer from public.join_requests where club_id=(select id from ctx where label='club')),5,
 'owner retains incoming application history after archive');
select throws_ok($$select public.update_club((select id from ctx where label='club'),(select club from inputs))$$,'55000',null,'archived club cannot be edited');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.submit_join_request((select request from inputs))$$,'55000',null,'archived club rejects applications');
select ok(exists(select 1 from public.notifications where request_id=(select id from ctx where label='r5')),'archive notifies applicant');
select is((select count(*)::integer from public.join_requests where club_id=(select id from ctx where label='club')),5,
 'applicant retains full own archived application history');
select ok(exists(select 1 from public.list_clubs() c where c->>'id'=(select id::text from ctx where label='club')),
 'applicant can read archived club metadata for own history');
select throws_ok($$select public.list_club_members((select id from ctx where label='club'))$$,
 '42501',null,'former applicant cannot read archived roster');
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
 ('20000000-0000-4000-8000-000000000004','stranger@stage2.test','{"name":"Сторонній"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::integer from public.clubs where id=(select id from ctx where label='club')),0,
 'unrelated user cannot read archived club via table');
select is((select count(*)::integer from public.list_clubs() c where c->>'id'=(select id::text from ctx where label='club')),0,
 'unrelated user cannot read archived club via RPC');
select is((select count(*)::integer from public.join_requests where club_id=(select id from ctx where label='club')),0,
 'unrelated user cannot read archived application history');
select is((select count(*)::integer from public.notifications),0,'unrelated user cannot read notifications');
reset role;
update public.user_access set is_blocked=true where user_id='20000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.create_club((select club from inputs))$$,'42501',null,'blocked admin cannot mutate');
set local role anon;
select is((select count(*)::integer from public.list_clubs() c where c->>'id'=(select id::text from ctx where label='club')),0,'guest cannot see archive via RPC');
select throws_ok($$select * from public.join_requests$$,'42501',null,'guest cannot read applications');
select throws_ok($$select public.create_club((select club from inputs))$$,'42501',null,'guest cannot call lifecycle RPC');
reset role;
select * from finish();
rollback;
