-- Скважины опробования.
--
-- Кустовая откачка описывается не одним рядом замеров, а несколькими: вокруг
-- опытной скважины стоит любое число наблюдательных, у каждой свой ряд
-- «время — понижение» и своя кривая на графике.
--
-- Опытная скважина в проекте одна: две и больше — это уже групповая откачка,
-- отдельная схема со своими решениями. Ограничение держится частичным
-- уникальным индексом, чтобы вторую нельзя было завести и синхронизацией.

create table public.wells (
  id         uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  owner_id   uuid not null references auth.users on delete cascade,
  name       text not null,
  role       text not null default 'observation',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint wells_role_check check (role in ('pumping', 'observation'))
);

create index wells_owner_updated_idx on public.wells (owner_id, updated_at desc);
create index wells_project_idx on public.wells (project_id, sort_order);

create unique index wells_single_pumping_idx
  on public.wells (project_id)
  where role = 'pumping' and deleted_at is null;

create trigger wells_touch before update on public.wells
  for each row execute function public.touch_updated_at();

alter table public.wells enable row level security;

create policy "скважины видны владельцу" on public.wells
  for select using (auth.uid() = owner_id);
create policy "скважины создаёт владелец" on public.wells
  for insert with check (auth.uid() = owner_id);
create policy "скважины правит владелец" on public.wells
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "скважины удаляет владелец" on public.wells
  for delete using (auth.uid() = owner_id);

grant select, insert, update, delete on public.wells to authenticated;

-- Замер принадлежит скважине. Пусто у видов ОФР с одной скважиной
alter table public.measurements
  add column well_id uuid references public.wells on delete cascade;

create index measurements_well_idx on public.measurements (well_id, sort_order);
