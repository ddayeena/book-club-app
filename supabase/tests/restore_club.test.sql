-- Disposable Supabase only, migrations 001–010. Fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('anon','public.restore_club(uuid)','EXECUTE'),'guest wrapper closed');
select ok(not has_function_privilege('anon','private.restore_club(uuid)','EXECUTE'),'guest implementation closed');
select ok(not has_function_privilege('authenticated','private.require_actor()','EXECUTE'),'raw actor helper remains closed');
select ok(not has_function_privilege('authenticated','private.lock_club(uuid,boolean)','EXECUTE'),'raw club lock remains closed');
select ok(not (select prosecdef from pg_proc where oid='public.restore_club(uuid)'::regprocedure),'public restore is invoker');
select ok((select prosecdef from pg_proc where oid='private.restore_club(uuid)'::regprocedure),'private restore is definer');
insert into auth.users(id,email,raw_user_meta_data) values
 ('a1000000-0000-4000-8000-000000000001','restore-owner@example.test','{"name":"Власник"}'),
 ('a1000000-0000-4000-8000-000000000002','restore-member@example.test','{"name":"Учасник"}'),
 ('a1000000-0000-4000-8000-000000000003','restore-outsider@example.test','{"name":"Сторонній"}'),
 ('a1000000-0000-4000-8000-000000000004','restore-admin@example.test','{"name":"Адміністратор"}'),
 ('a1000000-0000-4000-8000-000000000005','restore-applicant@example.test','{"name":"Заявник"}');
update public.user_access set role='admin' where user_id='a1000000-0000-4000-8000-000000000004';
create temp table restore_ctx(label text primary key,id uuid);
create temp table restore_snap(label text primary key,value jsonb);
grant all on restore_ctx,restore_snap to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into restore_ctx select 'club',(public.create_club('{"name":"Відновлення клубу","genre":"Проза","description":"Читаємо та обговорюємо книги разом.","format":"online","language":"Українська","meetings_per_month":2}')).id;
insert into restore_ctx select 'completed',(public.save_club_book((select id from restore_ctx where label='club'),'{"title":"Прочитана книга","author":"Автор"}')).id;
select public.start_club_book((select id from restore_ctx where label='completed'));
select public.complete_club_book((select id from restore_ctx where label='completed'));
insert into restore_ctx select 'current',(public.save_club_book((select id from restore_ctx where label='club'),'{"title":"Поточна книга","author":"Автор"}')).id;
select public.start_club_book((select id from restore_ctx where label='current'));
insert into restore_ctx select 'one',(public.save_club_book((select id from restore_ctx where label='club'),'{"title":"Перша книга","author":"Автор"}')).id;
insert into restore_ctx select 'two',(public.save_club_book((select id from restore_ctx where label='club'),'{"title":"Друга книга","author":"Автор"}')).id;
insert into restore_ctx select 'finalized',(public.create_book_poll((select id from restore_ctx where label='club'),'Попередній вибір',clock_timestamp()+interval '2 days',
 array(select id from restore_ctx where label in ('one','two')))).id;
reset role;
-- Trusted clock fixture only: finalize a real poll without sleeping or reopening history.
update public.book_polls set created_at=clock_timestamp()-interval '2 days',ends_at=clock_timestamp()-interval '1 day'
 where id=(select id from restore_ctx where label='finalized');
set local role authenticated;
select public.finalize_book_poll((select id from restore_ctx where label='finalized'),
 (select id from public.book_poll_options where poll_id=(select id from restore_ctx where label='finalized') order by position limit 1));
insert into restore_ctx select 'poll',(public.create_book_poll((select id from restore_ctx where label='club'),'Обираємо наступну',clock_timestamp()+interval '2 days',
 array(select id from restore_ctx where label in ('one','two')))).id;
select public.cast_book_vote((select id from restore_ctx where label='poll'),
 (select id from public.book_poll_options where poll_id=(select id from restore_ctx where label='poll') order by position limit 1));
insert into restore_ctx select 'meeting',(public.create_club_meeting((select id from restore_ctx where label='club'),
 jsonb_build_object('title','Зустріч до архівування','starts_at',clock_timestamp()+interval '2 days','timezone','UTC','format','online','meeting_url','https://example.test/private'))).id;
reset role;
insert into public.club_members(club_id,user_id) select id,'a1000000-0000-4000-8000-000000000002' from restore_ctx where label='club';
insert into public.club_meetings(club_id,title,starts_at,timezone,format,location)
 select id,'Минула зустріч',now()-interval '1 day','UTC','offline','Бібліотека' from restore_ctx where label='club';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
insert into restore_ctx select 'request',(public.submit_join_request(jsonb_build_object('club_id',(select id from restore_ctx where label='club'),
 'motivation','Хочу читати книги разом із вами.','weekly_hours',2,'wants_reminders',false,'experience','regular','participation_format','any','contact_email',''))).id;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
insert into restore_ctx select 'other',(public.create_club('{"name":"Інший власник","genre":"Проза","description":"Клуб іншого власника для перевірки.","format":"online","language":"Українська","meetings_per_month":2}')).id;
select public.archive_club((select id from restore_ctx where label='other'));
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.archive_club((select id from restore_ctx where label='club'));
select throws_ok($$select public.restore_club((select id from restore_ctx where label='other'))$$,'42501',null,'owner cannot restore someone else club');
reset role;
-- Capture exact child rows AFTER archive, including cancellation/rejection metadata.
insert into restore_snap select 'club',to_jsonb(c)-'archived_at'-'updated_at' from public.clubs c where id=(select id from restore_ctx where label='club');
insert into restore_snap select 'archived_state',to_jsonb(c) from public.clubs c where id=(select id from restore_ctx where label='club');
insert into restore_snap select 'members',coalesce(jsonb_agg(to_jsonb(m) order by user_id),'[]') from public.club_members m where club_id=(select id from restore_ctx where label='club');
insert into restore_snap select 'requests',coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.join_requests r where club_id=(select id from restore_ctx where label='club');
insert into restore_snap select 'books',coalesce(jsonb_agg(to_jsonb(b) order by id),'[]') from public.club_books b where club_id=(select id from restore_ctx where label='club');
insert into restore_snap select 'polls',coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.book_polls p where club_id=(select id from restore_ctx where label='club');
insert into restore_snap select 'options',coalesce(jsonb_agg(to_jsonb(o) order by id),'[]') from public.book_poll_options o where club_id=(select id from restore_ctx where label='club');
insert into restore_snap select 'votes',coalesce(jsonb_agg(to_jsonb(v) order by poll_id,user_id),'[]') from public.book_votes v where poll_id=(select id from restore_ctx where label='poll');
insert into restore_snap select 'meetings',coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') from public.club_meetings m where club_id=(select id from restore_ctx where label='club');
insert into restore_snap select 'notifications',coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from public.notifications n where club_id=(select id from restore_ctx where label='club');
set local role anon;
select throws_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'42501',null,'guest cannot restore');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'42501',null,'member cannot restore');
select throws_ok($$update public.clubs set archived_at=null$$,'42501',null,'direct updates still forbidden');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'42501',null,'outsider cannot restore');
select throws_ok($$select private.restore_club((select id from restore_ctx where label='club'))$$,'42501',null,'direct private implementation cannot bypass permission checks');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select throws_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'42501',null,'authenticated role without actor identity cannot restore');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select throws_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'42501',null,'applicant cannot restore');
reset role;
update public.user_access set is_blocked=true where user_id in ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'42501',null,'blocked owner cannot restore');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'42501',null,'blocked admin cannot restore');
reset role;
select ok((select archived_at is not null from public.clubs where id=(select id from restore_ctx where label='club')),'denied operations leave club archived');
update public.user_access set is_blocked=false where user_id in ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004');
-- Force a post-UPDATE failure and verify statement atomicity, without changing production triggers.
create function pg_temp.reject_restore() returns trigger language plpgsql as $$
begin
 if old.archived_at is not null and new.archived_at is null then raise exception 'test failure'; end if;
 return new;
end; $$;
create trigger restore_test_failure after update of archived_at on public.clubs for each row execute function pg_temp.reject_restore();
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'P0001',null,'post-update error rolls back restore');
reset role;
select ok((select archived_at is not null from public.clubs where id=(select id from restore_ctx where label='club')),'failed restore remains archived');
select is((select to_jsonb(c) from public.clubs c where id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='archived_state'),'failed restore also rolls back updated_at and all club fields');
drop trigger restore_test_failure on public.clubs;
create function pg_temp.reject_redundant_restore() returns trigger language plpgsql as $$
begin
 if old.archived_at is null and new.archived_at is null then raise exception 'redundant update'; end if;
 return new;
end; $$;
create trigger restore_test_noop before update of archived_at on public.clubs for each row execute function pg_temp.reject_redundant_restore();
set local role authenticated;
select lives_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'owner restores own archived club');
select ok((select archived_at is null from public.clubs where id=(select id from restore_ctx where label='club')),'restored club active');
insert into restore_snap select 'restored_state',to_jsonb(c) from public.clubs c where id=(select id from restore_ctx where label='club');
select lives_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'repeat restore does not issue an UPDATE');
select is((select updated_at from public.clubs where id=(select id from restore_ctx where label='club')),
 (select (value->>'updated_at')::timestamptz from restore_snap where label='restored_state'),'repeat restore leaves updated_at unchanged');
select public.archive_club((select id from restore_ctx where label='club'));
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select lives_ok($$select public.restore_club((select id from restore_ctx where label='club'))$$,'admin restores another owner club');
select lives_ok($$select public.restore_club((select id from restore_ctx where label='other'))$$,'admin restores any archived club');
select throws_ok($$select public.restore_club('a1000000-0000-4000-8000-000000000099')$$,'P0002',null,'missing club rejected');
reset role;
select is((select to_jsonb(c)-'archived_at'-'updated_at' from public.clubs c where id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='club'),'club owner and content unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(m) order by user_id),'[]') from public.club_members m where club_id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='members'),'memberships unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.join_requests r where club_id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='requests'),'requests and rejected decisions unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(b) order by id),'[]') from public.club_books b where club_id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='books'),'all books and current reading unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.book_polls p where club_id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='polls'),'cancelled polls unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(o) order by id),'[]') from public.book_poll_options o where club_id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='options'),'poll options unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(v) order by poll_id,user_id),'[]') from public.book_votes v where poll_id=(select id from restore_ctx where label='poll')),
 (select value from restore_snap where label='votes'),'vote history unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(m) order by id),'[]') from public.club_meetings m where club_id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='meetings'),'cancelled future meetings and past history unchanged');
select is((select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from public.notifications n where club_id=(select id from restore_ctx where label='club')),
 (select value from restore_snap where label='notifications'),'notifications unchanged');
select ok((select cancelled_at is not null from public.club_meetings where id=(select id from restore_ctx where label='meeting')),'cancelled meeting not restarted');
select ok((select cancelled_at is not null from public.book_polls where id=(select id from restore_ctx where label='poll')),'cancelled poll not restarted');
select ok((select finalized_at is not null and cancelled_at is null from public.book_polls where id=(select id from restore_ctx where label='finalized')),'finalized poll not restarted');
select ok((select c->>'archived_at' is null from public.list_clubs() c where c->>'id'=(select id::text from restore_ctx where label='club')),'catalog reflects active state');
select * from finish();
rollback;
