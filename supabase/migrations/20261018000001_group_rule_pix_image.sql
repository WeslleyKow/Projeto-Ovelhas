-- A regra de aprovação e a imagem Pix pertencem ao grupo, não a cada objetivo.
-- Aplicar após 20261018000000_goal_approvals_pix.sql.
alter table public.groups
  add column approval_mode text not null default 'count' check (approval_mode in ('count', 'percent')),
  add column approval_value smallint not null default 1 check (approval_value between 1 and 100),
  add column pix_qr_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-pix', 'group-pix', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "family can view group pix" on storage.objects for select to authenticated
using (bucket_id = 'group-pix' and public.is_group_member((split_part(name, '/', 1))::uuid));
create policy "group creator can upload pix" on storage.objects for insert to authenticated
with check (bucket_id = 'group-pix' and exists (
  select 1 from public.groups g where g.id::text = split_part(name, '/', 1)
  and g.created_by = (select auth.uid()) and split_part(name, '/', 2) = (select auth.uid())::text
));
create policy "group creator can remove pix" on storage.objects for delete to authenticated
using (bucket_id = 'group-pix' and exists (
  select 1 from public.groups g where g.id::text = split_part(name, '/', 1)
  and g.created_by = (select auth.uid()) and split_part(name, '/', 2) = (select auth.uid())::text
));

create function public.set_group_approval_rule(target_group uuid, new_mode text, new_value smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.groups%rowtype; other_members integer;
begin
  if auth.uid() is null then raise exception 'Faça login para alterar a regra.'; end if;
  select * into g from public.groups where id = target_group for update;
  if not found or g.created_by <> auth.uid() or not public.is_group_member(target_group) then
    raise exception 'Somente o criador do grupo pode alterar a regra.';
  end if;
  select count(*) into other_members from public.group_members
  where group_id = target_group and user_id <> g.created_by;
  if new_mode not in ('count','percent') or new_mode is null or new_value not between 1 and 100 or new_value is null or
    (new_mode = 'count' and new_value > greatest(1, other_members)) then
    raise exception 'Revise a regra de aprovação para o tamanho atual do grupo.';
  end if;
  update public.groups set approval_mode = new_mode, approval_value = new_value where id = target_group;
end;
$$;

create function public.set_group_pix_qr(target_group uuid, new_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.groups%rowtype;
begin
  if auth.uid() is null then raise exception 'Faça login para alterar o Pix.'; end if;
  select * into g from public.groups where id = target_group for update;
  if not found or g.created_by <> auth.uid() or not public.is_group_member(target_group) then
    raise exception 'Somente o criador do grupo pode alterar o Pix.';
  end if;
  if new_path is not null and (
    new_path not like (g.id::text || '/' || g.created_by::text || '/%') or
    not exists (select 1 from storage.objects where bucket_id = 'group-pix' and name = new_path)
  ) then raise exception 'Envie uma imagem válida para o grupo antes de salvá-la.'; end if;
  update public.groups set pix_qr_path = new_path where id = target_group;
end;
$$;

revoke all on function public.set_group_approval_rule(uuid, text, smallint) from public, anon;
revoke all on function public.set_group_pix_qr(uuid, text) from public, anon;
grant execute on function public.set_group_approval_rule(uuid, text, smallint),
  public.set_group_pix_qr(uuid, text) to authenticated;

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
      fine_amount = (r.proposed->>'fine_amount')::numeric
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
    if g.deadline < current_date then raise exception 'O prazo do objetivo já terminou.'; end if;
    if proposed_goal is null or jsonb_typeof(proposed_goal) <> 'object' or
      not (proposed_goal ?& array['title','description','category','target_value','unit','deadline','fine_amount']) or
      exists (select 1 from jsonb_object_keys(proposed_goal) as fields(name) where name <> all(array['title','description','category','target_value','weekly_target','unit','deadline','fine_amount']))
    then raise exception 'Dados da alteração incompletos ou inválidos.'; end if;
    if proposed_goal->>'title' is null or proposed_goal->>'unit' is null or
      proposed_goal->>'category' is null or proposed_goal->>'deadline' is null or
      proposed_goal->>'target_value' is null or proposed_goal->>'fine_amount' is null or
      char_length(trim(proposed_goal->>'title')) not between 1 and 100 or
      char_length(coalesce(proposed_goal->>'description', '')) > 500 or
      char_length(trim(proposed_goal->>'unit')) not between 1 and 30 or
      nullif(trim(proposed_goal->>'category'), '') is null or
      (proposed_goal->>'deadline')::date < current_date or
      (proposed_goal->>'target_value')::numeric <= 0 or (proposed_goal->>'target_value')::numeric >= 10000000000 or
      (proposed_goal->>'fine_amount')::numeric < 0 or (proposed_goal->>'fine_amount')::numeric >= 10000000000 or
      ((proposed_goal->>'weekly_target') is not null and (proposed_goal->>'weekly_target')::smallint not between 1 and 7)
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

alter table public.goals drop constraint goal_approval_percent_range;
alter table public.goals drop column approval_mode, drop column approval_value, drop column pix_code;
