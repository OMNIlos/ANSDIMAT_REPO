/**
 * Серии графика на экране обработки
 *
 * Экран знает то, чего не знает график: вид прослеживания, фазу опыта,
 * расстояния до скважин и момент площадного среза. Здесь всё это сводится к
 * списку кривых, а график получает уже готовые ряды.
 *
 * Фазы на одном полотне не смешиваются. Выбрана откачка — на графике откачка,
 * выбрано восстановление — остаточное понижение, и ничего кроме. Общая у них
 * только ось ординат: по абсциссе у откачки время от её начала, у
 * восстановления отношение t/t′, и две кривые на одних осях читались как одна
 * зависимость, которой нет. Кривые соседних скважин куста добавляет экран —
 * он один знает, чьи журналы открыты и какие из них показывать.
 *
 * Все величины базовые — минуты и метры. Перевод в выбранные пользователем
 * размерности стоит на границе экрана.
 */

import { residualDrawdown, SERIES_ROLES } from '../../calc/chartSeries';
import { TRACKING_KINDS } from '../../calc/tracking';
import I18n from '../../Localization';

/** Пустой ряд: общая ссылка, чтобы пересчёты не срабатывали вхолостую */
const NO_ROWS = [];

/**
 * Подписывает кривую
 *
 * Обе кривые фазы восстановления назывались именем скважины, и в легенде
 * стояли две одинаковые строки — понять, где откачка, а где восстановление,
 * было невозможно. Имя скважины дописывается к названию фазы, а не заменяет
 * его: у куста журналов по паре на каждую скважину.
 *
 * @param {string} phase - название фазы
 * @param {string} [wellName] - имя открытой скважины
 * @returns {string} подпись кривой
 */
const seriesName = (phase, wellName) => (wellName ? `${phase} — ${wellName}` : phase);

/**
 * Переводит журнал восстановления в координаты прямой Тейса
 *
 * По оси абсцисс отношение t/t′ — время от начала откачки к времени от её
 * остановки. Журнал ведётся от остановки, поэтому время от начала — это
 * длительность откачки плюс запись журнала.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number, row?: string}>} params.measurements -
 *   журнал восстановления: t от остановки насоса
 * @param {number} params.pumpingDuration - сколько длилась откачка, мин
 * @returns {Array<{t: number, s: number, row?: string}>} точки с отношением
 *   в абсциссе
 */
export function recoveryAbscissa({ measurements, pumpingDuration }) {
  if (!(pumpingDuration > 0)) return [];
  return (measurements ?? [])
    .map((m) => ({ row: m.row, t: (pumpingDuration + m.t) / m.t, s: m.s }))
    // Отношение равно единице при бесконечном времени и меньше единицы не
    // бывает: всё прочее — замер, введённый до остановки насоса
    .filter((p) => isFinite(p.t) && p.t > 1 && isFinite(p.s));
}

/**
 * Понижение на момент остановки насоса у одной скважины
 *
 * Ноль журнала восстановления отвечает именно этому понижению: остаточное
 * понижение считается как разница между ним и подъёмом уровня. Число это
 * своё у каждой скважины куста — опытная садится на метры, дальняя
 * наблюдательная на сантиметры, — и общее на весь проект значение давало
 * остаток чужой скважины. Разница выходила отрицательной, обрезалась нулём,
 * и кривая ложилась горизонталью по нулю, ничего не сообщая о причине.
 *
 * Журнал откачки этой же скважины и есть источник: насос работал до
 * последней его строки, и её понижение — понижение на остановке. То же
 * самое делает клавиша Ins в табл. «Окончание» настольного АНСДИМАТ.
 * Заданное руками значение важнее: журнал не всегда доведён до остановки.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - журнал откачки
 *   этой скважины
 * @param {number} [params.stored] - заданное руками понижение на остановке
 * @returns {number} понижение на остановке, м; 0, если взять его неоткуда
 */
export function finalDrawdownAtStop({ measurements, stored }) {
  if (stored > 0) return stored;

  // С конца: последняя заполненная строка журнала и есть момент остановки.
  // Пустые строки в хвосте — заготовки под следующий замер, а не замеры
  const rows = measurements ?? NO_ROWS;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const s = Number(rows[i]?.s);
    if (isFinite(s) && s > 0) return s;
  }
  return 0;
}

/**
 * Собирает описания кривых для графика
 *
 * @param {Object} params
 * @param {string} params.trackingKind - вид прослеживания, см. TRACKING_KINDS
 * @param {Array<{t: number, s: number}>} params.measurements - журнал откачки
 * @param {Array<{t: number, s: number}>} params.recoveryMeasurements - журнал
 *   восстановления: t от остановки насоса, s — подъём уровня
 * @param {number} params.finalDrawdown - понижение на момент остановки
 * @param {number} params.pumpingDuration - сколько длилась откачка, мин
 * @param {Array<{id: string, name: string, distance: number}>} params.wellsWithDistance
 * @param {Object} params.wellMeasurements - журналы куста по скважинам
 * @param {number} params.moment - момент площадного среза, мин
 * @param {boolean} params.isRecovery - открыта ли фаза восстановления
 * @param {string} params.activeWellName - имя открытой скважины
 * @param {Function} [params.sameMoment] - сравнение времени с моментом среза
 * @returns {Array<Object>} описания серий для calc/chartSeries.js
 */
export function chartRawSeries({
  trackingKind,
  measurements,
  recoveryMeasurements,
  finalDrawdown,
  pumpingDuration,
  wellsWithDistance,
  wellMeasurements,
  moment,
  isRecovery,
  activeWellName,
  sameMoment = (a, b) => a === b,
}) {
  // Фаза опыта важнее вида прослеживания. Виды с расстоянием в абсциссе —
  // площадной s — lg r и комбинированный s — lg(t/r²) — читают журнал
  // откачки: расстояние входит в них через понижение при работающем насосе.
  // На восстановлении такой зависимости нет вовсе — остаточное понижение по
  // Джейкобу равно 0.183·Q/T·lg(t/t′) и от r не зависит, — поэтому строить
  // по кусту нечего. Обе ветки стояли выше проверки фазы, и переход на
  // восстановление оставлял на полотне точки откачки: подписи осей менялись,
  // данные — нет, а прямую по ним можно было ещё и подвинуть
  if (!isRecovery) {
    // Площадное прослеживание — срез по кусту на один момент: годятся только
    // совпадающие замеры, интерполировать понижение между отсчётами значило бы
    // ставить на график то, чего в журнале нет
    if (trackingKind === TRACKING_KINDS.AREA) {
      if (!(moment > 0)) return [];
      const points = wellsWithDistance
        .map((well) => {
          const hit = (wellMeasurements[well.id] ?? NO_ROWS).find((m) =>
            sameMoment(m.t, moment)
          );
          return hit ? { row: hit.row, t: well.distance, s: hit.s } : null;
        })
        .filter(Boolean)
        // По возрастанию расстояния: ломаная по таким точкам и есть профиль
        // депрессионной воронки
        .sort((a, b) => a.t - b.t);

      return points.length
        ? [
            {
              id: 'pumping',
              name: activeWellName,
              role: SERIES_ROLES.FIT,
              measurements: points,
            },
          ]
        : [];
    }

    if (trackingKind === TRACKING_KINDS.COMBINED) {
      const points = wellsWithDistance.flatMap((well) =>
        (wellMeasurements[well.id] ?? NO_ROWS).map((m) => ({
          row: m.row,
          t: m.t / (well.distance * well.distance),
          s: m.s,
          group: well.id,
          groupName: well.name,
        }))
      );
      return points.length
        ? [
            {
              id: 'pumping',
              name: activeWellName,
              role: SERIES_ROLES.FIT,
              measurements: points,
            },
          ]
        : [];
    }
  }

  if (!isRecovery) {
    return [
      {
        id: 'pumping',
        name: activeWellName,
        role: SERIES_ROLES.FIT,
        measurements,
      },
    ];
  }

  // Фазы не смешиваются на одном полотне. Раньше на восстановлении рядом с
  // остаточным понижением лежала кривая откачки — у них общая только ось
  // ординат: по абсциссе у откачки время от её начала, у восстановления
  // отношение t/t′. Две кривые в разных абсциссах на одних осях читаются
  // как одна зависимость, которой нет. Выбрана откачка — на полотне откачка
  // всех скважин, выбрано восстановление — восстановление всех скважин
  const points = recoveryAbscissa({
    measurements: residualDrawdown({
      measurements: recoveryMeasurements,
      finalDrawdown,
    }),
    pumpingDuration,
  });

  return points.length
    ? [
        {
          id: 'recovery',
          name: seriesName(
            I18n.t('phaseRecovery', { defaultValue: 'Восстановление' }),
            activeWellName
          ),
          role: SERIES_ROLES.FIT,
          measurements: points,
        },
      ]
    : [];
}
