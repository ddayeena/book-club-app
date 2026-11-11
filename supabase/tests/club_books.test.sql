-- Disposable test Supabase only; fixtures roll back. Requires migrations 001–005.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not exists(select 1 from information_schema.columns
 where table_schema='public' and table_name='clubs' and column_name='current_book'),
 'legacy column removed only by atomic cutover');
select ok((select relrowsecurity from pg_class where oid='public.club_books'::regclass),'book RLS enabled');
select ok(not has_function_privilege('anon','public.save_club_book(uuid,jsonb,uuid)','EXECUTE'),'guest cannot save');
select ok(not has_function_privilege('authenticated','private.lock_book_owner(uuid)','EXECUTE'),'raw owner helper closed');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and p.proname in ('save_club_book','start_club_book','complete_club_book')),0,
 'public book RPCs use invoker');
insert into auth.users(id,email,raw_user_meta_data) values
 ('30000000-0000-4000-8000-000000000001','book-owner@example.test','{"name":"Власник"}'),
 ('30000000-0000-4000-8000-000000000002','book-other@example.test','{"name":"Сторонній"}');
create temp table book_ctx(label text primary key,id uuid);
grant all on book_ctx to anon,authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into book_ctx select 'club',(public.create_club('{"name":"Книжкова полиця","genre":"Проза","description":"Читаємо та обговорюємо книги.","format":"online","language":"Українська","meetings_per_month":2}')).id;
select throws_ok($$select public.create_club('{"current_book":"Не втрачати цю назву"}')$$,'55000',null,'old payload fails explicitly rather than discarding title');
select throws_ok($$select public.save_club_book((select id from book_ctx where label='club'),'{"title":"Без автора","is_migrated":true}')$$,
 '23514',null,'cannot forge migration flag to bypass author');
insert into book_ctx select 'one',(public.save_club_book((select id from book_ctx where label='club'),
 '{"title":"Перша","author":"Автор","status":"current","is_migrated":true}')).id;
insert into book_ctx select 'two',(public.save_club_book((select id from book_ctx where label='club'),
 '{"title":"Друга","author":"Автор"}')).id;
select is((select status from public.club_books where id=(select id from book_ctx where label='one')),'planned','payload cannot set status');
select throws_ok($$insert into public.club_books(club_id,title,author) select id,'Підміна','Автор' from book_ctx where label='club'$$,
 '42501',null,'no direct insert');
select throws_ok($$update public.club_books set is_migrated=true$$,'42501',null,'no protected column update');
select throws_ok($$delete from public.club_books$$,'42501',null,'no physical delete');
select throws_ok($$select public.save_club_book((select id from book_ctx where label='club'),'{"title":"Книга","author":"Автор","cover_url":"javascript:alert(1)"}')$$,
 '23514',null,'unsafe cover scheme rejected');
select lives_ok($$select public.start_club_book((select id from book_ctx where label='one'))$$,'owner starts planned book');
select is((select c->>'current_book' from public.list_clubs() c where c->>'id'=(select id::text from book_ctx where label='club')),
 'Перша','catalog derives current title from bookshelf');
select throws_ok($$select public.start_club_book((select id from book_ctx where label='two'))$$,'55000',null,'replacement requires explicit decision');
select throws_ok($$select public.start_club_book((select id from book_ctx where label='two'),'30000000-0000-4000-8000-000000000099','completed')$$,
 '55000',null,'stale expected current book rejected');
select lives_ok($$select public.start_club_book((select id from book_ctx where label='two'),(select id from book_ctx where label='one'),'planned')$$,
 'owner explicitly returns previous book to planned');
select is((select count(*)::integer from public.club_books where club_id=(select id from book_ctx where label='club') and status='current'),1,
 'exactly one current book');
select lives_ok($$select public.start_club_book((select id from book_ctx where label='one'),(select id from book_ctx where label='two'),'completed')$$,
 'owner explicitly completes previous book');
select is((select status from public.club_books where id=(select id from book_ctx where label='two')),'completed','previous reading preserved in history');
select lives_ok($$select public.complete_club_book((select id from book_ctx where label='one'))$$,'owner completes current book');
select throws_ok($$select public.start_club_book((select id from book_ctx where label='one'))$$,'55000',null,'rereading completed book not implicit');
select ok((select c->>'current_book' is null from public.list_clubs() c where c->>'id'=(select id::text from book_ctx where label='club')),
 'catalog has no current title after completion');
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.club_books where club_id=(select id from book_ctx where label='club')),2,'active club books public');
set local role anon;
select is((select count(*)::integer from public.club_books where club_id=(select id from book_ctx where label='club')),2,'guest can read active shelf');
set local role authenticated;
select throws_ok($$select public.save_club_book((select id from book_ctx where label='club'),'{"title":"Чужа","author":"Автор"}')$$,
 '42501',null,'outsider cannot add books');
select throws_ok($$select public.save_club_book((select id from book_ctx where label='club'),'{"title":"Підміна","author":"Автор"}',(select id from book_ctx where label='one'))$$,
 '42501',null,'outsider cannot edit');
select throws_ok($$select public.complete_club_book((select id from book_ctx where label='one'))$$,
 '42501',null,'outsider cannot complete reading');
reset role;
-- Simulate already backfilled metadata without inventing an author.
insert into public.club_books(club_id,title,status,is_migrated)
 select id,'Стара назва','planned',true from book_ctx where label='club';
update public.user_access set role='admin' where user_id='30000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.save_club_book((select id from book_ctx where label='club'),'{"title":"Admin","author":"Автор"}')$$,
 '42501',null,'admin is not automatically book owner');
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.save_club_book((select id from book_ctx where label='club'),'{"title":"Уточнена стара назва"}',
 (select id from public.club_books where title='Стара назва' and club_id=(select id from book_ctx where label='club')))$$,
 'migrated book may retain unknown author');
select public.archive_club((select id from book_ctx where label='club'));
select is((select count(*)::integer from public.club_books where club_id=(select id from book_ctx where label='club')),3,'owner retains archived history');
select throws_ok($$select public.save_club_book((select id from book_ctx where label='club'),'{"title":"Нова","author":"Автор"}')$$,
 '55000',null,'archived club immutable');
select throws_ok($$select public.start_club_book((select id from public.club_books where title='Уточнена стара назва'))$$,
 '55000',null,'cannot start archived reading');
reset role;
update public.user_access set role='user' where user_id='30000000-0000-4000-8000-000000000002';
insert into public.club_members(club_id,user_id)
 select id,'30000000-0000-4000-8000-000000000002'::uuid from book_ctx where label='club';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.club_books where club_id=(select id from book_ctx where label='club')),3,'member retains archived history');
reset role;
delete from public.club_members where user_id='30000000-0000-4000-8000-000000000002' and club_id=(select id from book_ctx where label='club');
set local role authenticated;
select is((select count(*)::integer from public.club_books where club_id=(select id from book_ctx where label='club')),0,'stranger cannot read archive');
set local role anon;
select is((select count(*)::integer from public.club_books where club_id=(select id from book_ctx where label='club')),0,'guest cannot read archive');
select throws_ok($$select public.start_club_book((select id from book_ctx where label='one'))$$,'42501',null,'guest cannot invoke writes');
reset role;
update public.user_access set is_blocked=true where user_id='30000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.save_club_book((select id from book_ctx where label='club'),'{"title":"Блок","author":"Автор"}')$$,
 '42501',null,'blocked owner cannot write');
reset role;
select * from finish();
rollback;
