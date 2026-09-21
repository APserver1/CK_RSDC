# CHEQUES RSDC

Aplicación Vite + React para consultar la operación de cheques con autenticación de Supabase.

## Puesta en marcha

1. Instala dependencias: `npm install`.
2. Copia `.env.example` como `.env.local` y agrega la clave **anon public** de tu proyecto Supabase.
3. Ajusta `VITE_SUPABASE_CHEQUES_TABLE` al nombre real de la tabla existente.
4. Ejecuta `npm run dev`.

La migración `supabase/migrations/20260910000000_create_ck_cheques.sql` crea la tabla `ck_cheques`, con RLS y campos para número, beneficiario, monto, moneda, fechas, estado y usuario creador. La consulta del dashboard usa `select('*')` y ordena por `created_at`.

Para producción, habilita Email Auth en Supabase y verifica las políticas RLS de la tabla para que cada usuario solo pueda leer los registros permitidos.
