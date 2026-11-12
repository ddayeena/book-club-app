-- Disposable Supabase only, migrations 001–011. Generator calls are manual trusted SQL; no Cron.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_function_privilege('authenticated','private.generate_meeting_reminders(integer)','EXECUTE'),'generator closed to authenticated');
select ok(not has_function_privilege('anon','private.generate_meeting_reminders(integer)','EXECUTE'),'generator closed to guest');
select ok(not has_function_privilege('service_role','private.generate_meeting_reminders(integer)','EXECUTE'),'no API generator grant');
select ok(not has_function_privilege('anon','public.list_my_notifications(text,integer,integer)','EXECUTE'),'guest list closed');
select ok(not has_function_privilege('authenticated','private.require_actor()','EXECUTE'),'raw actor helper closed');
select ok(not has_table_privilege('authenticated','private.reminder_scan_state','SELECT'),'private scan cursor is not readable by clients');
select ok(not has_table_privilege('authenticated','private.reminder_scan_state','UPDATE'),'clients cannot move scan cursor');
select ok((select relrowsecurity and not relforcerowsecurity from pg_class where oid='private.reminder_scan_state'::regclass),'cursor RLS enabled without FORCE for owner worker');
select is((select count(*)::integer from pg_policy where polrelid='private.reminder_scan_state'::regclass),0,'cursor has no client RLS policies');
select ok((select p.prosecdef and p.proowner=c.relowner from pg_proc p cross join pg_class c
 where p.oid='private.generate_meeting_reminders(integer)'::regprocedure and c.oid='private.reminder_scan_state'::regclass),'definer worker and cursor have the same owner');
select ok(not exists(select 1 from unnest(array['anon','authenticated','service_role']) r(role_name)
 cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) v(privilege_name)
 where has_table_privilege(r.role_name,'private.reminder_scan_state',v.privilege_name)),'no client/service table grants including inherited and PUBLIC privileges');
select ok(not exists(select 1 from pg_class c cross join lateral
 aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
 where c.oid='private.reminder_scan_state'::regclass and a.grantee=0),'PUBLIC has no cursor ACL grants');
-- These effective ACLs include grants inherited from DEFAULT PRIVILEGES at creation.
set local role anon;
select throws_ok($$select * from private.reminder_scan_state$$,'42501',null,'guest cannot select cursor');
select throws_ok($$insert into private.reminder_scan_state(singleton) values(true)$$,'42501',null,'guest cannot insert cursor');
select throws_ok($$update private.reminder_scan_state set last_user_id=null$$,'42501',null,'guest cannot change cursor');
select throws_ok($$delete from private.reminder_scan_state$$,'42501',null,'guest cannot delete cursor');
set local role authenticated;
select throws_ok($$select * from private.reminder_scan_state$$,'42501',null,'authenticated cannot select cursor');
select throws_ok($$insert into private.reminder_scan_state(singleton) values(true)$$,'42501',null,'authenticated cannot insert cursor');
select throws_ok($$update private.reminder_scan_state set last_user_id=null$$,'42501',null,'authenticated cannot change cursor');
select throws_ok($$delete from private.reminder_scan_state$$,'42501',null,'authenticated cannot delete cursor');
reset role;
select ok(not has_function_privilege('authenticated','private.meeting_reminder_due(timestamptz,timestamptz)','EXECUTE'),'window helper is closed');
-- Exact mathematical boundaries, without sleeps or a client-controllable generator clock.
select ok(private.meeting_reminder_due('2030-01-02T00:00:00Z','2030-01-01T00:00:00Z'),'exactly 24 hours included');
select ok(not private.meeting_reminder_due('2030-01-02T00:00:00.000001Z','2030-01-01T00:00:00Z'),'24 hours plus one microsecond excluded');
select ok(private.meeting_reminder_due('2030-01-01T00:00:00.000001Z','2030-01-01T00:00:00Z'),'positive future boundary included');
select ok(not private.meeting_reminder_due('2030-01-01T00:00:00Z','2030-01-01T00:00:00Z'),'exact start excluded');
select ok(not private.meeting_reminder_due('2029-12-31T23:59:59.999999Z','2030-01-01T00:00:00Z'),'past boundary excluded');
select ok(not private.meeting_reminder_due('infinity','2030-01-01T00:00:00Z'),'infinite start excluded');
select ok(private.meeting_reminder_due('2030-01-02T02:00:00+02:00','2030-01-01T00:00:00Z'),'offsets compare exact instants');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef
 and p.proname in ('list_my_notifications','get_my_unread_notification_count','mark_notification_read')),0,'public wrappers are invoker');
insert into auth.users(id,email,raw_user_meta_data) values
 ('b1000000-0000-4000-8000-000000000001','notice-owner@example.test','{"name":"Власник"}'),
 ('b1000000-0000-4000-8000-000000000002','notice-member@example.test','{"name":"Учасник"}'),
 ('b1000000-0000-4000-8000-000000000003','notice-admin@example.test','{"name":"Адміністратор"}'),
 ('b1000000-0000-4000-8000-000000000004','notice-other@example.test','{"name":"Сторонній"}');
update public.user_access set role='admin' where user_id='b1000000-0000-4000-8000-000000000003';
update public.profiles set reminders_enabled=true where id in
 ('b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000004');
create temp table notice_ctx(label text primary key,id uuid);
create temp table notice_snap(label text primary key,value jsonb);
grant all on notice_ctx,notice_snap to authenticated,anon;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into notice_ctx select 'club',(public.create_club('{"name":"Клуб сповіщень","genre":"Проза","description":"Читаємо і зустрічаємося разом.","format":"online","language":"Українська","meetings_per_month":2}')).id;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into notice_ctx select 'request',(public.submit_join_request(jsonb_build_object('club_id',(select id from notice_ctx where label='club'),
 'motivation','Хочу обговорювати книги разом.','weekly_hours',2,'wants_reminders',false,'experience','regular','participation_format','any','contact_email',''))).id;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.review_join_request((select id from notice_ctx where label='request'),'approved','Ласкаво просимо');
select is((public.list_my_notifications()->'items'->0->>'target'),'/clubs/'||(select id::text from notice_ctx where label='club')||'/requests','owner opens incoming list, not applicant personal page');
select public.mark_notification_read((select id from public.notifications where request_id=(select id from notice_ctx where label='request') and type='new_request'));
insert into notice_ctx select 'due',(public.create_club_meeting((select id from notice_ctx where label='club'),
 jsonb_build_object('title','Приватна назва','starts_at',clock_timestamp()+interval '12 hours','timezone','UTC','format','hybrid',
 'location','Секретна адреса','meeting_url','https://example.test/secret-room','description','Приватний опис'))).id;
insert into notice_ctx select 'later',(public.create_club_meeting((select id from notice_ctx where label='club'),
 jsonb_build_object('title','Пізніше','starts_at',clock_timestamp()+interval '3 days','timezone','UTC','format','online','meeting_url','https://example.test/later'))).id;
insert into notice_ctx select 'cancelled',(public.create_club_meeting((select id from notice_ctx where label='club'),
 jsonb_build_object('title','Скасована','starts_at',clock_timestamp()+interval '12 hours','timezone','UTC','format','online','meeting_url','https://example.test/cancelled'))).id;
select public.cancel_club_meeting((select id from notice_ctx where label='cancelled'),(public.get_club_meeting((select id from notice_ctx where label='cancelled'))->>'updated_at')::timestamptz);
select throws_ok($$select private.generate_meeting_reminders()$$,'42501',null,'client cannot generate reminders');
reset role;
insert into public.club_meetings(club_id,title,starts_at,timezone,format,location,schedule_version)
 select id,'Минула',now()-interval '1 hour','UTC','offline','Бібліотека',999 from notice_ctx where label='club';
select is((select schedule_version from public.club_meetings where club_id=(select id from notice_ctx where label='club') and title='Минула'),1::bigint,'insert cannot forge initial version');
insert into notice_snap select 'legacy',jsonb_agg(to_jsonb(n) order by id) from public.notifications n where request_id=(select id from notice_ctx where label='request');
select is(private.generate_meeting_reminders(1),1,'bounded first batch');
select ok((select last_meeting_id is not null and last_user_id is not null from private.reminder_scan_state where singleton),'bounded scan records progress');
select is(private.generate_meeting_reminders(1),1,'bounded second batch progresses');
select is(private.generate_meeting_reminders(),0,'repeat does not duplicate');
select throws_ok($$insert into public.notifications(recipient_id,club_id,meeting_id,meeting_schedule_version,type,body)
 select recipient_id,club_id,meeting_id,meeting_schedule_version,type,body from public.notifications where type='meeting_reminder' limit 1$$,
 '23505',null,'unique index independently prevents duplicate delivery');
select is((select count(*)::integer from public.notifications where type='meeting_reminder' and club_id=(select id from notice_ctx where label='club')),2,'owner and member only');
select ok(not exists(select 1 from public.notifications where type='meeting_reminder'
 and recipient_id in ('b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000004')),'admin/outsider without membership excluded');
select is((select jsonb_agg(to_jsonb(n) order by id) from public.notifications n where request_id=(select id from notice_ctx where label='request')),
 (select value from notice_snap where label='legacy'),'request notifications unchanged by generation');
select ok(exists(select 1 from public.notifications where request_id=(select id from notice_ctx where label='request') and read_at is not null),'existing read timestamp retained');
select ok(not exists(select 1 from public.notifications where type='meeting_reminder' and
 (body like '%secret-room%' or body like '%Секретна адреса%' or body like '%Приватний опис%' or body like '%Приватна назва%')),'reminder stores no private meeting details');
select throws_ok($$select private.generate_meeting_reminders(0)$$,'22023',null,'invalid batch size rejected');
select throws_ok($$select private.generate_meeting_reminders(1001)$$,'22023',null,'unbounded batch rejected');
insert into notice_ctx select 'owner_notice',id from public.notifications where type='new_request' and request_id=(select id from notice_ctx where label='request');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is(public.get_my_unread_notification_count(),2::bigint,'member counts decision and reminder');
select is((public.list_my_notifications()->>'total')::integer,2,'recipient only list');
select ok(not exists(select 1 from public.notifications where recipient_id<>auth.uid()),'member raw select cannot read other recipients');
select throws_ok($$select public.mark_notification_read((select id from notice_ctx where label='owner_notice'))$$,'42501',null,'member cannot mark owner notification');
select ok(exists(select 1 from jsonb_array_elements(public.list_my_notifications()->'items') n
 where n->>'type'='request_decision' and n->>'target'='/requests/'||(select id::text from notice_ctx where label='request')),'applicant opens own request');
select throws_ok($$select public.list_my_notifications('bad')$$,'22023',null,'filter rejected');
select throws_ok($$select public.list_my_notifications('all',0)$$,'22023',null,'page rejected');
select throws_ok($$select public.list_my_notifications('all',1,51)$$,'22023',null,'page size bounded');
select is(jsonb_array_length(public.list_my_notifications('all',2,1)->'items'),1,'stable pagination');
select throws_ok($$insert into public.notifications(recipient_id,club_id,request_id,type,body)
 select auth.uid(),id,(select id from notice_ctx where label='request'),'request_decision','Підміна' from notice_ctx where label='club'$$,'42501',null,'client insert denied');
select throws_ok($$delete from public.notifications$$,'42501',null,'client delete denied');
select throws_ok($$update public.notifications set read_at=now()$$,'42501',null,'read_at direct update removed');
select throws_ok($$update public.notifications set body='Підміна'$$,'42501',null,'body immutable');
insert into notice_ctx select 'own_notice',id from public.notifications where type='meeting_reminder';
insert into notice_snap select 'read_time',public.mark_notification_read((select id from notice_ctx where label='own_notice'));
select is(public.mark_notification_read((select id from notice_ctx where label='own_notice'))->>'read_at',
 (select value->>'read_at' from notice_snap where label='read_time'),'mark read idempotent');
select is(public.get_my_unread_notification_count(),1::bigint,'read removes one from unread count');
select is((public.list_my_notifications('unread')->>'total')::integer,1,'unread filter');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is(public.get_my_unread_notification_count(),0::bigint,'admin cannot see other counts');
select is((select count(*)::integer from public.notifications),0,'raw RLS hides other notifications even from admin');
select throws_ok($$select public.mark_notification_read((select id from notice_ctx where label='own_notice'))$$,'42501',null,'admin cannot mark another recipient notice');
reset role;
-- Direct trusted updates also cannot forge the schedule counter.
update public.club_meetings set title='Уточнена назва',description='Уточнений опис',starts_at=starts_at,schedule_version=99 where id=(select id from notice_ctx where label='due');
select is((select schedule_version from public.club_meetings where id=(select id from notice_ctx where label='due')),1::bigint,'title edit/forged counter keeps version');
select is(private.generate_meeting_reminders(),0,'description/title edit does not remind again');
update public.club_meetings set starts_at=starts_at+interval '1 hour',schedule_version=99 where id=(select id from notice_ctx where label='due');
select is((select schedule_version from public.club_meetings where id=(select id from notice_ctx where label='due')),2::bigint,'actual reschedule increments exactly once');
update public.profiles set reminders_enabled=false where id='b1000000-0000-4000-8000-000000000002';
select is(private.generate_meeting_reminders(),1,'disabled preferences skip member, owner still receives');
select is((select count(*)::integer from public.notifications where recipient_id='b1000000-0000-4000-8000-000000000002' and type='meeting_reminder'),1,'old member reminder retained');
update public.profiles set reminders_enabled=true where id='b1000000-0000-4000-8000-000000000002';
update public.user_access set is_blocked=true where user_id='b1000000-0000-4000-8000-000000000002';
select is(private.generate_meeting_reminders(),0,'blocked member excluded');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.list_my_notifications()$$,'42501',null,'blocked cannot list');
select throws_ok($$select public.get_my_unread_notification_count()$$,'42501',null,'blocked cannot count');
select throws_ok($$select public.mark_notification_read((select id from notice_ctx where label='own_notice'))$$,'42501',null,'blocked cannot mark');
select is((select count(*)::integer from public.notifications),0,'blocked raw select is empty');
reset role;
update public.user_access set is_blocked=false where user_id='b1000000-0000-4000-8000-000000000002';
delete from public.club_members where club_id=(select id from notice_ctx where label='club') and user_id='b1000000-0000-4000-8000-000000000002';
select is(private.generate_meeting_reminders(),0,'former member excluded');
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(public.list_my_notifications()->'items') n where n->>'type'='meeting_reminder' and (n->>'is_stale')::boolean and n->>'target' is null),'former member sees history without private meeting link');
reset role;
insert into public.club_members(club_id,user_id) select id,'b1000000-0000-4000-8000-000000000002' from notice_ctx where label='club';
select is(private.generate_meeting_reminders(),1,'rejoin gets missing version only');
select is(private.generate_meeting_reminders(),0,'rejoin cannot duplicate a delivered version');
update public.club_meetings set starts_at=starts_at-interval '1 hour' where id=(select id from notice_ctx where label='due');
select is((select schedule_version from public.club_meetings where id=(select id from notice_ctx where label='due')),3::bigint,'return to old time is a new version');
select is(private.generate_meeting_reminders(),2,'both receive the new schedule version');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok(exists(select 1 from jsonb_array_elements(public.list_my_notifications()->'items') n where n->>'type'='meeting_reminder' and (n->>'is_stale')::boolean),'old versions labelled stale');
select public.cancel_club_meeting((select id from notice_ctx where label='due'),(public.get_club_meeting((select id from notice_ctx where label='due'))->>'updated_at')::timestamptz);
reset role;
select is(private.generate_meeting_reminders(),0,'cancellation stops generation');
-- A previously outside-window meeting now starts shortly: no last-run watermark is required.
update public.club_meetings set starts_at=clock_timestamp()+interval '30 minutes' where id=(select id from notice_ctx where label='later');
select is(private.generate_meeting_reminders(),2,'within-24h meeting catches up on next run');
update public.club_meetings set starts_at=clock_timestamp()-interval '1 minute' where id=(select id from notice_ctx where label='later');
select is(private.generate_meeting_reminders(),0,'no late reminder after start');
set local role authenticated;
insert into notice_ctx select 'archive_meeting',(public.create_club_meeting((select id from notice_ctx where label='club'),
 jsonb_build_object('title','Майбутня до архіву','starts_at',clock_timestamp()+interval '5 hours','timezone','UTC','format','online','meeting_url','https://example.test/archive'))).id;
select public.archive_club((select id from notice_ctx where label='club'));
reset role;
select is(private.generate_meeting_reminders(),0,'archived club excluded');
select is((select cancel_reason from public.club_meetings where id=(select id from notice_ctx where label='archive_meeting')),'club_archived','archive cancels unsent future meeting');
set local role authenticated;
select public.restore_club((select id from notice_ctx where label='club'));
reset role;
select is(private.generate_meeting_reminders(),0,'restoration does not reopen cancelled or past meetings');
set local role authenticated;
select is(public.get_my_unread_notification_count(),(select count(*) from public.notifications where read_at is null),'stale unread reminders still count as unread');
reset role;
select throws_ok($$insert into public.notifications(recipient_id,club_id,type,body)
 select owner_id,id,'meeting_reminder','Неповні поля' from public.clubs where id=(select id from notice_ctx where label='club')$$,'23514',null,'target fields constrained');
insert into notice_ctx select 'other_club',(public.create_club('{"name":"Інший клуб","genre":"Проза","description":"Інший клуб для перевірки зв’язків.","format":"online","language":"Українська","meetings_per_month":2}')).id;
select throws_ok($$insert into public.notifications(recipient_id,club_id,meeting_id,meeting_schedule_version,type,body)
 select 'b1000000-0000-4000-8000-000000000003',(select id from notice_ctx where label='other_club'),id,schedule_version,'meeting_reminder','Підміна клубу'
 from public.club_meetings where id=(select id from notice_ctx where label='due')$$,'23503',null,'meeting cannot be attached to another club');
set local role anon;
select throws_ok($$select private.generate_meeting_reminders()$$,'42501',null,'guest cannot invoke generator');
select throws_ok($$select public.list_my_notifications()$$,'42501',null,'guest list denied');
select throws_ok($$select public.get_my_unread_notification_count()$$,'42501',null,'guest count denied');
select throws_ok($$select public.mark_notification_read((select id from notice_ctx where label='own_notice'))$$,'42501',null,'guest mark denied');
reset role;
select * from finish();
rollback;
