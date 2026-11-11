begin;
-- Atomic cutover: prevent club writes until backfill, readers and writers agree.
lock table public.clubs in access exclusive mode;

create table public.club_books (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete restrict,
 title text not null check(char_length(title) between 1 and 200),
 author text check(author is null or char_length(btrim(author)) between 1 and 120),
 description text check(description is null or char_length(description) <= 2000),
 cover_url text check(cover_url is null or
   (char_length(cover_url) <= 2048 and cover_url ~ '^https://[^/?#[:space:]@]+([/?#][^[:space:]]*)?$')),
 status text not null default 'planned' check(status in ('planned','current','completed')),
 is_migrated boolean not null default false,
 started_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(is_migrated or (author is not null and char_length(btrim(title)) > 0)),
 check((status='completed' and completed_at is not null) or (status<>'completed' and completed_at is null)),
 check(status<>'planned' or started_at is null),
 check(started_at is null or completed_at is null or completed_at >= started_at)
);
create unique index one_current_book_per_club on public.club_books(club_id) where status='current';
create index club_books_club_status on public.club_books(club_id,status,created_at);
create trigger club_books_touch before update on public.club_books
 for each row execute function private.touch_updated_at();
alter table public.club_books enable row level security;
create policy books_guest on public.club_books for select to anon using(
 exists(select 1 from public.clubs c where c.id=club_id and c.archived_at is null));
create policy books_read on public.club_books for select to authenticated using(private.can_read_club(club_id));
revoke all on public.club_books from public,anon,authenticated;
grant select on public.club_books to anon,authenticated;
grant all on public.club_books to service_role;

-- Preserve original titles exactly, including archived clubs; do not invent authors/start dates.
insert into public.club_books(club_id,title,status,is_migrated)
 select id,current_book,'current',true from public.clubs
 where current_book is not null and current_book <> '';
do $$
begin
 if exists(select 1 from public.clubs c where c.current_book is not null and c.current_book <> ''
   and not exists(select 1 from public.club_books b where b.club_id=c.id
     and b.status='current' and b.title=c.current_book and b.is_migrated)) then
   raise exception 'Backfill verification failed; no legacy column will be removed';
 end if;
end; $$;

create function private.lock_book_owner(p_club uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid := private.require_actor(); c public.clubs;
begin
 select * into c from public.clubs where id=p_club and owner_id=actor for update;
 if not found then raise exception 'Лише власник може змінювати книги' using errcode='42501'; end if;
 if c.archived_at is not null then raise exception 'Клуб архівовано' using errcode='55000'; end if;
end; $$;
revoke all on function private.lock_book_owner(uuid) from public,anon,authenticated;

create function private.save_club_book(p_club uuid,p_input jsonb,p_id uuid default null) returns public.club_books
language plpgsql security definer set search_path='' as $$
declare b public.club_books;
begin
 perform private.lock_book_owner(p_club);
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

create function private.start_club_book(p_id uuid,p_previous_id uuid default null,p_previous_action text default null)
returns public.club_books language plpgsql security definer set search_path='' as $$
declare target public.club_books; previous public.club_books; club uuid;
begin
 perform private.require_actor();
 select b.club_id into club from public.club_books b join public.clubs c on c.id=b.club_id
   where b.id=p_id and c.owner_id=auth.uid();
 if not found then raise exception 'Немає доступу до книги' using errcode='42501'; end if;
 perform private.lock_book_owner(club);
 select * into target from public.club_books where id=p_id for update;
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
 return target;
end; $$;

create function private.complete_club_book(p_id uuid) returns public.club_books
language plpgsql security definer set search_path='' as $$
declare b public.club_books; club uuid;
begin
 perform private.require_actor();
 select x.club_id into club from public.club_books x join public.clubs c on c.id=x.club_id
   where x.id=p_id and c.owner_id=auth.uid();
 if not found then raise exception 'Немає доступу до книги' using errcode='42501'; end if;
 perform private.lock_book_owner(club);
 select * into b from public.club_books where id=p_id for update;
 if b.status<>'current' then raise exception 'Завершити можна лише поточну книгу' using errcode='55000'; end if;
 update public.club_books set status='completed',completed_at=now() where id=p_id returning * into b;
 return b;
end; $$;
revoke all on function private.save_club_book(uuid,jsonb,uuid),private.start_club_book(uuid,uuid,text),
 private.complete_club_book(uuid) from public,anon,authenticated;
grant execute on function private.save_club_book(uuid,jsonb,uuid),private.start_club_book(uuid,uuid,text),
 private.complete_club_book(uuid) to authenticated;

create function public.save_club_book(p_club uuid,p_input jsonb,p_id uuid default null) returns public.club_books
language sql security invoker set search_path='' as $$ select private.save_club_book(p_club,p_input,p_id); $$;
create function public.start_club_book(p_id uuid,p_previous_id uuid default null,p_previous_action text default null)
returns public.club_books language sql security invoker set search_path='' as $$
 select private.start_club_book(p_id,p_previous_id,p_previous_action); $$;
create function public.complete_club_book(p_id uuid) returns public.club_books
language sql security invoker set search_path='' as $$ select private.complete_club_book(p_id); $$;
revoke all on function public.save_club_book(uuid,jsonb,uuid),public.start_club_book(uuid,uuid,text),
 public.complete_club_book(uuid) from public,anon,authenticated;
grant execute on function public.save_club_book(uuid,jsonb,uuid),public.start_club_book(uuid,uuid,text),
 public.complete_club_book(uuid) to authenticated;

-- Stop legacy book writes before dropping their storage. Old nonempty payloads fail explicitly.
create or replace function private.create_club(p_input jsonb) returns public.clubs
language plpgsql security definer set search_path='' as $$
declare c public.clubs; actor uuid := private.require_actor();
begin
 if nullif(btrim(p_input->>'current_book'),'') is not null then
   raise exception 'Додайте книгу через книжкову полицю' using errcode='55000'; end if;
 insert into public.clubs(owner_id,name,genre,description,format,language,meetings_per_month,next_meeting)
 values(actor,btrim(p_input->>'name'),btrim(p_input->>'genre'),btrim(p_input->>'description'),
 p_input->>'format',p_input->>'language',(p_input->>'meetings_per_month')::integer,
 nullif(btrim(p_input->>'next_meeting'),'')::date) returning * into c;
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
 update public.clubs set name=btrim(p_input->>'name'),genre=btrim(p_input->>'genre'),
 description=btrim(p_input->>'description'),format=p_input->>'format',language=p_input->>'language',
 meetings_per_month=(p_input->>'meetings_per_month')::integer,
 next_meeting=nullif(btrim(p_input->>'next_meeting'),'')::date
 where id=p_id returning * into c;
 return c;
end; $$;
create or replace function private.list_clubs() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'owner_id',c.owner_id,'name',c.name,'genre',c.genre,
 'description',c.description,'current_book',(select b.title from public.club_books b where b.club_id=c.id and b.status='current'),
 'format',c.format,'language',c.language,'meetings_per_month',c.meetings_per_month,'next_meeting',c.next_meeting,
 'archived_at',c.archived_at,'created_at',c.created_at,'updated_at',c.updated_at,'owner_name',p.name,
 'members_count',(select count(*) from public.club_members m where m.club_id=c.id),
 'is_member',case when private.is_active_user() then private.is_club_member(c.id) else false end)
 from public.clubs c join public.profiles p on p.id=c.owner_id
 where private.can_read_club(c.id) order by c.name,c.id;
$$;
-- No CASCADE: unexpected external dependencies must abort the entire transaction.
alter table public.clubs drop column current_book;
notify pgrst, 'reload schema';
commit;
