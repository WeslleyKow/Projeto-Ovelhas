-- Cada participante começa com três corações. Cada gasto volta exatamente 30 dias depois.
create table public.heart_spends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  target_date date not null,
  spent_at timestamptz not null default now(),
  restores_at timestamptz not null,
  unique(user_id, target_date),
  check(restores_at > spent_at)
);
create index heart_spends_active_idx on public.heart_spends(user_id, restores_at);
alter table public.heart_spends enable row level security;
create policy "read own heart spends" on public.heart_spends for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.heart_spends from public, anon, authenticated;
grant select on public.heart_spends to authenticated;

-- Um coração abre o dia anterior inteiro. Chamadas adicionais para o mesmo dia
-- podem completar outros objetivos sem consumir outro coração.
create function public.recover_yesterday_with_heart(target_day date, goal_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  current_group_id uuid;
  goal_id_to_recover uuid;
  g public.goals%rowtype;
  already numeric;
  active_spends integer;
  existing_spend boolean;
  expected_day date := (now() at time zone 'America/Sao_Paulo')::date - 1;
begin
  if current_user_id is null then raise exception 'Faça login para usar um coração.'; end if;
  if target_day is distinct from expected_day then raise exception 'O coração só recupera o dia anterior.'; end if;
  if coalesce(cardinality(goal_ids), 0) not between 1 and 50 or
    (select count(distinct goal_id) from unnest(goal_ids) as chosen(goal_id)) <> cardinality(goal_ids) then
    raise exception 'Selecione objetivos válidos, sem repetir.';
  end if;
  select group_id into current_group_id from public.group_members where user_id = current_user_id;
  if current_group_id is null then raise exception 'Você precisa participar de um grupo.'; end if;

  -- Serializa gastos simultâneos do mesmo participante.
  perform pg_advisory_xact_lock(hashtextextended('heart:' || current_user_id::text, 0));
  select exists(select 1 from public.heart_spends where user_id = current_user_id and target_date = target_day)
    into existing_spend;
  if not existing_spend then
    select count(*) into active_spends from public.heart_spends
      where user_id = current_user_id and restores_at > now();
    if active_spends >= 3 then raise exception 'Você está sem corações disponíveis. Aguarde uma recuperação.'; end if;
    insert into public.heart_spends(user_id, group_id, target_date, spent_at, restores_at)
    values(current_user_id, current_group_id, target_day, now(), now() + interval '30 days');
  end if;

  foreach goal_id_to_recover in array goal_ids loop
    select * into g from public.goals where id = goal_id_to_recover for update;
    if not found or g.owner_id <> current_user_id or g.group_id <> current_group_id or
      g.deleted_at is not null or g.recurrence_type not in ('daily', 'weekly') or
      target_day < g.start_date or target_day > g.deadline or
      (g.weekday_mask is not null and
        (g.weekday_mask & (1 << (extract(isodow from target_day)::integer - 1))) = 0) or
      (g.recurrence_type = 'daily' and target_day = any(g.rest_dates)) then
      raise exception 'Um dos objetivos não pode ser recuperado para esse dia.';
    end if;
    if exists(select 1 from public.recurring_fine_payments p where p.goal_id = g.id and
      p.period_start = case when g.recurrence_type = 'daily' then target_day
        else greatest(g.start_date, date_trunc('week', target_day)::date) end) then
      raise exception 'Desmarque primeiro o pagamento da multa deste objetivo.';
    end if;
    select coalesce(sum(amount), 0) into already from public.entries
      where goal_id = g.id and entry_date = target_day;
    if already >= g.target_value then raise exception 'Um dos objetivos já foi cumprido nesse dia.'; end if;
    insert into public.entries(goal_id, author_id, entry_date, amount, note)
      values(g.id, current_user_id, target_day, g.target_value - already,
        'Meta do dia anterior recuperada com coração.');
  end loop;
  return jsonb_build_object('target_date', target_day, 'recovered', cardinality(goal_ids),
    'heart_spent', not existing_spend);
end;
$$;
revoke all on function public.recover_yesterday_with_heart(date, uuid[]) from public, anon;
grant execute on function public.recover_yesterday_with_heart(date, uuid[]) to authenticated;
notify pgrst, 'reload schema';
