# PostgreSQL isolationtester. Empty disposable Supabase 001–012 only, no Cron.
setup
{
 insert into auth.users(id,email,raw_user_meta_data) values
 ('d9000000-0000-4000-8000-000000000001','topic-lock-owner@example.test','{"name":"Owner"}'),
 ('d9000000-0000-4000-8000-000000000002','topic-lock-member@example.test','{"name":"Member"}');
 insert into public.clubs(id,owner_id,name,genre,description,format,language,meetings_per_month)
 values('d9000000-0000-4000-8000-000000000003','d9000000-0000-4000-8000-000000000001','Lock fixture','Проза','Disposable discussion fixture','online','Українська',2);
 insert into public.club_members(club_id,user_id) values
 ('d9000000-0000-4000-8000-000000000003','d9000000-0000-4000-8000-000000000001'),
 ('d9000000-0000-4000-8000-000000000003','d9000000-0000-4000-8000-000000000002');
 insert into public.club_discussions(id,club_id,author_id,title,body,updated_at)
 values('d9000000-0000-4000-8000-000000000004','d9000000-0000-4000-8000-000000000003','d9000000-0000-4000-8000-000000000001','Original topic','Original text','2026-01-01T00:00:00Z');
 insert into public.club_discussion_comments(id,discussion_id,author_id,body,updated_at)
 values('d9000000-0000-4000-8000-000000000005','d9000000-0000-4000-8000-000000000004','d9000000-0000-4000-8000-000000000001','Original comment','2026-01-01T00:00:00Z');
}
teardown
{
 delete from public.club_discussion_comments where discussion_id='d9000000-0000-4000-8000-000000000004';
 delete from public.club_discussions where id='d9000000-0000-4000-8000-000000000004';
 delete from public.club_members where club_id='d9000000-0000-4000-8000-000000000003';
 delete from public.clubs where id='d9000000-0000-4000-8000-000000000003';
 delete from auth.users where id in ('d9000000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000002');
}
session "owner"
setup { set role authenticated; select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated"}',false); }
step "begin" { begin; }
step "edit" { select public.update_club_discussion('d9000000-0000-4000-8000-000000000004','Updated topic','Updated text',null,'2026-01-01T00:00:00Z'); }
step "comment_edit" { select public.update_discussion_comment('d9000000-0000-4000-8000-000000000005','Updated comment','2026-01-01T00:00:00Z'); }
step "delete" { select public.delete_club_discussion('d9000000-0000-4000-8000-000000000004',(public.get_club_discussion('d9000000-0000-4000-8000-000000000004')->>'updated_at')::timestamptz); }
step "archive" { select public.archive_club('d9000000-0000-4000-8000-000000000003'); }
step "remove_member" { select public.remove_club_member('d9000000-0000-4000-8000-000000000003','d9000000-0000-4000-8000-000000000002'); }
step "commit" { commit; }
session "other"
setup { set role authenticated; select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-000000000002","role":"authenticated"}',false); }
step "comment" { select public.create_discussion_comment('d9000000-0000-4000-8000-000000000004','Concurrent comment'); }
step "read_comments" { select public.list_discussion_comments('d9000000-0000-4000-8000-000000000004'); }
step "read_topic" { select public.get_club_discussion('d9000000-0000-4000-8000-000000000004'); }
session "second_owner"
setup { set role authenticated; select set_config('request.jwt.claims','{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated"}',false); }
step "stale_edit" { select public.update_club_discussion('d9000000-0000-4000-8000-000000000004','Stale topic','Stale text',null,'2026-01-01T00:00:00Z'); }
step "stale_delete" { select public.delete_club_discussion('d9000000-0000-4000-8000-000000000004','2026-01-01T00:00:00Z'); }
step "comment_stale_delete" { select public.delete_discussion_comment('d9000000-0000-4000-8000-000000000005','2026-01-01T00:00:00Z'); }
# Waiting stale writer must fail with 40001 after the first writer commits.
permutation "begin" "edit" "stale_edit" "commit"
permutation "begin" "edit" "stale_delete" "commit"
permutation "begin" "comment_edit" "comment_stale_delete" "commit"
# Waiting comment must fail with 55000 after deletion/archive, or 42501 after membership removal.
permutation "begin" "delete" "comment" "commit"
permutation "begin" "archive" "comment" "commit"
permutation "begin" "remove_member" "comment" "commit"
# Reverse order: a committed comment is retained but no branch content is readable after deletion.
permutation "comment" "begin" "delete" "commit" "read_comments"
# Reads begun after committed membership removal must be denied, too.
permutation "begin" "remove_member" "commit" "read_topic"
