-- Tabla de cheques propia de la aplicación CHEQUES RSDC.
create table if not exists public.ck_cheques (
  id uuid primary key default gen_random_uuid(),
  numero_cheque text not null,
  beneficiario text not null,
  monto numeric(14, 2) not null check (monto >= 0),
  moneda text not null default 'HNL',
  fecha_emision date not null default current_date,
  fecha_pago date,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagado', 'anulado', 'registrado')),
  concepto text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ck_cheques_created_at_idx
  on public.ck_cheques (created_at desc);

create index if not exists ck_cheques_estado_idx
  on public.ck_cheques (estado);

alter table public.ck_cheques enable row level security;

-- Los usuarios autenticados de la empresa pueden consultar los registros.
create policy "ck_cheques_authenticated_select"
  on public.ck_cheques for select
  to authenticated
  using (true);

-- El usuario autenticado que crea un cheque queda registrado como propietario.
create policy "ck_cheques_authenticated_insert"
  on public.ck_cheques for insert
  to authenticated
  with check (created_by is null or created_by = (select auth.uid()));

create policy "ck_cheques_authenticated_update"
  on public.ck_cheques for update
  to authenticated
  using (true)
  with check (true);

create or replace function public.ck_cheques_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ck_cheques_updated_at on public.ck_cheques;
create trigger ck_cheques_updated_at
  before update on public.ck_cheques
  for each row execute function public.ck_cheques_set_updated_at();
