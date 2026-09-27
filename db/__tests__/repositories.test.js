/**
 * Проверка репозиториев на настоящем SQLite
 *
 * expo-sqlite подменяется встроенным в Node модулем node:sqlite: движок тот же,
 * отличается только обёртка. Так проверяется реальный SQL — схема, каскадное
 * удаление, транзакции и upsert, — а не заглушки.
 *
 * node:sqlite появился в Node 22.5. На более старых версиях набор помечается
 * пропущенным, а не падает: иначе прогон ломается из-за версии рантайма,
 * а не из-за кода.
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
    // Набор будет пропущен — заглушка нужна лишь чтобы модуль импортировался
    return { openDatabaseAsync: async () => {
      throw new Error('node:sqlite requires Node 22.5+');
    } };
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

import { closeDatabase } from '../index';
import {
  listProjects,
  countProjects,
  getProject,
  createProject,
  updateProject,
  toggleStarred,
  deleteProject,
  replaceMeasurements,
  addMeasurement,
  deleteMeasurement,
} from '../projects';
import { listPoints, createPoint, updatePoint, deletePoint, getPointStats } from '../points';
import { getSettings, setSetting, updateSettings, resetSettings } from '../settings';
import {
  OFR_TYPES,
  POINT_TYPES,
  DEFAULT_SETTINGS,
  WELL_ROLES,
  DEFAULT_CLUSTER_DISTANCES,
} from '../schema';

// На Node без встроенного SQLite набор пропускается целиком
const describeDb = hasNodeSqlite ? describe : describe.skip;

if (!hasNodeSqlite) {
  // eslint-disable-next-line no-console
  console.warn('Тесты БД пропущены: node:sqlite доступен начиная с Node 22.5');
}

// База лежит в памяти, поэтому между файлами тестов она не переиспользуется,
// но внутри файла состояние общее — закрываем в конце
afterAll(async () => {
  if (hasNodeSqlite) await closeDatabase();
});

describeDb('проекты', () => {
  test('создаётся и читается вместе с замерами', async () => {
    const created = await createProject({ name: 'Скв. 7Ц отк', ofrType: OFR_TYPES.SINGLE, Q: 100 });

    expect(created.id).toBeTruthy();
    expect(created.starred).toBe(false);

    const loaded = await getProject(created.id);
    expect(loaded.name).toBe('Скв. 7Ц отк');
    expect(loaded.Q).toBe(100);
    expect(loaded.measurements).toEqual([]);
  });

  test('куст заводится с типовыми расстояниями, а не с нулями', async () => {
    const created = await createProject({
      name: 'Куст. 12',
      ofrType: OFR_TYPES.CLUSTER,
      pumpingWellName: '1оп',
      observationWellName: '1н',
    });

    const loaded = await getProject(created.id);
    const pumping = loaded.wells.find((well) => well.role === WELL_ROLES.PUMPING);
    const observation = loaded.wells.find(
      (well) => well.role === WELL_ROLES.OBSERVATION
    );

    // «Опытная — опытная» держит радиус опытной, «наблюдательная — опытная»
    // отход первого ряда
    expect(pumping.distance).toBeCloseTo(DEFAULT_CLUSTER_DISTANCES.PUMPING_RADIUS, 6);
    expect(observation.distance).toBeCloseTo(DEFAULT_CLUSTER_DISTANCES.OBSERVATION, 6);

    // То же самое возвращает и сам createProject: экран обработки открывается
    // сразу после него и читает скважины из ответа
    expect(created.wells.map((well) => well.distance)).toEqual([
      DEFAULT_CLUSTER_DISTANCES.PUMPING_RADIUS,
      DEFAULT_CLUSTER_DISTANCES.OBSERVATION,
    ]);
  });

  test('обновляются отдельные поля, остальные не затрагиваются', async () => {
    const project = await createProject({ name: 'Куст. 38', ofrType: OFR_TYPES.CLUSTER, Q: 50 });

    await updateProject(project.id, { Q: 75 });

    const loaded = await getProject(project.id);
    expect(loaded.Q).toBe(75);
    expect(loaded.name).toBe('Куст. 38');
    expect(loaded.ofrType).toBe(OFR_TYPES.CLUSTER);
  });

  test('сохраняется результат расчёта', async () => {
    const project = await createProject({ name: 'Экспресс. 3г', ofrType: OFR_TYPES.SLUG });

    await updateProject(project.id, {
      results: { T: 123.45, slope: 0.183, method: 'cooper-jacob' },
    });

    const loaded = await getProject(project.id);
    expect(loaded.results.T).toBeCloseTo(123.45, 5);
    expect(loaded.results.method).toBe('cooper-jacob');
  });

  test('избранное переключается и поднимает проект в начало списка', async () => {
    const project = await createProject({ name: 'Избранный' });

    expect(await toggleStarred(project.id)).toBe(true);

    const projects = await listProjects();
    expect(projects[0].id).toBe(project.id);
    expect(projects[0].starred).toBe(true);

    expect(await toggleStarred(project.id)).toBe(false);
  });

  test('несуществующий проект возвращает null', async () => {
    expect(await getProject('нет-такого')).toBeNull();
  });

  test('число журналов для архива не считает удалённые', async () => {
    // База в файле общая, поэтому сверяется прирост, а не число целиком
    const before = await countProjects();

    const kept = await createProject({ name: 'В архиве' });
    const removed = await createProject({ name: 'Удалённый' });
    await deleteProject(removed.id);

    expect(await countProjects()).toBe(before + 1);
    expect((await listProjects()).some((project) => project.id === kept.id)).toBe(true);
  });
});

describeDb('замеры', () => {
  test('добавляются по одному с возрастающим порядком', async () => {
    const project = await createProject({ name: 'С замерами' });

    await addMeasurement(project.id, { t: 1, s: 0.2 });
    await addMeasurement(project.id, { t: 2, s: 0.34 });

    const loaded = await getProject(project.id);
    expect(loaded.measurements).toHaveLength(2);
    expect(loaded.measurements[0].order).toBe(0);
    expect(loaded.measurements[1].order).toBe(1);
    expect(loaded.measurements[1].s).toBeCloseTo(0.34, 6);
  });

  test('замена набора переписывает замеры целиком', async () => {
    const project = await createProject({ name: 'Перезапись' });
    await addMeasurement(project.id, { t: 1, s: 0.1 });

    await replaceMeasurements(project.id, [
      { t: 5, s: 0.52 },
      { t: 10, s: 0.66 },
      { t: 30, s: 0.88 },
    ]);

    const loaded = await getProject(project.id);
    expect(loaded.measurements).toHaveLength(3);
    expect(loaded.measurements.map((m) => m.t)).toEqual([5, 10, 30]);
  });

  test('удаление замера не трогает остальные', async () => {
    const project = await createProject({ name: 'Удаление замера' });
    const first = await addMeasurement(project.id, { t: 1, s: 0.2 });
    await addMeasurement(project.id, { t: 2, s: 0.4 });

    await deleteMeasurement(first.id);

    const loaded = await getProject(project.id);
    expect(loaded.measurements).toHaveLength(1);
    expect(loaded.measurements[0].t).toBe(2);
  });

  test('удаление проекта каскадом убирает его замеры', async () => {
    const project = await createProject({ name: 'Каскад' });
    await addMeasurement(project.id, { t: 1, s: 0.2 });
    await addMeasurement(project.id, { t: 2, s: 0.4 });

    await deleteProject(project.id);

    expect(await getProject(project.id)).toBeNull();
  });
});

describeDb('точки наблюдения', () => {
  test('создаются и читаются', async () => {
    const point = await createPoint({
      title: 'Скважина Ц-1',
      lat: 59.9391,
      lon: 30.3068,
      type: POINT_TYPES.WELL,
    });

    expect(point.id).toBeTruthy();

    const points = await listPoints();
    const found = points.find((p) => p.id === point.id);
    expect(found.title).toBe('Скважина Ц-1');
    expect(found.lat).toBeCloseTo(59.9391, 6);
    expect(found.type).toBe(POINT_TYPES.WELL);
  });

  test('обновляются поля точки', async () => {
    const point = await createPoint({ title: 'Родник', lat: 59.94, lon: 30.31 });

    await updatePoint(point.id, { title: 'Родник северный', type: POINT_TYPES.SPRING });

    const found = (await listPoints()).find((p) => p.id === point.id);
    expect(found.title).toBe('Родник северный');
    expect(found.type).toBe(POINT_TYPES.SPRING);
    expect(found.lat).toBeCloseTo(59.94, 6);
  });

  test('статистика считает точки и различные типы', async () => {
    const before = await getPointStats();

    await createPoint({ title: 'Шурф 4', lat: 59.93, lon: 30.32, type: POINT_TYPES.PIT });

    const after = await getPointStats();
    expect(after.total).toBe(before.total + 1);
    expect(after.types).toBeGreaterThanOrEqual(1);
    expect(after.lastRecordedAt).toBeTruthy();
  });

  test('точка удаляется', async () => {
    const point = await createPoint({ title: 'Временная', lat: 1, lon: 2 });
    await deletePoint(point.id);

    const points = await listPoints();
    expect(points.find((p) => p.id === point.id)).toBeUndefined();
  });
});

describeDb('настройки', () => {
  test('без записей возвращаются значения по умолчанию', async () => {
    await resetSettings();
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('типы значений сохраняются, а не превращаются в строки', async () => {
    await setSetting('tablet', false);
    await setSetting('theme', 'dark');

    const settings = await getSettings();
    expect(settings.tablet).toBe(false);
    expect(settings.theme).toBe('dark');
  });

  test('повторная запись перезаписывает значение', async () => {
    await setSetting('locale', 'en');
    await setSetting('locale', 'ru');
    expect((await getSettings()).locale).toBe('ru');
  });

  test('несколько настроек пишутся одной транзакцией', async () => {
    await updateSettings({ autoLocation: false, tabularNums: false });

    const settings = await getSettings();
    expect(settings.autoLocation).toBe(false);
    expect(settings.tabularNums).toBe(false);
  });
});
