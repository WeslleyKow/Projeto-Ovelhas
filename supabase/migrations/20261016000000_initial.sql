-- Execute no SQL Editor de um projeto Supabase novo.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 50),
  created_at timestamptz not null default now()
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique default upper(encode(gen_random_bytes(6), 'hex')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  category text not null default 'Outros',
  target_value numeric(12,2) not null check (target_value > 0),
  weekly_target smallint check (weekly_target between 1 and 7),
  unit text not null check (char_length(trim(unit)) between 1 and 30),
  deadline date not null,
  fine_amount numeric(12,2) not null default 0 check (fine_amount >= 0),
  created_at timestamptz not null default now()
);
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  entry_date date not null check (entry_date <= current_date),
  amount numeric(12,2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 1000),
  photo_path text,
  created_at timestamptz not null default now()
);
create index goals_group_id_idx on public.goals(group_id);
create index entries_goal_date_idx on public.entries(goal_id, entry_date desc);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), 'Participante'), 50));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.is_group_member(target_group uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_members where group_id = target_group and user_id = (select auth.uid()));
$$;
create function public.shares_group(target_user uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_members mine join public.group_members theirs using (group_id) where mine.user_id = (select auth.uid()) and theirs.user_id = target_user);
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.goals enable row level security;
alter table public.entries enable row level security;
create policy "profiles in my family" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.shares_group(id));
create policy "my groups" on public.groups for select to authenticated using (public.is_group_member(id));
create policy "my group members" on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy "family goals" on public.goals for select to authenticated using (public.is_group_member(group_id));
create policy "create own goal" on public.goals for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_group_member(group_id));
create policy "family entries" on public.entries for select to authenticated using (exists (select 1 from public.goals g where g.id = goal_id and public.is_group_member(g.group_id)));
create policy "log own goal" on public.entries for insert to authenticated with check (author_id = (select auth.uid()) and exists (select 1 from public.goals g where g.id = goal_id and g.owner_id = (select auth.uid()) and public.is_group_member(g.group_id)) and (photo_path is null or photo_path like ((select g.group_id::text from public.goals g where g.id = goal_id) || '/' || (select auth.uid())::text || '/%')));

create function public.create_family_group(group_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_group uuid;
begin
  if auth.uid() is null then raise exception 'Faça login para criar um grupo.'; end if;
  if exists(select 1 from public.group_members where user_id = auth.uid()) then raise exception 'Você já participa de um grupo.'; end if;
  if char_length(trim(group_name)) not between 1 and 60 then raise exception 'Informe um nome de até 60 caracteres.'; end if;
  insert into public.groups(name, created_by) values(trim(group_name), auth.uid()) returning id into new_group;
  insert into public.group_members(group_id, user_id) values(new_group, auth.uid());
  return new_group;
end;
$$;
create function public.join_family_group(code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare found_group uuid;
begin
  if auth.uid() is null then raise exception 'Faça login para entrar em um grupo.'; end if;
  if exists(select 1 from public.group_members where user_id = auth.uid()) then raise exception 'Você já participa de um grupo.'; end if;
  select id into found_group from public.groups where invite_code = upper(trim(code));
  if found_group is null then raise exception 'Código de convite não encontrado.'; end if;
  insert into public.group_members(group_id, user_id) values(found_group, auth.uid());
  return found_group;
end;
$$;
revoke all on function public.create_family_group(text) from public;
revoke all on function public.join_family_group(text) from public;
grant execute on function public.create_family_group(text), public.join_family_group(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
create policy "family can view progress photos" on storage.objects for select to authenticated
using (bucket_id = 'progress-photos' and public.is_group_member((split_part(name, '/', 1))::uuid));
create policy "owner can upload progress photos" on storage.objects for insert to authenticated
with check (bucket_id = 'progress-photos' and public.is_group_member((split_part(name, '/', 1))::uuid) and split_part(name, '/', 2) = (select auth.uid())::text);
create policy "owner can remove progress photos" on storage.objects for delete to authenticated
using (bucket_id = 'progress-photos' and split_part(name, '/', 2) = (select auth.uid())::text);
