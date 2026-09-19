-- Ejecutar una sola vez en Supabase SQL Editor.
-- Crea precios y costos globales para medallones y adicionales.

create extension if not exists "uuid-ossp";

create table if not exists public.burger_addons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  kind text not null default 'extra' check (kind in ('patty', 'extra')),
  available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists burger_addons_single_patty
  on public.burger_addons (kind) where kind = 'patty';

insert into public.burger_addons (name, sale_price, cost_price, kind, available, sort_order)
select 'Medallón extra', 2000, 0, 'patty', true, 0
where not exists (select 1 from public.burger_addons where kind = 'patty');

insert into public.burger_addons (name, sale_price, cost_price, kind, available, sort_order)
select seed.name, seed.sale_price, 0, 'extra', true, seed.sort_order
from (values
  ('Bacon Extra', 1500::numeric, 1),
  ('Pickles Extra', 1500::numeric, 2),
  ('Lechuga Extra', 1500::numeric, 3),
  ('Tomate Extra', 1500::numeric, 4),
  ('Cebolla Caramelizada Extra', 1500::numeric, 5),
  ('Huevo Extra', 1500::numeric, 6),
  ('Queso Dambo Extra', 1500::numeric, 7),
  ('Queso Cheddar Extra', 1500::numeric, 8)
) as seed(name, sale_price, sort_order)
where not exists (
  select 1 from public.burger_addons existing
  where existing.kind = 'extra' and lower(existing.name) = lower(seed.name)
);

alter table public.burger_addons enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'burger_addons'
      and policyname = 'public can read available burger addons'
  ) then
    create policy "public can read available burger addons"
      on public.burger_addons for select
      using (available or public.is_owner());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'burger_addons'
      and policyname = 'owners manage burger addons'
  ) then
    create policy "owners manage burger addons"
      on public.burger_addons for all
      using (public.is_owner())
      with check (public.is_owner());
  end if;
end
$$;

grant select on public.burger_addons to anon, authenticated;
grant insert, update, delete on public.burger_addons to authenticated;
