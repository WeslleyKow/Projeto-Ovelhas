-- Aprovação por objetivo e código Pix. Aplicada ao Projeto-Ovelhas em 18/10/2026, após 20261016000001_goal_controls.sql.
alter table public.goals
  add column approval_mode text not null default 'count' check (approval_mode in ('count', 'percent')),
  add column approval_value smallint not null default 1 check (approval_value between 1 and 100),
  add column pix_code text check (char_length(pix_code) <= 1024),
  add column deleted_at timestamptz;

alter table public.goals add constraint goal_approval_percent_range
  check (approval_mode <> 'percent' or approval_value <= 100);

create table public.goal_change_requests (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  goal_title text not null,
  action text not null check (action in ('edit', 'delete')),
  proposed jsonb,
  eligible_user_ids uuid[] not null,
  required_approvals smallint not null check (required_approvals >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index one_pending_goal_change on public.goal_change_requests(goal_id) where status = 'pending';
create index goal_change_requests_group_idx on public.goal_change_requests(group_id, created_at desc);

create table public.goal_change_votes (
  request_id uuid not null references public.goal_change_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  approved boolean not null,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

alter table public.goal_change_requests enable row level security;
alter table public.goal_change_votes enable row level security;
create policy "family change requests" on public.goal_change_requests for select to authenticated
  using (public.is_group_member(group_id));
create policy "family change votes" on public.goal_change_votes for select to authenticated
  using (exists (select 1 from public.goal_change_requests r where r.id = request_id and public.is_group_member(r.group_id)));
grant select on public.goal_change_requests, public.goal_change_votes to authenticated;

-- A alteração de metas só ocorre nas funções de votação; a multa tem função própria.
drop policy if exists "edit own active goal" on public.goals;
drop policy if exists "create own goal" on public.goals;
create policy "create own goal" on public.goals for insert to authenticated
  with check (owner_id = (select auth.uid()) and deleted_at is null and fine_paid_at is null and public.is_group_member(group_id));
drop policy if exists "family goals" on public.goals;
create policy "family goals" on public.goals for select to authenticated
  using (deleted_at is null and public.is_group_member(group_id));
drop policy if exists "family entries" on public.entries;
create policy "family entries" on public.entries for select to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id and g.deleted_at is null and public.is_group_member(g.group_id)));
drop policy if exists "log own goal" on public.entries;
create policy "log own goal" on public.entries for insert to authenticated
with check (author_id = (select auth.uid()) and exists (
  select 1 from public.goals g where g.id = goal_id and g.deleted_at is null
    and g.owner_id = (select auth.uid()) and public.is_group_member(g.group_id)
    and entry_date <= g.deadline
) and (photo_path is null or photo_path like (
  (select g.group_id::text from public.goals g where g.id = goal_id) || '/' || (select auth.uid())::text || '/%'
)));
drop policy if exists "delete own entry" on public.entries;
create policy "delete own entry" on public.entries for delete to authenticated
using (author_id = (select auth.uid()) and exists (
  select 1 from public.goals g where g.id = goal_id and g.deleted_at is null
    and g.owner_id = (select auth.uid()) and public.is_group_member(g.group_id)
));

create function public.apply_goal_change(target_request uuid) returns void
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
      approval_mode = r.proposed->>'approval_mode',
      approval_value = (r.proposed->>'approval_value')::smallint,
      pix_code = nullif(trim(r.proposed->>'pix_code'), '')
    where id = r.goal_id and deleted_at is null;
  end if;
  if not found then raise exception 'O objetivo não está mais disponível.'; end if;
end;
$$;
revoke all on function public.apply_goal_change(uuid) from public, anon, authenticated;

create function public.request_goal_change(target_goal uuid, change_action text, proposed_goal jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.goals%rowtype;
  voters uuid[];
  needed smallint;
  new_request uuid;
  new_mode text;
  new_value smallint;
begin
  if auth.uid() is null then raise exception 'Faça login para solicitar a mudança.'; end if;
  select * into g from public.goals where id = target_goal and deleted_at is null for update;
  if not found or g.owner_id <> auth.uid() or not public.is_group_member(g.group_id) then
    raise exception 'Somente o criador pode solicitar mudanças neste objetivo.';
  end if;
  if change_action not in ('edit', 'delete') then raise exception 'Ação inválida.'; end if;
  if exists (select 1 from public.goal_change_requests where goal_id = g.id and status = 'pending') then
    raise exception 'Já existe um pedido pendente para este objetivo.';
  end if;
  select coalesce(array_agg(user_id order by user_id), array[]::uuid[]) into voters
    from public.group_members where group_id = g.group_id and user_id <> g.owner_id;
  if g.approval_mode = 'count' and g.approval_value > cardinality(voters) and cardinality(voters) > 0 then
    raise exception 'A regra exige mais aprovações do que participantes disponíveis.';
  end if;
  needed := case when cardinality(voters) = 0 then 0
    when g.approval_mode = 'percent' then ceil(cardinality(voters) * g.approval_value / 100.0)::smallint
    else g.approval_value end;
  if change_action = 'edit' then
    if g.deadline < current_date then raise exception 'O prazo do objetivo já terminou.'; end if;
    if proposed_goal is null or jsonb_typeof(proposed_goal) <> 'object' or
      not (proposed_goal ?& array['title','description','category','target_value','unit','deadline','fine_amount','approval_mode','approval_value']) or
      exists (select 1 from jsonb_object_keys(proposed_goal) as fields(name) where name <> all(array['title','description','category','target_value','weekly_target','unit','deadline','fine_amount','approval_mode','approval_value','pix_code']))
    then raise exception 'Dados da alteração incompletos ou inválidos.'; end if;
    new_mode := proposed_goal->>'approval_mode';
    new_value := (proposed_goal->>'approval_value')::smallint;
    if proposed_goal->>'title' is null or proposed_goal->>'unit' is null or
      proposed_goal->>'category' is null or proposed_goal->>'deadline' is null or
      proposed_goal->>'target_value' is null or proposed_goal->>'fine_amount' is null or
      new_mode is null or new_value is null or
      char_length(trim(proposed_goal->>'title')) not between 1 and 100 or
      char_length(coalesce(proposed_goal->>'description', '')) > 500 or
      char_length(trim(proposed_goal->>'unit')) not between 1 and 30 or
      nullif(trim(proposed_goal->>'category'), '') is null or
      (proposed_goal->>'deadline')::date < current_date or
      (proposed_goal->>'target_value')::numeric <= 0 or (proposed_goal->>'target_value')::numeric >= 10000000000 or
      (proposed_goal->>'fine_amount')::numeric < 0 or (proposed_goal->>'fine_amount')::numeric >= 10000000000 or
      ((proposed_goal->>'weekly_target') is not null and (proposed_goal->>'weekly_target')::smallint not between 1 and 7) or
      new_mode not in ('count', 'percent') or new_value not between 1 and 100 or
      (new_mode = 'count' and new_value > greatest(1, cardinality(voters))) or
      char_length(coalesce(proposed_goal->>'pix_code', '')) > 1024
    then raise exception 'Revise os campos do objetivo e a regra de aprovação.'; end if;
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

create function public.vote_goal_change(target_request uuid, allow_change boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.goal_change_requests%rowtype;
  approvals integer;
  total_votes integer;
  total_voters integer;
  deadline date;
begin
  if auth.uid() is null then raise exception 'Faça login para votar.'; end if;
  select * into r from public.goal_change_requests where id = target_request for update;
  if not found or r.status <> 'pending' then raise exception 'Este pedido não está mais pendente.'; end if;
  if not public.is_group_member(r.group_id) or not (auth.uid() = any(r.eligible_user_ids)) then
    raise exception 'Você não pode votar neste pedido.';
  end if;
  if allow_change is null then raise exception 'Informe seu voto.'; end if;
  if exists (select 1 from public.goal_change_votes where request_id = r.id and user_id = auth.uid()) then
    raise exception 'Você já votou neste pedido.';
  end if;
  if r.action = 'edit' then
    select g.deadline into deadline from public.goals g where g.id = r.goal_id;
    if deadline < current_date then
      update public.goal_change_requests set status = 'expired', resolved_at = now() where id = r.id;
      return 'expired';
    end if;
  end if;
  insert into public.goal_change_votes(request_id, user_id, approved)
    values(r.id, auth.uid(), allow_change);
  select count(*) filter (where approved), count(*) into approvals, total_votes
    from public.goal_change_votes where request_id = r.id;
  total_voters := cardinality(r.eligible_user_ids);
  if approvals >= r.required_approvals then
    perform public.apply_goal_change(r.id);
    update public.goal_change_requests set status = 'approved', resolved_at = now() where id = r.id;
    return 'approved';
  elsif approvals + total_voters - total_votes < r.required_approvals then
    update public.goal_change_requests set status = 'rejected', resolved_at = now() where id = r.id;
    return 'rejected';
  end if;
  return 'pending';
end;
$$;

create function public.cancel_goal_change(target_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.goal_change_requests set status = 'cancelled', resolved_at = now()
  where id = target_request and owner_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Este pedido não pode mais ser cancelado.'; end if;
end;
$$;

create function public.set_goal_fine_paid(target_goal uuid, paid boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.goals set fine_paid_at = case when paid then now() else null end
  where id = target_goal and owner_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'Objetivo não encontrado.'; end if;
end;
$$;

revoke all on function public.request_goal_change(uuid, text, jsonb) from public, anon;
revoke all on function public.vote_goal_change(uuid, boolean) from public, anon;
revoke all on function public.cancel_goal_change(uuid) from public, anon;
revoke all on function public.set_goal_fine_paid(uuid, boolean) from public, anon;
grant execute on function public.request_goal_change(uuid, text, jsonb), public.vote_goal_change(uuid, boolean),
  public.cancel_goal_change(uuid), public.set_goal_fine_paid(uuid, boolean) to authenticated;
