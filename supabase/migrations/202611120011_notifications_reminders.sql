begin;
-- Extend existing history without rewriting message bodies or read timestamps.
alter table public.club_meetings add column schedule_version bigint not null default 1 check(schedule_version>0);
alter table public.club_meetings add constraint meetings_id_club unique(id,club_id);
create function private.meeting_schedule_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then new.schedule_version:=1;
 elsif new.starts_at is distinct from old.starts_at then new.schedule_version:=old.schedule_version+1;
 else new.schedule_version:=old.schedule_version;
 end if;
 return new;
end; $$;
revoke all on function private.meeting_schedule_version() from public,anon,authenticated;
create trigger meeting_schedule_version before insert or update on public.club_meetings
 for each row execute function private.meeting_schedule_version();

alter table public.notifications alter column request_id drop not null;
alter table public.notifications add column meeting_id uuid;
alter table public.notifications add column meeting_schedule_version bigint;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in ('new_request','request_decision','meeting_reminder'));
alter table public.notifications add constraint notification_target_check check(
 (type in ('new_request','request_decision') and request_id is not null and meeting_id is null and meeting_schedule_version is null)
 or (type='meeting_reminder' and request_id is null and meeting_id is not null and meeting_schedule_version is not null and meeting_schedule_version>0));
alter table public.notifications add constraint notification_meeting_club
 foreign key(meeting_id,club_id) references public.club_meetings(id,club_id) on delete restrict;
create unique index one_meeting_reminder on public.notifications(meeting_id,recipient_id,meeting_schedule_version)
 where type='meeting_reminder';
create index notifications_meeting on public.notifications(meeting_id);
drop index public.notifications_recipient;
create index notifications_recipient on public.notifications(recipient_id,created_at desc,id desc);
create index notifications_unread on public.notifications(recipient_id) where read_at is null;
revoke update(read_at) on public.notifications from public,anon,authenticated;

create function private.get_my_unread_notification_count() returns bigint
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); result bigint;
begin
 select count(*) into result from public.notifications where recipient_id=actor and read_at is null;
 return result;
end; $$;
create function private.list_my_notifications(p_filter text default 'all',p_page integer default 1,p_size integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); result jsonb; t timestamptz:=clock_timestamp();
begin
 if p_filter is null or p_filter not in ('all','unread') or p_page is null or p_page<1 or p_page>1000000
 or p_size is null or p_size<1 or p_size>50 then raise exception 'Некоректний фільтр' using errcode='22023'; end if;
 with filtered as (select * from public.notifications where recipient_id=actor and (p_filter='all' or read_at is null)),
 paged as (select * from filtered order by created_at desc,id desc limit p_size offset (p_page-1)*p_size)
 select jsonb_build_object('total',(select count(*) from filtered),'unread_count',private.get_my_unread_notification_count(),
 'items',coalesce((select jsonb_agg(jsonb_build_object(
 'id',n.id,'type',n.type,'body',n.body,'created_at',n.created_at,'read_at',n.read_at,
 'is_stale',case when n.type='meeting_reminder' then m.id is null or c.archived_at is not null
   or m.cancelled_at is not null or m.starts_at<=t or m.schedule_version<>n.meeting_schedule_version
   or not private.is_club_member(n.club_id) else false end,
 'target',case
   when n.type='meeting_reminder' and m.id is not null and private.can_read_meetings(n.club_id)
     then '/clubs/'||n.club_id||'/meetings/'||n.meeting_id
   when n.type='new_request' and r.id is not null and private.manages_club(n.club_id)
     then '/clubs/'||n.club_id||'/requests'
   when n.type='request_decision' and r.applicant_id=actor then '/requests/'||n.request_id
   else null end) order by n.created_at desc,n.id desc)
 from paged n join public.clubs c on c.id=n.club_id
 left join public.club_meetings m on m.id=n.meeting_id and m.club_id=n.club_id
 left join public.join_requests r on r.id=n.request_id and r.club_id=n.club_id),'[]'::jsonb)) into result;
 return result;
end; $$;
create function private.mark_notification_read(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_actor(); n public.notifications;
begin
 select * into n from public.notifications where id=p_id and recipient_id=actor for update;
 if not found then raise exception 'Сповіщення недоступне' using errcode='42501'; end if;
 if n.read_at is null then
   update public.notifications set read_at=clock_timestamp() where id=n.id returning * into n;
 end if;
 return jsonb_build_object('id',n.id,'read_at',n.read_at,'unread_count',private.get_my_unread_notification_count());
end; $$;

-- No JWT, no public wrapper: only trusted database execution. Never called from React.
-- A single private cursor advances on inspected pairs, including SKIP LOCKED skips.
-- Without it, a busy first batch could starve every later eligible recipient.
create table private.reminder_scan_state (
 singleton boolean primary key default true check(singleton),
 last_starts_at timestamptz, last_meeting_id uuid, last_user_id uuid,
 check((last_starts_at is null and last_meeting_id is null and last_user_id is null)
 or (last_starts_at is not null and last_meeting_id is not null and last_user_id is not null))
);
-- Defense in depth: no client policies. Do not FORCE RLS: the same migration
-- role owns this table and the SECURITY DEFINER worker and must retain access.
alter table private.reminder_scan_state enable row level security;
insert into private.reminder_scan_state(singleton) values(true);
revoke all on private.reminder_scan_state from public,anon,authenticated,service_role;
create function private.meeting_reminder_due(p_start timestamptz,p_now timestamptz) returns boolean
language sql immutable security invoker set search_path='' as $$
 select isfinite(p_start) and isfinite(p_now) and p_start>p_now and p_start<=p_now+interval '24 hours';
$$;
revoke all on function private.meeting_reminder_due(timestamptz,timestamptz) from public,anon,authenticated,service_role;
create function private.generate_meeting_reminders(p_limit integer default 200) returns integer
language plpgsql security definer set search_path='' as $$
declare candidates jsonb; users_locked uuid[]; clubs_locked uuid[]; t timestamptz; inserted integer;
 scan private.reminder_scan_state;
begin
 if p_limit is null or p_limit<1 or p_limit>1000 then raise exception 'Некоректний розмір пакета' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(20261112,11) then return 0; end if;
 select * into strict scan from private.reminder_scan_state where singleton for update;
 t:=clock_timestamp();
 select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into candidates from (
   select m.id meeting_id,m.club_id,cm.user_id,m.schedule_version,m.starts_at
   from public.club_meetings m join public.clubs c on c.id=m.club_id
   join public.club_members cm on cm.club_id=m.club_id
   join public.profiles p on p.id=cm.user_id
   join public.user_access a on a.user_id=cm.user_id
   where c.archived_at is null and m.cancelled_at is null and m.starts_at>t and m.starts_at<=t+interval '24 hours'
   and not a.is_blocked and p.reminders_enabled
   and not exists(select 1 from public.notifications n where n.type='meeting_reminder' and n.meeting_id=m.id
     and n.recipient_id=cm.user_id and n.meeting_schedule_version=m.schedule_version)
   order by case when scan.last_starts_at is null or
     (m.starts_at,m.id,cm.user_id)>(scan.last_starts_at,scan.last_meeting_id,scan.last_user_id) then 0 else 1 end,
     m.starts_at,m.id,cm.user_id limit p_limit
 ) q;
 if jsonb_array_length(candidates)>0 then
   update private.reminder_scan_state set
     last_starts_at=(candidates->-1->>'starts_at')::timestamptz,
     last_meeting_id=(candidates->-1->>'meeting_id')::uuid,
     last_user_id=(candidates->-1->>'user_id')::uuid where singleton;
 end if;
 -- Acquire ALL account locks before ANY club locks; skip busy accounts/clubs until the next run.
 select coalesce(array_agg(s.user_id),'{}'::uuid[]) into users_locked from (
   select a.user_id from public.user_access a where not a.is_blocked and a.user_id in
   (select x.user_id from jsonb_to_recordset(candidates) x(user_id uuid))
   order by a.user_id for share skip locked
 ) s;
 select coalesce(array_agg(s.id),'{}'::uuid[]) into clubs_locked from (
   select c.id from public.clubs c where c.archived_at is null and c.id in
   (select x.club_id from jsonb_to_recordset(candidates) x(club_id uuid))
   order by c.id for update skip locked
 ) s;
 t:=clock_timestamp();
 insert into public.notifications(recipient_id,club_id,meeting_id,meeting_schedule_version,type,body)
 select x.user_id,m.club_id,m.id,m.schedule_version,'meeting_reminder','Наближається зустріч вашого клубу. Перегляньте актуальні деталі.'
 from jsonb_to_recordset(candidates) x(meeting_id uuid,club_id uuid,user_id uuid,schedule_version bigint)
 join public.club_meetings m on m.id=x.meeting_id and m.club_id=x.club_id and m.schedule_version=x.schedule_version
 join public.clubs c on c.id=m.club_id
 join public.club_members cm on cm.club_id=c.id and cm.user_id=x.user_id
 join public.profiles p on p.id=x.user_id
 join public.user_access a on a.user_id=x.user_id
 where x.user_id=any(users_locked) and c.id=any(clubs_locked) and not a.is_blocked and p.reminders_enabled
 and c.archived_at is null and m.cancelled_at is null and private.meeting_reminder_due(m.starts_at,t)
 on conflict(meeting_id,recipient_id,meeting_schedule_version) where type='meeting_reminder' do nothing;
 get diagnostics inserted=row_count;
 return inserted;
end; $$;
revoke all on function private.generate_meeting_reminders(integer) from public,anon,authenticated,service_role;
revoke all on function private.list_my_notifications(text,integer,integer),private.get_my_unread_notification_count(),
 private.mark_notification_read(uuid) from public,anon,authenticated;
grant execute on function private.list_my_notifications(text,integer,integer),private.get_my_unread_notification_count(),
 private.mark_notification_read(uuid) to authenticated;
create function public.list_my_notifications(p_filter text default 'all',p_page integer default 1,p_size integer default 20) returns jsonb
language sql security invoker set search_path='' as $$select private.list_my_notifications(p_filter,p_page,p_size);$$;
create function public.get_my_unread_notification_count() returns bigint
language sql security invoker set search_path='' as $$select private.get_my_unread_notification_count();$$;
create function public.mark_notification_read(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.mark_notification_read(p_id);$$;
revoke all on function public.list_my_notifications(text,integer,integer),public.get_my_unread_notification_count(),
 public.mark_notification_read(uuid) from public,anon,authenticated;
grant execute on function public.list_my_notifications(text,integer,integer),public.get_my_unread_notification_count(),
 public.mark_notification_read(uuid) to authenticated;
-- No pg_cron extension, schedule, or job is created by this migration.
notify pgrst, 'reload schema';
commit;
