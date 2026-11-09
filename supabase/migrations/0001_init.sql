-- Mindmap app schema. All access goes through the server with the service-role key.
-- RLS is enabled on every table with no policies, so the anon key can read nothing.

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  data jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  token text not null unique,
  label text,
  permission text not null check (permission in ('view', 'edit')),
  password_hash text not null,
  enabled boolean not null default true,
  session_version int not null default 1,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists shares_map_id_idx on public.shares(map_id);

create table if not exists public.login_attempts (
  key text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_key_at_idx on public.login_attempts(key, attempted_at);

alter table public.maps enable row level security;
alter table public.shares enable row level security;
alter table public.login_attempts enable row level security;

-- Optimistic-concurrency save. Returns ok=true with the new version, or ok=false with the
-- current version (null when the map does not exist).
create or replace function public.save_map_data(p_id uuid, p_data jsonb, p_expected int)
returns table (ok boolean, version int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
begin
  update public.maps m
     set data = p_data, version = m.version + 1, updated_at = now()
   where m.id = p_id and m.version = p_expected
  returning m.version into v;
  if found then
    return query select true, v;
  else
    return query select false, (select m.version from public.maps m where m.id = p_id);
  end if;
end;
$$;

revoke all on function public.save_map_data(uuid, jsonb, int) from public, anon, authenticated;
