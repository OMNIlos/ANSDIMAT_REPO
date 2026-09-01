# Вложения точек полевого дневника — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Прикрепление фотографий и голосовых заметок к точкам полевого дневника — съёмка, запись, просмотр, удаление.

**Architecture:** Метаданные вложений — в новой таблице SQLite `point_attachments`; сами файлы — в песочнице приложения через тонкий слой `lib/attachmentStore` с платформенной подменой для веба. UI: карточка точки в списке несёт только компактный бейдж-счётчик, всё содержимое живёт в шторке снизу `components/PointSheet`.

**Tech Stack:** React Native 0.79 / Expo SDK 53, expo-sqlite, expo-file-system, expo-image-picker, expo-audio, react-native-paper (тема), i18n-js, Jest + react-test-renderer.

**Спека:** `docs/superpowers/specs/2026-09-01-point-attachments-design.md`

## Global Constraints

- Expo SDK 53. Новые зависимости ставятся **только** через `npx expo install`, не `npm install`: версии обязаны попасть в диапазон SDK. Ожидаемые версии — `expo-image-picker@~16.1.4`, `expo-audio@~0.4.9`.
- Jest в этом репозитории флакает при полном параллелизме. Все прогоны — с `--maxWorkers=2`.
- Комментарии и JSDoc — по-русски, в стиле репозитория: объясняют **почему** так сделано, а не пересказывают код. JSDoc обязателен на каждой экспортируемой функции и компоненте.
- Цвета — только из `useTheme().colors`. Отступы, радиусы, типографика, тени — из `spacing`, `radius`, `type`, `elevation` в `theme.js`. Хардкод допустим лишь для `#FFFFFF` поверх бордовой заливки, как уже сделано в `FieldDiaryScreen`.
- Числа (координаты, длительность) — моноширинным: `type.numeric` или `numericAt(размер)`.
- Новые ключи в `Localization.js` пишутся **в обе** секции: `ru` (начинается на строке ~30) и `en` (~1700). Одинаковый ключ в этом файле молча перетирается тем, что объявлен ниже.
- Никаких `Alert.alert`: в веб-сборке он не показывает кнопки. Отказы в доступе выводятся плашкой на месте, как сделано с геопозицией.
- `expo-file-system` в этом репозитории используется по классическому API (`FileSystem.documentDirectory`, `makeDirectoryAsync`, `copyAsync`, `deleteAsync`) — см. `share/incomingFile.js`. Модуль `expo-file-system/next` не используется.

---

### Task 1: Файловое хранилище вложений

**Files:**
- Create: `lib/attachmentStore.js`
- Create: `lib/attachmentStore.web.js`
- Test: `lib/__tests__/attachmentStore.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `save(id: string, kind: 'photo'|'audio', sourceUri: string) => Promise<string>` — возвращает `source` для базы
  - `resolve(source: string) => string` — адрес, пригодный для `<Image source={{uri}}>` и плеера
  - `remove(source: string) => Promise<void>`
  - `removeAll(sources: string[]) => Promise<void>`

- [ ] **Step 1: Написать падающий тест**

Создай `lib/__tests__/attachmentStore.test.js`:

```javascript
/**
 * Файловое хранилище вложений
 *
 * Проверяется договор, на который опирается вся остальная фича: имя файла в
 * базе, а не абсолютный путь. Контейнер приложения на iOS меняет UUID при
 * переустановке, и сохранённый абсолютный адрес после неё ведёт в никуда.
 */

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///data/app/Documents/',
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
  deleteAsync: jest.fn(async () => {}),
}));

const FileSystem = require('expo-file-system');
const store = require('../attachmentStore');

beforeEach(() => {
  jest.clearAllMocks();
  FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
});

test('save возвращает имя файла, а не абсолютный путь', async () => {
  const source = await store.save('abc-123', 'photo', 'file:///cache/IMG_0001.jpg');

  expect(source).toBe('abc-123.jpg');
  expect(source).not.toContain('/');
});

test('save кладёт файл в каталог вложений', async () => {
  await store.save('abc-123', 'audio', 'file:///cache/rec.m4a');

  expect(FileSystem.copyAsync).toHaveBeenCalledWith({
    from: 'file:///cache/rec.m4a',
    to: 'file:///data/app/Documents/attachments/abc-123.m4a',
  });
});

test('каталог заводится один раз, а не при каждом сохранении', async () => {
  await store.save('a', 'photo', 'file:///cache/a.jpg');
  FileSystem.getInfoAsync.mockResolvedValue({ exists: true });
  await store.save('b', 'photo', 'file:///cache/b.jpg');

  expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledTimes(1);
});

test('resolve собирает абсолютный адрес из имени', () => {
  expect(store.resolve('abc-123.jpg')).toBe(
    'file:///data/app/Documents/attachments/abc-123.jpg'
  );
});

test('remove не падает на уже удалённом файле', async () => {
  await store.remove('abc-123.jpg');

  // idempotent: файл мог не доехать до диска, а строку в базе всё равно чистим
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
    'file:///data/app/Documents/attachments/abc-123.jpg',
    { idempotent: true }
  );
});

test('removeAll стирает всю пачку', async () => {
  await store.removeAll(['a.jpg', 'b.m4a']);

  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest lib/__tests__/attachmentStore.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../attachmentStore'`

- [ ] **Step 3: Написать нативную реализацию**

Создай `lib/attachmentStore.js`:

```javascript
/**
 * Файловое хранилище вложений точек полевого дневника
 *
 * В базе лежит имя файла, а не абсолютный путь. Каталог приложения на iOS
 * содержит UUID контейнера, и этот UUID меняется при переустановке и части
 * обновлений: сохранённый `file:///var/mobile/.../Documents/...` наутро ведёт
 * в никуда, а строка в базе остаётся — точка показывает вложение, которого
 * нет. Поэтому абсолютный адрес собирается при чтении.
 *
 * И пикер, и рекордер отдают файл в кэше, который система вправе вычистить в
 * любой момент, поэтому файл переносится в `documents`, а не остаётся по
 * исходному адресу.
 */

import * as FileSystem from 'expo-file-system';

const DIRECTORY = `${FileSystem.documentDirectory}attachments/`;

/** Расширение файла по виду вложения */
const EXTENSION = { photo: 'jpg', audio: 'm4a' };

/**
 * Заводит каталог вложений, если его ещё нет
 *
 * @returns {Promise<void>}
 */
async function ensureDirectory() {
  const info = await FileSystem.getInfoAsync(DIRECTORY);
  if (info.exists) return;
  await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true });
}

/**
 * Переносит файл в хранилище вложений
 *
 * @param {string} id - идентификатор вложения, он же имя файла
 * @param {'photo'|'audio'} kind - вид вложения
 * @param {string} sourceUri - откуда взять файл
 * @returns {Promise<string>} значение для колонки `source`
 */
export async function save(id, kind, sourceUri) {
  await ensureDirectory();
  const name = `${id}.${EXTENSION[kind]}`;
  await FileSystem.copyAsync({ from: sourceUri, to: `${DIRECTORY}${name}` });
  return name;
}

/**
 * Собирает адрес, пригодный для `<Image>` и плеера
 *
 * @param {string} source - значение колонки `source`
 * @returns {string} абсолютный адрес файла
 */
export function resolve(source) {
  return `${DIRECTORY}${source}`;
}

/**
 * Стирает файл вложения
 *
 * @param {string} source - значение колонки `source`
 * @returns {Promise<void>}
 */
export async function remove(source) {
  // idempotent: файл мог не доехать до диска — например, приложение убили
  // между записью в базу и копированием, — а строку чистить всё равно надо
  await FileSystem.deleteAsync(`${DIRECTORY}${source}`, { idempotent: true });
}

/**
 * Стирает пачку файлов — при удалении точки со всеми вложениями
 *
 * @param {string[]} sources - значения колонки `source`
 * @returns {Promise<void>}
 */
export async function removeAll(sources) {
  await Promise.all(sources.map((source) => remove(source)));
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx jest lib/__tests__/attachmentStore.test.js --maxWorkers=2`
Expected: PASS, 6 тестов

- [ ] **Step 5: Написать веб-вариант**

Создай `lib/attachmentStore.web.js`:

```javascript
/**
 * Хранилище вложений в вебе
 *
 * `expo-file-system` на вебе подменён заглушкой: `documentDirectory` там
 * `null`, и запись на диск невозможна в принципе. Поэтому байты сохраняются
 * data-URI прямо в колонку `source`, а `resolve` отдаёт строку как есть.
 *
 * `blob:`-адреса не годятся: они живут только до перезагрузки страницы, и
 * после обновления вкладки миниатюра превратилась бы в битую картинку.
 *
 * Это нужно, чтобы фичу можно было прогнать в браузерном превью — так
 * тестируется остальное приложение. На устройстве работает `attachmentStore.js`.
 */

/**
 * Переводит файл в data-URI
 *
 * @param {string} id - идентификатор вложения (в вебе не используется:
 *   адресом служит само содержимое)
 * @param {'photo'|'audio'} kind - вид вложения (там же)
 * @param {string} sourceUri - blob-, data- или file-адрес источника
 * @returns {Promise<string>} data-URI для колонки `source`
 */
export async function save(id, kind, sourceUri) {
  if (sourceUri.startsWith('data:')) return sourceUri;

  const response = await fetch(sourceUri);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * В вебе `source` уже является адресом
 *
 * @param {string} source - data-URI
 * @returns {string} он же
 */
export function resolve(source) {
  return source;
}

/**
 * Ничего не делает: байты лежат в строке базы, и удаление строки —
 * это и есть удаление файла
 *
 * @returns {Promise<void>}
 */
export async function remove() {}

/**
 * Ничего не делает по той же причине, что и `remove`
 *
 * @returns {Promise<void>}
 */
export async function removeAll() {}
```

- [ ] **Step 6: Прогнать весь набор — ничего не сломалось**

Run: `npx jest --maxWorkers=2`
Expected: PASS, прежние тесты зелёные

- [ ] **Step 7: Коммит**

```bash
git add lib/attachmentStore.js lib/attachmentStore.web.js lib/__tests__/attachmentStore.test.js
git commit -m "feat: файловое хранилище вложений точек"
```

---

### Task 2: Миграция v13 и репозиторий вложений

**Files:**
- Modify: `db/schema.js` (в конец массива `MIGRATIONS`, после v12)
- Create: `db/attachments.js`
- Modify: `db/points.js` (`deletePoint`)
- Test: `db/__tests__/migrations.test.js` (добавить блок), `db/__tests__/attachments.test.js`

**Interfaces:**
- Consumes: `save`, `remove`, `removeAll` из `lib/attachmentStore` (Task 1); `getDatabase`, `createId` из `db/index`.
- Produces:
  - `ATTACHMENT_KINDS = { PHOTO: 'photo', AUDIO: 'audio' }`
  - `listAttachments(pointIds: string[]) => Promise<Record<string, Attachment[]>>`
  - `addAttachment({ pointId, kind, uri, durationMillis?, waveform? }) => Promise<Attachment>`
  - `deleteAttachment(id: string) => Promise<void>`
  - `deleteAttachmentsForPoint(pointId: string) => Promise<void>`
  - `Attachment = { id, pointId, kind, source, uri, durationMillis, waveform: number[], recordedAt }`, где `uri` — уже разрешённый через `attachmentStore.resolve` адрес.

- [ ] **Step 1: Написать падающий тест миграции**

Добавь в конец `db/__tests__/migrations.test.js`:

```javascript
describeDb('v13 — вложения точек', () => {
  let database;

  beforeAll(() => {
    database = openAt(MIGRATIONS.length);

    database.exec(`
      INSERT INTO observation_points (id, title, lat, lon, recorded_at, updated_at, dirty)
      VALUES ('11111111-2222-4333-8444-555555555555', 'Скважина 3', 59.7, 30.4, 3000, 3000, 1);
    `);
  });

  afterAll(() => {
    if (database) database.close();
  });

  test('вложение ложится в таблицу', () => {
    database.exec(`
      INSERT INTO point_attachments (id, point_id, kind, source, recorded_at)
      VALUES ('a1', '11111111-2222-4333-8444-555555555555', 'photo', 'a1.jpg', 4000);
    `);

    const row = database
      .prepare('SELECT kind, source, duration, waveform FROM point_attachments WHERE id = ?')
      .get('a1');

    expect(row.kind).toBe('photo');
    expect(row.source).toBe('a1.jpg');
    // У снимка нет ни длительности, ни волны
    expect(row.duration).toBeNull();
    expect(row.waveform).toBeNull();
  });

  test('вложение чужой точки не проходит', () => {
    database.exec('PRAGMA foreign_keys = ON');

    expect(() =>
      database.exec(`
        INSERT INTO point_attachments (id, point_id, kind, source, recorded_at)
        VALUES ('a2', 'нет-такой-точки', 'audio', 'a2.m4a', 5000);
      `)
    ).toThrow();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest db/__tests__/migrations.test.js --maxWorkers=2`
Expected: FAIL — `no such table: point_attachments`

- [ ] **Step 3: Добавить миграцию v13**

В `db/schema.js`, в самый конец массива `MIGRATIONS` — после элемента v12 (`ALTER TABLE projects ADD COLUMN params TEXT;`) и перед закрывающим `];`:

```javascript
  // v13 — вложения точек полевого дневника: снимки и голосовые заметки.
  //
  // В `source` лежит имя файла, а не абсолютный путь. Каталог приложения на
  // iOS содержит UUID контейнера, который меняется при переустановке: строка
  // с абсолютным адресом пережила бы обновление, а файл по этому адресу —
  // нет. Абсолютный адрес собирается при чтении, см. lib/attachmentStore.js.
  //
  // Полей синхронизации здесь нет намеренно. У остальных таблиц мягкое
  // удаление защищает от того, что второе устройство, бывшее офлайн, зальёт
  // удалённую строку обратно. Вложения не уезжают на сервер и вернуться не
  // могут, поэтому защищать нечего — мягкое удаление только копило бы
  // мегабайты мусора в песочнице, где у телефона в поле и так кончается место.
  //
  // ON DELETE CASCADE тут не сработает никогда: точки удаляются мягко, DELETE
  // по ним не выполняется. Каскад стоит защитой от рассинхрона, а чистит
  // вложения удалённой точки явный вызов deleteAttachmentsForPoint.
  `
  CREATE TABLE IF NOT EXISTS point_attachments (
    id          TEXT PRIMARY KEY NOT NULL,
    point_id    TEXT NOT NULL,
    kind        TEXT NOT NULL,
    source      TEXT NOT NULL,
    duration    INTEGER,
    waveform    TEXT,
    recorded_at INTEGER NOT NULL,
    FOREIGN KEY (point_id) REFERENCES observation_points (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_attachments_point
    ON point_attachments (point_id);
  `,
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx jest db/__tests__/migrations.test.js --maxWorkers=2`
Expected: PASS

- [ ] **Step 5: Написать падающий тест репозитория**

Создай `db/__tests__/attachments.test.js`:

```javascript
/**
 * Репозиторий вложений точек
 *
 * Проверяются два договора, на которые опирается экран: список читается одним
 * запросом на весь дневник (иначе прокрутка даёт запрос на точку), и удаление
 * строки обязательно уносит за собой файл — иначе песочница копит мусор,
 * которого уже ничем не видно.
 */

const rows = [];

jest.mock('../index', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: jest.fn(async () => rows),
    getFirstAsync: jest.fn(async () => rows[0] ?? null),
    runAsync: jest.fn(async () => {}),
  })),
  createId: jest.fn(() => 'generated-id'),
}));

jest.mock('../../lib/attachmentStore', () => ({
  save: jest.fn(async () => 'generated-id.jpg'),
  resolve: jest.fn((source) => `file:///documents/attachments/${source}`),
  remove: jest.fn(async () => {}),
  removeAll: jest.fn(async () => {}),
}));

const store = require('../../lib/attachmentStore');
const {
  listAttachments,
  addAttachment,
  deleteAttachment,
  deleteAttachmentsForPoint,
} = require('../attachments');

beforeEach(() => {
  jest.clearAllMocks();
  rows.length = 0;
  store.resolve.mockImplementation((source) => `file:///documents/attachments/${source}`);
});

test('список группируется по точкам', async () => {
  rows.push(
    { id: 'a1', point_id: 'p1', kind: 'photo', source: 'a1.jpg', duration: null, waveform: null, recorded_at: 1 },
    { id: 'a2', point_id: 'p1', kind: 'audio', source: 'a2.m4a', duration: 14000, waveform: '[0.2,0.8]', recorded_at: 2 },
    { id: 'a3', point_id: 'p2', kind: 'photo', source: 'a3.jpg', duration: null, waveform: null, recorded_at: 3 }
  );

  const byPoint = await listAttachments(['p1', 'p2']);

  expect(byPoint.p1).toHaveLength(2);
  expect(byPoint.p2).toHaveLength(1);
});

test('адрес файла разрешается на чтении, а не хранится в базе', async () => {
  rows.push({ id: 'a1', point_id: 'p1', kind: 'photo', source: 'a1.jpg', duration: null, waveform: null, recorded_at: 1 });

  const byPoint = await listAttachments(['p1']);

  expect(byPoint.p1[0].source).toBe('a1.jpg');
  expect(byPoint.p1[0].uri).toBe('file:///documents/attachments/a1.jpg');
});

test('волна приезжает массивом, а не строкой', async () => {
  rows.push({ id: 'a2', point_id: 'p1', kind: 'audio', source: 'a2.m4a', duration: 14000, waveform: '[0.2,0.8]', recorded_at: 2 });

  const byPoint = await listAttachments(['p1']);

  expect(byPoint.p1[0].waveform).toEqual([0.2, 0.8]);
  expect(byPoint.p1[0].durationMillis).toBe(14000);
});

test('битая волна не роняет экран', async () => {
  // Строка могла испортиться при сбое записи: дневник должен открыться,
  // пусть и без картинки волны у этой записи
  rows.push({ id: 'a2', point_id: 'p1', kind: 'audio', source: 'a2.m4a', duration: 14000, waveform: 'не json', recorded_at: 2 });

  const byPoint = await listAttachments(['p1']);

  expect(byPoint.p1[0].waveform).toEqual([]);
});

test('пустой список точек в базу не ходит', async () => {
  const byPoint = await listAttachments([]);

  expect(byPoint).toEqual({});
});

test('добавление сначала кладёт файл, потом пишет строку', async () => {
  const created = await addAttachment({
    pointId: 'p1',
    kind: 'photo',
    uri: 'file:///cache/IMG_0001.jpg',
  });

  expect(store.save).toHaveBeenCalledWith('generated-id', 'photo', 'file:///cache/IMG_0001.jpg');
  expect(created.source).toBe('generated-id.jpg');
  expect(created.uri).toBe('file:///documents/attachments/generated-id.jpg');
});

test('удаление уносит за собой файл', async () => {
  rows.push({ id: 'a1', point_id: 'p1', kind: 'photo', source: 'a1.jpg', duration: null, waveform: null, recorded_at: 1 });

  await deleteAttachment('a1');

  expect(store.remove).toHaveBeenCalledWith('a1.jpg');
});

test('удаление точки уносит все её файлы', async () => {
  rows.push(
    { id: 'a1', point_id: 'p1', kind: 'photo', source: 'a1.jpg', duration: null, waveform: null, recorded_at: 1 },
    { id: 'a2', point_id: 'p1', kind: 'audio', source: 'a2.m4a', duration: 14000, waveform: '[]', recorded_at: 2 }
  );

  await deleteAttachmentsForPoint('p1');

  expect(store.removeAll).toHaveBeenCalledWith(['a1.jpg', 'a2.m4a']);
});
```

- [ ] **Step 6: Убедиться, что тест падает**

Run: `npx jest db/__tests__/attachments.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../attachments'`

- [ ] **Step 7: Написать репозиторий**

Создай `db/attachments.js`:

```javascript
/**
 * Репозиторий вложений точек наблюдения
 *
 * Метаданные живут здесь, файлы — в lib/attachmentStore. Разделение нужно
 * потому, что в вебе файлов нет вовсе: там `source` — это data-URI, и весь
 * платформенный разнобой заперт в хранилище, а этот модуль про него не знает.
 */

import { getDatabase, createId } from './index';
import * as attachmentStore from '../lib/attachmentStore';

/** Виды вложений */
export const ATTACHMENT_KINDS = { PHOTO: 'photo', AUDIO: 'audio' };

/**
 * Разбирает волну из базы
 *
 * Строка могла испортиться при сбое записи. Дневник должен открыться в любом
 * случае — пусть эта запись и покажется без картинки волны.
 *
 * @param {string|null} json - содержимое колонки `waveform`
 * @returns {number[]} уровни 0..1
 */
function parseWaveform(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Преобразует строку таблицы во вложение
 *
 * @param {Object} row - строка из SQLite
 * @returns {Object} вложение с разрешённым адресом файла
 */
function mapAttachment(row) {
  return {
    id: row.id,
    pointId: row.point_id,
    kind: row.kind,
    source: row.source,
    uri: attachmentStore.resolve(row.source),
    durationMillis: row.duration ?? 0,
    waveform: parseWaveform(row.waveform),
    recordedAt: row.recorded_at,
  };
}

/**
 * Возвращает вложения указанных точек, старые первыми
 *
 * Один запрос на весь дневник, а не запрос на точку: экран перечитывается при
 * каждом возврате, и запрос на точку дал бы столько обращений к базе, сколько
 * в дневнике точек.
 *
 * @param {string[]} pointIds - идентификаторы точек
 * @returns {Promise<Object>} карта «точка → вложения»
 */
export async function listAttachments(pointIds) {
  if (pointIds.length === 0) return {};

  const database = await getDatabase();
  const placeholders = pointIds.map(() => '?').join(', ');
  const rows = await database.getAllAsync(
    `SELECT * FROM point_attachments
      WHERE point_id IN (${placeholders})
      ORDER BY recorded_at ASC`,
    pointIds
  );

  const byPoint = {};
  for (const row of rows) {
    const attachment = mapAttachment(row);
    if (!byPoint[attachment.pointId]) byPoint[attachment.pointId] = [];
    byPoint[attachment.pointId].push(attachment);
  }
  return byPoint;
}

/**
 * Прикрепляет к точке снимок или голосовую заметку
 *
 * Файл переносится в хранилище раньше записи в базу: если перенос сорвётся,
 * в дневнике не появится строки, которой не соответствует файл.
 *
 * @param {Object} params
 * @param {string} params.pointId - точка
 * @param {'photo'|'audio'} params.kind - вид вложения
 * @param {string} params.uri - откуда взять файл
 * @param {number} [params.durationMillis] - длительность записи
 * @param {number[]} [params.waveform] - уровни сигнала 0..1
 * @returns {Promise<Object>} созданное вложение
 */
export async function addAttachment({ pointId, kind, uri, durationMillis = null, waveform = null }) {
  const database = await getDatabase();
  const id = createId();
  const recordedAt = Date.now();

  const source = await attachmentStore.save(id, kind, uri);

  await database.runAsync(
    `INSERT INTO point_attachments (id, point_id, kind, source, duration, waveform, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, pointId, kind, source, durationMillis, waveform ? JSON.stringify(waveform) : null, recordedAt]
  );

  return {
    id,
    pointId,
    kind,
    source,
    uri: attachmentStore.resolve(source),
    durationMillis: durationMillis ?? 0,
    waveform: waveform ?? [],
    recordedAt,
  };
}

/**
 * Удаляет вложение вместе с файлом
 *
 * Удаление жёсткое: вложения не синхронизируются и с сервера вернуться не
 * могут, поэтому мягкому удалению нечего защищать — оно только оставляло бы
 * мегабайты, которых уже ничем не видно.
 *
 * @param {string} id - идентификатор вложения
 * @returns {Promise<void>}
 */
export async function deleteAttachment(id) {
  const database = await getDatabase();
  const row = await database.getFirstAsync(
    'SELECT source FROM point_attachments WHERE id = ?',
    [id]
  );
  if (!row) return;

  await database.runAsync('DELETE FROM point_attachments WHERE id = ?', [id]);
  await attachmentStore.remove(row.source);
}

/**
 * Удаляет все вложения точки вместе с файлами
 *
 * Вызывается из deletePoint: точка удаляется мягко, DELETE по ней не идёт, и
 * ON DELETE CASCADE не срабатывает.
 *
 * @param {string} pointId - точка
 * @returns {Promise<void>}
 */
export async function deleteAttachmentsForPoint(pointId) {
  const database = await getDatabase();
  const rows = await database.getAllAsync(
    'SELECT source FROM point_attachments WHERE point_id = ?',
    [pointId]
  );
  if (rows.length === 0) return;

  await database.runAsync('DELETE FROM point_attachments WHERE point_id = ?', [pointId]);
  await attachmentStore.removeAll(rows.map((row) => row.source));
}
```

- [ ] **Step 8: Убедиться, что тест проходит**

Run: `npx jest db/__tests__/attachments.test.js --maxWorkers=2`
Expected: PASS, 8 тестов

- [ ] **Step 9: Подцепить очистку к удалению точки**

В `db/points.js` добавь импорт под существующий:

```javascript
import { deleteAttachmentsForPoint } from './attachments';
```

И замени тело `deletePoint`:

```javascript
export async function deletePoint(id) {
  const database = await getDatabase();
  const now = Date.now();

  // Точка удаляется мягко — она синхронизируется, и без deleted_at второе
  // устройство зальёт её обратно. Вложения удаляются насовсем: они локальные
  // и вернуться не могут, а место в песочнице освобождать надо сразу
  await deleteAttachmentsForPoint(id);

  await database.runAsync(
    'UPDATE observation_points SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [now, now, id]
  );
}
```

- [ ] **Step 10: Прогнать весь набор**

Run: `npx jest --maxWorkers=2`
Expected: PASS

- [ ] **Step 11: Коммит**

```bash
git add db/schema.js db/attachments.js db/points.js db/__tests__/attachments.test.js db/__tests__/migrations.test.js
git commit -m "feat: таблица и репозиторий вложений точек"
```

---

### Task 3: Волна — нормализация и прореживание

**Files:**
- Create: `lib/waveform.js`
- Test: `lib/__tests__/waveform.test.js`

**Interfaces:**
- Consumes: ничего (чистые функции).
- Produces:
  - `SILENCE_FLOOR_DB = -60`
  - `WAVEFORM_BARS = 40`
  - `levelFromMetering(db: number|undefined) => number` — 0..1
  - `condense(levels: number[], bars?: number) => number[]`
  - `formatDuration(millis: number) => string` — `М:СС`

- [ ] **Step 1: Написать падающий тест**

Создай `lib/__tests__/waveform.test.js`:

```javascript
/**
 * Волна голосовой заметки
 *
 * Волна строится по реальному уровню сигнала, а не рисуется узором, поэтому
 * проверяются обе стороны договора: перевод дБFS в 0..1 и прореживание
 * набора до числа столбиков, которое влезает в строку.
 */

const {
  SILENCE_FLOOR_DB,
  WAVEFORM_BARS,
  levelFromMetering,
  condense,
  formatDuration,
} = require('../waveform');

test('тишина даёт ноль, максимум — единицу', () => {
  expect(levelFromMetering(SILENCE_FLOOR_DB)).toBe(0);
  expect(levelFromMetering(0)).toBe(1);
});

test('уровень ниже порога не уходит в минус', () => {
  // Ниже -60 дБFS полевая запись не несёт ничего, кроме шума ветра,
  // а отрицательная высота столбика сломала бы отрисовку
  expect(levelFromMetering(-120)).toBe(0);
});

test('отсутствующий уровень считается тишиной', () => {
  // В вебе getStatus не отдаёт metering вовсе
  expect(levelFromMetering(undefined)).toBe(0);
  expect(levelFromMetering(NaN)).toBe(0);
});

test('середина шкалы попадает в середину', () => {
  expect(levelFromMetering(-30)).toBeCloseTo(0.5, 5);
});

test('короткий набор прореживанию не подвергается', () => {
  expect(condense([0.1, 0.9], 40)).toEqual([0.1, 0.9]);
});

test('длинный набор сжимается до заданного числа столбиков', () => {
  const levels = Array.from({ length: 500 }, (_, i) => (i % 10) / 10);

  expect(condense(levels, 40)).toHaveLength(40);
});

test('прореживание берёт пик, а не среднее', () => {
  // Усреднение съедает короткие всплески речи, и волна вырождается
  // в ровную полосу — по такой картинке запись не отличить от тишины
  const levels = [0, 0, 0, 1, 0, 0, 0, 0];

  expect(condense(levels, 2)).toEqual([1, 0]);
});

test('пустой набор даёт пустую волну', () => {
  expect(condense([], 40)).toEqual([]);
});

test('уровни округляются до сотых — волна лежит в базе строкой', () => {
  expect(condense([0.123456, 0.987654], 40)).toEqual([0.12, 0.99]);
});

test('по умолчанию столбиков WAVEFORM_BARS', () => {
  const levels = Array.from({ length: 500 }, () => 0.5);

  expect(condense(levels)).toHaveLength(WAVEFORM_BARS);
});

test('длительность выводится как М:СС', () => {
  expect(formatDuration(0)).toBe('0:00');
  expect(formatDuration(7_000)).toBe('0:07');
  expect(formatDuration(74_000)).toBe('1:14');
  expect(formatDuration(605_000)).toBe('10:05');
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest lib/__tests__/waveform.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../waveform'`

- [ ] **Step 3: Написать реализацию**

Создай `lib/waveform.js`:

```javascript
/**
 * Волна голосовой заметки
 *
 * Волна строится по реальному уровню сигнала, а не рисуется декоративным
 * узором: рекордер отдаёт metering в дБFS, здесь он переводится в 0..1 и
 * прореживается до числа столбиков, которое влезает в строку шириной с экран.
 *
 * Функции чистые и живут отдельно от хука записи: так их проверяет Jest без
 * нативных моков, а компонент волны не зависит от того, откуда пришли уровни.
 */

/**
 * Порог тишины
 *
 * Ниже -60 дБFS полевая запись не несёт ничего, кроме шума ветра, — тянуть
 * шкалу до -160, которые отдаёт рекордер, значило бы прижать всю речь
 * к верхней трети столбика.
 */
export const SILENCE_FLOOR_DB = -60;

/** Сколько столбиков хранится у сохранённой записи */
export const WAVEFORM_BARS = 40;

/**
 * Переводит уровень рекордера в высоту столбика
 *
 * @param {number|undefined} db - уровень в дБFS
 * @returns {number} 0..1
 */
export function levelFromMetering(db) {
  // В вебе getStatus не отдаёт metering вовсе — там волна будет ровной,
  // и это честнее, чем подрисовать её случайными числами
  if (typeof db !== 'number' || Number.isNaN(db)) return 0;

  const level = (db - SILENCE_FLOOR_DB) / -SILENCE_FLOOR_DB;
  return Math.min(1, Math.max(0, level));
}

/**
 * Округляет до сотых
 *
 * Волна лежит в базе строкой JSON, и полная точность double раздувала бы её
 * в десять раз, ничего не добавляя к картинке из сорока столбиков.
 *
 * @param {number} value - уровень
 * @returns {number} уровень с двумя знаками
 */
const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Сжимает набор уровней до числа столбиков
 *
 * Берётся пик окна, а не среднее: усреднение съедает короткие всплески речи,
 * и волна вырождается в ровную полосу, по которой запись не отличить от
 * тишины.
 *
 * @param {number[]} levels - уровни 0..1
 * @param {number} [bars] - сколько столбиков оставить
 * @returns {number[]} прореженные уровни
 */
export function condense(levels, bars = WAVEFORM_BARS) {
  if (levels.length === 0) return [];
  if (levels.length <= bars) return levels.map(round2);

  const condensed = [];
  for (let index = 0; index < bars; index++) {
    const from = Math.floor((index * levels.length) / bars);
    const to = Math.floor(((index + 1) * levels.length) / bars);

    let peak = 0;
    for (let cursor = from; cursor < to; cursor++) {
      peak = Math.max(peak, levels[cursor]);
    }
    condensed.push(round2(peak));
  }
  return condensed;
}

/**
 * Выводит длительность записи
 *
 * Минуты без ведущего нуля, секунды с ним: полевая заметка редко длиннее
 * пары минут, и «0:07» читается быстрее, чем «00:07».
 *
 * @param {number} millis - длительность в миллисекундах
 * @returns {string} длительность вида «1:14»
 */
export function formatDuration(millis) {
  const total = Math.max(0, Math.round(millis / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx jest lib/__tests__/waveform.test.js --maxWorkers=2`
Expected: PASS, 11 тестов

- [ ] **Step 5: Коммит**

```bash
git add lib/waveform.js lib/__tests__/waveform.test.js
git commit -m "feat: нормализация и прореживание волны голосовой заметки"
```

---

### Task 4: Строки локализации

**Files:**
- Modify: `Localization.js` (секции `ru` и `en`)

**Interfaces:**
- Consumes: ничего.
- Produces: ключи, которыми пользуются задачи 6–10:
  `attachments`, `addPhoto`, `addVoiceNote`, `photoFromCamera`, `photoFromLibrary`,
  `openAttachments`, `recordingInProgress`, `stopRecording`, `playRecording`,
  `pauseRecording`, `deleteAttachment`, `deleteAttachmentMessage`,
  `deletePhotoMessage`, `cameraDenied`, `galleryDenied`, `microphoneDenied`,
  `photoCount`, `voiceNoteCount`, `closePhoto`.

- [ ] **Step 1: Проверить, что ключи свободны**

Файл на 3300 строк, и одинаковый ключ в нём молча перетирается тем, что объявлен ниже. Прогони проверку перед вставкой:

```bash
for k in attachments addPhoto addVoiceNote photoFromCamera photoFromLibrary openAttachments recordingInProgress stopRecording playRecording pauseRecording deleteAttachment deleteAttachmentMessage deletePhotoMessage cameraDenied galleryDenied microphoneDenied photoCount voiceNoteCount closePhoto; do printf '%s -> %s\n' "$k" "$(grep -c "^\s*${k}:" Localization.js)"; done
```

Expected: у каждого ключа `0`. Если где-то не ноль — переименуй свой ключ, а не трогай чужой.

- [ ] **Step 2: Добавить русские строки**

В `Localization.js`, в секцию `ru`, сразу после строки `addPointNote: "Добавить описание",`:

```javascript
    // Вложения точки: снимки и голосовые заметки
    attachments: "Вложения",
    addPhoto: "Фото",
    addVoiceNote: "Запись",
    photoFromCamera: "Снять",
    photoFromLibrary: "Из галереи",
    openAttachments: "Вложения точки",
    recordingInProgress: "Идёт запись",
    stopRecording: "Остановить запись",
    playRecording: "Прослушать запись",
    pauseRecording: "Пауза",
    closePhoto: "Закрыть снимок",
    deleteAttachment: "Удалить вложение?",
    deletePhotoMessage: "Снимок будет удалён с устройства.",
    deleteAttachmentMessage: "Запись будет удалена с устройства.",
    cameraDenied: "Нет доступа к камере. Разрешите его в настройках телефона.",
    galleryDenied: "Нет доступа к галерее. Разрешите его в настройках телефона.",
    microphoneDenied: "Нет доступа к микрофону. Разрешите его в настройках телефона.",
    photoCount: "снимков",
    voiceNoteCount: "записей",
```

- [ ] **Step 3: Добавить английские строки**

В секцию `en`, сразу после строки `addPointNote: "Add a description",`:

```javascript
    // Point attachments: photos and voice notes
    attachments: "Attachments",
    addPhoto: "Photo",
    addVoiceNote: "Record",
    photoFromCamera: "Take photo",
    photoFromLibrary: "From gallery",
    openAttachments: "Point attachments",
    recordingInProgress: "Recording",
    stopRecording: "Stop recording",
    playRecording: "Play recording",
    pauseRecording: "Pause",
    closePhoto: "Close photo",
    deleteAttachment: "Delete attachment?",
    deletePhotoMessage: "The photo will be deleted from this device.",
    deleteAttachmentMessage: "The recording will be deleted from this device.",
    cameraDenied: "No camera access. Allow it in your phone settings.",
    galleryDenied: "No gallery access. Allow it in your phone settings.",
    microphoneDenied: "No microphone access. Allow it in your phone settings.",
    photoCount: "photos",
    voiceNoteCount: "recordings",
```

- [ ] **Step 4: Проверить, что дублей не появилось**

```bash
node -e "const s=require('fs').readFileSync('Localization.js','utf8');const keys=['attachments','addPhoto','addVoiceNote','photoFromCamera','photoFromLibrary','openAttachments','recordingInProgress','stopRecording','playRecording','pauseRecording','deleteAttachment','deleteAttachmentMessage','deletePhotoMessage','cameraDenied','galleryDenied','microphoneDenied','photoCount','voiceNoteCount','closePhoto'];let bad=0;for(const k of keys){const n=(s.match(new RegExp('^\\\\s*'+k+':','gm'))||[]).length;if(n!==2){console.log(k,'->',n,'(ждём 2: ru и en)');bad++;}}process.exit(bad?1:0)"
```

Expected: пусто, код возврата 0

- [ ] **Step 5: Прогнать набор — I18n грузится без ошибок**

Run: `npx jest --maxWorkers=2`
Expected: PASS

- [ ] **Step 6: Коммит**

```bash
git add Localization.js
git commit -m "feat: строки вложений точек"
```

---

### Task 5: Компонент волны

**Files:**
- Create: `components/AudioWave.js`
- Test: `components/__tests__/AudioWave.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `<AudioWave levels={number[]} progress={number} color={string} mutedColor={string} height={number} />` — `progress` 0..1, столбики левее него закрашены `color`, правее — `mutedColor`.

- [ ] **Step 1: Написать падающий тест**

Создай `components/__tests__/AudioWave.test.js`:

```javascript
/**
 * Столбики волны
 *
 * Один компонент рисует и живую запись, и воспроизведение: рисуют они одно и
 * то же, отличается только источник уровней и закраска пройденной части.
 */

import React from 'react';
import renderer from 'react-test-renderer';
import AudioWave from '../AudioWave';

/** Столбики волны — вложенные View с заданной высотой */
const bars = (tree) =>
  tree.root.findAll(
    (node) => node.props?.testID === 'audio-wave-bar',
    { deep: true }
  );

test('столбиков ровно столько, сколько уровней', () => {
  const tree = renderer.create(
    <AudioWave levels={[0.1, 0.5, 0.9]} color="#72002F" mutedColor="#E8E4E6" />
  );

  expect(bars(tree)).toHaveLength(3);
});

test('громкий участок выше тихого', () => {
  const tree = renderer.create(
    <AudioWave levels={[0.1, 0.9]} color="#72002F" mutedColor="#E8E4E6" height={40} />
  );

  const [quiet, loud] = bars(tree).map((bar) =>
    [].concat(bar.props.style).reduce((acc, style) => ({ ...acc, ...style }), {}).height
  );

  expect(loud).toBeGreaterThan(quiet);
});

test('тишина всё равно видна', () => {
  // Нулевая высота дала бы разрыв в строке, и волна выглядела бы обрезанной
  const tree = renderer.create(
    <AudioWave levels={[0]} color="#72002F" mutedColor="#E8E4E6" height={40} />
  );

  const [style] = bars(tree).map((bar) =>
    [].concat(bar.props.style).reduce((acc, item) => ({ ...acc, ...item }), {})
  );

  expect(style.height).toBeGreaterThanOrEqual(2);
});

test('пройденная часть закрашена, остальная приглушена', () => {
  const tree = renderer.create(
    <AudioWave levels={[0.5, 0.5, 0.5, 0.5]} progress={0.5} color="#72002F" mutedColor="#E8E4E6" />
  );

  const colors = bars(tree).map((bar) =>
    [].concat(bar.props.style).reduce((acc, item) => ({ ...acc, ...item }), {}).backgroundColor
  );

  expect(colors).toEqual(['#72002F', '#72002F', '#E8E4E6', '#E8E4E6']);
});

test('без уровней компонент ничего не рисует', () => {
  const tree = renderer.create(
    <AudioWave levels={[]} color="#72002F" mutedColor="#E8E4E6" />
  );

  expect(bars(tree)).toHaveLength(0);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest components/__tests__/AudioWave.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../AudioWave'`

- [ ] **Step 3: Написать компонент**

Создай `components/AudioWave.js`:

```javascript
/**
 * Столбики волны голосовой заметки
 *
 * Один компонент на два случая — живая запись и воспроизведение, — потому что
 * рисуют они одно и то же. Отличается только источник массива уровней и то,
 * какая часть закрашена.
 *
 * Столбики, а не сглаженная кривая: на ширине в палец кривая по сорока точкам
 * превращается в мятую линию, а столбики читаются и на 120 пикселях.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Ниже этой высоты столбик неразличим, и в строке появляется разрыв */
const MIN_BAR_HEIGHT = 2;

/**
 * @param {Object} props
 * @param {number[]} props.levels - уровни 0..1
 * @param {number} [props.progress] - доля пройденного, 0..1
 * @param {string} props.color - цвет пройденной части
 * @param {string} props.mutedColor - цвет непройденной части
 * @param {number} [props.height] - высота самого громкого столбика
 * @param {Object} [props.style] - стиль контейнера
 */
export default function AudioWave({
  levels,
  progress = 1,
  color,
  mutedColor,
  height = 28,
  style,
}) {
  const played = Math.round(levels.length * progress);

  return (
    <View style={[styles.row, { height }, style]}>
      {levels.map((level, index) => (
        <View
          key={index}
          testID="audio-wave-bar"
          style={[
            styles.bar,
            {
              height: Math.max(MIN_BAR_HEIGHT, Math.round(level * height)),
              backgroundColor: index < played ? color : mutedColor,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 1,
  },
});
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx jest components/__tests__/AudioWave.test.js --maxWorkers=2`
Expected: PASS, 5 тестов

- [ ] **Step 5: Коммит**

```bash
git add components/AudioWave.js components/__tests__/AudioWave.test.js
git commit -m "feat: столбики волны голосовой заметки"
```

---

### Task 6: Съёмка фото

**Files:**
- Modify: `package.json` (через `npx expo install`)
- Modify: `app.json` (плагин `expo-image-picker`, право `CAMERA`)
- Create: `hooks/usePhotoCapture.js`
- Test: `hooks/__tests__/usePhotoCapture.test.js`

**Interfaces:**
- Consumes: ничего из прошлых задач.
- Produces: `usePhotoCapture()` → `{ capture(source: 'camera'|'library') => Promise<string|null>, denied: 'camera'|'library'|null, clearDenied() => void }`. Возвращает адрес снимка в кэше — его отдают в `addAttachment` как `uri`.

- [ ] **Step 1: Поставить зависимость**

```bash
npx expo install expo-image-picker
```

Expected: в `package.json` появился `"expo-image-picker": "~16.1.4"`. Если версия иная — значит, `npx expo install` подобрал под SDK, это нормально; `npm install expo-image-picker` использовать нельзя.

- [ ] **Step 2: Написать падающий тест**

Создай `hooks/__tests__/usePhotoCapture.test.js`:

```javascript
/**
 * Съёмка снимка для точки
 *
 * Снимок делается системной камерой: она отдаёт вспышку, фокус, HDR и зум
 * бесплатно и в привычном виде. Галерея нужна не меньше — часть снимков
 * делают до того, как поставят точку.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///cache/IMG_0001.jpg' }],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///cache/IMG_0042.jpg' }],
  })),
}));

const ImagePicker = require('expo-image-picker');
const usePhotoCapture = require('../usePhotoCapture').default;
const { PHOTO_QUALITY } = require('../usePhotoCapture');

/** Поднимает хук и отдаёт его текущее значение */
function mountHook() {
  const box = {};
  function Probe() {
    box.current = usePhotoCapture();
    return <Text>probe</Text>;
  }
  let tree;
  act(() => {
    tree = renderer.create(<Probe />);
  });
  return { box, tree };
}

beforeEach(() => {
  jest.clearAllMocks();
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
});

test('камера возвращает адрес снимка', async () => {
  const { box } = mountHook();

  let uri;
  await act(async () => {
    uri = await box.current.capture('camera');
  });

  expect(uri).toBe('file:///cache/IMG_0001.jpg');
  expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
});

test('галерея открывается своим пикером', async () => {
  const { box } = mountHook();

  let uri;
  await act(async () => {
    uri = await box.current.capture('library');
  });

  expect(uri).toBe('file:///cache/IMG_0042.jpg');
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
});

test('снимок сжимается — иначе десяток точек съедает полгигабайта', async () => {
  const { box } = mountHook();

  await act(async () => {
    await box.current.capture('camera');
  });

  expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(
    expect.objectContaining({ quality: PHOTO_QUALITY, allowsEditing: false })
  );
  expect(PHOTO_QUALITY).toBeLessThan(1);
});

test('отказ в доступе к камере запоминается, а пикер не открывается', async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  const { box } = mountHook();

  let uri;
  await act(async () => {
    uri = await box.current.capture('camera');
  });

  expect(uri).toBeNull();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(box.current.denied).toBe('camera');
});

test('отмена съёмки ничего не возвращает', async () => {
  ImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });
  const { box } = mountHook();

  let uri;
  await act(async () => {
    uri = await box.current.capture('camera');
  });

  expect(uri).toBeNull();
  // Отмена — не отказ в доступе, плашку показывать не за что
  expect(box.current.denied).toBeNull();
});

test('удачная съёмка снимает прежнюю плашку отказа', async () => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
  const { box } = mountHook();
  await act(async () => {
    await box.current.capture('camera');
  });
  expect(box.current.denied).toBe('camera');

  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  await act(async () => {
    await box.current.capture('camera');
  });

  expect(box.current.denied).toBeNull();
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx jest hooks/__tests__/usePhotoCapture.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../usePhotoCapture'`

- [ ] **Step 4: Написать хук**

Создай `hooks/usePhotoCapture.js`:

```javascript
/**
 * Съёмка снимка для точки наблюдения
 *
 * Камера системная, а не своя на expo-camera: родное приложение отдаёт
 * вспышку, фокус, HDR и зум бесплатно и в том виде, к которому геолог привык.
 * Свой экран съёмки дал бы фирменный вид и подпись координат на кадре — ценой
 * заметно худшего снимка, а снимок здесь документальный.
 *
 * Галерея нужна наравне с камерой: часть снимков делают до того, как поставят
 * точку, и без неё их к точке не пришить.
 */

import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

/**
 * Сжатие снимка
 *
 * Кадр с современного телефона весит 3–5 МБ, и десяток точек за смену съедал
 * бы полгигабайта в песочнице приложения. На снимке оголовка скважины
 * разница между 0.6 и 1.0 не видна.
 */
export const PHOTO_QUALITY = 0.6;

/**
 * @returns {{capture: Function, denied: string|null, clearDenied: Function}}
 */
export default function usePhotoCapture() {
  // Какой доступ не выдан: показывается плашкой на месте, а не Alert.alert —
  // тот не показывает кнопок в веб-сборке
  const [denied, setDenied] = useState(null);

  /**
   * Открывает камеру или галерею
   *
   * @param {'camera'|'library'} source - откуда брать снимок
   * @returns {Promise<string|null>} адрес снимка или null, если отменили
   *   либо не выдали доступ
   */
  const capture = useCallback(async (source) => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setDenied(source);
      return null;
    }
    setDenied(null);

    const options = {
      // Массив, а не MediaTypeOptions: перечисление объявлено устаревшим
      mediaTypes: ['images'],
      quality: PHOTO_QUALITY,
      // Кадрировать документальный снимок скважины незачем
      allowsEditing: false,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return null;
    return result.assets?.[0]?.uri ?? null;
  }, []);

  const clearDenied = useCallback(() => setDenied(null), []);

  return { capture, denied, clearDenied };
}
```

- [ ] **Step 5: Убедиться, что тест проходит**

Run: `npx jest hooks/__tests__/usePhotoCapture.test.js --maxWorkers=2`
Expected: PASS, 6 тестов

- [ ] **Step 6: Прописать разрешения**

В `app.json`, в массив `expo.plugins`, после блока `expo-document-picker`:

```json
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow $(PRODUCT_NAME) to attach photos from your library to field diary points.",
          "cameraPermission": "Allow $(PRODUCT_NAME) to take photos of observation points."
        }
      ],
```

В `expo.android.permissions` добавь `"CAMERA"`.

- [ ] **Step 7: Проверить конфигурацию**

Run: `npx expo config --type prebuild > /dev/null && echo OK`
Expected: `OK` без ошибок разбора

- [ ] **Step 8: Коммит**

```bash
git add package.json package-lock.json app.json hooks/usePhotoCapture.js hooks/__tests__/usePhotoCapture.test.js
git commit -m "feat: съёмка фото для точки наблюдения"
```

---

### Task 7: Запись голосовой заметки

**Files:**
- Modify: `package.json` (через `npx expo install`)
- Modify: `app.json` (плагин `expo-audio`, право `RECORD_AUDIO`)
- Create: `hooks/useVoiceRecorder.js`
- Test: `hooks/__tests__/useVoiceRecorder.test.js`

**Interfaces:**
- Consumes: `levelFromMetering`, `condense` из `lib/waveform` (Task 3).
- Produces: `useVoiceRecorder()` → `{ start() => Promise<boolean>, stop() => Promise<{uri, durationMillis, waveform}|null>, isRecording: boolean, durationMillis: number, levels: number[], denied: boolean }`.

- [ ] **Step 1: Поставить зависимость**

```bash
npx expo install expo-audio
```

Expected: в `package.json` появился `"expo-audio": "~0.4.9"`.

- [ ] **Step 2: Написать падающий тест**

Создай `hooks/__tests__/useVoiceRecorder.test.js`:

```javascript
/**
 * Запись голосовой заметки
 *
 * Проверяется то, что нельзя увидеть глазами на устройстве: уровни копятся,
 * пока идёт запись, прореживаются при остановке, и микрофон отпускается —
 * иначе на iOS воспроизведение уходит в разговорный динамик.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

const recorder = {
  uri: 'file:///cache/recording.m4a',
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(() => {}),
  stop: jest.fn(async () => {}),
};

let recorderState = { isRecording: false, durationMillis: 0, metering: undefined };

jest.mock('expo-audio', () => ({
  AudioModule: { requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })) },
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioRecorder: jest.fn(() => recorder),
  useAudioRecorderState: jest.fn(() => recorderState),
}));

const { AudioModule, setAudioModeAsync } = require('expo-audio');
const useVoiceRecorder = require('../useVoiceRecorder').default;

function mountHook() {
  const box = {};
  function Probe() {
    box.current = useVoiceRecorder();
    return <Text>probe</Text>;
  }
  let tree;
  act(() => {
    tree = renderer.create(<Probe />);
  });
  return { box, tree };
}

beforeEach(() => {
  jest.clearAllMocks();
  recorderState = { isRecording: false, durationMillis: 0, metering: undefined };
  AudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
});

test('старт готовит рекордер и включает микрофон', async () => {
  const { box } = mountHook();

  let started;
  await act(async () => {
    started = await box.current.start();
  });

  expect(started).toBe(true);
  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: true })
  );
  expect(recorder.prepareToRecordAsync).toHaveBeenCalled();
  expect(recorder.record).toHaveBeenCalled();
});

test('без доступа к микрофону запись не начинается', async () => {
  AudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
  const { box } = mountHook();

  let started;
  await act(async () => {
    started = await box.current.start();
  });

  expect(started).toBe(false);
  expect(recorder.record).not.toHaveBeenCalled();
  expect(box.current.denied).toBe(true);
});

test('остановка отпускает микрофон', async () => {
  // С allowsRecording воспроизведение на iOS идёт тихо и через разговорный
  // динамик: записанное потом невозможно прослушать
  const { box } = mountHook();
  await act(async () => {
    await box.current.start();
  });
  setAudioModeAsync.mockClear();

  await act(async () => {
    await box.current.stop();
  });

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: false })
  );
});

test('остановка отдаёт адрес, длительность и волну', async () => {
  recorderState = { isRecording: false, durationMillis: 14_400, metering: undefined };
  const { box } = mountHook();
  await act(async () => {
    await box.current.start();
  });

  let recorded;
  await act(async () => {
    recorded = await box.current.stop();
  });

  expect(recorded.uri).toBe('file:///cache/recording.m4a');
  expect(recorded.durationMillis).toBe(14_400);
  expect(Array.isArray(recorded.waveform)).toBe(true);
});

test('рекордер без файла ничего не возвращает', async () => {
  recorder.uri = null;
  const { box } = mountHook();
  await act(async () => {
    await box.current.start();
  });

  let recorded;
  await act(async () => {
    recorded = await box.current.stop();
  });

  expect(recorded).toBeNull();
  recorder.uri = 'file:///cache/recording.m4a';
});
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npx jest hooks/__tests__/useVoiceRecorder.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../useVoiceRecorder'`

- [ ] **Step 4: Написать хук**

Создай `hooks/useVoiceRecorder.js`:

```javascript
/**
 * Запись голосовой заметки для точки наблюдения
 *
 * Тап начинает, второй тап останавливает. Удержание, как в мессенджерах,
 * здесь не годится: описание скважины диктуют минуту, и всё это время нужно
 * держать палец, а случайный отрыв в перчатках обрывает запись.
 *
 * Волна строится по реальному сигналу: рекордер отдаёт metering в дБFS, он
 * снимается раз в METER_INTERVAL_MS и переводится в 0..1 (см. lib/waveform.js).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { condense, levelFromMetering } from '../lib/waveform';

/** Как часто снимается уровень сигнала */
export const METER_INTERVAL_MS = 100;

/** Без isMeteringEnabled рекордер не отдаёт уровень, и волну рисовать нечем */
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/**
 * @returns {Object} состояние и управление записью
 */
export default function useVoiceRecorder() {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, METER_INTERVAL_MS);

  const [levels, setLevels] = useState([]);
  const [denied, setDenied] = useState(false);

  // Уровни нужны в stop, но не должны попадать в его зависимости: иначе
  // колбэк пересоздавался бы десять раз в секунду
  const levelsRef = useRef([]);
  levelsRef.current = levels;

  // Уровень копится, пока идёт запись. durationMillis в зависимостях
  // обязателен: metering может совпасть с прошлым значением два тика подряд,
  // и без него эффект бы не сработал, а в волне появился бы провал
  useEffect(() => {
    if (!state.isRecording) return;
    setLevels((prev) => [...prev, levelFromMetering(state.metering)]);
  }, [state.isRecording, state.metering, state.durationMillis]);

  /**
   * Начинает запись
   *
   * @returns {Promise<boolean>} началась ли запись
   */
  const start = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setDenied(true);
      return false;
    }
    setDenied(false);

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    setLevels([]);
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }, [recorder]);

  /**
   * Останавливает запись и отдаёт готовую заметку
   *
   * @returns {Promise<{uri: string, durationMillis: number, waveform: number[]}|null>}
   */
  const stop = useCallback(async () => {
    const durationMillis = Math.round(state.durationMillis ?? 0);
    const captured = levelsRef.current;

    await recorder.stop();
    // Микрофон отпускается сразу: пока allowsRecording включён, iOS выводит
    // звук тихо и через разговорный динамик, и записанное не прослушать
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

    setLevels([]);

    const uri = recorder.uri;
    if (!uri) return null;

    return { uri, durationMillis, waveform: condense(captured) };
  }, [recorder, state.durationMillis]);

  return {
    start,
    stop,
    isRecording: !!state.isRecording,
    durationMillis: state.durationMillis ?? 0,
    levels,
    denied,
  };
}
```

- [ ] **Step 5: Убедиться, что тест проходит**

Run: `npx jest hooks/__tests__/useVoiceRecorder.test.js --maxWorkers=2`
Expected: PASS, 5 тестов

- [ ] **Step 6: Прописать разрешения**

В `app.json`, в массив `expo.plugins`, после блока `expo-image-picker`:

```json
      [
        "expo-audio",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to record voice notes for field diary points."
        }
      ],
```

В `expo.android.permissions` добавь `"RECORD_AUDIO"`.

- [ ] **Step 7: Проверить конфигурацию**

Run: `npx expo config --type prebuild > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 8: Коммит**

```bash
git add package.json package-lock.json app.json hooks/useVoiceRecorder.js hooks/__tests__/useVoiceRecorder.test.js
git commit -m "feat: запись голосовой заметки для точки наблюдения"
```

---

### Task 8: Полноэкранный просмотр снимка

**Files:**
- Create: `components/PhotoViewer.js`
- Test: `components/__tests__/PhotoViewer.test.js`

**Interfaces:**
- Consumes: ключи `closePhoto`, `delete` из `Localization` (Task 4).
- Produces: `<PhotoViewer photos={Attachment[]} initialIndex={number} visible={boolean} onClose={fn} onDelete={(attachment) => void} />`.

- [ ] **Step 1: Написать падающий тест**

Создай `components/__tests__/PhotoViewer.test.js`:

```javascript
/**
 * Полноэкранный просмотр снимка
 *
 * Миниатюра в шторке показывает, что снимок есть, но не показывает, что на
 * нём: разглядеть по ней оголовок скважины нельзя.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';
import PhotoViewer from '../PhotoViewer';

const PHOTOS = [
  { id: 'a1', kind: 'photo', uri: 'file:///documents/attachments/a1.jpg' },
  { id: 'a2', kind: 'photo', uri: 'file:///documents/attachments/a2.jpg' },
];

beforeAll(() => {
  I18n.locale = 'ru';
});

const mount = (props) =>
  renderer.create(
    <PaperProvider theme={lightTheme}>
      <PhotoViewer
        photos={PHOTOS}
        initialIndex={0}
        visible
        onClose={() => {}}
        onDelete={() => {}}
        {...props}
      />
    </PaperProvider>
  );

/** Кнопка по её метке доступности */
const button = (tree, label) =>
  tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'button' &&
      node.props?.accessibilityLabel === label
  );

test('показывает все снимки — между ними свайпают', () => {
  const tree = mount();

  const images = tree.root.findAllByType(Image);
  expect(images.map((image) => image.props.source.uri)).toEqual([
    'file:///documents/attachments/a1.jpg',
    'file:///documents/attachments/a2.jpg',
  ]);
});

test('закрытие сообщает наружу', () => {
  const onClose = jest.fn();
  const tree = mount({ onClose });

  act(() => {
    button(tree, 'Закрыть снимок').props.onPress();
  });

  expect(onClose).toHaveBeenCalled();
});

test('удаление отдаёт наружу тот снимок, что открыт', () => {
  const onDelete = jest.fn();
  const tree = mount({ onDelete, initialIndex: 1 });

  act(() => {
    button(tree, 'Удалить').props.onPress();
  });

  expect(onDelete).toHaveBeenCalledWith(PHOTOS[1]);
});

test('пустой список не роняет просмотр', () => {
  // Последний снимок могли удалить, пока просмотр открыт
  const tree = mount({ photos: [] });

  expect(tree.root.findAllByType(Image)).toHaveLength(0);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest components/__tests__/PhotoViewer.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../PhotoViewer'`

- [ ] **Step 3: Написать компонент**

Создай `components/PhotoViewer.js`:

```javascript
/**
 * Полноэкранный просмотр снимков точки
 *
 * Миниатюра в шторке показывает, что снимок есть, но не показывает, что на
 * нём: разглядеть оголовок скважины на квадрате в палец нельзя.
 *
 * Фон чёрный, а не «бумажный» фон приложения: снимок должен читаться, а не
 * соревноваться с интерфейсом за внимание. Это единственное место, где
 * приложение отступает от своей палитры, и отступает намеренно.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import I18n from '../Localization';
import { spacing } from '../theme';

/**
 * @param {Object} props
 * @param {Array} props.photos - вложения вида photo
 * @param {number} props.initialIndex - какой снимок открыт первым
 * @param {boolean} props.visible - показан ли просмотр
 * @param {Function} props.onClose - закрытие
 * @param {Function} props.onDelete - удаление открытого снимка
 */
export default function PhotoViewer({ photos, initialIndex, visible, onClose, onDelete }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const scrollRef = useRef(null);

  // Открывать нужно тот снимок, по которому нажали, а не первый в ленте
  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  const current = photos[index] ?? null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
        >
          {photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.uri }}
              style={{ width, height }}
              resizeMode="contain"
            />
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.action, styles.close, { top: insets.top + spacing.md }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={I18n.t('closePhoto', { defaultValue: 'Закрыть снимок' })}
        >
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {!!current && (
          <TouchableOpacity
            style={[styles.action, styles.delete, { top: insets.top + spacing.md }]}
            onPress={() => onDelete(current)}
            accessibilityRole="button"
            accessibilityLabel={I18n.t('delete', { defaultValue: 'Удалить' })}
          >
            <MaterialIcons name="delete-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  action: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // Полупрозрачная подложка: на светлом снимке белая иконка без неё пропадает
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  close: {
    left: spacing.lg,
  },
  delete: {
    right: spacing.lg,
  },
});
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx jest components/__tests__/PhotoViewer.test.js --maxWorkers=2`
Expected: PASS, 4 теста

- [ ] **Step 5: Коммит**

```bash
git add components/PhotoViewer.js components/__tests__/PhotoViewer.test.js
git commit -m "feat: полноэкранный просмотр снимков точки"
```

---

### Task 9: Шторка вложений точки

**Files:**
- Create: `components/PointSheet.js`
- Test: `components/__tests__/PointSheet.test.js`

**Interfaces:**
- Consumes: `AudioWave` (Task 5), `PhotoViewer` (Task 8), `usePhotoCapture` (Task 6), `useVoiceRecorder` (Task 7), `formatDuration` (Task 3), `ATTACHMENT_KINDS` (Task 2), строки (Task 4).
- Produces: `<PointSheet point={Point|null} attachments={Attachment[]} visible={boolean} onClose={fn} onAdd={({kind, uri, durationMillis, waveform}) => Promise<void>} onDelete={(attachment) => Promise<void>} />`. Шторка сама ничего не пишет в базу — она сообщает наружу, что снято и что удалено.

- [ ] **Step 1: Написать падающий тест**

Создай `components/__tests__/PointSheet.test.js`:

```javascript
/**
 * Шторка вложений точки
 *
 * Всё содержимое вложений живёт здесь: дневник — плоский список, который
 * прокручивают целиком, и полоса миниатюр в каждой карточке превратила бы
 * его в ленту картинок.
 *
 * Шторка ничего не пишет в базу: она сообщает наружу, что снято и что
 * удалено, а запись остаётся за экраном.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';
import I18n from '../../Localization';

const capture = jest.fn(async () => 'file:///cache/IMG_0001.jpg');
jest.mock('../../hooks/usePhotoCapture', () => ({
  __esModule: true,
  default: () => ({ capture, denied: null, clearDenied: jest.fn() }),
  PHOTO_QUALITY: 0.6,
}));

const start = jest.fn(async () => true);
const stop = jest.fn(async () => ({
  uri: 'file:///cache/recording.m4a',
  durationMillis: 14_000,
  waveform: [0.2, 0.8],
}));
let recorder = { start, stop, isRecording: false, durationMillis: 0, levels: [], denied: false };
jest.mock('../../hooks/useVoiceRecorder', () => ({
  __esModule: true,
  default: () => recorder,
  METER_INTERVAL_MS: 100,
}));

// Кнопки ConfirmDialog не несут accessibilityLabel — искать их по метке
// нечем. Подменяем его строковым компонентом и читаем пропсы
jest.mock('../ui/ConfirmDialog', () => 'ConfirmDialog');
jest.mock('../PhotoViewer', () => 'PhotoViewer');

const PointSheet = require('../PointSheet').default;

const POINT = {
  id: 'p1',
  title: 'Скважина 3',
  type: 'well',
  lat: 55.7558,
  lon: 37.6173,
  recordedAt: 1_700_000_000_000,
};

const ATTACHMENTS = [
  { id: 'a1', pointId: 'p1', kind: 'photo', source: 'a1.jpg', uri: 'file:///d/a1.jpg', durationMillis: 0, waveform: [], recordedAt: 1 },
  { id: 'a2', pointId: 'p1', kind: 'audio', source: 'a2.m4a', uri: 'file:///d/a2.m4a', durationMillis: 14_000, waveform: [0.2, 0.8], recordedAt: 2 },
];

beforeAll(() => {
  I18n.locale = 'ru';
});

beforeEach(() => {
  jest.clearAllMocks();
  recorder = { start, stop, isRecording: false, durationMillis: 0, levels: [], denied: false };
});

const mount = (props) =>
  renderer.create(
    <PaperProvider theme={lightTheme}>
      <PointSheet
        point={POINT}
        attachments={ATTACHMENTS}
        visible
        onClose={() => {}}
        onAdd={async () => {}}
        onDelete={async () => {}}
        {...props}
      />
    </PaperProvider>
  );

const button = (tree, label) =>
  tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'button' &&
      node.props?.accessibilityLabel === label
  );

const buttons = (tree, label) =>
  tree.root.findAll(
    (node) =>
      node.props?.accessibilityRole === 'button' &&
      node.props?.accessibilityLabel === label
  );

const texts = (tree) =>
  tree.root
    .findAll((node) => typeof node.props?.children === 'string', { deep: true })
    .map((node) => node.props.children);

test('в шапке стоит название и координаты точки', () => {
  const tree = mount();

  expect(texts(tree)).toEqual(expect.arrayContaining(['Скважина 3', '55.7558, 37.6173']));
});

test('длительность записи выводится рядом с волной', () => {
  const tree = mount();

  expect(texts(tree)).toEqual(expect.arrayContaining(['0:14']));
});

test('снятое фото уходит наружу, а не пишется здесь', async () => {
  const onAdd = jest.fn(async () => {});
  const tree = mount({ onAdd });

  // «Фото» раскрывает выбор источника на месте кнопки, «Снять» — уже в нём
  await act(async () => {
    button(tree, 'Фото').props.onPress();
  });
  await act(async () => {
    button(tree, 'Снять').props.onPress();
  });

  expect(capture).toHaveBeenCalledWith('camera');
  expect(onAdd).toHaveBeenCalledWith({
    kind: 'photo',
    uri: 'file:///cache/IMG_0001.jpg',
  });
});

test('отменённая съёмка наружу ничего не отдаёт', async () => {
  capture.mockResolvedValueOnce(null);
  const onAdd = jest.fn(async () => {});
  const tree = mount({ onAdd });

  await act(async () => {
    button(tree, 'Фото').props.onPress();
  });
  await act(async () => {
    button(tree, 'Снять').props.onPress();
  });

  expect(onAdd).not.toHaveBeenCalled();
});

test('тап по «Запись» начинает запись', async () => {
  const tree = mount();

  await act(async () => {
    button(tree, 'Запись').props.onPress();
  });

  expect(start).toHaveBeenCalled();
});

test('во время записи кнопка сменяется живой строкой', () => {
  recorder = { ...recorder, isRecording: true, durationMillis: 7_000, levels: [0.3, 0.7] };
  const tree = mount();

  // Кнопки «Запись» больше нет — на её месте строка со «стоп»
  expect(buttons(tree, 'Запись')).toHaveLength(0);
  expect(buttons(tree, 'Остановить запись')).toHaveLength(1);
  expect(texts(tree)).toEqual(expect.arrayContaining(['0:07']));
});

test('остановка отдаёт запись наружу с волной и длительностью', async () => {
  recorder = { ...recorder, isRecording: true, durationMillis: 14_000, levels: [0.2, 0.8] };
  const onAdd = jest.fn(async () => {});
  const tree = mount({ onAdd });

  await act(async () => {
    button(tree, 'Остановить запись').props.onPress();
  });

  expect(onAdd).toHaveBeenCalledWith({
    kind: 'audio',
    uri: 'file:///cache/recording.m4a',
    durationMillis: 14_000,
    waveform: [0.2, 0.8],
  });
});

test('пустая шторка не несёт пояснительного текста', () => {
  const tree = mount({ attachments: [] });

  // Две кнопки внизу сами говорят, что делать
  expect(buttons(tree, 'Фото')).toHaveLength(1);
  expect(buttons(tree, 'Запись')).toHaveLength(1);
  expect(texts(tree)).not.toEqual(expect.arrayContaining([expect.stringContaining('Пока ничего')]));
});

test('удаление записи спрашивает подтверждение, а не стирает молча', async () => {
  const onDelete = jest.fn(async () => {});
  const tree = mount({ onDelete });

  expect(tree.root.findByType('ConfirmDialog').props.visible).toBe(false);

  await act(async () => {
    button(tree, 'Удалить запись').props.onPress();
  });

  expect(onDelete).not.toHaveBeenCalled();
  const dialog = tree.root.findByType('ConfirmDialog');
  expect(dialog.props.visible).toBe(true);
  expect(dialog.props.title).toBe('Удалить вложение?');
});

test('подтверждённое удаление уходит наружу', async () => {
  const onDelete = jest.fn(async () => {});
  const tree = mount({ onDelete });

  await act(async () => {
    button(tree, 'Удалить запись').props.onPress();
  });
  await act(async () => {
    await tree.root.findByType('ConfirmDialog').props.onConfirm();
  });

  expect(onDelete).toHaveBeenCalledWith(ATTACHMENTS[1]);
});

test('без точки шторка не показывается', () => {
  const tree = mount({ point: null });

  expect(buttons(tree, 'Фото')).toHaveLength(0);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest components/__tests__/PointSheet.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../PointSheet'`

- [ ] **Step 3: Написать компонент**

Создай `components/PointSheet.js`:

```javascript
/**
 * Шторка вложений точки наблюдения
 *
 * Всё содержимое вложений живёт здесь, а не в карточке списка: дневник — это
 * плоский список, который прокручивают целиком, и полоса миниатюр в каждой
 * карточке превратила бы его в ленту картинок. В списке остаётся счётчик.
 *
 * Шторка ничего не пишет в базу. Она сообщает наружу, что снято и что
 * удалено, — запись остаётся за экраном, который и так владеет списком точек.
 *
 * Механика та же, что у ConfirmDialog: Modal, нажатие мимо закрывает,
 * onRequestClose ловит аппаратную кнопку «назад».
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import I18n from '../Localization';
import AudioWave from './AudioWave';
import PhotoViewer from './PhotoViewer';
import ConfirmDialog from './ui/ConfirmDialog';
import usePhotoCapture from '../hooks/usePhotoCapture';
import useVoiceRecorder from '../hooks/useVoiceRecorder';
import { ATTACHMENT_KINDS } from '../db/attachments';
import { formatDuration } from '../lib/waveform';
import { spacing, radius, type, elevation, numericAt } from '../theme';

/** Миниатюр в ряду: на телефоне шире трёх они уже не читаются */
const COLUMNS = 3;

/**
 * @param {Object} props
 * @param {Object|null} props.point - точка, чьи вложения показаны
 * @param {Array} props.attachments - вложения этой точки
 * @param {boolean} props.visible - показана ли шторка
 * @param {Function} props.onClose - закрытие
 * @param {Function} props.onAdd - новое вложение: {kind, uri, durationMillis?, waveform?}
 * @param {Function} props.onDelete - удаление вложения
 */
export default function PointSheet({ point, attachments, visible, onClose, onAdd, onDelete }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { capture, denied: photoDenied } = usePhotoCapture();
  const recorder = useVoiceRecorder();

  // Выбор источника снимка: раскрывается на месте кнопки «Фото»
  const [pickingSource, setPickingSource] = useState(false);
  // Открытый на весь экран снимок
  const [viewerIndex, setViewerIndex] = useState(null);
  // Вложение, для которого запрошено удаление
  const [pendingDelete, setPendingDelete] = useState(null);

  const photos = attachments.filter((item) => item.kind === ATTACHMENT_KINDS.PHOTO);
  const records = attachments.filter((item) => item.kind === ATTACHMENT_KINDS.AUDIO);

  /**
   * Снимает или выбирает фото и отдаёт его наружу
   *
   * @param {'camera'|'library'} source - откуда брать снимок
   */
  const addPhoto = async (source) => {
    setPickingSource(false);
    const uri = await capture(source);
    if (!uri) return;
    await onAdd({ kind: ATTACHMENT_KINDS.PHOTO, uri });
  };

  /**
   * Начинает или останавливает запись
   */
  const toggleRecording = async () => {
    if (!recorder.isRecording) {
      await recorder.start();
      return;
    }

    const recorded = await recorder.stop();
    if (!recorded) return;
    await onAdd({
      kind: ATTACHMENT_KINDS.AUDIO,
      uri: recorded.uri,
      durationMillis: recorded.durationMillis,
      waveform: recorded.waveform,
    });
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    setViewerIndex(null);
    if (target) await onDelete(target);
  };

  const denialNotice =
    (photoDenied === 'camera' && I18n.t('cameraDenied')) ||
    (photoDenied === 'library' && I18n.t('galleryDenied')) ||
    (recorder.denied && I18n.t('microphoneDenied')) ||
    '';

  if (!point) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              elevation.raised,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, spacing.lg),
              },
            ]}
            onPress={() => {}}
          >
            {/* Полоска захвата: без неё шторка читается как приехавшая карточка,
                и неочевидно, что её закрывают движением вниз */}
            <View style={[styles.grip, { backgroundColor: colors.border }]} />

            <Text style={[type.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {point.title}
            </Text>
            <Text style={[styles.coords, { color: colors.textSecondary }]}>
              {Number(point.lat).toFixed(4)}, {Number(point.lon).toFixed(4)}
            </Text>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
            >
              {photos.length > 0 && (
                <View style={styles.grid}>
                  {photos.map((photo, index) => (
                    <TouchableOpacity
                      key={photo.id}
                      style={[styles.thumb, { backgroundColor: colors.thumb }]}
                      onPress={() => setViewerIndex(index)}
                      accessibilityRole="button"
                      accessibilityLabel={I18n.t('attachments')}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.thumbImage} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {records.map((record) => (
                <VoiceRow
                  key={record.id}
                  record={record}
                  colors={colors}
                  onDelete={() => setPendingDelete(record)}
                />
              ))}
            </ScrollView>

            {!!denialNotice && (
              <Text style={[type.caption, styles.notice, { color: colors.error }]}>
                {denialNotice}
              </Text>
            )}

            {recorder.isRecording ? (
              <View style={[styles.recordingRow, { borderColor: colors.error }]}>
                <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
                <AudioWave
                  levels={recorder.levels.slice(-40)}
                  progress={1}
                  color={colors.error}
                  mutedColor={colors.border}
                  height={24}
                  style={styles.recordingWave}
                />
                <Text style={[styles.duration, { color: colors.text }]}>
                  {formatDuration(recorder.durationMillis)}
                </Text>
                <TouchableOpacity
                  onPress={toggleRecording}
                  style={[styles.stopButton, { backgroundColor: colors.error }]}
                  accessibilityRole="button"
                  accessibilityLabel={I18n.t('stopRecording')}
                >
                  <MaterialIcons name="stop" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : pickingSource ? (
              <View style={styles.actions}>
                <SheetButton
                  icon="photo-camera"
                  label={I18n.t('photoFromCamera')}
                  colors={colors}
                  onPress={() => addPhoto('camera')}
                />
                <SheetButton
                  icon="photo-library"
                  label={I18n.t('photoFromLibrary')}
                  colors={colors}
                  onPress={() => addPhoto('library')}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <SheetButton
                  icon="photo-camera"
                  label={I18n.t('addPhoto')}
                  colors={colors}
                  onPress={() => setPickingSource(true)}
                />
                <SheetButton
                  icon="mic-none"
                  label={I18n.t('addVoiceNote')}
                  colors={colors}
                  onPress={toggleRecording}
                />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Просмотр и диалог — соседи шторки, а не её дети: вложенная в Modal
          вторая Modal на iOS показывается поверх первой через раз, и
          подтверждение удаления оставалось невидимым */}
      <PhotoViewer
        photos={photos}
        initialIndex={viewerIndex ?? 0}
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        onDelete={(photo) => setPendingDelete(photo)}
      />

      <ConfirmDialog
        visible={!!pendingDelete}
        title={I18n.t('deleteAttachment')}
        message={
          pendingDelete?.kind === ATTACHMENT_KINDS.PHOTO
            ? I18n.t('deletePhotoMessage')
            : I18n.t('deleteAttachmentMessage')
        }
        confirmLabel={I18n.t('delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

/**
 * Строка голосовой заметки
 *
 * Волна занимает всю доступную ширину, длительность прижата к правому краю
 * моноширинным: у нескольких записей подряд цифры выстраиваются столбиком.
 *
 * @param {Object} props
 * @param {Object} props.record - вложение вида audio
 * @param {Object} props.colors - палитра темы
 * @param {Function} props.onDelete - запрос удаления
 */
function VoiceRow({ record, colors, onDelete }) {
  return (
    <View style={[styles.voiceRow, { backgroundColor: colors.surfaceSunken }]}>
      <MaterialIcons name="play-arrow" size={22} color={colors.primaryAccent} />
      <AudioWave
        levels={record.waveform}
        progress={1}
        color={colors.primaryAccent}
        mutedColor={colors.border}
        height={24}
        style={styles.voiceWave}
      />
      <Text style={[styles.duration, { color: colors.textSecondary }]}>
        {formatDuration(record.durationMillis)}
      </Text>
      <TouchableOpacity
        onPress={onDelete}
        style={styles.voiceDelete}
        accessibilityRole="button"
        accessibilityLabel={`${I18n.t('delete')} ${I18n.t('addVoiceNote').toLowerCase()}`}
      >
        <MaterialIcons name="delete-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Кнопка действия внизу шторки
 *
 * @param {Object} props
 * @param {string} props.icon - имя значка MaterialIcons
 * @param {string} props.label - подпись, она же метка доступности
 * @param {Object} props.colors - палитра темы
 * @param {Function} props.onPress - нажатие
 */
function SheetButton({ icon, label, colors, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.action, { borderColor: colors.border }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialIcons name={icon} size={20} color={colors.primaryAccent} />
      <Text style={[styles.actionText, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 7, 14, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '80%',
  },
  grip: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  coords: {
    ...numericAt(12),
    marginTop: 2,
  },
  body: {
    marginTop: spacing.lg,
  },
  bodyContent: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    // Доля ширины уменьшена на промежутки между миниатюрами: ровно треть не
    // учитывает gap, и третья миниатюра переносится на новую строку
    flexBasis: `${100 / COLUMNS - 3}%`,
    flexGrow: 0,
    aspectRatio: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  voiceWave: {
    flex: 1,
  },
  voiceDelete: {
    padding: spacing.xs,
  },
  duration: {
    ...numericAt(12),
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingWave: {
    flex: 1,
  },
  stopButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  notice: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
```

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx jest components/__tests__/PointSheet.test.js --maxWorkers=2`
Expected: PASS, 11 тестов

- [ ] **Step 5: Коммит**

```bash
git add components/PointSheet.js components/__tests__/PointSheet.test.js
git commit -m "feat: шторка вложений точки"
```

---

### Task 10: Встраивание в полевой дневник

**Files:**
- Modify: `screens/FieldDiaryScreen.js`
- Test: `screens/__tests__/FieldDiaryScreen.test.js`

**Interfaces:**
- Consumes: `PointSheet` (Task 9), `listAttachments`, `addAttachment`, `deleteAttachment` (Task 2), строки (Task 4).
- Produces: конечная фича — ничего наружу не отдаёт.

- [ ] **Step 1: Написать падающий тест**

В `screens/__tests__/FieldDiaryScreen.test.js` добавь мок вложений рядом с существующим моком `../../db/points`:

```javascript
jest.mock('../../db/attachments', () => ({
  ATTACHMENT_KINDS: { PHOTO: 'photo', AUDIO: 'audio' },
  listAttachments: jest.fn(async () => ({
    p1: [
      { id: 'a1', pointId: 'p1', kind: 'photo', source: 'a1.jpg', uri: 'file:///d/a1.jpg', durationMillis: 0, waveform: [], recordedAt: 1 },
      { id: 'a2', pointId: 'p1', kind: 'photo', source: 'a2.jpg', uri: 'file:///d/a2.jpg', durationMillis: 0, waveform: [], recordedAt: 2 },
      { id: 'a3', pointId: 'p1', kind: 'audio', source: 'a3.m4a', uri: 'file:///d/a3.m4a', durationMillis: 14_000, waveform: [0.2], recordedAt: 3 },
    ],
  })),
  addAttachment: jest.fn(async () => ({ id: 'new' })),
  deleteAttachment: jest.fn(async () => {}),
}));
jest.mock('../../components/PointSheet', () => 'PointSheet');
```

И добавь тесты в конец файла:

```javascript
test('карточка точки показывает, сколько к ней прикреплено', async () => {
  const tree = await mount();

  const badge = tree.root.find(
    (node) => node.props?.accessibilityLabel === 'Вложения точки: Скважина 3'
  );

  // Два снимка и одна запись — счётчики раздельные: искать фото среди
  // записей и наоборот приходится по-разному
  expect(badge.props.accessibilityValue).toEqual({ text: '2 снимков, 1 записей' });
});

test('пустая точка всё равно открывает вложения', async () => {
  // Иначе первое вложение некуда добавить: шторку нечем вызвать
  const tree = await mount();

  expect(
    tree.root.find((node) => node.props?.accessibilityLabel === 'Вложения точки: Родник у брода')
  ).toBeDefined();
});

test('нажатие на бейдж открывает шторку этой точки', async () => {
  const tree = await mount();

  await act(async () => {
    tree.root
      .find((node) => node.props?.accessibilityLabel === 'Вложения точки: Скважина 3')
      .props.onPress();
  });

  const sheet = tree.root.findByType('PointSheet');
  expect(sheet.props.visible).toBe(true);
  expect(sheet.props.point.id).toBe('p1');
  expect(sheet.props.attachments).toHaveLength(3);
});

test('снятое в шторке пишется в базу и список перечитывается', async () => {
  const { listAttachments, addAttachment } = require('../../db/attachments');
  const tree = await mount();

  // Шторку надо открыть: вложение пишется той точке, чья шторка на экране
  await act(async () => {
    tree.root
      .find((node) => node.props?.accessibilityLabel === 'Вложения точки: Скважина 3')
      .props.onPress();
  });
  listAttachments.mockClear();

  await act(async () => {
    await tree.root
      .findByType('PointSheet')
      .props.onAdd({ kind: 'photo', uri: 'file:///cache/IMG_0001.jpg' });
  });

  expect(addAttachment).toHaveBeenCalledWith({
    pointId: 'p1',
    kind: 'photo',
    uri: 'file:///cache/IMG_0001.jpg',
  });
  // Без перечитывания счётчик в карточке остался бы прежним
  expect(listAttachments).toHaveBeenCalled();
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest screens/__tests__/FieldDiaryScreen.test.js --maxWorkers=2`
Expected: FAIL — бейдж с такой меткой не найден

- [ ] **Step 3: Подключить вложения к загрузке экрана**

В `screens/FieldDiaryScreen.js` добавь импорты к существующим:

```javascript
import PointSheet from '../components/PointSheet';
import {
  ATTACHMENT_KINDS,
  listAttachments,
  addAttachment,
  deleteAttachment,
} from '../db/attachments';
```

Рядом с состоянием `pendingDelete` добавь:

```javascript
  // Вложения всех точек: карта «точка → вложения». Читаются одним запросом
  // вместе со списком — запрос на точку дал бы столько обращений к базе,
  // сколько в дневнике точек
  const [attachments, setAttachments] = useState({});
  // Точка, чья шторка вложений открыта
  const [sheetPointId, setSheetPointId] = useState(null);
```

В `load` — после `setPoints(loaded)` и до `setStats`:

```javascript
    setAttachments(await listAttachments(loaded.map((point) => point.id)));
```

- [ ] **Step 4: Добавить бейдж в шапку карточки**

Замени целиком блок `<View style={styles.pointRow}> … </View>` внутри `points.map` — от открывающего тега до закрывающего. Поле описания под ним (`GrowingNoteInput`) и всё остальное в карточке не трогай:

```jsx
            <View style={styles.pointRow}>
              <View
                style={[
                  styles.pointDot,
                  { backgroundColor: pointTypeColors[point.type] ?? pointTypeColors.observation },
                ]}
              />
              <View style={styles.pointInfo}>
                <Text style={[type.body, { color: theme.colors.text }]} numberOfLines={1}>
                  {point.title}
                </Text>
                <Text style={[styles.pointCoords, { color: theme.colors.textSecondary }]}>
                  {formatCoordinate(point.lat)}, {formatCoordinate(point.lon)} · {formatTime(point.recordedAt)}
                </Text>
              </View>

              {/* Вложения. На пустой точке — одна контурная скрепка: без неё
                  шторку нечем открыть и первое вложение некуда добавить */}
              <TouchableOpacity
                onPress={() => setSheetPointId(point.id)}
                style={styles.pointBadge}
                accessibilityRole="button"
                accessibilityLabel={`${I18n.t('openAttachments', {
                  defaultValue: 'Вложения точки',
                })}: ${point.title}`}
                accessibilityValue={badgeValue(attachments[point.id])}
              >
                <PointBadge items={attachments[point.id]} colors={theme.colors} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDelete(point)}
                style={styles.pointDelete}
                accessibilityRole="button"
                accessibilityLabel={I18n.t('delete')}
              >
                <MaterialIcons name="delete-outline" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
```

- [ ] **Step 5: Добавить компонент бейджа и его подпись**

На уровне модуля, рядом с `GrowingNoteInput`:

```javascript
/**
 * Сколько снимков и записей у точки
 *
 * @param {Array} [items] - вложения точки
 * @returns {{photos: number, records: number}} счётчики
 */
function countAttachments(items = []) {
  return {
    photos: items.filter((item) => item.kind === ATTACHMENT_KINDS.PHOTO).length,
    records: items.filter((item) => item.kind === ATTACHMENT_KINDS.AUDIO).length,
  };
}

/**
 * Подпись бейджа для чтения с экрана
 *
 * Счётчики раздельные: искать снимок среди записей и наоборот приходится
 * по-разному, и «три вложения» не сказало бы, чего именно три.
 *
 * @param {Array} [items] - вложения точки
 * @returns {Object|undefined} значение для accessibilityValue
 */
function badgeValue(items) {
  const { photos, records } = countAttachments(items);
  if (photos === 0 && records === 0) return undefined;
  return {
    text: `${photos} ${I18n.t('photoCount', { defaultValue: 'снимков' })}, ${records} ${I18n.t(
      'voiceNoteCount',
      { defaultValue: 'записей' }
    )}`,
  };
}

/**
 * Бейдж вложений в шапке карточки точки
 *
 * @param {Object} props
 * @param {Array} [props.items] - вложения точки
 * @param {Object} props.colors - палитра темы
 */
function PointBadge({ items, colors }) {
  const { photos, records } = countAttachments(items);

  if (photos === 0 && records === 0) {
    return <MaterialIcons name="attach-file" size={18} color={colors.faint} />;
  }

  return (
    <View style={styles.badgeRow}>
      {photos > 0 && (
        <View style={styles.badgeItem}>
          <MaterialIcons name="photo-camera" size={15} color={colors.primaryAccent} />
          <Text style={[styles.badgeCount, { color: colors.primaryAccent }]}>{photos}</Text>
        </View>
      )}
      {records > 0 && (
        <View style={styles.badgeItem}>
          <MaterialIcons name="mic-none" size={15} color={colors.primaryAccent} />
          <Text style={[styles.badgeCount, { color: colors.primaryAccent }]}>{records}</Text>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 6: Добавить стили бейджа**

В `StyleSheet.create`, рядом с `pointDelete`:

```javascript
  pointBadge: {
    padding: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeCount: {
    ...numericAt(12),
    fontWeight: '600',
  },
```

- [ ] **Step 7: Подключить шторку**

Рядом с `<ConfirmDialog …>` в конце экрана:

```jsx
      <PointSheet
        point={points.find((item) => item.id === sheetPointId) ?? null}
        attachments={attachments[sheetPointId] ?? []}
        visible={sheetPointId !== null}
        onClose={() => setSheetPointId(null)}
        onAdd={handleAddAttachment}
        onDelete={handleDeleteAttachment}
      />
```

И обработчики рядом с `confirmDelete`:

```javascript
  /**
   * Записывает новое вложение открытой точки
   *
   * Список перечитывается целиком: без этого счётчик в карточке остался бы
   * прежним, и снятое выглядело бы потерянным
   *
   * @param {Object} attachment - {kind, uri, durationMillis?, waveform?}
   */
  const handleAddAttachment = async (attachment) => {
    if (!sheetPointId) return;
    await addAttachment({ pointId: sheetPointId, ...attachment });
    await load();
  };

  /**
   * Удаляет вложение вместе с файлом
   *
   * @param {Object} attachment - удаляемое вложение
   */
  const handleDeleteAttachment = async (attachment) => {
    await deleteAttachment(attachment.id);
    await load();
  };
```

- [ ] **Step 8: Убедиться, что тесты проходят**

Run: `npx jest screens/__tests__/FieldDiaryScreen.test.js --maxWorkers=2`
Expected: PASS — прежние 7 тестов и 4 новых

- [ ] **Step 9: Прогнать весь набор**

Run: `npx jest --maxWorkers=2`
Expected: PASS, всё зелёное

- [ ] **Step 10: Проверить в браузерном превью**

Подними веб-сборку и пройди сценарий целиком: карточка точки → бейдж → шторка → «Фото» → «Из галереи» → снимок виден миниатюрой → тап по миниатюре открывает просмотр → удаление уносит миниатюру. Пикеры на вебе не кликаются напрямую — веди страницу через `javascript_tool`.

Проверь консоль на ошибки: `read_console_messages` с `onlyErrors: true`.

- [ ] **Step 11: Коммит**

```bash
git add screens/FieldDiaryScreen.js screens/__tests__/FieldDiaryScreen.test.js
git commit -m "feat: вложения в карточке точки полевого дневника"
```

---

## Проверка после всех задач

- [ ] `npx jest --maxWorkers=2` — весь набор зелёный
- [ ] `npx expo config --type prebuild > /dev/null` — конфигурация разбирается
- [ ] `git log --oneline` — десять коммитов фичи поверх спеки
- [ ] Сценарий в браузерном превью пройден без ошибок в консоли
