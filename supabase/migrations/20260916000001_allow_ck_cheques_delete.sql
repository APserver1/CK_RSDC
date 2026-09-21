-- Permite eliminar cheques desde la aplicación a usuarios autenticados.
create policy "ck_cheques_authenticated_delete"
  on public.ck_cheques for delete
  to authenticated
  using (true);
