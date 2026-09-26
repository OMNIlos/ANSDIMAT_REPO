/**
 * Поинтервальные нагнетания: метод Люжона
 *
 * Оценка водопоглощения слабопроницаемых трещиноватых пород. Интервал
 * скважины отсекают пакерами и нагнетают в него воду ступенями постоянного
 * давления, замеряя расход по расходомеру. Ступеней обычно пять: давление
 * поднимают до максимума и той же лестницей опускают обратно — обратный ход
 * нужен, чтобы отличить упругое раскрытие трещин от их размыва.
 *
 * По каждой ступени считаются две величины.
 *
 * Коэффициент фильтрации считается двумя приближёнными зависимостями, и
 * книга отмечает, что они дают близкие результаты.
 *
 * Формула Мойе (Moye, 1967):
 *
 *   k = Q·ρ·g / (2π·l_w·ΔP) · (1 + ln(l_w/(2·r_w))).              (13.66)
 *
 * Формула Тима (Thiem, 1906):
 *
 *   k = Q/(2π·l_w·Δh) · ln(R/r_w),   Δh = ΔP/(ρ·g).               (13.67)
 *
 * В качестве радиуса влияния R в формуле Тима обычно принимается длина
 * интервала опробования l_w.
 *
 * Параметр Люжона — водопоглощение, приведённое к избыточному давлению
 * 1 МПа и метру интервала:
 *
 *   Lu = Q/l_w · P₀/P,   Q в л/мин, P₀ = 1 МПа.                   (13.65)
 *
 * Единица Люжона по определению: 1 л/мин на метр интервала при избыточном
 * давлении 1 МПа. Классификация пород по Lu — в табл. 13.5, см.
 * LUGEON_CLASSES; для оценочных расчётов 1 Lu ≈ 0.011 м/сут (Fell et al.,
 * 2005).
 *
 * Стандартная схема опыта: пять ступеней с давлениями 0.5·P_max, 0.75·P_max,
 * P_max, 0.75·P_max, 0.5·P_max, каждая держится 10 минут, расход замеряется
 * ежеминутно.
 *
 * Источники: Синдаловский Л.Н. «Гидрогеологические расчёты с использованием
 * программы ANSDIMAT» (2021), разд. 13.6.2, формулы (13.65)—(13.67),
 * табл. 13.5, рис. 13.10 и 13.11; Houlsby A.C. Routine interpretation of the
 * Lugeon water-test // Quarterly Journal of Engineering Geology and
 * Hydrogeology. 1976. Vol. 9. P. 303—313.
 */

import { MINUTES_PER_DAY } from './units';

/**
 * Ускорение свободного падения, м/с²
 *
 * Округлённое 9.81, а не стандартное 9.80665: именно оно стоит в расчёте
 * настольного АНСДИМАТ, и на контрольном примере совпадение с ним до
 * седьмого знака, а со стандартным — до четвёртого.
 */
export const GRAVITY = 9.81;

/** Плотность воды по умолчанию, кг/м³ */
export const DEFAULT_DENSITY = 1000;

/** Избыточное давление P₀ в определении единицы Люжона, Па */
export const LUGEON_REFERENCE_PRESSURE = 1e6;

/** Литров в кубометре — расход в формуле Люжона задан в л/мин */
const L_PER_M3 = 1000;

/**
 * Приближённая связь между единицей Люжона и коэффициентом фильтрации
 *
 * 1 Lu ≈ 1.3·10⁻⁷ м/с ≈ 0.011 м/сут (Fell et al., 2005). Годится для
 * оценочных расчётов, когда геометрия интервала неизвестна и формулы Мойе
 * или Тима применить не к чему.
 */
export const LUGEON_TO_CONDUCTIVITY = 0.011;

/** Способ расчёта коэффициента фильтрации по ступени */
export const LUGEON_FORMULAS = {
  MOYE: 'moye',     // (13.66)
  THIEM: 'thiem',   // (13.67)
};

/**
 * Классификация трещиноватых пород по величине Люжона (табл. 13.5)
 *
 * `max` — верхняя граница диапазона Lu; последний класс не ограничен.
 * `accuracy` — точность определения метода в единицах Люжона: в
 * высокопроницаемых трещиноватых породах она падает, и на больших Lu само
 * число значит меньше, чем порядок.
 */
export const LUGEON_CLASSES = [
  { id: 'veryLow', max: 1, kMin: 0, kMax: 0.01, accuracy: 1 },
  { id: 'low', max: 5, kMin: 0.01, kMax: 0.05, accuracy: 0 },
  { id: 'moderate', max: 15, kMin: 0.05, kMax: 0.2, accuracy: 1 },
  { id: 'medium', max: 50, kMin: 0.2, kMax: 0.5, accuracy: 5 },
  { id: 'high', max: 100, kMin: 0.5, kMax: 1.0, accuracy: 10 },
  { id: 'veryHigh', max: Infinity, kMin: 1.0, kMax: Infinity, accuracy: 100 },
];

/**
 * Класс трещиноватости по значению Люжона
 *
 * @param {number} lu - значение Lu
 * @returns {Object|null} запись LUGEON_CLASSES или null, если Lu не число
 */
export function lugeonClass(lu) {
  if (!isFinite(lu) || lu < 0) return null;
  return LUGEON_CLASSES.find((entry) => lu < entry.max) ?? null;
}

/**
 * Характерный вид зависимости «расход — давление» (Houlsby, 1976)
 *
 * По форме петли, которую даёт прямой и обратный ход по ступеням, видно, что
 * происходило в трещинах, и какое из пяти значений Lu брать за
 * представительное.
 */
export const LUGEON_PATTERNS = {
  LAMINAR: 'laminar',       // Ламинарный: Lu не зависит от давления
  TURBULENT: 'turbulent',   // Турбулентный: Lu падает с ростом давления
  DILATION: 'dilation',     // Расширение: трещины раскрываются на пике
  WASHOUT: 'washout',       // Размыв: Lu растёт от ступени к ступени
  VOID_FILLING: 'voidFilling', // Заполнение: Lu падает от ступени к ступени
  UNKNOWN: 'unknown',       // Ступеней не пять — классификация не определена
};

/**
 * Средний расход по ступени
 *
 * Расходомер показывает накопленный объём, поэтому расход — приращение за
 * ступень, делённое на её длительность. Берутся первый и последний
 * достоверные отсчёты, а не среднее поминутных приращений: результат тот же,
 * но одиночный сбой отсчёта не даёт отрицательной минуты.
 *
 * @param {Object} params
 * @param {Array<number>} params.readings - показания расходомера, м³
 * @param {number} params.interval - интервал между отсчётами, мин
 * @returns {number} средний расход, м³/сут; NaN, если считать не по чему
 */
export function stageFlow({ readings, interval }) {
  if (!(interval > 0)) return NaN;
  const values = (readings ?? []).map((value) =>
    isFinite(value) ? value : null
  );
  let first = -1;
  let last = -1;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === null) continue;
    if (first < 0) first = i;
    last = i;
  }
  if (first < 0 || last <= first) return NaN;

  const volume = values[last] - values[first];
  const minutes = (last - first) * interval;
  if (!(minutes > 0) || !isFinite(volume)) return NaN;
  return (volume / minutes) * MINUTES_PER_DAY;
}

/**
 * Коэффициент фильтрации по формуле Мойе
 *
 * @param {Object} params
 * @param {number} params.flow - средний расход Q, м³/сут
 * @param {number} params.pressure - давление ступени ΔP над статическим
 *   уровнем, Па
 * @param {number} params.lw - длина интервала опробования l_w, м
 * @param {number} params.rw - радиус скважины на глубине интервала r_w, м
 * @param {number} [params.density] - плотность нагнетаемой жидкости, кг/м³
 * @returns {number} коэффициент фильтрации k, м/сут; NaN при неполных данных
 */
export function moyeConductivity({ flow, pressure, lw, rw, density }) {
  const rho = density ?? DEFAULT_DENSITY;
  if (!(flow > 0) || !(pressure > 0) || !(lw > 0) || !(rw > 0) || !(rho > 0)) {
    return NaN;
  }
  // Логарифм отрицателен, когда интервал короче диаметра скважины: формула
  // Мойе выведена для вытянутого интервала и такой схемы не описывает
  const shape = 1 + Math.log(lw / (2 * rw));
  if (!(shape > 0)) return NaN;
  return ((flow * rho * GRAVITY) / (2 * Math.PI * lw * pressure)) * shape;
}

/**
 * Коэффициент фильтрации по формуле Тима (13.67)
 *
 * Давление переводится в напор Δh = ΔP/(ρ·g), а радиус влияния по умолчанию
 * принимается равным длине интервала опробования — так рекомендует книга,
 * и тогда ln(R/r_w) = ln(l_w/r_w).
 *
 * @param {Object} params
 * @param {number} params.flow - средний расход Q, м³/сут
 * @param {number} params.pressure - давление ступени ΔP, Па
 * @param {number} params.lw - длина интервала опробования l_w, м
 * @param {number} params.rw - радиус скважины r_w, м
 * @param {number} [params.density] - плотность нагнетаемой жидкости, кг/м³
 * @param {number} [params.influenceRadius] - радиус влияния R, м; по
 *   умолчанию равен длине интервала
 * @returns {number} коэффициент фильтрации k, м/сут; NaN при неполных данных
 */
export function thiemConductivity({
  flow,
  pressure,
  lw,
  rw,
  density,
  influenceRadius,
}) {
  const rho = density ?? DEFAULT_DENSITY;
  if (!(flow > 0) || !(pressure > 0) || !(lw > 0) || !(rw > 0) || !(rho > 0)) {
    return NaN;
  }
  const R = influenceRadius ?? lw;
  const shape = Math.log(R / rw);
  if (!(shape > 0)) return NaN;
  const head = pressure / (rho * GRAVITY);
  return (flow / (2 * Math.PI * lw * head)) * shape;
}

/**
 * Параметр Люжона ступени
 *
 * @param {Object} params
 * @param {number} params.flow - средний расход Q, м³/сут
 * @param {number} params.pressure - давление ступени ΔP, Па
 * @param {number} params.lw - длина интервала опробования l_w, м
 * @returns {number} значение Lu; NaN при неполных данных
 */
export function lugeonValue({ flow, pressure, lw }) {
  if (!(flow > 0) || !(pressure > 0) || !(lw > 0)) return NaN;
  const litersPerMinute = (flow * L_PER_M3) / MINUTES_PER_DAY;
  return (litersPerMinute / lw) * (LUGEON_REFERENCE_PRESSURE / pressure);
}

/**
 * Классифицирует опыт по форме зависимости «расход — давление»
 *
 * Схема Хоулсби: пять ступеней с давлениями низкое — среднее — высокое —
 * среднее — низкое, и вывод делается по тому, как ведут себя Lu прямого и
 * обратного хода. Пар всего две (1↔5 и 2↔4), поэтому классификация
 * определена только для пяти ступеней.
 *
 * @param {Array<number>} values - значения Lu по ступеням, по порядку
 * @param {number} [tolerance] - относительный допуск «значения равны»
 * @returns {{pattern: string, representative: number}} вид зависимости и
 *   представительное значение Lu
 */
export function classifyLugeon(values, tolerance = 0.2) {
  const lu = (values ?? []).filter((value) => isFinite(value) && value > 0);
  if (lu.length !== 5) {
    return { pattern: LUGEON_PATTERNS.UNKNOWN, representative: NaN };
  }
  const [lu1, lu2, lu3, lu4, lu5] = lu;
  const close = (a, b) => Math.abs(a - b) <= tolerance * Math.max(a, b);

  // Размыв: с каждой ступенью порода пропускает больше, обратный ход не
  // возвращается к началу — трещины промываются и опыт их меняет
  if (lu1 < lu2 && lu2 < lu3 && lu3 < lu4 && lu4 < lu5) {
    return { pattern: LUGEON_PATTERNS.WASHOUT, representative: lu5 };
  }
  // Заполнение: наоборот, водопоглощение падает от ступени к ступени —
  // трещины забиваются взвесью
  if (lu1 > lu2 && lu2 > lu3 && lu3 > lu4 && lu4 > lu5) {
    return { pattern: LUGEON_PATTERNS.VOID_FILLING, representative: lu5 };
  }
  // Дальше — петля: обратный ход повторяет прямой, и вопрос лишь в том, что
  // случилось на пике давления
  if (close(lu1, lu5) && close(lu2, lu4)) {
    if (close(lu1, lu3) && close(lu2, lu3)) {
      const mean = lu.reduce((sum, value) => sum + value, 0) / lu.length;
      return { pattern: LUGEON_PATTERNS.LAMINAR, representative: mean };
    }
    // Турбулентный: на пике поглощение меньше — поток в трещинах перестал
    // быть ламинарным, и представительным считается замер при наименьшем
    // давлении
    if (lu3 < lu2 && lu3 < lu1) {
      return { pattern: LUGEON_PATTERNS.TURBULENT, representative: lu1 };
    }
    // Расширение: на пике поглощение больше — трещины упруго раскрылись и
    // сомкнулись обратно. Представительно то же наименьшее давление
    if (lu3 > lu2 && lu3 > lu1) {
      return { pattern: LUGEON_PATTERNS.DILATION, representative: lu1 };
    }
  }
  return { pattern: LUGEON_PATTERNS.UNKNOWN, representative: NaN };
}

/**
 * Петля «расход — давление» ветвями подъёма и спуска
 *
 * График опыта (рис. 13.10, б) — замкнутая петля: давление поднимают
 * ступенями до максимума и той же лестницей опускают обратно. Начинается и
 * заканчивается она в нуле: без избыточного давления нагнетания нет, и
 * концы петли — это состояние до опыта и после сброса давления. Точки нуля
 * добавляются здесь, а не вносятся геологом: ступени с нулевым давлением не
 * бывает, делить на неё нельзя, и в расчёт Lu такая строка не пошла бы.
 *
 * Ветви разделены пиком давления, потому что читаются они по-разному: по
 * прямому ходу видно, как порода принимает воду, а по обратному — вернулась
 * ли она к исходному состоянию. Пик достаётся обеим: это одна и та же
 * ступень, и разрывать в ней линию нельзя.
 *
 * Пока обратного хода нет — все ступени идут на подъём, — ветвь спуска
 * пустая, и петля не замыкается. Дорисовать спуск к нулю значило бы
 * показать возврат, которого в опыте ещё не было.
 *
 * @param {Array<{pressure: number, flow: number}>} rows - посчитанные
 *   ступени по порядку опыта, см. processLugeon
 * @returns {{rise: Array<{pressure: number, flow: number}>,
 *   fall: Array<{pressure: number, flow: number}>}} ветви петли; в каждой
 *   точки идут в порядке опыта, ноль стоит по краям
 */
export function lugeonLoop(rows) {
  const points = (rows ?? [])
    .filter((row) => isFinite(row?.pressure) && isFinite(row?.flow))
    .map((row) => ({ pressure: row.pressure, flow: row.flow }));

  if (points.length === 0) return { rise: [], fall: [] };

  // Пик — последняя ступень наибольшего давления: при равных давлениях на
  // вершине площадка относится к прямому ходу, а спуск начинается с её конца
  let peak = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].pressure >= points[peak].pressure) peak = i;
  }

  const origin = { pressure: 0, flow: 0 };
  const rise = [origin, ...points.slice(0, peak + 1)];

  if (peak === points.length - 1) return { rise, fall: [] };

  return { rise, fall: [...points.slice(peak), origin] };
}

/**
 * Обработка поинтервального нагнетания по всем ступеням
 *
 * @param {Object} params
 * @param {Array<{pressure: number, readings: Array<number>}>} params.stages -
 *   ступени: давление над статическим уровнем, Па; показания расходомера, м³
 * @param {number} params.interval - интервал между отсчётами, мин
 * @param {number} params.lw - длина интервала опробования, м
 * @param {number} params.rw - радиус опытной скважины, м
 * @param {number} [params.density] - плотность нагнетаемой жидкости, кг/м³
 * @param {string} [params.formula] - способ расчёта k, см. LUGEON_FORMULAS;
 *   по умолчанию формула Мойе
 * @returns {{stages: Array, meanK: number, meanLu: number, pattern: string,
 *   representativeLu: number, formula: string, rockClass: Object|null}}
 *   результат по ступеням, средние по опыту и класс трещиноватости
 */
export function processLugeon({
  stages,
  interval,
  lw,
  rw,
  density,
  formula = LUGEON_FORMULAS.MOYE,
}) {
  const conductivity =
    formula === LUGEON_FORMULAS.THIEM ? thiemConductivity : moyeConductivity;
  const rows = (stages ?? []).map((stage, index) => {
    const flow = stageFlow({ readings: stage?.readings, interval });
    const pressure = stage?.pressure;
    return {
      index,
      pressure: isFinite(pressure) ? pressure : NaN,
      flow,
      k: conductivity({ flow, pressure, lw, rw, density }),
      lu: lugeonValue({ flow, pressure, lw }),
    };
  });

  const mean = (pick) => {
    const values = rows.map(pick).filter((value) => isFinite(value));
    if (!values.length) return NaN;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const { pattern, representative } = classifyLugeon(rows.map((row) => row.lu));

  const meanLu = mean((row) => row.lu);
  // Класс берётся по представительному значению, если оно определено:
  // среднее по петле с провалом на пике породу характеризует хуже
  const classifiedBy = isFinite(representative) ? representative : meanLu;

  return {
    stages: rows,
    meanK: mean((row) => row.k),
    meanLu,
    pattern,
    representativeLu: representative,
    formula,
    rockClass: lugeonClass(classifiedBy),
  };
}
