-- Базовая схема АНСДИМАТ: профили, журналы ОФР, замеры, точки дневника.
--
-- Три сквозных принципа:
--   * owner_id есть у каждой строки — на нём построен весь доступ (RLS);
--   * updated_at ставит сервер, а не клиент: часы на телефоне уходят, и по
--     локальному времени запись «из будущего» навсегда выигрывала бы конфликты;
--   * удаление мягкое (deleted_at) — иначе второе устройство, бывшее офлайн,
--     не узнает об удалении и зальёт строку обратно.

-- ── Профиль поверх auth.users: в саму таблицу авторизации поля не добавить
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  organization text,
  locale       text not null default 'ru',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.projects (
  id               uuid primary key,
  owner_id         uuid not null references auth.users on delete cascade,
  name             text not null,
  ofr_type         text not null default 'single',
  q                double precision not null default 0,
  pumping_duration double precision not null default 0,
  starred          boolean not null default false,
  result_t         double precision,
  result_slope     double precision,
  result_method    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create table public.measurements (
  id         uuid primary key,
  project_id uuid not null references public.projects on delete cascade,
  owner_id   uuid not null references auth.users on delete cascade,
  t          double precision not null,
  s          double precision not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.observation_points (
  id          uuid primary key,
  owner_id    uuid not null references auth.users on delete cascade,
  title       text not null,
  type        text not null default 'observation',
  lat         double precision not null,
  lon         double precision not null,
  note        text,
  recorded_at timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Выборка при синхронизации всегда идёт по владельцу и метке времени
create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);
create index measurements_owner_updated_idx on public.measurements (owner_id, updated_at desc);
create index measurements_project_idx on public.measurements (project_id, sort_order);
create index points_owner_updated_idx on public.observation_points (owner_id, updated_at desc);

-- ── Серверное время правки
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger measurements_touch before update on public.measurements
  for each row execute function public.touch_updated_at();
create trigger points_touch before update on public.observation_points
  for each row execute function public.touch_updated_at();

-- ── Профиль заводится сам при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Доступ: каждый видит и меняет только своё
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.measurements enable row level security;
alter table public.observation_points enable row level security;

create policy "профиль виден владельцу" on public.profiles
  for select using (auth.uid() = id);
create policy "профиль правит владелец" on public.profiles
  for update using (auth.uid() = id);

create policy "журналы видны владельцу" on public.projects
  for select using (auth.uid() = owner_id);
create policy "журналы создаёт владелец" on public.projects
  for insert with check (auth.uid() = owner_id);
create policy "журналы правит владелец" on public.projects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "журналы удаляет владелец" on public.projects
  for delete using (auth.uid() = owner_id);

-- Замер принадлежит владельцу и обязан лежать в его же журнале: без второй
-- проверки чужие замеры можно было бы подложить в свой проект
create policy "замеры видны владельцу" on public.measurements
  for select using (auth.uid() = owner_id);
create policy "замеры создаёт владелец" on public.measurements
  for insert with check (
    auth.uid() = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
  );
create policy "замеры правит владелец" on public.measurements
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "замеры удаляет владелец" on public.measurements
  for delete using (auth.uid() = owner_id);

create policy "точки видны владельцу" on public.observation_points
  for select using (auth.uid() = owner_id);
create policy "точки создаёт владелец" on public.observation_points
  for insert with check (auth.uid() = owner_id);
create policy "точки правит владелец" on public.observation_points
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "точки удаляет владелец" on public.observation_points
  for delete using (auth.uid() = owner_id);

-- ── Удаление аккаунта из приложения
--
-- Обязательное требование App Store и Google Play. Функция работает от имени
-- владельца схемы, поэтому может удалить строку в auth.users; каскады
-- вычищают журналы, замеры и точки.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Не выполнен вход';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
