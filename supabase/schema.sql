-- Ejecutar en Supabase SQL Editor. Crear el primer usuario desde Authentication > Users.
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  sale_price numeric(12,2) not null check (sale_price >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  image_url text,
  available boolean not null default true,
  sort_order integer not null default 0,
  customization jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Para proyectos que ya ejecutaron una versión anterior del esquema.
alter table public.products add column if not exists customization jsonb;
alter table public.products add column if not exists sort_order integer not null default 0;

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

create table if not exists public.business_settings (
  id uuid primary key default uuid_generate_v4(),
  business_name text not null,
  whatsapp_number text not null,
  transfer_alias text not null default '',
  transfer_holder text not null default '',
  transfer_bank text not null default '',
  address text not null default '',
  opening_hours text not null default '',
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  delivery_zones text not null default '',
  delivery_radius_km numeric(6,2) not null default 4 check (delivery_radius_km > 0),
  latitude double precision not null default -34.69614304854968,
  longitude double precision not null default -58.60093510862048,
  currency_symbol text not null default '$'
);

insert into public.business_settings (
  business_name, whatsapp_number, transfer_alias, transfer_holder, transfer_bank,
  address, opening_hours, delivery_fee, delivery_zones, delivery_radius_km,
  latitude, longitude, currency_symbol
)
select
  'LA MANTECA', '5491168644174', '', '', '',
  'París 1725, Isidro Casanova', 'Jueves a lunes · 20:00 a 00:00 h', 0,
  'Delivery hasta 4 km a la redonda', 4,
  -34.69614304854968, -58.60093510862048, '$'
where not exists (select 1 from public.business_settings);

create type public.fulfillment_type as enum ('delivery', 'pickup');
create type public.payment_method as enum ('transfer', 'cash');
create type public.order_status as enum ('new', 'confirmed', 'preparing', 'delivered', 'cancelled');

create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  customer_name text not null,
  customer_phone text not null,
  fulfillment_type public.fulfillment_type not null,
  delivery_address text,
  delivery_lat double precision,
  delivery_lng double precision,
  delivery_distance_km numeric(8,3),
  payment_method public.payment_method not null,
  cash_amount numeric(12,2),
  notes text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  status public.order_status not null default 'new',
  created_at timestamptz not null default now(),
  check ((fulfillment_type = 'delivery' and delivery_address is not null) or fulfillment_type = 'pickup')
);

create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  quantity integer not null check (quantity > 0)
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.burger_addons enable row level security;
alter table public.business_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "public can read available products" on public.products for select using (available or public.is_owner());
create policy "public can read categories" on public.categories for select using (true);
create policy "public can read available burger addons" on public.burger_addons for select using (available or public.is_owner());
create policy "public can read settings" on public.business_settings for select using (true);
create policy "owners manage categories" on public.categories for all using (public.is_owner()) with check (public.is_owner());
create policy "owners manage products" on public.products for all using (public.is_owner()) with check (public.is_owner());
create policy "owners manage burger addons" on public.burger_addons for all using (public.is_owner()) with check (public.is_owner());
create policy "owners manage settings" on public.business_settings for all using (public.is_owner()) with check (public.is_owner());
create policy "owners read and update orders" on public.orders for all using (public.is_owner()) with check (public.is_owner());
create policy "owners read order items" on public.order_items for select using (public.is_owner());

-- El navegador no puede leer pedidos públicos: solo crea mediante esta función.
create or replace function public.create_order_with_items(order_payload jsonb, item_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_order_id uuid;
  store_lat double precision;
  store_lng double precision;
  max_radius numeric;
  customer_lat double precision;
  customer_lng double precision;
  calculated_distance numeric;
begin
  if order_payload->>'fulfillment_type' = 'delivery' then
    customer_lat := nullif(order_payload->>'delivery_lat','')::double precision;
    customer_lng := nullif(order_payload->>'delivery_lng','')::double precision;
    select latitude, longitude, delivery_radius_km into store_lat, store_lng, max_radius
      from public.business_settings limit 1;
    if customer_lat is null or customer_lng is null or store_lat is null or store_lng is null then
      raise exception 'DELIVERY_ADDRESS_NOT_VERIFIED';
    end if;
    calculated_distance := 6371 * 2 * asin(sqrt(least(1,
      power(sin(radians(customer_lat - store_lat) / 2), 2) +
      cos(radians(store_lat)) * cos(radians(customer_lat)) * power(sin(radians(customer_lng - store_lng) / 2), 2)
    )));
    if calculated_distance > max_radius then
      raise exception 'DELIVERY_OUT_OF_RANGE';
    end if;
  end if;

  insert into public.orders (customer_name, customer_phone, fulfillment_type, delivery_address, delivery_lat, delivery_lng, delivery_distance_km, payment_method, cash_amount, notes, subtotal, delivery_fee, total)
  values (
    order_payload->>'customer_name', order_payload->>'customer_phone', (order_payload->>'fulfillment_type')::public.fulfillment_type,
    nullif(order_payload->>'delivery_address',''), customer_lat, customer_lng, calculated_distance,
    (order_payload->>'payment_method')::public.payment_method,
    nullif(order_payload->>'cash_amount','')::numeric, nullif(order_payload->>'notes',''),
    (order_payload->>'subtotal')::numeric, (order_payload->>'delivery_fee')::numeric, (order_payload->>'total')::numeric
  ) returning id into new_order_id;
  insert into public.order_items (order_id, product_id, product_name, unit_price, unit_cost, quantity)
  select new_order_id, nullif(item->>'product_id','')::uuid, item->>'product_name', (item->>'unit_price')::numeric, (item->>'unit_cost')::numeric, (item->>'quantity')::integer
  from jsonb_array_elements(item_payload) as item;
  return new_order_id;
end;
$$;
grant execute on function public.create_order_with_items(jsonb, jsonb) to anon, authenticated;

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
create policy "public image read" on storage.objects for select using (bucket_id = 'product-images');
create policy "owners upload images" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_owner());
create policy "owners update images" on storage.objects for update using (bucket_id = 'product-images' and public.is_owner());
create policy "owners delete images" on storage.objects for delete using (bucket_id = 'product-images' and public.is_owner());

-- Después de crear el usuario dueño, ejecutar una vez con su UUID:
-- insert into public.profiles (id, role) values ('UUID-DEL-USUARIO', 'owner');
