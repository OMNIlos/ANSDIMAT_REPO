/**
 * Веб-обвязка оформления: то, чего StyleSheet не умеет, а браузер требует
 *
 * 1. Начертания. expo-font объявляет каждое начертание Manrope и JetBrains
 *    Mono отдельным семейством с обычной насыщенностью: «Manrope_700Bold» для
 *    браузера — шрифт веса 400. Стиль вида `{ fontFamily: fontFamily.bold,
 *    fontWeight: '700' }` просит у него 700, и браузер дорисовывает жирность
 *    поверх уже жирных букв: текст расплывается и тяжелеет. А подпись
 *    `{ fontFamily: fontFamily.regular, fontWeight: '600' }` получает ту же
 *    синтетику вместо настоящего SemiBold.
 *
 *    Здесь у каждого семейства появляются грани всех весов: свой вес и всё,
 *    что легче, — его собственный файл; всё, что тяжелее, — файл нужной
 *    насыщенности. Итог — всегда настоящее начертание, а не нарисованное:
 *    семейство не становится светлее своего имени и честно тяжелеет, когда
 *    стиль просит больший вес.
 *
 * 2. Мелочи браузера, которые выдают веб-сборку: синяя вспышка при нажатии
 *    на телефоне, системное кольцо фокуса, толстые серые полосы прокрутки,
 *    белый фон документа под тёмной темой при прокрутке с оттяжкой.
 *
 * Нативной сборки модуль не касается — там свой `webPolish.js` с заглушками.
 */

import { useEffect, useState } from 'react';

/**
 * Семейства с их собственным весом и файлами по весам
 *
 * Файл берётся из правил, которые уже вставил expo-font: адрес шрифта знает
 * только он, и собирать его заново значило бы повторять его логику.
 */
const FAMILIES = [
  { family: 'Manrope_400Regular', group: 'manrope', weight: 400 },
  { family: 'Manrope_500Medium', group: 'manrope', weight: 500 },
  { family: 'Manrope_600SemiBold', group: 'manrope', weight: 600 },
  { family: 'Manrope_700Bold', group: 'manrope', weight: 700 },
  { family: 'Manrope_800ExtraBold', group: 'manrope', weight: 800 },
  { family: 'JetBrainsMono_400Regular', group: 'mono', weight: 400 },
  { family: 'JetBrainsMono_500Medium', group: 'mono', weight: 500 },
  { family: 'JetBrainsMono_600SemiBold', group: 'mono', weight: 600 },
];

/** Веса, для которых объявляются грани */
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** Дольше этого загрузку граней не ждём: лучше синтетика, чем пустой экран */
const FACES_TIMEOUT_MS = 1500;

/**
 * Адреса файлов по семействам из правил expo-font
 *
 * @returns {Map<string, string>} семейство → значение `src`
 */
function collectSources() {
  const sources = new Map();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      // Чужой стиль с другого домена: читать его правила браузер не даёт
      continue;
    }
    for (const rule of Array.from(rules ?? [])) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style
        .getPropertyValue('font-family')
        .replace(/["']/g, '')
        .trim();
      const src = rule.style.getPropertyValue('src');
      if (family && src && !sources.has(family)) sources.set(family, src);
    }
  }
  return sources;
}

/**
 * Какой файл отдать семейству на запрошенный вес
 *
 * @param {Object} entry - семейство из FAMILIES
 * @param {number} weight - запрошенный вес
 * @returns {Object} семейство, чей файл нужен
 */
function sourceFor(entry, weight) {
  if (weight <= entry.weight) return entry;
  const heavier = FAMILIES.filter(
    (one) => one.group === entry.group && one.weight <= weight
  );
  return heavier[heavier.length - 1] ?? entry;
}

/**
 * Объявляет грани всех весов и ждёт их загрузки
 *
 * @returns {Promise<void>} готово, когда грани загружены или вышло время
 */
async function installFaces() {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  const sources = collectSources();
  const faces = [];
  for (const entry of FAMILIES) {
    for (const weight of WEIGHTS) {
      const source = sources.get(sourceFor(entry, weight).family);
      if (!source) continue;
      const face = new FontFace(entry.family, source, {
        weight: String(weight),
        style: 'normal',
        display: 'block',
      });
      document.fonts.add(face);
      faces.push(face.load().catch(() => null));
    }
  }
  await Promise.race([
    Promise.all(faces),
    new Promise((resolve) => setTimeout(resolve, FACES_TIMEOUT_MS)),
  ]);
}

let facesPromise = null;

/**
 * Готовы ли настоящие начертания всех весов
 *
 * @param {boolean} fontsLoaded - expo-font закончил загрузку
 * @returns {boolean} можно показывать интерфейс
 */
export function useWebFontFaces(fontsLoaded) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!fontsLoaded) return undefined;
    let cancelled = false;
    facesPromise = facesPromise ?? installFaces().catch(() => {});
    facesPromise.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded]);

  return ready;
}

/** Правила, общие для всей веб-сборки */
const GLOBAL_CSS = `
html, body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  -webkit-text-size-adjust: 100%;
}
* {
  /* Страховка к граням выше: жирность дорисовывать нельзя никогда */
  font-synthesis: style;
  -webkit-tap-highlight-color: transparent;
  scrollbar-width: thin;
  scrollbar-color: var(--ans-scroll-thumb, rgba(107, 97, 105, 0.45)) transparent;
}
::selection {
  background: var(--ans-selection, rgba(114, 0, 47, 0.22));
}
/* Кольцо фокуса только для клавиатуры: у мыши и пальца его нет */
button:focus-visible,
[role="button"]:focus-visible,
[role="link"]:focus-visible,
[role="tab"]:focus-visible,
[role="radio"]:focus-visible,
[role="checkbox"]:focus-visible,
[role="switch"]:focus-visible {
  outline: 2px solid var(--ans-focus, #5B6CD9);
  outline-offset: 2px;
}
button:focus:not(:focus-visible),
[role="button"]:focus:not(:focus-visible) {
  outline: none;
}
/* Поле ввода в фокусе — бордовым кольцом бренда вместо голубого кольца
   браузера. Поля, где кольцо снято нарочно (ячейки калькулятора со своей
   полосой фокуса), не трогаются: RN-web помечает их классом outlineStyle */
input:not([class*="r-outlineStyle"]):focus,
textarea:not([class*="r-outlineStyle"]):focus {
  outline: 2px solid var(--ans-input-focus, rgba(114, 0, 47, 0.45));
  outline-offset: 0;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
`;

let cssInstalled = false;

/**
 * Вставляет общие правила один раз за жизнь страницы
 */
export function installWebGlobalStyles() {
  if (cssInstalled || typeof document === 'undefined') return;
  cssInstalled = true;
  const style = document.createElement('style');
  style.id = 'ansdimat-web-polish';
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
}

/**
 * Красит документ под тему
 *
 * Фон страницы виден там, где кончается приложение: при прокрутке с оттяжкой
 * и в момент перехода между экранами. Без этого под тёмной темой вспыхивала
 * белая полоса. `color-scheme` заодно переводит в тёмный вид встроенные
 * элементы браузера — выпадающие списки и календарь.
 *
 * @param {Object} theme - тема react-native-paper
 */
export function syncWebSurface(theme) {
  if (typeof document === 'undefined' || !theme?.colors) return;
  const root = document.documentElement;
  root.style.backgroundColor = theme.colors.background;
  document.body.style.backgroundColor = theme.colors.background;
  root.style.colorScheme = theme.dark ? 'dark' : 'light';
  root.style.setProperty(
    '--ans-scroll-thumb',
    theme.dark ? 'rgba(167, 159, 164, 0.35)' : 'rgba(107, 97, 105, 0.35)'
  );
  root.style.setProperty(
    '--ans-selection',
    theme.dark ? 'rgba(168, 68, 106, 0.4)' : 'rgba(114, 0, 47, 0.18)'
  );
  root.style.setProperty('--ans-focus', theme.dark ? '#8C99F0' : '#031888');
  root.style.setProperty(
    '--ans-input-focus',
    theme.dark ? 'rgba(217, 139, 170, 0.6)' : 'rgba(114, 0, 47, 0.42)'
  );
}
