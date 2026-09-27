/**
 * Геометрия разреза котлована
 *
 * Считает координаты, по которым рисуется иллюстрация: где лежат слои, где
 * стоит котлован, как идёт депрессионная кривая. Вынесено из компонента, чтобы
 * проверять расположение элементов тестами, не поднимая рендер.
 *
 * Координаты — в системе полотна 700 × 378, как в веб-версии: числа взяты
 * оттуда без пересчёта, чтобы разрез в приложении и на сайте совпадал.
 *
 * Разрез масштабируется по расчёту, но не буквально: при R/r₀ порядка сотни
 * честный масштаб превратил бы котлован в точку. Поэтому котлован имеет
 * постоянный размер, а по нему масштабируется радиус влияния — и то с
 * ограничением, чтобы кривая не ушла за край полотна.
 */

/** Ширина полотна */
export const WIDTH = 700;
/** Высота полотна */
export const HEIGHT = 378;

/** Палитра веб-версии: от темы приложения не зависит, как и на сайте */
export const PALETTE = {
  ink: '#3a3538',
  mute: '#7a7376',
  water: '#2f8bb0',
  waterFill: '#9fd3ea',
  waterTri: '#7ec8e3',
  aquifer: '#efe2b8',
  aquitard: '#c9c2b6',
  paper: '#f4f8f9',
  hatch: '#8d867c',
  dots: '#c4b48a',
  topsoil: '#8a7b68',
};

const GROUND_Y = 58;
const BASE_Y = 268;
const TOP_WIDTH = 124;
const BOTTOM_WIDTH = 80;
/** Доля глубины, ниже которой дно котлована не поднимается */
const MIN_DEPTH_FRACTION = 0.24;
/** Доля глубины, выше которой дно котлована не опускается */
const MAX_DEPTH_FRACTION = 0.78;
/** Насколько «плоско» начинается воронка у стенки котлована */
const CONE_SHAPE = 0.42;
/** Сколько точек в половине депрессионной кривой */
const CONE_SAMPLES = 16;

/**
 * Собирает координаты разреза по результату расчёта
 *
 * @param {Object|null} result - результат compute из calc/pitInflow
 * @returns {Object} координаты элементов разреза
 */
export function pitGeometry(result) {
  const ok = Boolean(result && result.ok);
  // Тип пласта и река известны и при неудавшемся расчёте — это выбранная
  // схема. Пока вводится понижение, промежуточный ввод (пустое поле, ноль,
  // s > h₀) давал ошибку, и разрез перескакивал на напорный пласт с серыми
  // слоями глины: схема котлована через раз заливалась серым
  const confined = typeof result?.confined === 'boolean' ? result.confined : true;
  const river = typeof result?.river === 'boolean' ? result.river : false;

  const padRight = river ? 112 : 32;
  const x0 = 40;
  const x1 = WIDTH - padRight;
  const cx = river ? 278 : 348;

  // При неполном вводе разрез всё равно рисуется — по тем же значениям,
  // что показывает веб-версия: пустое место под иллюстрацией хуже, чем
  // схема «как обычно бывает»
  let h0 = ok ? (confined ? result.m : result.h0) : 20;
  if (!(h0 > 0)) h0 = 20;
  let drawdown = ok ? result.S : 10;
  if (!(drawdown > 0)) drawdown = Math.min(10, h0);

  const depthFraction = Math.max(
    MIN_DEPTH_FRACTION,
    Math.min(MAX_DEPTH_FRACTION, drawdown / Math.max(h0, drawdown))
  );

  let aquiferTop;
  let aquiferBottom;
  let waterLevelY;
  let pitBottomY;
  if (confined) {
    aquiferTop = 118;
    aquiferBottom = 206;
    waterLevelY = 88;
    pitBottomY = aquiferBottom - 10;
  } else {
    aquiferTop = GROUND_Y;
    aquiferBottom = BASE_Y;
    waterLevelY = 102;
    pitBottomY = waterLevelY + (BASE_Y - waterLevelY - 22) * depthFraction;
  }

  // Стенки котлована наклонены, и на уровне дна половина ширины равна
  // половине нижнего основания — от неё и отсчитывается приведённый радиус
  const r0px = BOTTOM_WIDTH / 2;

  const maxReach = Math.min(cx - x0, x1 - cx);
  let Rpx = river ? x1 - cx : maxReach - 8;
  if (ok && result.r0 > 0 && result.R > result.r0) {
    const scale = r0px / result.r0;
    Rpx = Math.max(r0px + 40, Math.min(result.R * scale, maxReach - 6));
  }

  return {
    ok,
    confined,
    river,
    x0,
    x1,
    cx,
    groundY: GROUND_Y,
    baseY: BASE_Y,
    aquiferTop,
    aquiferBottom,
    waterLevelY,
    pitBottomY,
    pitTopLeft: cx - TOP_WIDTH / 2,
    pitTopRight: cx + TOP_WIDTH / 2,
    pitBottomLeft: cx - BOTTOM_WIDTH / 2,
    pitBottomRight: cx + BOTTOM_WIDTH / 2,
    r0px,
    Rpx,
    riverX: x1 + 10,
  };
}

/**
 * Уровень депрессионной кривой на заданном удалении от оси
 *
 * Профиль логарифмический — как и само решение Дюпюи, — но у стенки котлована
 * подрезан корнем: без этого кривая обрывалась бы в стенку почти вертикально
 * и на рисунке читалась бы как разрыв, а не как воронка.
 *
 * @param {Object} geometry - результат pitGeometry
 * @param {number} distance - удаление от оси котлована, px
 * @returns {number} координата y уровня воды
 */
export function coneY(geometry, distance) {
  const { r0px, Rpx, pitBottomY, waterLevelY } = geometry;
  if (distance <= r0px) return pitBottomY;
  if (distance >= Rpx) return waterLevelY;

  const t = Math.log(distance / r0px) / Math.log(Rpx / r0px);
  const h = Math.sqrt(CONE_SHAPE * CONE_SHAPE + (1 - CONE_SHAPE * CONE_SHAPE) * t);
  const fraction = (h - CONE_SHAPE) / (1 - CONE_SHAPE);
  return pitBottomY + (waterLevelY - pitBottomY) * fraction;
}

/**
 * Путь половины депрессионной кривой
 *
 * @param {Object} geometry - результат pitGeometry
 * @param {number} side - −1 влево от котлована, +1 вправо
 * @returns {string} значение атрибута d для Path
 */
export function conePath(geometry, side) {
  const { cx, x0, x1, r0px, Rpx } = geometry;
  const points = [];
  for (let i = 0; i <= CONE_SAMPLES; i++) {
    const d = r0px + ((Rpx - r0px) * i) / CONE_SAMPLES;
    let x = side < 0 ? cx - d : cx + d;
    if (side < 0 && x < x0) x = x0;
    if (side > 0 && x > x1) x = x1;
    points.push(
      `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${coneY(geometry, Math.abs(x - cx)).toFixed(1)}`
    );
  }
  return points.join(' ');
}

/**
 * Половина ширины котлована на заданной глубине
 *
 * Нужна, чтобы линии кровли и подошвы пласта обрывались о стенку выработки,
 * а не проходили сквозь неё.
 *
 * @param {Object} geometry - результат pitGeometry
 * @param {number} y - глубина, px
 * @param {number} side - −1 левая стенка, +1 правая
 * @returns {number} координата x стенки
 */
export function wallX(geometry, y, side) {
  const { cx, groundY, pitBottomY } = geometry;
  const t = (y - groundY) / (pitBottomY - groundY);
  const half = TOP_WIDTH / 2 + t * ((BOTTOM_WIDTH - TOP_WIDTH) / 2);
  return side < 0 ? cx - half : cx + half;
}
