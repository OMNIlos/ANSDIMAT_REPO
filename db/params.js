/**
 * Исходные данные опытов, у которых своя расчётная схема
 *
 * Одиночная и кустовая откачки описываются дебитом и журналом «время —
 * понижение», и обе величины лежат в колонках таблицы проектов. Трём
 * остальным видам ОФР этого мало: экспресс-опробованию нужна геометрия
 * скважины, поинтервальному нагнетанию — ступени давления с показаниями
 * расходомера, наливу в шурф — размеры выработки. Держать всё это
 * колонками значило бы завести полтора десятка полей, из которых у любого
 * журнала заполнена треть.
 *
 * Поэтому набор величин лежит одним JSON в `projects.params`, а этот модуль
 * — единственное место, где описано, что в нём бывает. Экраны, файл обмена
 * и синхронизация ходят сюда, а не разбирают JSON сами.
 *
 * Числа всегда в базовых единицах, как и везде в базе: метры, минуты,
 * м³/сут, м³, м², паскали, кг/м³. Выбор размерности в настройках действует
 * только на границе ввода и вывода, см. calc/units.js.
 *
 * Результаты расчёта сюда не пишутся: они выводятся из этих данных и
 * пересчитываются при каждом открытии журнала.
 */

import { OFR_TYPES } from './schema';
import { QUANTITIES } from '../calc/units';
import { LUGEON_FORMULAS } from '../calc/lugeon';

/** Число ступеней стандартного опыта Люжона: подъём давления и спуск */
export const LUGEON_STAGE_COUNT = 5;

/** Отсчётов расходомера на ступень в стандартном опыте */
export const LUGEON_READING_COUNT = 10;

/**
 * Экспресс-опробование (решение Бауэра — Райса)
 *
 * Геометрия приходит заполненной типовыми числами: 100-миллиметровый фильтр
 * в такой же обсадке. Замеряемые величины — скачок понижения и сам журнал —
 * остаются пустыми: подставлять за геолога результат опыта нельзя.
 */
export const DEFAULT_SLUG_PARAMS = {
  rw: 0.05,   // радиус фильтра r_w, м
  rc: 0.05,   // радиус обсадной трубы r_c, м
  lw: 2,      // длина фильтра l_w, м
  lt: 5,      // расстояние от УГВ до середины фильтра LT_w, м
  m: 10,      // обводнённая мощность пласта, м
  s0: 0,      // скачок понижения s⁰, м
};

/**
 * Поинтервальное нагнетание (метод Люжона)
 *
 * Пять ступеней по десять отсчётов — стандартная схема опыта: давление
 * поднимают тремя ступенями и теми же двумя опускают обратно.
 */
export const DEFAULT_LUGEON_PARAMS = {
  rw: 0.1,        // радиус опытной скважины на глубине интервала, м
  lw: 10,         // длина интервала опробования l_w, м
  interval: 1,    // интервал между отсчётами расходомера, мин
  density: 1000,  // плотность нагнетаемой жидкости ρ, кг/м³
  // Способ расчёта k: формула Мойе (13.66) или Тима (13.67). Обе дают
  // близкие результаты, но выбор — за геологом, и он должен сохраняться
  formula: LUGEON_FORMULAS.MOYE,
  stages: [],     // ступени: { pressure: Па, readings: [м³] }
};

/**
 * Налив в шурф в зону аэрации (Болдырев и Биндеман)
 *
 * Слой воды в шурфе по методу держат около 10 см — отсюда `head`. Расход
 * можно замерить напрямую (`flow`) или получить из налитого объёма и
 * времени; заданный напрямую важнее, см. calc/vadoseFill.js.
 *
 * По умолчанию считается по Болдыреву (13.68): ему нужны только объём с
 * интервалом и площадь шурфа. Биндеман (13.69) точнее, но требует ещё три
 * величины, и начинать с формы, где половина полей пустая, незачем — метод
 * переключается первым же выбором на экране.
 */
export const DEFAULT_VADOSE_PARAMS = {
  volume: 0,           // налитый объём ΔV, м³
  interval: 10,        // интервал времени Δt, мин
  flow: 0,             // установившийся расход Q, м³/сут; 0 — считать из объёма
  area: 1,             // площадь шурфа F, м²
  head: 0.1,           // высота столба воды в шурфе H, м
  depth: 0,            // глубина зоны просачивания z, м
  capillary: 0,        // высота капиллярного поднятия h_c, м
  useCapillary: false, // учитывать капиллярные силы (Биндеман)
  lithologyId: null,   // выбранная порода справочника, если h_c взят из него
};

/** Наборы по видам ОФР; у откачек своих параметров нет */
const DEFAULTS = {
  [OFR_TYPES.SLUG]: DEFAULT_SLUG_PARAMS,
  [OFR_TYPES.LUGEON]: DEFAULT_LUGEON_PARAMS,
  [OFR_TYPES.VADOSE]: DEFAULT_VADOSE_PARAMS,
};

/**
 * Пустая ступень нагнетания
 *
 * @returns {{pressure: number, readings: Array<number|null>}} ступень
 */
export function emptyStage() {
  return {
    pressure: 0,
    readings: new Array(LUGEON_READING_COUNT).fill(null),
  };
}

/**
 * Исходные данные по умолчанию для вида ОФР
 *
 * Возвращается копия: наборы выше — образцы, и править их из экрана нельзя.
 *
 * @param {string} ofrType - вид ОФР, см. OFR_TYPES
 * @returns {Object|null} набор величин или null, если у вида их нет
 */
export function defaultParams(ofrType) {
  const preset = DEFAULTS[ofrType];
  if (!preset) return null;
  if (ofrType === OFR_TYPES.LUGEON) {
    return {
      ...preset,
      stages: Array.from({ length: LUGEON_STAGE_COUNT }, emptyStage),
    };
  }
  return { ...preset };
}

/**
 * Приводит значение к конечному числу
 *
 * @param {*} value - значение произвольного вида
 * @param {number} fallback - чем заменить непригодное
 * @returns {number} число
 */
function toNumber(value, fallback) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && isFinite(parsed) ? parsed : fallback;
}

/**
 * Приводит показание расходомера к числу или пустоте
 *
 * Пропуск в середине ступени — обычное дело: отсчёт не сняли или он явно
 * сбойный. Ноль на его месте означал бы, что расходомер обнулился, поэтому
 * пустота хранится пустотой, а расчёт берёт крайние достоверные отсчёты.
 *
 * @param {*} value - показание
 * @returns {number|null} показание или null
 */
function toReading(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return isFinite(parsed) ? parsed : null;
}

/**
 * Разбирает одну ступень нагнетания
 *
 * @param {*} stage - ступень из хранилища или файла
 * @returns {{pressure: number, readings: Array<number|null>}} ступень
 */
function normalizeStage(stage) {
  const readings = Array.isArray(stage?.readings) ? stage.readings : [];
  const trimmed = readings.slice(0, LUGEON_READING_COUNT).map(toReading);
  while (trimmed.length < LUGEON_READING_COUNT) trimmed.push(null);
  return { pressure: toNumber(stage?.pressure, 0), readings: trimmed };
}

/**
 * Разбирает исходные данные журнала
 *
 * Чужой файл и запись из будущей версии не должны ронять экран, поэтому
 * разбор не доверяет содержимому: лишние ключи отбрасываются, недостающие
 * берутся из набора по умолчанию, нечисловое становится числом. Форма
 * результата зависит только от вида ОФР, а не от того, что пришло.
 *
 * @param {string} ofrType - вид ОФР, см. OFR_TYPES
 * @param {string|Object|null} stored - JSON из базы или уже разобранный объект
 * @returns {Object|null} набор величин или null, если у вида их нет
 */
/**
 * Положение фильтра экспресс-опробования из записи любого возраста
 *
 * До того как поле стало «Верх/Низ», журнал хранил z — расстояние до низа
 * фильтра. Читать такое z как середину значило бы поднять фильтр на половину
 * длины и молча изменить давно посчитанный k, поэтому старая запись
 * пересчитывается: LT_w = z − l_w/2. Длина берётся из той же записи, а не из
 * набора по умолчанию, иначе пересчёт вышел бы не про эту скважину.
 *
 * @param {Object} raw - запись из базы или файла
 * @param {Object} base - набор величин по умолчанию
 * @returns {number} расстояние от УГВ до середины фильтра, м
 */
function slugFilterMiddle(raw, base) {
  if (raw.lt !== undefined) return toNumber(raw.lt, base.lt);
  if (raw.z === undefined) return base.lt;
  const lw = toNumber(raw.lw, base.lw);
  return toNumber(raw.z, base.lt + lw / 2) - lw / 2;
}

export function parseParams(ofrType, stored) {
  const base = defaultParams(ofrType);
  if (!base) return null;

  let raw = stored;
  if (typeof stored === 'string') {
    try {
      raw = JSON.parse(stored);
    } catch {
      // Повреждённый JSON — журнал открывается с пустыми полями, а не падает
      raw = null;
    }
  }
  if (!raw || typeof raw !== 'object') return base;

  if (ofrType === OFR_TYPES.LUGEON) {
    const stages = Array.isArray(raw.stages) ? raw.stages : [];
    return {
      rw: toNumber(raw.rw, base.rw),
      lw: toNumber(raw.lw, base.lw),
      interval: toNumber(raw.interval, base.interval),
      density: toNumber(raw.density, base.density),
      // Неизвестный способ расчёта — берём Мойе: он основной и в книге, и
      // в настольном АНСДИМАТ
      formula: Object.values(LUGEON_FORMULAS).includes(raw.formula)
        ? raw.formula
        : base.formula,
      stages: stages.length
        ? stages.map(normalizeStage)
        : base.stages,
    };
  }

  if (ofrType === OFR_TYPES.VADOSE) {
    return {
      volume: toNumber(raw.volume, base.volume),
      interval: toNumber(raw.interval, base.interval),
      flow: toNumber(raw.flow, base.flow),
      area: toNumber(raw.area, base.area),
      head: toNumber(raw.head, base.head),
      depth: toNumber(raw.depth, base.depth),
      capillary: toNumber(raw.capillary, base.capillary),
      // Метод пишется в журнал явно, и умолчание здесь — Болдырев: набор без
      // этого поля пришёл либо из файла, собранного руками, либо из journal
      // старее самого выбора метода, и достраивать по нему Биндемана значит
      // подставить в расчёт незаполненные слой воды и глубину просачивания
      useCapillary: raw.useCapillary === true,
      lithologyId:
        typeof raw.lithologyId === 'string' ? raw.lithologyId : null,
    };
  }

  return {
    rw: toNumber(raw.rw, base.rw),
    rc: toNumber(raw.rc, base.rc),
    lw: toNumber(raw.lw, base.lw),
    lt: slugFilterMiddle(raw, base),
    m: toNumber(raw.m, base.m),
    s0: toNumber(raw.s0, base.s0),
  };
}

/**
 * Величина каждого поля — для файла обмена
 *
 * Файл `.ansdimat` объявляет, в каких размерностях в нём лежат числа, и
 * получатель приводит их к своим базовым. Чтобы это работало и для исходных
 * данных, у каждого поля должна быть известна величина; поля без размерности
 * (плотность, флаги, ссылка на породу) сюда не входят и переносятся как есть.
 *
 * Ступени нагнетания описаны отдельным ключом `stages`: давление и показания
 * расходомера лежат внутри массива.
 */
export const PARAM_QUANTITIES = {
  [OFR_TYPES.SLUG]: {
    rw: QUANTITIES.DISTANCE,
    rc: QUANTITIES.DISTANCE,
    lw: QUANTITIES.DISTANCE,
    lt: QUANTITIES.DISTANCE,
    m: QUANTITIES.DISTANCE,
    s0: QUANTITIES.DRAWDOWN,
  },
  [OFR_TYPES.LUGEON]: {
    rw: QUANTITIES.DISTANCE,
    lw: QUANTITIES.DISTANCE,
    interval: QUANTITIES.TIME,
    stages: {
      pressure: QUANTITIES.PRESSURE,
      readings: QUANTITIES.VOLUME,
    },
  },
  [OFR_TYPES.VADOSE]: {
    volume: QUANTITIES.VOLUME,
    interval: QUANTITIES.TIME,
    flow: QUANTITIES.FLOW,
    area: QUANTITIES.AREA,
    head: QUANTITIES.DISTANCE,
    depth: QUANTITIES.DISTANCE,
    capillary: QUANTITIES.DISTANCE,
  },
};

/**
 * Пересчитывает исходные данные в другие размерности
 *
 * Нужен файлу обмена: числа в нём объявлены своими единицами, и на входе их
 * приводят к базовым. Поля без размерности — плотность, флаги, ссылка на
 * породу — переносятся без изменений.
 *
 * @param {string} ofrType - вид ОФР, см. OFR_TYPES
 * @param {Object|null} params - набор величин
 * @param {Function} convert - (значение, величина) → значение
 * @returns {Object|null} пересчитанный набор
 */
export function rebaseParams(ofrType, params, convert) {
  const map = PARAM_QUANTITIES[ofrType];
  const parsed = parseParams(ofrType, params ?? null);
  if (!map || !parsed) return parsed;

  const result = { ...parsed };
  for (const [key, quantity] of Object.entries(map)) {
    if (key === 'stages') {
      result.stages = (parsed.stages ?? []).map((stage) => ({
        pressure: convert(stage.pressure, quantity.pressure),
        readings: stage.readings.map((reading) =>
          reading === null ? null : convert(reading, quantity.readings)
        ),
      }));
      continue;
    }
    result[key] = convert(parsed[key], quantity);
  }
  return result;
}

/**
 * Готовит исходные данные к записи в базу
 *
 * Через тот же разбор: в колонку попадает только то, что описано здесь, и
 * форма записи не зависит от того, что накопил экран.
 *
 * @param {string} ofrType - вид ОФР, см. OFR_TYPES
 * @param {Object|null} params - набор величин
 * @returns {string|null} JSON или null, если у вида параметров нет
 */
export function serializeParams(ofrType, params) {
  if (!DEFAULTS[ofrType]) return null;
  return JSON.stringify(parseParams(ofrType, params ?? null));
}
