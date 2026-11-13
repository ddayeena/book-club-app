begin;
-- Keep the catalog and club writers on one atomic scheduling cutover.
lock table public.clubs in access exclusive mode;
create table public.club_meetings (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 3 and 120),
 starts_at timestamptz not null check(isfinite(starts_at)),
 timezone text not null check(char_length(timezone) between 1 and 100),
 format text not null check(format in ('online','offline','hybrid')),
 location text check(location is null or char_length(btrim(location)) between 1 and 300),
 meeting_url text check(meeting_url is null or (char_length(meeting_url)<=2048
 and position(chr(92) in meeting_url)=0 and meeting_url !~ '[[:cntrl:]]'
 and meeting_url ~* '^https://(\[[0-9A-Fa-f:]+\]|[[:alnum:]]([[:alnum:].-]*[[:alnum:]])?)(:[0-9]{1,5})?([/?#][^[:space:]]*)?$')),
 description text check(description is null or char_length(description)<=2000),
 cancelled_at timestamptz, cancel_reason text check(cancel_reason in ('owner','club_archived')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check((cancelled_at is null)=(cancel_reason is null)),
 check(format not in ('offline','hybrid') or location is not null),
 check(format not in ('online','hybrid') or meeting_url is not null)
);
create index meetings_club_time on public.club_meetings(club_id,starts_at,id);
create function private.can_read_meetings(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active_user() and exists(select 1 from public.clubs c where c.id=p_club
 and (c.owner_id=auth.uid() or private.is_club_member(c.id) or private.is_admin()));
$$;
revoke all on function private.can_read_meetings(uuid) from public,anon,authenticated;
grant execute on function private.can_read_meetings(uuid) to authenticated;
alter table public.club_meetings enable row level security;
create policy meetings_read on public.club_meetings for select to authenticated using(private.can_read_meetings(club_id));
revoke all on public.club_meetings from public,anon,authenticated;
grant select on public.club_meetings to authenticated;
grant all on public.club_meetings to service_role;

create function private.validate_meeting() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
   raise exception 'Невідомий часовий пояс' using errcode='22023'; end if;
 if tg_op='UPDATE' then
   new.updated_at := greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 end if;
 return new;
end; $$;
revoke all on function private.validate_meeting() from public,anon,authenticated;
create trigger meeting_validate before insert or update on public.club_meetings for each row execute function private.validate_meeting();

create function private.create_club_meeting(p_club uuid,p_input jsonb) returns public.club_meetings
language plpgsql security definer set search_path='' as $$
declare m public.club_meetings;
begin
 perform private.lock_book_owner(p_club);
 if nullif(p_input->>'starts_at','') is null or (p_input->>'starts_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then
   raise exception 'Потрібен час із UTC-зсувом' using errcode='22023'; end if;
 if (p_input->>'starts_at')::timestamptz<=clock_timestamp() then
   raise exception 'Оберіть майбутній час' using errcode='55000'; end if;
 insert into public.club_meetings(club_id,title,starts_at,timezone,format,location,meeting_url,description)
 values(p_club,btrim(p_input->>'title'),(p_input->>'starts_at')::timestamptz,p_input->>'timezone',
 p_input->>'format',nullif(btrim(p_input->>'location'),''),nullif(btrim(p_input->>'meeting_url'),''),
 nullif(btrim(p_input->>'description'),'')) returning * into m;
 return m;
end; $$;
create function private.lock_meeting_owner(p_id uuid,p_expected timestamptz) returns public.club_meetings
language plpgsql security definer set search_path='' as $$
declare club uuid; m public.club_meetings;
begin
 perform private.require_actor();
 select x.club_id into club from public.club_meetings x join public.clubs c on c.id=x.club_id
 where x.id=p_id and c.owner_id=auth.uid();
 if not found then raise exception 'Немає доступу до зустрічі' using errcode='42501'; end if;
 perform private.lock_book_owner(club);
 select * into m from public.club_meetings where id=p_id for update;
 if m.cancelled_at is not null or m.starts_at<=clock_timestamp() then
   raise exception 'Зустріч доступна лише для перегляду' using errcode='55000'; end if;
 if p_expected is distinct from m.updated_at then
   raise exception 'Зустріч уже змінено. Оновіть дані' using errcode='40001'; end if;
 return m;
end; $$;
create function private.update_club_meeting(p_id uuid,p_input jsonb,p_expected timestamptz) returns public.club_meetings
language plpgsql security definer set search_path='' as $$
declare m public.club_meetings := private.lock_meeting_owner(p_id,p_expected);
begin
 if nullif(p_input->>'starts_at','') is null or (p_input->>'starts_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then
   raise exception 'Потрібен час із UTC-зсувом' using errcode='22023'; end if;
 if (p_input->>'starts_at')::timestamptz<=clock_timestamp() then
   raise exception 'Оберіть майбутній час' using errcode='55000'; end if;
 update public.club_meetings set title=btrim(p_input->>'title'),starts_at=(p_input->>'starts_at')::timestamptz,
 timezone=p_input->>'timezone',format=p_input->>'format',location=nullif(btrim(p_input->>'location'),''),
 meeting_url=nullif(btrim(p_input->>'meeting_url'),''),description=nullif(btrim(p_input->>'description'),'')
 where id=p_id returning * into m;
 return m;
end; $$;
create function private.cancel_club_meeting(p_id uuid,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare m public.club_meetings := private.lock_meeting_owner(p_id,p_expected);
begin
 update public.club_meetings set cancelled_at=clock_timestamp(),cancel_reason='owner' where id=m.id;
end; $$;
create function private.get_club_meeting(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.club_meetings; t timestamptz; editable boolean;
begin
 perform private.require_actor();
 select * into m from public.club_meetings where id=p_id and private.can_read_meetings(club_id);
 if not found then raise exception 'Немає доступу до зустрічі' using errcode='42501'; end if;
 t := clock_timestamp();
 select owner_id=auth.uid() and archived_at is null into editable from public.clubs where id=m.club_id;
 return to_jsonb(m)||jsonb_build_object('server_now',t,'can_manage',
 editable and m.cancelled_at is null and m.starts_at>t,
 'status',case when m.cancelled_at is not null then 'cancelled' when m.starts_at<=t then 'past' else 'upcoming' end);
end; $$;
create function private.list_club_meetings(p_club uuid,p_status text default 'upcoming',p_page integer default 1,p_size integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; t timestamptz;
begin
 perform private.require_actor();
 if not private.can_read_meetings(p_club) then raise exception 'Немає доступу до зустрічей' using errcode='42501'; end if;
 if p_status is null or p_status not in ('upcoming','past','cancelled') or p_page is null or p_page<1 or p_page>1000000
 or p_size is null or p_size<1 or p_size>50 then raise exception 'Некоректний фільтр' using errcode='22023'; end if;
 t := clock_timestamp();
 with filtered as (select * from public.club_meetings where club_id=p_club and
 case p_status when 'cancelled' then cancelled_at is not null
 when 'past' then cancelled_at is null and starts_at<=t else cancelled_at is null and starts_at>t end),
 paged as (select * from filtered order by
 case when p_status='upcoming' then starts_at end asc,
 case when p_status<>'upcoming' then starts_at end desc,id limit p_size offset (p_page-1)*p_size)
 select jsonb_build_object('total',(select count(*) from filtered),'server_now',t,'items',
 coalesce((select jsonb_agg(private.get_club_meeting(id) order by
 case when p_status='upcoming' then starts_at end asc,
 case when p_status<>'upcoming' then starts_at end desc,id) from paged),'[]'::jsonb)) into result;
 return result;
end; $$;
-- Archive uses the existing RPC and its club lock; no changes to request/poll notifications.
create function private.archive_meetings() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.archived_at is null and new.archived_at is not null then
 update public.club_meetings set cancelled_at=clock_timestamp(),cancel_reason='club_archived'
 where club_id=new.id and cancelled_at is null and starts_at>clock_timestamp();
 end if;
 return new;
end; $$;
revoke all on function private.archive_meetings() from public,anon,authenticated;
create trigger clubs_archive_meetings after update of archived_at on public.clubs for each row execute function private.archive_meetings();

revoke all on function private.lock_meeting_owner(uuid,timestamptz),private.create_club_meeting(uuid,jsonb),
 private.update_club_meeting(uuid,jsonb,timestamptz),private.cancel_club_meeting(uuid,timestamptz),
 private.list_club_meetings(uuid,text,integer,integer),private.get_club_meeting(uuid) from public,anon,authenticated;
grant execute on function private.create_club_meeting(uuid,jsonb),private.update_club_meeting(uuid,jsonb,timestamptz),
 private.cancel_club_meeting(uuid,timestamptz),private.list_club_meetings(uuid,text,integer,integer),private.get_club_meeting(uuid) to authenticated;
create function public.create_club_meeting(p_club uuid,p_input jsonb) returns public.club_meetings
language sql security invoker set search_path='' as $$select private.create_club_meeting(p_club,p_input);$$;
create function public.update_club_meeting(p_id uuid,p_input jsonb,p_expected timestamptz) returns public.club_meetings
language sql security invoker set search_path='' as $$select private.update_club_meeting(p_id,p_input,p_expected);$$;
create function public.cancel_club_meeting(p_id uuid,p_expected timestamptz) returns void
language sql security invoker set search_path='' as $$select private.cancel_club_meeting(p_id,p_expected);$$;
create function public.list_club_meetings(p_club uuid,p_status text default 'upcoming',p_page integer default 1,p_size integer default 20) returns jsonb
language sql security invoker set search_path='' as $$select private.list_club_meetings(p_club,p_status,p_page,p_size);$$;
create function public.get_club_meeting(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.get_club_meeting(p_id);$$;
revoke all on function public.create_club_meeting(uuid,jsonb),public.update_club_meeting(uuid,jsonb,timestamptz),
 public.cancel_club_meeting(uuid,timestamptz),public.list_club_meetings(uuid,text,integer,integer),public.get_club_meeting(uuid) from public,anon,authenticated;
grant execute on function public.create_club_meeting(uuid,jsonb),public.update_club_meeting(uuid,jsonb,timestamptz),
 public.cancel_club_meeting(uuid,timestamptz),public.list_club_meetings(uuid,text,integer,integer),public.get_club_meeting(uuid) to authenticated;

-- Preserve date-only history. It is no longer a writable scheduling API.
create or replace function private.create_club(p_input jsonb) returns public.clubs
language plpgsql security definer set search_path='' as $$
declare c public.clubs; actor uuid := private.require_actor();
begin
 if nullif(btrim(p_input->>'current_book'),'') is not null then
 raise exception 'Додайте книгу через книжкову полицю' using errcode='55000'; end if;
 if nullif(btrim(p_input->>'next_meeting'),'') is not null then
 raise exception 'Створіть зустріч через розклад клубу' using errcode='55000'; end if;
 insert into public.clubs(owner_id,name,genre,description,format,language,meetings_per_month)
 values(actor,btrim(p_input->>'name'),btrim(p_input->>'genre'),btrim(p_input->>'description'),
 p_input->>'format',p_input->>'language',(p_input->>'meetings_per_month')::integer) returning * into c;
 insert into public.club_members(club_id,user_id) values(c.id,actor);
 return c;
end; $$;
create or replace function private.update_club(p_id uuid,p_input jsonb) returns public.clubs
language plpgsql security definer set search_path='' as $$
declare c public.clubs;
begin
 perform private.require_actor();
 if not private.manages_club(p_id) then raise exception 'Немає доступу' using errcode='42501'; end if;
 c := private.lock_club(p_id);
 if nullif(btrim(p_input->>'current_book'),'') is not null then
 raise exception 'Редагуйте книгу на книжковій полиці' using errcode='55000'; end if;
 if nullif(btrim(p_input->>'next_meeting'),'') is not null then
 raise exception 'Редагуйте зустріч через розклад клубу' using errcode='55000'; end if;
 update public.clubs set name=btrim(p_input->>'name'),genre=btrim(p_input->>'genre'),
 description=btrim(p_input->>'description'),format=p_input->>'format',language=p_input->>'language',
 meetings_per_month=(p_input->>'meetings_per_month')::integer where id=p_id returning * into c;
 return c;
end; $$;
-- Also reject old function bodies already in flight during deployment.
create function private.keep_legacy_meeting_date() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   if new.next_meeting is not null then
     raise exception 'Створіть зустріч через розклад клубу' using errcode='55000'; end if;
 elsif new.next_meeting is distinct from old.next_meeting then
   raise exception 'Історична дата розкладу незмінна' using errcode='55000';
 end if;
 return new;
end; $$;
revoke all on function private.keep_legacy_meeting_date() from public,anon,authenticated;
create trigger clubs_legacy_meeting_readonly before insert or update of next_meeting on public.clubs
 for each row execute function private.keep_legacy_meeting_date();

create or replace function private.list_clubs() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'owner_id',c.owner_id,'name',c.name,'genre',c.genre,
 'description',c.description,'current_book',(select b.title from public.club_books b where b.club_id=c.id and b.status='current'),
 'format',c.format,'language',c.language,'meetings_per_month',c.meetings_per_month,
 'next_meeting',case when c.archived_at is null then (n.starts_at at time zone n.timezone)::date end,
 'next_meeting_at',case when c.archived_at is null then n.starts_at end,
 'legacy_next_meeting',c.next_meeting,
 'archived_at',c.archived_at,'created_at',c.created_at,'updated_at',c.updated_at,'owner_name',p.name,
 'members_count',(select count(*) from public.club_members m where m.club_id=c.id),
 'is_member',case when private.is_active_user() then private.is_club_member(c.id) else false end)
 from public.clubs c join public.profiles p on p.id=c.owner_id
 left join lateral(select m.starts_at,m.timezone from public.club_meetings m
 where m.club_id=c.id and m.cancelled_at is null and m.starts_at>now() order by m.starts_at,m.id limit 1) n on true
 where private.can_read_club(c.id) order by c.name,c.id;
$$;
notify pgrst, 'reload schema';
commit;


