begin;
-- All lifecycle writes lock the club first, then the request. No direct client writes.
create function private.require_actor() returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
 perform 1 from public.user_access where user_id=actor and not is_blocked for share;
 if not found then raise exception 'Потрібен активний обліковий запис' using errcode='42501'; end if;
 return actor;
end; $$;
create function private.lock_club(p_id uuid, p_allow_archived boolean default false) returns public.clubs
language plpgsql security definer set search_path='' as $$
declare c public.clubs;
begin
 perform private.require_actor();
 if not private.can_read_club(p_id) then
 raise exception 'Клуб не знайдено' using errcode='P0002'; end if;
 select * into c from public.clubs where id=p_id for update;
 if not found then raise exception 'Клуб не знайдено' using errcode='P0002'; end if;
 if c.archived_at is not null and not p_allow_archived then
 raise exception 'Клуб архівовано' using errcode='55000'; end if;
 return c;
end; $$;
revoke all on function private.require_actor(),private.lock_club(uuid,boolean) from public,anon,authenticated;

create function private.create_club(p_input jsonb) returns public.clubs
language plpgsql security definer set search_path='' as $$
declare c public.clubs; actor uuid := private.require_actor();
begin
 insert into public.clubs(owner_id,name,genre,description,current_book,format,language,meetings_per_month,next_meeting)
 values(actor,btrim(p_input->>'name'),btrim(p_input->>'genre'),btrim(p_input->>'description'),
 nullif(btrim(p_input->>'current_book'),''),p_input->>'format',p_input->>'language',
 (p_input->>'meetings_per_month')::integer,nullif(btrim(p_input->>'next_meeting'),'')::date) returning * into c;
 insert into public.club_members(club_id,user_id) values(c.id,actor);
 return c;
end; $$;
create function private.update_club(p_id uuid,p_input jsonb) returns public.clubs
language plpgsql security definer set search_path='' as $$
declare c public.clubs;
begin
 perform private.require_actor();
 if not private.manages_club(p_id) then raise exception 'Немає доступу' using errcode='42501'; end if;
 c := private.lock_club(p_id);
 update public.clubs set name=btrim(p_input->>'name'),genre=btrim(p_input->>'genre'),
 description=btrim(p_input->>'description'),current_book=nullif(btrim(p_input->>'current_book'),''),
 format=p_input->>'format',language=p_input->>'language',
 meetings_per_month=(p_input->>'meetings_per_month')::integer,next_meeting=nullif(btrim(p_input->>'next_meeting'),'')::date
 where id=p_id returning * into c;
 return c;
end; $$;

create function private.submit_join_request(p_input jsonb) returns public.join_requests
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.require_actor(); c public.clubs := private.lock_club((p_input->>'club_id')::uuid);
 r public.join_requests;
begin
 if exists(select 1 from public.club_members where club_id=c.id and user_id=actor) then
 raise exception 'Ви вже учасник клубу' using errcode='23505'; end if;
 insert into public.join_requests(club_id,applicant_id,motivation,weekly_hours,wants_reminders,experience,participation_format,contact_email)
 values(c.id,actor,btrim(p_input->>'motivation'),(p_input->>'weekly_hours')::integer,
 (p_input->>'wants_reminders')::boolean,p_input->>'experience',p_input->>'participation_format',
 lower(btrim(coalesce(p_input->>'contact_email','')))) returning * into r;
 insert into public.notifications(recipient_id,club_id,request_id,type,body)
 values(c.owner_id,c.id,r.id,'new_request','Нова заявка до клубу «' || c.name || '».');
 return r;
end; $$;

create function private.update_join_request(p_id uuid,p_input jsonb) returns public.join_requests
language plpgsql security definer set search_path='' as $$
declare r public.join_requests; club uuid; actor uuid := private.require_actor();
begin
 select club_id into club from public.join_requests where id=p_id and applicant_id=actor;
 if not found then raise exception 'Немає доступу до заявки' using errcode='42501'; end if;
 perform private.lock_club(club);
 select * into r from public.join_requests where id=p_id for update;
 if r.applicant_id is distinct from actor or r.status <> 'pending' then
 raise exception 'Редагувати можна лише власну очікувану заявку' using errcode='42501'; end if;
 update public.join_requests set motivation=btrim(p_input->>'motivation'),weekly_hours=(p_input->>'weekly_hours')::integer,
 wants_reminders=(p_input->>'wants_reminders')::boolean,experience=p_input->>'experience',
 participation_format=p_input->>'participation_format',contact_email=lower(btrim(coalesce(p_input->>'contact_email','')))
 where id=p_id returning * into r;
 return r;
end; $$;
create function private.cancel_join_request(p_id uuid) returns public.join_requests
language plpgsql security definer set search_path='' as $$
declare r public.join_requests; club uuid; actor uuid := private.require_actor();
begin
 select club_id into club from public.join_requests where id=p_id and applicant_id=actor;
 if not found then raise exception 'Немає доступу до заявки' using errcode='42501'; end if;
 perform private.lock_club(club);
 select * into r from public.join_requests where id=p_id for update;
 if r.applicant_id is distinct from actor or r.status <> 'pending' then
 raise exception 'Скасувати можна лише власну очікувану заявку' using errcode='42501'; end if;
 update public.join_requests set status='cancelled' where id=p_id returning * into r;
 return r;
end; $$;
create function private.review_join_request(p_id uuid,p_decision text,p_comment text default '') returns public.join_requests
language plpgsql security definer set search_path='' as $$
declare r public.join_requests; club uuid; actor uuid := private.require_actor();
begin
 select club_id into club from public.join_requests where id=p_id and private.manages_club(club_id);
 if not found then raise exception 'Немає доступу до заявки' using errcode='42501'; end if;
 perform private.lock_club(club);
 if not private.manages_club(club) then raise exception 'Немає доступу' using errcode='42501'; end if;
 select * into r from public.join_requests where id=p_id for update;
 if r.applicant_id=actor then raise exception 'Не можна розглядати власну заявку' using errcode='42501'; end if;
 if r.status <> 'pending' then raise exception 'Заявку вже розглянуто' using errcode='55000'; end if;
 if p_decision is null or p_decision not in ('approved','rejected') then
 raise exception 'Некоректне рішення' using errcode='22023'; end if;
 -- Lock applicant access too: a blocked account cannot become a member.
 perform 1 from public.user_access where user_id=r.applicant_id and not is_blocked for share;
 if not found and p_decision='approved' then raise exception 'Заявника заблоковано' using errcode='42501'; end if;
 if p_decision='approved' then insert into public.club_members(club_id,user_id) values(club,r.applicant_id); end if;
 update public.join_requests set status=p_decision,reviewed_by=actor,reviewed_at=now(),decision_comment=p_comment
 where id=p_id returning * into r;
 insert into public.notifications(recipient_id,club_id,request_id,type,body)
 values(r.applicant_id,club,r.id,'request_decision',case when p_decision='approved' then 'Заявку схвалено.' else 'Заявку відхилено.' end);
 return r;
end; $$;
create function private.remove_club_member(p_club uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.clubs; actor uuid := private.require_actor();
begin
 if not private.manages_club(p_club) and not (p_user=actor and private.is_club_member(p_club)) then
 raise exception 'Немає доступу' using errcode='42501'; end if;
 c := private.lock_club(p_club,true);
 if p_user=c.owner_id then raise exception 'Власник не може залишити клуб' using errcode='42501'; end if;
 if p_user is distinct from actor and not private.manages_club(p_club) then
 raise exception 'Немає доступу' using errcode='42501'; end if;
 delete from public.club_members where club_id=p_club and user_id=p_user;
 if not found then raise exception 'Учасника не знайдено' using errcode='P0002'; end if;
end; $$;
create function private.archive_club(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.clubs; r public.join_requests;
begin
 perform private.require_actor();
 if not private.manages_club(p_id) then raise exception 'Немає доступу' using errcode='42501'; end if;
 c := private.lock_club(p_id,true);
 if c.archived_at is not null then return; end if;
 update public.clubs set archived_at=now() where id=p_id;
 for r in update public.join_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),
 decision_comment='Клуб архівовано.' where club_id=p_id and status='pending' returning * loop
 insert into public.notifications(recipient_id,club_id,request_id,type,body)
 values(r.applicant_id,p_id,r.id,'request_decision','Клуб архівовано. Заявку відхилено.');
 end loop;
end; $$;

-- Explicit projections: no email or profile reminder settings in public responses.
create function private.list_clubs() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'owner_id',c.owner_id,'name',c.name,'genre',c.genre,
 'description',c.description,'current_book',c.current_book,'format',c.format,'language',c.language,
 'meetings_per_month',c.meetings_per_month,'next_meeting',c.next_meeting,
 'archived_at',c.archived_at,'created_at',c.created_at,'updated_at',c.updated_at,'owner_name',p.name,
 'members_count',(select count(*) from public.club_members m where m.club_id=c.id),
 'is_member',case when private.is_active_user() then private.is_club_member(c.id) else false end)
 from public.clubs c join public.profiles p on p.id=c.owner_id
 where private.can_read_club(c.id) order by c.name,c.id;
$$;
create function private.list_club_members(p_club uuid) returns table(user_id uuid,name text,avatar_path text,joined_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_active_user() or not (private.is_club_member(p_club) or private.manages_club(p_club)) then
 raise exception 'Немає доступу' using errcode='42501'; end if;
 return query select m.user_id,p.name,p.avatar_path,m.joined_at from public.club_members m
 join public.profiles p on p.id=m.user_id where m.club_id=p_club order by m.joined_at,m.user_id;
end; $$;

revoke all on function private.create_club(jsonb),private.update_club(uuid,jsonb),
 private.submit_join_request(jsonb),private.update_join_request(uuid,jsonb),private.cancel_join_request(uuid),
 private.review_join_request(uuid,text,text),private.remove_club_member(uuid,uuid),private.archive_club(uuid),
 private.list_club_members(uuid),private.list_clubs() from public,anon,authenticated;
grant execute on function private.create_club(jsonb),private.update_club(uuid,jsonb),
 private.submit_join_request(jsonb),private.update_join_request(uuid,jsonb),private.cancel_join_request(uuid),
 private.review_join_request(uuid,text,text),private.remove_club_member(uuid,uuid),private.archive_club(uuid),
 private.list_club_members(uuid),private.list_clubs() to authenticated;
grant execute on function private.list_clubs() to anon;

-- Exposed RPCs are SECURITY INVOKER wrappers. Privileged implementations stay
-- in the unexposed private schema; they still validate every caller and operation.
-- anon receives schema USAGE only, not blanket EXECUTE on private functions.
grant usage on schema private to anon;

create function public.create_club(p_input jsonb) returns public.clubs
language sql  security invoker set search_path='' as $$
 select private.create_club(p_input);
$$;
revoke all on function public.create_club(jsonb) from public,anon,authenticated;
grant execute on function public.create_club(jsonb) to authenticated;

create function public.update_club(p_id uuid,p_input jsonb) returns public.clubs
language sql  security invoker set search_path='' as $$
 select private.update_club(p_id,p_input);
$$;
revoke all on function public.update_club(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_club(uuid,jsonb) to authenticated;

create function public.submit_join_request(p_input jsonb) returns public.join_requests
language sql  security invoker set search_path='' as $$
 select private.submit_join_request(p_input);
$$;
revoke all on function public.submit_join_request(jsonb) from public,anon,authenticated;
grant execute on function public.submit_join_request(jsonb) to authenticated;

create function public.update_join_request(p_id uuid,p_input jsonb) returns public.join_requests
language sql  security invoker set search_path='' as $$
 select private.update_join_request(p_id,p_input);
$$;
revoke all on function public.update_join_request(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.update_join_request(uuid,jsonb) to authenticated;

create function public.cancel_join_request(p_id uuid) returns public.join_requests
language sql  security invoker set search_path='' as $$
 select private.cancel_join_request(p_id);
$$;
revoke all on function public.cancel_join_request(uuid) from public,anon,authenticated;
grant execute on function public.cancel_join_request(uuid) to authenticated;

create function public.review_join_request(p_id uuid,p_decision text,p_comment text default '') returns public.join_requests
language sql  security invoker set search_path='' as $$
 select private.review_join_request(p_id,p_decision,p_comment);
$$;
revoke all on function public.review_join_request(uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_join_request(uuid,text,text) to authenticated;

create function public.remove_club_member(p_club uuid,p_user uuid) returns void
language sql  security invoker set search_path='' as $$
 select private.remove_club_member(p_club,p_user);
$$;
revoke all on function public.remove_club_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_club_member(uuid,uuid) to authenticated;

create function public.archive_club(p_id uuid) returns void
language sql  security invoker set search_path='' as $$
 select private.archive_club(p_id);
$$;
revoke all on function public.archive_club(uuid) from public,anon,authenticated;
grant execute on function public.archive_club(uuid) to authenticated;

create function public.list_clubs() returns setof jsonb
language sql stable security invoker set search_path='' as $$
 select * from private.list_clubs();
$$;
revoke all on function public.list_clubs() from public,anon,authenticated;
grant execute on function public.list_clubs() to authenticated;

create function public.list_club_members(p_club uuid) returns table(user_id uuid,name text,avatar_path text,joined_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select * from private.list_club_members(p_club);
$$;
revoke all on function public.list_club_members(uuid) from public,anon,authenticated;
grant execute on function public.list_club_members(uuid) to authenticated;
grant execute on function public.list_clubs() to anon;
commit;
