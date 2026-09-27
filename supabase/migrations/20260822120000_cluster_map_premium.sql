-- Карта куста уходит в премиум, плюс публичный промокод ANSDIMAT2026.
--
-- Карта в обработке ОФР — единственное место, где расстояния до скважин
-- задаются перетаскиванием по местности, а не вводом чисел. Обработка сама
-- остаётся бесплатной: расстояние по-прежнему можно вписать руками в таблицу,
-- закрывается только карта.
--
-- Промокод здесь первый публичный: раздаётся многим, а не одному партнёру.
-- Прежняя функция активации была рассчитана на код с одним применением, и на
-- многоразовом коде вылезали две дыры — их и чиним ниже.

-- ── Признак доступа к карте куста ────────────────────────────────────────
--
-- Клиент про премиум не решает: он спрашивает список открытых возможностей и
-- показывает карту, только если сервер вернул clusterMap.
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
      'unlimitedProjects', premium,
      -- Карта куста: расстановка скважин по карте вместо ввода расстояний
      'clusterMap', premium
    )
  );
end;
$$;

revoke all on function public.get_entitlements() from public;
grant execute on function public.get_entitlements() to authenticated;

-- ── Активация кода, пригодная для многоразового промокода ────────────────
--
-- Что менялось против прежней версии:
--
-- 1. Повторный ввод того же кода тем же аккаунтом больше не тратит лимит.
--    Раньше used_count рос на каждое нажатие «Применить», и один человек мог
--    выбрать весь запас публичного кода за минуту.
--
-- 2. Повторный ввод больше не продлевает подписку. Раньше срок каждый раз
--    отсчитывался заново от now(), то есть годовой доступ продлевался
--    бесконечно тем же кодом. Теперь активация идемпотентна: второй ввод
--    возвращает уже выданный срок и ничего не меняет.
create or replace function public.redeem_promo_code(p_code text)
returns table (status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  promo public.promo_codes%rowtype;
  tx text;
  ends timestamptz;
  issued timestamptz;
begin
  if uid is null then
    raise exception 'Не выполнен вход';
  end if;

  select * into promo from public.promo_codes
   where code = upper(trim(p_code)) for update;

  if not found then
    raise exception 'Промокод не найден';
  end if;
  if promo.expires_at is not null and promo.expires_at < now() then
    raise exception 'Срок действия промокода истёк';
  end if;

  tx := promo.code || ':' || uid;

  -- Код уже применён этим аккаунтом: отдаём выданный срок как есть
  select s.expires_at into issued from public.subscriptions s
   where s.owner_id = uid and s.platform = 'promo' and s.original_tx_id = tx;

  if found then
    return query select 'active'::text, issued;
    return;
  end if;

  if promo.used_count >= promo.max_uses then
    raise exception 'Промокод уже использован';
  end if;

  ends := now() + make_interval(months => promo.months);

  insert into public.subscriptions
    (owner_id, platform, product_id, original_tx_id, status, expires_at, auto_renew)
  values
    (uid, 'promo', 'promo_' || promo.code, tx, 'active', ends, false);

  update public.promo_codes set used_count = used_count + 1 where code = promo.code;

  return query select 'active'::text, ends;
end;
$$;

revoke all on function public.redeem_promo_code(text) from public;
grant execute on function public.redeem_promo_code(text) to authenticated;

-- ── Сам код ──────────────────────────────────────────────────────────────
--
-- Публичный, поэтому запас применений большой: лимит здесь защищает от
-- перебора, а не считает партнёров. Срок действия самого кода не задан —
-- он раздаётся бессрочно; чтобы закрыть раздачу, довольно проставить
-- promo_codes.expires_at, уже выданные подписки при этом не тронутся.
insert into public.promo_codes (code, months, max_uses, expires_at)
values ('ANSDIMAT2026', 12, 1000000, null)
on conflict (code) do update
  set months = excluded.months,
      max_uses = excluded.max_uses,
      expires_at = excluded.expires_at;
