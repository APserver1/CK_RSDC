-- Campos normalizados opcionales para conservar el contenido completo del editor.
-- La aplicación también guarda un respaldo JSON en concepto para compatibilidad.
alter table public.ck_cheques
  add column if not exists tipo_cheque text,
  add column if not exists comprobante text,
  add column if not exists identidad text,
  add column if not exists descripcion_cheque text,
  add column if not exists datos_personales jsonb not null default '{}'::jsonb,
  add column if not exists gastos jsonb not null default '[]'::jsonb,
  add column if not exists itinerario jsonb not null default '[]'::jsonb,
  add column if not exists fecha_inicio_viaje date,
  add column if not exists fecha_fin_viaje date,
  add column if not exists dias_viaje numeric(10, 2),
  add column if not exists tipo_vehiculo text default 'Del Estado',
  add column if not exists numero_placa text,
  add column if not exists nombre_conductor text;
