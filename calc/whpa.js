/**
 * Зона санитарной охраны водозаборной скважины
 *
 * Перенос веб-калькулятора ЗСО. Отвечает на вопрос, какую площадь вокруг
 * скважины придётся закрыть от застройки и стоков: СанПиН 2.1.4.1110-02 делит
 * охрану на три пояса, и границы второго и третьего считаются по времени
 * добегания загрязнения до скважины.
 *
 * Пояс I задаётся радиусом — это огороженная площадка вокруг устья, её
 * размер норматив назначает, а не считает.
 *
 * Пояса II и III считаются двумя способами, и выбор между ними — не
 * формальность:
 *
 * - объёмный: скважина отбирает воду отовсюду одинаково, граница — круг
 *   радиуса √(Q t / π m n). Годится, когда естественного потока нет или он
 *   пренебрежимо мал;
 * - аналитический: к отбору добавлен естественный поток, и область захвата
 *   вытягивается против течения каплей. Вверх по потоку граница уходит
 *   дальше, вниз — подтягивается к скважине. Именно так ведёт себя реальный
 *   водозабор в потоке, и именно этот способ даёт разные R и r.
 *
 * Аналитическое решение — ВНИИ ВОДГЕО (1983), в безразмерном виде оно
 * сводится к трём уравнениям относительно τ, которые решаются численно:
 *
 *   ξ − ln(1 + ξ) = τ            — вверх по потоку;
 *   −ξ − ln(1 − ξ) = τ           — вниз по потоку;
 *   1 − η·ctg η − ln(sin η / η) = τ — полуширина поперёк потока.
 *
 * Расстояния получаются умножением корня на x_L = Q / (2π q) — на удаление
 * водораздельной точки ниже скважины, где отбор ровно уравновешивает поток.
 */

import { offsetBy } from './geo';

/** Способы расчёта поясов II и III */
export const WHPA_METHODS = {
  ANALYTICAL: 'analytical',
  VOLUME: 'volume',
};

/** Сколько точек в контуре изохроны: на глаз линия уже гладкая */
const ISOCHRONE_POINTS = 180;

/**
 * Сколько поворотных точек выносить в таблицу координат
 *
 * Контур гладкий и точек в нём почти две сотни, но выносить в натуру столько
 * никто не станет: шестнадцати хватает, чтобы обойти пояс по границе, и
 * столько же даёт веб-версия.
 */
const TURNING_POINTS = 16;

/**
 * Сколько дней просачивания считается защищённым горизонтом
 *
 * СанПиН: если загрязнение с поверхности идёт до воды дольше срока II пояса,
 * горизонт можно считать защищённым.
 */
export const PROTECTED_DAYS = 400;

/**
 * Удельный расход естественного потока
 *
 * Сколько воды проходит через метр ширины пласта в сутки.
 *
 * @param {Object} params
 * @param {number} params.k - коэффициент фильтрации, м/сут
 * @param {number} params.m - мощность пласта, м
 * @param {number} params.I - градиент потока, безразмерный
 * @returns {number} удельный расход q, м²/сут
 */
export function specificDischarge({ k, m, I }) {
  if (!(k > 0) || !(m > 0) || !(I > 0)) return 0;
  return k * m * I;
}

/**
 * Удаление водораздельной точки ниже скважины
 *
 * Ниже по потоку есть точка, где отбор скважины ровно уравновешен
 * естественным потоком: вода из-за неё в скважину уже не попадает. Все
 * размеры области захвата выражаются через это расстояние.
 *
 * @param {Object} params
 * @param {number} params.Q - дебит скважины, м³/сут
 * @param {number} params.q - удельный расход потока, м²/сут
 * @returns {number} x_L, м; бесконечность, если потока нет
 */
export function stagnationDistance({ Q, q }) {
  if (!(Q > 0) || !(q > 0)) return Infinity;
  return Q / (2 * Math.PI * q);
}

/**
 * Безразмерное время добегания
 *
 * @param {Object} params
 * @param {number} params.q - удельный расход потока, м²/сут
 * @param {number} params.t - время, сут
 * @param {number} params.n - активная пористость
 * @param {number} params.m - мощность пласта, м
 * @param {number} params.xL - удаление водораздельной точки, м
 * @returns {number} τ
 */
export function dimensionlessTime({ q, t, n, m, xL }) {
  if (!(q > 0) || !(t > 0) || !(n > 0) || !(m > 0)) return 0;
  if (!(xL > 0) || !Number.isFinite(xL)) return 0;
  return (q * t) / (n * m * xL);
}

/**
 * Граница вверх по потоку
 *
 * Решает ξ − ln(1 + ξ) = τ методом Ньютона. Функция монотонна и выпукла,
 * поэтому итерации сходятся с любого разумного начального приближения.
 *
 * @param {number} xL - удаление водораздельной точки, м
 * @param {number} tau - безразмерное время
 * @returns {number} расстояние R, м
 */
export function solveUpstream(xL, tau) {
  if (!(xL > 0) || !(tau >= 0)) return NaN;
  if (tau === 0) return 0;

  // При малых τ уравнение вырождается в ξ²/2 = τ, при больших ξ растёт почти
  // как τ: с такой затравки хватает десятка итераций вместо полусотни
  let xi = tau < 1 ? Math.sqrt(Math.max(2 * tau, 1e-12)) * 1.15 : tau + Math.log1p(tau);
  for (let i = 0; i < 60; i += 1) {
    const f = xi - Math.log1p(xi) - tau;
    const slope = 1 - 1 / (1 + xi);
    if (!(slope > 1e-16)) break;
    const step = f / slope;
    xi = Math.max(0, xi - step);
    if (Math.abs(step) < 1e-14) break;
  }
  return xi * xL;
}

/**
 * Граница вниз по потоку
 *
 * Решает −ξ − ln(1 − ξ) = τ. Корень всегда лежит внутри (0, 1): дальше
 * водораздельной точки загрязнение к скважине не пойдёт, сколько ни жди.
 *
 * @param {number} xL - удаление водораздельной точки, м
 * @param {number} tau - безразмерное время
 * @returns {number} расстояние r, м
 */
export function solveDownstream(xL, tau) {
  if (!(xL > 0) || !(tau >= 0)) return NaN;
  if (tau === 0) return 0;
  // При большом τ корень неотличим от единицы, и Ньютон упирается в
  // логарифм нуля: отдаём предел сразу
  if (tau > 40) return xL * (1 - Math.exp(-tau));

  let xi = Math.min(0.999999, Math.max(1e-10, 1 - Math.exp(-Math.min(tau, 20))));
  for (let i = 0; i < 80; i += 1) {
    const rest = 1 - xi;
    if (rest <= 0) {
      xi = 0.999999;
      break;
    }
    const f = -xi - Math.log(rest) - tau;
    const slope = -1 + 1 / rest;
    if (Math.abs(slope) < 1e-16) break;
    const step = f / slope;
    xi -= step;
    if (xi <= 0) xi = 1e-10;
    if (xi >= 1) xi = 1 - 1e-10;
    if (Math.abs(step) < 1e-14) break;
  }
  return xi * xL;
}

/**
 * Полуширина пояса поперёк потока
 *
 * Решает 1 − η·ctg η − ln(sin η / η) = τ делением отрезка: производная у
 * этого уравнения меняет знак у краёв, и Ньютон с неё срывается. Корень
 * всегда в (0, π) — на π область захвата выходит на предельную ширину
 * Q / q, шире она не станет ни при каком времени.
 *
 * @param {number} xL - удаление водораздельной точки, м
 * @param {number} tau - безразмерное время
 * @returns {number} полуширина d, м
 */
export function solveHalfWidth(xL, tau) {
  if (!(xL > 0) || !(tau >= 0)) return NaN;
  if (tau === 0) return 0;

  const residual = (eta) => {
    const sin = Math.sin(eta);
    const cos = Math.cos(eta);
    if (!(sin > 1e-18)) return eta < 1 ? -tau : 1e9;
    return 1 - (eta * cos) / sin - Math.log(sin / eta) - tau;
  };

  let lo = 1e-8;
  let hi = Math.PI - 1e-8;
  if (residual(hi) < 0) return xL * hi;
  for (let i = 0; i < 80; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (residual(mid) > 0) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi) * xL;
}

/**
 * Радиус круга по объёму отобранной воды
 *
 * Объёмный способ: вся вода приходит из цилиндра вокруг скважины, и его
 * радиус выводится из равенства объёмов Q·t = π R² m n.
 *
 * @param {Object} params
 * @param {number} params.Q - дебит скважины, м³/сут
 * @param {number} params.t - время, сут
 * @param {number} params.m - мощность пласта, м
 * @param {number} params.n - активная пористость
 * @returns {number} радиус, м
 */
export function volumeRadius({ Q, t, m, n }) {
  if (!(Q > 0) || !(t > 0) || !(m > 0) || !(n > 0)) return NaN;
  return Math.sqrt((Q * t) / (Math.PI * m * n));
}

/**
 * Безразмерное время в точке области захвата
 *
 * Обратная задача к решению ВНИИ ВОДГЕО: по координатам точки говорит, за
 * сколько вода от неё дойдёт до скважины. Нужна контуру изохроны — по ней
 * подбирается радиус для каждого направления.
 *
 * @param {number} xi - продольная координата, в долях x_L
 * @param {number} eta - поперечная координата, в долях x_L
 * @returns {number} τ
 */
function tauAt(xi, eta) {
  if (Math.abs(eta) < 1e-14) {
    if (xi >= 1 - 1e-15) return Infinity;
    return -xi - Math.log(Math.max(1 - xi, 1e-300));
  }
  if (Math.abs(eta) >= Math.PI - 1e-12) return Infinity;
  const value = Math.cos(eta) - (xi / eta) * Math.sin(eta);
  if (!(value > 0)) return Infinity;
  return -xi - Math.log(value);
}

/**
 * Приводит угол к отрезку (−π, π]
 *
 * @param {number} angle - угол, рад
 * @returns {number} приведённый угол
 */
function wrapPi(angle) {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Радиус изохроны в заданном направлении
 *
 * @param {number} theta - направление, рад
 * @param {number} tau - безразмерное время
 * @returns {number} радиус в долях x_L
 */
function solveRadius(theta, tau) {
  const angle = wrapPi(theta);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const residual = (radius) => tauAt(radius * cos, radius * sin) - tau;

  // Луч упирается в границу области захвата: дальше неё времени не
  // существует вовсе, и верхнюю границу поиска берём чуть ближе
  const limit =
    Math.abs(sin) < 1e-14
      ? cos > 0
        ? 1
        : Infinity
      : Math.abs(angle) / Math.abs(sin);

  let lo = 1e-12;
  let hi = Number.isFinite(limit) ? Math.max(limit * (1 - 1e-10), lo * 2) : Math.max(tau + 8, 8);

  if (!Number.isFinite(residual(hi)) || residual(hi) < 0) {
    let probe = hi;
    for (let i = 0; i < 40; i += 1) {
      probe = lo + (probe - lo) * 0.55;
      const value = residual(probe);
      if (Number.isFinite(value) && value >= 0) {
        hi = probe;
        break;
      }
    }
  }

  for (let i = 0; i < 90; i += 1) {
    const mid = 0.5 * (lo + hi);
    const value = residual(mid);
    if (Number.isFinite(value) && value < 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Контур изохроны вокруг скважины
 *
 * Скважина в начале координат, ось x направлена вниз по потоку. Контур
 * замкнутый: последняя точка соседствует с первой.
 *
 * @param {Object} params
 * @param {number} params.xL - удаление водораздельной точки, м
 * @param {number} params.tau - безразмерное время
 * @param {number} [params.points] - число точек контура
 * @returns {Array<{x: number, y: number}>} контур в метрах
 */
export function isochrone({ xL, tau, points = ISOCHRONE_POINTS }) {
  if (!(xL > 0) || !Number.isFinite(xL) || !(tau > 0) || !Number.isFinite(tau)) return [];

  const down = solveDownstream(xL, tau) / xL;
  const up = solveUpstream(xL, tau) / xL;
  const contour = [];
  for (let i = 0; i < points; i += 1) {
    const theta = (2 * Math.PI * i) / points;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    // На самой оси потока корень известен точно — численный подбор там
    // вырождается и даёт шум в третьем знаке
    const radius = Math.abs(sin) < 1e-12 ? (cos > 0 ? down : up) : solveRadius(theta, tau);
    contour.push({ x: radius * cos * xL, y: radius * sin * xL });
  }
  return contour;
}

/**
 * Размеры одного пояса
 *
 * @param {Object} params
 * @returns {{R: number, r: number, d: number, tau: number}} размеры пояса
 */
function beltSize({ method, Q, t, m, n, q, xL }) {
  if (method === WHPA_METHODS.VOLUME) {
    const radius = volumeRadius({ Q, t, m, n });
    return { R: radius, r: radius, d: radius, tau: 0 };
  }
  const tau = dimensionlessTime({ q, t, n, m, xL });
  return {
    R: solveUpstream(xL, tau),
    r: solveDownstream(xL, tau),
    d: solveHalfWidth(xL, tau),
    tau,
  };
}

/**
 * Считает три пояса зоны санитарной охраны
 *
 * @param {Object} raw - исходные данные в базовых единицах
 * @param {string} raw.method - способ расчёта поясов II и III
 * @param {number} raw.Q - дебит скважины, м³/сут
 * @param {number} raw.k - коэффициент фильтрации, м/сут
 * @param {number} raw.m - мощность пласта, м
 * @param {number} raw.n - активная пористость
 * @param {number} raw.I - градиент естественного потока
 * @param {number} raw.tBacterial - время II пояса, сут
 * @param {number} raw.tChemical - время III пояса, сут
 * @param {number} raw.firstBeltRadius - радиус I пояса, м
 * @returns {Object} размеры поясов либо перечень ошибок
 */
export function computeWhpa(raw) {
  const {
    method = WHPA_METHODS.ANALYTICAL,
    Q,
    k,
    m,
    n,
    I,
    tBacterial,
    tChemical,
    firstBeltRadius,
  } = raw;

  const analytical = method !== WHPA_METHODS.VOLUME;
  const errors = [];
  if (!(Q > 0)) errors.push('Q');
  if (!(m > 0)) errors.push('m');
  if (!(n > 0)) errors.push('n');
  if (n >= 1) errors.push('n_gt_1');
  if (!(tBacterial > 0)) errors.push('tBacterial');
  if (!(tChemical > 0)) errors.push('tChemical');
  if (!(firstBeltRadius > 0)) errors.push('firstBeltRadius');
  // Коэффициент фильтрации и градиент нужны только потоку: объёмный способ
  // естественное течение не учитывает вовсе
  if (analytical) {
    if (!(k > 0)) errors.push('k');
    if (!(I > 0)) errors.push('I');
  }
  if (errors.length) return { ok: false, errors };

  const q = analytical ? specificDischarge({ k, m, I }) : 0;
  const xL = analytical ? stagnationDistance({ Q, q }) : Infinity;

  const belts = [
    {
      key: 'first',
      time: null,
      R: firstBeltRadius,
      r: firstBeltRadius,
      d: firstBeltRadius,
      tau: 0,
    },
    {
      key: 'bacterial',
      time: tBacterial,
      ...beltSize({ method, Q, t: tBacterial, m, n, q, xL }),
    },
    {
      key: 'chemical',
      time: tChemical,
      ...beltSize({ method, Q, t: tChemical, m, n, q, xL }),
    },
  ];

  const outer = belts[2];
  const warnings = [];
  // Третий пояс внутри огороженной площадки — верный признак опечатки в
  // дебите или в мощности: считать такую охрану не от чего
  if (outer.R <= firstBeltRadius) warnings.push('beltInsideFirst');
  if (belts[1].R > outer.R) warnings.push('bacterialOverChemical');
  // Предельная ширина области захвата Q/q: если пояс упёрся в неё, дальше
  // время его уже не расширяет, и цифра перестаёт зависеть от срока
  if (analytical && q > 0 && outer.d >= (Math.PI - 1e-6) * xL) warnings.push('captureLimit');

  return {
    ok: true,
    method,
    analytical,
    belts,
    warnings,
    q,
    xL,
    Q,
    k,
    m,
    n,
    I,
    formula: analytical
      ? 'q = k m I;  x_L = Q / (2π q);  τ = q t / (n m x_L)'
      : 'R = √(Q t / (π m n))',
  };
}

/**
 * Замкнутый круг заданного радиуса
 *
 * @param {number} radius - радиус, м
 * @param {number} points - число точек
 * @returns {Array<{x: number, y: number}>} контур
 */
function circle(radius, points) {
  const contour = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (2 * Math.PI * i) / points;
    contour.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return contour;
}

/**
 * Контуры всех трёх поясов для чертежа
 *
 * Скважина в начале координат, ось x направлена вниз по потоку. Первый пояс
 * и объёмный способ дают круги, аналитический — каплю изохроны.
 *
 * @param {Object} result - итог расчёта
 * @param {number} [points] - число точек контура
 * @returns {Array<{key: string, contour: Array<{x: number, y: number}>}>} контуры
 */
export function beltContours(result, points = ISOCHRONE_POINTS) {
  if (!result || !result.ok) return [];
  return result.belts.map((belt) => {
    // Круг рисуется по радиусу, а не подбором: у первого пояса времени нет
    // вовсе, а у объёмного способа контур и так осесимметричный
    if (belt.key === 'first' || !result.analytical) {
      return { key: belt.key, contour: circle(belt.R, points) };
    }
    return { key: belt.key, contour: isochrone({ xL: result.xL, tau: belt.tau, points }) };
  });
}

/**
 * Площадь замкнутого контура
 *
 * По формуле шнурования (Гаусса): контуры поясов невыпуклые, и разбивать их
 * на треугольники ради площади незачем.
 *
 * @param {Array<{x: number, y: number}>} contour - контур в метрах
 * @returns {number} площадь, м²
 */
export function contourArea(contour) {
  if (!contour || contour.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < contour.length; i += 1) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Переносит контур пояса на местность
 *
 * Расчёт ведётся в системе потока: ось x смотрит вниз по течению. На карте
 * поток развёрнут по своему азимуту, отсчитанному от севера по часовой
 * стрелке, а начало координат стоит в устье скважины.
 *
 * @param {Array<{x: number, y: number}>} contour - контур в метрах
 * @param {{lat: number, lon: number}} origin - устье скважины
 * @param {number} azimuth - азимут потока, °
 * @returns {Array<{lat: number, lon: number}>} контур в WGS-84
 */
export function contourToGeo(contour, origin, azimuth) {
  if (!contour || !origin) return [];
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)) return [];
  const angle = (((azimuth || 0) % 360) + 360) % 360;
  const rad = (angle * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  return contour.map((point) => {
    // Разложение по сторонам света: вдоль потока — на его азимут, поперёк —
    // на перпендикуляр к нему
    const east = point.x * sin - point.y * cos;
    const north = point.x * cos + point.y * sin;
    const distance = Math.hypot(east, north);
    // atan2 отсчитывает от оси x против часовой, азимут — от севера по
    // часовой: отсюда перестановка аргументов
    const bearing = (Math.atan2(east, north) * 180) / Math.PI;
    return offsetBy(origin, distance, bearing);
  });
}

/**
 * Поворотные точки контура для выноса в натуру
 *
 * Берётся каждая n-я точка гладкого контура: шестнадцати вершин достаточно,
 * чтобы обойти пояс по границе.
 *
 * @param {Array<{lat: number, lon: number}>} contour - контур в WGS-84
 * @param {number} [count] - сколько точек оставить
 * @returns {Array<{lat: number, lon: number}>} поворотные точки
 */
export function turningPoints(contour, count = TURNING_POINTS) {
  if (!contour || contour.length <= count) return contour || [];
  const step = contour.length / count;
  const points = [];
  for (let i = 0; i < count; i += 1) {
    points.push(contour[Math.round(i * step) % contour.length]);
  }
  return points;
}

/**
 * Время просачивания через один слой зоны аэрации
 *
 * Формула Аверьянова (ВНИИ ВОДГЕО, 1983). Режим выбирается сравнением
 * проницаемости слоя с инфильтрационным питанием: слабопроницаемый слой не
 * успевает пропустить всё питание и работает насыщенным, хорошо проницаемый
 * остаётся в зоне неполного насыщения, и скорость там ниже.
 *
 * @param {Object} layer
 * @param {number} layer.k - коэффициент фильтрации слоя, м/сут
 * @param {number} layer.m - мощность слоя, м
 * @param {number} layer.n - активная пористость слоя
 * @param {number} w - инфильтрационное питание, м/сут
 * @returns {{t0: number, saturated: boolean}} время и режим
 */
export function layerPercolation({ k, m, n }, w) {
  const saturated = !(k >= w);
  if (!(m > 0) || !(n > 0) || !(k > 0)) return { t0: NaN, saturated };
  if (saturated) return { t0: (n * m) / k, saturated: true };
  if (!(w > 0)) return { t0: NaN, saturated: false };
  return { t0: (n * m) / Math.cbrt(k * w * w), saturated: false };
}

/**
 * Защищённость грунтовых вод: время просачивания через зону аэрации
 *
 * Загрязнение с поверхности идёт к воде вертикально, слой за слоем, и общее
 * время — сумма по слоям перекрывающих отложений.
 *
 * @param {number} w - инфильтрационное питание, м/сут
 * @param {Array<Object>} layers - слои разреза сверху вниз
 * @returns {{t0: number, protected: boolean, layers: Array<Object>}} итог
 */
export function percolation(w, layers) {
  const rows = (layers || []).map((layer) => {
    const { t0, saturated } = layerPercolation(layer, w);
    return { ...layer, t0, saturated };
  });
  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.t0) ? row.t0 : 0), 0);
  return {
    w,
    t0: total,
    // Не «защищён», а «можно считать защищённым»: это признак по нормативу,
    // а не заключение о безопасности горизонта
    protected: total >= PROTECTED_DAYS,
    layers: rows,
  };
}
