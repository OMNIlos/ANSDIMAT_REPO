# Четыре полевые правки — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Починить ввод дробного ΔP в поинтервальном нагнетании, сделать сбой записи голосовой заметки видимым, убрать вкладку «Утечки» и добавить вкладку «Пересчёт Q» первой в калькуляторе.

**Architecture:** Четыре независимые правки, каждая в своих файлах. Ввод ΔP чинится расширением уже существующего механизма черновиков `useParamFields` в `OfrTestShell.js` на вложенные поля ступеней — новой сущности не заводится. Пересчёт расхода повторяет устройство вкладки «Пересчёт k»: чистая математика в `calc/units.js`, экран в `screens/calculator/`.

**Tech Stack:** React Native 0.79 / Expo SDK 53, `react-native-paper`, `i18n-js`, Jest + `jest-expo`, `react-test-renderer`.

## Global Constraints

- **Язык кода и комментариев — русский**, как во всём проекте: JSDoc над каждой экспортируемой функцией и компонентом, комментарий объясняет *почему*, а не *что*.
- **Jest гонять с `--maxWorkers=2`.** При полном параллелизме набор флакает чужими таймаутами.
- **`Localization.js` не терпит дублей ключей**: одноимённый ключ ниже молча перетирает верхний. Каждая задача, добавляющая ключи, заканчивается проверкой на дубли (шаг приведён в задаче).
- **Базовая единица расхода — м³/сут**, фактор переводит ИЗ базовой В целевую: `значение_в_единице = значение_в_базовой × factor`. Та же конвенция, что у `FILTRATION_UNITS`.
- **Плотность по умолчанию — 1000 кг/м³**, как в настольном АНСДИМАТ.
- **Числа сверены с настольной версией** и приведены в задаче 2 таблицей; отклонение больше 1e-6 относительных — ошибка, а не округление.
- Рабочее дерево ветки `feat/point-attachments` содержит незакоммиченную работу по графикам ОФР. Коммиты этого плана добавляются поверх; `git add` — только перечисленные в задаче файлы, `git commit -a` не использовать.

---

### Task 1: Удаление вкладки «Утечки»

Вкладка `leakage` считает пласт с перетеканием по Хантушу–Джейкобу. Ровно эта схема уже есть в «Прогнозе понижения» (`SCHEMES[1]`, `wellSchemeHantush`). Убираем дубль.

**Files:**
- Delete: `screens/calculator/LeakageTab.js`
- Modify: `screens/CalculatorScreen.js` (шапка-комментарий, импорт на строке 48, `TABS` на строке 60)
- Modify: `Localization.js` (ключ `tabLeakage` в обеих локалях: строки 736 и 2440)
- Test: `screens/calculator/__tests__/CalculatorScreen.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `TABS` в `screens/CalculatorScreen.js` — массив из шести записей вида `{ key, labelKey, Component }`, первая `filtration`. Задача 4 вставит седьмую первой.

**`calc/leakage.js` не трогать.** `hantushWellFunction` оттуда нужна `calc/wellDrawdown.js` — то есть прогнозу понижения. Остальные экспорты остаются без вызовов из приложения, но покрыты тестами и описывают физику; их чистка — не эта задача.

- [ ] **Step 1: Написать падающий тест**

`screens/calculator/__tests__/CalculatorScreen.test.js` выбирает вкладки **по порядковому номеру** (`selectTab(tree, 3)` — приток, `4` — ЗСО, `2` — прогноз). «Утечки» стоят последними, номером 6, поэтому номера остальных вкладок эта задача не двигает — меняются только счёт и длина перебора.

В `describe('CalculatorScreen', …)`:

1. Заменить счёт вкладок:

```js
  it('открывается и показывает все шесть вкладок', () => {
    const tree = renderScreen();
    expect(tabButtons(tree).length).toBe(6);
  });
```

2. Укоротить перебор вкладок — было `[0, 1, 2, 3, 4, 5, 6]`:

```js
  [0, 1, 2, 3, 4, 5].forEach((index) => {
```

3. Дописать в конец того же `describe`:

```js
  it('вкладки «Утечки» нет: перетекание считает прогноз понижения', () => {
    // Схема Хантуша–Джейкоба живёт переключателем в «Прогнозе понижения»
    // рядом с Тейсом, Болтоном и границей питания. Отдельная вкладка
    // дублировала ввод и уводила от сравнения схем
    expect(screenText(renderScreen())).not.toContain('Утечки');
  });
```

Подпись строкой, а не через `I18n.t('tabLeakage')`: ключ в этой же задаче удаляется, и обращение к нему вернуло бы имя ключа, отчего проверка прошла бы при любом исходе.

Тесты `selectTab(tree, 3)`, `selectTab(tree, 4)` и `selectTab(tree, 2)` не трогать — их вкладки на местах.

- [ ] **Step 2: Убедиться, что тест падает**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest screens/calculator/__tests__/CalculatorScreen.test.js --maxWorkers=2 -t 'Утечки'
```

Ожидание: FAIL — на экране есть «Утечки».

- [ ] **Step 3: Удалить вкладку**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && rm screens/calculator/LeakageTab.js
```

В `screens/CalculatorScreen.js` удалить строку импорта:

```js
import LeakageTab from './calculator/LeakageTab';
```

и строку в `TABS`:

```js
  { key: 'leakage', labelKey: 'tabLeakage', Component: LeakageTab },
```

В шапке-комментарии того же файла удалить седьмой пункт перечня:

```
 * 7. Инфильтрационные утечки — пласт с перетеканием (Хантуш — Джейкоб).
```

- [ ] **Step 4: Удалить ключи локализации**

В `Localization.js` удалить строку `tabLeakage: "Утечки",` (около строки 736) и `tabLeakage: "Leakage",` (около строки 2440).

- [ ] **Step 5: Проверить, что ключ нигде не остался**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && grep -rn "tabLeakage\|LeakageTab" --include="*.js" . --exclude-dir=node_modules
```

Ожидание: пусто.

- [ ] **Step 6: Прогнать тесты калькулятора**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest screens/calculator --maxWorkers=2
```

Ожидание: PASS, включая существующий проход по всем вкладкам.

- [ ] **Step 7: Коммит**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && git add screens/CalculatorScreen.js screens/calculator/LeakageTab.js screens/calculator/__tests__/CalculatorScreen.test.js Localization.js && git commit -m "$(cat <<'EOF'
feat: убрать вкладку «Утечки» из калькулятора

Пласт с перетеканием по Хантушу–Джейкобу уже считает «Прогноз
понижения» — там эта схема стоит переключателем рядом с Тейсом,
Болтоном и границей питания. Отдельная вкладка дублировала ввод.

calc/leakage.js остаётся: hantushWellFunction нужна прогнозу.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Единицы расхода в `calc/units.js`

Чистая математика пересчёта расхода: 29 единиц тремя группами, массовые зависят от плотности.

**Files:**
- Modify: `calc/units.js` (константы вверху файла; новый блок в конце, после `convertToAllUnits`)
- Create: `calc/__tests__/units.test.js`

**Interfaces:**
- Consumes: существующие константы `FT_PER_M`, `GAL_PER_M3` из `calc/units.js`.
- Produces:
  - `DEFAULT_DENSITY: number` — 1000
  - `FLOW_GROUPS: Array<{labelKey: string, units: Array<{key: string, labelKey: string, factor: number, mass?: boolean}>}>`
  - `FLOW_UNITS: Array<{key, labelKey, factor, mass?}>` — все единицы одним списком, порядок групп сохранён
  - `getFlowUnit(key: string): Object|undefined`
  - `flowToBase(value: number, unitKey: string, density?: number): number` — в м³/сут
  - `flowFromBase(valueM3Day: number, unitKey: string, density?: number): number`
  - `convertFlowToAllUnits(value: number, unitKey: string, density?: number): Array<{key: string, labelKey: string, value: number}>`

- [ ] **Step 1: Написать падающий тест**

Создать `calc/__tests__/units.test.js`:

```js
/**
 * Пересчёт единиц расхода
 *
 * Контрольные значения сняты с вкладки «Расход» диалога «Пересчёт единиц
 * измерения» настольного АНСДИМАТ при 1 м³/сут и плотности 1000 кг/м³.
 * Сверка идёт по всем 29 единицам: ошибка в одном факторе не ловится
 * ничем, кроме этой таблицы, — число просто выходит не тем.
 */

import {
  DEFAULT_DENSITY,
  FLOW_GROUPS,
  FLOW_UNITS,
  convertFlowToAllUnits,
  flowFromBase,
  flowToBase,
  getFlowUnit,
} from '../units';

/** Значения одного кубометра в сутки во всех единицах при ρ = 1000 кг/м³ */
const DESKTOP = {
  m3_day: 1,
  m3_hour: 4.166667e-2,
  m3_min: 6.944445e-4,
  m3_sec: 1.157407e-5,
  l_day: 1000,
  l_hour: 41.66667,
  l_min: 0.6944444,
  l_sec: 1.157407e-2,
  kg_day: 1000,
  kg_hour: 41.66667,
  kg_min: 0.6944444,
  kg_sec: 1.157407e-2,
  bbl_day: 8.386415,
  bbl_hour: 0.3494339,
  bbl_min: 5.823899e-3,
  bbl_sec: 9.706498e-5,
  ft3_day: 35.31467,
  ft3_hour: 1.471444,
  ft3_min: 2.452407e-2,
  ft3_sec: 4.087346e-4,
  gal_day: 264.1721,
  gal_hour: 11.00717,
  gal_min: 0.1834528,
  gal_sec: 3.057547e-3,
  oil_bbl_day: 6.289811,
  oil_bbl_hour: 0.2620755,
  oil_bbl_min: 4.367924e-3,
  oil_bbl_sec: 7.279874e-5,
  acre_ft_day: 8.107132e-4,
};

test('единиц ровно 29 и группы их не теряют', () => {
  expect(FLOW_UNITS).toHaveLength(29);
  expect(FLOW_GROUPS.flatMap((group) => group.units)).toEqual(FLOW_UNITS);
  expect(FLOW_UNITS.map((unit) => unit.key)).toEqual(Object.keys(DESKTOP));
});

test('кубометр в сутки раскладывается по всем единицам как в настольной версии', () => {
  // Сверка относительная, а не абсолютная: настольная версия печатает семь
  // значащих цифр, и её «41.66667» отличается от точного 1000/24 на 3.3e-6.
  // toBeCloseTo меряет абсолютную разницу и на больших числах требовал бы
  // точности, которой в исходных значениях просто нет
  const converted = convertFlowToAllUnits(1, 'm3_day', DEFAULT_DENSITY);
  for (const row of converted) {
    const expected = DESKTOP[row.key];
    expect(Math.abs(row.value - expected) / expected).toBeLessThan(1e-6);
  }
});

test('пересчёт обратим по каждой единице', () => {
  for (const unit of FLOW_UNITS) {
    const there = flowFromBase(1, unit.key, DEFAULT_DENSITY);
    expect(flowToBase(there, unit.key, DEFAULT_DENSITY)).toBeCloseTo(1, 9);
  }
});

test('ввод в чужой единице приводится к базовой', () => {
  // 264.1721 галлона в сутки — это ровно кубометр в сутки
  expect(flowToBase(264.1720523581, 'gal_day')).toBeCloseTo(1, 9);
  expect(flowToBase(41.66667, 'kg_hour')).toBeCloseTo(1, 5);
});

test('плотность двигает только массовые единицы', () => {
  const dense = convertFlowToAllUnits(1, 'm3_day', 1200);
  const byKey = Object.fromEntries(dense.map((row) => [row.key, row.value]));

  expect(byKey.kg_day).toBeCloseTo(1200, 6);
  expect(byKey.kg_hour).toBeCloseTo(50, 6);
  // Объёмные единицы плотности не знают
  expect(byKey.l_day).toBeCloseTo(1000, 6);
  expect(byKey.gal_day).toBeCloseTo(264.1721, 4);
});

test('массовый расход пересчитывается в объёмный через плотность', () => {
  // 1200 кг/сут при ρ = 1200 — это кубометр в сутки
  expect(flowToBase(1200, 'kg_day', 1200)).toBeCloseTo(1, 9);
});

test('непригодная плотность не роняет пересчёт, а гасит массовые единицы', () => {
  const rows = convertFlowToAllUnits(1, 'm3_day', 0);
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  expect(Number.isNaN(byKey.kg_day)).toBe(true);
  // Объёмные считаются как ни в чём не бывало: плотность им не нужна
  expect(byKey.l_day).toBeCloseTo(1000, 6);
});

test('неизвестная единица и нечисло дают NaN, а не исключение', () => {
  expect(getFlowUnit('parrot')).toBeUndefined();
  expect(Number.isNaN(flowToBase(1, 'parrot'))).toBe(true);
  expect(Number.isNaN(flowFromBase(1, 'parrot'))).toBe(true);
  expect(convertFlowToAllUnits(Number.NaN, 'm3_day').every((row) => Number.isNaN(row.value))).toBe(true);
});

test('у каждой единицы есть ключ локализации', () => {
  for (const unit of FLOW_UNITS) {
    expect(typeof unit.labelKey).toBe('string');
    expect(unit.labelKey.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Убедиться, что тест падает**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest calc/__tests__/units.test.js --maxWorkers=2
```

Ожидание: FAIL — `FLOW_UNITS` не экспортируется.

- [ ] **Step 3: Добавить константы**

В `calc/units.js`, рядом с существующими константами вверху файла (после `const CUFT_PER_CUM = ...`), добавить:

```js
/**
 * Американских галлонов в жидкостном барреле
 *
 * Тот баррель, что в настольном АНСДИМАТ подписан просто «баррель».
 * Нефтяной больше — см. GAL_PER_OIL_BARREL, — и путать их нельзя:
 * расхождение в треть.
 */
const GAL_PER_BARREL = 31.5;
/** Американских галлонов в нефтяном барреле — «баррель(н)» */
const GAL_PER_OIL_BARREL = 42;
/** Кубометров в акр-футе */
const CUM_PER_ACRE_FT = 1233.48183754752;

/** Плотность воды по умолчанию, кг/м³ — как в настольном АНСДИМАТ */
export const DEFAULT_DENSITY = 1000;
```

- [ ] **Step 4: Добавить единицы и пересчёт**

В конец `calc/units.js`, после `convertToAllUnits`, добавить:

```js
/**
 * Единицы расхода для вкладки-конвертера, тремя группами
 *
 * Повторяют вкладку «Расход» диалога «Пересчёт единиц измерения» настольного
 * АНСДИМАТ. Группы — не украшение: двадцать девять строк подряд не
 * прочитываются, а массовые единицы вдобавок ведут себя иначе остальных.
 *
 * Базовая единица — м³/сут, фактор переводит из базовой в целевую. У массовых
 * единиц фактор дан для плотности 1 кг/м³ и домножается на неё в flowFactor:
 * так таблица остаётся таблицей чисел, а не набором функций.
 */
export const FLOW_GROUPS = [
  {
    labelKey: 'flowGroupMetric',
    units: [
      { key: 'm3_day', labelKey: 'flowUnitM3Day', factor: 1 },
      { key: 'm3_hour', labelKey: 'flowUnitM3Hour', factor: 1 / 24 },
      { key: 'm3_min', labelKey: 'flowUnitM3Min', factor: 1 / MIN_PER_DAY },
      { key: 'm3_sec', labelKey: 'flowUnitM3Sec', factor: 1 / SEC_PER_DAY },
      { key: 'l_day', labelKey: 'flowUnitLDay', factor: L_PER_M3 },
      { key: 'l_hour', labelKey: 'flowUnitLHour', factor: L_PER_M3 / 24 },
      { key: 'l_min', labelKey: 'flowUnitLMin', factor: L_PER_M3 / MIN_PER_DAY },
      { key: 'l_sec', labelKey: 'flowUnitLSec', factor: L_PER_M3 / SEC_PER_DAY },
    ],
  },
  {
    labelKey: 'flowGroupMass',
    units: [
      { key: 'kg_day', labelKey: 'flowUnitKgDay', factor: 1, mass: true },
      { key: 'kg_hour', labelKey: 'flowUnitKgHour', factor: 1 / 24, mass: true },
      { key: 'kg_min', labelKey: 'flowUnitKgMin', factor: 1 / MIN_PER_DAY, mass: true },
      { key: 'kg_sec', labelKey: 'flowUnitKgSec', factor: 1 / SEC_PER_DAY, mass: true },
    ],
  },
  {
    labelKey: 'flowGroupImperial',
    units: [
      { key: 'bbl_day', labelKey: 'flowUnitBblDay', factor: GAL_PER_M3 / GAL_PER_BARREL },
      { key: 'bbl_hour', labelKey: 'flowUnitBblHour', factor: GAL_PER_M3 / GAL_PER_BARREL / 24 },
      { key: 'bbl_min', labelKey: 'flowUnitBblMin', factor: GAL_PER_M3 / GAL_PER_BARREL / MIN_PER_DAY },
      { key: 'bbl_sec', labelKey: 'flowUnitBblSec', factor: GAL_PER_M3 / GAL_PER_BARREL / SEC_PER_DAY },
      { key: 'ft3_day', labelKey: 'flowUnitFt3Day', factor: CUFT_PER_CUM },
      { key: 'ft3_hour', labelKey: 'flowUnitFt3Hour', factor: CUFT_PER_CUM / 24 },
      { key: 'ft3_min', labelKey: 'flowUnitFt3Min', factor: CUFT_PER_CUM / MIN_PER_DAY },
      { key: 'ft3_sec', labelKey: 'flowUnitFt3Sec', factor: CUFT_PER_CUM / SEC_PER_DAY },
      { key: 'gal_day', labelKey: 'flowUnitGalDay', factor: GAL_PER_M3 },
      { key: 'gal_hour', labelKey: 'flowUnitGalHour', factor: GAL_PER_M3 / 24 },
      { key: 'gal_min', labelKey: 'flowUnitGalMin', factor: GAL_PER_M3 / MIN_PER_DAY },
      { key: 'gal_sec', labelKey: 'flowUnitGalSec', factor: GAL_PER_M3 / SEC_PER_DAY },
      { key: 'oil_bbl_day', labelKey: 'flowUnitOilBblDay', factor: GAL_PER_M3 / GAL_PER_OIL_BARREL },
      { key: 'oil_bbl_hour', labelKey: 'flowUnitOilBblHour', factor: GAL_PER_M3 / GAL_PER_OIL_BARREL / 24 },
      { key: 'oil_bbl_min', labelKey: 'flowUnitOilBblMin', factor: GAL_PER_M3 / GAL_PER_OIL_BARREL / MIN_PER_DAY },
      { key: 'oil_bbl_sec', labelKey: 'flowUnitOilBblSec', factor: GAL_PER_M3 / GAL_PER_OIL_BARREL / SEC_PER_DAY },
      { key: 'acre_ft_day', labelKey: 'flowUnitAcreFtDay', factor: 1 / CUM_PER_ACRE_FT },
    ],
  },
];

/** Все единицы расхода одним списком, в порядке групп */
export const FLOW_UNITS = FLOW_GROUPS.flatMap((group) => group.units);

/**
 * Находит единицу расхода по ключу
 *
 * @param {string} key - ключ единицы
 * @returns {Object|undefined} описание единицы
 */
export function getFlowUnit(key) {
  return FLOW_UNITS.find((unit) => unit.key === key);
}

/**
 * Множитель перевода из м³/сут в единицу при заданной плотности
 *
 * Массовые единицы — единственные, кому плотность нужна. Непригодная
 * плотность гасит их в NaN, а не подставляет тысячу молча: массовый расход,
 * посчитанный по выдуманной плотности, выглядит как настоящий.
 *
 * @param {Object} unit - описание единицы
 * @param {number} density - плотность, кг/м³
 * @returns {number} множитель; NaN, если единице нужна непригодная плотность
 */
function flowFactor(unit, density) {
  if (!unit.mass) return unit.factor;
  if (!isFinite(density) || density <= 0) return NaN;
  return unit.factor * density;
}

/**
 * Переводит расход из указанной единицы в м³/сут
 *
 * @param {number} value - значение в исходной единице
 * @param {string} unitKey - ключ исходной единицы
 * @param {number} [density] - плотность, кг/м³
 * @returns {number} значение в м³/сут; NaN при неизвестной единице
 */
export function flowToBase(value, unitKey, density = DEFAULT_DENSITY) {
  const unit = getFlowUnit(unitKey);
  if (!unit || !isFinite(value)) return NaN;
  const factor = flowFactor(unit, density);
  return isFinite(factor) ? value / factor : NaN;
}

/**
 * Переводит расход из м³/сут в указанную единицу
 *
 * @param {number} valueM3Day - значение в м³/сут
 * @param {string} unitKey - ключ целевой единицы
 * @param {number} [density] - плотность, кг/м³
 * @returns {number} значение в целевой единице; NaN при неизвестной единице
 */
export function flowFromBase(valueM3Day, unitKey, density = DEFAULT_DENSITY) {
  const unit = getFlowUnit(unitKey);
  if (!unit || !isFinite(valueM3Day)) return NaN;
  const factor = flowFactor(unit, density);
  return isFinite(factor) ? valueM3Day * factor : NaN;
}

/**
 * Пересчитывает расход по всем единицам сразу
 *
 * Ввод в массовой единице при непригодной плотности обнуляет весь пересчёт:
 * привести килограммы к кубометрам без плотности нечем.
 *
 * @param {number} value - введённое значение
 * @param {string} unitKey - ключ единицы введённого значения
 * @param {number} [density] - плотность, кг/м³
 * @returns {Array<{key: string, labelKey: string, value: number}>} значения по всем единицам
 */
export function convertFlowToAllUnits(value, unitKey, density = DEFAULT_DENSITY) {
  const base = flowToBase(value, unitKey, density);
  return FLOW_UNITS.map((unit) => ({
    key: unit.key,
    labelKey: unit.labelKey,
    value: flowFromBase(base, unit.key, density),
  }));
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest calc/__tests__/units.test.js --maxWorkers=2
```

Ожидание: PASS, все девять тестов.

- [ ] **Step 6: Убедиться, что старые пересчёты не задеты**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest db share calc --maxWorkers=2
```

Ожидание: PASS. `db/__tests__/params.test.js` и `share/__tests__/projectFile.test.js` опираются на `BASE_UNITS` и `isKnownUnit`; новые экспорты их не касаются, и это надо увидеть, а не предположить.

- [ ] **Step 7: Коммит**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && git add calc/units.js calc/__tests__/units.test.js && git commit -m "$(cat <<'EOF'
feat: единицы расхода для пересчёта

Двадцать девять единиц тремя группами, как на вкладке «Расход»
настольного АНСДИМАТ: метрические, массовые и британские с
американскими. Массовые считаются через плотность, объёмные её
не знают.

Значения сверены с настольной версией при 1 м³/сут и ρ = 1000.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Подписи вкладки «Пересчёт Q»

Отдельной задачей, потому что 35 ключей в двух локалях — самостоятельный повод для проверки на дубли, а экран без подписей не собрать.

**Files:**
- Modify: `Localization.js` (русский блок — сразу после `unitMeinzer: "мейнцер",`, около строки 784; английский — после `unitMeinzer: "meinzer",`, около строки 2489)

**Interfaces:**
- Consumes: ничего.
- Produces: ключи `tabFlow`, `flowGroupMetric`, `flowGroupMass`, `flowGroupImperial`, `flowDensity`, `unitKgM3`, `flowUnitPickHint` и 29 ключей `flowUnit*`, перечисленных в `FLOW_GROUPS` (задача 2).

- [ ] **Step 1: Добавить русские подписи**

В `Localization.js` после строки `unitMeinzer: "мейнцер",` вставить:

```js

    // ===== КАЛЬКУЛЯТОР: пересчёт расхода =====
    // Подписи свои, а не общие с настройками размерностей: там пять единиц
    // расхода и сокращения «м³/ч», здесь двадцать девять и «м³/час» —
    // в столбце из двадцати девяти строк разнобой сокращений мешает читать
    flowGroupMetric: "Метрические",
    flowGroupMass: "Массовый расход",
    flowGroupImperial: "Британские и американские",
    flowDensity: "Плотность",
    unitKgM3: "кг/м³",
    flowUnitPickHint: "Нажмите строку, чтобы вводить в этой единице",

    flowUnitM3Day: "м³/сут",
    flowUnitM3Hour: "м³/час",
    flowUnitM3Min: "м³/мин",
    flowUnitM3Sec: "м³/сек",
    flowUnitLDay: "л/сут",
    flowUnitLHour: "л/час",
    flowUnitLMin: "л/мин",
    flowUnitLSec: "л/сек",
    flowUnitKgDay: "кг/сут",
    flowUnitKgHour: "кг/час",
    flowUnitKgMin: "кг/мин",
    flowUnitKgSec: "кг/сек",
    flowUnitBblDay: "баррель/сут",
    flowUnitBblHour: "баррель/час",
    flowUnitBblMin: "баррель/мин",
    flowUnitBblSec: "баррель/сек",
    flowUnitFt3Day: "фут³/сут",
    flowUnitFt3Hour: "фут³/час",
    flowUnitFt3Min: "фут³/мин",
    flowUnitFt3Sec: "фут³/сек",
    flowUnitGalDay: "галлон/сут",
    flowUnitGalHour: "галлон/час",
    flowUnitGalMin: "галлон/мин",
    flowUnitGalSec: "галлон/сек",
    flowUnitOilBblDay: "баррель(н)/сут",
    flowUnitOilBblHour: "баррель(н)/час",
    flowUnitOilBblMin: "баррель(н)/мин",
    flowUnitOilBblSec: "баррель(н)/сек",
    flowUnitAcreFtDay: "акр-фут/сут",
```

- [ ] **Step 2: Добавить название вкладки в русский блок**

В том же файле найти `tabFiltration: "Пересчёт k",` (около строки 422) и вставить строкой выше:

```js
    tabFlow: "Пересчёт Q",
```

- [ ] **Step 3: Добавить английские подписи**

После строки `unitMeinzer: "meinzer",` (около строки 2489) вставить:

```js

    // ===== CALCULATOR: flow rate conversion =====
    flowGroupMetric: "Metric",
    flowGroupMass: "Mass flow",
    flowGroupImperial: "Imperial and US",
    flowDensity: "Density",
    unitKgM3: "kg/m³",
    flowUnitPickHint: "Tap a row to enter the value in that unit",

    flowUnitM3Day: "m³/day",
    flowUnitM3Hour: "m³/hour",
    flowUnitM3Min: "m³/min",
    flowUnitM3Sec: "m³/sec",
    flowUnitLDay: "L/day",
    flowUnitLHour: "L/hour",
    flowUnitLMin: "L/min",
    flowUnitLSec: "L/sec",
    flowUnitKgDay: "kg/day",
    flowUnitKgHour: "kg/hour",
    flowUnitKgMin: "kg/min",
    flowUnitKgSec: "kg/sec",
    flowUnitBblDay: "bbl/day",
    flowUnitBblHour: "bbl/hour",
    flowUnitBblMin: "bbl/min",
    flowUnitBblSec: "bbl/sec",
    flowUnitFt3Day: "ft³/day",
    flowUnitFt3Hour: "ft³/hour",
    flowUnitFt3Min: "ft³/min",
    flowUnitFt3Sec: "ft³/sec",
    flowUnitGalDay: "gal/day",
    flowUnitGalHour: "gal/hour",
    flowUnitGalMin: "gal/min",
    flowUnitGalSec: "gal/sec",
    flowUnitOilBblDay: "oil bbl/day",
    flowUnitOilBblHour: "oil bbl/hour",
    flowUnitOilBblMin: "oil bbl/min",
    flowUnitOilBblSec: "oil bbl/sec",
    flowUnitAcreFtDay: "acre-ft/day",
```

- [ ] **Step 4: Добавить название вкладки в английский блок**

Найти `tabFiltration: "Convert k",` (около строки 2128) и вставить строкой выше:

```js
    tabFlow: "Convert Q",
```

- [ ] **Step 5: Проверить, что дублей ключей не появилось**

Одноимённый ключ ниже молча перетирает верхний, и новая подпись просто не покажется. Проверка по AST, а не грепом: греп не видит, в каком объекте лежит ключ.

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && node -e "
const fs = require('fs');
const parser = require('@babel/core');
const ast = parser.parseSync(fs.readFileSync('Localization.js', 'utf8'), { filename: 'Localization.js', presets: [] });
let bad = 0;
const walk = (node) => {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'ObjectExpression') {
    const seen = new Map();
    for (const prop of node.properties) {
      const name = prop.key && (prop.key.name || prop.key.value);
      if (!name) continue;
      if (seen.has(name)) {
        console.log('дубль:', name, '— строки', seen.get(name), 'и', prop.loc.start.line);
        bad++;
      }
      seen.set(name, prop.loc.start.line);
    }
  }
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) child.forEach(walk);
    else if (child && typeof child.type === 'string') walk(child);
  }
};
walk(ast.program);
console.log(bad === 0 ? 'дублей нет' : 'дублей: ' + bad);
process.exit(bad === 0 ? 0 : 1);
"
```

Ожидание: `дублей нет`. Если скрипт сообщает о дубле — переименовать новый ключ, а не удалять старый.

- [ ] **Step 6: Проверить, что обе локали получили один набор ключей**

`Localization.js` — ES-модуль, из-под голого `node` он не грузится, поэтому счёт по файлу. Каждый из 29 ключей `flowUnit*` обязан встретиться ровно дважды — по разу на локаль:

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && for key in flowUnitM3Day flowUnitM3Hour flowUnitM3Min flowUnitM3Sec flowUnitLDay flowUnitLHour flowUnitLMin flowUnitLSec flowUnitKgDay flowUnitKgHour flowUnitKgMin flowUnitKgSec flowUnitBblDay flowUnitBblHour flowUnitBblMin flowUnitBblSec flowUnitFt3Day flowUnitFt3Hour flowUnitFt3Min flowUnitFt3Sec flowUnitGalDay flowUnitGalHour flowUnitGalMin flowUnitGalSec flowUnitOilBblDay flowUnitOilBblHour flowUnitOilBblMin flowUnitOilBblSec flowUnitAcreFtDay tabFlow flowGroupMetric flowGroupMass flowGroupImperial flowDensity unitKgM3 flowUnitPickHint; do
  n=$(grep -c "^\s*${key}:" Localization.js)
  [ "$n" = "2" ] || echo "$key: $n (ожидалось 2)"
done; echo "проверено"
```

Ожидание: единственная строка `проверено`. Любая строка с числом — ключ забыт в одной из локалей или задвоен в одной.

Ключи `flowUnitM3Day` и `flowUnitM3Hour` — префиксы `flowUnitM3Min`/`flowUnitM3Sec` не задевают: `grep -c "^\s*ключ:"` требует двоеточия сразу за именем.

- [ ] **Step 7: Коммит**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && git add Localization.js && git commit -m "$(cat <<'EOF'
feat: подписи вкладки «Пересчёт Q»

Двадцать девять единиц расхода, три группы, плотность и подсказка
о выборе единицы нажатием — в обеих локалях.

Ключи свои, не общие с настройками размерностей: там пять единиц
и сокращение «м³/ч», здесь двадцать девять и «м³/час».

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Вкладка «Пересчёт Q»

**Files:**
- Create: `screens/calculator/FlowTab.js`
- Modify: `screens/CalculatorScreen.js` (шапка-комментарий, импорты, `TABS`)
- Test: `screens/calculator/__tests__/FlowTab.test.js`

**Interfaces:**
- Consumes: `DEFAULT_DENSITY`, `FLOW_GROUPS`, `convertFlowToAllUnits` из `calc/units.js` (задача 2); ключи локализации из задачи 3; `Card`, `Field`, `Note`, `SectionLabel`, `parseNumber`, `formatValue`, `styles as shared` из `screens/calculator/shared.js`; `AppearIn` из `components/ui/AppearIn`.
- Produces: `export default function FlowTab()` — без пропсов, как `FiltrationTab`. `TABS` в `screens/CalculatorScreen.js` становится массивом из семи записей, первая — `{ key: 'flow', labelKey: 'tabFlow', Component: FlowTab }`.

Строки списка отрисовываются `Pressable` с `accessibilityRole="button"` и `accessibilityState={{ selected }}` — по ним тест и находит строку.

- [ ] **Step 1: Написать падающий тест**

Создать `screens/calculator/__tests__/FlowTab.test.js`:

```js
/**
 * Вкладка «Пересчёт Q»
 *
 * Расчёт покрыт в `calc/__tests__/units.test.js`; здесь важно другое —
 * доходит ли посчитанное до экрана, слушается ли плотность и переносится ли
 * ввод на строку, по которой нажали. Выбор единицы нажатием по строке, а не
 * рядом чипов: двадцать девять чипов заняли бы восемь строк экрана.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import { UnitsProvider } from '../../../UnitsContext';
import I18n from '../../../Localization';

jest.mock('../../../db/settings', () => ({
  getSettings: () => Promise.resolve({}),
  setSetting: () => Promise.resolve(),
}));

const FlowTab = require('../FlowTab').default;

beforeAll(() => {
  I18n.locale = 'ru';
});

// React 19: renderer.create() надо оборачивать в act(), иначе тест-рендерер
// считается размонтированным ещё до первой проверки
const mount = () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <UnitsProvider>
          <FlowTab />
        </UnitsProvider>
      </PaperProvider>
    );
  });
  return tree;
};

/**
 * Весь текст поддерева одной строкой
 *
 * Работает и от корня, и от отдельного узла: findAll есть у обоих, а вот
 * toJSON — только у рендерера, и обходить сериализацию строки списка нечем
 *
 * @param {Object} node - корень рендерера или узел дерева
 * @returns {string} склеенный текст
 */
const textIn = (node) =>
  (node.root ?? node)
    .findAll((item) => typeof item.props?.children === 'string', { deep: true })
    .map((item) => item.props.children)
    .join(' ');

/** Весь текст экрана одной строкой */
const screenText = (tree) => textIn(tree);

/** Крупное поле ввода значения */
const valueInput = (tree) =>
  tree.root.findAll(
    (node) => node.props?.testID === 'flow-value' && typeof node.props?.onChangeText === 'function',
    { deep: true }
  )[0];

/** Строка пересчёта по ключу единицы */
const row = (tree, key) =>
  tree.root.findAll(
    (node) => node.props?.testID === `flow-row-${key}` && typeof node.props?.onPress === 'function',
    { deep: true }
  )[0];

/** Значение в строке пересчёта */
const rowValue = (tree, key) => textIn(row(tree, key));

test('показывает все двадцать девять единиц и названия групп', () => {
  const text = screenText(mount());
  expect(text).toContain(I18n.t('flowGroupMetric'));
  expect(text).toContain(I18n.t('flowGroupMass'));
  expect(text).toContain(I18n.t('flowGroupImperial'));
  expect(text).toContain(I18n.t('flowUnitAcreFtDay'));
  expect(text).toContain(I18n.t('flowUnitOilBblSec'));
});

test('кубометр в сутки раскладывается по единицам', () => {
  const tree = mount();
  act(() => {
    valueInput(tree).props.onChangeText('1');
  });
  expect(rowValue(tree, 'l_day')).toContain('1000');
  expect(rowValue(tree, 'gal_day')).toContain('264.17');
  expect(rowValue(tree, 'kg_day')).toContain('1000');
});

test('дробное значение вводится через запятую', () => {
  const tree = mount();
  act(() => {
    valueInput(tree).props.onChangeText('0,5');
  });
  // Поле показывает набранное, а не пересобранное из числа
  expect(valueInput(tree).props.value).toBe('0,5');
  expect(rowValue(tree, 'l_day')).toContain('500');
});

test('нажатие на строку переносит ввод в эту единицу', () => {
  const tree = mount();
  act(() => {
    valueInput(tree).props.onChangeText('1');
  });
  act(() => {
    row(tree, 'l_day').props.onPress();
  });

  // Нажатие означает «дальше считаем отсюда», а не «начни сначала»:
  // в поле встаёт то самое значение, что стояло в строке
  expect(valueInput(tree).props.value).toBe('1000');
  expect(row(tree, 'l_day').props.accessibilityState.selected).toBe(true);
  // Кубометр в сутки на месте: пересчёт от смены единицы ввода не поехал
  expect(rowValue(tree, 'm3_day')).toContain('1.000');
});

test('плотность двигает только массовые единицы', () => {
  const tree = mount();
  act(() => {
    valueInput(tree).props.onChangeText('1');
  });
  const litersBefore = rowValue(tree, 'l_day');

  const density = tree.root.findAll(
    (node) => node.props?.symbol === 'ρ' && typeof node.props?.onChange === 'function',
    { deep: true }
  )[0];
  act(() => {
    density.props.onChange('1200');
  });

  expect(rowValue(tree, 'kg_day')).toContain('1200');
  expect(rowValue(tree, 'l_day')).toBe(litersBefore);
});

test('подсказывает, что единица выбирается нажатием', () => {
  expect(screenText(mount())).toContain(I18n.t('flowUnitPickHint'));
});
```

- [ ] **Step 2: Убедиться, что тест падает**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest screens/calculator/__tests__/FlowTab.test.js --maxWorkers=2
```

Ожидание: FAIL — `Cannot find module '../FlowTab'`.

- [ ] **Step 3: Написать вкладку**

Создать `screens/calculator/FlowTab.js`:

```js
/**
 * Вкладка «Пересчёт Q»
 *
 * Пересчёт расхода сразу по всем размерностям. Повторяет вкладку «Расход»
 * диалога «Пересчёт единиц измерения» настольного АНСДИМАТ: в поле приходит
 * дебит из чужого отчёта — в галлонах в минуту, в баррелях, в литрах в
 * секунду, — и его надо привести к тем единицам, в которых считает проект.
 *
 * Устроена как «Пересчёт k», с одним отличием: единицу ввода выбирают
 * нажатием по строке, а не рядом чипов сверху. Двадцать девять чипов
 * переносятся в восемь строк и съедают экран до того, как покажется первое
 * значение; на девяти единицах фильтрации приём работает, здесь — нет.
 *
 * Плотность нужна только массовому расходу: килограммы в сутки — это
 * кубометры, помноженные на неё. Остальные двадцать пять единиц её не знают.
 *
 * Математика — в [`calc/units.js`](../../calc/units.js).
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Platform, Pressable, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { DEFAULT_DENSITY, FLOW_GROUPS, FLOW_UNITS, convertFlowToAllUnits } from '../../calc/units';
import AppearIn from '../../components/ui/AppearIn';
import { type, spacing, fontFamily } from '../../theme';
import { Card, Field, Note, SectionLabel, parseNumber, formatValue, styles as shared } from './shared';

export default function FlowTab() {
  const theme = useTheme();

  const [value, setValue] = useState('100');
  const [unit, setUnit] = useState('m3_day');
  const [density, setDensity] = useState(String(DEFAULT_DENSITY));

  const converted = convertFlowToAllUnits(
    parseNumber(value),
    unit,
    parseNumber(density)
  );
  const byKey = Object.fromEntries(converted.map((row) => [row.key, row.value]));
  const activeLabel = I18n.t(
    FLOW_UNITS.find((item) => item.key === unit)?.labelKey ?? 'flowUnitM3Day'
  );

  /**
   * Переносит ввод в единицу нажатой строки
   *
   * Значение поля становится тем, что в этой строке и стоит: нажатие
   * означает «дальше считаем отсюда», а не «начни сначала».
   *
   * @param {string} key - ключ единицы
   */
  const pickUnit = (key) => {
    if (key === unit) return;
    const shown = byKey[key];
    setUnit(key);
    setValue(isFinite(shown) ? String(Number(shown.toPrecision(6))) : '');
  };

  return (
    <>
      <AppearIn index={0}>
        <Card>
          <View style={styles.hero}>
            <Text style={[type.eyebrow, { color: theme.colors.faint }]}>
              {I18n.t('value', { defaultValue: 'Значение' })}
            </Text>
            <View style={styles.heroRow}>
              <TextInput
                testID="flow-value"
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={theme.colors.faint}
                selectionColor={theme.colors.primary}
                style={[shared.bigInput, styles.heroInput, { color: theme.colors.text }]}
              />
              <Text style={[styles.heroUnit, { color: theme.colors.faint }]}>{activeLabel}</Text>
            </View>
          </View>
          <View style={[styles.densityBox, { borderTopColor: theme.colors.border }]}>
            <Field
              label={I18n.t('flowDensity')}
              symbol="ρ"
              value={density}
              onChange={setDensity}
              unit={I18n.t('unitKgM3')}
            />
          </View>
        </Card>
      </AppearIn>

      <AppearIn index={1}>
        <Note>{I18n.t('flowUnitPickHint')}</Note>
      </AppearIn>

      {FLOW_GROUPS.map((group, groupIndex) => (
        <AppearIn key={group.labelKey} index={groupIndex + 2}>
          <SectionLabel>{I18n.t(group.labelKey)}</SectionLabel>
          <Card style={shared.listCard}>
            {group.units.map((item, index) => {
              const selected = item.key === unit;
              return (
                <Pressable
                  key={item.key}
                  testID={`flow-row-${item.key}`}
                  onPress={() => pickUnit(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={I18n.t(item.labelKey)}
                  style={[
                    shared.convertRow,
                    styles.convertRow,
                    index > 0
                      ? {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: theme.colors.border,
                        }
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.convertLabel,
                      { color: selected ? theme.colors.primaryAccent : theme.colors.textSecondary },
                    ]}
                  >
                    {I18n.t(item.labelKey)}
                  </Text>
                  <Text
                    style={[
                      shared.convertValue,
                      { color: selected ? theme.colors.primaryAccent : theme.colors.text },
                    ]}
                  >
                    {formatValue(byKey[item.key])}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        </AppearIn>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  heroInput: {
    flex: 1,
    minWidth: 0,
    // Значение прижато к размерности справа, как на «Пересчёте k» и во всех
    // строках списка: при выключке влево между числом и «м³/сут» зияла бы
    // дыра в треть экрана, и строка читалась бы как незаполненная
    textAlign: 'right',
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  heroUnit: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
  },
  // Плотность отбита от значения линией: она не такое же исходное данное,
  // а поправка, которая нужна четырём строкам из двадцати девяти
  densityBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  convertRow: {
    paddingHorizontal: 0,
  },
  convertLabel: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
});
```

- [ ] **Step 4: Убедиться, что тесты вкладки проходят**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest screens/calculator/__tests__/FlowTab.test.js --maxWorkers=2
```

Ожидание: PASS, все шесть тестов.

- [ ] **Step 5: Поставить вкладку первой**

В `screens/CalculatorScreen.js` добавить импорт рядом с остальными вкладками:

```js
import FlowTab from './calculator/FlowTab';
```

и первой строкой в `TABS`:

```js
  { key: 'flow', labelKey: 'tabFlow', Component: FlowTab },
```

Начальную вкладку сменить на новую — она первая в ряду, и открываться должна она:

```js
  const [tab, setTab] = useState('flow');
```

В шапке-комментарии файла перенумеровать перечень, вставив первым пунктом:

```
 * 1. Пересчёт расхода — значение по всем размерностям сразу.
```

и сдвинув остальные номера (бывший 1 «Коэффициент фильтрации» становится 2 и так далее до 6 «Барраж»).

- [ ] **Step 6: Поправить тест экрана под новый порядок вкладок**

Новая вкладка встала **первой**, и все порядковые номера в `screens/calculator/__tests__/CalculatorScreen.test.js` сдвинулись на единицу. Не поправить их — значит проверять не те вкладки, причём тесты при этом пройдут: соседняя вкладка тоже что-то рисует.

1. Вернуть счёт вкладок к семи:

```js
  it('открывается и показывает все семь вкладок', () => {
    const tree = renderScreen();
    expect(tabButtons(tree).length).toBe(7);
  });
```

2. Вернуть длину перебора — было `[0, 1, 2, 3, 4, 5]`:

```js
  [0, 1, 2, 3, 4, 5, 6].forEach((index) => {
```

3. Сдвинуть номера в трёх расчётных тестах и в тёмной теме:

- «вкладка притока считает и показывает результат»: `selectTab(tree, 3)` → `selectTab(tree, 4)`
- «вкладка ЗСО считает пояса по примеру веб-версии»: `selectTab(tree, 4)` → `selectTab(tree, 5)`
- «вкладка прогноза считает понижение по Тейсу»: `selectTab(tree, 2)` → `selectTab(tree, 3)`
- «экран работает и в тёмной теме»: `selectTab(tree, 4)` → `selectTab(tree, 5)`

Контрольные числа в этих тестах (`2697`, `547`, `4.65`) не трогать — расчёты не менялись.

4. Дописать в конец `describe`:

```js
  it('пересчёт расхода стоит первой вкладкой и открыт при входе', () => {
    const tree = renderScreen();
    // Самый востребованный расчёт в поле: дебит из чужого отчёта приводят
    // к своим единицам чаще, чем считают что бы то ни было ещё
    const first = collectText(tabButtons(tree)[0].props.children).join(' ');
    expect(first).toContain(I18n.t('tabFlow'));
    // Открыт сразу: содержимое вкладки на экране без единого нажатия
    expect(screenText(tree)).toContain(I18n.t('flowGroupMetric'));
  });
```

`collectText`, `tabButtons`, `renderScreen` и `screenText` уже объявлены в этом файле. `I18n` импортирован в задаче 1; если импорта нет — добавить `import I18n from '../../../Localization';`.

- [ ] **Step 7: Прогнать тесты калькулятора целиком**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest screens/calculator calc/__tests__/units.test.js --maxWorkers=2
```

Ожидание: PASS. Существующий проход по всем вкладкам обязан отрисовать и новую.

- [ ] **Step 8: Коммит**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && git add screens/calculator/FlowTab.js screens/calculator/__tests__/FlowTab.test.js screens/calculator/__tests__/CalculatorScreen.test.js screens/CalculatorScreen.js && git commit -m "$(cat <<'EOF'
feat: вкладка «Пересчёт Q» первой в калькуляторе

Двадцать девять единиц расхода тремя группами, как на вкладке
«Расход» настольного АНСДИМАТ, с полем плотности для массовых.

Единица ввода выбирается нажатием по строке: двадцать девять чипов
сверху заняли бы восемь строк экрана до первого значения.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Дробное значение в ΔP и показаниях расходомера

Поля ступени хранят **число**, а текст пересобирают из него на каждый рендер. Промежуточная строка такого круга не переживает: `"1,"` возвращается как `"1"`, а `"0,"` — как `""`, потому что ноль в `show` значит «поля нет». Отсюда и невозможность ввести `0,5`.

Механизм черновиков для этого в проекте уже есть — `useParamFields` в `OfrTestShell.js`, — но он работает по плоскому ключу `params[key]` и до вложенных `params.stages[i]` не достаёт. Расширяем его, а не заводим второй.

**Files:**
- Modify: `screens/PumpingTestProcessing/OfrTestShell.js` (`useParamFields`, около строк 146–210)
- Modify: `screens/PumpingTestProcessing/LugeonScreen.js` (`StageCard` около строк 93–200; `show`, `setPressure`, `setReading`, `removeStage`, `pressureText`, `readingText` около строк 322–410; отрисовка `StageCard` около строки 588)
- Test: `screens/PumpingTestProcessing/__tests__/OfrTestScreens.test.js`

**Interfaces:**
- Consumes: `useParamFields(params, setParams, fromBase, toBase)` из `OfrTestShell.js`.
- Produces: `useParamFields` возвращает, дополнительно к прежним `{ text, change, editing, forget }`, ещё два поля:
  - `draftOr(key: string, ready: string): string` — набранный текст, если поле правят, иначе готовое значение;
  - `draftChange(key: string, onValue: (value: number|null) => void): (input: string) => void` — обработчик `onChangeText`; `onValue` получает разобранное число **в размерности пользователя** (перевод в базовую — на вызывающем) или `null`, когда поле пусто.

  `StageCard` меняет контракт двух пропсов: `onPressure: (text: string) => void` вместо `(index, text)`, `onReading: (position: number) => (text: string) => void` вместо `(index, position, text)`. Оба поля получают `testID`: `lugeon-pressure-${index}` и `lugeon-reading-${index}-${position}`.

- [ ] **Step 1: Написать падающие тесты**

В `screens/PumpingTestProcessing/__tests__/OfrTestScreens.test.js` внутри `describe('Поинтервальное нагнетание', ...)` дописать перед закрывающей скобкой блока:

```js
  /**
   * Поле по testID
   *
   * По testID, а не по подписи: подпись «Давление ΔP» одна на пять ступеней
   */
  const input = (tree, testID) =>
    tree.root.findAll(
      (node) =>
        node.props?.testID === testID && typeof node.props?.onChangeText === 'function',
      { deep: true }
    )[0];

  test('в давление ступени вводится значение меньше единицы', async () => {
    // Ноль в базе значит «не задано», и первый же символ «0,» обнулял поле:
    // значение меньше единицы было не набрать в принципе
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-pressure-0').props.onChangeText('0,');
    });
    expect(input(tree, 'lugeon-pressure-0').props.value).toBe('0,');

    await act(async () => {
      input(tree, 'lugeon-pressure-0').props.onChangeText('0,5');
    });
    expect(input(tree, 'lugeon-pressure-0').props.value).toBe('0,5');
  });

  test('разделитель в давлении не съедается', async () => {
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-pressure-1').props.onChangeText('1,');
    });
    expect(input(tree, 'lugeon-pressure-1').props.value).toBe('1,');

    await act(async () => {
      input(tree, 'lugeon-pressure-1').props.onChangeText('1,3');
    });
    expect(input(tree, 'lugeon-pressure-1').props.value).toBe('1,3');
  });

  test('набранное давление доходит до расчёта', async () => {
    const tree = await mount(LugeonScreen);
    // Контрольный средний параметр Люжона исходных ступеней
    expect(screenText(tree)).toContain('4.918');

    await act(async () => {
      input(tree, 'lugeon-pressure-0').props.onChangeText('0,5');
    });
    // Давление первой ступени упало впятеро — среднее обязано измениться
    expect(screenText(tree)).not.toContain('4.918');
  });

  test('в показание расходомера вводится дробное значение', async () => {
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-reading-0-0').props.onChangeText('8,');
    });
    expect(input(tree, 'lugeon-reading-0-0').props.value).toBe('8,');

    await act(async () => {
      input(tree, 'lugeon-reading-0-0').props.onChangeText('8,84');
    });
    expect(input(tree, 'lugeon-reading-0-0').props.value).toBe('8,84');
  });

  test('стёртое показание остаётся пропуском, а не нулём', async () => {
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-reading-0-3').props.onChangeText('');
    });
    expect(input(tree, 'lugeon-reading-0-3').props.value).toBe('');
    // Ноль на расходомере означал бы обнуление прибора, а не пропуск отсчёта:
    // расчёт по-прежнему берёт крайние достоверные отсчёты
    expect(screenText(tree)).not.toContain(I18n.t('lugeonReadingsFalling'));
  });

  test('удаление ступени не переносит набранное на соседнюю', async () => {
    const tree = await mount(LugeonScreen);
    await act(async () => {
      input(tree, 'lugeon-pressure-4').props.onChangeText('9,');
    });

    // Крестик ступени — Pressable с одной меткой доступности, без роли:
    // отбираем по обработчику, первый в списке относится к первой ступени
    const remove = tree.root.findAll(
      (node) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === I18n.t('lugeonRemoveStage'),
      { deep: true }
    )[0];
    await act(async () => {
      remove.props.onPress();
    });

    // Черновики привязаны к номеру ступени: после удаления первой номера
    // съезжают, и набранный текст пятой ступени оказался бы в четвёртой
    expect(input(tree, 'lugeon-pressure-3').props.value).not.toBe('9,');
  });
```

- [ ] **Step 2: Убедиться, что тесты падают**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest screens/PumpingTestProcessing --maxWorkers=2 -t 'Поинтервальное нагнетание'
```

Ожидание: FAIL — поля не находятся, `testID` ещё нет.

- [ ] **Step 3: Расширить `useParamFields`**

В `screens/PumpingTestProcessing/OfrTestShell.js` перед `return { text, change, editing, forget };` добавить:

```js
  /**
   * Набранный текст поля, если его правят, иначе готовое значение
   *
   * Нужно полям, число которых лежит не в `params` по ключу, а глубже —
   * в ступенях поинтервального нагнетания. Круг «текст → число → текст» у них
   * тот же самый, и спасает от него тот же черновик: без него «0,» уходило
   * в ноль и возвращалось пустотой, а значение меньше единицы было не набрать.
   *
   * @param {string} key - ключ черновика, уникальный в пределах экрана
   * @param {string} ready - что показать, когда поле не правят
   * @returns {string} текст поля
   */
  const draftOr = useCallback(
    (key, ready) => (drafts[key] !== undefined ? drafts[key] : ready),
    [drafts]
  );

  /**
   * Обработчик правки поля, число которого лежит глубже `params`
   *
   * Число отдаётся наружу в размерности пользователя: куда его писать и как
   * переводить в базовую, знает экран, а не обвязка. Пустое поле отдаётся
   * как `null` — «не задано» и «ноль» на разных экранах значат разное.
   *
   * @param {string} key - ключ черновика
   * @param {Function} onValue - (value: number|null) => void
   * @returns {Function} обработчик onChangeText
   */
  const draftChange = useCallback(
    (key, onValue) => (input) => {
      setDrafts((previous) => ({ ...previous, [key]: input }));
      const normalized = String(input).replace(',', '.').trim();
      if (normalized === '') {
        onValue(null);
        return;
      }
      const parsed = Number(normalized);
      // Незаконченный ввод — «1,» разбирается в 1, «-» ни во что — оставляем
      // в поле как есть и в набор величин не пишем
      if (!isFinite(parsed)) return;
      onValue(parsed);
    },
    []
  );

  return { text, change, editing, forget, draftOr, draftChange };
```

и удалить прежнюю строку `return { text, change, editing, forget };`.

В JSDoc самого `useParamFields` дополнить `@returns`:

```js
 * @returns {{text: Function, change: Function, editing: Function,
 *   forget: Function, draftOr: Function, draftChange: Function}} чтение поля,
 *   запись, признак незаконченного ввода, сброс набранного текста и та же
 *   пара для полей, лежащих глубже `params`
```

- [ ] **Step 4: Перевести поля ступени на черновики**

В `screens/PumpingTestProcessing/LugeonScreen.js`.

Сначала — `StageCard`. Заменить `onChangeText` у поля давления:

```js
        <TextInput
          testID={`lugeon-pressure-${index}`}
          value={pressureText}
          onChangeText={onPressure}
```

и у поля показания:

```js
            <TextInput
              testID={`lugeon-reading-${index}-${position}`}
              value={readingText(position)}
              onChangeText={onReading(position)}
```

Дальше — экран. Заменить `setPressure` и `setReading` так, чтобы они принимали число, а не текст:

```js
  /**
   * Пишет давление ступени
   *
   * Принимает число в размерности пользователя, а не текст: разбор строки
   * лежит на черновике в `useParamFields`, здесь остаётся перевод в базовую
   * единицу. Пустое поле — ноль: ступень без давления не задана.
   *
   * @param {number} index - номер ступени
   * @param {number|null} value - давление в размерности пользователя
   */
  const setPressure = useCallback(
    (index, value) => {
      const base = value === null ? 0 : toBase(value, QUANTITIES.PRESSURE);
      setParams((previous) => ({
        ...previous,
        stages: previous.stages.map((stage, position) =>
          position === index ? { ...stage, pressure: isFinite(base) ? base : 0 } : stage
        ),
      }));
    },
    [setParams, toBase]
  );

  /**
   * Пишет показание расходомера
   *
   * Стёртое поле — это пропуск отсчёта, а не ноль на расходомере: ноль
   * означал бы, что прибор обнулился.
   *
   * @param {number} index - номер ступени
   * @param {number} position - номер отсчёта
   * @param {number|null} value - показание в размерности пользователя
   */
  const setReading = useCallback(
    (index, position, value) => {
      const base = value === null ? null : toBase(value, QUANTITIES.VOLUME);
      const stored = base === null || !isFinite(base) ? null : base;
      setParams((previous) => ({
        ...previous,
        stages: previous.stages.map((stage, stageIndex) =>
          stageIndex === index
            ? {
                ...stage,
                readings: stage.readings.map((reading, readingIndex) =>
                  readingIndex === position ? stored : reading
                ),
              }
            : stage
        ),
      }));
    },
    [setParams, toBase]
  );
```

Взять из хука новые функции — заменить строку получения полей:

```js
  const { text, change, forget, draftOr, draftChange } = useParamFields(
    params,
    setParams,
    fromBase,
    toBase
  );
```

Добавить ключи черновиков рядом с `CHART_VIEWPORT`, на уровне модуля:

```js
/**
 * Ключ черновика поля давления ступени
 *
 * @param {number} index - номер ступени
 * @returns {string} ключ
 */
const pressureKey = (index) => `stage.${index}.pressure`;

/**
 * Ключ черновика поля показания расходомера
 *
 * @param {number} index - номер ступени
 * @param {number} position - номер отсчёта
 * @returns {string} ключ
 */
const readingKey = (index, position) => `stage.${index}.reading.${position}`;

/**
 * Все ключи черновиков ступеней
 *
 * @param {Array<Object>} stages - ступени
 * @returns {Array<string>} ключи
 */
const stageDraftKeys = (stages) =>
  stages.flatMap((stage, index) => [
    pressureKey(index),
    ...stage.readings.map((_, position) => readingKey(index, position)),
  ]);
```

Заменить `pressureText` и `readingText`:

```js
  const pressureText = useCallback(
    (index) =>
      draftOr(pressureKey(index), show(stages[index]?.pressure, QUANTITIES.PRESSURE)),
    [stages, show, draftOr]
  );

  const readingText = useCallback(
    (index, position) => {
      const value = stages[index]?.readings?.[position];
      const converted =
        value === null || value === undefined ? NaN : fromBase(value, QUANTITIES.VOLUME);
      const ready = isFinite(converted) ? String(Number(converted.toPrecision(6))) : '';
      return draftOr(readingKey(index, position), ready);
    },
    [stages, fromBase, draftOr]
  );
```

Заменить `removeStage`:

```js
  const removeStage = useCallback(
    (index) => {
      // Черновики привязаны к номеру ступени, а номера после удаления
      // съезжают: набранный текст пятой ступени оказался бы в четвёртой.
      // Числа уже в наборе величин, так что сброс черновиков не теряет ничего
      forget(...stageDraftKeys(stages));
      setParams((previous) => ({
        ...previous,
        stages: previous.stages.filter((_, position) => position !== index),
      }));
    },
    [setParams, forget, stages]
  );
```

- [ ] **Step 5: Передать новые обработчики в `StageCard`**

В отрисовке ступеней (около строки 588) заменить пропсы `pressureText`, `onPressure`, `readingText`, `onReading`:

```js
              pressureText={pressureText(index)}
              onPressure={draftChange(pressureKey(index), (value) => setPressure(index, value))}
              readingText={(position) => readingText(index, position)}
              onReading={(position) =>
                draftChange(readingKey(index, position), (value) =>
                  setReading(index, position, value)
                )
              }
```

- [ ] **Step 6: Убедиться, что тесты проходят**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest screens/PumpingTestProcessing --maxWorkers=2
```

Ожидание: PASS — и новые шесть тестов, и все прежние по трём экранам ОФР. Прежние важнее: `useParamFields` общий на экспресс-опробование, поинтервальное нагнетание и налив в шурф, и его правка задевает все три.

- [ ] **Step 7: Проверить, что число доезжает до базы**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest db share --maxWorkers=2
```

Ожидание: PASS. `db/params.js` нормализует ступени через `toNumber`/`toReading`; в `params.stages` по-прежнему уезжают числа, а не строки — текст живёт в состоянии экрана и в базу не попадает.

- [ ] **Step 8: Коммит**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && git add screens/PumpingTestProcessing/OfrTestShell.js screens/PumpingTestProcessing/LugeonScreen.js screens/PumpingTestProcessing/__tests__/OfrTestScreens.test.js && git commit -m "$(cat <<'EOF'
fix: дробное значение в ΔP и показаниях расходомера

Поля ступени хранили число и пересобирали текст из него на каждый
рендер. Промежуточная строка такого круга не переживала: «1,»
возвращалось как «1», а «0,» — как пустота, потому что ноль
значит «не задано». Значение меньше единицы было не набрать.

Черновик для этого в проекте уже был — useParamFields, — но доставал
только до плоского params[key]. Достаёт и до ступеней.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Сбой записи голосовой заметки виден на экране

Причина вылета на Android из исходников `expo-audio@0.4.9` не выводится — нужен трейс с устройства (шаг 6 задачи). Независимо от трейса: `recorder.start()` и `recorder.stop()` могут отклонить промис — отказ в правах, занятый микрофон, сорвавшийся `prepare`, отказ файлового хранилища при сохранении, — а `toggleRecording` зовёт их без обработки. Отказ уходит в несопровождаемое отклонение промиса и на экране не появляется вовсе.

Эта задача **не объявляется исправлением вылета**. Она делает сбой видимым, если тот окажется уровня JS, и ничего не портит, если нет.

**Files:**
- Modify: `components/PointSheet.js` (`toggleRecording` около строк 83–97; `denialNotice` около строки 103)
- Modify: `Localization.js` (ключ `recordingFailed` в обеих локалях, рядом с `microphoneDenied`)
- Test: `components/__tests__/PointSheet.test.js`

**Interfaces:**
- Consumes: `useVoiceRecorder()` из `hooks/useVoiceRecorder.js` — `{ start, stop, isRecording, durationMillis, levels, denied }`.
- Produces: ничего для других задач.

- [ ] **Step 1: Найти соседний ключ локализации**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && grep -n "microphoneDenied" Localization.js
```

Запомнить номера строк — русскую и английскую; вставлять новый ключ следующей строкой после каждой.

- [ ] **Step 2: Написать падающие тесты**

В `components/__tests__/PointSheet.test.js` дописать в конец файла:

Нажатия — тем же способом, что и в остальных тестах файла: `button(tree, 'Запись').props.onPress()`. Метки берутся строками, как там же.

```js
test('сорвавшийся запуск записи виден на экране', async () => {
  // Отказ микрофона, занятое устройство, сорвавшийся prepare: без обработки
  // это уходило в несопровождаемое отклонение промиса, и на экране
  // не появлялось ничего — кнопка просто не срабатывала
  start.mockRejectedValueOnce(new Error('recorder busy'));
  const tree = mount();

  await act(async () => {
    button(tree, 'Запись').props.onPress();
  });

  expect(texts(tree)).toContain(I18n.t('recordingFailed'));
});

test('сорвавшееся сохранение заметки видно на экране', async () => {
  mockRecorder = { ...mockRecorder, isRecording: true };
  const onAdd = jest.fn(async () => {
    throw new Error('нет места на диске');
  });
  const tree = mount({ onAdd });

  await act(async () => {
    button(tree, 'Остановить запись').props.onPress();
  });

  expect(texts(tree)).toContain(I18n.t('recordingFailed'));
});

test('удачная запись сообщения о сбое не показывает', async () => {
  mockRecorder = { ...mockRecorder, isRecording: true };
  const onAdd = jest.fn(async () => {});
  const tree = mount({ onAdd });

  await act(async () => {
    button(tree, 'Остановить запись').props.onPress();
  });

  expect(onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'audio', uri: 'file:///cache/recording.m4a' })
  );
  expect(texts(tree)).not.toContain(I18n.t('recordingFailed'));
});
```

Метки `'Запись'` и `'Остановить запись'` — те же, что в уже написанных тестах этого файла (строки с `button(tree, 'Запись')` и `button(tree, 'Остановить запись')`). Если после правки локализации они разойдутся — сверить с `Localization.js` по ключам `addVoiceNote` и `stopRecording`.

- [ ] **Step 3: Убедиться, что тесты падают**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest components/__tests__/PointSheet.test.js --maxWorkers=2
```

Ожидание: FAIL — сообщения о сбое на экране нет; первые два теста вдобавок роняют необработанное отклонение промиса.

- [ ] **Step 4: Добавить ключ локализации**

В `Localization.js` следующей строкой после русского `microphoneDenied`:

```js
    recordingFailed: "Запись не удалась. Попробуйте ещё раз.",
```

и после английского:

```js
    recordingFailed: "Recording failed. Please try again.",
```

- [ ] **Step 5: Обработать сбой в `PointSheet`**

В `components/PointSheet.js` добавить состояние рядом с остальными `useState`:

```js
  // Сбой записи: отказ микрофона, занятое устройство, отказ хранилища
  const [recordFailed, setRecordFailed] = useState(false);
```

Заменить `toggleRecording`:

```js
  /**
   * Начинает или останавливает запись
   *
   * Сбой ловится и показывается строкой на шторке. Без этого отказ уходил в
   * несопровождаемое отклонение промиса: кнопка не срабатывала, и понять,
   * почему, было нельзя ни в поле, ни по логам.
   */
  const toggleRecording = async () => {
    try {
      if (!recorder.isRecording) {
        setRecordFailed(false);
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
    } catch {
      setRecordFailed(true);
    }
  };
```

Дописать сообщение в `denialNotice`:

```js
  const denialNotice =
    (photoDenied === 'camera' && I18n.t('cameraDenied')) ||
    (photoDenied === 'library' && I18n.t('galleryDenied')) ||
    (recorder.denied && I18n.t('microphoneDenied')) ||
    (recordFailed && I18n.t('recordingFailed')) ||
    '';
```

Отказ в правах стоит выше сбоя: он объясняет причину точнее.

- [ ] **Step 6: Убедиться, что тесты проходят**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest components/__tests__/PointSheet.test.js --maxWorkers=2
```

Ожидание: PASS, включая прежние тесты шторки.

- [ ] **Step 7: Проверить отсутствие дублей локализации**

Повторить скрипт из задачи 3, шаг 5. Ожидание: `дублей нет`.

- [ ] **Step 8: Коммит**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && git add components/PointSheet.js components/__tests__/PointSheet.test.js Localization.js && git commit -m "$(cat <<'EOF'
fix: показывать сбой записи голосовой заметки

start() и stop() рекордера могут отклонить промис — отказ в правах,
занятый микрофон, отказ хранилища при сохранении, — а toggleRecording
звал их без обработки. Сбой уходил в несопровождаемое отклонение:
кнопка не срабатывала, и понять почему было нельзя.

Причина вылета на Android этим не закрыта — она ждёт трейса
с устройства.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 9: Снять трейс вылета с устройства**

Шаг для человека с телефоном в руках, не для агента.

Подключить телефон по USB с включённой отладкой и проверить, что он виден:

```bash
adb devices
```

Очистить буфер, начать запись лога, затем в приложении открыть полевой дневник, точку, шторку вложений и нажать «Голосовая заметка»:

```bash
adb logcat -c && adb logcat -v time > /tmp/ansdimat-crash.log
```

После вылета остановить `logcat` (Ctrl+C) и достать сам сбой:

```bash
grep -n -A 60 "FATAL EXCEPTION\|AndroidRuntime\|libc  \|signal 11" /tmp/ansdimat-crash.log | head -120
```

Что искать и что это значит:

- `java.lang.SecurityException: … RECORD_AUDIO` — прав нет в собранном манифесте: сборка старше, чем строка `RECORD_AUDIO` в `app.json`, нужна пересборка;
- `java.lang.IllegalStateException` в `android.media.MediaRecorder` — сбой нативного рекордера, чинится в `hooks/useVoiceRecorder.js`;
- `signal 11 (SIGSEGV)` в `libexpo-audio` или `libmediandk` — падение самого модуля, поднимать версию `expo-audio`;
- стек с `com.facebook.react` и именем файла из репозитория — ошибка в JS, чинится по стеку.

Если вылет окажется не в записи, а, скажем, в `react-native-maps` при уходе активности в фон под системный диалог разрешения — это отдельная задача, и она заводится отдельно; в этот план она не входит.

- [ ] **Step 10: Прогнать весь набор тестов**

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && npx jest --maxWorkers=2
```

Ожидание: PASS целиком. Это единственный прогон всего набора в плане: до него задачи трогали свои области, и общий прогон здесь ловит то, что задачи друг о друге не знали.

---

## Что этот план не закрывает

- **Причину вылета на Android.** Задача 6 делает сбой видимым; сама причина чинится по трейсу шага 9 отдельным коммитом.
- **Мёртвые экспорты `calc/leakage.js`.** После задачи 1 `leakageFactor`, `leakyDrawdown`, `steadyLeakyDrawdown` и `leakageRate` остаются без вызовов из приложения. Они покрыты тестами и описывают физику перетекания; чистка — отдельная задача.
- **Тот же круг «текст → число → текст» на других экранах.** `useParamFields` теперь умеет вложенные поля, но переводить на них экспресс-опробование и налив в шурф не требовалось: там поля плоские и уже ходят через `text`/`change`.
