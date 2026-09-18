-- Ejecutar una sola vez en SQL Editor para activar el radio de delivery.
alter table public.business_settings
  add column if not exists delivery_radius_km numeric(6,2) not null default 4 check (delivery_radius_km > 0),
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.orders
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists delivery_distance_km numeric(8,3);

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

update public.business_settings
set latitude = coalesce(latitude, -34.69614304854968),
    longitude = coalesce(longitude, -58.60093510862048),
    delivery_radius_km = coalesce(delivery_radius_km, 4),
    address = case when address = '' then 'París 1725, Isidro Casanova' else address end,
    delivery_zones = case when delivery_zones = '' then 'Delivery hasta 4 km a la redonda' else delivery_zones end;

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

  insert into public.orders (
    customer_name, customer_phone, fulfillment_type, delivery_address,
    delivery_lat, delivery_lng, delivery_distance_km, payment_method,
    cash_amount, notes, subtotal, delivery_fee, total
  ) values (
    order_payload->>'customer_name', order_payload->>'customer_phone',
    (order_payload->>'fulfillment_type')::public.fulfillment_type,
    nullif(order_payload->>'delivery_address',''), customer_lat, customer_lng, calculated_distance,
    (order_payload->>'payment_method')::public.payment_method,
    nullif(order_payload->>'cash_amount','')::numeric, nullif(order_payload->>'notes',''),
    (order_payload->>'subtotal')::numeric, (order_payload->>'delivery_fee')::numeric,
    (order_payload->>'total')::numeric
  ) returning id into new_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit_price, unit_cost, quantity)
  select new_order_id, nullif(item->>'product_id','')::uuid, item->>'product_name',
    (item->>'unit_price')::numeric, (item->>'unit_cost')::numeric, (item->>'quantity')::integer
  from jsonb_array_elements(item_payload) as item;

  return new_order_id;
end;
$$;

grant execute on function public.create_order_with_items(jsonb, jsonb) to anon, authenticated;
