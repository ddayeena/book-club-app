-- SQL Editor, role postgres, MAIN project readhub only. Read README first.
-- FIRST this file; THEN auth-demo.mjs delete-old. No Auth SQL writes.
begin;
set local lock_timeout = '15s';
set local statement_timeout = '120s';
-- Same advisory lock as the reminder worker; Cron configuration is untouched.
select pg_advisory_xact_lock(20261112,11);
lock table public.profiles, public.user_access, public.clubs, public.club_members,
 public.join_requests, public.notifications, public.club_books, public.book_polls,
 public.book_poll_options, public.book_votes, public.club_meetings,
 public.club_discussions, public.club_discussion_comments in access exclusive mode;

delete from public.notifications;
delete from public.club_discussion_comments;
delete from public.club_discussions;
delete from public.book_votes;
-- Break the winner -> option -> poll cycle while satisfying every poll CHECK.
update public.book_polls set winner_option_id=null, finalized_at=null,
 selection_consumed_at=null, cancelled_at=coalesce(cancelled_at,clock_timestamp()),
 cancel_reason=coalesce(cancel_reason,'owner');
delete from public.book_poll_options;
delete from public.book_polls;
delete from public.club_meetings;
delete from public.club_books;
delete from public.join_requests;
delete from public.club_members;
delete from public.clubs;
delete from public.user_access;
delete from public.profiles;
-- Keep the singleton: generate_meeting_reminders uses SELECT INTO STRICT.
update private.reminder_scan_state
 set last_starts_at=null, last_meeting_id=null, last_user_id=null where singleton;

do $$
declare t text; n bigint;
begin
 foreach t in array array['profiles','user_access','clubs','club_members','join_requests',
  'notifications','club_books','book_polls','book_poll_options','book_votes',
  'club_meetings','club_discussions','club_discussion_comments'] loop
  execute format('select count(*) from public.%I',t) into n;
  if n<>0 then raise exception 'Cleanup incomplete: %',t; end if;
 end loop;
 if (select count(*) from private.reminder_scan_state where singleton
   and last_starts_at is null and last_meeting_id is null and last_user_id is null)<>1 then
  raise exception 'Reminder singleton missing; transaction rolled back';
 end if;
end $$;
commit;
select 'Прикладні таблиці порожні. Тепер запустіть auth-demo.mjs delete-old.' as result,
 (select count(*) from auth.users) as auth_users_still_to_delete,
 (select count(*) from storage.objects where bucket_id='avatars') as avatars_still_to_delete;
