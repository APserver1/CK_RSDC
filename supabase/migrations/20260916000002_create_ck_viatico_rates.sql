-- Tarifas históricas de viáticos por categoría y zona.
create table if not exists public.ck_viatico_rates (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('I', 'II', 'III', 'IV', 'V')),
  zona smallint not null check (zona in (1, 2, 3)),
  valor numeric(14, 2) not null check (valor >= 0),
  vigente_desde date not null default current_date,
  creado_en timestamptz not null default now()
);

create index if not exists ck_viatico_rates_lookup_idx
  on public.ck_viatico_rates (categoria, zona, vigente_desde desc);

alter table public.ck_viatico_rates enable row level security;

create policy "ck_viatico_rates_authenticated_select"
  on public.ck_viatico_rates for select
  to authenticated
  using (true);

insert into public.ck_viatico_rates (categoria, zona, valor)
select values_data.categoria, values_data.zona, values_data.valor
from (values
  ('I', 1, 5337.08), ('I', 2, 4634.83), ('I', 3, 3932.58),
  ('II', 1, 4634.83), ('II', 2, 3932.58), ('II', 3, 3230.34),
  ('III', 1, 3932.58), ('III', 2, 3230.34), ('III', 3, 2528.09),
  ('IV', 1, 3230.34), ('IV', 2, 2528.09), ('IV', 3, 1825.84),
  ('V', 1, 1125.00), ('V', 2, 812.50), ('V', 3, 775.00)
) as values_data(categoria, zona, valor)
where not exists (select 1 from public.ck_viatico_rates);
