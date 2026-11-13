begin;
create table public.book_polls (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete restrict,
 title text not null check(char_length(btrim(title)) between 3 and 120),
 created_at timestamptz not null default clock_timestamp(),
 ends_at timestamptz not null check(isfinite(ends_at) and ends_at > created_at),
 finalized_at timestamptz, winner_option_id uuid,
 cancelled_at timestamptz, cancel_reason text check(cancel_reason in ('owner','club_archived')),
 selection_consumed_at timestamptz,
 unique(id,club_id),
 check(not (finalized_at is not null and cancelled_at is not null)),
 check((finalized_at is null) = (winner_option_id is null)),
 check((cancelled_at is null) = (cancel_reason is null)),
 check(selection_consumed_at is null or finalized_at is not null),
 check(finalized_at is null or finalized_at >= ends_at)
);
create unique index one_unresolved_poll on public.book_polls(club_id)
 where finalized_at is null and cancelled_at is null;
create index polls_club_history on public.book_polls(club_id,created_at desc);
create unique index books_id_club on public.club_books(id,club_id);
create table public.book_poll_options (
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null, club_id uuid not null, book_id uuid not null,
 position integer not null check(position > 0),
 title_snapshot text not null, author_snapshot text,
 foreign key(poll_id,club_id) references public.book_polls(id,club_id) on delete restrict,
 foreign key(book_id,club_id) references public.club_books(id,club_id) on delete restrict,
 unique(poll_id,book_id), unique(poll_id,position), unique(poll_id,id)
);
alter table public.book_polls add constraint winner_belongs_to_poll
 foreign key(id,winner_option_id) references public.book_poll_options(poll_id,id) on delete restrict;
create index poll_options_book on public.book_poll_options(book_id,club_id);
create index poll_winner on public.book_polls(id,winner_option_id);
create table public.book_votes (
 poll_id uuid not null, user_id uuid not null references public.profiles(id) on delete restrict,
 option_id uuid not null, created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(poll_id,user_id),
 foreign key(poll_id,option_id) references public.book_poll_options(poll_id,id) on delete restrict
);
create index votes_option on public.book_votes(poll_id,option_id);
create index votes_user on public.book_votes(user_id);
create function private.can_read_polls(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active_user() and (private.is_club_member(p_club) or private.manages_club(p_club)
   or exists(select 1 from public.clubs where id=p_club and archived_at is not null and private.can_read_club(id)));
$$;
revoke all on function private.can_read_polls(uuid) from public,anon,authenticated;
grant execute on function private.can_read_polls(uuid) to authenticated;
alter table public.book_polls enable row level security;
alter table public.book_poll_options enable row level security;
alter table public.book_votes enable row level security;
create policy polls_read on public.book_polls for select to authenticated using(private.can_read_polls(club_id));
create policy options_read on public.book_poll_options for select to authenticated using(private.can_read_polls(club_id));
create policy votes_self on public.book_votes for select to authenticated using(
 user_id=auth.uid() and exists(select 1 from public.book_polls p where p.id=poll_id and private.can_read_polls(p.club_id)));
revoke all on public.book_polls,public.book_poll_options,public.book_votes from public,anon,authenticated;
grant select on public.book_polls,public.book_poll_options,public.book_votes to authenticated;
grant all on public.book_polls,public.book_poll_options,public.book_votes to service_role;

create function private.book_in_unresolved_poll(p_book uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.book_poll_options o join public.book_polls p on p.id=o.poll_id
 where o.book_id=p_book and p.finalized_at is null and p.cancelled_at is null);
$$;
create function private.lock_poll(p_id uuid,p_owner boolean default false) returns public.book_polls
language plpgsql security definer set search_path='' as $$
declare club uuid; p public.book_polls;
begin
 perform private.require_actor();
 select bp.club_id into club from public.book_polls bp where bp.id=p_id
   and case when p_owner then exists(select 1 from public.clubs c where c.id=bp.club_id and c.owner_id=auth.uid())
       else private.can_read_polls(bp.club_id) end;
 if not found then raise exception 'Немає доступу до голосування' using errcode='42501'; end if;
 if p_owner then perform private.lock_book_owner(club); else perform private.lock_club(club); end if;
 select * into p from public.book_polls where id=p_id for update;
 return p;
end; $$;
revoke all on function private.book_in_unresolved_poll(uuid),private.lock_poll(uuid,boolean) from public,anon,authenticated;

create function private.create_book_poll(p_club uuid,p_title text,p_ends_at timestamptz,p_books uuid[])
returns public.book_polls language plpgsql security definer set search_path='' as $$
declare p public.book_polls; count_books integer;
begin
 perform private.lock_book_owner(p_club);
 if p_ends_at is null or not isfinite(p_ends_at) or p_ends_at <= clock_timestamp() then
 raise exception 'Оберіть майбутній строк завершення' using errcode='22023'; end if;
 if p_books is null or cardinality(p_books)<2 then raise exception 'Оберіть щонайменше дві книги' using errcode='22023'; end if;
 select count(*) into count_books from public.club_books where club_id=p_club and id=any(p_books) and status='planned';
 if count_books <> cardinality(p_books) then raise exception 'Книги мають бути різними, запланованими та з цього клубу' using errcode='22023'; end if;
 insert into public.book_polls(club_id,title,ends_at) values(p_club,btrim(p_title),p_ends_at) returning * into p;
 insert into public.book_poll_options(poll_id,club_id,book_id,position,title_snapshot,author_snapshot)
 select p.id,p_club,b.id,ids.position::integer,b.title,b.author
 from unnest(p_books) with ordinality ids(id,position) join public.club_books b on b.id=ids.id;
 return p;
end; $$;

create function private.cast_book_vote(p_poll uuid,p_option uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.book_polls := private.lock_poll(p_poll); actor uuid := auth.uid(); vote_time timestamptz;
begin
 if not exists(select 1 from public.club_members where club_id=p.club_id and user_id=actor) then
 raise exception 'Голосувати можуть лише чинні учасники' using errcode='42501'; end if;
 if p.finalized_at is not null or p.cancelled_at is not null then raise exception 'Голосування закрите' using errcode='55000'; end if;
 if not exists(select 1 from public.book_poll_options where poll_id=p_poll and id=p_option) then
 raise exception 'Варіант не належить голосуванню' using errcode='22023'; end if;
 -- Check actual clock AFTER waiting for the club/poll locks, immediately before writing.
 vote_time := clock_timestamp();
 if vote_time >= p.ends_at then raise exception 'Строк голосування завершився' using errcode='55000'; end if;
 insert into public.book_votes(poll_id,user_id,option_id,created_at,updated_at)
 values(p_poll,actor,p_option,vote_time,vote_time)
 on conflict(poll_id,user_id) do update set option_id=excluded.option_id,updated_at=excluded.updated_at;
end; $$;

create function private.finalize_book_poll(p_poll uuid,p_option uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.book_polls := private.lock_poll(p_poll,true); best bigint; selected bigint;
begin
 if p.finalized_at is not null or p.cancelled_at is not null or clock_timestamp()<p.ends_at then
 raise exception 'Результат поки недоступний або вже зафіксований' using errcode='55000'; end if;
 select max(t.votes) into best from (
   select o.id,count(v.user_id) votes from public.book_poll_options o
   left join public.book_votes v on v.poll_id=o.poll_id and v.option_id=o.id
   where o.poll_id=p_poll group by o.id) t;
 select count(v.user_id) into selected from public.book_poll_options o
 left join public.book_votes v on v.poll_id=o.poll_id and v.option_id=o.id
 where o.poll_id=p_poll and o.id=p_option group by o.id;
 if selected is null or selected <> best then raise exception 'Оберіть один із варіантів із найбільшою кількістю голосів' using errcode='22023'; end if;
 if not exists(select 1 from public.book_poll_options o join public.club_books b on b.id=o.book_id
 where o.poll_id=p_poll and o.id=p_option and b.status='planned') then
 raise exception 'Стан книги змінився' using errcode='55000'; end if;
 update public.book_polls set winner_option_id=p_option,finalized_at=clock_timestamp() where id=p_poll;
end; $$;

create function private.cancel_book_poll(p_poll uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.book_polls := private.lock_poll(p_poll,true);
begin
 if p.finalized_at is not null or p.cancelled_at is not null then raise exception 'Голосування вже завершене' using errcode='55000'; end if;
 update public.book_polls set cancelled_at=clock_timestamp(),cancel_reason='owner' where id=p_poll;
end; $$;

create function private.get_book_poll(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.book_polls; c public.clubs; total bigint; options jsonb; server_time timestamptz := clock_timestamp();
begin
 select * into p from public.book_polls where id=p_id and private.can_read_polls(club_id);
 if not found then raise exception 'Немає доступу до голосування' using errcode='42501'; end if;
 select * into c from public.clubs where id=p.club_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'book_id',t.book_id,
   'title',t.title_snapshot,'author',t.author_snapshot,'votes',t.votes) order by t.position),'[]'::jsonb),coalesce(sum(t.votes),0)
 into options,total from (select o.*,count(v.user_id) votes from public.book_poll_options o
 left join public.book_votes v on v.poll_id=o.poll_id and v.option_id=o.id
 where o.poll_id=p_id group by o.id) t;
 return jsonb_build_object('id',p.id,'club_id',p.club_id,'title',p.title,'ends_at',p.ends_at,
 'server_now',server_time,'finalized_at',p.finalized_at,'cancelled_at',p.cancelled_at,'cancel_reason',p.cancel_reason,
 'selection_consumed_at',p.selection_consumed_at,'winner_option_id',p.winner_option_id,
 'status',case when p.cancelled_at is not null then 'cancelled' when p.finalized_at is not null then 'finalized'
   when server_time>=p.ends_at then 'closed' else 'open' end,
 'total_votes',total,'options',options,
 'my_option_id',(select option_id from public.book_votes where poll_id=p_id and user_id=auth.uid()),
 'can_vote',c.archived_at is null and p.finalized_at is null and p.cancelled_at is null
   and server_time<p.ends_at and private.is_club_member(p.club_id),
 'can_finalize',c.archived_at is null and c.owner_id=auth.uid() and p.finalized_at is null and p.cancelled_at is null and server_time>=p.ends_at,
 'can_cancel',c.archived_at is null and c.owner_id=auth.uid() and p.finalized_at is null and p.cancelled_at is null);
end; $$;
create function private.list_book_polls(p_club uuid) returns setof jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not private.can_read_polls(p_club) then raise exception 'Немає доступу' using errcode='42501'; end if;
 return query select private.get_book_poll(id) from public.book_polls where club_id=p_club order by created_at desc,id desc;
end; $$;

-- Public bookshelf annotations do not expose voters or results.
create function private.get_club_book_flags(p_club uuid) returns table(book_id uuid,is_poll_locked boolean,is_next_selected boolean)
language sql stable security definer set search_path='' as $$
 select b.id,private.book_in_unresolved_poll(b.id),
   coalesce(b.status='planned' and p.selection_consumed_at is null and o.book_id=b.id,false)
 from public.club_books b
 left join lateral (select x.* from public.book_polls x where x.club_id=p_club and x.finalized_at is not null
   order by x.finalized_at desc,x.id desc limit 1) p on true
 left join public.book_poll_options o on o.poll_id=p.id and o.id=p.winner_option_id
 where b.club_id=p_club and private.can_read_club(p_club);
$$;

revoke all on function private.create_book_poll(uuid,text,timestamptz,uuid[]),private.cast_book_vote(uuid,uuid),
 private.finalize_book_poll(uuid,uuid),private.cancel_book_poll(uuid),private.get_book_poll(uuid),
 private.list_book_polls(uuid),private.get_club_book_flags(uuid) from public,anon,authenticated;
grant execute on function private.create_book_poll(uuid,text,timestamptz,uuid[]),private.cast_book_vote(uuid,uuid),
 private.finalize_book_poll(uuid,uuid),private.cancel_book_poll(uuid),private.get_book_poll(uuid),
 private.list_book_polls(uuid),private.get_club_book_flags(uuid) to authenticated;
grant execute on function private.get_club_book_flags(uuid) to anon;

create function public.create_book_poll(p_club uuid,p_title text,p_ends_at timestamptz,p_books uuid[]) returns public.book_polls
language sql security invoker set search_path='' as $$ select private.create_book_poll(p_club,p_title,p_ends_at,p_books); $$;
create function public.cast_book_vote(p_poll uuid,p_option uuid) returns void
language sql security invoker set search_path='' as $$ select private.cast_book_vote(p_poll,p_option); $$;
create function public.finalize_book_poll(p_poll uuid,p_option uuid) returns void
language sql security invoker set search_path='' as $$ select private.finalize_book_poll(p_poll,p_option); $$;
create function public.cancel_book_poll(p_poll uuid) returns void
language sql security invoker set search_path='' as $$ select private.cancel_book_poll(p_poll); $$;
create function public.get_book_poll(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_book_poll(p_id); $$;
create function public.list_book_polls(p_club uuid) returns setof jsonb
language sql security invoker set search_path='' as $$ select * from private.list_book_polls(p_club); $$;
create function public.get_club_book_flags(p_club uuid) returns table(book_id uuid,is_poll_locked boolean,is_next_selected boolean)
language sql stable security invoker set search_path='' as $$ select * from private.get_club_book_flags(p_club); $$;
revoke all on function public.create_book_poll(uuid,text,timestamptz,uuid[]),public.cast_book_vote(uuid,uuid),
 public.finalize_book_poll(uuid,uuid),public.cancel_book_poll(uuid),public.get_book_poll(uuid),
 public.list_book_polls(uuid),public.get_club_book_flags(uuid) from public,anon,authenticated;
grant execute on function public.create_book_poll(uuid,text,timestamptz,uuid[]),public.cast_book_vote(uuid,uuid),
 public.finalize_book_poll(uuid,uuid),public.cancel_book_poll(uuid),public.get_book_poll(uuid),
 public.list_book_polls(uuid),public.get_club_book_flags(uuid) to authenticated;
grant execute on function public.get_club_book_flags(uuid) to anon;

create or replace function private.save_club_book(p_club uuid,p_input jsonb,p_id uuid default null) returns public.club_books
language plpgsql security definer set search_path='' as $$
declare b public.club_books;
begin
 perform private.lock_book_owner(p_club);
 if p_id is not null and private.book_in_unresolved_poll(p_id) then
   raise exception 'Книга заблокована незавершеним голосуванням' using errcode='55000'; end if;
 if p_id is null then
   insert into public.club_books(club_id,title,author,description,cover_url)
   values(p_club,btrim(p_input->>'title'),nullif(btrim(p_input->>'author'),''),
     nullif(btrim(p_input->>'description'),''),nullif(btrim(p_input->>'cover_url'),''))
   returning * into b;
 else
   select * into b from public.club_books where id=p_id and club_id=p_club for update;
   if not found then raise exception 'Книгу не знайдено' using errcode='P0002'; end if;
   update public.club_books set title=btrim(p_input->>'title'),author=nullif(btrim(p_input->>'author'),''),
     description=nullif(btrim(p_input->>'description'),''),cover_url=nullif(btrim(p_input->>'cover_url'),'')
   where id=p_id returning * into b;
 end if;
 return b;
end; $$;
create or replace function private.start_club_book(p_id uuid,p_previous_id uuid default null,p_previous_action text default null)
returns public.club_books language plpgsql security definer set search_path='' as $$
declare target public.club_books; previous public.club_books; club uuid;
begin
 perform private.require_actor();
 select b.club_id into club from public.club_books b join public.clubs c on c.id=b.club_id
   where b.id=p_id and c.owner_id=auth.uid();
 if not found then raise exception 'Немає доступу до книги' using errcode='42501'; end if;
 perform private.lock_book_owner(club);
 select * into target from public.club_books where id=p_id for update;
 if private.book_in_unresolved_poll(p_id) then
   raise exception 'Книга заблокована незавершеним голосуванням' using errcode='55000'; end if;
 if target.status<>'planned' then raise exception 'Почати можна лише заплановану книгу' using errcode='55000'; end if;
 select * into previous from public.club_books where club_id=club and status='current' for update;
 if found then
   if p_previous_id is distinct from previous.id or p_previous_action is null
      or p_previous_action not in ('planned','completed') then
     raise exception 'Оберіть дію для актуальної поточної книги' using errcode='55000';
   end if;
   update public.club_books set status=p_previous_action,
     started_at=case when p_previous_action='planned' then null else started_at end,
     completed_at=case when p_previous_action='completed' then now() else null end
   where id=previous.id;
 elsif p_previous_id is not null or p_previous_action is not null then
   raise exception 'Поточна книга змінилася; оновіть полицю' using errcode='55000';
 end if;
 update public.club_books set status='current',started_at=now(),completed_at=null where id=p_id returning * into target;
 update public.book_polls p set selection_consumed_at=clock_timestamp()
 where p.id=(select x.id from public.book_polls x where x.club_id=club and x.finalized_at is not null
   order by x.finalized_at desc,x.id desc limit 1)
 and p.selection_consumed_at is null and exists(select 1 from public.book_poll_options o
   where o.poll_id=p.id and o.id=p.winner_option_id and o.book_id=p_id);
 return target;
end; $$;
create or replace function private.archive_club(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.clubs; r public.join_requests;
begin
 perform private.require_actor();
 if not private.manages_club(p_id) then raise exception 'Немає доступу' using errcode='42501'; end if;
 c := private.lock_club(p_id,true);
 if c.archived_at is not null then return; end if;
 update public.clubs set archived_at=now() where id=p_id;
 update public.book_polls set cancelled_at=clock_timestamp(),cancel_reason='club_archived'
 where club_id=p_id and finalized_at is null and cancelled_at is null;
 for r in update public.join_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),
 decision_comment='Клуб архівовано.' where club_id=p_id and status='pending' returning * loop
 insert into public.notifications(recipient_id,club_id,request_id,type,body)
 values(r.applicant_id,p_id,r.id,'request_decision','Клуб архівовано. Заявку відхилено.');
 end loop;
end; $$;
notify pgrst, 'reload schema';
commit;
