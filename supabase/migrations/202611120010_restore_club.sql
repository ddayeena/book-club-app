begin;
-- Existing guards lock actor access first, then the club; child rows are untouched.
create function private.restore_club(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.clubs;
begin
 perform private.require_actor();
 if not private.manages_club(p_id) then
   raise exception 'Немає доступу' using errcode='42501';
 end if;
 c := private.lock_club(p_id,true);
 -- Recheck after waiting for the row lock (TOCTOU).
 if not private.manages_club(c.id) then
   raise exception 'Немає доступу' using errcode='42501';
 end if;
 if c.archived_at is null then return; end if;
 update public.clubs set archived_at=null where id=c.id;
end; $$;
revoke all on function private.restore_club(uuid) from public,anon,authenticated;
grant execute on function private.restore_club(uuid) to authenticated;

create function public.restore_club(p_id uuid) returns void
language sql security invoker set search_path='' as $$ select private.restore_club(p_id); $$;
revoke all on function public.restore_club(uuid) from public,anon,authenticated;
grant execute on function public.restore_club(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
