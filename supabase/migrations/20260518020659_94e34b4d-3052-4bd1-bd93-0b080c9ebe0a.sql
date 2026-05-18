
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.store_waiters (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  full_name text not null,
  pin text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, full_name)
);

alter table public.store_waiters enable row level security;

drop policy if exists "Store owners manage their waiters" on public.store_waiters;
create policy "Store owners manage their waiters"
on public.store_waiters
for all
using (public.is_store_owner(auth.uid(), store_id))
with check (public.is_store_owner(auth.uid(), store_id));

drop policy if exists "Admins manage waiters" on public.store_waiters;
create policy "Admins manage waiters"
on public.store_waiters
for all
using (public.has_role(auth.uid(), 'admin'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role));

drop trigger if exists trg_store_waiters_updated_at on public.store_waiters;
create trigger trg_store_waiters_updated_at
before update on public.store_waiters
for each row execute function public.update_updated_at_column();

create or replace function public.hash_waiter_pin()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.pin is not null and left(new.pin, 4) not in ('$2a$','$2b$','$2y$') then
    new.pin := extensions.crypt(new.pin, extensions.gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_store_waiters_hash_pin on public.store_waiters;
create trigger trg_store_waiters_hash_pin
before insert or update of pin on public.store_waiters
for each row execute function public.hash_waiter_pin();

create table if not exists public.store_waiter_permissions (
  id uuid primary key default gen_random_uuid(),
  waiter_id uuid not null unique,
  can_edit_orders boolean not null default false,
  can_cancel_orders boolean not null default false,
  auto_print_orders boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_waiter_permissions enable row level security;

drop policy if exists "Store owners manage waiter permissions" on public.store_waiter_permissions;
create policy "Store owners manage waiter permissions"
on public.store_waiter_permissions
for all
using (
  exists (
    select 1 from public.store_waiters w
    where w.id = store_waiter_permissions.waiter_id
      and public.is_store_owner(auth.uid(), w.store_id)
  )
)
with check (
  exists (
    select 1 from public.store_waiters w
    where w.id = store_waiter_permissions.waiter_id
      and public.is_store_owner(auth.uid(), w.store_id)
  )
);

drop policy if exists "Admins manage waiter permissions" on public.store_waiter_permissions;
create policy "Admins manage waiter permissions"
on public.store_waiter_permissions
for all
using (public.has_role(auth.uid(), 'admin'::app_role))
with check (public.has_role(auth.uid(), 'admin'::app_role));

drop trigger if exists trg_store_waiter_permissions_updated_at on public.store_waiter_permissions;
create trigger trg_store_waiter_permissions_updated_at
before update on public.store_waiter_permissions
for each row execute function public.update_updated_at_column();

create or replace function public.create_default_waiter_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_waiter_permissions (waiter_id) values (new.id)
  on conflict (waiter_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_store_waiters_default_perms on public.store_waiters;
create trigger trg_store_waiters_default_perms
after insert on public.store_waiters
for each row execute function public.create_default_waiter_permissions();

create or replace function public.verify_waiter_pin(_store_id uuid, _full_name text, _pin text)
returns table (
  waiter_id uuid,
  full_name text,
  can_edit_orders boolean,
  can_cancel_orders boolean,
  auto_print_orders boolean
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select w.id, w.full_name, p.can_edit_orders, p.can_cancel_orders, p.auto_print_orders
  from public.store_waiters w
  join public.store_waiter_permissions p on p.waiter_id = w.id
  where w.store_id = _store_id
    and w.is_active = true
    and lower(w.full_name) = lower(_full_name)
    and w.pin = extensions.crypt(_pin, w.pin);
$$;
