-- A patente escolhida pertence ao perfil, visível aos integrantes da família.
alter table public.profiles add column if not exists selected_rank text;

alter table public.profiles add constraint profiles_selected_rank_check check (
  selected_rank is null or selected_rank in (
    'Betinha', 'Recruta', 'Cabo', 'Cabo Veterano', 'Sargento', 'Sargento-Mor',
    'Subtenente', 'Capitão', 'Major', 'Comandante', 'Coronel', 'General',
    'General de Divisão', 'Marechal', 'Mito', 'Semideus', 'Lenda',
    'Lenda Suprema', 'Imortal', 'Titã', 'Guardião da Família', 'Monarca',
    'Ícone', 'Eterno'
  )
);

create policy "choose my rank" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (selected_rank) on public.profiles to authenticated;
