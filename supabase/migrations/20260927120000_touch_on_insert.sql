-- updated_at ставит сервер и при вставке.
--
-- Триггеры touch_updated_at висели только на UPDATE, и новая строка
-- сохраняла время, присланное клиентом, то есть часы телефона. Отметки
-- синхронизации при этом серверные. Отстают часы — новый журнал ложится на
-- сервер раньше отметки второго устройства, и его pull журнал не увидит,
-- пока строку кто-нибудь не поправит. Спешат — строка из будущего уводит
-- отметку второго устройства вперёд, и оно пропускает настоящие правки,
-- пока время её не догонит.
--
-- Профили и подписки не трогаем: клиент их не вставляет (профиль заводит
-- handle_new_user, подписки — вебхук и redeem_promo_code), и по их
-- updated_at никто не синхронизируется.

create or replace trigger projects_touch before insert or update on public.projects
  for each row execute function public.touch_updated_at();
create or replace trigger measurements_touch before insert or update on public.measurements
  for each row execute function public.touch_updated_at();
create or replace trigger points_touch before insert or update on public.observation_points
  for each row execute function public.touch_updated_at();
create or replace trigger wells_touch before insert or update on public.wells
  for each row execute function public.touch_updated_at();
