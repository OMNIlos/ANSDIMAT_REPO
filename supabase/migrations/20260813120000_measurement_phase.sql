-- Период опробования у замера: откачка или восстановление уровня.
--
-- Одиночная откачка ведёт два раздельных журнала — как таблицы «Время» /
-- «Понижение» и «Время восстан.» / «Восстановление» в настольном АНСДИМАТ.
-- Общий журнал на обе фазы невозможен: время понижения отсчитывается от
-- начала откачки, время восстановления — от остановки насоса, и одни и те же
-- числа в двух журналах означают разные моменты опыта.
--
-- Значение по умолчанию оставляет уже загруженные замеры откачкой: до этой
-- миграции журнал был один, и его строки — это понижение уровня.

alter table public.measurements
  add column phase text not null default 'pumping';

alter table public.measurements
  add constraint measurements_phase_check check (phase in ('pumping', 'recovery'));

-- Замеры выбираются журналом целиком, по проекту и фазе
drop index if exists public.measurements_project_idx;
create index measurements_project_idx
  on public.measurements (project_id, phase, sort_order);
