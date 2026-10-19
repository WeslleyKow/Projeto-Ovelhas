-- Metas recorrentes aceitam registros apenas na data atual de Brasília.
-- Metas únicas preservam a possibilidade de documentar progresso anterior.
drop policy "log own goal" on public.entries;
create policy "log own goal" on public.entries for insert to authenticated
with check (author_id = (select auth.uid()) and exists (
  select 1 from public.goals g where g.id = goal_id and g.deleted_at is null
    and g.owner_id = (select auth.uid()) and public.is_group_member(g.group_id)
    and entry_date <= g.deadline and (g.start_date is null or entry_date >= g.start_date)
    and (g.recurrence_type = 'none' or entry_date = (now() at time zone 'America/Sao_Paulo')::date)
) and (photo_path is null or photo_path like (
  (select g.group_id::text from public.goals g where g.id = goal_id) || '/' || (select auth.uid())::text || '/%'
)));
notify pgrst, 'reload schema';
