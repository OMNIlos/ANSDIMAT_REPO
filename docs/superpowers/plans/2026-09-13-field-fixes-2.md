# Правки 13.09 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать полосу прокрутки и перекрытие кнопок на картах гидроизогипс, починить вылет записи и добавить проигрывание голосовых заметок, убрать «Барраж», переименовать вкладки калькулятора и заменить «Параметры» модулем «Оценка по Q/s» по формулам настольного АНСДИМАТ.

**Architecture:** Пять независимых правок по спецификации [`2026-09-13-field-fixes-2-design.md`](../specs/2026-09-13-field-fixes-2-design.md). Математика Q/s — чистый модуль `calc/specificCapacity.js` с тестами на числа настольной версии, вкладка только раскладывает поля. Запись опрашивает рекордер сама и только во время записи; проигрывание — отдельный хук на один плеер. Карты правятся скином и сборкой встраиваемой страницы, экран карт прячет плавающее меню существующим `chromeVisibility`.

**Tech Stack:** React Native 0.79 / Expo SDK 53, `expo-audio` 0.4.9, `react-native-webview`, `react-native-paper`, `i18n-js`, Jest + `jest-expo`, `react-test-renderer`.

## Global Constraints

- **Язык кода и комментариев — русский**, как во всём проекте: JSDoc над каждой экспортируемой функцией и компонентом, комментарий объясняет *почему*, а не *что*.
- **Jest и `node`-скрипты гонять с выключенной песочницей** (`dangerouslyDisableSandbox: true`): песочница не читает `node_modules`. Jest — всегда с `--maxWorkers=2`, иначе флакают чужие таймауты.
- **`Localization.js` не терпит дублей ключей**: одноимённый ключ ниже молча перетирает верхний. Каждая задача, трогающая ключи, заканчивается проверкой (скрипт ниже, должен напечатать `clean`):

```bash
node -e "const ast=require('@babel/parser').parse(require('fs').readFileSync('Localization.js','utf8'),{sourceType:'module'});let n=0;(function w(x){if(!x||typeof x!=='object')return;if(x.type==='ObjectExpression'){const s=new Map();for(const p of x.properties){if(p.type!=='ObjectProperty')continue;const k=p.key.name??p.key.value;if(s.has(k)){n++;console.log('DUP',k,s.get(k),p.loc.start.line)}else s.set(k,p.loc.start.line)}}for(const v of Object.values(x)){Array.isArray(v)?v.forEach(w):w(v)}})(ast);console.log(n?'dups: '+n:'clean')"
```

- **Числа настольного АНСДИМАТ** (пример из справки: Q = 100 м³/сут, s_w = 15, m = 20, l_w = 2, z_w = 10, r_w = 0,1, k_z/k_r = 1): T = **8.133333** (напорный, совершенная), T = **31.44454** (напорный, несовершенная), k = **0.648** (безнапорный, совершенная), k = **2.512896** (безнапорный, несовершенная, по той же f), f = **43.94059**.
- **z_w — расстояние до середины фильтра**: z₁ = z_w − l_w/2, z₂ = z_w + l_w/2. Иначе 31.44454 не сходится.
- **Базовая единица расхода — м³/сут**, фактор в `FLOW_UNITS` переводит ИЗ базовой В целевую: `значение_в_единице = значение_в_базовой × factor`, обратно — делением.
- **Страницы AnsSurf в `assets/anssurf/` руками не править** — только `node tools/build-anssurf.js` из поставки `../.anssurf-src`.
- **Рабочее дерево ветки `feat/point-attachments` содержит чужую незакоммиченную работу** (`calc/slugTest.js`, `VadoseFillScreen.js`, `db/params.js`, `screens/calculator/shared.js` и соседние). `git add` — только перечисленные в задаче файлы, `git commit -a` не использовать, `shared.js` не трогать. Коммиты — с подписью `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`, без push.

---

### Task 1: Вкладки калькулятора — без «Барража», новые подписи

**Files:**
- Delete: `screens/calculator/BarrageTab.js`
- Modify: `screens/CalculatorScreen.js` (шапка-комментарий строки 1–22, импорт строки 48, `TABS` строки 53–61)
- Modify: `Localization.js` (ru: `tabParams`/`tabForecast` строки 422–423, блок «Барраж» 734–751, `barrageTab` 1504, `manualCalculatorIntro`/`manualCalcForecast`/`manualCalcBarrage` 223–234, `regimeBarrierAdvice`/`regimeRechargeAdvice` 339–344; en — те же ключи)
- Modify: `screens/UserManualScreen.js` (раздел `calculator`, строки 212–260)
- Modify: `components/RegimeVerdict.js` (строки 61–64, 75–78)
- Test: `screens/calculator/__tests__/CalculatorScreen.test.js`

**Interfaces:**
- Consumes: ничего.
- Produces: `TABS` в `screens/CalculatorScreen.js` из шести записей: `flow`, `filtration`, `params`, `forecast`, `pit`, `whpa`. Задача 3 меняет у `params` только `Component`.

**`calc/boundaries.js` не трогать:** `drawdownWithBoundary` нужна `calc/__tests__/diagnostics.test.js`.

- [ ] **Step 1: Написать падающий тест**

В `screens/calculator/__tests__/CalculatorScreen.test.js`, внутри `describe('CalculatorScreen', …)`:

1. Заменить счёт вкладок (было «семь», `7`):

```js
  it('открывается и показывает все шесть вкладок', () => {
    const tree = renderScreen();
    expect(tabButtons(tree).length).toBe(6);
  });
```

2. Укоротить перебор — было `[0, 1, 2, 3, 4, 5, 6]`:

```js
  [0, 1, 2, 3, 4, 5].forEach((index) => {
```

Номера остальных вкладок не сдвигаются: «Барраж» стоял последним.

3. Дописать в конец `describe`:

```js
  it('вкладки «Барраж» нет', () => {
    // Граничные условия отображениями и подпор перед стеной в поле не
    // считают: вкладка занимала ряд и уводила от нужных расчётов
    expect(screenText(renderScreen())).not.toContain('Барраж');
  });

  it('вкладки подписаны «Оценка по Q/s» и «Расчёт понижения»', () => {
    const labels = tabButtons(renderScreen()).map((node) =>
      collectText(node.props.children).join(' ')
    );
    expect(labels).toEqual(expect.arrayContaining(['Оценка по Q/s', 'Расчёт понижения']));
    expect(labels).not.toContain('Параметры');
    expect(labels).not.toContain('Прогноз s');
  });
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest screens/calculator/__tests__/CalculatorScreen.test.js --maxWorkers=2`
Expected: FAIL — `expect(received).toBe(expected) Expected: 6 Received: 7`, текст содержит «Барраж», подписи старые.

- [ ] **Step 3: Удалить вкладку и поправить экран**

```bash
git rm screens/calculator/BarrageTab.js
```

В `screens/CalculatorScreen.js` заменить шапку-комментарий строки 1–12 (всё до абзаца «Экран — только каркас», включая пустую строку ` *` перед ним) на:

```js
/**
 * Калькулятор гидрогеолога — расчёты, нужные в поле
 *
 * 1. Пересчёт расхода — значение по всем размерностям сразу.
 * 2. Коэффициент фильтрации — пересчёт значения по всем единицам сразу.
 * 3. Оценка по Q/s — фильтрационные параметры по дебиту и понижению.
 * 4. Расчёт понижения — понижение от водозаборной скважины по четырём схемам.
 * 5. Приток в котлован — водоприток по формулам Дюпюи и Дюпюи–Тима.
 * 6. Зона санитарной охраны — три пояса по времени добегания загрязнения.
 *
```

(дальше абзацы «Экран — только каркас…» и «Вкладки стоят переносящимся рядом…» остаются как есть).

Удалить строку импорта:

```js
import BarrageTab from './calculator/BarrageTab';
```

и строку в `TABS`:

```js
  { key: 'barrage', labelKey: 'tabBarrage', Component: BarrageTab },
```

- [ ] **Step 4: Поправить локализацию (ru)**

В `Localization.js`, блок `ru`:

Было:
```js
    tabParams: "Параметры",
    tabForecast: "Прогноз s",
```
Стало:
```js
    tabParams: "Оценка по Q/s",
    tabForecast: "Расчёт понижения",
```

Было (строки 733–753):
```js
    unitMeterH2O: "м вод. ст.",
    tabBarrage: "Барраж",

    // ===== БАРРАЖ И ГРАНИЧНЫЕ УСЛОВИЯ =====
    distanceToBoundary: "Расстояние до границы",
    boundaryResultTitle: "Понижение с учётом границы",
    boundaryType: "Тип границы",
    boundaryBarrier: "Непроницаемая",
    boundaryRecharge: "Постоянный напор",
    withoutBoundary: "Без границы",
    boundaryEffect: "Вклад границы",
    boundaryNotReachedNote:
      "Возмущение ещё не дошло до границы — она пока не влияет на понижение.",
    observationBeyondBoundaryNote:
      "Точка наблюдения оказалась за границей пласта: r должно быть меньше L.",
    barrageRiseTitle: "Подпор перед сооружением",
    barrageRiseShort: "Подпор",
    naturalGradient: "Уклон потока",
    barrierLength: "Длина сооружения",

    // ===== ИНФИЛЬТРАЦИОННЫЕ УТЕЧКИ =====
```
Стало:
```js
    unitMeterH2O: "м вод. ст.",

    // ===== ИНФИЛЬТРАЦИОННЫЕ УТЕЧКИ =====
```

Удалить строку (устаревший ключ без ссылок):
```js
    barrageTab: "Барраж",
```

Было:
```js
    manualCalculatorIntro:
      "Четыре вкладки для быстрых расчётов, когда полного журнала нет — достаточно нескольких величин из полевой книжки.",
```
Стало:
```js
    manualCalculatorIntro:
      "Вкладки для быстрых расчётов, когда полного журнала нет — достаточно нескольких величин из полевой книжки.",
```

Было:
```js
    manualCalcForecast:
      "Понижение на заданном расстоянии и времени по формуле Тейса — через функцию скважины W(u).",
    manualCalcPit:
      "Приток воды в котлован: контур заменяется «большим колодцем» эквивалентного радиуса.",
    manualCalcBarrage:
      "Пласт с границей: непроницаемый контакт углубляет воронку, река — выполаживает. Плюс подпор уровня перед стеной в грунте.",
```
Стало:
```js
    manualCalcForecast:
      "Понижение в опытной и наблюдательной скважинах по четырём схемам: Тейс, пласт с перетеканием, безнапорный пласт Болтона, граница питания.",
    manualCalcPit:
      "Приток воды в котлован: контур заменяется «большим колодцем» эквивалентного радиуса.",
```

Было:
```js
    regimeBarrierAdvice:
      "Понижение дошло до границы пласта. Считайте T по раннему участку: по поздним точкам она выйдет вдвое заниженной. Расстояние до границы оценивает вкладка «Барраж» в калькуляторе.",
```
Стало:
```js
    regimeBarrierAdvice:
      "Понижение дошло до границы пласта. Считайте T по раннему участку: по поздним точкам она выйдет вдвое заниженной.",
```

Было:
```js
    regimeRechargeAdvice:
      "В пласт поступает вода: переток через разделяющий слой или близкий водоём. По поздним точкам T выйдет завышенной — берите участок до перегиба, а переток оцените во вкладке «Утечки».",
```
Стало:
```js
    regimeRechargeAdvice:
      "В пласт поступает вода: переток через разделяющий слой или близкий водоём. По поздним точкам T выйдет завышенной — берите участок до перегиба, а переток оцените схемой «С перетеканием» во вкладке «Расчёт понижения».",
```

- [ ] **Step 5: Поправить локализацию (en)**

Было:
```js
    tabParams: "Parameters",
    tabForecast: "Drawdown s",
```
Стало:
```js
    tabParams: "Estimate from Q/s",
    tabForecast: "Drawdown calculation",
```

Было (строки 2484–2504):
```js
    unitMeterH2O: "m H₂O",
    tabBarrage: "Barrier",

    // ===== BARRIER AND BOUNDARY CONDITIONS =====
    distanceToBoundary: "Distance to boundary",
    boundaryResultTitle: "Drawdown with boundary",
    boundaryType: "Boundary type",
    boundaryBarrier: "Impermeable",
    boundaryRecharge: "Constant head",
    withoutBoundary: "Without boundary",
    boundaryEffect: "Boundary contribution",
    boundaryNotReachedNote:
      "The cone of depression has not reached the boundary yet — it does not affect drawdown so far.",
    observationBeyondBoundaryNote:
      "The observation point lies beyond the aquifer boundary: r must be smaller than L.",
    barrageRiseTitle: "Head build-up upstream of the structure",
    barrageRiseShort: "Head build-up",
    naturalGradient: "Natural gradient",
    barrierLength: "Structure length",

    // ===== LEAKAGE =====
```
Стало:
```js
    unitMeterH2O: "m H₂O",

    // ===== LEAKAGE =====
```

Удалить строку:
```js
    barrageTab: "Barrage",
```

Было:
```js
    manualCalculatorIntro:
      "Four tabs for quick calculations when there is no full journal — a few values from the field notebook are enough.",
```
Стало:
```js
    manualCalculatorIntro:
      "Tabs for quick calculations when there is no full journal — a few values from the field notebook are enough.",
```

Было:
```js
    manualCalcForecast:
      "Drawdown at a given distance and time from the Theis equation via the well function W(u).",
    manualCalcPit:
      "Inflow into an excavation pit: the contour is replaced by a “big well” of equivalent radius.",
    manualCalcBarrage:
      "Aquifer with a boundary: an impermeable contact deepens the cone of depression, a river flattens it. Plus head build-up upstream of a cutoff wall.",
```
Стало:
```js
    manualCalcForecast:
      "Drawdown in the pumped and observation wells for four schemes: Theis, leaky aquifer, Boulton unconfined aquifer, recharge boundary.",
    manualCalcPit:
      "Inflow into an excavation pit: the contour is replaced by a “big well” of equivalent radius.",
```

Было:
```js
    regimeBarrierAdvice:
      "Drawdown has reached the edge of the aquifer. Compute T from the early segment: late points halve it. The Barrage tab estimates the distance to the boundary.",
```
Стало:
```js
    regimeBarrierAdvice:
      "Drawdown has reached the edge of the aquifer. Compute T from the early segment: late points halve it.",
```

Было:
```js
    regimeRechargeAdvice:
      "Water enters the aquifer: leakage through the aquitard or a nearby water body. Late points overestimate T — use the segment before the bend, and assess leakage in the Leakage tab.",
```
Стало:
```js
    regimeRechargeAdvice:
      "Water enters the aquifer: leakage through the aquitard or a nearby water body. Late points overestimate T — use the segment before the bend, and assess leakage with the Leaky scheme on the Drawdown calculation tab.",
```

- [ ] **Step 6: Запасные тексты в коде**

В `components/RegimeVerdict.js` запасной текст совета о границе:

Было:
```js
            'Понижение дошло до границы пласта. Считайте T по раннему участку: по поздним точкам она выйдет вдвое заниженной. Расстояние до границы оценивает вкладка «Барраж» в калькуляторе.',
```
Стало:
```js
            'Понижение дошло до границы пласта. Считайте T по раннему участку: по поздним точкам она выйдет вдвое заниженной.',
```

Было:
```js
            'В пласт поступает вода: переток через разделяющий слой или близкий водоём. По поздним точкам T выйдет завышенной — берите участок до перегиба, а переток оцените во вкладке «Утечки».',
```
Стало:
```js
            'В пласт поступает вода: переток через разделяющий слой или близкий водоём. По поздним точкам T выйдет завышенной — берите участок до перегиба, а переток оцените схемой «С перетеканием» во вкладке «Расчёт понижения».',
```

В `screens/UserManualScreen.js`, раздел `calculator`:

Было:
```js
              'Четыре вкладки для быстрых расчётов, когда полного журнала нет — достаточно нескольких величин из полевой книжки.',
```
Стало:
```js
              'Вкладки для быстрых расчётов, когда полного журнала нет — достаточно нескольких величин из полевой книжки.',
```

Было:
```js
            {
              term: I18n.t('tabForecast', { defaultValue: 'Прогноз' }),
              definition: I18n.t('manualCalcForecast', {
                defaultValue:
                  'Понижение на заданном расстоянии и времени по формуле Тейса — через функцию скважины W(u).',
              }),
            },
```
Стало:
```js
            {
              term: I18n.t('tabForecast', { defaultValue: 'Расчёт понижения' }),
              definition: I18n.t('manualCalcForecast', {
                defaultValue:
                  'Понижение в опытной и наблюдательной скважинах по четырём схемам: Тейс, пласт с перетеканием, безнапорный пласт Болтона, граница питания.',
              }),
            },
```

Удалить элемент списка целиком:
```js
            {
              term: I18n.t('tabBarrage', { defaultValue: 'Барраж' }),
              definition: I18n.t('manualCalcBarrage', {
                defaultValue:
                  'Пласт с границей: непроницаемый контакт углубляет воронку, река — выполаживает. Плюс подпор уровня перед стеной в грунте.',
              }),
            },
```

- [ ] **Step 7: Проверить, что ссылок на удалённое не осталось**

Run: `grep -rn "BarrageTab\|tabBarrage\|manualCalcBarrage\|barrageRise\|boundaryResultTitle\|distanceToBoundary" --include='*.js' . | grep -v node_modules | grep -v "^./docs"`
Expected: пусто (в `presentation/` метка «Барраж» в скриптах скриншотов остаётся — это инструмент презентации, как и с «Утечками»).

- [ ] **Step 8: Тесты зелёные и дублей нет**

Run: `npx jest screens/calculator components/__tests__/RegimeVerdict --maxWorkers=2`
Expected: PASS.

Run: скрипт проверки дублей из Global Constraints.
Expected: `clean`.

- [ ] **Step 9: Commit**

```bash
git add screens/CalculatorScreen.js screens/calculator/__tests__/CalculatorScreen.test.js Localization.js screens/UserManualScreen.js components/RegimeVerdict.js
git commit -m "$(cat <<'EOF'
feat: убрать «Барраж», переименовать вкладки калькулятора

«Прогноз s» стал «Расчётом понижения», «Параметры» — «Оценкой по Q/s».
Советы диагностики больше не отсылают к несуществующим вкладкам:
«Барража» нет, а «Утечки» удалены ещё 11.09 — переток оценивает
схема «С перетеканием».

calc/boundaries.js остаётся: его использует тест диагностики.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Математика оценки по Q/s

**Files:**
- Create: `calc/specificCapacity.js`
- Test: `calc/__tests__/specificCapacity.test.js`

**Interfaces:**
- Consumes: `besselK0(x: number): number` из `calc/leakage.js` (NaN при x ≤ 0).
- Produces:
  - `AQUIFERS = { CONFINED: 'confined', UNCONFINED: 'unconfined' }`
  - `MAX_TERMS: number` (20000)
  - `imperfectionTerm({ m, lw, zw, rw, anisotropy = 1 }, { maxTerms = MAX_TERMS } = {}): number` — f; NaN при невозможной геометрии
  - `estimateFromSpecificCapacity({ Q, s, aquifer = 'confined', imperfect = false, m, lw, zw, rw, anisotropy = 1 }): { quantity: 'T'|'k', value: number, secondary: number, f: number, formula: string, invalid: string[], errors: string[], warnings: string[] }`
    - `invalid` — ключи полей `'Q'|'s'|'m'|'lw'|'zw'|'rw'|'anisotropy'` с пустым или недопустимым значением;
    - `errors` — `'drawdownExceedsThickness'`, `'filterOutsideAquifer'` (результата нет);
    - `warnings` — `'filterFullThickness'`;
    - `secondary` — k = T/m у напорной несовершенной, T = k·m у безнапорной, иначе NaN;
    - `f` — NaN у совершенной скважины.

- [ ] **Step 1: Написать падающий тест**

Create `calc/__tests__/specificCapacity.test.js`:

```js
/**
 * Оценка параметров по удельному дебиту
 *
 * Эталон — окно «Оценка параметров» настольного АНСДИМАТ, вкладка
 * «Проводимость», пример из справки. Числа должны сходиться один в один:
 * человек сверяет вкладку с настольной версией, открыв обе рядом.
 */

import {
  AQUIFERS,
  estimateFromSpecificCapacity,
  imperfectionTerm,
} from '../specificCapacity';

/** Пример из справки настольной версии */
const DESKTOP = { Q: 100, s: 15, m: 20, lw: 2, zw: 10, rw: 0.1, anisotropy: 1 };

describe('estimateFromSpecificCapacity', () => {
  test('напорный пласт, совершенная скважина: T = 1.22·Q/s', () => {
    const result = estimateFromSpecificCapacity({ Q: 100, s: 15, aquifer: AQUIFERS.CONFINED });

    expect(result.quantity).toBe('T');
    expect(result.value).toBeCloseTo(8.133333, 5);
    expect(result.secondary).toBeNaN();
    expect(result.f).toBeNaN();
    expect(result.invalid).toEqual([]);
  });

  test('напорный пласт, несовершенная скважина: как в настольной версии', () => {
    const result = estimateFromSpecificCapacity({
      ...DESKTOP,
      aquifer: AQUIFERS.CONFINED,
      imperfect: true,
    });

    expect(result.value).toBeCloseTo(31.44454, 4);
    expect(result.f).toBeCloseTo(43.94059, 4);
    // k = T/m: в настольной версии — всплывающая подсказка у поля результата
    expect(result.secondary).toBeCloseTo(31.44454 / 20, 4);
  });

  test('безнапорный пласт, совершенная скважина: k = 2.43·Q/(s·(2m − s))', () => {
    const result = estimateFromSpecificCapacity({
      Q: 100,
      s: 15,
      m: 20,
      aquifer: AQUIFERS.UNCONFINED,
    });

    expect(result.quantity).toBe('k');
    expect(result.value).toBeCloseTo(0.648, 6);
    expect(result.secondary).toBeCloseTo(12.96, 6);
  });

  test('безнапорный пласт, несовершенная скважина', () => {
    const result = estimateFromSpecificCapacity({
      ...DESKTOP,
      aquifer: AQUIFERS.UNCONFINED,
      imperfect: true,
    });

    // f та же, что в напорном примере: k = Q/(s·(2m − s))·(2.43 + f/2π)
    expect(result.value).toBeCloseTo(2.512896, 5);
  });

  test('фильтр на всю мощность: поправка нулевая, результат как у совершенной', () => {
    const result = estimateFromSpecificCapacity({
      ...DESKTOP,
      lw: 20,
      zw: 10,
      aquifer: AQUIFERS.CONFINED,
      imperfect: true,
    });

    expect(result.f).toBeCloseTo(0, 8);
    expect(result.value).toBeCloseTo(8.133333, 5);
    expect(result.warnings).toContain('filterFullThickness');
  });

  test('фильтр за пределами пласта — ошибка, результата нет', () => {
    // z₁ = 0.5 − 1 < 0: верх фильтра выше кровли
    const result = estimateFromSpecificCapacity({
      ...DESKTOP,
      zw: 0.5,
      aquifer: AQUIFERS.CONFINED,
      imperfect: true,
    });

    expect(result.errors).toEqual(['filterOutsideAquifer']);
    expect(result.value).toBeNaN();
  });

  test('безнапорный: понижение не меньше мощности — ошибка', () => {
    const result = estimateFromSpecificCapacity({
      Q: 100,
      s: 20,
      m: 20,
      aquifer: AQUIFERS.UNCONFINED,
    });

    expect(result.errors).toEqual(['drawdownExceedsThickness']);
    expect(result.value).toBeNaN();
  });

  test('пустые и недопустимые поля перечисляются, результата нет', () => {
    const result = estimateFromSpecificCapacity({
      Q: NaN,
      s: 0,
      m: 20,
      lw: 2,
      zw: 10,
      rw: undefined,
      anisotropy: -1,
      aquifer: AQUIFERS.CONFINED,
      imperfect: true,
    });

    expect(result.invalid).toEqual(['Q', 's', 'rw', 'anisotropy']);
    expect(result.value).toBeNaN();
  });

  test('совершенной скважине в напорном пласте мощность не нужна', () => {
    const result = estimateFromSpecificCapacity({ Q: 100, s: 15, m: NaN });

    expect(result.invalid).toEqual([]);
    expect(result.value).toBeCloseTo(8.133333, 5);
  });
});

describe('imperfectionTerm', () => {
  test('оценка хвоста ряда сходится с прямым суммированием', () => {
    // r_w/m мал, и прямое суммирование требует 254 648 членов. С лимитом
    // в 2000 членов остальное оценивается интегралом
    const params = { m: 20, lw: 2, zw: 10, rw: 0.001, anisotropy: 1 };

    const exact = imperfectionTerm(params, { maxTerms: 1_000_000 });
    const approx = imperfectionTerm(params, { maxTerms: 2000 });

    expect(exact).toBeCloseTo(125.85617, 4);
    expect(Math.abs(approx - exact) / exact).toBeLessThan(1e-6);
  });

  test('слабая вертикальная проницаемость увеличивает поправку', () => {
    const base = { m: 20, lw: 2, zw: 10, rw: 0.1 };

    expect(imperfectionTerm({ ...base, anisotropy: 0.1 })).toBeGreaterThan(
      imperfectionTerm({ ...base, anisotropy: 1 })
    );
  });

  test('невозможная геометрия даёт NaN', () => {
    expect(imperfectionTerm({ m: 20, lw: 2, zw: 0.5, rw: 0.1 })).toBeNaN();
    expect(imperfectionTerm({ m: 20, lw: 0, zw: 10, rw: 0.1 })).toBeNaN();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest calc/__tests__/specificCapacity.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../specificCapacity'`.

- [ ] **Step 3: Написать модуль**

Create `calc/specificCapacity.js`:

```js
/**
 * Оценка параметров пласта по удельному дебиту
 *
 * Вкладка «Проводимость» диалога «Оценка параметров» настольного АНСДИМАТ:
 * по дебиту и понижению в опытной скважине — водопроводимость напорного
 * пласта или коэффициент фильтрации безнапорного. Границы и перетекание не
 * рассматриваются.
 *
 * Числа 1,22 и 2,43 — не универсальные константы: в них спрятано типичное
 * отношение радиуса влияния к радиусу скважины, ln(R/r_w) ≈ 7,67. Это оценка
 * порядка величины по одному замеру, а не обработка журнала. Формулы взяты из
 * настольной версии один в один, чтобы результаты сходились с ней.
 *
 * Поправка f на несовершенство скважины — ряд из справки настольной версии:
 *
 *   f = 4m²/(π²·l_w²) · Σ 1/n² · (sin(nπz₁/m) − sin(nπz₂/m))² · K₀(χ·nπr_w/m)
 *
 * z₁, z₂ — расстояния до верха и низа фильтра, χ = √(k_z/k_r). В поле
 * вводится одно z_w — расстояние до середины фильтра: только при таком
 * прочтении расчёт совпадает с настольной версией (31.44454 на примере из
 * справки; если считать z_w верхом или низом фильтра, выходит 31.45592).
 */

import { besselK0 } from './leakage';

export const AQUIFERS = {
  CONFINED: 'confined',
  UNCONFINED: 'unconfined',
};

/** Множитель напорного пласта: T = 1.22·Q/s */
const CONFINED_FACTOR = 1.22;

/** Множитель безнапорного пласта: k = 2.43·Q/(s·(2m − s)) */
const UNCONFINED_FACTOR = 2.43;

/** Аргумент K₀, за которым члены ряда пренебрежимы: K₀(40) ≈ 8·10⁻¹⁹ */
const ARGUMENT_LIMIT = 40;

/**
 * Сколько членов ряда суммировать напрямую
 *
 * Для тонкого фильтра в мощном пласте до пренебрежимого K₀ нужны сотни тысяч
 * членов. Дальше лимита хвост оценивается интегралом — сверено с прямым
 * суммированием: расхождение порядка 10⁻¹⁰ относительных.
 */
export const MAX_TERMS = 20000;

/** Шагов формулы Симпсона в оценке хвоста (обязательно чётное) */
const TAIL_STEPS = 400;

/** Допуск сравнения границ фильтра с границами пласта, м */
const EPSILON = 1e-9;

const FORMULAS = {
  [AQUIFERS.CONFINED]: {
    perfect: 'T = 1.22·Q/sw',
    imperfect: 'T = (1.22 + f/4π)·Q/sw',
  },
  [AQUIFERS.UNCONFINED]: {
    perfect: 'k = 2.43·Q / (sw·(2m − sw))',
    imperfect: 'k = Q / (sw·(2m − sw)) · (2.43 + f/2π)',
  },
};

/**
 * Положительное конечное число
 *
 * @param {*} value - значение
 * @returns {boolean} годится ли как длина, расход или понижение
 */
const positive = (value) => Number.isFinite(value) && value > 0;

/**
 * Хвост ряда после `terms` членов
 *
 * Σₙ₌ₜ₊₁^∞ (sin nα − sin nβ)²/n² · K₀(cn). Синусы при больших n осциллируют,
 * и среднее квадрата их разности равно 1, а медленно меняющийся множитель
 * K₀(cn)/n² заменяется интегралом: c·∫ K₀(u)/u² du от c·(terms + ½) до
 * предела. Подстановка u = eᵗ выравнивает шаг по логарифмической шкале.
 *
 * @param {number} c - χ·π·r_w/m
 * @param {number} terms - сколько членов уже просуммировано
 * @returns {number} оценка хвоста
 */
function seriesTail(c, terms) {
  const from = c * (terms + 0.5);
  if (from >= ARGUMENT_LIMIT) return 0;

  const a = Math.log(from);
  const h = (Math.log(ARGUMENT_LIMIT) - a) / TAIL_STEPS;

  let sum = 0;
  for (let i = 0; i <= TAIL_STEPS; i++) {
    const u = Math.exp(a + i * h);
    const weight = i === 0 || i === TAIL_STEPS ? 1 : i % 2 === 1 ? 4 : 2;
    sum += weight * (besselK0(u) / u);
  }
  return (c * sum * h) / 3;
}

/**
 * Поправка f на несовершенство скважины
 *
 * @param {Object} params
 * @param {number} params.m - мощность пласта (у безнапорного — начальная обводнённая), м
 * @param {number} params.lw - длина фильтра, м
 * @param {number} params.zw - от кровли (у безнапорного — от статического уровня) до середины фильтра, м
 * @param {number} params.rw - радиус скважины, м
 * @param {number} [params.anisotropy] - k_z/k_r
 * @param {Object} [options]
 * @param {number} [options.maxTerms] - сколько членов суммировать напрямую
 * @returns {number} f; NaN, если геометрия невозможна
 */
export function imperfectionTerm({ m, lw, zw, rw, anisotropy = 1 }, { maxTerms = MAX_TERMS } = {}) {
  if (![m, lw, rw, anisotropy].every(positive) || !Number.isFinite(zw)) return NaN;

  const z1 = zw - lw / 2;
  const z2 = zw + lw / 2;
  if (z1 < -EPSILON || z2 > m + EPSILON) return NaN;

  const c = (Math.sqrt(anisotropy) * Math.PI * rw) / m;
  const needed = Math.ceil(ARGUMENT_LIMIT / c);
  const terms = Math.min(needed, maxTerms);
  const alpha = (Math.PI * z1) / m;
  const beta = (Math.PI * z2) / m;

  let sum = 0;
  for (let n = 1; n <= terms; n++) {
    const d = Math.sin(n * alpha) - Math.sin(n * beta);
    sum += ((d * d) / (n * n)) * besselK0(c * n);
  }
  if (needed > terms) sum += seriesTail(c, terms);

  return ((4 * m * m) / (Math.PI * Math.PI * lw * lw)) * sum;
}

/**
 * Водопроводимость или коэффициент фильтрации по удельному дебиту
 *
 * @param {Object} params
 * @param {number} params.Q - дебит, м³/сут
 * @param {number} params.s - понижение в опытной скважине, м
 * @param {string} [params.aquifer] - AQUIFERS.CONFINED | AQUIFERS.UNCONFINED
 * @param {boolean} [params.imperfect] - учитывать несовершенство скважины
 * @param {number} [params.m] - мощность пласта, м: у безнапорного всегда, у напорного — для несовершенной
 * @param {number} [params.lw] - длина фильтра, м
 * @param {number} [params.zw] - до середины фильтра, м
 * @param {number} [params.rw] - радиус скважины, м
 * @param {number} [params.anisotropy] - k_z/k_r
 * @returns {{quantity: string, value: number, secondary: number, f: number,
 *   formula: string, invalid: string[], errors: string[], warnings: string[]}}
 *   value — T, м²/сут, или k, м/сут; NaN, если считать нечего
 */
export function estimateFromSpecificCapacity({
  Q,
  s,
  aquifer = AQUIFERS.CONFINED,
  imperfect = false,
  m,
  lw,
  zw,
  rw,
  anisotropy = 1,
}) {
  const unconfined = aquifer === AQUIFERS.UNCONFINED;
  const invalid = [];
  const errors = [];
  const warnings = [];
  const result = {
    quantity: unconfined ? 'k' : 'T',
    value: NaN,
    secondary: NaN,
    f: NaN,
    formula: FORMULAS[unconfined ? AQUIFERS.UNCONFINED : AQUIFERS.CONFINED][
      imperfect ? 'imperfect' : 'perfect'
    ],
    invalid,
    errors,
    warnings,
  };

  if (!positive(Q)) invalid.push('Q');
  if (!positive(s)) invalid.push('s');
  if ((unconfined || imperfect) && !positive(m)) invalid.push('m');
  if (imperfect) {
    if (!positive(lw)) invalid.push('lw');
    if (!Number.isFinite(zw) || zw < 0) invalid.push('zw');
    if (!positive(rw)) invalid.push('rw');
    if (!positive(anisotropy)) invalid.push('anisotropy');
  }
  if (invalid.length) return result;

  if (unconfined && s >= m) {
    errors.push('drawdownExceedsThickness');
    return result;
  }

  let f = 0;
  if (imperfect) {
    if (zw - lw / 2 < -EPSILON || zw + lw / 2 > m + EPSILON) {
      errors.push('filterOutsideAquifer');
      return result;
    }
    // Фильтр на всю мощность — это уже совершенная скважина: ряд обнуляется
    // сам, а предупреждение объясняет, почему тумблер ничего не меняет
    if (lw >= m - EPSILON) warnings.push('filterFullThickness');
    f = imperfectionTerm({ m, lw, zw, rw, anisotropy });
    result.f = f;
  }

  if (unconfined) {
    result.value = (Q / (s * (2 * m - s))) * (UNCONFINED_FACTOR + f / (2 * Math.PI));
    result.secondary = result.value * m;
  } else {
    result.value = (CONFINED_FACTOR + f / (4 * Math.PI)) * (Q / s);
    result.secondary = imperfect ? result.value / m : NaN;
  }

  return result;
}
```

- [ ] **Step 4: Тест проходит**

Run: `npx jest calc/__tests__/specificCapacity.test.js --maxWorkers=2`
Expected: PASS, 12 тестов.

- [ ] **Step 5: Commit**

```bash
git add calc/specificCapacity.js calc/__tests__/specificCapacity.test.js
git commit -m "$(cat <<'EOF'
feat(calc): оценка параметров по удельному дебиту

Формулы вкладки «Проводимость» настольного АНСДИМАТ: T = 1.22·Q/s
для напорного пласта, k = 2.43·Q/(s(2m − s)) для безнапорного и
поправка f на несовершенство скважины рядом с K₀.

z_w — расстояние до середины фильтра: только так пример из справки
даёт те же 31.44454. Хвост ряда для тонкого фильтра оценивается
интегралом и сверен с прямым суммированием.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Вкладка «Оценка по Q/s»

**Files:**
- Create: `screens/calculator/SpecificCapacityTab.js`
- Test: `screens/calculator/__tests__/SpecificCapacityTab.test.js`
- Delete: `screens/calculator/ParamsTab.js`
- Modify: `screens/CalculatorScreen.js` (импорт `ParamsTab`, запись `params` в `TABS`)
- Modify: `calc/aquifer.js` (удалить `estimateConductivity`, `kozenyPenetrationFactor`, `DEFAULT_INFLUENCE_RATIO`, `AQUIFER_TYPES`, переписать шапку)
- Modify: `calc/__tests__/aquifer.test.js` (удалить два `describe` и лишние импорты)
- Modify: `Localization.js` (ru/en: удалить `influenceRadius`, `penetrationRatio`, `defaultInfluenceRatioNote`; добавить ключи `qs*`, `filterOutsideAquiferNote`, `filterFullThicknessNote`; переписать `manualCalcParams`, `manualCalculatorNote`)
- Modify: `screens/UserManualScreen.js` (запасные тексты `tabParams`, `manualCalcParams`, `manualCalculatorNote`)
- Test: `screens/calculator/__tests__/CalculatorScreen.test.js`

**Interfaces:**
- Consumes: `AQUIFERS`, `estimateFromSpecificCapacity` из `calc/specificCapacity.js` (Task 2); `FLOW_UNITS` из `calc/units.js` — массив `{ key, labelKey, factor }`; из `./shared`: `Card`, `Collapsible`, `Field({ label, value, onChange, unit, symbol, error, hint })`, `Formula`, `Notices({ codes, suffix, tone })`, `OptionRow({ options, value, onChange, tone })`, `ResultCard({ title, label, value, unit, rows })`, `SectionLabel`, `formatValue`, `parseNumber`; `Toggle({ value, onValueChange, accessibilityLabel })`.
- Produces: `export default function SpecificCapacityTab()`, `export const QS_FLOW_UNITS = ['m3_day', 'm3_hour', 'l_min', 'l_sec']`.

- [ ] **Step 1: Написать падающие тесты**

Create `screens/calculator/__tests__/SpecificCapacityTab.test.js`:

```js
/**
 * Вкладка «Оценка по Q/s»
 *
 * Расчёт покрыт в `calc/__tests__/specificCapacity.test.js`; здесь важно, что
 * вкладка упрощена, как просили: по умолчанию два поля, фильтр появляется
 * тумблером, безнапорный пласт спрашивает мощность, а выбранная единица
 * расхода читает набранное число, а не пересчитывает его.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../../theme';
import I18n from '../../../Localization';

const SpecificCapacityTab = require('../SpecificCapacityTab').default;

beforeAll(() => {
  I18n.locale = 'ru';
});

// React 19: renderer.create() надо оборачивать в act()
const mount = () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <SpecificCapacityTab />
      </PaperProvider>
    );
  });
  return tree;
};

/**
 * Строки поддерева
 *
 * @param {*} node - узел или дети узла
 * @returns {string[]} найденные строки
 */
function collect(node) {
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collect);
  if (node && node.props) return collect(node.props.children);
  return [];
}

const text = (tree) =>
  tree.root
    .findAll((node) => typeof node.type === 'string' && node.type.includes('Text'))
    .flatMap((node) => collect(node.props.children))
    .join(' ');

/** Поле ввода ячейки по её подписи */
const input = (tree, label) =>
  tree.root
    .findAll((node) => node.props?.accessibilityLabel === label && typeof node.type !== 'string')[0]
    .findByType(TextInput);

/** Нажимает вариант переключателя по подписи */
const pick = (tree, label) => {
  const option = tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'radio' &&
      typeof node.props.onPress === 'function' &&
      collect(node.props.children).includes(label)
  );
  act(() => option.props.onPress());
};

/** Переключает тумблер несовершенной скважины */
const toggleImperfect = (tree) => {
  const toggle = tree.root.find(
    (node) =>
      node.props?.accessibilityRole === 'switch' && typeof node.props.onPress === 'function'
  );
  act(() => toggle.props.onPress());
};

test('по умолчанию — напорный пласт, совершенная скважина: два поля и T', () => {
  const tree = mount();
  const screen = text(tree);

  expect(screen).toContain('Расход');
  expect(screen).toContain('Понижение в скважине');
  expect(screen).not.toContain('Длина фильтра');
  expect(screen).toContain('Водопроводимость');
  // Пример из справки настольной версии: 1.22·100/15
  expect(screen).toContain('8.133');
});

test('тумблер несовершенной скважины показывает фильтр и пересчитывает T', () => {
  const tree = mount();
  toggleImperfect(tree);
  const screen = text(tree);

  expect(screen).toContain('Длина фильтра');
  expect(screen).toContain('Середина фильтра');
  expect(screen).toContain('Анизотропия');
  expect(screen).toContain('Мощность пласта');
  expect(screen).toContain('31.445');
  expect(screen).toContain('k = T/m');
});

test('безнапорный пласт спрашивает мощность и считает k', () => {
  const tree = mount();
  pick(tree, 'Безнапорный');
  const screen = text(tree);

  expect(screen).toContain('Обводнённая мощность');
  expect(screen).toContain('0.6480');
  expect(screen).toContain('T = k·m');
});

test('смена единицы расхода оставляет число и меняет результат', () => {
  const tree = mount();
  pick(tree, 'л/сек');

  // 100 л/с = 8640 м³/сут: T = 1.22·8640/15
  expect(input(tree, 'Расход').props.value).toBe('100');
  expect(text(tree)).toContain('702.720');
});

test('фильтр за пределами пласта показывает ошибку вместо результата', () => {
  const tree = mount();
  toggleImperfect(tree);
  act(() => input(tree, 'Середина фильтра').props.onChangeText('0.5'));

  expect(text(tree)).toContain(I18n.t('filterOutsideAquiferNote'));
  expect(text(tree)).not.toContain('31.445');
});
```

В `screens/calculator/__tests__/CalculatorScreen.test.js` дописать в конец `describe`:

```js
  it('«Оценка по Q/s» по умолчанию считает T напорного пласта', () => {
    const tree = renderScreen();
    selectTab(tree, 2);
    // Пример из справки настольного АНСДИМАТ: Q = 100 м³/сут, s = 15 м
    expect(screenText(tree)).toContain('8.133');
  });
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx jest screens/calculator --maxWorkers=2`
Expected: FAIL — `Cannot find module '../SpecificCapacityTab'`; в `CalculatorScreen.test.js` нет «8.133» (старая вкладка считает безнапорный пласт по Дюпюи).

- [ ] **Step 3: Локализация**

В `Localization.js`, блок `ru`:

Было:
```js
    thickness: "Мощность пласта",
    influenceRadius: "Радиус влияния",
    penetrationRatio: "Доля вскрытия",
    transmissivity: "Водопроводимость",
    storativity: "Водоотдача",
    filtrationCoefficient: "Коэф. фильтрации k",
    pitRadius: "Радиус котлована r₀",
    defaultInfluenceRatioNote: "R и r₀ не заданы — принято R/r₀ = 300.",
    drawdownExceedsThicknessNote:
      "Понижение больше мощности пласта — проверьте исходные данные.",
```
Стало:
```js
    thickness: "Мощность пласта",
    transmissivity: "Водопроводимость",
    storativity: "Водоотдача",
    filtrationCoefficient: "Коэф. фильтрации k",
    pitRadius: "Радиус котлована r₀",
    drawdownExceedsThicknessNote:
      "Понижение больше мощности пласта — проверьте исходные данные.",

    // ===== ОЦЕНКА ПО Q/s =====
    qsWellDrawdown: "Понижение в скважине",
    qsSaturatedThickness: "Обводнённая мощность",
    qsFilterGroup: "Фильтр",
    qsFilterLength: "Длина фильтра",
    qsFilterMiddle: "Середина фильтра",
    qsFromTop: "от кровли пласта",
    qsFromLevel: "от статического уровня",
    qsAnisotropy: "Анизотропия",
    filterOutsideAquiferNote:
      "Фильтр выходит за пределы пласта: zw − lw/2 должно быть не меньше нуля, а zw + lw/2 — не больше m.",
    filterFullThicknessNote:
      "Фильтр на всю мощность пласта — скважина по сути совершенная, поправка f равна нулю.",
```

Было:
```js
    manualCalcParams:
      "Коэффициент фильтрации по данным одиночной откачки — формулы Дюпюи для напорного и безнапорного пласта, с поправкой Козени на несовершенство скважины.",
```
Стало:
```js
    manualCalcParams:
      "Водопроводимость напорного или коэффициент фильтрации безнапорного пласта по удельному дебиту Q/s — формулы настольного АНСДИМАТ, с поправкой на несовершенство скважины.",
```

Было:
```js
    manualCalculatorNote:
      "Радиус влияния R редко замеряют — его принимают из опыта работ. Если оставить поле пустым, берётся R = 300·r₀, и в результатах появляется предупреждение: значение оценочное.",
```
Стало:
```js
    manualCalculatorNote:
      "Оценка по Q/s даёт порядок величины по одному замеру: множители 1,22 и 2,43 уже содержат типичное отношение радиуса влияния к радиусу скважины. Точные параметры даёт обработка журнала откачки.",
```

Блок `en`:

Было:
```js
    thickness: "Aquifer thickness",
    influenceRadius: "Radius of influence",
    penetrationRatio: "Penetration ratio",
    transmissivity: "Transmissivity",
    storativity: "Storativity",
    filtrationCoefficient: "Conductivity k",
    pitRadius: "Pit radius r₀",
    defaultInfluenceRatioNote:
      "R and r₀ are not set — a ratio R/r₀ = 300 is assumed. Enter actual values for an accurate result.",
    drawdownExceedsThicknessNote:
      "Drawdown exceeds aquifer thickness — check the input data.",
```
Стало:
```js
    thickness: "Aquifer thickness",
    transmissivity: "Transmissivity",
    storativity: "Storativity",
    filtrationCoefficient: "Conductivity k",
    pitRadius: "Pit radius r₀",
    drawdownExceedsThicknessNote:
      "Drawdown exceeds aquifer thickness — check the input data.",

    // ===== ESTIMATE FROM Q/s =====
    qsWellDrawdown: "Drawdown in the well",
    qsSaturatedThickness: "Saturated thickness",
    qsFilterGroup: "Screen",
    qsFilterLength: "Screen length",
    qsFilterMiddle: "Screen midpoint",
    qsFromTop: "from aquifer top",
    qsFromLevel: "from static level",
    qsAnisotropy: "Anisotropy",
    filterOutsideAquiferNote:
      "The screen extends beyond the aquifer: zw − lw/2 must be at least zero and zw + lw/2 at most m.",
    filterFullThicknessNote:
      "The screen spans the full aquifer thickness — the well is effectively fully penetrating, f is zero.",
```

Было:
```js
    manualCalcParams:
      "Hydraulic conductivity from a single-well test — Dupuit formulas for confined and unconfined aquifers, with the Kozeny partial-penetration correction.",
```
Стало:
```js
    manualCalcParams:
      "Transmissivity of a confined or conductivity of an unconfined aquifer from specific capacity Q/s — the desktop ANSDIMAT formulas, with a partial-penetration correction.",
```

Было:
```js
    manualCalculatorNote:
      "The radius of influence R is rarely measured — it is taken from experience. Leave the field empty and R = 300·r₀ is used, with a warning that the result is an estimate.",
```
Стало:
```js
    manualCalculatorNote:
      "The Q/s estimate gives an order of magnitude from a single reading: the factors 1.22 and 2.43 already contain a typical ratio of the radius of influence to the well radius. Accurate parameters come from processing the pumping journal.",
```

В `screens/UserManualScreen.js`:

Было:
```js
              term: I18n.t('tabParams', { defaultValue: 'Параметры' }),
              definition: I18n.t('manualCalcParams', {
                defaultValue:
                  'Водопроводимость, пьезопроводность и радиус влияния по наклону прямой Купера — Джейкоба.',
              }),
```
Стало:
```js
              term: I18n.t('tabParams', { defaultValue: 'Оценка по Q/s' }),
              definition: I18n.t('manualCalcParams', {
                defaultValue:
                  'Водопроводимость напорного или коэффициент фильтрации безнапорного пласта по удельному дебиту Q/s — формулы настольного АНСДИМАТ, с поправкой на несовершенство скважины.',
              }),
```

Было:
```js
              'Радиус влияния R редко замеряют — его принимают из опыта работ. Если оставить поле пустым, берётся R = 300·r₀, и в результатах появляется предупреждение: значение оценочное.',
```
Стало:
```js
              'Оценка по Q/s даёт порядок величины по одному замеру: множители 1,22 и 2,43 уже содержат типичное отношение радиуса влияния к радиусу скважины. Точные параметры даёт обработка журнала откачки.',
```

- [ ] **Step 4: Написать вкладку**

Create `screens/calculator/SpecificCapacityTab.js`:

```js
/**
 * Вкладка «Оценка по Q/s»
 *
 * Упрощённая вкладка «Проводимость» диалога «Оценка параметров» настольного
 * АНСДИМАТ: по дебиту и понижению в опытной скважине — водопроводимость
 * напорного пласта или коэффициент фильтрации безнапорного.
 *
 * По умолчанию на экране два поля — Q и s: напорный пласт и совершенная
 * скважина покрывают большинство полевых оценок. Остальное появляется, только
 * когда оно нужно: мощность — у безнапорного пласта, фильтр — тумблером
 * несовершенной скважины.
 *
 * Размерность расхода выбирается прямо здесь, а не в общих настройках: дебит
 * берут из журнала в тех единицах, в которых его записали. При смене единицы
 * число в поле остаётся как набрано и читается в новой — сначала выбирают
 * размерность, потом вводят. Длины — в метрах, результат — в м²/сут и м/сут,
 * как в настольной версии.
 *
 * Значения по умолчанию — пример из справки настольной версии: открыв вкладку,
 * видно 8.133, а с тумблером 31.445 — сверка без набора.
 *
 * Математика — в [`calc/specificCapacity.js`](../../calc/specificCapacity.js).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../../Localization';
import { FLOW_UNITS } from '../../calc/units';
import { AQUIFERS, estimateFromSpecificCapacity } from '../../calc/specificCapacity';
import AppearIn from '../../components/ui/AppearIn';
import Toggle from '../../components/ui/Toggle';
import { type, spacing, fontFamily } from '../../theme';
import {
  Card,
  Collapsible,
  Field,
  Formula,
  Notices,
  OptionRow,
  ResultCard,
  SectionLabel,
  formatValue,
  parseNumber,
} from './shared';

/** Размерности расхода на вкладке — ключи из FLOW_UNITS */
export const QS_FLOW_UNITS = ['m3_day', 'm3_hour', 'l_min', 'l_sec'];

/**
 * Переводит расход из выбранной размерности в м³/сут
 *
 * @param {number} value - число из поля
 * @param {string} unitKey - ключ размерности
 * @returns {number} расход, м³/сут
 */
function flowToBase(value, unitKey) {
  const unit = FLOW_UNITS.find((item) => item.key === unitKey);
  return unit ? value / unit.factor : NaN;
}

export default function SpecificCapacityTab() {
  const theme = useTheme();

  const [aquifer, setAquifer] = useState(AQUIFERS.CONFINED);
  const [imperfect, setImperfect] = useState(false);
  const [qUnit, setQUnit] = useState('m3_day');
  const [qText, setQText] = useState('100');
  const [sText, setSText] = useState('15');
  const [mText, setMText] = useState('20');
  const [lwText, setLwText] = useState('2');
  const [zwText, setZwText] = useState('10');
  const [rwText, setRwText] = useState('0.1');
  const [anisotropyText, setAnisotropyText] = useState('1');

  const unconfined = aquifer === AQUIFERS.UNCONFINED;

  // Ряд поправки на несовершенство — до двадцати тысяч членов: пересчитывать
  // его на каждый рендер, а не на смену ввода, незачем
  const result = useMemo(
    () =>
      estimateFromSpecificCapacity({
        Q: flowToBase(parseNumber(qText), qUnit),
        s: parseNumber(sText),
        aquifer,
        imperfect,
        m: parseNumber(mText),
        lw: parseNumber(lwText),
        zw: parseNumber(zwText),
        rw: parseNumber(rwText),
        anisotropy: parseNumber(anisotropyText),
      }),
    [qText, qUnit, sText, aquifer, imperfect, mText, lwText, zwText, rwText, anisotropyText]
  );

  const invalid = (key) => result.invalid.includes(key);
  const meters = I18n.t('unitMeters');

  const aquifers = [
    { value: AQUIFERS.CONFINED, label: I18n.t('confined') },
    { value: AQUIFERS.UNCONFINED, label: I18n.t('unconfined') },
  ];

  const units = QS_FLOW_UNITS.map((key) => ({
    value: key,
    label: I18n.t(FLOW_UNITS.find((item) => item.key === key).labelKey),
  }));
  const unitLabel = units.find((item) => item.value === qUnit)?.label;

  const thicknessField = (label) => (
    <Field
      label={label}
      symbol="m"
      value={mText}
      onChange={setMText}
      unit={meters}
      error={invalid('m')}
    />
  );

  const secondaryRows = Number.isFinite(result.secondary)
    ? [
        unconfined
          ? {
              label: 'T = k·m',
              value: formatValue(result.secondary),
              unit: I18n.t('unitTransmissivity'),
            }
          : {
              label: 'k = T/m',
              value: formatValue(result.secondary),
              unit: I18n.t('unitMDay'),
            },
      ]
    : [];

  const formula = Number.isFinite(result.f)
    ? `${result.formula}\nf = ${formatValue(result.f)}`
    : result.formula;

  return (
    <>
      <AppearIn index={0}>
        <SectionLabel style={styles.firstLabel}>{I18n.t('aquiferType')}</SectionLabel>
        <OptionRow options={aquifers} value={aquifer} onChange={setAquifer} />

        <View style={[styles.switchRow, { backgroundColor: theme.colors.surfaceSunken }]}>
          <Text style={[type.body, styles.switchLabel, { color: theme.colors.text }]}>
            {I18n.t('imperfectWell')}
          </Text>
          <Toggle
            value={imperfect}
            onValueChange={setImperfect}
            accessibilityLabel={I18n.t('imperfectWell')}
          />
        </View>
      </AppearIn>

      <AppearIn index={1}>
        <SectionLabel>{I18n.t('wellPumpingGroup')}</SectionLabel>
        <OptionRow options={units} value={qUnit} onChange={setQUnit} tone="data" />
        <Card style={styles.spaced}>
          <Field
            label={I18n.t('flowRate')}
            symbol="Q"
            value={qText}
            onChange={setQText}
            unit={unitLabel}
            error={invalid('Q')}
          />
          <Field
            label={I18n.t('qsWellDrawdown')}
            symbol="sw"
            value={sText}
            onChange={setSText}
            unit={meters}
            error={invalid('s')}
          />
          {unconfined ? thicknessField(I18n.t('qsSaturatedThickness')) : null}
        </Card>
      </AppearIn>

      {imperfect ? (
        <AppearIn index={2}>
          <SectionLabel>{I18n.t('qsFilterGroup')}</SectionLabel>
          <Card>
            <Field
              label={I18n.t('qsFilterLength')}
              symbol="lw"
              value={lwText}
              onChange={setLwText}
              unit={meters}
              error={invalid('lw')}
            />
            <Field
              label={I18n.t('qsFilterMiddle')}
              symbol="zw"
              value={zwText}
              onChange={setZwText}
              unit={meters}
              hint={I18n.t(unconfined ? 'qsFromLevel' : 'qsFromTop')}
              error={invalid('zw')}
            />
            <Field
              label={I18n.t('wellRadius')}
              symbol="rw"
              value={rwText}
              onChange={setRwText}
              unit={meters}
              error={invalid('rw')}
            />
            <Field
              label={I18n.t('qsAnisotropy')}
              symbol="kz/kr"
              value={anisotropyText}
              onChange={setAnisotropyText}
              error={invalid('anisotropy')}
            />
            {unconfined ? null : thicknessField(I18n.t('thickness'))}
          </Card>
        </AppearIn>
      ) : null}

      <AppearIn index={3}>
        <ResultCard
          title={unconfined ? I18n.t('filtrationCoefficient') : I18n.t('transmissivity')}
          // У безнапорного обозначение уже в названии: «Коэф. фильтрации k»
          label={unconfined ? undefined : 'T'}
          value={formatValue(result.value)}
          unit={unconfined ? I18n.t('unitMDay') : I18n.t('unitTransmissivity')}
          rows={secondaryRows}
        />
        <Notices codes={result.errors} suffix="Note" tone="error" />
        <Notices codes={result.warnings} suffix="Note" />
        <Collapsible title={I18n.t('wellStatsGroup')} note="ƒ">
          <Formula>{formula}</Formula>
        </Collapsible>
      </AppearIn>
    </>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
  spaced: {
    marginTop: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 14,
  },
  switchLabel: {
    flex: 1,
    fontFamily: fontFamily.medium,
  },
});
```

- [ ] **Step 5: Подключить вкладку, удалить старую**

```bash
git rm screens/calculator/ParamsTab.js
```

В `screens/CalculatorScreen.js`:

Было:
```js
import ParamsTab from './calculator/ParamsTab';
```
Стало:
```js
import SpecificCapacityTab from './calculator/SpecificCapacityTab';
```

Было:
```js
  { key: 'params', labelKey: 'tabParams', Component: ParamsTab },
```
Стало:
```js
  { key: 'params', labelKey: 'tabParams', Component: SpecificCapacityTab },
```

- [ ] **Step 6: Убрать оценку по Дюпюи из `calc/aquifer.js`**

Заменить всё от начала файла до строки `/**` над `predictDrawdownTheis` (строки 1–138) на:

```js
/**
 * Прогноз понижения по методу Тейса
 *
 * Базовая формула нестационарного притока к совершенной скважине в
 * неограниченном напорном пласте. Ею пользуются анимация конуса депрессии
 * (`components/DepressionCone.js`) и сквозные проверки обработки
 * (`calc/__tests__/roundTrip.test.js`).
 *
 * Оценка параметров по удельному дебиту живёт в `calc/specificCapacity.js`:
 * там формулы настольного АНСДИМАТ, с которыми вкладка калькулятора обязана
 * сходиться. Прежняя оценка по Дюпюи с явными R и r₀ ушла вместе со старой
 * вкладкой — две разные формулы одного и того же расходились бы при первой
 * же сверке.
 */

```

(функция `predictDrawdownTheis` и комментарий о притоке в котлован в конце файла остаются без изменений).

В `calc/__tests__/aquifer.test.js` заменить шапку и импорты (строки 1–11) на:

```js
/**
 * Проверка прогноза понижения по Тейсу
 */

import { predictDrawdownTheis } from '../aquifer';
import { wellFunction } from '../wellFunction';
```

и удалить целиком `describe('estimateConductivity', …)` и `describe('kozenyPenetrationFactor', …)` (строки 13–120). `describe('predictDrawdownTheis', …)` остаётся.

- [ ] **Step 7: Проверить, что ссылок на удалённое не осталось**

Run: `grep -rn "estimateConductivity\|kozenyPenetrationFactor\|AQUIFER_TYPES\|DEFAULT_INFLUENCE_RATIO\|ParamsTab\|influenceRadius\|penetrationRatio\|defaultInfluenceRatio" --include='*.js' . | grep -v node_modules | grep -v "^./docs"`
Expected: пусто.

- [ ] **Step 8: Тесты зелёные, дублей нет**

Run: `npx jest screens/calculator calc/__tests__/aquifer.test.js calc/__tests__/specificCapacity.test.js calc/__tests__/roundTrip.test.js --maxWorkers=2`
Expected: PASS.

Run: скрипт проверки дублей из Global Constraints.
Expected: `clean`.

- [ ] **Step 9: Commit**

```bash
git add screens/calculator/SpecificCapacityTab.js screens/calculator/__tests__/SpecificCapacityTab.test.js screens/calculator/__tests__/CalculatorScreen.test.js screens/CalculatorScreen.js calc/aquifer.js calc/__tests__/aquifer.test.js Localization.js screens/UserManualScreen.js
git commit -m "$(cat <<'EOF'
feat: вкладка «Оценка по Q/s» по формулам настольного АНСДИМАТ

Вместо оценки k по Дюпюи с явными R и r₀ — вкладка «Проводимость»
настольной версии в упрощённом виде: тип пласта, тумблер
несовершенной скважины и по умолчанию два поля, Q и s. Размерность
расхода выбирается на месте: м³/сут, м³/час, л/мин, л/сек.

Напорный пласт даёт T, безнапорный — k, второй строкой пересчёт
через мощность. Значения по умолчанию — пример из справки: 8.133,
а с тумблером 31.445.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Запись без гонки с остановкой

**Files:**
- Modify: `hooks/useVoiceRecorder.js` (переписать целиком)
- Test: `hooks/__tests__/useVoiceRecorder.test.js` (переписать целиком)

**Interfaces:**
- Consumes: из `expo-audio` — `AudioModule.requestRecordingPermissionsAsync()`, `RecordingPresets.HIGH_QUALITY`, `setAudioModeAsync(mode)`, `useAudioRecorder(options)` → рекордер с `prepareToRecordAsync()`, `record()`, `stop()`, `getStatus()` → `{ isRecording, durationMillis, metering }`, `uri`. Из `lib/waveform.js` — `condense(levels)`, `levelFromMetering(db)`.
- Produces (без изменений для `PointSheet`): `useVoiceRecorder()` → `{ start(): Promise<boolean>, stop(): Promise<{uri, durationMillis, waveform}|null>, isRecording: boolean, durationMillis: number, levels: number[], denied: boolean }`; экспорты `METER_INTERVAL_MS` (100) и `MIN_RECORDING_MS` (600).

- [ ] **Step 1: Переписать тест**

Replace `hooks/__tests__/useVoiceRecorder.test.js` целиком:

```js
/**
 * Запись голосовой заметки
 *
 * Проверяется то, что нельзя увидеть глазами на устройстве: уровни копятся,
 * пока идёт запись, микрофон отпускается, а рекордер не опрашивается тогда,
 * когда нативная сторона его освобождает. Именно такой опрос на Android
 * бросал исключение в таймере и закрывал приложение после записи.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

// Названия с приставкой mock — требование babel-plugin-jest-hoist: фабрика
// jest.mock() поднимается над объявлениями и без приставки не видит их
const mockRecorder = {
  uri: 'file:///cache/recording.m4a',
  prepareToRecordAsync: jest.fn(async () => {}),
  record: jest.fn(() => {}),
  stop: jest.fn(async () => {}),
  getStatus: jest.fn(),
};

jest.mock('expo-audio', () => ({
  AudioModule: { requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true })) },
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioRecorder: jest.fn(() => mockRecorder),
  useAudioRecorderState: jest.fn(() => ({ isRecording: false, durationMillis: 0 })),
}));

const { AudioModule, setAudioModeAsync, useAudioRecorderState } = require('expo-audio');
const recorderModule = require('../useVoiceRecorder');

const useVoiceRecorder = recorderModule.default;
const { METER_INTERVAL_MS, MIN_RECORDING_MS } = recorderModule;

/**
 * Поднимает хук в пробном компоненте
 *
 * @returns {Promise<{box: Object, tree: Object}>} доступ к хуку и дерево
 */
async function mountHook() {
  const box = {};
  function Probe() {
    box.current = useVoiceRecorder();
    return <Text>probe</Text>;
  }
  let tree;
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  return { box, tree };
}

/**
 * Прокручивает таймеры внутри act: тики опроса обновляют состояние хука
 *
 * @param {number} ms - сколько прокрутить
 */
async function advance(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/**
 * Начинает запись
 *
 * @param {Object} box - доступ к хуку
 */
async function startRecording(box) {
  await act(async () => {
    await box.current.start();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockRecorder.uri = 'file:///cache/recording.m4a';
  mockRecorder.getStatus.mockImplementation(() => ({
    isRecording: true,
    durationMillis: 0,
    metering: -30,
  }));
  mockRecorder.stop.mockImplementation(async () => {});
  AudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
});

afterEach(() => {
  jest.useRealTimers();
});

test('старт готовит рекордер и включает микрофон', async () => {
  const { box } = await mountHook();

  let started;
  await act(async () => {
    started = await box.current.start();
  });

  expect(started).toBe(true);
  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: true })
  );
  expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalled();
  expect(mockRecorder.record).toHaveBeenCalled();
  expect(box.current.isRecording).toBe(true);
});

test('без доступа к микрофону запись не начинается', async () => {
  AudioModule.requestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
  const { box } = await mountHook();

  let started;
  await act(async () => {
    started = await box.current.start();
  });

  expect(started).toBe(false);
  expect(mockRecorder.record).not.toHaveBeenCalled();
  expect(box.current.denied).toBe(true);
});

test('библиотечный опрос состояния не используется', async () => {
  // useAudioRecorderState держит таймер всё время жизни шторки и зовёт
  // getStatus в том числе во время остановки
  await mountHook();

  expect(useAudioRecorderState).not.toHaveBeenCalled();
});

test('до старта рекордер не опрашивается', async () => {
  await mountHook();

  await advance(1000);

  expect(mockRecorder.getStatus).not.toHaveBeenCalled();
});

test('пока идёт запись, уровни копятся по тикам', async () => {
  const { box } = await mountHook();
  await startRecording(box);

  // -30 дБFS — середина шкалы, 0 — максимум, -60 — порог тишины
  mockRecorder.getStatus
    .mockImplementationOnce(() => ({ isRecording: true, durationMillis: 100, metering: -30 }))
    .mockImplementationOnce(() => ({ isRecording: true, durationMillis: 200, metering: 0 }))
    .mockImplementationOnce(() => ({ isRecording: true, durationMillis: 300, metering: -60 }));
  await advance(METER_INTERVAL_MS * 3);

  expect(box.current.levels).toEqual([0.5, 1, 0]);
  expect(box.current.durationMillis).toBe(300);
});

test('опрос снимается раньше, чем рекордер начинает останавливаться', async () => {
  // Остановка на Android идёт фоновым потоком и освобождает MediaRecorder.
  // Тик опроса в это время читал maxAmplitude освобождённого рекордера, и
  // исключение в таймере закрывало приложение
  const { box } = await mountHook();
  await startRecording(box);
  await advance(MIN_RECORDING_MS);

  let pollsAtStop = null;
  mockRecorder.stop.mockImplementation(async () => {
    pollsAtStop = mockRecorder.getStatus.mock.calls.length;
    // Пока нативная остановка идёт, таймеры продолжают тикать
    jest.advanceTimersByTime(METER_INTERVAL_MS * 5);
  });

  await act(async () => {
    await box.current.stop();
  });
  await advance(METER_INTERVAL_MS * 5);

  // Опрос шёл во время записи — и ни одного тика с момента остановки
  expect(pollsAtStop).toBeGreaterThan(0);
  expect(mockRecorder.getStatus.mock.calls.length).toBe(pollsAtStop);
});

test('сорвавшийся тик опроса не роняет запись', async () => {
  const { box } = await mountHook();
  await startRecording(box);
  mockRecorder.getStatus.mockImplementation(() => {
    throw new Error('getMaxAmplitude called in an invalid state');
  });

  await advance(METER_INTERVAL_MS * 3);

  expect(box.current.isRecording).toBe(true);
});

test('второе нажатие во время старта рекордер повторно не готовит', async () => {
  // Двойной тап звал prepareToRecordAsync дважды, и первый MediaRecorder
  // оставался держать микрофон
  let grant;
  AudioModule.requestRecordingPermissionsAsync.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      })
  );
  const { box } = await mountHook();

  let first;
  let second;
  await act(async () => {
    first = box.current.start();
    second = await box.current.start();
  });
  await act(async () => {
    grant({ granted: true });
    await first;
  });

  expect(second).toBe(false);
  expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
});

test('слишком ранний стоп дожидается минимальной длительности', async () => {
  // MediaRecorder.stop() сразу после start() бросает «stop failed» и
  // оставляет пустой файл
  const { box } = await mountHook();
  await startRecording(box);

  let stopping;
  await act(async () => {
    stopping = box.current.stop();
  });
  expect(mockRecorder.stop).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(MIN_RECORDING_MS);
    await stopping;
  });
  expect(mockRecorder.stop).toHaveBeenCalledTimes(1);
});

test('остановка отпускает микрофон', async () => {
  // С allowsRecording воспроизведение на iOS идёт тихо и через разговорный
  // динамик: записанное потом невозможно прослушать
  const { box } = await mountHook();
  await startRecording(box);
  await advance(MIN_RECORDING_MS);
  setAudioModeAsync.mockClear();

  await act(async () => {
    await box.current.stop();
  });

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: false })
  );
  expect(box.current.isRecording).toBe(false);
});

test('сорвавшаяся остановка всё равно отпускает микрофон', async () => {
  const { box } = await mountHook();
  await startRecording(box);
  await advance(MIN_RECORDING_MS);
  mockRecorder.stop.mockRejectedValueOnce(new Error('stop failed'));
  setAudioModeAsync.mockClear();

  await act(async () => {
    await expect(box.current.stop()).rejects.toThrow('stop failed');
  });

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ allowsRecording: false })
  );
  expect(box.current.isRecording).toBe(false);
});

test('остановка отдаёт адрес, длительность и волну', async () => {
  const { box } = await mountHook();
  await startRecording(box);
  mockRecorder.getStatus.mockImplementation(() => ({
    isRecording: true,
    durationMillis: 14_400,
    metering: -30,
  }));
  await advance(14_400);

  let recorded;
  await act(async () => {
    recorded = await box.current.stop();
  });

  expect(recorded.uri).toBe('file:///cache/recording.m4a');
  expect(recorded.durationMillis).toBe(14_400);
  // 144 тика прорежены до 40 столбиков
  expect(recorded.waveform).toHaveLength(40);
});

test('рекордер без файла ничего не возвращает', async () => {
  mockRecorder.uri = null;
  const { box } = await mountHook();
  await startRecording(box);
  await advance(MIN_RECORDING_MS);

  let recorded;
  await act(async () => {
    recorded = await box.current.stop();
  });

  expect(recorded).toBeNull();
});

test('размонтирование во время записи снимает опрос', async () => {
  const { box, tree } = await mountHook();
  await startRecording(box);
  await act(async () => {
    tree.unmount();
  });
  const polls = mockRecorder.getStatus.mock.calls.length;

  await advance(METER_INTERVAL_MS * 5);

  expect(mockRecorder.getStatus.mock.calls.length).toBe(polls);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest hooks/__tests__/useVoiceRecorder.test.js --maxWorkers=2`
Expected: FAIL — «библиотечный опрос состояния не используется» (хук зовёт `useAudioRecorderState`), «пока идёт запись, уровни копятся по тикам» (уровни берутся из замоканного состояния, а не из `getStatus`), `MIN_RECORDING_MS` не экспортирован.

- [ ] **Step 3: Переписать хук**

Replace `hooks/useVoiceRecorder.js` целиком:

```js
/**
 * Запись голосовой заметки для точки наблюдения
 *
 * Тап начинает, второй тап останавливает. Удержание, как в мессенджерах,
 * здесь не годится: описание скважины диктуют минуту, и всё это время нужно
 * держать палец, а случайный отрыв в перчатках обрывает запись.
 *
 * Волна строится по реальному сигналу: рекордер отдаёт metering в дБFS, он
 * снимается раз в METER_INTERVAL_MS и переводится в 0..1 (см. lib/waveform.js).
 *
 * Рекордер опрашивается здесь же, а не через `useAudioRecorderState`. Тот
 * держит таймер всё время жизни шторки и зовёт `getStatus` в том числе во
 * время остановки. На Android `getStatus` — синхронный вызов на JS-потоке: он
 * читает `MediaRecorder.maxAmplitude`, а `stop` в это же время на фоновом
 * потоке освобождает рекордер. Тик, попавший в это окно, бросал исключение
 * в таймере, и релизная сборка закрывалась — не каждый раз, а когда тик
 * совпадал с остановкой. Здесь опрос идёт только во время записи и снимается
 * до вызова `stop`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { condense, levelFromMetering } from '../lib/waveform';

/** Как часто снимается уровень сигнала */
export const METER_INTERVAL_MS = 100;

/**
 * Короче этого запись не останавливается
 *
 * `MediaRecorder.stop()` сразу после `start()` бросает «stop failed» и
 * оставляет пустой файл. Нажатие «стоп» раньше границы ждёт её.
 */
export const MIN_RECORDING_MS = 600;

/** Без isMeteringEnabled рекордер не отдаёт уровень, и волну рисовать нечем */
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

/** Режим звука без микрофона: проигрывание громко и через основной динамик */
const PLAYBACK_MODE = { allowsRecording: false, playsInSilentMode: true };

/**
 * Пауза на заданное время
 *
 * @param {number} ms - длительность
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @returns {Object} состояние и управление записью
 */
export default function useVoiceRecorder() {
  const recorder = useAudioRecorder(OPTIONS);

  const [isRecording, setIsRecording] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const [levels, setLevels] = useState([]);
  const [denied, setDenied] = useState(false);

  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const levelsRef = useRef([]);
  const durationRef = useRef(0);
  // Защита от двойного нажатия: пока идёт start или stop, второе ничего не делает
  const busyRef = useRef(false);
  const recordingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // Экран закрыли посреди записи — таймер не должен пережить шторку
  useEffect(() => stopPolling, [stopPolling]);

  /** Один тик опроса: уровень в волну, длительность на экран */
  const poll = useCallback(() => {
    let status;
    try {
      status = recorder.getStatus();
    } catch {
      // Сорвавшийся тик пропускается: следующий через METER_INTERVAL_MS
      return;
    }
    const elapsed = Date.now() - startedAtRef.current;
    const duration = status?.durationMillis > 0 ? status.durationMillis : elapsed;

    durationRef.current = duration;
    levelsRef.current = [...levelsRef.current, levelFromMetering(status?.metering)];
    setDurationMillis(duration);
    setLevels(levelsRef.current);
  }, [recorder]);

  /**
   * Начинает запись
   *
   * @returns {Promise<boolean>} началась ли запись
   */
  const start = useCallback(async () => {
    if (busyRef.current || recordingRef.current) return false;
    busyRef.current = true;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setDenied(true);
        return false;
      }
      setDenied(false);

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      levelsRef.current = [];
      durationRef.current = 0;
      setLevels([]);
      setDurationMillis(0);

      try {
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch (error) {
        // Микрофон отпускается и при сорвавшемся старте: иначе на iOS
        // заметки дальше играли бы тихо и через разговорный динамик
        await setAudioModeAsync(PLAYBACK_MODE).catch(() => {});
        throw error;
      }

      startedAtRef.current = Date.now();
      recordingRef.current = true;
      setIsRecording(true);
      stopPolling();
      timerRef.current = setInterval(poll, METER_INTERVAL_MS);
      return true;
    } finally {
      busyRef.current = false;
    }
  }, [recorder, poll, stopPolling]);

  /**
   * Останавливает запись и отдаёт готовую заметку
   *
   * @returns {Promise<{uri: string, durationMillis: number, waveform: number[]}|null>}
   */
  const stop = useCallback(async () => {
    if (busyRef.current || !recordingRef.current) return null;
    busyRef.current = true;
    try {
      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed < MIN_RECORDING_MS) await wait(MIN_RECORDING_MS - elapsed);

      // Опрос снимается ДО нативной остановки — см. шапку модуля
      stopPolling();
      const duration = Math.round(
        Math.max(durationRef.current, Date.now() - startedAtRef.current)
      );
      const captured = levelsRef.current;
      recordingRef.current = false;
      setIsRecording(false);

      try {
        await recorder.stop();
      } finally {
        // Микрофон отпускается сразу: пока allowsRecording включён, iOS
        // выводит звук тихо и через разговорный динамик
        await setAudioModeAsync(PLAYBACK_MODE);
        levelsRef.current = [];
        setLevels([]);
      }

      const uri = recorder.uri;
      if (!uri) return null;
      return { uri, durationMillis: duration, waveform: condense(captured) };
    } finally {
      busyRef.current = false;
    }
  }, [recorder, stopPolling]);

  return {
    start,
    stop,
    isRecording,
    durationMillis,
    levels,
    denied,
  };
}
```

- [ ] **Step 4: Тесты проходят**

Run: `npx jest hooks/__tests__/useVoiceRecorder.test.js components/__tests__/PointSheet.test.js --maxWorkers=2`
Expected: PASS (шторка мокает хук целиком, её тесты не меняются).

- [ ] **Step 5: Commit**

```bash
git add hooks/useVoiceRecorder.js hooks/__tests__/useVoiceRecorder.test.js
git commit -m "$(cat <<'EOF'
fix: вылет после записи голосовой заметки на Android

useAudioRecorderState опрашивал рекордер каждые 100 мс всё время
жизни шторки — и во время остановки. getStatus на Android идёт на
JS-потоке и читает maxAmplitude, а stop в то же время на фоновом
потоке освобождает MediaRecorder. Тик, попавший в это окно, бросал
исключение в таймере, и релизная сборка закрывалась.

Теперь опрос идёт только во время записи и снимается до stop, тик в
try/catch, двойное нажатие не готовит второй рекордер, а стоп раньше
600 мс ждёт границы — иначе MediaRecorder пишет пустой файл.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Проигрывание голосовых заметок

**Files:**
- Create: `hooks/useVoicePlayback.js`
- Test: `hooks/__tests__/useVoicePlayback.test.js`
- Modify: `components/PointSheet.js`
- Test: `components/__tests__/PointSheet.test.js`

**Interfaces:**
- Consumes: из `expo-audio` — `useAudioPlayer(source)` → плеер с `replace({ uri })`, `play()`, `pause()`, `seekTo(seconds): Promise`; `useAudioPlayerStatus(player)` → `{ playing, currentTime, duration, didJustFinish }` (секунды); `setAudioModeAsync(mode)`. Ключи локализации `playRecording` («Прослушать запись» / «Play recording») и `pauseRecording` («Пауза» / «Pause») уже есть в обеих локалях — новых ключей не заводить.
- Produces: `useVoicePlayback()` → `{ activeId: string|null, playing: boolean, progress: number, toggle(record: {id, uri}): Promise<void>, stop(): void }`.

- [ ] **Step 1: Написать падающий тест хука**

Create `hooks/__tests__/useVoicePlayback.test.js`:

```js
/**
 * Проигрывание голосовых заметок
 *
 * Один плеер на шторку: нажатие по заметке ставит её в плеер или ставит на
 * паузу, окончание возвращает к началу, остановка глушит звук.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

const mockPlayer = {
  replace: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(async () => {}),
};
let mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => {}),
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
}));

const { setAudioModeAsync, useAudioPlayer } = require('expo-audio');
const useVoicePlayback = require('../useVoicePlayback').default;

const FIRST = { id: 'a1', uri: 'file:///d/a1.m4a' };
const SECOND = { id: 'a2', uri: 'file:///d/a2.m4a' };

const box = {};
function Probe() {
  box.current = useVoicePlayback();
  return <Text>probe</Text>;
}

/**
 * Поднимает пробу
 *
 * @returns {Promise<Object>} дерево react-test-renderer
 */
async function mount() {
  let tree;
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  return tree;
}

/**
 * Плеер прислал новый статус
 *
 * @param {Object} tree - дерево пробы
 * @param {Object} next - изменившиеся поля статуса
 */
async function status(tree, next) {
  mockStatus = { ...mockStatus, ...next };
  await act(async () => {
    tree.update(<Probe />);
  });
}

/**
 * Нажатие по заметке
 *
 * @param {Object} record - заметка
 */
async function press(record) {
  await act(async () => {
    await box.current.toggle(record);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false };
});

test('плеер один и заводится без источника', async () => {
  await mount();

  expect(useAudioPlayer).toHaveBeenCalledWith(null);
});

test('нажатие по заметке ставит её в плеер и играет в беззвучном режиме', async () => {
  await mount();

  await press(FIRST);

  expect(setAudioModeAsync).toHaveBeenCalledWith(
    expect.objectContaining({ playsInSilentMode: true, allowsRecording: false })
  );
  expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: FIRST.uri });
  expect(mockPlayer.play).toHaveBeenCalled();
  expect(box.current.activeId).toBe('a1');
});

test('повторное нажатие по играющей заметке ставит паузу', async () => {
  const tree = await mount();
  await press(FIRST);
  await status(tree, { playing: true });
  mockPlayer.replace.mockClear();

  await press(FIRST);

  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(mockPlayer.replace).not.toHaveBeenCalled();
});

test('нажатие по заметке на паузе продолжает её с того же места', async () => {
  const tree = await mount();
  await press(FIRST);
  await status(tree, { playing: false, currentTime: 3, duration: 10 });
  mockPlayer.play.mockClear();

  await press(FIRST);

  expect(mockPlayer.play).toHaveBeenCalled();
  expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
});

test('нажатие по другой заметке меняет источник', async () => {
  const tree = await mount();
  await press(FIRST);
  await status(tree, { playing: true });

  await press(SECOND);

  expect(mockPlayer.replace).toHaveBeenLastCalledWith({ uri: SECOND.uri });
  expect(box.current.activeId).toBe('a2');
});

test('прогресс — доля проигранного', async () => {
  const tree = await mount();
  await press(FIRST);

  await status(tree, { playing: true, currentTime: 5, duration: 20 });

  expect(box.current.progress).toBe(0.25);
  expect(box.current.playing).toBe(true);
});

test('окончание ставит на паузу и возвращает к началу', async () => {
  // Без возврата повторное нажатие не проиграло бы ничего: плеер стоит в конце
  const tree = await mount();
  await press(FIRST);

  await status(tree, { playing: false, currentTime: 20, duration: 20, didJustFinish: true });

  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
  expect(box.current.activeId).toBeNull();
});

test('остановка глушит заметку и снимает её с плеера', async () => {
  const tree = await mount();
  await press(FIRST);
  await status(tree, { playing: true });

  act(() => {
    box.current.stop();
  });

  expect(mockPlayer.pause).toHaveBeenCalled();
  expect(box.current.activeId).toBeNull();
});

test('остановка без играющей заметки плеер не трогает', async () => {
  await mount();

  act(() => {
    box.current.stop();
  });

  expect(mockPlayer.pause).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest hooks/__tests__/useVoicePlayback.test.js --maxWorkers=2`
Expected: FAIL — `Cannot find module '../useVoicePlayback'`.

- [ ] **Step 3: Написать хук**

Create `hooks/useVoicePlayback.js`:

```js
/**
 * Проигрывание голосовых заметок точки
 *
 * Один плеер на шторку, а не на строку: плеер на каждую заметку завёл бы по
 * нативному проигрывателю на запись, хотя слушают их всё равно по одной.
 * Статус приходит событиями плеера — опроса здесь нет.
 *
 * Хук знает, что играет и где остановиться. Когда глушить звук — при
 * закрытии шторки, начале записи, удалении заметки — решает шторка.
 */

import { useCallback, useEffect, useState } from 'react';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

/**
 * @returns {{activeId: string|null, playing: boolean, progress: number,
 *   toggle: Function, stop: Function}} что играет и управление
 */
export default function useVoicePlayback() {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState(null);

  const finished = !!status?.didJustFinish;
  const playing = !!status?.playing;

  // Доигравшая заметка встаёт в начало: плеер остаётся в конце записи, и
  // следующее нажатие не проиграло бы ничего
  useEffect(() => {
    if (!finished) return;
    player.pause();
    Promise.resolve(player.seekTo(0)).catch(() => {});
    setActiveId(null);
  }, [finished, player]);

  /**
   * Играет заметку или ставит её на паузу
   *
   * @param {{id: string, uri: string}} record - голосовая заметка
   * @returns {Promise<void>}
   */
  const toggle = useCallback(
    async (record) => {
      if (record.id === activeId) {
        if (playing) player.pause();
        else player.play();
        return;
      }
      // Если в этом сеансе ещё ничего не записывали, режим звука не выставлен,
      // и на iPhone бесшумный переключатель глушит заметку
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      player.replace({ uri: record.uri });
      player.play();
      setActiveId(record.id);
    },
    [activeId, playing, player]
  );

  /** Глушит играющую заметку */
  const stop = useCallback(() => {
    if (activeId === null) return;
    player.pause();
    setActiveId(null);
  }, [activeId, player]);

  const duration = status?.duration > 0 ? status.duration : 0;
  const progress =
    activeId !== null && duration > 0 ? Math.min(1, (status?.currentTime ?? 0) / duration) : 0;

  return {
    activeId,
    playing: activeId !== null && playing,
    progress,
    toggle,
    stop,
  };
}
```

- [ ] **Step 4: Хук проходит**

Run: `npx jest hooks/__tests__/useVoicePlayback.test.js --maxWorkers=2`
Expected: PASS, 9 тестов.

- [ ] **Step 5: Написать падающие тесты шторки**

В `components/__tests__/PointSheet.test.js`:

1. Заменить строку `import React from 'react';` и добавить импорт `Modal`:

```js
import React from 'react';
import { Modal } from 'react-native';
```

2. После блока `jest.mock('../../hooks/useVoiceRecorder', …)` добавить:

```js
let mockPlayback;
jest.mock('../../hooks/useVoicePlayback', () => ({
  __esModule: true,
  default: () => mockPlayback,
}));
```

3. После `const PointSheet = require('../PointSheet').default;` добавить:

```js
const AudioWave = require('../AudioWave').default;
```

4. В `beforeEach` дописать последней строкой:

```js
  mockPlayback = { activeId: null, playing: false, progress: 0, toggle: jest.fn(async () => {}), stop: jest.fn() };
```

5. Дописать в конец файла:

```js
test('кнопка у заметки проигрывает именно её', async () => {
  const tree = mount();

  await act(async () => {
    button(tree, 'Прослушать запись').props.onPress();
  });

  expect(mockPlayback.toggle).toHaveBeenCalledWith(ATTACHMENTS[1]);
});

test('играющая заметка показывает паузу и закрашивает волну по ходу', () => {
  mockPlayback = { ...mockPlayback, activeId: 'a2', playing: true, progress: 0.25 };
  const tree = mount();

  expect(buttons(tree, 'Пауза')).toHaveLength(1);
  const wave = tree.root.findAll((node) => node.type === AudioWave)[0];
  expect(wave.props.progress).toBe(0.25);
});

test('закрытие шторки глушит проигрывание', () => {
  const onClose = jest.fn();
  const tree = mount({ onClose });

  act(() => {
    tree.root.findByType(Modal).props.onRequestClose();
  });

  expect(mockPlayback.stop).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

test('начало записи останавливает проигрывание раньше старта рекордера', async () => {
  // Запись и проигрывание делят аудиосессию: заметка, игравшая под запись,
  // попала бы в неё же через микрофон
  const tree = mount();

  await act(async () => {
    button(tree, 'Запись').props.onPress();
  });

  expect(mockPlayback.stop).toHaveBeenCalled();
  expect(mockPlayback.stop.mock.invocationCallOrder[0]).toBeLessThan(
    start.mock.invocationCallOrder[0]
  );
});

test('удаление играющей заметки останавливает проигрывание', async () => {
  mockPlayback = { ...mockPlayback, activeId: 'a2', playing: true };
  const tree = mount();

  await act(async () => {
    button(tree, 'Удалить запись').props.onPress();
  });
  await act(async () => {
    await tree.root.findByType('ConfirmDialog').props.onConfirm();
  });

  expect(mockPlayback.stop).toHaveBeenCalled();
});
```

- [ ] **Step 6: Убедиться, что тесты шторки падают**

Run: `npx jest components/__tests__/PointSheet.test.js --maxWorkers=2`
Expected: FAIL — нет кнопки «Прослушать запись» (значок ▶ — картинка), `stop` не вызывается.

- [ ] **Step 7: Подключить проигрывание в шторке**

В `components/PointSheet.js`:

Было:
```js
import React, { useState } from 'react';
```
Стало:
```js
import React, { useEffect, useState } from 'react';
```

Было:
```js
import useVoiceRecorder from '../hooks/useVoiceRecorder';
```
Стало:
```js
import useVoiceRecorder from '../hooks/useVoiceRecorder';
import useVoicePlayback from '../hooks/useVoicePlayback';
```

Было:
```js
  const recorder = useVoiceRecorder();
```
Стало:
```js
  const recorder = useVoiceRecorder();
  const playback = useVoicePlayback();
```

Было:
```js
  // Сбой записи: отказ микрофона, занятое устройство, отказ хранилища
  const [recordFailed, setRecordFailed] = useState(false);
```
Стало:
```js
  // Сбой записи: отказ микрофона, занятое устройство, отказ хранилища
  const [recordFailed, setRecordFailed] = useState(false);

  // Скрытая шторка не должна доигрывать заметку в пустоту: скрыть её может
  // не только кнопка, но и экран, переключившийся на другую точку
  const stopPlayback = playback.stop;
  useEffect(() => {
    if (!visible) stopPlayback();
  }, [visible, stopPlayback]);

  /** Закрывает шторку, заглушив проигрывание */
  const close = () => {
    playback.stop();
    onClose();
  };
```

Было:
```js
      if (!recorder.isRecording) {
        setRecordFailed(false);
        await recorder.start();
        return;
      }
```
Стало:
```js
      if (!recorder.isRecording) {
        setRecordFailed(false);
        // Запись и проигрывание делят аудиосессию: заметка, игравшая под
        // запись, попала бы в неё же через микрофон
        playback.stop();
        await recorder.start();
        return;
      }
```

Было:
```js
  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    setViewerIndex(null);
    if (target) await onDelete(target);
  };
```
Стало:
```js
  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    setViewerIndex(null);
    if (target && target.id === playback.activeId) playback.stop();
    if (target) await onDelete(target);
  };
```

Было:
```js
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
```
Стало:
```js
      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
```

Было:
```js
              {records.map((record) => (
                <VoiceRow
                  key={record.id}
                  record={record}
                  colors={colors}
                  onDelete={() => setPendingDelete(record)}
                />
              ))}
```
Стало:
```js
              {records.map((record) => {
                const active = playback.activeId === record.id;
                return (
                  <VoiceRow
                    key={record.id}
                    record={record}
                    colors={colors}
                    active={active}
                    playing={active && playback.playing}
                    progress={active ? playback.progress : 1}
                    onToggle={() => playback.toggle(record)}
                    onDelete={() => setPendingDelete(record)}
                  />
                );
              })}
```

Заменить `VoiceRow` целиком (JSDoc и функцию):

```js
/**
 * Строка голосовой заметки
 *
 * Волна занимает всю доступную ширину, длительность прижата к правому краю
 * моноширинным: у нескольких записей подряд цифры выстраиваются столбиком.
 * У играющей заметки волна закрашивается по мере проигрывания — AudioWave
 * для этого и принимает долю пройденного.
 *
 * @param {Object} props
 * @param {Object} props.record - вложение вида audio
 * @param {Object} props.colors - палитра темы
 * @param {boolean} props.active - заметка стоит в плеере
 * @param {boolean} props.playing - и сейчас играет
 * @param {number} props.progress - доля проигранного, 0..1
 * @param {Function} props.onToggle - играть или поставить на паузу
 * @param {Function} props.onDelete - запрос удаления
 */
function VoiceRow({ record, colors, active, playing, progress, onToggle, onDelete }) {
  return (
    <View style={[styles.voiceRow, { backgroundColor: colors.surfaceSunken }]}>
      <TouchableOpacity
        onPress={onToggle}
        style={styles.voicePlay}
        accessibilityRole="button"
        accessibilityLabel={playing ? I18n.t('pauseRecording') : I18n.t('playRecording')}
        accessibilityState={{ selected: active }}
      >
        <MaterialIcons
          name={playing ? 'pause' : 'play-arrow'}
          size={22}
          color={colors.primaryAccent}
        />
      </TouchableOpacity>
      <AudioWave
        levels={record.waveform}
        progress={progress}
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
```

В `StyleSheet.create` перед `voiceWave` добавить:

```js
  voicePlay: {
    padding: spacing.xs,
  },
```

- [ ] **Step 8: Тесты проходят**

Run: `npx jest components/__tests__/PointSheet.test.js hooks screens/__tests__/FieldDiaryScreen.test.js --maxWorkers=2`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add hooks/useVoicePlayback.js hooks/__tests__/useVoicePlayback.test.js components/PointSheet.js components/__tests__/PointSheet.test.js
git commit -m "$(cat <<'EOF'
feat: прослушивание голосовых заметок точки

Значок ▶ в строке заметки был картинкой без обработчика — записанное
нельзя было прослушать. Теперь это кнопка ▶/⏸ на один плеер на
шторку: волна закрашивается по ходу, доигравшая заметка встаёт в
начало, закрытие шторки, начало записи и удаление глушат звук.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Страница AnsSurf — полосы, окно скважины, подсказки

**Files:**
- Modify: `tools/anssurf-skin.css` (комментарии блока отступа строки ~250–270, два новых блока в конец)
- Modify: `tools/build-anssurf.js` (константы подсказок, `adaptTouchHints`, вызов в `buildPage`, экспорт, запуск `main` только из командной строки)
- Test: `tools/__tests__/buildAnssurf.test.js`
- Regenerate: `assets/anssurf/gidroizogipsy.html`, `assets/anssurf/gidroizogipsy-en.html`
- Modify: `components/AnsSurf.js` (индикаторы прокрутки WebView, описание `menuInset`)
- Test: `components/__tests__/AnsSurf.test.js`

**Interfaces:**
- Consumes: поставка `../.anssurf-src` (`gidroizogipsy.html`, `gidroizogipsy-en.html`, `ansdimat-export.js`).
- Produces: `module.exports = { TOUCH_HINTS, COARSE_POINTER, adaptTouchHints }` из `tools/build-anssurf.js`; `adaptTouchHints(html: string, name: string): string` бросает `Error` с текстом «поставка AnsSurf изменилась», если подсказка найдена не ровно один раз.

Подсказки поставки, найденные в бандле (каждая встречается ровно один раз):

| Страница | В поставке | Для касания |
|----------|-----------|-------------|
| ru | `Укажите положение скважины. Правая кнопка мыши — добавить скважину.` (баннер режима указания) | `Коснитесь карты там, где стоит скважина.` |
| ru | `Правая кнопка мыши на карте — добавить скважину.` (подсказка в панели шага) | `Чтобы добавить скважину, нажмите «Добавить скважину на карте» и коснитесь карты.` |
| ru | `Укажите положение скважины на карте (правая кнопка — добавить).` (режим ручного ввода) | `Укажите положение скважины касанием карты.` |
| en | `Indicate the well location. Right-click the map to add a well.` | `Tap the map where the well is.` |
| en | `Right-click the map to add a well.` | `To add a well, press “Add a well on the map” and tap the map.` |
| en | `Indicate the well location on the map (right-click to add).` | `Tap the map to set the well location.` |
| en | `Click the map…` (подпись кнопки в режиме указания) | `Tap the map…` |

Касание карты в режиме указания открывает окно скважины — это обработчик `click` карты (`if(st.placingWell)st.requestAddWell(...)`), он срабатывает и от касания. Кнопка режима — «Добавить скважину на карте» / «Add a well on the map».

- [ ] **Step 1: Написать падающие тесты**

Create `tools/__tests__/buildAnssurf.test.js`:

```js
/**
 * Сборка встраиваемого AnsSurf
 *
 * Поставка — чужой минифицированный бандл, и правки в него вносятся по
 * меткам. Пропавшая метка обязана ронять сборку, а не молча оставлять на
 * телефоне подсказку про правую кнопку мыши.
 */

const fs = require('fs');
const path = require('path');
const { TOUCH_HINTS, COARSE_POINTER, adaptTouchHints } = require('../build-anssurf');

const ASSETS = path.join(__dirname, '..', '..', 'assets', 'anssurf');

/**
 * Кусок бандла с подсказками — в том виде, в каком их отдаёт поставка
 *
 * @param {string} name - имя страницы
 * @returns {string} разметка
 */
const bundle = (name) =>
  TOUCH_HINTS[name].map(([mouse]) => `children:\`${mouse}\``).join(',');

test('подсказка про мышь на сенсорном экране сменяется подсказкой про касание', () => {
  const out = adaptTouchHints(bundle('gidroizogipsy.html'), 'gidroizogipsy.html');

  for (const [mouse, touch] of TOUCH_HINTS['gidroizogipsy.html']) {
    expect(out).toContain(`(${COARSE_POINTER}?\`${touch}\`:\`${mouse}\`)`);
  }
});

test('пропавшая подсказка роняет сборку', () => {
  expect(() => adaptTouchHints('<html></html>', 'gidroizogipsy.html')).toThrow(
    'поставка AnsSurf изменилась'
  );
});

test('подсказка, встреченная дважды, роняет сборку', () => {
  const twice = `${bundle('gidroizogipsy-en.html')},${bundle('gidroizogipsy-en.html')}`;

  expect(() => adaptTouchHints(twice, 'gidroizogipsy-en.html')).toThrow(
    'поставка AnsSurf изменилась'
  );
});

describe('собранные страницы', () => {
  for (const name of Object.keys(TOUCH_HINTS)) {
    test(`${name}: подсказки для касания и правила скина на месте`, () => {
      const html = fs.readFileSync(path.join(ASSETS, name), 'utf8');

      for (const [, touch] of TOUCH_HINTS[name]) {
        expect(html).toContain(touch);
      }
      expect(html).toContain('.hydro-map-pane:has(.hydro-well-modal-bg)');
      expect(html).toContain('scrollbar-width: none');
    });
  }
});
```

Create `components/__tests__/AnsSurf.test.js`:

```js
/**
 * Построитель карт в WebView
 *
 * Здесь проверяется то, что задаёт приложение, а не страница: системные
 * индикаторы прокрутки WebView выключены — полосы справа быть не должно.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { lightTheme } from '../../theme';

jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('../anssurfAsset', () => ({
  anssurfPageUri: jest.fn(async () => 'file:///android_asset/anssurf/gidroizogipsy.html'),
}));
jest.mock('../../share/anssurfExport', () => ({ saveAnsSurfExport: jest.fn() }));

const AnsSurf = require('../AnsSurf').default;

test('системные индикаторы прокрутки у WebView выключены', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <AnsSurf locale="ru" dark={false} menuInset={24} />
      </PaperProvider>
    );
  });

  const web = tree.root.findByType('WebView');
  expect(web.props.showsVerticalScrollIndicator).toBe(false);
  expect(web.props.showsHorizontalScrollIndicator).toBe(false);
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npx jest tools/__tests__/buildAnssurf.test.js components/__tests__/AnsSurf.test.js --maxWorkers=2`
Expected: FAIL — сборка при `require` запускает `main()` и не экспортирует `adaptTouchHints` (`TypeError: adaptTouchHints is not a function` или выход процесса); у WebView нет `showsVerticalScrollIndicator`.

- [ ] **Step 3: Подсказки в сборке**

В `tools/build-anssurf.js` после объявления `STEP_RENAME` добавить:

```js
/**
 * Подсказки про мышь, которым на сенсорном экране нужна замена
 *
 * На телефоне поставка пишет «Правая кнопка мыши — добавить скважину». Мыши
 * нет, и подсказка уводит в сторону от единственного рабочего способа:
 * в режиме «Добавить скважину на карте» коснуться карты.
 *
 * Строки не переписываются, а оборачиваются выражением: сенсорный экран
 * получает подсказку про касание, компьютер с мышью — прежнюю. Веб-сборка
 * приложения открывает те же страницы и в браузере на компьютере.
 *
 * Ключ — имя файла поставки, значение — пары «как в поставке → для касания».
 */
const TOUCH_HINTS = {
  'gidroizogipsy.html': [
    [
      'Укажите положение скважины. Правая кнопка мыши — добавить скважину.',
      'Коснитесь карты там, где стоит скважина.',
    ],
    [
      'Правая кнопка мыши на карте — добавить скважину.',
      'Чтобы добавить скважину, нажмите «Добавить скважину на карте» и коснитесь карты.',
    ],
    [
      'Укажите положение скважины на карте (правая кнопка — добавить).',
      'Укажите положение скважины касанием карты.',
    ],
  ],
  'gidroizogipsy-en.html': [
    [
      'Indicate the well location. Right-click the map to add a well.',
      'Tap the map where the well is.',
    ],
    [
      'Right-click the map to add a well.',
      'To add a well, press “Add a well on the map” and tap the map.',
    ],
    [
      'Indicate the well location on the map (right-click to add).',
      'Tap the map to set the well location.',
    ],
    ['Click the map…', 'Tap the map…'],
  ],
};

/**
 * Выражение, которое страница вычисляет при отрисовке: сенсорный ли экран
 *
 * `pointer: coarse` — основной указатель палец. Телефон и планшет — да,
 * компьютер с мышью — нет, даже с сенсорным экраном сбоку.
 */
const COARSE_POINTER =
  '(typeof matchMedia==="function"&&matchMedia("(pointer: coarse)").matches)';
```

После функции `renameFourthStep` добавить:

```js
/**
 * Меняет подсказки про мышь на подсказки про касание
 *
 * Подсказка в бандле — шаблонная строка в обратных кавычках. Она заменяется
 * выражением `(касание ? «для касания» : «как было»)`, которое годится в
 * любом месте, где стояла строка: в детях JSX, в тернарнике, в свойстве.
 *
 * Каждая подсказка обязана встретиться ровно один раз: ни одной — поставка
 * сменила текст, больше одной — замена задела бы чужое место.
 *
 * @param {string} html - разметка страницы
 * @param {string} name - имя файла поставки
 * @returns {string} разметка с подсказками для касания
 */
function adaptTouchHints(html, name) {
  let out = html;
  for (const [mouse, touch] of TOUCH_HINTS[name]) {
    const literal = `\`${mouse}\``;
    const count = out.split(literal).length - 1;
    if (count !== 1) {
      throw new Error(
        `Подсказка «${mouse}» найдена ${count} раз вместо одного: поставка AnsSurf изменилась`
      );
    }
    // Функция вместо строки замены: в строке `$` имел бы особый смысл
    out = out.replace(literal, () => `(${COARSE_POINTER}?\`${touch}\`:${literal})`);
  }
  return out;
}
```

В `buildPage`:

Было:
```js
  html = renameFourthStep(html, STEP_RENAME[name]);
  html = addSkin(html, skin);
```
Стало:
```js
  html = renameFourthStep(html, STEP_RENAME[name]);
  html = adaptTouchHints(html, name);
  html = addSkin(html, skin);
```

В шапке-комментарии модуля после пункта 5 добавить:

```js
 * 6. Подсказки «Правая кнопка мыши — добавить скважину» на сенсорном экране
 *    сменяются подсказкой про касание — см. `TOUCH_HINTS`.
```

В конце файла:

Было:
```js
main();
```
Стало:
```js
// Сборка запускается из командной строки; тест подключает модуль ради
// отдельных шагов и собирать страницы при этом не должен
if (require.main === module) main();

module.exports = { TOUCH_HINTS, COARSE_POINTER, adaptTouchHints };
```

- [ ] **Step 4: Скин**

В `tools/anssurf-skin.css`:

Было:
```css
/* ── Место под плавающее меню ──────────────────────────────────────────
 * Нижнее меню приложения висит поверх экрана. Содержимое прокручивается
 * под ним, и последняя строка — как правило кнопка выгрузки — оказывалась
 * под кнопкой «Справка».
 *
 * Отступ задаётся переменной: её выставляет приложение при загрузке, потому
 * что высота меню зависит от системного отступа снизу и известна только ему.
 */
```
Стало:
```css
/* ── Место у нижнего края экрана ───────────────────────────────────────
 * Плавающее меню приложения на картах спрятано, но приложение рисуется от
 * края до края: снизу под страницей лежит системная полоса навигации
 * Android. Последняя строка панели — как правило кнопка выгрузки — не должна
 * уходить под системные кнопки.
 *
 * Отступ задаётся переменной: её выставляет приложение, потому что высота
 * системной полосы известна только ему. Имя переменной осталось с тех пор,
 * как под ней было меню, — его знает мост `components/anssurfBridge.js`.
 */
```

Было:
```css
/* На карте отступ снимается: полотну лучше уходить под плавающее меню
   целиком, чем обрываться полосой фона. Панель под картой своё место
   под меню получает отдельно */
```
Стало:
```css
/* На карте отступ снимается: полотну лучше уходить под системную полосу
   целиком, чем обрываться полосой фона. Панель под картой своё место
   внизу получает отдельно */
```

Дописать в конец файла:

```css

/* ── Полосы прокрутки на сенсорном экране ──────────────────────────────
 * Десктопная тема поставки рисует классические полосы шириной 12 px
 * (`main::-webkit-scrollbar{width:12px}` с серой дорожкой) и держит полосу
 * у корня всегда (`html{overflow-y:scroll}`). Как только у полосы задана
 * ширина, Chrome на Android перестаёт рисовать тонкую накладную и отводит
 * под классическую место справа — на телефоне это серая дорожка вдоль всего
 * экрана. Пальцу полоса не нужна: прокрутка остаётся, прячется дорожка.
 * С мышью правило не срабатывает, и на компьютере полосы на месте.
 */
@media (pointer: coarse) {
  html {
    overflow-y: auto !important;
  }

  html,
  body,
  html.hydro-desktop #root > div > main,
  html.hydro-desktop #root > div > aside,
  html.hydro-desktop .hydro-stage > aside,
  html.hydro-desktop .hydro-map-pane,
  html.hydro-desktop .hydro-well-modal {
    scrollbar-width: none !important;
  }

  html::-webkit-scrollbar,
  body::-webkit-scrollbar,
  html.hydro-desktop #root > div > main::-webkit-scrollbar,
  html.hydro-desktop #root > div > aside::-webkit-scrollbar,
  html.hydro-desktop .hydro-stage > aside::-webkit-scrollbar,
  html.hydro-desktop .hydro-map-pane::-webkit-scrollbar,
  html.hydro-desktop .hydro-well-modal::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
}

/* ── Окно «Новая скважина» поверх панели шага ──────────────────────────
 * Окно в поставке — `position: fixed` с z-index 200, но рендерится внутри
 * слоя карты `relative z-0`. Такой слой заводит свой контекст наложения:
 * z-index окна действует только внутри карты, а сама карта лежит на нулевом
 * уровне. Панель шага идёт в разметке после неё и рисуется поверх — вместе
 * с кнопками окна, до которых становится не дотянуться.
 *
 * Пока окно открыто, слой карты поднимается выше панели и ленты шагов
 * (у той z-index 40). Высота окна ограничена экраном: при открытой
 * клавиатуре кнопки остаются достижимы прокруткой внутри окна.
 */
html.hydro-desktop .hydro-stage > .hydro-map-pane:has(.hydro-well-modal-bg) {
  z-index: 60 !important;
}

html.hydro-desktop .hydro-well-modal {
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
}
```

- [ ] **Step 5: Пересобрать страницы**

Run: `node tools/build-anssurf.js`
Expected:
```
gidroizogipsy.html: … КБ → … КБ
gidroizogipsy-en.html: … КБ → … КБ
Готово: …/assets/anssurf
```
Без ошибок «поставка AnsSurf изменилась».

Run: `git diff --stat assets/anssurf`
Expected: изменены оба файла.

- [ ] **Step 6: WebView без индикаторов прокрутки**

В `components/AnsSurf.js`:

Было:
```js
 * @param {number} [menuInset] - высота плавающего меню приложения, px
```
Стало:
```js
 * @param {number} [menuInset] - отступ страницы снизу под системную полосу, px
```

Было:
```js
          // Тема и выбранная подложка карты живут в localStorage страницы
          domStorageEnabled
```
Стало:
```js
          // Тема и выбранная подложка карты живут в localStorage страницы
          domStorageEnabled
          // Полосу прокрутки страница прячет сама (см. tools/anssurf-skin.css);
          // системный индикатор WebView поверх неё тоже не нужен
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
```

- [ ] **Step 7: Тесты проходят**

Run: `npx jest tools components/__tests__/AnsSurf.test.js components/__tests__/anssurfBridge.test.js --maxWorkers=2`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tools/anssurf-skin.css tools/build-anssurf.js tools/__tests__/buildAnssurf.test.js assets/anssurf/gidroizogipsy.html assets/anssurf/gidroizogipsy-en.html components/AnsSurf.js components/__tests__/AnsSurf.test.js
git commit -m "$(cat <<'EOF'
fix: карты гидроизогипс на телефоне — полоса, окно скважины, подсказки

Серую полосу справа рисовала десктопная тема поставки: 12-пиксельный
::-webkit-scrollbar и html{overflow-y:scroll}. На сенсорном экране
полосы сняты, прокрутка осталась.

Окно «Новая скважина» открывалось внутри слоя карты relative z-0, и
панель шага рисовалась поверх его кнопок — скважину нельзя было
сохранить. Пока окно открыто, слой карты поднимается над панелью.

Подсказки «Правая кнопка мыши — добавить скважину» на телефоне
сменяются подсказкой про касание.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Экран карт прячет плавающее меню

**Files:**
- Modify: `screens/MapsScreen.js`
- Test: `screens/__tests__/MapsScreen.test.js`

**Interfaces:**
- Consumes: `setMenuHidden(hidden: boolean)` из `components/chromeVisibility.js`; `useFocusEffect(callback)` из `@react-navigation/native`; `spacing.md` (12) из `theme.js`.
- Produces: `AnsSurf` получает `menuInset = Math.max(insets.bottom, spacing.md)` на устройстве и `spacing.md` в вебе.

- [ ] **Step 1: Написать падающий тест**

Create `screens/__tests__/MapsScreen.test.js`:

```js
/**
 * Экран карт гидроизогипс
 *
 * Экран — полноэкранный инструмент со своими шагами. Плавающее меню
 * приложения закрывало на нём панель шага и кнопки, поэтому на картах его
 * нет, а при уходе оно обязано вернуться: залипшее скрытие убрало бы меню
 * по всему приложению.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { lightTheme, spacing } from '../../theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../components/AnsSurf', () => 'AnsSurf');

const mockSetMenuHidden = jest.fn();
jest.mock('../../components/chromeVisibility', () => ({
  setMenuHidden: (hidden) => mockSetMenuHidden(hidden),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb) => {
    const React = require('react');
    React.useEffect(cb, [cb]);
  },
}));

const { LanguageContext } = require('../../LanguageContext');
const MapsScreen = require('../MapsScreen').default;

/**
 * Отрисовывает экран с заданным системным отступом снизу
 *
 * @param {number} bottom - высота системной полосы, px
 * @returns {Object} дерево отрисовки
 */
function mount(bottom) {
  let tree;
  act(() => {
    tree = renderer.create(
      <PaperProvider theme={lightTheme}>
        <SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom }}>
          <LanguageContext.Provider value={{ locale: 'ru' }}>
            <MapsScreen />
          </LanguageContext.Provider>
        </SafeAreaInsetsContext.Provider>
      </PaperProvider>
    );
  });
  return tree;
}

beforeEach(() => {
  mockSetMenuHidden.mockClear();
});

test('на картах плавающее меню спрятано, а при уходе возвращается', () => {
  const tree = mount(34);
  expect(mockSetMenuHidden).toHaveBeenLastCalledWith(true);

  act(() => tree.unmount());

  expect(mockSetMenuHidden).toHaveBeenLastCalledWith(false);
});

test('снизу страница отводит место только под системную полосу', () => {
  const tree = mount(34);

  expect(tree.root.findByType('AnsSurf').props.menuInset).toBe(34);
});

test('без системной полосы остаётся небольшое поле', () => {
  const tree = mount(0);

  expect(tree.root.findByType('AnsSurf').props.menuInset).toBe(spacing.md);
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx jest screens/__tests__/MapsScreen.test.js --maxWorkers=2`
Expected: FAIL — `setMenuHidden` не вызывается; `menuInset` равен `34 + MENU_BAR_HEIGHT`.

- [ ] **Step 3: Поправить экран**

Replace `screens/MapsScreen.js` целиком:

```js
/**
 * Карты гидроизогипс (AnsSurf)
 *
 * Экран — только рама: язык, тема, отступ снизу и строка о том, чем кончилась
 * выгрузка. Сам построитель живёт в
 * [`components/AnsSurf`](../components/AnsSurf.js) и на устройстве открывается
 * в WebView, а в вебе — в iframe.
 *
 * Карта занимает экран целиком и прокручивается внутри себя, поэтому внешней
 * прокрутки здесь нет: вложенная прокрутка отбирала бы у карты жесты.
 *
 * Плавающего меню на этом экране нет. Построитель — полноэкранный инструмент
 * со своими шагами, а меню висело поверх панели шага, закрывало её кнопки и
 * отнимало девяносто пикселей высоты у и без того тесного телефона. Назад на
 * главную — стрелкой в шапке.
 */

import React, { useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import I18n from '../Localization';
import { LanguageContext } from '../LanguageContext';
import AnsSurf from '../components/AnsSurf';
import { setMenuHidden } from '../components/chromeVisibility';
import { spacing, type } from '../theme';

export default function MapsScreen() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  // Через контекст, а не через хук: без провайдера хук падает, и экран
  // нельзя было бы отрисовать в тесте отдельно от приложения
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };

  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);

  // Меню прячется на время показа экрана и возвращается при уходе — иначе
  // скрытие залипло бы на всё приложение
  useFocusEffect(
    useCallback(() => {
      setMenuHidden(true);
      return () => setMenuHidden(false);
    }, [])
  );

  const handleSaved = useCallback((result) => {
    setFailed(false);
    if (!result?.saved) {
      setNotice('');
      return;
    }
    // Сколько файлов и какие: выгрузка растра идёт вместе с привязкой и
    // системой координат, и человек должен понимать, что окно «Поделиться»
    // откроется не один раз
    setNotice(
      result.shared
        ? I18n.t('mapsExportShared', { count: result.saved })
        : I18n.t('mapsExportSaved', { count: result.saved })
    );
  }, []);

  const handleError = useCallback((text) => {
    setFailed(true);
    setNotice(text || I18n.t('mapsFailed'));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {notice ? (
        <Text
          style={[
            type.caption,
            styles.notice,
            {
              color: failed ? theme.colors.error : theme.colors.textSecondary,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          {notice}
        </Text>
      ) : null}

      {/* Приложение рисуется от края до края: снизу под страницей лежит
          системная полоса навигации. Место под неё отводит сама страница,
          а не подложка снаружи — подложка обрезала бы карту полосой фона */}
      <AnsSurf
        locale={locale}
        dark={!!theme.dark}
        menuInset={Platform.OS === 'web' ? spacing.md : Math.max(insets.bottom, spacing.md)}
        onSaved={handleSaved}
        onError={handleError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notice: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
```

- [ ] **Step 4: Тест проходит**

Run: `npx jest screens/__tests__/MapsScreen.test.js components/__tests__/chromeVisibility.test.js --maxWorkers=2`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add screens/MapsScreen.js screens/__tests__/MapsScreen.test.js
git commit -m "$(cat <<'EOF'
fix: плавающее меню не закрывает панель карт гидроизогипс

Построитель карт — полноэкранный инструмент со своими шагами, а меню
«Главная / Настройки / Справка» висело поверх панели шага и её кнопок.
На экране карт меню прячется тем же механизмом, что у полноэкранного
графика, и возвращается при уходе. Снизу страница отводит место только
под системную полосу навигации.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Сквозная проверка

**Files:** без изменений кода. Если проверка найдёт дефект — правка оформляется отдельным шагом с тестом и коммитом.

- [ ] **Step 1: Весь набор тестов**

Run: `npx jest --silent --maxWorkers=2`
Expected: PASS, все наборы. Число тестов записать в отчёт.

- [ ] **Step 2: Дубли в локализации**

Run: скрипт проверки дублей из Global Constraints.
Expected: `clean`.

- [ ] **Step 3: Поднять веб-превью**

Bash в фоне, с выключенной песочницей:

```bash
cd "/Users/ilagulakin/Desktop/AI&CODE/ansdimat/ANSDIMAT_REPO" && ./node_modules/.bin/expo start --web --port 8081
```

Затем `preview_start({ url: 'http://localhost:8081' })`, `resize_window({ preset: 'mobile' })`, перезагрузка страницы. Кликать через `javascript_tool` (панель браузера часто скрыта): элементы — по `[aria-label]` и `[role="button"]`, ввод — нативным сеттером `value` плюс `dispatchEvent(new Event('input', {bubbles: true}))`.

- [ ] **Step 4: Калькулятор**

Открыть «Калькулятор», вкладку «Оценка по Q/s».
Проверить через `get_page_text`: есть «8.133», нет полей фильтра. Переключить тумблер «Несовершенная скважина» — есть «31.445» и «k = T/m». Выбрать «Безнапорный» — есть «Обводнённая мощность». Вкладок шесть, «Барража» нет, есть «Расчёт понижения».
Снять скриншот вкладки с числами по умолчанию.

- [ ] **Step 5: Карты гидроизогипс**

Открыть «Карты гидроизогипс».

1. Меню приложения скрыто: `document.querySelector('[aria-label="Главная"]')` — `null`.
2. Внутри iframe (`document.querySelector('iframe').contentDocument`):
   - `contentWindow.matchMedia('(pointer: coarse)').matches` — записать значение. Если `true`: `getComputedStyle(doc.querySelector('#root > div > main')).scrollbarWidth === 'none'`. Если `false` (эмуляция превью не выставляет грубый указатель) — проверить только, что правило есть в `<style data-ansdimat-skin>`, и отметить в отчёте, что полоса проверяется на устройстве.
   - Перейти к шагу «Скважины» ручным вводом, нажать «Добавить скважину на карте», отправить `click` в центр `.leaflet-container`.
   - Окно открылось: `doc.querySelector('.hydro-well-modal')` не `null`.
   - Кнопки окна не перекрыты: для каждой кнопки внутри `.hydro-well-modal` центр её прямоугольника через `doc.elementFromPoint(x, y)` попадает в саму кнопку или её потомка.
   - Скриншот с открытым окном.
3. Отменить окно, вернуться на главную — меню снова на месте: `[aria-label="Главная"]` найден.

- [ ] **Step 6: Остановить сервер и отчитаться**

Остановить фоновый процесс Expo. В отчёте: число тестов, скриншоты калькулятора и окна скважины, значение `pointer: coarse` в превью, и что вылет записи и полоса прокрутки окончательно проверяются на Android после сборки.
