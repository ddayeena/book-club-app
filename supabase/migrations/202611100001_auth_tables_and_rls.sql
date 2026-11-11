begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 500),
  reminders_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_access enable row level security;

-- These functions take no user ID: callers cannot inspect somebody else's access.
create function private.is_active_user() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_access
    where user_id = (select auth.uid()) and not is_blocked);
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_access
    where user_id = (select auth.uid()) and role = 'admin' and not is_blocked);
$$;

revoke all on function private.is_active_user() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Own access remains readable when blocked, so the UI can explain the denial.
create policy profiles_read_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy access_read_self on public.user_access for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_user()))
  with check (id = (select auth.uid()) and (select private.is_active_user()));

revoke all on public.profiles, public.user_access from public, anon, authenticated;
grant select on public.profiles, public.user_access to authenticated;
grant update (name, avatar_path, reminders_enabled) on public.profiles to authenticated;
grant all on public.profiles, public.user_access to service_role;
-- No client INSERT/DELETE, no client role/status updates, and no admin mutation RPC.

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger access_touch before update on public.user_access
  for each row execute function private.touch_updated_at();

commit;
