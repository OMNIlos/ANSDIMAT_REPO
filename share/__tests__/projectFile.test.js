/**
 * Проверка формата файла `.ansdimat`
 *
 * Формат — договор между двумя устройствами, поэтому проверяется и то, что
 * свой файл читается обратно без потерь, и то, что чужой или испорченный
 * отклоняется с внятной причиной. Второе важнее: молча принятый мусор
 * попадёт в базу и всплывёт кривым графиком через неделю.
 */

import {
  buildProjectFile,
  buildProjectPayload,
  parseProjectFile,
  summarizePayload,
} from '../projectFile';
import { canonicalJson } from '../canonicalJson';
import { sha256Hex } from '../sha256';
import { IMPORT_ERRORS, PROJECT_FILE_FORMAT, suggestFileName } from '../format';
import { MEASUREMENT_PHASES, OFR_TYPES, WELL_ROLES } from '../../db/schema';
import { BASE_UNITS, QUANTITIES, fromBase, toBase } from '../../calc/units';

/**
 * Кустовая откачка с двумя скважинами и обеими фазами замеров
 *
 * @returns {Object} проект в том виде, в каком его отдаёт getProject
 */
function makeProject() {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    name: 'Куст №3',
    ofrType: OFR_TYPES.CLUSTER,
    Q: 518.4,
    pumpingDuration: 1440,
    finalDrawdown: 3.24,
    starred: true,
    results: { T: 125.4, slope: 0.42, method: 'cooper-jacob' },
    createdAt: 1690000000000,
    updatedAt: 1690000900000,
    wells: [
      {
        id: 'well-pumping',
        name: '1w',
        role: WELL_ROLES.PUMPING,
        distance: 0.1,
        finalDrawdown: 4.2,
        lat: 59.94,
        lon: 30.31,
        order: 0,
      },
      {
        id: 'well-observation',
        name: '1p',
        role: WELL_ROLES.OBSERVATION,
        distance: 25,
        finalDrawdown: 0.8,
        lat: null,
        lon: null,
        order: 1,
      },
    ],
    measurements: [
      { id: 'm1', t: 1, s: 0.35, phase: MEASUREMENT_PHASES.PUMPING, wellId: 'well-observation', order: 0 },
      { id: 'm2', t: 5, s: 0.71, phase: MEASUREMENT_PHASES.PUMPING, wellId: 'well-observation', order: 1 },
    ],
    recoveryMeasurements: [
      { id: 'm3', t: 2, s: 0.4, phase: MEASUREMENT_PHASES.RECOVERY, wellId: 'well-observation', order: 0 },
    ],
  };
}

describe('сборка файла', () => {
  test('файл разбирается обратно без потерь', () => {
    const project = makeProject();
    const parsed = parseProjectFile(buildProjectFile(project));

    expect(parsed.ok).toBe(true);
    expect(parsed.payload.name).toBe('Куст №3');
    expect(parsed.payload.ofrType).toBe(OFR_TYPES.CLUSTER);
    expect(parsed.payload.Q).toBe(518.4);
    expect(parsed.payload.pumpingDuration).toBe(1440);
    expect(parsed.payload.finalDrawdown).toBe(3.24);
    expect(parsed.payload.results).toEqual({ T: 125.4, slope: 0.42, method: 'cooper-jacob' });
    expect(parsed.payload.createdAt).toBe(1690000000000);
    expect(parsed.payload.sourceId).toBe(project.id);
  });

  test('обе фазы замеров едут одним списком и различаются полем phase', () => {
    const parsed = parseProjectFile(buildProjectFile(makeProject()));

    expect(parsed.payload.measurements).toHaveLength(3);
    expect(summarizePayload(parsed.payload)).toEqual({
      wells: 2,
      pumping: 2,
      recovery: 1,
      total: 3,
    });
  });

  test('скважины сохраняют роль, расстояние и координаты', () => {
    const parsed = parseProjectFile(buildProjectFile(makeProject()));
    const [pumping, observation] = parsed.payload.wells;

    expect(pumping.role).toBe(WELL_ROLES.PUMPING);
    expect(pumping.lat).toBe(59.94);
    expect(observation.distance).toBe(25);
    // Отсутствующая координата остаётся отсутствующей, а не превращается в 0:
    // ноль — это точка на экваторе
    expect(observation.lat).toBeNull();
  });

  test('замеры ссылаются на скважины по идентификаторам из файла', () => {
    const parsed = parseProjectFile(buildProjectFile(makeProject()));

    for (const measurement of parsed.payload.measurements) {
      expect(measurement.wellSourceId).toBe('well-observation');
    }
  });

  test('избранное не переносится: это пометка получателя', () => {
    const payload = buildProjectPayload(makeProject());
    expect(payload).not.toHaveProperty('starred');
  });

  test('значения не пересчитываются в пользовательские единицы', () => {
    // В файле лежит то же, что в базе. Иначе получатель с другими
    // настройками прочитал бы чужие числа как свои
    const project = makeProject();
    const payload = buildProjectPayload(project);

    expect(payload.Q).toBe(project.Q);
    expect(payload.measurements[0].t).toBe(project.measurements[0].t);
    expect(payload.measurements[0].s).toBe(project.measurements[0].s);
  });

  test('журнал без скважин и без восстановления собирается', () => {
    const parsed = parseProjectFile(
      buildProjectFile({
        id: 'single-1',
        name: 'Скв. 7Ц',
        ofrType: OFR_TYPES.SINGLE,
        Q: 100,
        createdAt: 1690000000000,
        results: {},
        wells: [],
        measurements: [{ t: 1, s: 0.2, phase: MEASUREMENT_PHASES.PUMPING, wellId: null, order: 0 }],
      })
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.payload.wells).toHaveLength(0);
    expect(parsed.payload.measurements[0].wellSourceId).toBeNull();
    expect(parsed.payload.results).toEqual({ T: null, slope: null, method: null });
  });

  test('в конверт попадают версия, магическая строка и сумма', () => {
    const envelope = JSON.parse(buildProjectFile(makeProject(), { appVersion: '1.0.0', platform: 'ios' }));

    expect(envelope.format).toBe(PROJECT_FILE_FORMAT);
    expect(envelope.formatVersion).toBe(1);
    expect(envelope.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(envelope.app).toEqual({ name: 'Ansdimat', version: '1.0.0', platform: 'ios' });
    expect(envelope.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('сумма не зависит от порядка сборки объекта', () => {
    const project = makeProject();
    const reordered = { ...makeProject() };
    // Тот же проект, но поля перечислены в другом порядке
    const shuffled = Object.fromEntries(Object.entries(reordered).reverse());

    const first = JSON.parse(buildProjectFile(project)).checksum;
    const second = JSON.parse(buildProjectFile(shuffled)).checksum;

    expect(first).toBe(second);
  });
});

describe('разбор чужого и испорченного', () => {
  test('пустой файл', () => {
    expect(parseProjectFile('').error).toBe(IMPORT_ERRORS.NOT_ANSDIMAT);
    expect(parseProjectFile('   ').error).toBe(IMPORT_ERRORS.NOT_ANSDIMAT);
  });

  test('чужой JSON', () => {
    expect(parseProjectFile('{"hello":"world"}').error).toBe(IMPORT_ERRORS.NOT_ANSDIMAT);
  });

  test('вообще не JSON', () => {
    expect(parseProjectFile('обычный текст').error).toBe(IMPORT_ERRORS.NOT_ANSDIMAT);
  });

  test('свой файл, обрезанный при пересылке, считается повреждённым, а не чужим', () => {
    const full = buildProjectFile(makeProject());
    const truncated = full.slice(0, Math.floor(full.length / 2));

    expect(parseProjectFile(truncated).error).toBe(IMPORT_ERRORS.CORRUPTED);
  });

  test('подмена содержимого ловится суммой', () => {
    const envelope = JSON.parse(buildProjectFile(makeProject()));
    envelope.payload.Q = 999;

    expect(parseProjectFile(JSON.stringify(envelope)).error).toBe(IMPORT_ERRORS.CORRUPTED);
  });

  test('файл без суммы не принимается', () => {
    const envelope = JSON.parse(buildProjectFile(makeProject()));
    delete envelope.checksum;

    expect(parseProjectFile(JSON.stringify(envelope)).error).toBe(IMPORT_ERRORS.INVALID);
  });

  test('файл более новой версии отклоняется отдельной причиной', () => {
    const envelope = JSON.parse(buildProjectFile(makeProject()));
    envelope.formatVersion = 99;

    // Именно TOO_NEW, а не CORRUPTED: пользователю надо обновить приложение,
    // а не просить отправить файл заново
    expect(parseProjectFile(JSON.stringify(envelope)).error).toBe(IMPORT_ERRORS.TOO_NEW);
  });

  /**
   * Пересобирает конверт с новой суммой — чтобы проверялась схема,
   * а не целостность
   *
   * @param {Function} mutate - правка содержимого
   * @returns {Object} итог разбора
   */
  function parseWithMutation(mutate) {
    const project = makeProject();
    const payload = buildProjectPayload(project);
    mutate(payload);

    const { canonicalJson } = require('../canonicalJson');
    const { sha256Hex } = require('../sha256');

    return parseProjectFile(
      JSON.stringify({
        format: PROJECT_FILE_FORMAT,
        formatVersion: 1,
        app: {},
        exportedAt: new Date().toISOString(),
        checksum: 'sha256:' + sha256Hex(canonicalJson(payload)),
        payload,
      })
    );
  }

  test('неизвестный тип ОФР', () => {
    const result = parseWithMutation((payload) => {
      payload.ofrType = 'unknown-type';
    });
    expect(result.error).toBe(IMPORT_ERRORS.INVALID);
  });

  test('пустое название', () => {
    const result = parseWithMutation((payload) => {
      payload.name = '   ';
    });
    expect(result.error).toBe(IMPORT_ERRORS.INVALID);
  });

  test('нечисловой замер', () => {
    const result = parseWithMutation((payload) => {
      payload.measurements[0].t = 'позже';
    });
    expect(result.error).toBe(IMPORT_ERRORS.INVALID);
  });

  test('замер ссылается на скважину, которой в файле нет', () => {
    const result = parseWithMutation((payload) => {
      payload.measurements[0].wellSourceId = 'well-missing';
    });
    // Оборванную связь нельзя чинить молча: замер приклеился бы к чужому ряду
    expect(result.error).toBe(IMPORT_ERRORS.INVALID);
  });

  test('неизвестная фаза замера', () => {
    const result = parseWithMutation((payload) => {
      payload.measurements[0].phase = 'settling';
    });
    expect(result.error).toBe(IMPORT_ERRORS.INVALID);
  });

  test('замеры не массивом', () => {
    const result = parseWithMutation((payload) => {
      payload.measurements = { t: 1 };
    });
    expect(result.error).toBe(IMPORT_ERRORS.INVALID);
  });
});

describe('размерности', () => {
  /**
   * Собирает конверт с произвольным блоком размерностей
   *
   * Считает контрольную сумму заново, иначе разбор отвергнет файл раньше,
   * чем дойдёт до пересчёта.
   *
   * @param {Object} payload - содержимое файла
   * @returns {string} файл
   */
  function envelopeWith(payload) {
    return JSON.stringify({
      format: PROJECT_FILE_FORMAT,
      formatVersion: 1,
      app: {},
      exportedAt: '2026-08-24T10:00:00.000Z',
      checksum: 'sha256:' + sha256Hex(canonicalJson(payload)),
      payload,
    });
  }

  test('выгрузка объявляет базовые размерности', () => {
    const payload = buildProjectPayload(makeProject());

    expect(payload.units).toEqual({
      time: BASE_UNITS[QUANTITIES.TIME],
      distance: BASE_UNITS[QUANTITIES.DISTANCE],
      flow: BASE_UNITS[QUANTITIES.FLOW],
      transmissivity: BASE_UNITS[QUANTITIES.TRANSMISSIVITY],
      drawdown: BASE_UNITS[QUANTITIES.DRAWDOWN],
      // Пришли с новыми видами ОФР: площадь шурфа при наливе, налитый
      // объём и показания расходомера, давление ступени нагнетания
      area: BASE_UNITS[QUANTITIES.AREA],
      volume: BASE_UNITS[QUANTITIES.VOLUME],
      pressure: BASE_UNITS[QUANTITIES.PRESSURE],
    });
    // Минуты, метры, кубометры в сутки — то, в чём лежит база
    expect(payload.units.time).toBe('min');
    expect(payload.units.drawdown).toBe('m');
  });

  test('базовый файл разбирается без пересчёта — числа те же до бита', () => {
    const project = makeProject();
    const parsed = parseProjectFile(buildProjectFile(project));

    expect(parsed.payload.Q).toBe(project.Q);
    expect(parsed.payload.measurements[0].t).toBe(project.measurements[0].t);
    expect(parsed.payload.measurements[0].s).toBe(project.measurements[0].s);
    expect(parsed.payload.wells[1].distance).toBe(project.wells[1].distance);
  });

  test('файл в футах и сутках приводится к базовым единицам', () => {
    // Тот же журнал, но записанный в футах, сутках и галлонах в минуту
    const payload = {
      ...buildProjectPayload(makeProject()),
      units: {
        time: 'day',
        distance: 'ft',
        flow: 'gal_min',
        transmissivity: 'ft2_day',
        drawdown: 'ft',
      },
      Q: 100,
      pumpingDuration: 1,
      finalDrawdown: 10,
      results: { T: 1000, slope: 2, method: 'cooper-jacob' },
      wells: [
        { sourceId: 'w1', name: '1w', role: WELL_ROLES.PUMPING, distance: 1, finalDrawdown: 10, lat: null, lon: null, order: 0 },
      ],
      measurements: [
        { t: 1, s: 10, phase: MEASUREMENT_PHASES.PUMPING, wellSourceId: 'w1', order: 0 },
      ],
    };

    const parsed = parseProjectFile(envelopeWith(payload));
    expect(parsed.ok).toBe(true);

    // Сутки → минуты
    expect(parsed.payload.pumpingDuration).toBeCloseTo(1440, 6);
    expect(parsed.payload.measurements[0].t).toBeCloseTo(1440, 6);
    // Футы → метры
    expect(parsed.payload.measurements[0].s).toBeCloseTo(3.048, 6);
    expect(parsed.payload.finalDrawdown).toBeCloseTo(3.048, 6);
    expect(parsed.payload.wells[0].distance).toBeCloseTo(0.3048, 6);
    expect(parsed.payload.wells[0].finalDrawdown).toBeCloseTo(3.048, 6);
    // Галлоны в минуту → кубометры в сутки
    expect(parsed.payload.Q).toBeCloseTo(toBase(100, QUANTITIES.FLOW, 'gal_min'), 6);
    // Наклон прямой — величина понижения
    expect(parsed.payload.results.slope).toBeCloseTo(toBase(2, QUANTITIES.DRAWDOWN, 'ft'), 6);
    expect(parsed.payload.results.T).toBeCloseTo(toBase(1000, QUANTITIES.TRANSMISSIVITY, 'ft2_day'), 6);

    // И сам разобранный журнал теперь объявляет себя базовым
    expect(parsed.payload.units).toEqual(buildProjectPayload(makeProject()).units);
  });

  test('файл без блока размерностей считается базовым', () => {
    // Так читаются файлы, выгруженные до появления объявления: базовыми
    // они и были
    const payload = buildProjectPayload(makeProject());
    delete payload.units;

    const parsed = parseProjectFile(envelopeWith(payload));

    expect(parsed.ok).toBe(true);
    expect(parsed.payload.Q).toBe(518.4);
    expect(parsed.payload.units.time).toBe('min');
  });

  test('неизвестная размерность отклоняется, а не считается базовой', () => {
    const payload = { ...buildProjectPayload(makeProject()), units: { drawdown: 'сажени' } };

    // Принять неизвестный масштаб за базовый — значит положить в базу
    // сажени под видом метров
    const parsed = parseProjectFile(envelopeWith(payload));
    expect(parsed.error).toBe(IMPORT_ERRORS.INVALID);
    expect(parsed.reason).toContain('drawdown');
  });

  test('подмена блока размерностей ловится контрольной суммой', () => {
    const envelope = JSON.parse(buildProjectFile(makeProject()));
    envelope.payload.units.drawdown = 'ft';

    // Иначе правка одного слова в файле молча растянула бы весь журнал в 3.28 раза
    expect(parseProjectFile(JSON.stringify(envelope)).error).toBe(IMPORT_ERRORS.CORRUPTED);
  });

  test('получатель видит журнал в своих размерностях', () => {
    // Отправитель работает в метрах, получатель — в футах. В файле метры,
    // в базе получателя метры, а на экране у него футы
    const parsed = parseProjectFile(buildProjectFile(makeProject()));
    const drawdown = parsed.payload.measurements[0].s;

    expect(drawdown).toBe(0.35);
    expect(fromBase(drawdown, QUANTITIES.DRAWDOWN, 'ft')).toBeCloseTo(1.14829, 4);
    expect(fromBase(drawdown, QUANTITIES.DRAWDOWN, 'm')).toBe(0.35);
  });
});

describe('suggestFileName', () => {
  test('кириллица сохраняется', () => {
    expect(suggestFileName('Куст №3')).toBe('Куст №3.ansdimat');
  });

  test('в имени остаётся ровно одна точка', () => {
    // Лишние точки уводят файл мимо фильтра по расширению в Android
    const name = suggestFileName('Скв. 7Ц отк. 12.05');
    expect(name.match(/\./g)).toHaveLength(1);
    expect(name.endsWith('.ansdimat')).toBe(true);
  });

  test('символы, недопустимые в именах файлов, убираются', () => {
    expect(suggestFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a b c d e f g h i j.ansdimat');
  });

  test('пустое название не даёт файл без имени', () => {
    expect(suggestFileName('')).toBe('project.ansdimat');
    expect(suggestFileName('   ')).toBe('project.ansdimat');
    expect(suggestFileName(null)).toBe('project.ansdimat');
  });

  test('длинное название обрезается', () => {
    const name = suggestFileName('о'.repeat(300));
    expect(name.length).toBeLessThanOrEqual(80 + '.ansdimat'.length);
  });
});
