-- Disposable Supabase only, migrations 001–012, no Cron. NOT run against the main project.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select is((select count(*)::integer from pg_class where oid in ('public.club_discussions'::regclass,'public.club_discussion_comments'::regclass) and relrowsecurity),2,'new tables have RLS');
select ok(not has_table_privilege('authenticated','public.club_discussions','SELECT,INSERT,UPDATE,DELETE'),'no raw topic grants');
select ok(not has_table_privilege('authenticated','public.club_discussion_comments','SELECT,INSERT,UPDATE,DELETE'),'no raw comment grants');
select ok(not has_function_privilege('authenticated','private.lock_discussion(uuid)','EXECUTE'),'locking helper closed');
select ok(not has_function_privilege('authenticated','private.discussion_trim(text)','EXECUTE'),'normalization helper closed');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.proname in ('list_club_discussions','get_club_discussion','create_club_discussion',
 'update_club_discussion','delete_club_discussion','list_discussion_comments','create_discussion_comment','update_discussion_comment','delete_discussion_comment')
 and has_function_privilege('anon',p.oid,'EXECUTE')),'all nine RPCs closed to guest in both schemas');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('list_club_discussions','get_club_discussion','create_club_discussion','update_club_discussion','delete_club_discussion','list_discussion_comments','create_discussion_comment','update_discussion_comment','delete_discussion_comment')),9,'all nine exact public entry points exist');
select is(private.discussion_trim(U&'\00A0\FEFFtext\3000'),'text','SQL normalizes Unicode boundary whitespace');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('list_club_discussions','get_club_discussion','create_club_discussion','update_club_discussion','delete_club_discussion','list_discussion_comments','create_discussion_comment','update_discussion_comment','delete_discussion_comment') and p.prosecdef),0,'public wrappers are invoker');
insert into auth.users(id,email,raw_user_meta_data) values
 ('d1000000-0000-4000-8000-000000000001','discussion-owner@example.test','{"name":"Owner"}'),
 ('d1000000-0000-4000-8000-000000000002','discussion-member@example.test','{"name":"Member"}'),
 ('d1000000-0000-4000-8000-000000000003','discussion-admin@example.test','{"name":"Admin"}'),
 ('d1000000-0000-4000-8000-000000000004','discussion-other@example.test','{"name":"Other"}');
update public.user_access set role='admin' where user_id='d1000000-0000-4000-8000-000000000003';
create temp table discussion_ctx(label text primary key,id uuid,version timestamptz);
grant all on discussion_ctx to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into discussion_ctx(label,id) select 'club',(public.create_club('{"name":"Discussion fixture","genre":"Проза","description":"Читаємо та обговорюємо книги.","format":"online","language":"Українська","meetings_per_month":2}')).id;
insert into discussion_ctx(label,id) select 'other',(public.create_club('{"name":"Other discussion fixture","genre":"Проза","description":"Книги з іншого клубу читачів.","format":"online","language":"Українська","meetings_per_month":2}')).id;
insert into discussion_ctx(label,id) select 'book',(public.save_club_book((select id from discussion_ctx where label='club'),'{"title":"Book","author":"Author"}')).id;
insert into discussion_ctx(label,id) select 'foreign_book',(public.save_club_book((select id from discussion_ctx where label='other'),'{"title":"Foreign","author":"Author"}')).id;
select throws_ok($$select public.create_club_discussion((select id from discussion_ctx where label='club'),'Bad book','Text',(select id from discussion_ctx where label='foreign_book'))$$,'23503',null,'foreign club book rejected');
select throws_ok($$select public.create_club_discussion((select id from discussion_ctx where label='club'),'ab','Text')$$,'23514',null,'short title rejected');
select throws_ok($$select public.create_club_discussion((select id from discussion_ctx where label='club'),'Title',E'\t\n ')$$,'23514',null,'whitespace-only body rejected');
select throws_ok($$select public.create_club_discussion((select id from discussion_ctx where label='club'),'Title',U&'\00A0\000B\3000')$$,'23514',null,'Unicode whitespace-only topic body rejected');
select throws_ok($$select public.create_club_discussion((select id from discussion_ctx where label='club'),null,'Body')$$,'23514',null,'null live title rejected');
select throws_ok($$select public.create_club_discussion((select id from discussion_ctx where label='club'),'Title',repeat('x',10001))$$,'23514',null,'oversized body rejected');
insert into discussion_ctx(label,id) select 'topic',public.create_club_discussion((select id from discussion_ctx where label='club'),'  First topic  ',' Secret topic text ',(select id from discussion_ctx where label='book'));
update discussion_ctx set version=(public.get_club_discussion(id)->>'updated_at')::timestamptz where label='topic';
select is(public.get_club_discussion((select id from discussion_ctx where label='topic'))->>'title','First topic','server trims title');
select is(public.get_club_discussion((select id from discussion_ctx where label='topic'))->>'author_id',auth.uid()::text,'server sets author');
select is(public.get_club_discussion((select id from discussion_ctx where label='topic'))->>'created_at',
 public.get_club_discussion((select id from discussion_ctx where label='topic'))->>'updated_at','new topic is not labelled edited');
select throws_ok($$select * from public.club_discussions$$,'42501',null,'raw SELECT denied');
select throws_ok($$insert into public.club_discussions(club_id,author_id,title,body) select id,auth.uid(),'Fake','Fake' from discussion_ctx where label='club'$$,'42501',null,'raw INSERT denied');
select throws_ok($$update public.club_discussions set title='Fake'$$,'42501',null,'raw UPDATE denied');
select throws_ok($$delete from public.club_discussions$$,'42501',null,'raw DELETE denied');
reset role;
insert into public.club_members(club_id,user_id) select id,'d1000000-0000-4000-8000-000000000002' from discussion_ctx where label='club';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((public.list_club_discussions((select id from discussion_ctx where label='club'))->>'total')::integer,1,'member reads topics');
insert into discussion_ctx(label,id) select 'comment',public.create_discussion_comment((select id from discussion_ctx where label='topic'),'Secret comment text');
update discussion_ctx set version=(public.list_discussion_comments((select id from discussion_ctx where label='topic'))->'items'->0->>'updated_at')::timestamptz where label='comment';
select throws_ok($$select public.create_discussion_comment((select id from discussion_ctx where label='topic'),repeat('x',2001))$$,'23514',null,'comment limit enforced');
select throws_ok($$select public.create_discussion_comment((select id from discussion_ctx where label='topic'),U&'\00A0\FEFF')$$,'23514',null,'Unicode whitespace-only comment rejected');
select throws_ok($$select * from public.club_discussion_comments$$,'42501',null,'authenticated raw comment SELECT denied');
select throws_ok($$update public.club_discussion_comments set author_id=auth.uid()$$,'42501',null,'raw comment author change denied');
select throws_ok($$select public.update_club_discussion((select id from discussion_ctx where label='topic'),'Changed','Text',null,(select version from discussion_ctx where label='topic'))$$,'42501',null,'member cannot edit owner topic');
select throws_ok($$select public.delete_club_discussion((select id from discussion_ctx where label='topic'),(select version from discussion_ctx where label='topic'))$$,'42501',null,'member cannot delete owner topic');
select public.update_discussion_comment((select id from discussion_ctx where label='comment'),'Updated own comment',(select version from discussion_ctx where label='comment'));
select throws_ok($$select public.delete_discussion_comment((select id from discussion_ctx where label='comment'),(select version from discussion_ctx where label='comment'))$$,'40001',null,'comment stale delete rejected');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select lives_ok($$select public.get_club_discussion((select id from discussion_ctx where label='topic'))$$,'nonmember admin can read');
select throws_ok($$select public.create_club_discussion((select id from discussion_ctx where label='club'),'Admin topic','Text')$$,'42501',null,'nonmember admin cannot create topic');
select throws_ok($$select public.create_discussion_comment((select id from discussion_ctx where label='topic'),'Admin comment')$$,'42501',null,'nonmember admin cannot comment');
select throws_ok($$select public.update_discussion_comment((select id from discussion_ctx where label='comment'),'Moderator edit',clock_timestamp())$$,'42501',null,'admin cannot edit foreign text');
update discussion_ctx set version=(public.list_discussion_comments((select id from discussion_ctx where label='topic'))->'items'->0->>'updated_at')::timestamptz where label='comment';
select public.delete_discussion_comment((select id from discussion_ctx where label='comment'),(select version from discussion_ctx where label='comment'));
select ok((public.list_discussion_comments((select id from discussion_ctx where label='topic'))->'items'->0->>'deleted_at') is not null,'moderator leaves comment tombstone');
select ok((public.list_discussion_comments((select id from discussion_ctx where label='topic'))->'items'->0->>'body') is null,'deleted body not returned');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.get_club_discussion((select id from discussion_ctx where label='topic'))$$,'42501',null,'outsider cannot get topic');
insert into discussion_ctx(label,id) select 'request',(public.submit_join_request(jsonb_build_object('club_id',(select id from discussion_ctx where label='club'),
 'motivation','Хочу обговорювати книги разом.','weekly_hours',2,'wants_reminders',false,'experience','regular','participation_format','any','contact_email',''))).id;
select throws_ok($$select public.list_club_discussions((select id from discussion_ctx where label='club'))$$,'42501',null,'applicant cannot read private discussions');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into discussion_ctx(label,id) select 'member_topic',public.create_club_discussion((select id from discussion_ctx where label='club'),'Member topic','Retained text');
update discussion_ctx set version=(public.get_club_discussion(id)->>'updated_at')::timestamptz where label='member_topic';
reset role;
delete from public.club_members where club_id=(select id from discussion_ctx where label='club') and user_id='d1000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.get_club_discussion((select id from discussion_ctx where label='member_topic'))$$,'42501',null,'former member cannot read own topic');
select throws_ok($$select public.create_discussion_comment((select id from discussion_ctx where label='topic'),'Left club')$$,'42501',null,'former member cannot write');
select throws_ok($$select public.update_club_discussion((select id from discussion_ctx where label='member_topic'),'Changed','Text',null,(select version from discussion_ctx where label='member_topic'))$$,'42501',null,'former author cannot edit');
select throws_ok($$select public.delete_club_discussion((select id from discussion_ctx where label='member_topic'),(select version from discussion_ctx where label='member_topic'))$$,'42501',null,'former author cannot delete');
reset role;
select is((select body from public.club_discussions where id=(select id from discussion_ctx where label='member_topic')),'Retained text','leaving does not erase contributions');
update public.user_access set is_blocked=true where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.get_club_discussion((select id from discussion_ctx where label='topic'))$$,'42501',null,'blocked owner cannot read');
select throws_ok($$select public.create_club_discussion((select id from discussion_ctx where label='club'),'Blocked','Text')$$,'42501',null,'blocked owner cannot write');
reset role;
update public.user_access set is_blocked=false where user_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
-- Equal timestamps deliberately exercise the ID tie-breaker independently of clock speed.
reset role;
insert into public.club_discussions(club_id,author_id,title,body,created_at)
 select (select id from discussion_ctx where label='club'),'d1000000-0000-4000-8000-000000000001','Page '||n,'Text','2026-01-01T00:00:00Z' from generate_series(1,22) n;
create temp table discussion_order as select id,row_number() over(order by created_at desc,id desc) position from public.club_discussions where club_id=(select id from discussion_ctx where label='club');
grant select on discussion_order to authenticated;
set local role authenticated;
select is(jsonb_array_length(public.list_club_discussions((select id from discussion_ctx where label='club'),null,1)->'items'),20,'topic page bounded to 20');
select is((public.list_club_discussions((select id from discussion_ctx where label='club'),null,2)->'items'->0->>'id'),(select id::text from discussion_order where position=21),'stable second page ordering');
select is((public.list_club_discussions((select id from discussion_ctx where label='club'),(select id from discussion_ctx where label='book'))->>'total')::integer,1,'book filter');
select public.create_discussion_comment((select id from discussion_ctx where label='topic'),'Page comment '||n) from generate_series(1,21) n;
select is(jsonb_array_length(public.list_discussion_comments((select id from discussion_ctx where label='topic'),1)->'items'),20,'comment page bounded to 20 including tombstones');
select is(jsonb_array_length(public.list_discussion_comments((select id from discussion_ctx where label='topic'),2)->'items'),2,'remaining comments on next page');
select isnt(public.list_discussion_comments((select id from discussion_ctx where label='topic'),1)->'items'->0->>'id',
 public.list_discussion_comments((select id from discussion_ctx where label='topic'),2)->'items'->0->>'id','comment pages do not repeat first row');
select throws_ok($$select public.list_discussion_comments((select id from discussion_ctx where label='topic'),0)$$,'22023',null,'invalid comment page rejected');
select throws_ok($$select public.list_club_discussions((select id from discussion_ctx where label='club'),null,1,51)$$,'22023',null,'oversized topic page rejected');
update discussion_ctx set version=(public.get_club_discussion(id)->>'updated_at')::timestamptz where label='topic';
select public.update_club_discussion((select id from discussion_ctx where label='topic'),'Updated title','Updated body',null,(select version from discussion_ctx where label='topic'));
select throws_ok($$select public.update_club_discussion((select id from discussion_ctx where label='topic'),'Stale title','Text',null,(select version from discussion_ctx where label='topic'))$$,'40001',null,'stale topic edit rejected');
select throws_ok($$select public.delete_club_discussion((select id from discussion_ctx where label='topic'),(select version from discussion_ctx where label='topic'))$$,'40001',null,'stale topic delete rejected');
select public.archive_club((select id from discussion_ctx where label='club'));
select lives_ok($$select public.get_club_discussion((select id from discussion_ctx where label='topic'))$$,'archived owner can read');
select throws_ok($$select public.create_discussion_comment((select id from discussion_ctx where label='topic'),'Archive')$$,'55000',null,'archive cannot comment');
select throws_ok($$select public.update_club_discussion((select id from discussion_ctx where label='topic'),'Archive edit','Text',null,clock_timestamp())$$,'55000',null,'archive cannot edit');
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.delete_club_discussion((select id from discussion_ctx where label='topic'),clock_timestamp())$$,'55000',null,'admin cannot moderate archive');
select public.restore_club((select id from discussion_ctx where label='club'));
select public.delete_club_discussion((select id from discussion_ctx where label='topic'),(public.get_club_discussion((select id from discussion_ctx where label='topic'))->>'updated_at')::timestamptz);
select ok(not (public.get_club_discussion((select id from discussion_ctx where label='topic')) ? 'body'),'deleted topic projection contains no body');
select ok(not exists(select 1 from jsonb_array_elements(public.list_club_discussions((select id from discussion_ctx where label='club'))->'items') item
 where item->>'id'=(select id::text from discussion_ctx where label='topic')),'deleted topic absent from list');
select throws_ok($$select public.list_discussion_comments((select id from discussion_ctx where label='topic'))$$,'55000',null,'deleted topic comments hidden');
select throws_ok($$select public.create_discussion_comment((select id from discussion_ctx where label='topic'),'Deleted')$$,'55000',null,'cannot comment on deleted topic');
reset role;
select ok((select title is null and body is null and deleted_by='d1000000-0000-4000-8000-000000000003' from public.club_discussions where id=(select id from discussion_ctx where label='topic')),'topic text physically cleared, moderator recorded');
select ok((select body is null from public.club_discussion_comments where id=(select id from discussion_ctx where label='comment')),'comment text physically cleared');
set local role anon;
select throws_ok($$select public.list_club_discussions((select id from discussion_ctx where label='club'))$$,'42501',null,'guest RPC denied');
select throws_ok($$select * from public.club_discussion_comments$$,'42501',null,'guest raw comments denied');
reset role;
select * from finish();
rollback;
