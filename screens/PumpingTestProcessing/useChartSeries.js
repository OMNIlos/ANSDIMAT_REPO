/**
 * Серии графика на экране обработки
 *
 * Экран знает то, чего не знает график: вид прослеживания, фазу опыта,
 * расстояния до скважин и момент площадного среза. Здесь всё это сводится к
 * списку кривых, а график получает уже готовые ряды.
 *
 * Главное, чего здесь не было: кривая восстановления. Журнал восстановления
 * заполнялся, проверялся на полноту и писался в базу, но до графика не
 * доходил никогда — точки в обеих фазах собирались из журнала откачки.
 *
 * Все величины базовые — минуты и метры. Перевод в выбранные пользователем
 * размерности стоит на границе экрана.
 */

import { residualDrawdown, SERIES_ROLES } from '../../calc/chartSeries';
import { TRACKING_KINDS } from '../../calc/tracking';

/** По какой кривой ведётся прямая и считается водопроводимость */
export const FIT_SERIES = { PUMPING: 'pumping', RECOVERY: 'recovery' };

/** Пустой ряд: общая ссылка, чтобы пересчёты не срабатывали вхолостую */
const NO_ROWS = [];

/**
 * Переводит журнал восстановления в координаты прямой Тейса
 *
 * По оси абсцисс отношение t/t′ — время от начала откачки к времени от её
 * остановки. Журнал ведётся от остановки, поэтому время от начала — это
 * длительность откачки плюс запись журнала.
 *
 * @param {Object} params
 * @param {Array<{t: number, s: number}>} params.measurements - журнал
 *   восстановления: t от остановки насоса
 * @param {number} params.pumpingDuration - сколько длилась откачка, мин
 * @returns {Array<{t: number, s: number}>} точки с отношением в абсциссе
 */
export function recoveryAbscissa({ measurements, pumpingDuration }) {
  if (!(pumpingDuration > 0)) return [];
  return (measurements ?? [])
    .map((m) => ({ t: (pumpingDuration + m.t) / m.t, s: m.s }))
    // Отношение равно единице при бесконечном времени и меньше единицы не
    // бывает: всё прочее — замер, введённый до остановки насоса
    .filter((p) => isFinite(p.t) && p.t > 1 && isFinite(p.s));
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
 * @param {string} params.fitSeries - по какой кривой прямая, см. FIT_SERIES
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
  fitSeries,
  activeWellName,
  sameMoment = (a, b) => a === b,
}) {
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
        return hit ? { t: well.distance, s: hit.s } : null;
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

  const pumping = {
    id: 'pumping',
    name: activeWellName,
    role: SERIES_ROLES.FIT,
    measurements,
  };

  if (!isRecovery) return [pumping];

  const residual = residualDrawdown({
    measurements: recoveryMeasurements,
    finalDrawdown,
  });

  // Прямая Тейса: остаточное понижение спрямляется только по lg(t/t′), и
  // только там T = 0.183·Q/a верна. Кривую откачки в этих координатах не
  // построить — у её замеров нет времени от остановки насоса, поэтому на
  // полотне остаётся одна кривая. Совмещать их видимостью нечестно
  if (fitSeries === FIT_SERIES.RECOVERY) {
    const points = recoveryAbscissa({
      measurements: residual,
      pumpingDuration,
    });
    return points.length
      ? [
          {
            id: 'recovery',
            name: activeWellName,
            role: SERIES_ROLES.FIT,
            measurements: points,
          },
        ]
      : [];
  }

  // Без понижения на остановке остаток не с чем считать: остаётся одна
  // кривая, а экран объясняет, какого поля не хватает
  if (!residual.length) return [pumping];

  return [
    pumping,
    {
      id: 'recovery',
      name: activeWellName,
      role: SERIES_ROLES.REFERENCE,
      measurements: residual,
    },
  ];
}
