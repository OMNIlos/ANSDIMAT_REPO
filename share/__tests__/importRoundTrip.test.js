/**
 * Обмен журналом целиком: выгрузка в файл и разворачивание обратно
 *
 * Проверяется на настоящем SQLite — так же, как репозитории
 * (см. db/__tests__/repositories.test.js): смысл теста в том, что журнал
 * доезжает до базы получателя без потерь, а заглушки над базой этого
 * показать не могут.
 */

/** Доступен ли встроенный SQLite текущей версии Node */
const hasNodeSqlite = (() => {
  try {
    require('node:sqlite');
    return true;
  } catch {
    return false;
  }
})();

jest.mock('expo-sqlite', () => {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    return {
      openDatabaseAsync: async () => {
        throw new Error('node:sqlite requires Node 22.5+');
      },
    };
  }

  /**
   * Оборачивает синхронный node:sqlite в асинхронный интерфейс expo-sqlite
   */
  function wrap(database) {
    return {
      execAsync: async (sql) => database.exec(sql),

      runAsync: async (sql, params = []) => {
        const result = database.prepare(sql).run(...params);
        return { changes: result.changes, lastInsertRowId: result.lastInsertRowid };
      },

      getAllAsync: async (sql, params = []) => database.prepare(sql).all(...params),

      getFirstAsync: async (sql, params = []) => {
        const rows = database.prepare(sql).all(...params);
        return rows[0] ?? null;
      },

      withTransactionAsync: async (callback) => {
        database.exec('BEGIN');
        try {
          await callback();
          database.exec('COMMIT');
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
      },

      closeAsync: async () => database.close(),
    };
  }

  return {
    openDatabaseAsync: async () => wrap(new DatabaseSync(':memory:')),
  };
});

import { closeDatabase, getDatabase } from '../../db/index';
import {
  createProject,
  findProjectBySourceId,
  getProject,
  importProject,
  listProjects,
  replaceMeasurements,
  toggleStarred,
  updateProject,
} from '../../db/projects';
import { MEASUREMENT_PHASES, OFR_TYPES, WELL_ROLES } from '../../db/schema';
import { QUANTITIES, fromBase } from '../../calc/units';
import { buildProjectFile, buildProjectPayload, parseProjectFile } from '../projectFile';
import { canonicalJson } from '../canonicalJson';
import { sha256Hex } from '../sha256';
import { PROJECT_FILE_FORMAT } from '../format';

const describeDb = hasNodeSqlite ? describe : describe.skip;

if (!hasNodeSqlite) {
  // eslint-disable-next-line no-console
  console.warn('Тесты обмена журналами пропущены: node:sqlite доступен начиная с Node 22.5');
}

afterAll(async () => {
  if (hasNodeSqlite) await closeDatabase();
});

/**
 * Заводит кустовой журнал с двумя скважинами и обеими фазами замеров
 *
 * @returns {Promise<Object>} журнал, прочитанный целиком
 */
async function seedProject(name = 'Куст №3') {
  const created = await createProject({
    name,
    ofrType: OFR_TYPES.CLUSTER,
    Q: 518.4,
    pumpingWellName: '1w',
    observationWellName: '1p',
  });

  await updateProject(created.id, {
    pumpingDuration: 1440,
    finalDrawdown: 3.24,
    results: { T: 125.4, slope: 0.42, method: 'cooper-jacob' },
  });

  const withWells = await getProject(created.id);
  const observation = withWells.wells.find((well) => well.role === WELL_ROLES.OBSERVATION);

  await replaceMeasurements(
    created.id,
    [
      { t: 1, s: 0.35 },
      { t: 5, s: 0.71 },
      { t: 15, s: 1.02 },
    ],
    MEASUREMENT_PHASES.PUMPING,
    observation.id
  );

  await replaceMeasurements(
    created.id,
    [
      { t: 2, s: 0.4 },
      { t: 8, s: 0.15 },
    ],
    MEASUREMENT_PHASES.RECOVERY,
    observation.id
  );

  return getProject(created.id);
}

/**
 * Гоняет журнал через файл и возвращает разобранное содержимое
 *
 * @param {Object} project - журнал целиком
 * @returns {Object} содержимое файла
 */
function throughFile(project) {
  const parsed = parseProjectFile(buildProjectFile(project));
  expect(parsed.ok).toBe(true);
  return parsed.payload;
}

describeDb('импорт журнала из файла', () => {
  test('журнал доезжает целиком и получает новые идентификаторы', async () => {
    const source = await seedProject('Куст для переноса');
    const payload = throughFile(source);

    const { id } = await importProject(payload);
    const imported = await getProject(id);

    expect(id).not.toBe(source.id);
    expect(imported.name).toBe(source.name);
    expect(imported.ofrType).toBe(OFR_TYPES.CLUSTER);
    expect(imported.Q).toBe(518.4);
    expect(imported.pumpingDuration).toBe(1440);
    expect(imported.finalDrawdown).toBe(3.24);
    expect(imported.results).toEqual({ T: 125.4, slope: 0.42, method: 'cooper-jacob' });
    // Дата опыта, а не дата пересылки
    expect(imported.createdAt).toBe(source.createdAt);
    expect(imported.sourceId).toBe(source.id);
  });

  test('замеры обеих фаз сохраняют значения и порядок', async () => {
    const source = await seedProject('Куст с восстановлением');
    const { id } = await importProject(throughFile(source));
    const imported = await getProject(id);

    expect(imported.measurements.map((m) => [m.t, m.s])).toEqual([
      [1, 0.35],
      [5, 0.71],
      [15, 1.02],
    ]);
    expect(imported.recoveryMeasurements.map((m) => [m.t, m.s])).toEqual([
      [2, 0.4],
      [8, 0.15],
    ]);
  });

  test('связь замера со скважиной переносится на новые идентификаторы', async () => {
    const source = await seedProject('Куст со связями');
    const { id } = await importProject(throughFile(source));
    const imported = await getProject(id);

    const observation = imported.wells.find((well) => well.role === WELL_ROLES.OBSERVATION);
    const sourceObservation = source.wells.find((well) => well.role === WELL_ROLES.OBSERVATION);

    // Скважина завелась заново
    expect(observation.id).not.toBe(sourceObservation.id);
    // Но замеры смотрят именно на неё, а не на чужую и не в пустоту
    for (const measurement of [...imported.measurements, ...imported.recoveryMeasurements]) {
      expect(measurement.wellId).toBe(observation.id);
    }
  });

  test('скважины сохраняют роль, расстояние и порядок', async () => {
    const source = await seedProject('Куст со скважинами');
    const { id } = await importProject(throughFile(source));
    const imported = await getProject(id);

    expect(imported.wells).toHaveLength(2);
    expect(imported.wells.map((well) => [well.name, well.role])).toEqual(
      source.wells.map((well) => [well.name, well.role])
    );
  });

  test('избранное не переносится', async () => {
    const source = await seedProject('Избранный куст');
    await toggleStarred(source.id);

    const { id } = await importProject(throughFile(await getProject(source.id)));
    const imported = await getProject(id);

    expect(imported.starred).toBe(false);
  });

  test('импортированный журнал помечен к отправке на сервер', async () => {
    const source = await seedProject('Куст на отправку');
    const { id } = await importProject(throughFile(source));

    const database = await getDatabase();
    const project = await database.getFirstAsync('SELECT dirty FROM projects WHERE id = ?', [id]);
    const wells = await database.getAllAsync('SELECT dirty FROM wells WHERE project_id = ?', [id]);
    const measurements = await database.getAllAsync(
      'SELECT dirty FROM measurements WHERE project_id = ?',
      [id]
    );

    expect(project.dirty).toBe(1);
    expect(wells.every((row) => row.dirty === 1)).toBe(true);
    expect(measurements.every((row) => row.dirty === 1)).toBe(true);
  });

  test('журнал без скважин импортируется', async () => {
    const single = await createProject({ name: 'Скв. 7Ц', ofrType: OFR_TYPES.SINGLE, Q: 100 });
    await replaceMeasurements(single.id, [{ t: 1, s: 0.2 }], MEASUREMENT_PHASES.PUMPING, null);

    const { id } = await importProject(throughFile(await getProject(single.id)));
    const imported = await getProject(id);

    expect(imported.wells).toHaveLength(0);
    expect(imported.measurements).toHaveLength(1);
    expect(imported.measurements[0].wellId).toBeNull();
  });
});

describeDb('повторный импорт того же файла', () => {
  test('находится по исходному идентификатору', async () => {
    const source = await seedProject('Куст для поиска');
    const payload = throughFile(source);

    const { id } = await importProject(payload);
    const found = await findProjectBySourceId(payload.sourceId);

    // Исходный журнал лежит в той же базе, поэтому поиск обязан вернуть
    // именно его: он совпадает по id, а это признак сильнее source_id
    expect(found.id).toBe(source.id);

    // А из другой базы, где исходного журнала нет, нашёлся бы импортированный
    const database = await getDatabase();
    const row = await database.getFirstAsync('SELECT source_id FROM projects WHERE id = ?', [id]);
    expect(row.source_id).toBe(payload.sourceId);
  });

  test('режим копии заводит второй журнал, не трогая первый', async () => {
    const source = await seedProject('Куст в двух копиях');
    const payload = throughFile(source);

    const first = await importProject(payload, { mode: 'copy' });
    const second = await importProject(payload, { mode: 'copy' });

    expect(first.id).not.toBe(second.id);

    const all = await listProjects();
    const copies = all.filter((project) => project.sourceId === payload.sourceId);
    expect(copies).toHaveLength(2);
  });

  test('режим замены переписывает журнал, сохраняя его идентификатор', async () => {
    const source = await seedProject('Куст до правки');
    const payload = throughFile(source);
    const { id } = await importProject(payload, { mode: 'copy' });

    // Отправитель поправил журнал и прислал файл заново
    const corrected = {
      ...payload,
      name: 'Куст после правки',
      Q: 600,
      measurements: [
        { t: 1, s: 0.4, phase: MEASUREMENT_PHASES.PUMPING, wellSourceId: payload.wells[1].sourceId, order: 0 },
      ],
    };

    const replaced = await importProject(corrected, { mode: 'replace', replaceId: id });
    expect(replaced.id).toBe(id);

    const imported = await getProject(id);
    expect(imported.name).toBe('Куст после правки');
    expect(imported.Q).toBe(600);
    // Прежние замеры не остались приклеенными к новым
    expect(imported.measurements).toHaveLength(1);
    expect(imported.recoveryMeasurements).toHaveLength(0);
    expect(imported.wells).toHaveLength(2);
  });

  test('замена без указания журнала — ошибка, а не тихая копия', async () => {
    const payload = throughFile(await seedProject('Куст без адреса'));

    await expect(importProject(payload, { mode: 'replace' })).rejects.toThrow(/replaceId/);
  });

  test('журнал можно импортировать под другим названием', async () => {
    const payload = throughFile(await seedProject('Исходное название'));
    const { id } = await importProject(payload, { name: 'Своё название' });

    expect((await getProject(id)).name).toBe('Своё название');
  });
});

describeDb('размерности при обмене', () => {
  test('файл в футах и сутках ложится в базу метрами и минутами', async () => {
    // Журнал, записанный в британских единицах: так выглядел бы файл от
    // приложения, которое хранит данные в том, что видит пользователь
    const source = await seedProject('Куст в футах');
    const payload = {
      ...buildProjectPayload(await getProject(source.id)),
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
      measurements: [
        {
          t: 1,
          s: 10,
          phase: MEASUREMENT_PHASES.PUMPING,
          wellSourceId: null,
          order: 0,
        },
      ],
      wells: [],
    };

    const file = JSON.stringify({
      format: PROJECT_FILE_FORMAT,
      formatVersion: 1,
      app: {},
      exportedAt: '2026-08-24T10:00:00.000Z',
      checksum: 'sha256:' + sha256Hex(canonicalJson(payload)),
      payload,
    });

    const parsed = parseProjectFile(file);
    expect(parsed.ok).toBe(true);

    const { id } = await importProject(parsed.payload);
    const imported = await getProject(id);

    // В базе — базовые единицы, а не то, что было в файле
    expect(imported.pumpingDuration).toBeCloseTo(1440, 6);
    expect(imported.finalDrawdown).toBeCloseTo(3.048, 6);
    expect(imported.measurements[0].t).toBeCloseTo(1440, 6);
    expect(imported.measurements[0].s).toBeCloseTo(3.048, 6);
  });

  test('отправитель и получатель с разными размерностями видят одно и то же', async () => {
    const source = await seedProject('Куст между системами');
    const { id } = await importProject(throughFile(source));
    const imported = await getProject(id);

    // В базе у обоих одни и те же числа
    expect(imported.measurements.map((m) => m.s)).toEqual(
      source.measurements.map((m) => m.s),
    );

    // А на экране каждый читает их в своей размерности: перевод делает
    // fromBase при показе, файл в этом не участвует
    const drawdown = imported.measurements[0].s;
    expect(fromBase(drawdown, QUANTITIES.DRAWDOWN, 'm')).toBe(0.35);
    expect(fromBase(drawdown, QUANTITIES.DRAWDOWN, 'ft')).toBeCloseTo(1.14829, 4);

    const time = imported.measurements[2].t;
    expect(fromBase(time, QUANTITIES.TIME, 'min')).toBe(15);
    expect(fromBase(time, QUANTITIES.TIME, 'hour')).toBeCloseTo(0.25, 6);
  });
});
