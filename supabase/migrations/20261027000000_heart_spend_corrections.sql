-- A correction keeps the historical recovery record but excludes its heart cost.
alter table public.heart_spends
  add column voided_at timestamptz,
  add column void_reason text,
  add constraint heart_spend_void_reason_check check
    ((voided_at is null and void_reason is null) or
     (voided_at is not null and length(trim(void_reason)) between 1 and 500));

create or replace function public.recover_yesterday_with_heart(target_day date, goal_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  current_group_id uuid;
  goal_id_to_recover uuid;
  g public.goals%rowtype;
  already numeric;
  active_spends integer;
  existing_spend boolean := false;
  expected_day date := (now() at time zone 'America/Sao_Paulo')::date;
  month_start timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  reset_at timestamptz;
  spent_heart boolean := false;
begin
  if current_user_id is null then raise exception 'Faça login para recuperar objetivos.'; end if;
  if target_day is null or target_day >= expected_day then raise exception 'Escolha um dia anterior a hoje.'; end if;
  if coalesce(cardinality(goal_ids), 0) not between 1 and 50 or
    (select count(distinct goal_id) from unnest(goal_ids) as chosen(goal_id)) <> cardinality(goal_ids) then
    raise exception 'Selecione objetivos válidos, sem repetir.';
  end if;
  select group_id into current_group_id from public.group_members where user_id = current_user_id;
  if current_group_id is null then raise exception 'Você precisa participar de um grupo.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('heart:' || current_user_id::text, 0));
  select max(created_at) into reset_at from public.heart_resets where user_id = current_user_id;
  if target_day < expected_day - 1 then
    select exists(select 1 from public.heart_spends where user_id = current_user_id and target_date = target_day)
      into existing_spend;
    if not existing_spend then
      select count(*) into active_spends from public.heart_spends
        where user_id = current_user_id and voided_at is null and spent_at >= month_start
          and (reset_at is null or spent_at > reset_at);
      if active_spends >= 3 then raise exception 'Você está sem vidas. Aguarde o dia 1º ou use Resetar vidas.'; end if;
      insert into public.heart_spends(user_id, group_id, target_date, spent_at, restores_at)
      values(current_user_id, current_group_id, target_day, now(), now() + interval '30 days');
      spent_heart := true;
    end if;
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
        'Meta de dia anterior registrada retroativamente.');
  end loop;
  return jsonb_build_object('target_date', target_day, 'recovered', cardinality(goal_ids),
    'heart_spent', spent_heart);
end;
$$;
notify pgrst, 'reload schema';
