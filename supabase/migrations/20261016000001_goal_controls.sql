-- Aplicar APÓS 20261016000000_initial.sql. Ainda não aplicada ao projeto remoto.
alter table public.goals add column if not exists fine_paid_at timestamptz;

drop policy if exists "edit own active goal" on public.goals;
create policy "edit own active goal" on public.goals for update to authenticated
using (owner_id = (select auth.uid()) and public.is_group_member(group_id))
with check (owner_id = (select auth.uid()) and public.is_group_member(group_id));

drop policy if exists "delete own entry" on public.entries;
create policy "delete own entry" on public.entries for delete to authenticated
using (author_id = (select auth.uid()) and exists (
  select 1 from public.goals g where g.id = goal_id and g.owner_id = (select auth.uid()) and public.is_group_member(g.group_id)
));

-- Registros fora do prazo não podem aumentar a meta.
drop policy if exists "log own goal" on public.entries;
create policy "log own goal" on public.entries for insert to authenticated
with check (author_id = (select auth.uid()) and exists (
  select 1 from public.goals g
  where g.id = goal_id and g.owner_id = (select auth.uid())
    and public.is_group_member(g.group_id) and entry_date <= g.deadline
) and (photo_path is null or photo_path like (
  (select g.group_id::text from public.goals g where g.id = goal_id) || '/' || (select auth.uid())::text || '/%'
)));

-- Mantém a autoria e o prazo final imutáveis após o encerramento.
create or replace function public.check_goal_update() returns trigger language plpgsql set search_path = '' as $$
declare achieved numeric;
begin
  if new.group_id is distinct from old.group_id or new.owner_id is distinct from old.owner_id then
    raise exception 'Não é possível transferir o objetivo.';
  end if;
  if old.deadline < current_date and (
    new.title is distinct from old.title or new.description is distinct from old.description or
    new.category is distinct from old.category or new.target_value is distinct from old.target_value or
    new.weekly_target is distinct from old.weekly_target or new.unit is distinct from old.unit or
    new.deadline is distinct from old.deadline or new.fine_amount is distinct from old.fine_amount
  ) then
    raise exception 'O objetivo encerrado não pode ser editado.';
  end if;
  if new.deadline < current_date and old.deadline >= current_date then
    raise exception 'A nova data final precisa ser hoje ou futura.';
  end if;
  if new.fine_paid_at is distinct from old.fine_paid_at then
    select coalesce(sum(amount), 0) into achieved from public.entries
    where goal_id = old.id and entry_date <= old.deadline;
    if old.deadline >= current_date or achieved >= old.target_value then
      raise exception 'Não há multa vencida para este objetivo.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists check_goal_update on public.goals;
create trigger check_goal_update before update on public.goals
for each row execute function public.check_goal_update();
