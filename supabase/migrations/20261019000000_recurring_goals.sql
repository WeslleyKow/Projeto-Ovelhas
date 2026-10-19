-- Metas recorrentes preservam o comportamento das metas já existentes.
alter table public.goals
  add column recurrence_type text not null default 'none',
  add column start_date date,
  add constraint goal_recurrence_type_check check (recurrence_type in ('none','daily','weekly','monthly','yearly')),
  add constraint goal_recurrence_dates_check check (
    (recurrence_type = 'none' and start_date is null) or
    (recurrence_type <> 'none' and start_date is not null and start_date <= deadline and
      (recurrence_type <> 'weekly' or weekly_target between 1 and 7))
  );

create table public.recurring_fine_payments (
  goal_id uuid not null references public.goals(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  period_start date not null,
  occurrence_index smallint not null check (occurrence_index between 1 and 7),
  paid_at timestamptz not null default now(),
  primary key (goal_id, period_start, occurrence_index)
);
create index recurring_fine_payments_group_id_idx on public.recurring_fine_payments(group_id);
alter table public.recurring_fine_payments enable row level security;
create policy "family recurring fine payments" on public.recurring_fine_payments for select to authenticated
  using (public.is_group_member(group_id));
grant select on public.recurring_fine_payments to authenticated;

-- Retorna quantas ocorrências daquele período já encerrado ficaram sem cumprir.
-- A data-chave é o primeiro dia do período dentro do objetivo.
create function public.recurring_missed_count(target_goal uuid, target_period date) returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  g public.goals%rowtype;
  natural_start date;
  natural_end date;
  period_start date;
  period_end date;
  expected integer;
  achieved integer;
begin
  select * into g from public.goals where id = target_goal and deleted_at is null;
  if not found or g.recurrence_type = 'none' or target_period is null then return 0; end if;
  natural_start := case g.recurrence_type
    when 'daily' then target_period
    when 'weekly' then date_trunc('week', target_period)::date
    when 'monthly' then date_trunc('month', target_period)::date
    else date_trunc('year', target_period)::date end;
  natural_end := case g.recurrence_type
    when 'daily' then natural_start
    when 'weekly' then natural_start + 6
    when 'monthly' then (natural_start + interval '1 month' - interval '1 day')::date
    else (natural_start + interval '1 year' - interval '1 day')::date end;
  period_start := greatest(g.start_date, natural_start);
  period_end := least(g.deadline, natural_end);
  if target_period <> period_start or period_start > period_end or
    period_end >= (now() at time zone 'America/Sao_Paulo')::date then return 0; end if;
  if g.recurrence_type = 'weekly' then
    expected := least(g.weekly_target, period_end - period_start + 1);
    select count(*) into achieved from (
      select e.entry_date from public.entries e
      where e.goal_id = g.id and e.entry_date between period_start and period_end
      group by e.entry_date having sum(e.amount) >= g.target_value
    ) achieved_days;
  else
    expected := 1;
    select case when coalesce(sum(e.amount), 0) >= g.target_value then 1 else 0 end into achieved
    from public.entries e where e.goal_id = g.id and e.entry_date between period_start and period_end;
  end if;
  return greatest(0, expected - achieved)::smallint;
end;
$$;
revoke all on function public.recurring_missed_count(uuid, date) from public, anon, authenticated;

create function public.set_recurring_fine_paid(target_goal uuid, target_period date, target_occurrence smallint, paid boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.goals%rowtype; missing smallint;
begin
  select * into g from public.goals where id = target_goal and deleted_at is null for update;
  if not found or g.owner_id <> auth.uid() or not public.is_group_member(g.group_id) or
    g.recurrence_type = 'none' or g.fine_amount <= 0 then
    raise exception 'Objetivo recorrente não disponível.';
  end if;
  if target_occurrence is null or target_occurrence not between 1 and 7 or paid is null then
    raise exception 'Pagamento inválido.';
  end if;
  if paid then
    missing := public.recurring_missed_count(target_goal, target_period);
    if target_occurrence > missing then raise exception 'Não há multa para esta ocorrência.'; end if;
    insert into public.recurring_fine_payments(goal_id, group_id, period_start, occurrence_index, paid_at)
    values(g.id, g.group_id, target_period, target_occurrence, now())
    on conflict (goal_id, period_start, occurrence_index) do update set paid_at = excluded.paid_at;
  else
    delete from public.recurring_fine_payments
    where goal_id = g.id and period_start = target_period and occurrence_index = target_occurrence;
  end if;
end;
$$;
revoke all on function public.set_recurring_fine_paid(uuid, date, smallint, boolean) from public, anon;
grant execute on function public.set_recurring_fine_paid(uuid, date, smallint, boolean) to authenticated;

-- A multa única segue exclusiva das metas não recorrentes.
create or replace function public.set_goal_fine_paid(target_goal uuid, paid boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.goals set fine_paid_at = case when paid then now() else null end
  where id = target_goal and owner_id = auth.uid() and deleted_at is null and recurrence_type = 'none';
  if not found then raise exception 'Objetivo não recorrente indisponível.'; end if;
end;
$$;
revoke all on function public.set_goal_fine_paid(uuid, boolean) from public, anon;
grant execute on function public.set_goal_fine_paid(uuid, boolean) to authenticated;

-- Registros de uma recorrência só podem cair entre as datas inicial e final.
drop policy "log own goal" on public.entries;
create policy "log own goal" on public.entries for insert to authenticated
with check (author_id = (select auth.uid()) and exists (
  select 1 from public.goals g where g.id = goal_id and g.deleted_at is null
    and g.owner_id = (select auth.uid()) and public.is_group_member(g.group_id)
    and entry_date <= g.deadline and (g.start_date is null or entry_date >= g.start_date)
) and (photo_path is null or photo_path like (
  (select g.group_id::text from public.goals g where g.id = goal_id) || '/' || (select auth.uid())::text || '/%'
)));

create or replace function public.apply_goal_change(target_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.goal_change_requests%rowtype;
begin
  select * into strict r from public.goal_change_requests where id = target_request;
  if r.action = 'delete' then
    update public.goals set deleted_at = now() where id = r.goal_id and deleted_at is null;
  else
    update public.goals set
      title = trim(r.proposed->>'title'),
      description = coalesce(r.proposed->>'description', ''),
      category = r.proposed->>'category',
      target_value = (r.proposed->>'target_value')::numeric,
      weekly_target = (r.proposed->>'weekly_target')::smallint,
      unit = trim(r.proposed->>'unit'),
      deadline = (r.proposed->>'deadline')::date,
      fine_amount = (r.proposed->>'fine_amount')::numeric,
      recurrence_type = coalesce(r.proposed->>'recurrence_type', recurrence_type),
      start_date = case when r.proposed ? 'start_date' then (r.proposed->>'start_date')::date else start_date end
    where id = r.goal_id and deleted_at is null;
  end if;
  if not found then raise exception 'O objetivo não está mais disponível.'; end if;
end;
$$;
revoke all on function public.apply_goal_change(uuid) from public, anon, authenticated;

create or replace function public.request_goal_change(target_goal uuid, change_action text, proposed_goal jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.goals%rowtype;
  family public.groups%rowtype;
  voters uuid[];
  needed smallint;
  new_request uuid;
begin
  if auth.uid() is null then raise exception 'Faça login para solicitar a mudança.'; end if;
  select * into g from public.goals where id = target_goal and deleted_at is null for update;
  if not found or g.owner_id <> auth.uid() or not public.is_group_member(g.group_id) then
    raise exception 'Somente o criador pode solicitar mudanças neste objetivo.';
  end if;
  select * into strict family from public.groups where id = g.group_id;
  if change_action not in ('edit', 'delete') then raise exception 'Ação inválida.'; end if;
  if exists (select 1 from public.goal_change_requests where goal_id = g.id and status = 'pending') then
    raise exception 'Já existe um pedido pendente para este objetivo.';
  end if;
  select coalesce(array_agg(user_id order by user_id), array[]::uuid[]) into voters
    from public.group_members where group_id = g.group_id and user_id <> g.owner_id;
  if family.approval_mode = 'count' and family.approval_value > cardinality(voters) and cardinality(voters) > 0 then
    raise exception 'A regra exige mais aprovações do que participantes disponíveis.';
  end if;
  needed := case when cardinality(voters) = 0 then 0
    when family.approval_mode = 'percent' then ceil(cardinality(voters) * family.approval_value / 100.0)::smallint
    else family.approval_value end;
  if change_action = 'edit' then
    if g.deadline < (now() at time zone 'America/Sao_Paulo')::date then raise exception 'O prazo do objetivo já terminou.'; end if;
    if proposed_goal is null or jsonb_typeof(proposed_goal) <> 'object' or
      not (proposed_goal ?& array['title','description','category','target_value','unit','deadline','fine_amount','recurrence_type','start_date']) or
      exists (select 1 from jsonb_object_keys(proposed_goal) as fields(name) where name <> all(array['title','description','category','target_value','weekly_target','unit','deadline','fine_amount','recurrence_type','start_date']))
    then raise exception 'Dados da alteração incompletos ou inválidos.'; end if;
    if proposed_goal->>'title' is null or proposed_goal->>'unit' is null or
      proposed_goal->>'category' is null or proposed_goal->>'deadline' is null or
      proposed_goal->>'target_value' is null or proposed_goal->>'fine_amount' is null or
      char_length(trim(proposed_goal->>'title')) not between 1 and 100 or
      char_length(coalesce(proposed_goal->>'description', '')) > 500 or
      char_length(trim(proposed_goal->>'unit')) not between 1 and 30 or
      nullif(trim(proposed_goal->>'category'), '') is null or
      (proposed_goal->>'deadline')::date < (now() at time zone 'America/Sao_Paulo')::date or
      (proposed_goal->>'target_value')::numeric <= 0 or (proposed_goal->>'target_value')::numeric >= 10000000000 or
      (proposed_goal->>'fine_amount')::numeric < 0 or (proposed_goal->>'fine_amount')::numeric >= 10000000000 or
      ((proposed_goal->>'weekly_target') is not null and (proposed_goal->>'weekly_target')::smallint not between 1 and 7) or
      proposed_goal->>'recurrence_type' not in ('none','daily','weekly','monthly','yearly') or
      (proposed_goal->>'recurrence_type' = 'none' and proposed_goal->>'start_date' is not null) or
      (proposed_goal->>'recurrence_type' <> 'none' and (
        proposed_goal->>'start_date' is null or (proposed_goal->>'start_date')::date > (proposed_goal->>'deadline')::date or
        (proposed_goal->>'recurrence_type' = 'weekly' and proposed_goal->>'weekly_target' is null)))
    then raise exception 'Revise os campos do objetivo.'; end if;
  else
    proposed_goal := null;
  end if;
  insert into public.goal_change_requests(goal_id, group_id, owner_id, goal_title, action, proposed, eligible_user_ids, required_approvals)
  values(g.id, g.group_id, g.owner_id, g.title, change_action, proposed_goal, voters, needed)
  returning id into new_request;
  if needed = 0 then
    perform public.apply_goal_change(new_request);
    update public.goal_change_requests set status = 'approved', resolved_at = now() where id = new_request;
  end if;
  return new_request;
end;
$$;
revoke all on function public.request_goal_change(uuid, text, jsonb) from public, anon;
grant execute on function public.request_goal_change(uuid, text, jsonb) to authenticated;

-- Mantém as proteções de autoria, prazo e multas existentes.
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
    new.deadline is distinct from old.deadline or new.fine_amount is distinct from old.fine_amount or
    new.recurrence_type is distinct from old.recurrence_type or new.start_date is distinct from old.start_date
  ) then raise exception 'O objetivo encerrado não pode ser editado.'; end if;
  if old.deadline >= current_date and new.deadline < current_date then
    raise exception 'A nova data final precisa ser hoje ou futura.';
  end if;
  if new.fine_paid_at is distinct from old.fine_paid_at then
    if old.recurrence_type <> 'none' then raise exception 'Use os pagamentos de cada ocorrência.'; end if;
    select coalesce(sum(amount), 0) into achieved from public.entries
    where goal_id = old.id and entry_date <= old.deadline;
    if old.deadline >= current_date or achieved >= old.target_value then
      raise exception 'Não há multa vencida para este objetivo.';
    end if;
  end if;
  return new;
end;
$$;
notify pgrst, 'reload schema';
