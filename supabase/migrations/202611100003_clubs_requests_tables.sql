begin;
create table public.clubs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete restrict,
 name text not null check(char_length(btrim(name)) between 3 and 60),
 genre text not null check(char_length(btrim(genre)) between 2 and 40),
 description text not null check(char_length(btrim(description)) between 10 and 400),
 current_book text check(current_book is null or char_length(current_book) <= 100),
 format text not null check(format in ('online','offline','hybrid')),
 language text not null check(language in ('Українська','Англійська','Українська та англійська')),
 meetings_per_month integer not null check(meetings_per_month between 1 and 8),
 next_meeting date check(next_meeting is null or isfinite(next_meeting)),
 archived_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
comment on column public.clubs.current_book is 'Temporary single source until club_books migration; remove after backfill.';
comment on column public.clubs.next_meeting is 'Temporary single source until meetings migration; remove after backfill.';
create table public.club_members (
 club_id uuid not null references public.clubs(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 joined_at timestamptz not null default now(), primary key(club_id,user_id)
);
create table public.join_requests (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete restrict,
 applicant_id uuid not null references public.profiles(id) on delete restrict,
 motivation text not null check(char_length(btrim(motivation)) between 10 and 500),
 weekly_hours integer not null check(weekly_hours between 1 and 8),
 wants_reminders boolean not null,
 experience text not null check(experience in ('beginner','regular','advanced')),
 participation_format text not null check(participation_format in ('any','online','offline')),
 contact_email text not null default '' check(contact_email = '' or
   (char_length(contact_email) <= 100 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
 reviewed_by uuid references public.profiles(id) on delete restrict,
 reviewed_at timestamptz, decision_comment text check(char_length(decision_comment) <= 500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(weekly_hours <= 4 or wants_reminders),
 check((status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null)
    or (status in ('pending','cancelled') and reviewed_by is null and reviewed_at is null))
);
create unique index one_pending_request on public.join_requests(club_id,applicant_id) where status='pending';
create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 club_id uuid not null references public.clubs(id) on delete restrict,
 request_id uuid not null references public.join_requests(id) on delete restrict,
 type text not null check(type in ('new_request','request_decision')),
 body text not null, read_at timestamptz, created_at timestamptz not null default now(),
 unique(request_id,type,recipient_id)
);
create index clubs_owner on public.clubs(owner_id);
create index members_user on public.club_members(user_id,club_id);
create index requests_applicant on public.join_requests(applicant_id,created_at desc);
create index requests_club_status on public.join_requests(club_id,status);
create index requests_reviewer on public.join_requests(reviewed_by);
create index notifications_recipient on public.notifications(recipient_id,created_at desc);
create index notifications_club on public.notifications(club_id);
create index notifications_request on public.notifications(request_id);
create trigger clubs_touch before update on public.clubs for each row execute function private.touch_updated_at();
create trigger requests_touch before update on public.join_requests for each row execute function private.touch_updated_at();

create function private.is_club_member(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.club_members where club_id=p_club and user_id=auth.uid());
$$;
create function private.manages_club(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active_user() and (private.is_admin() or exists(
 select 1 from public.clubs where id=p_club and owner_id=auth.uid()));
$$;
create function private.can_read_club(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.clubs c where c.id=p_club and
 (c.archived_at is null or (private.is_active_user() and
 (private.manages_club(c.id) or private.is_club_member(c.id) or exists(
 select 1 from public.join_requests r where r.club_id=c.id and r.applicant_id=auth.uid())))));
$$;
revoke all on function private.is_club_member(uuid), private.manages_club(uuid),
 private.can_read_club(uuid) from public,anon,authenticated;
grant execute on function private.is_club_member(uuid), private.manages_club(uuid),
 private.can_read_club(uuid) to authenticated;
-- Public club SELECT uses its own active condition; no private-schema access for anon.
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.notifications enable row level security;
create policy clubs_guest on public.clubs for select to anon using(archived_at is null);
create policy clubs_read on public.clubs for select to authenticated using(private.can_read_club(id));
create policy members_read on public.club_members for select to authenticated using(
 private.is_active_user() and (private.is_club_member(club_id) or private.manages_club(club_id)));
create policy requests_read on public.join_requests for select to authenticated using(
 private.is_active_user() and (applicant_id=auth.uid() or private.manages_club(club_id)));
create policy notifications_read on public.notifications for select to authenticated using(
 private.is_active_user() and recipient_id=auth.uid());
create policy notifications_mark on public.notifications for update to authenticated
 using(private.is_active_user() and recipient_id=auth.uid())
 with check(private.is_active_user() and recipient_id=auth.uid());
revoke all on public.clubs,public.club_members,public.join_requests,public.notifications from public,anon,authenticated;
grant select on public.clubs to anon,authenticated;
grant select on public.club_members,public.join_requests,public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant all on public.clubs,public.club_members,public.join_requests,public.notifications to service_role;
commit;
