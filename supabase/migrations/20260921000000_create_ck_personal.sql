-- Personal recurrente y datos reutilizables por el editor de cheques.
create table if not exists public.ck_personal (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  identidad text,
  puesto text,
  salario numeric(14, 2),
  nivel text,
  categoria text,
  departamento text,
  ciudad text,
  residencia text,
  uso_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ck_personal_nombre_unique_idx
  on public.ck_personal (lower(trim(nombre)));

create index if not exists ck_personal_uso_idx
  on public.ck_personal (uso_count desc, lower(nombre));

alter table public.ck_personal enable row level security;

create policy "ck_personal_authenticated_select"
  on public.ck_personal for select
  to authenticated
  using (true);

create policy "ck_personal_authenticated_insert"
  on public.ck_personal for insert
  to authenticated
  with check (created_by is null or created_by = (select auth.uid()));

create policy "ck_personal_authenticated_update"
  on public.ck_personal for update
  to authenticated
  using (true)
  with check (true);

create policy "ck_personal_authenticated_delete"
  on public.ck_personal for delete
  to authenticated
  using (true);

create or replace function public.ck_personal_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ck_personal_updated_at on public.ck_personal;
create trigger ck_personal_updated_at
  before update on public.ck_personal
  for each row execute function public.ck_personal_set_updated_at();

