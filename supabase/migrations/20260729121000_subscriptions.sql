-- Подписки и права доступа к премиум-функциям.
--
-- Ключевое: права выдаёт сервер, а не клиент. До этой миграции статус лежал
-- в памяти устройства, и премиум включался правкой одного значения.
--
-- Записи о покупках создаёт не приложение, а серверная сторона: вебхук
-- магазина или администратор (промо-доступ). Поэтому политики на запись
-- клиенту не выдаются вовсе — только чтение своих строк.

create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users on delete cascade,
  platform       text not null check (platform in ('ios', 'android', 'promo')),
  product_id     text not null,
  original_tx_id text not null,
  status         text not null check (status in ('active', 'grace', 'expired', 'refunded')),
  expires_at     timestamptz,
  auto_renew     boolean not null default true,
  environment    text not null default 'production' check (environment in ('sandbox', 'production')),
  raw_payload    jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (platform, original_tx_id)
);

create index subscriptions_owner_idx
  on public.subscriptions (owner_id, status, expires_at desc);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;

create policy "подписки видны владельцу" on public.subscriptions
  for select using (auth.uid() = owner_id);

-- ── Промокоды: доступ для заказчика, партнёров и преподавателей
create table public.promo_codes (
  code       text primary key,
  months     integer not null default 12 check (months > 0),
  max_uses   integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.promo_codes enable row level security;
-- Политик на чтение нет намеренно: код проверяется функцией ниже,
-- иначе список кодов можно было бы просто выкачать

/**
 * Активирует промокод и открывает премиум на указанный срок
 */
create or replace function public.redeem_promo_code(p_code text)
returns table (status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  promo public.promo_codes%rowtype;
  ends timestamptz;
begin
  if uid is null then
    raise exception 'Не выполнен вход';
  end if;

  select * into promo from public.promo_codes
   where code = upper(trim(p_code)) for update;

  if not found then
    raise exception 'Промокод не найден';
  end if;
  if promo.used_count >= promo.max_uses then
    raise exception 'Промокод уже использован';
  end if;
  if promo.expires_at is not null and promo.expires_at < now() then
    raise exception 'Срок действия промокода истёк';
  end if;

  ends := now() + make_interval(months => promo.months);

  insert into public.subscriptions
    (owner_id, platform, product_id, original_tx_id, status, expires_at, auto_renew)
  values
    (uid, 'promo', 'promo_' || promo.code, promo.code || ':' || uid, 'active', ends, false)
  on conflict (platform, original_tx_id) do update
    set status = 'active', expires_at = excluded.expires_at;

  update public.promo_codes set used_count = used_count + 1 where code = promo.code;

  return query select 'active'::text, ends;
end;
$$;

revoke all on function public.redeem_promo_code(text) from public;
grant execute on function public.redeem_promo_code(text) to authenticated;

/**
 * Возвращает права текущего пользователя
 *
 * Единственный источник правды о премиуме. Клиент кэширует ответ, но не
 * решает сам: в кэше лежит срок, выданный сервером.
 */
create or replace function public.get_entitlements()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  sub public.subscriptions%rowtype;
  premium boolean := false;
begin
  if uid is null then
    return jsonb_build_object('premium', false, 'source', 'anonymous');
  end if;

  select * into sub from public.subscriptions
   where owner_id = uid
     and status in ('active', 'grace')
     and (expires_at is null or expires_at > now())
   order by expires_at desc nulls first
   limit 1;

  premium := found;

  return jsonb_build_object(
    'premium', premium,
    'source', coalesce(sub.platform, 'none'),
    'expiresAt', sub.expires_at,
    'checkedAt', now(),
    -- Что именно открывает подписка. Обработка ОФР и базовый калькулятор
    -- остаются бесплатными: это ядро продукта
    'features', jsonb_build_object(
      'sync', premium,
      'advancedCalc', premium,
      'exportPdf', premium,
      'unlimitedProjects', premium
    )
  );
end;
$$;

revoke all on function public.get_entitlements() from public;
grant execute on function public.get_entitlements() to authenticated;
