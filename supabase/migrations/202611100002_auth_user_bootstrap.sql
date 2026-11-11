begin;

create function private.create_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  display_name text := btrim(coalesce(new.raw_user_meta_data ->> 'name', ''));
begin
  if char_length(display_name) not between 2 and 40 then
    display_name := 'Читач';
  end if;
  insert into public.profiles(id, name) values (new.id, display_name);
  -- Never accept role, blocked status, or IDs from user metadata.
  insert into public.user_access(user_id, role, is_blocked)
    values (new.id, 'user', false);
  return new;
end;
$$;
revoke all on function private.create_auth_profile() from public, anon, authenticated;
create trigger readhub_auth_user_created after insert on auth.users
  for each row execute function private.create_auth_profile();

-- Existing Auth accounts receive missing rows; existing profile/access data stays intact.
insert into public.profiles(id, name)
select id, case when char_length(btrim(coalesce(raw_user_meta_data ->> 'name', ''))) between 2 and 40
  then btrim(raw_user_meta_data ->> 'name') else 'Читач' end
from auth.users on conflict (id) do nothing;
insert into public.user_access(user_id)
select id from public.profiles on conflict (user_id) do nothing;

commit;
