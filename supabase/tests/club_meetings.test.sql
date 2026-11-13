-- Disposable Supabase only, migrations 001–009. No real Storage uploads or Cron.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok((select relrowsecurity from pg_class where oid='public.club_meetings'::regclass),'meeting RLS enabled');
select ok(not has_function_privilege('anon','public.get_club_meeting(uuid)','EXECUTE'),'guest read RPC closed');
select ok(not has_function_privilege('authenticated','private.lock_meeting_owner(uuid,timestamptz)','EXECUTE'),'raw owner lock closed');
select ok(not has_function_privilege('authenticated','private.keep_legacy_meeting_date()','EXECUTE'),'legacy guard trigger closed');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and p.proname in
 ('create_club_meeting','update_club_meeting','cancel_club_meeting','list_club_meetings','get_club_meeting')),0,'public meeting RPCs use invoker');
insert into auth.users(id,email,raw_user_meta_data) values
 ('90000000-0000-4000-8000-000000000001','meeting-owner@example.test','{"name":"Власник"}'),
 ('90000000-0000-4000-8000-000000000002','meeting-reader@example.test','{"name":"Читач"}'),
 ('90000000-0000-4000-8000-000000000003','meeting-admin@example.test','{"name":"Адміністратор"}');
update public.user_access set role='admin' where user_id='90000000-0000-4000-8000-000000000003';
create temp table meeting_ctx(label text primary key,id uuid,version timestamptz);
create temp table meeting_input(value jsonb);
insert into meeting_input values(jsonb_build_object('title','Обговорення книги','starts_at',
 clock_timestamp()+interval '2 days','timezone','Europe/Kyiv','format','online',
 'meeting_url','https://example.test/private-room','location',null,'description','Приватний опис'));
grant all on meeting_ctx,meeting_input to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into meeting_ctx(label,id) select 'club',(public.create_club('{"name":"Зустрічі клубу","genre":"Проза","description":"Обговорюємо книги всі разом.","format":"online","language":"Українська","meetings_per_month":2}')).id;
select throws_ok($$select public.create_club('{"next_meeting":"2027-01-01"}')$$,'55000',null,'old client schedule writes rejected explicitly');
select throws_ok($$select public.update_club((select id from meeting_ctx where label='club'),'{"next_meeting":"2027-01-01"}')$$,'55000',null,'legacy schedule cannot be edited');
insert into meeting_ctx select 'meeting',m.id,m.updated_at from public.create_club_meeting(
 (select id from meeting_ctx where label='club'),(select value from meeting_input)) m;
select lives_ok($$select public.get_club_meeting((select id from meeting_ctx where label='meeting'))$$,'owner reads details');
select is((public.list_club_meetings((select id from meeting_ctx where label='club'))->>'total')::integer,1,'upcoming list includes meeting');
select throws_ok($$select public.list_club_meetings((select id from meeting_ctx where label='club'),'invalid')$$,'22023',null,'list filters validated');
select throws_ok($$select public.list_club_meetings((select id from meeting_ctx where label='club'),'upcoming',0)$$,'22023',null,'page validated');
select throws_ok($$insert into public.club_meetings(club_id,title,starts_at,timezone,format,meeting_url)
 select id,'Підміна',now()+interval '1 day','UTC','online','https://example.test' from meeting_ctx where label='club'$$,'42501',null,'direct insert denied');
select throws_ok($$update public.club_meetings set title='Підміна'$$,'42501',null,'direct update denied');
select throws_ok($$delete from public.club_meetings$$,'42501',null,'physical deletion denied');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"meeting_url":null}' from meeting_input))$$,'23514',null,'online requires URL');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"format":"offline","meeting_url":null}' from meeting_input))$$,'23514',null,'offline requires location');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"format":"hybrid"}' from meeting_input))$$,'23514',null,'hybrid requires both location and URL');
select lives_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"format":"offline","location":"Бібліотека","meeting_url":null}' from meeting_input))$$,'offline meeting allowed');
select lives_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"format":"hybrid","location":"Бібліотека"}' from meeting_input))$$,'hybrid meeting allowed');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"meeting_url":"javascript:alert(1)"}' from meeting_input))$$,'23514',null,'unsafe URL rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"meeting_url":"https://:"}' from meeting_input))$$,'23514',null,'empty hostname with port rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||jsonb_build_object('meeting_url','https://example.test/'||chr(92)||'room') from meeting_input))$$,'23514',null,'backslash URL rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"title":" "}' from meeting_input))$$,'23514',null,'blank title rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||jsonb_build_object('title',repeat('a',121)) from meeting_input))$$,'23514',null,'long title rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"format":"invalid"}' from meeting_input))$$,'23514',null,'invalid format rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||jsonb_build_object('description',repeat('a',2001)) from meeting_input))$$,'23514',null,'long description rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"timezone":"Invented/Zone"}' from meeting_input))$$,'22023',null,'unknown timezone rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"starts_at":"2020-01-01T12:00:00Z"}' from meeting_input))$$,'55000',null,'past creation rejected');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),
 (select value||'{"starts_at":"2030-01-01T12:00:00"}' from meeting_input))$$,'22023',null,'timezone-free input rejected');
select lives_ok($$select public.update_club_meeting((select id from meeting_ctx where label='meeting'),
 (select value||'{"title":"Оновлена зустріч","club_id":"90000000-0000-4000-8000-000000000099","cancelled_at":"2020-01-01"}' from meeting_input),
 (select version from meeting_ctx where label='meeting'))$$,'owner edits whitelist fields');
select is((public.get_club_meeting((select id from meeting_ctx where label='meeting'))->>'club_id'),
 (select id::text from meeting_ctx where label='club'),'payload cannot change club');
select ok(public.get_club_meeting((select id from meeting_ctx where label='meeting'))->>'cancelled_at' is null,'payload cannot cancel');
select throws_ok($$select public.update_club_meeting((select id from meeting_ctx where label='meeting'),
 (select value from meeting_input),(select version from meeting_ctx where label='meeting'))$$,'40001',null,'stale edit rejected');
select throws_ok($$select public.cancel_club_meeting((select id from meeting_ctx where label='meeting'),
 (select version from meeting_ctx where label='meeting'))$$,'40001',null,'stale cancellation rejected');
select ok((public.get_club_meeting((select id from meeting_ctx where label='meeting'))->>'updated_at')::timestamptz
 >(select version from meeting_ctx where label='meeting'),'version increases after update');
update meeting_ctx set version=(public.get_club_meeting(id)->>'updated_at')::timestamptz where label='meeting';
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.club_meetings),0,'outsider raw rows hidden');
select throws_ok($$select public.get_club_meeting((select id from meeting_ctx where label='meeting'))$$,'42501',null,'outsider details denied');
select throws_ok($$select public.list_club_meetings((select id from meeting_ctx where label='club'))$$,'42501',null,'outsider list denied');
select ok(not exists(select 1 from public.list_clubs() c where c->>'id'=(select id::text from meeting_ctx where label='club')
 and (c ?| array['meeting_url','location'] or c->>'description'='Приватний опис'
 or c::text like '%private-room%' or c::text like '%Бібліотека%')),'catalog does not expose private meeting fields or contents');
reset role;
insert into public.join_requests(club_id,applicant_id,motivation,weekly_hours,wants_reminders,experience,participation_format)
 select id,'90000000-0000-4000-8000-000000000002','Хочу долучитися до читання.',2,false,'regular','any' from meeting_ctx where label='club';
set local role authenticated;
select throws_ok($$select public.get_club_meeting((select id from meeting_ctx where label='meeting'))$$,'42501',null,'applicant is not a member');
reset role;
insert into public.club_members(club_id,user_id) select id,'90000000-0000-4000-8000-000000000002' from meeting_ctx where label='club';
set local role authenticated;
select is((public.get_club_meeting((select id from meeting_ctx where label='meeting'))->>'meeting_url'),'https://example.test/private-room','member sees complete details');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),(select value from meeting_input))$$,'42501',null,'member cannot create');
select throws_ok($$select public.update_club_meeting((select id from meeting_ctx where label='meeting'),(select value from meeting_input),
 (select version from meeting_ctx where label='meeting'))$$,'42501',null,'member cannot edit');
select throws_ok($$select public.cancel_club_meeting((select id from meeting_ctx where label='meeting'),(select version from meeting_ctx where label='meeting'))$$,'42501',null,'member cannot cancel');
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.get_club_meeting((select id from meeting_ctx where label='meeting'))$$,'admin moderation read allowed');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),(select value from meeting_input))$$,'42501',null,'non-owner admin cannot create');
select throws_ok($$select public.update_club_meeting((select id from meeting_ctx where label='meeting'),(select value from meeting_input),
 (select version from meeting_ctx where label='meeting'))$$,'42501',null,'non-owner admin cannot edit');
select throws_ok($$select public.cancel_club_meeting((select id from meeting_ctx where label='meeting'),(select version from meeting_ctx where label='meeting'))$$,'42501',null,'non-owner admin cannot cancel');
reset role;
-- Simulate a pre-009 date using trusted setup only. Clients cannot disable triggers.
alter table public.clubs disable trigger clubs_legacy_meeting_readonly;
update public.clubs set next_meeting='2020-01-02' where id=(select id from meeting_ctx where label='club');
alter table public.clubs enable trigger clubs_legacy_meeting_readonly;
select throws_ok($$update public.clubs set next_meeting='2020-01-03' where id=(select id from meeting_ctx where label='club')$$,
 '55000',null,'legacy trigger rejects an old in-flight writer even with table privileges');
select lives_ok($$update public.clubs set next_meeting=next_meeting where id=(select id from meeting_ctx where label='club')$$,'unchanged legacy date accepted');
update public.user_access set is_blocked=true where user_id='90000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.get_club_meeting((select id from meeting_ctx where label='meeting'))$$,'42501',null,'blocked owner cannot read full details');
select is((select count(*)::integer from public.club_meetings),0,'blocked raw meeting rows hidden');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),(select value from meeting_input))$$,'42501',null,'blocked owner cannot write');
select throws_ok($$select public.update_club_meeting((select id from meeting_ctx where label='meeting'),(select value from meeting_input),
 (select version from meeting_ctx where label='meeting'))$$,'42501',null,'blocked owner cannot edit');
select throws_ok($$select public.cancel_club_meeting((select id from meeting_ctx where label='meeting'),
 (select version from meeting_ctx where label='meeting'))$$,'42501',null,'blocked owner cannot cancel');
reset role;
update public.user_access set is_blocked=false where user_id='90000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok((select c->>'next_meeting_at' is not null and c->>'legacy_next_meeting'='2020-01-02'
 from public.list_clubs() c where c->>'id'=(select id::text from meeting_ctx where label='club')),'catalog separates derived and legacy dates');
select lives_ok($$select public.update_club((select id from meeting_ctx where label='club'),
 '{"name":"Зустрічі клубу","genre":"Проза","description":"Обговорюємо книги всі разом.","format":"online","language":"Українська","meetings_per_month":2}')$$,'normal club editing remains compatible');
select is((select next_meeting::text from public.clubs where id=(select id from meeting_ctx where label='club')),'2020-01-02','club edit preserves legacy date');
select public.cancel_club_meeting((select id from meeting_ctx where label='meeting'),(select version from meeting_ctx where label='meeting'));
select is(public.get_club_meeting((select id from meeting_ctx where label='meeting'))->>'status','cancelled','cancelled history retained');
select throws_ok($$select public.update_club_meeting((select id from meeting_ctx where label='meeting'),(select value from meeting_input),
 (public.get_club_meeting((select id from meeting_ctx where label='meeting'))->>'updated_at')::timestamptz)$$,'55000',null,'cancelled meeting read only');
insert into meeting_ctx select 'future',m.id,m.updated_at from public.create_club_meeting((select id from meeting_ctx where label='club'),(select value from meeting_input)) m;
reset role;
insert into public.club_meetings(club_id,title,starts_at,timezone,format,location)
 select id,'Минула зустріч',now()-interval '1 day','UTC','offline','Бібліотека' from meeting_ctx where label='club';
set local role authenticated;
select is((public.list_club_meetings((select id from meeting_ctx where label='club'),'past')->>'total')::integer,1,'past meeting list');
select throws_ok($$select public.cancel_club_meeting((select id from public.club_meetings where title='Минула зустріч'),
 (select updated_at from public.club_meetings where title='Минула зустріч'))$$,'55000',null,'past cancellation denied');
select throws_ok($$select public.update_club_meeting((select id from public.club_meetings where title='Минула зустріч'),
 (select value from meeting_input),(select updated_at from public.club_meetings where title='Минула зустріч'))$$,'55000',null,'past editing denied');
select public.archive_club((select id from meeting_ctx where label='club'));
select is(public.get_club_meeting((select id from meeting_ctx where label='future'))->>'cancel_reason','club_archived','archive cancels future meetings');
select is((public.list_club_meetings((select id from meeting_ctx where label='club'),'past')->>'total')::integer,1,'archive retains past history');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),(select value from meeting_input))$$,'55000',null,'archive cannot create');
select ok((select c->>'next_meeting_at' is null and c->>'legacy_next_meeting'='2020-01-02' from public.list_clubs() c
 where c->>'id'=(select id::text from meeting_ctx where label='club')),'archive preserves legacy date without fake upcoming meeting');
select set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.get_club_meeting((select id from meeting_ctx where label='future'))$$,'archived member can read history');
reset role;
delete from public.club_members where user_id='90000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.get_club_meeting((select id from meeting_ctx where label='future'))$$,'42501',null,'former member cannot read private history based on application');
set local role anon;
select throws_ok($$select public.get_club_meeting((select id from meeting_ctx where label='future'))$$,'42501',null,'guest cannot read');
select throws_ok($$select public.create_club_meeting((select id from meeting_ctx where label='club'),(select value from meeting_input))$$,'42501',null,'guest cannot create');
reset role;
select * from finish();
rollback;

