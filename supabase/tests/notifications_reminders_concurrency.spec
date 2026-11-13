# PostgreSQL isolationtester input. ONLY an empty disposable database with 001–011.
# Not part of pgTAP; not executed by React tests. Setup/teardown use trusted SQL.
setup
{
 insert into auth.users(id,email,raw_user_meta_data) values
 ('c1000000-0000-4000-8000-000000000001','scan-owner@example.test','{"name":"Scan owner"}'),
 ('c1000000-0000-4000-8000-000000000002','scan-member@example.test','{"name":"Scan member"}');
 update public.profiles set reminders_enabled=true where id in
 ('c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002');
 insert into public.clubs(id,owner_id,name,genre,description,format,language,meetings_per_month) values
 ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Busy club','Prose','Disposable scan fixture','online','Українська',2),
 ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','Free club','Prose','Disposable scan fixture','online','Українська',2);
 insert into public.club_members(club_id,user_id) values
 ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001'),
 ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002'),
 ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001');
 insert into public.club_meetings(id,club_id,title,starts_at,timezone,format,meeting_url) values
 ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','Busy meeting',clock_timestamp()+interval '3 hours','UTC','online','https://example.test/busy'),
 ('c3000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002','Free meeting',clock_timestamp()+interval '4 hours','UTC','online','https://example.test/free');
 update private.reminder_scan_state set last_starts_at=null,last_meeting_id=null,last_user_id=null;
}
teardown
{
 delete from public.notifications where club_id in ('c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002');
 delete from public.club_meetings where id in ('c3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000002');
 delete from public.club_members where club_id in ('c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002');
 delete from public.clubs where id in ('c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002');
 delete from auth.users where id in ('c1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000002');
 update private.reminder_scan_state set last_starts_at=null,last_meeting_id=null,last_user_id=null;
}
session "locker"
step "begin" { begin; }
step "busy" { select id from public.clubs where id='c2000000-0000-4000-8000-000000000001' for update; }
step "reschedule" { update public.club_meetings set starts_at=starts_at+interval '1 hour' where id='c3000000-0000-4000-8000-000000000001'; }
step "generate_hold" { select private.generate_meeting_reminders(); }
step "commit" { commit; }
step "rollback" { rollback; }
session "worker"
step "first" { select private.generate_meeting_reminders(1); }
step "second" { select private.generate_meeting_reminders(1); }
step "third" { select private.generate_meeting_reminders(1); }
step "drain" { select private.generate_meeting_reminders(); }
step "repeat" { select private.generate_meeting_reminders(); }
step "free_delivered" { select count(*)=1 as free_delivered from public.notifications where meeting_id='c3000000-0000-4000-8000-000000000002'; }
step "unique_three" { select count(*)=3 and count(distinct (meeting_id,recipient_id,meeting_schedule_version))=3 as unique_three from public.notifications where type='meeting_reminder'; }
step "latest_only" { select not exists(select 1 from public.notifications n join public.club_meetings m on m.id=n.meeting_id where n.meeting_schedule_version<>m.schedule_version) as latest_only; }
# Expect first=0, second=0, third=1 despite the busy head; after commit drain=2, repeat=0.
permutation "begin" "busy" "first" "second" "third" "free_delivered" "commit" "drain" "repeat" "unique_three"
# Competing generator returns zero while advisory lock is held. Commit prevents duplicates.
permutation "begin" "generate_hold" "drain" "commit" "repeat" "unique_three"
# Rollback also rolls back the cursor: the next generator can deliver all three again.
permutation "begin" "generate_hold" "drain" "rollback" "repeat" "unique_three"
# Concurrent RPC-style club-first edit: skipped club is delivered only with the new version.
permutation "begin" "busy" "reschedule" "first" "commit" "drain" "latest_only" "unique_three"
