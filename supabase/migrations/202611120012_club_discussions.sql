begin;
-- Match ECMAScript trim(), including non-breaking spaces and vertical tabs.
create function private.discussion_trim(p_text text) returns text
language sql immutable strict security invoker set search_path='' as $$
 select btrim(p_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;
revoke all on function private.discussion_trim(text) from public,anon,authenticated;
create table public.club_discussions (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete restrict,
 author_id uuid not null references public.profiles(id) on delete restrict,
 book_id uuid,
 title text, body text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete restrict,
 foreign key(book_id,club_id) references public.club_books(id,club_id) on delete restrict,
 check((deleted_at is null and deleted_by is null and title is not null and body is not null
   and char_length(private.discussion_trim(title)) between 3 and 120 and char_length(private.discussion_trim(body)) between 1 and 10000)
   or (deleted_at is not null and deleted_by is not null and title is null and body is null))
);
create table public.club_discussion_comments (
 id uuid primary key default gen_random_uuid(),
 discussion_id uuid not null references public.club_discussions(id) on delete restrict,
 author_id uuid not null references public.profiles(id) on delete restrict,
 body text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 deleted_at timestamptz, deleted_by uuid references public.profiles(id) on delete restrict,
 check((deleted_at is null and deleted_by is null and body is not null and char_length(private.discussion_trim(body)) between 1 and 2000)
   or (deleted_at is not null and deleted_by is not null and body is null))
);
create index discussions_club_page on public.club_discussions(club_id,created_at desc,id desc) where deleted_at is null;
create index discussions_book_page on public.club_discussions(club_id,book_id,created_at desc,id desc) where deleted_at is null;
create index comments_discussion_page on public.club_discussion_comments(discussion_id,created_at,id);
create index discussions_author on public.club_discussions(author_id);
create index comments_author on public.club_discussion_comments(author_id);
create index discussions_deleted_by on public.club_discussions(deleted_by);
create index comments_deleted_by on public.club_discussion_comments(deleted_by);
alter table public.club_discussions enable row level security;
alter table public.club_discussion_comments enable row level security;
-- RPC-only projections; no raw client access, including deleted text or identities.
revoke all on public.club_discussions,public.club_discussion_comments from public,anon,authenticated;

create function private.discussion_touch() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 new.created_at:=old.created_at;
 new.author_id:=old.author_id;
 return new;
end; $$;
revoke all on function private.discussion_touch() from public,anon,authenticated;
create trigger discussion_touch before update on public.club_discussions for each row execute function private.discussion_touch();
create trigger comment_touch before update on public.club_discussion_comments for each row execute function private.discussion_touch();

create function private.can_read_discussions(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active_user() and exists(select 1 from public.clubs c where c.id=p_club
 and (c.owner_id=auth.uid() or private.is_club_member(c.id) or private.is_admin()));
$$;
create function private.can_participate_discussions(p_club uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_active_user() and exists(select 1 from public.clubs c where c.id=p_club
 and c.archived_at is null and (c.owner_id=auth.uid() or private.is_club_member(c.id)));
$$;
create function private.lock_discussion_club(p_club uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.clubs;
begin
 perform private.require_actor();
 if not private.can_read_discussions(p_club) then raise exception 'Немає доступу до обговорень' using errcode='42501'; end if;
 c:=private.lock_club(p_club,true);
 if not private.can_read_discussions(p_club) then raise exception 'Немає доступу до обговорень' using errcode='42501'; end if;
 if c.archived_at is not null then raise exception 'Архівний клуб доступний лише для читання' using errcode='55000'; end if;
end; $$;
create function private.lock_discussion(p_id uuid) returns public.club_discussions
language plpgsql security definer set search_path='' as $$
declare club uuid; d public.club_discussions;
begin
 perform private.require_actor();
 select club_id into club from public.club_discussions where id=p_id and private.can_read_discussions(club_id);
 if not found then raise exception 'Обговорення недоступне' using errcode='42501'; end if;
 perform private.lock_discussion_club(club);
 select * into strict d from public.club_discussions where id=p_id for update;
 if d.deleted_at is not null then raise exception 'Тему видалено' using errcode='55000'; end if;
 return d;
end; $$;
create function private.discussion_projection(d public.club_discussions) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when d.deleted_at is not null then jsonb_build_object('id',d.id,'club_id',d.club_id,'deleted_at',d.deleted_at,
 'can_edit',false,'can_delete',false,'can_comment',false)
 else jsonb_build_object('id',d.id,'club_id',d.club_id,'author_id',d.author_id,
 'author_name',(select name from public.profiles where id=d.author_id),
 'book_id',d.book_id,'book_title',(select title from public.club_books where id=d.book_id),
 'title',d.title,'body',d.body,'created_at',d.created_at,'updated_at',d.updated_at,'deleted_at',null,
 'can_edit',d.author_id=auth.uid() and private.can_participate_discussions(d.club_id),
 'can_delete',exists(select 1 from public.clubs c where c.id=d.club_id and c.archived_at is null)
   and (private.manages_club(d.club_id) or (d.author_id=auth.uid() and private.can_participate_discussions(d.club_id))),
 'can_comment',private.can_participate_discussions(d.club_id)) end;
$$;
revoke all on function private.can_read_discussions(uuid),private.can_participate_discussions(uuid),
 private.lock_discussion_club(uuid),private.lock_discussion(uuid),private.discussion_projection(public.club_discussions) from public,anon,authenticated;

create function private.list_club_discussions(p_club uuid,p_book uuid default null,p_page integer default 1,p_size integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_actor();
 if not private.can_read_discussions(p_club) then raise exception 'Немає доступу до обговорень' using errcode='42501'; end if;
 if p_page is null or p_page<1 or p_page>1000000 or p_size is null or p_size<1 or p_size>50 then raise exception 'Некоректна сторінка' using errcode='22023'; end if;
 -- Recheck in the data statement's snapshot as well as before it: membership may
 -- have changed between PL/pgSQL statements under READ COMMITTED.
 return (with filtered as (select * from public.club_discussions where club_id=p_club and private.can_read_discussions(club_id)
 and deleted_at is null and (p_book is null or book_id=p_book)),
 paged as (select * from filtered order by created_at desc,id desc limit p_size offset (p_page-1)*p_size),
 counts as (select c.discussion_id,count(*) total from public.club_discussion_comments c join paged d on d.id=c.discussion_id
   where c.deleted_at is null group by c.discussion_id)
 select jsonb_build_object('total',(select count(*) from filtered),'can_create',private.can_participate_discussions(p_club),
 'items',coalesce((select jsonb_agg((private.discussion_projection(d::public.club_discussions)-'body')||jsonb_build_object('comments_count',coalesce(c.total,0))
 order by d.created_at desc,d.id desc) from paged d left join counts c on c.discussion_id=d.id),'[]'::jsonb)));
end; $$;
create function private.get_club_discussion(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.club_discussions;
begin
 perform private.require_actor();
 select * into d from public.club_discussions where id=p_id and private.can_read_discussions(club_id);
 if not found then raise exception 'Обговорення недоступне' using errcode='42501'; end if;
 return private.discussion_projection(d);
end; $$;
create function private.create_club_discussion(p_club uuid,p_title text,p_body text,p_book uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; written timestamptz;
begin
 perform private.lock_discussion_club(p_club);
 if not private.can_participate_discussions(p_club) then raise exception 'Писати можуть лише учасники' using errcode='42501'; end if;
 written:=clock_timestamp();
 insert into public.club_discussions(club_id,author_id,book_id,title,body,created_at,updated_at)
 values(p_club,auth.uid(),p_book,private.discussion_trim(p_title),private.discussion_trim(p_body),written,written) returning id into result;
 return result;
end; $$;
create function private.update_club_discussion(p_id uuid,p_title text,p_body text,p_book uuid,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare d public.club_discussions:=private.lock_discussion(p_id);
begin
 if d.author_id<>auth.uid() or not private.can_participate_discussions(d.club_id) then raise exception 'Можна редагувати лише власну тему' using errcode='42501'; end if;
 if p_expected is distinct from d.updated_at then raise exception 'Тема змінилася. Перечитайте дані' using errcode='40001'; end if;
 update public.club_discussions set title=private.discussion_trim(p_title),body=private.discussion_trim(p_body),book_id=p_book where id=p_id;
end; $$;
create function private.delete_club_discussion(p_id uuid,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare d public.club_discussions:=private.lock_discussion(p_id);
begin
 if not (private.manages_club(d.club_id) or (d.author_id=auth.uid() and private.can_participate_discussions(d.club_id))) then raise exception 'Немає права видаляти тему' using errcode='42501'; end if;
 if p_expected is distinct from d.updated_at then raise exception 'Тема змінилася. Перечитайте дані' using errcode='40001'; end if;
 update public.club_discussions set title=null,body=null,deleted_at=clock_timestamp(),deleted_by=auth.uid() where id=p_id;
end; $$;
create function private.list_discussion_comments(p_discussion uuid,p_page integer default 1,p_size integer default 20) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.club_discussions;
begin
 perform private.require_actor();
 select * into d from public.club_discussions where id=p_discussion and private.can_read_discussions(club_id);
 if not found then raise exception 'Обговорення недоступне' using errcode='42501'; end if;
 if d.deleted_at is not null then raise exception 'Тему видалено' using errcode='55000'; end if;
 if p_page is null or p_page<1 or p_page>1000000 or p_size is null or p_size<1 or p_size>50 then raise exception 'Некоректна сторінка' using errcode='22023'; end if;
 -- Do not return a branch deleted (or made inaccessible) after the earlier check.
 return (with eligible as (select id from public.club_discussions where id=p_discussion and deleted_at is null
   and private.can_read_discussions(club_id)),
 filtered as (select c.* from public.club_discussion_comments c join eligible et on et.id=c.discussion_id),
 paged as (select * from filtered order by created_at,id limit p_size offset (p_page-1)*p_size)
 select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(jsonb_build_object(
 'id',c.id,'discussion_id',c.discussion_id,'body',case when c.deleted_at is null then c.body end,
 'author_id',case when c.deleted_at is null then c.author_id end,
 'author_name',case when c.deleted_at is null then p.name end,'created_at',c.created_at,'updated_at',c.updated_at,'deleted_at',c.deleted_at,
 'can_edit',c.deleted_at is null and c.author_id=auth.uid() and private.can_participate_discussions(d.club_id),
 'can_delete',c.deleted_at is null and exists(select 1 from public.clubs where id=d.club_id and archived_at is null)
 and (private.manages_club(d.club_id) or (c.author_id=auth.uid() and private.can_participate_discussions(d.club_id))))
 order by c.created_at,c.id) from paged c join public.profiles p on p.id=c.author_id),'[]'::jsonb)));
end; $$;
create function private.create_discussion_comment(p_discussion uuid,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.club_discussions:=private.lock_discussion(p_discussion); result uuid; written timestamptz;
begin
 if not private.can_participate_discussions(d.club_id) then raise exception 'Писати можуть лише учасники' using errcode='42501'; end if;
 written:=clock_timestamp();
 insert into public.club_discussion_comments(discussion_id,author_id,body,created_at,updated_at)
 values(d.id,auth.uid(),private.discussion_trim(p_body),written,written) returning id into result;
 return result;
end; $$;
create function private.lock_discussion_comment(p_id uuid) returns public.club_discussion_comments
language plpgsql security definer set search_path='' as $$
declare topic uuid; c public.club_discussion_comments;
begin
 perform private.require_actor();
 select x.discussion_id into topic from public.club_discussion_comments x join public.club_discussions d on d.id=x.discussion_id
 where x.id=p_id and private.can_read_discussions(d.club_id);
 if not found then raise exception 'Коментар недоступний' using errcode='42501'; end if;
 perform private.lock_discussion(topic);
 select * into strict c from public.club_discussion_comments where id=p_id for update;
 if c.deleted_at is not null then raise exception 'Коментар видалено' using errcode='55000'; end if;
 return c;
end; $$;
revoke all on function private.lock_discussion_comment(uuid) from public,anon,authenticated;
create function private.update_discussion_comment(p_id uuid,p_body text,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare c public.club_discussion_comments:=private.lock_discussion_comment(p_id); club uuid;
begin
 select club_id into club from public.club_discussions where id=c.discussion_id;
 if c.author_id<>auth.uid() or not private.can_participate_discussions(club) then raise exception 'Можна редагувати лише власний коментар' using errcode='42501'; end if;
 if p_expected is distinct from c.updated_at then raise exception 'Коментар змінився. Перечитайте дані' using errcode='40001'; end if;
 update public.club_discussion_comments set body=private.discussion_trim(p_body) where id=p_id;
end; $$;
create function private.delete_discussion_comment(p_id uuid,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare c public.club_discussion_comments:=private.lock_discussion_comment(p_id); club uuid;
begin
 select club_id into club from public.club_discussions where id=c.discussion_id;
 if not (private.manages_club(club) or (c.author_id=auth.uid() and private.can_participate_discussions(club))) then raise exception 'Немає права видаляти коментар' using errcode='42501'; end if;
 if p_expected is distinct from c.updated_at then raise exception 'Коментар змінився. Перечитайте дані' using errcode='40001'; end if;
 update public.club_discussion_comments set body=null,deleted_at=clock_timestamp(),deleted_by=auth.uid() where id=p_id;
end; $$;

create function public.list_club_discussions(p_club uuid,p_book uuid default null,p_page integer default 1,p_size integer default 20) returns jsonb
language sql security invoker set search_path='' as $$select private.list_club_discussions(p_club,p_book,p_page,p_size);$$;
create function public.get_club_discussion(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.get_club_discussion(p_id);$$;
create function public.create_club_discussion(p_club uuid,p_title text,p_body text,p_book uuid default null) returns uuid
language sql security invoker set search_path='' as $$select private.create_club_discussion(p_club,p_title,p_body,p_book);$$;
create function public.update_club_discussion(p_id uuid,p_title text,p_body text,p_book uuid,p_expected timestamptz) returns void
language sql security invoker set search_path='' as $$select private.update_club_discussion(p_id,p_title,p_body,p_book,p_expected);$$;
create function public.delete_club_discussion(p_id uuid,p_expected timestamptz) returns void
language sql security invoker set search_path='' as $$select private.delete_club_discussion(p_id,p_expected);$$;
create function public.list_discussion_comments(p_discussion uuid,p_page integer default 1,p_size integer default 20) returns jsonb
language sql security invoker set search_path='' as $$select private.list_discussion_comments(p_discussion,p_page,p_size);$$;
create function public.create_discussion_comment(p_discussion uuid,p_body text) returns uuid
language sql security invoker set search_path='' as $$select private.create_discussion_comment(p_discussion,p_body);$$;
create function public.update_discussion_comment(p_id uuid,p_body text,p_expected timestamptz) returns void
language sql security invoker set search_path='' as $$select private.update_discussion_comment(p_id,p_body,p_expected);$$;
create function public.delete_discussion_comment(p_id uuid,p_expected timestamptz) returns void
language sql security invoker set search_path='' as $$select private.delete_discussion_comment(p_id,p_expected);$$;
-- Exact signatures only: do not accidentally grant pre-existing overloads by name.
revoke all on function private.list_club_discussions(uuid,uuid,integer,integer),private.get_club_discussion(uuid),
 private.create_club_discussion(uuid,text,text,uuid),private.update_club_discussion(uuid,text,text,uuid,timestamptz),
 private.delete_club_discussion(uuid,timestamptz),private.list_discussion_comments(uuid,integer,integer),
 private.create_discussion_comment(uuid,text),private.update_discussion_comment(uuid,text,timestamptz),
 private.delete_discussion_comment(uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.list_club_discussions(uuid,uuid,integer,integer),private.get_club_discussion(uuid),
 private.create_club_discussion(uuid,text,text,uuid),private.update_club_discussion(uuid,text,text,uuid,timestamptz),
 private.delete_club_discussion(uuid,timestamptz),private.list_discussion_comments(uuid,integer,integer),
 private.create_discussion_comment(uuid,text),private.update_discussion_comment(uuid,text,timestamptz),
 private.delete_discussion_comment(uuid,timestamptz) to authenticated;
revoke all on function public.list_club_discussions(uuid,uuid,integer,integer),public.get_club_discussion(uuid),
 public.create_club_discussion(uuid,text,text,uuid),public.update_club_discussion(uuid,text,text,uuid,timestamptz),
 public.delete_club_discussion(uuid,timestamptz),public.list_discussion_comments(uuid,integer,integer),
 public.create_discussion_comment(uuid,text),public.update_discussion_comment(uuid,text,timestamptz),
 public.delete_discussion_comment(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.list_club_discussions(uuid,uuid,integer,integer),public.get_club_discussion(uuid),
 public.create_club_discussion(uuid,text,text,uuid),public.update_club_discussion(uuid,text,text,uuid,timestamptz),
 public.delete_club_discussion(uuid,timestamptz),public.list_discussion_comments(uuid,integer,integer),
 public.create_discussion_comment(uuid,text),public.update_discussion_comment(uuid,text,timestamptz),
 public.delete_discussion_comment(uuid,timestamptz) to authenticated;
notify pgrst, 'reload schema';
commit;
