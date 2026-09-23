-- Tablas versionadas de tarifas de viáticos.
create table if not exists public.ck_viatico_rate_tables (
  codigo text primary key,
  nombre text not null,
  vigente_desde date,
  creado_en timestamptz not null default now()
);

insert into public.ck_viatico_rate_tables (codigo, nombre, vigente_desde)
values
  ('legacy', 'Tabla vieja', null),
  ('2026', 'Tabla 2026', '2026-01-01')
on conflict (codigo) do nothing;

alter table public.ck_viatico_rates
  add column if not exists tabla_codigo text;

update public.ck_viatico_rates
set tabla_codigo = 'legacy'
where tabla_codigo is null;

alter table public.ck_viatico_rates
  alter column tabla_codigo set default 'legacy',
  alter column tabla_codigo set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ck_viatico_rates_table_fk'
  ) then
    alter table public.ck_viatico_rates
      add constraint ck_viatico_rates_table_fk
      foreign key (tabla_codigo) references public.ck_viatico_rate_tables(codigo);
  end if;
end $$;

create unique index if not exists ck_viatico_rates_table_category_zone_idx
  on public.ck_viatico_rates (tabla_codigo, categoria, zona);

insert into public.ck_viatico_rates (tabla_codigo, categoria, zona, valor, vigente_desde)
select values_data.tabla_codigo, values_data.categoria, values_data.zona, values_data.valor, '2026-01-01'
from (values
  ('2026', 'I', 1, 5337.08), ('2026', 'I', 2, 4634.83), ('2026', 'I', 3, 3932.58),
  ('2026', 'II', 1, 4634.83), ('2026', 'II', 2, 3932.58), ('2026', 'II', 3, 3230.34),
  ('2026', 'III', 1, 3932.58), ('2026', 'III', 2, 3230.34), ('2026', 'III', 3, 2528.09),
  ('2026', 'IV', 1, 3230.34), ('2026', 'IV', 2, 2528.09), ('2026', 'IV', 3, 1825.84),
  ('2026', 'V', 1, 2528.09), ('2026', 'V', 2, 1825.84), ('2026', 'V', 3, 1741.57)
) as values_data(tabla_codigo, categoria, zona, valor)
where not exists (
  select 1 from public.ck_viatico_rates existing
  where existing.tabla_codigo = values_data.tabla_codigo
    and existing.categoria = values_data.categoria
    and existing.zona = values_data.zona
);

alter table public.ck_viatico_rate_tables enable row level security;

drop policy if exists "ck_viatico_rate_tables_authenticated_select" on public.ck_viatico_rate_tables;
create policy "ck_viatico_rate_tables_authenticated_select"
  on public.ck_viatico_rate_tables for select
  to authenticated
  using (true);
