/**
 * Сборка и разбор файла проекта `.ansdimat`
 *
 * Модуль намеренно ничего не знает ни про SQLite, ни про файловую систему:
 * на входе объект проекта, на выходе строка, и наоборот. Поэтому формат
 * проверяется тестами целиком, без нативных заглушек.
 *
 * Главное правило содержимого: числа лежат в базовых единицах, а не в тех,
 * что выбрал отправитель. Текстовый экспорт отдаёт значения через `fromBase` —
 * для файла это ловушка: получатель с другими настройками прочитал бы чужие
 * числа как свои и получил расчёт, отличающийся в разы.
 *
 * Чтобы это правило не держалось на честном слове, файл объявляет свои
 * размерности сам — блоком `units` внутри `payload`. Выгрузка пишет туда
 * базовые, разбор сверяется с объявленным и приводит числа к базовым. Пока
 * обе стороны в базовых, это тождественное преобразование; но если файл
 * когда-нибудь приедет в футах, получатель это увидит и пересчитает, а не
 * положит футы в базу как метры.
 *
 * Обратный перевод — в размерности того, кто открыл файл, — делают экраны
 * через `fromBase`: в базе journal лежит в базовых единицах независимо от
 * того, чем его наполняли.
 */

import { canonicalJson } from './canonicalJson';
import { sha256Hex } from './sha256';
import {
  IMPORT_ERRORS,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
} from './format';
import { ALL_OFR_TYPES, MEASUREMENT_PHASES, WELL_ROLES } from '../db/schema';
import { rebaseParams } from '../db/params';
import { BASE_UNITS, QUANTITIES, isKnownUnit, toBase } from '../calc/units';

// Прежние виды ОФР тоже принимаются: журнал, заведённый до смены списка,
// обязан открываться у получателя, см. LEGACY_OFR_TYPES
const OFR_VALUES = ALL_OFR_TYPES;
const PHASE_VALUES = Object.values(MEASUREMENT_PHASES);
const ROLE_VALUES = Object.values(WELL_ROLES);

/**
 * Величины, которые встречаются в журнале ОФР
 *
 * Только они и объявляются в файле: площадь и водопроводимость по слоям
 * живут в калькуляторе, а не в журнале, и записывать их размерности значило
 * бы обещать то, чего в файле нет.
 */
export const PROJECT_QUANTITIES = [
  QUANTITIES.TIME,
  QUANTITIES.DISTANCE,
  QUANTITIES.FLOW,
  QUANTITIES.TRANSMISSIVITY,
  QUANTITIES.DRAWDOWN,
  // Три последние пришли с новыми видами ОФР: площадь шурфа при наливе,
  // налитый объём и показания расходомера, давление ступени нагнетания
  QUANTITIES.AREA,
  QUANTITIES.VOLUME,
  QUANTITIES.PRESSURE,
];

/** Размерности журнала в базовых единицах — то, что пишется в файл */
function baseUnitsBlock() {
  return Object.fromEntries(
    PROJECT_QUANTITIES.map((quantity) => [quantity, BASE_UNITS[quantity]])
  );
}

/**
 * Приводит значение к конечному числу
 *
 * @param {*} value - что пришло
 * @param {number} [fallback] - чем заменить непригодное
 * @returns {number} число
 */
function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Приводит значение к конечному числу или null
 *
 * Отличается от `num` тем, что различает «не задано» и ноль: координата 0
 * это точка на экваторе, а отсутствие координаты — не точка вовсе.
 *
 * @param {*} value - что пришло
 * @returns {number|null} число или null
 */
function nullableNum(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Собирает содержимое файла из проекта
 *
 * @param {Object} project - проект из `getProject`
 * @returns {Object} поле payload будущего файла
 */
export function buildProjectPayload(project) {
  // Обе фазы лежат в файле одним списком: делит их поле `phase`, и оно же
  // разведёт их обратно при импорте. Два списка в файле означали бы, что
  // при добавлении третьей фазы формат придётся ломать
  const measurements = [
    ...(project.measurements ?? []),
    ...(project.recoveryMeasurements ?? []),
  ];

  return {
    sourceId: project.id,
    name: String(project.name ?? ''),
    ofrType: project.ofrType,
    // Журнал приходит из базы, а там всё в базовых единицах: `toBase` стоит
    // на каждом вводе в DataProcessingScreen. Поэтому здесь не пересчёт,
    // а объявление — в чём именно лежат числа ниже
    units: baseUnitsBlock(),
    Q: num(project.Q),
    pumpingDuration: num(project.pumpingDuration),
    finalDrawdown: num(project.finalDrawdown),
    // Исходные данные видов ОФР со своей схемой. У откачек их нет, и в
    // файле стоит null: получатель разберёт по виду ОФР, см. db/params.js
    params: project.params ?? null,
    results: {
      T: nullableNum(project.results?.T),
      slope: nullableNum(project.results?.slope),
      method: project.results?.method ?? null,
    },
    createdAt: num(project.createdAt, Date.now()),
    wells: (project.wells ?? []).map((well, index) => ({
      sourceId: well.id,
      name: String(well.name ?? ''),
      role: well.role,
      distance: num(well.distance),
      finalDrawdown: num(well.finalDrawdown),
      lat: nullableNum(well.lat),
      lon: nullableNum(well.lon),
      order: num(well.order, index),
    })),
    measurements: measurements.map((measurement, index) => ({
      t: num(measurement.t),
      s: num(measurement.s),
      phase: measurement.phase ?? MEASUREMENT_PHASES.PUMPING,
      wellSourceId: measurement.wellId ?? null,
      order: num(measurement.order, index),
    })),
  };
}

/**
 * Собирает файл проекта
 *
 * Поле `starred` не переносится: избранное — личная пометка получателя,
 * а не свойство журнала.
 *
 * @param {Object} project - проект из `getProject`
 * @param {Object} [options]
 * @param {string} [options.appVersion] - версия приложения-отправителя
 * @param {string} [options.platform] - платформа отправителя
 * @param {string} [options.exportedAt] - момент выгрузки, ISO
 * @returns {string} содержимое файла
 */
export function buildProjectFile(project, options = {}) {
  const payload = buildProjectPayload(project);

  const envelope = {
    format: PROJECT_FILE_FORMAT,
    formatVersion: PROJECT_FILE_VERSION,
    app: {
      name: 'Ansdimat',
      version: options.appVersion ?? null,
      platform: options.platform ?? null,
    },
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    checksum: 'sha256:' + sha256Hex(canonicalJson(payload)),
    payload,
  };

  // С отступами: файл открывается в любом текстовом редакторе, и человек,
  // которому он пришёл, может убедиться, что там его замеры, а не что-то ещё
  return JSON.stringify(envelope, null, 2);
}

/**
 * Проверяет и нормализует содержимое файла
 *
 * @param {*} payload - разобранное поле payload
 * @returns {{ok: true, payload: Object}|{ok: false, reason: string}} итог
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, reason: 'payload is not an object' };
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) return { ok: false, reason: 'name is missing' };

  if (!OFR_VALUES.includes(payload.ofrType)) {
    return { ok: false, reason: 'unknown ofrType: ' + payload.ofrType };
  }

  // Размерности файла. Блока может не быть — тогда считаем базовыми: так
  // читаются файлы, выгруженные до появления объявления, и это верно,
  // потому что базовыми они и были
  const declared = payload.units ?? {};
  if (typeof declared !== 'object' || Array.isArray(declared)) {
    return { ok: false, reason: 'units is not an object' };
  }

  const units = {};
  for (const quantity of PROJECT_QUANTITIES) {
    const key = declared[quantity] ?? BASE_UNITS[quantity];
    // Неизвестная размерность — это неизвестный масштаб чисел. Подставить
    // вместо неё базовую значило бы принять футы за метры
    if (!isKnownUnit(quantity, key)) {
      return { ok: false, reason: 'unknown unit for ' + quantity + ': ' + key };
    }
    units[quantity] = key;
  }

  /**
   * Приводит число к базовой единице по объявленной в файле размерности
   *
   * @param {number} value - число из файла
   * @param {string} quantity - величина, см. QUANTITIES
   * @returns {number} то же в базовой единице
   */
  const rebase = (value, quantity) =>
    units[quantity] === BASE_UNITS[quantity] ? value : toBase(value, quantity, units[quantity]);

  /**
   * То же для полей, которые могут быть не заданы
   *
   * @param {*} value - число или пусто
   * @param {string} quantity - величина
   * @returns {number|null} число в базовой единице или null
   */
  const rebaseNullable = (value, quantity) => {
    const parsed = nullableNum(value);
    return parsed === null ? null : rebase(parsed, quantity);
  };

  if (!Array.isArray(payload.wells)) return { ok: false, reason: 'wells is not an array' };
  if (!Array.isArray(payload.measurements)) {
    return { ok: false, reason: 'measurements is not an array' };
  }

  const wells = [];
  for (let index = 0; index < payload.wells.length; index++) {
    const well = payload.wells[index];
    if (!well || typeof well !== 'object') {
      return { ok: false, reason: 'well ' + index + ' is not an object' };
    }
    if (!ROLE_VALUES.includes(well.role)) {
      return { ok: false, reason: 'well ' + index + ' has unknown role: ' + well.role };
    }
    wells.push({
      sourceId: typeof well.sourceId === 'string' ? well.sourceId : null,
      name: String(well.name ?? ''),
      role: well.role,
      distance: rebase(num(well.distance), QUANTITIES.DISTANCE),
      finalDrawdown: rebase(num(well.finalDrawdown), QUANTITIES.DRAWDOWN),
      // Координаты в градусах: размерность у них одна на всех
      lat: nullableNum(well.lat),
      lon: nullableNum(well.lon),
      order: num(well.order, index),
    });
  }

  const knownWells = new Set(wells.map((well) => well.sourceId).filter(Boolean));

  const measurements = [];
  for (let index = 0; index < payload.measurements.length; index++) {
    const measurement = payload.measurements[index];
    if (!measurement || typeof measurement !== 'object') {
      return { ok: false, reason: 'measurement ' + index + ' is not an object' };
    }
    if (!Number.isFinite(Number(measurement.t)) || !Number.isFinite(Number(measurement.s))) {
      return { ok: false, reason: 'measurement ' + index + ' has non-numeric t or s' };
    }

    const phase = measurement.phase ?? MEASUREMENT_PHASES.PUMPING;
    if (!PHASE_VALUES.includes(phase)) {
      return { ok: false, reason: 'measurement ' + index + ' has unknown phase: ' + phase };
    }

    // Замер, ссылающийся на скважину, которой в файле нет, — это оборванная
    // связь: импортировать его некуда, и молча обнулить ссылку значит
    // подмешать чужой ряд к первой попавшейся скважине
    const wellSourceId = measurement.wellSourceId ?? null;
    if (wellSourceId !== null && !knownWells.has(wellSourceId)) {
      return { ok: false, reason: 'measurement ' + index + ' points at a missing well' };
    }

    measurements.push({
      t: rebase(Number(measurement.t), QUANTITIES.TIME),
      s: rebase(Number(measurement.s), QUANTITIES.DRAWDOWN),
      phase,
      wellSourceId,
      order: num(measurement.order, index),
    });
  }

  return {
    ok: true,
    payload: {
      sourceId: typeof payload.sourceId === 'string' ? payload.sourceId : null,
      name,
      ofrType: payload.ofrType,
      // После пересчёта содержимое базовое, чем бы оно ни было в файле
      units: baseUnitsBlock(),
      Q: rebase(num(payload.Q), QUANTITIES.FLOW),
      pumpingDuration: rebase(num(payload.pumpingDuration), QUANTITIES.TIME),
      finalDrawdown: rebase(num(payload.finalDrawdown), QUANTITIES.DRAWDOWN),
      // Файл прежней версии исходных данных не несёт: у видов ОФР, которые
      // в нём бывали, их и не было
      params: rebaseParams(payload.ofrType, payload.params ?? null, rebase),
      results: {
        T: rebaseNullable(payload.results?.T, QUANTITIES.TRANSMISSIVITY),
        // Наклон прямой C — это понижение на логарифмический цикл, то есть
        // величина понижения; так его и показывает экран обработки
        slope: rebaseNullable(payload.results?.slope, QUANTITIES.DRAWDOWN),
        method: payload.results?.method ?? null,
      },
      createdAt: num(payload.createdAt, Date.now()),
      wells,
      measurements,
    },
  };
}

/**
 * Разбирает файл проекта
 *
 * Проверки идут от дешёвых к дорогим и от общего к частному: сначала «наш ли
 * это файл вообще», потом версия, потом целостность, и лишь затем содержимое.
 * Порядок задаёт то, что увидит пользователь: чужой JSON не должен
 * объявляться повреждённым, а повреждённый — неполным.
 *
 * @param {string} text - содержимое файла
 * @returns {{ok: true, payload: Object, meta: Object}|{ok: false, error: string, reason?: string}}
 */
export function parseProjectFile(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: IMPORT_ERRORS.NOT_ANSDIMAT, reason: 'empty file' };
  }

  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch (error) {
    // Обрезанный при пересылке файл почти наверняка сохранил начало, а
    // магическая строка стоит в нём первым полем. Есть она — файл наш и
    // именно повреждён; нет — это просто не наш файл
    return {
      ok: false,
      error: text.includes(PROJECT_FILE_FORMAT)
        ? IMPORT_ERRORS.CORRUPTED
        : IMPORT_ERRORS.NOT_ANSDIMAT,
      reason: String(error?.message ?? error),
    };
  }

  if (!envelope || typeof envelope !== 'object' || envelope.format !== PROJECT_FILE_FORMAT) {
    return { ok: false, error: IMPORT_ERRORS.NOT_ANSDIMAT, reason: 'magic mismatch' };
  }

  const version = Number(envelope.formatVersion);
  if (!Number.isFinite(version) || version < 1) {
    return { ok: false, error: IMPORT_ERRORS.INVALID, reason: 'bad formatVersion' };
  }
  if (version > PROJECT_FILE_VERSION) {
    return { ok: false, error: IMPORT_ERRORS.TOO_NEW, reason: 'formatVersion ' + version };
  }

  if (typeof envelope.checksum !== 'string' || !envelope.checksum.startsWith('sha256:')) {
    return { ok: false, error: IMPORT_ERRORS.INVALID, reason: 'checksum is missing' };
  }

  const expected = 'sha256:' + sha256Hex(canonicalJson(envelope.payload));
  if (envelope.checksum !== expected) {
    return { ok: false, error: IMPORT_ERRORS.CORRUPTED, reason: 'checksum mismatch' };
  }

  const validated = validatePayload(envelope.payload);
  if (!validated.ok) {
    return { ok: false, error: IMPORT_ERRORS.INVALID, reason: validated.reason };
  }

  return {
    ok: true,
    payload: validated.payload,
    meta: {
      formatVersion: version,
      exportedAt: typeof envelope.exportedAt === 'string' ? envelope.exportedAt : null,
      app: envelope.app ?? null,
    },
  };
}

/**
 * Считает, что внутри файла, — для диалога импорта
 *
 * Пользователь должен видеть, что именно приехало, до того как это попадёт
 * в базу.
 *
 * @param {Object} payload - проверенное содержимое файла
 * @returns {Object} счётчики
 */
export function summarizePayload(payload) {
  const measurements = payload?.measurements ?? [];
  return {
    wells: (payload?.wells ?? []).length,
    pumping: measurements.filter((m) => m.phase !== MEASUREMENT_PHASES.RECOVERY).length,
    recovery: measurements.filter((m) => m.phase === MEASUREMENT_PHASES.RECOVERY).length,
    total: measurements.length,
  };
}
