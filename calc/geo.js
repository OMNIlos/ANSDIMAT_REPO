/**
 * Расстояния между скважинами по координатам
 *
 * Куст умещается в сотни метров, поэтому кривизной Земли на таком участке
 * можно пренебречь и считать расстояние по теореме Пифагора — в плоскости,
 * касательной к поверхности в середине отрезка (равнопромежуточная проекция).
 *
 *   x = Δλ · cos φm,  y = Δφ,  d = R · √(x² + y²)
 *
 * Разница с точной формулой гаверсинуса на километре — доли миллиметра, а на
 * ста километрах меньше десяти метров. Для расстояний между скважинами
 * опробования этого с большим запасом достаточно.
 *
 * Сжатием эллипсоида тоже пренебрегаем: берётся средний радиус Земли, и
 * ошибка от него на длине куста меньше сантиметра.
 */

/** Средний радиус Земли по IUGG, м */
const EARTH_RADIUS = 6371008.8;

const toRad = (degrees) => (degrees * Math.PI) / 180;
const toDeg = (radians) => (radians * 180) / Math.PI;

/**
 * Расстояние между двумя точками, м
 *
 * @param {{lat: number, lon: number}} from - первая точка
 * @param {{lat: number, lon: number}} to - вторая точка
 * @returns {number} расстояние в метрах; NaN, если координат нет
 */
export function distanceBetween(from, to) {
  if (!from || !to) return NaN;
  const { lat: lat1, lon: lon1 } = from;
  const { lat: lat2, lon: lon2 } = to;
  // Number.isFinite, а не глобальный isFinite: тот приводит аргумент к числу,
  // и null проходит проверку как ноль. Пустая координата — это «скважину на
  // карту не ставили», и расстояние до неё не ноль, а неизвестность
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return NaN;

  const dLat = toRad(lat2 - lat1);
  // Долгота сходится к полюсам: градус по ней короче градуса широты во
  // столько раз, во сколько косинус широты меньше единицы
  const dLon = toRad(lon2 - lon1) * Math.cos(toRad((lat1 + lat2) / 2));

  return EARTH_RADIUS * Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * Точка на заданном расстоянии и азимуте от исходной
 *
 * Обратная задача к `distanceBetween`: нужна, чтобы разложить скважины по
 * карте по уже введённым в таблицу расстояниям.
 *
 * @param {{lat: number, lon: number}} origin - исходная точка
 * @param {number} distance - расстояние, м
 * @param {number} bearing - азимут от севера по часовой стрелке, градусы
 * @returns {{lat: number, lon: number}} смещённая точка
 */
export function offsetBy(origin, distance, bearing) {
  if (!origin || !Number.isFinite(distance) || !Number.isFinite(bearing)) return origin;

  const angle = toRad(bearing);
  const north = (distance * Math.cos(angle)) / EARTH_RADIUS;
  const east = (distance * Math.sin(angle)) / EARTH_RADIUS;

  const lat = origin.lat + toDeg(north);
  // Косинус берётся на СРЕДНЕЙ широте отрезка — той же, что в
  // `distanceBetween`. С косинусом исходной точки функции переставали быть
  // строго обратными, и открытие карты сдвигало бы уже введённое в таблицу
  // расстояние на доли миллиметра при каждом пересчёте
  const cos = Math.cos(toRad((origin.lat + lat) / 2));
  // На самом полюсе восточное смещение вырождается: делить не на что
  const lon = Math.abs(cos) < 1e-9 ? origin.lon : origin.lon + toDeg(east / cos);

  return { lat, lon };
}
