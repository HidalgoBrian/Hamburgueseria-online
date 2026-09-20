-- Ejecutar una sola vez en Supabase SQL Editor.
-- Permite ordenar los productos dentro de cada categoría desde el panel.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'sort_order'
  ) then
    alter table public.products
      add column sort_order integer not null default 0;

    with ranked_products as (
      select
        id,
        row_number() over (
          partition by category_id
          order by name, created_at, id
        ) - 1 as position
      from public.products
    )
    update public.products
    set sort_order = ranked_products.position
    from ranked_products
    where public.products.id = ranked_products.id;
  end if;
end
$$;
