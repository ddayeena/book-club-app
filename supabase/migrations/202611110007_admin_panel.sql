begin;
-- No new table grants or profile RLS expansion. All API responses are explicit projections.
create function private.require_admin() returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.require_actor();
begin
 if not private.is_admin() then raise exception 'Потрібні права адміністратора' using errcode='42501'; end if;
 return actor;
end; $$;
revoke all on function private.require_admin() from public,anon,authenticated;

create function private.admin_get_stats() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 return (select jsonb_build_object(
 'users',(select count(*) from public.user_access),
 'blocked_users',(select count(*) from public.user_access where is_blocked),
 'active_clubs',(select count(*) from public.clubs where archived_at is null),
 'archived_clubs',(select count(*) from public.clubs where archived_at is not null),
 'memberships',(select count(*) from public.club_members),
 'unique_members',(select count(distinct user_id) from public.club_members),
 'requests',(select count(*) from public.join_requests),
 'requests_pending',(select count(*) from public.join_requests where status='pending'),
 'requests_approved',(select count(*) from public.join_requests where status='approved'),
 'requests_rejected',(select count(*) from public.join_requests where status='rejected'),
 'requests_cancelled',(select count(*) from public.join_requests where status='cancelled')));
end; $$;

create function private.admin_list_users(p_search text default '',p_role text default 'all',p_state text default 'all',p_page integer default 1,p_size integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if p_search is null or char_length(p_search)>120 or p_role is null or p_role not in ('all','user','admin')
 or p_state is null or p_state not in ('all','active','blocked') or p_page is null or p_page<1 or p_page>1000000
 or p_size is null or p_size<1 or p_size>50 then raise exception 'Некоректні фільтри' using errcode='22023'; end if;
 return (with filtered as (
 select p.id,p.name,a.role,a.is_blocked,p.created_at from public.profiles p join public.user_access a on a.user_id=p.id
 where (p_role='all' or a.role=p_role) and (p_state='all' or a.is_blocked=(p_state='blocked'))
 and (strpos(lower(p.name),lower(btrim(p_search)))>0 or strpos(p.id::text,lower(btrim(p_search)))>0)
 ), paged as (select * from filtered order by created_at desc,id limit p_size offset (p_page-1)*p_size)
 select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce(
 (select jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role,'is_blocked',is_blocked,'created_at',created_at)
 order by created_at desc,id) from paged),'[]'::jsonb)));
end; $$;

create function private.admin_set_user_blocked(p_user uuid,p_blocked boolean) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; target public.user_access;
begin
 -- Serialize BEFORE locking either actor or target: two admins cannot deadlock or disable each other concurrently.
 if not private.is_admin() then raise exception 'Потрібні права адміністратора' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(20261111,7);
 actor := private.require_admin();
 if p_blocked is null then raise exception 'Потрібен стан блокування' using errcode='22023'; end if;
 if p_user=actor and p_blocked then raise exception 'Не можна заблокувати себе' using errcode='42501'; end if;
 select * into target from public.user_access where user_id=p_user for update;
 if not found then raise exception 'Користувача не знайдено' using errcode='P0002'; end if;
 if p_blocked and target.role='admin' and not target.is_blocked and
 (select count(*) from public.user_access where role='admin' and not is_blocked)<=1 then
 raise exception 'Останнього активного адміністратора не можна заблокувати' using errcode='55000'; end if;
 update public.user_access set is_blocked=p_blocked where user_id=p_user;
end; $$;

create function private.admin_list_clubs(p_search text default '',p_state text default 'all',p_page integer default 1,p_size integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin();
 if p_search is null or char_length(p_search)>120 or p_state is null or p_state not in ('all','active','archived')
 or p_page is null or p_page<1 or p_page>1000000 or p_size is null or p_size<1 or p_size>50 then
 raise exception 'Некоректні фільтри' using errcode='22023'; end if;
 return (with filtered as (
 select c.id,c.name,c.owner_id,p.name owner_name,c.archived_at,c.created_at from public.clubs c join public.profiles p on p.id=c.owner_id
 where (p_state='all' or (c.archived_at is not null)=(p_state='archived'))
 and (strpos(lower(c.name),lower(btrim(p_search)))>0 or strpos(lower(p.name),lower(btrim(p_search)))>0)
 ), paged as (select * from filtered order by created_at desc,id limit p_size offset (p_page-1)*p_size)
 select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce(
 (select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'owner_id',c.owner_id,'owner_name',c.owner_name,
 'archived_at',c.archived_at,'created_at',c.created_at,
 'members_count',(select count(*) from public.club_members m where m.club_id=c.id)) order by c.created_at desc,c.id) from paged c),'[]'::jsonb)));
end; $$;

revoke all on function private.admin_get_stats(),private.admin_list_users(text,text,text,integer,integer),
 private.admin_set_user_blocked(uuid,boolean),private.admin_list_clubs(text,text,integer,integer) from public,anon,authenticated;
grant execute on function private.admin_get_stats(),private.admin_list_users(text,text,text,integer,integer),
 private.admin_set_user_blocked(uuid,boolean),private.admin_list_clubs(text,text,integer,integer) to authenticated;

create function public.admin_get_stats() returns jsonb language sql security invoker set search_path='' as $$ select private.admin_get_stats(); $$;
create function public.admin_list_users(p_search text default '',p_role text default 'all',p_state text default 'all',p_page integer default 1,p_size integer default 20)
returns jsonb language sql security invoker set search_path='' as $$ select private.admin_list_users(p_search,p_role,p_state,p_page,p_size); $$;
create function public.admin_set_user_blocked(p_user uuid,p_blocked boolean) returns void
language sql security invoker set search_path='' as $$ select private.admin_set_user_blocked(p_user,p_blocked); $$;
create function public.admin_list_clubs(p_search text default '',p_state text default 'all',p_page integer default 1,p_size integer default 20)
returns jsonb language sql security invoker set search_path='' as $$ select private.admin_list_clubs(p_search,p_state,p_page,p_size); $$;
revoke all on function public.admin_get_stats(),public.admin_list_users(text,text,text,integer,integer),
 public.admin_set_user_blocked(uuid,boolean),public.admin_list_clubs(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_get_stats(),public.admin_list_users(text,text,text,integer,integer),
 public.admin_set_user_blocked(uuid,boolean),public.admin_list_clubs(text,text,integer,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
