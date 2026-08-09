-- Права ролей на таблицы.
--
-- RLS работает поверх обычных привилегий Postgres, а не вместо них: без
-- GRANT роль `authenticated` получает 403 ещё до того, как политика успеет
-- что-то разрешить. Гранты дают доступ «к таблице вообще», политики —
-- «к своим строкам».

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.measurements to authenticated;
grant select, insert, update, delete on public.observation_points to authenticated;

-- Подписки только читаются: записи создаёт вебхук магазина под сервисным
-- ключом или функция промокода
grant select on public.subscriptions to authenticated;

-- Промокоды не читаются вовсе — иначе список кодов можно выкачать целиком;
-- проверка идёт внутри redeem_promo_code
