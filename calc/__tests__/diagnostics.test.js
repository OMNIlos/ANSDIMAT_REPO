/**
 * Проверка диагностики режима фильтрации
 *
 * Эталоны берутся не из реализации, а из теории: на радиальном участке
 * производная понижения по ln t обязана выйти на полку Q/(4πT), непроницаемая
 * граница обязана эту полку удвоить, а переток — увести производную вниз.
 * Поэтому данные генерируются точными решениями (Тейс, отображение,
 * Хантуш), и проверяется, что диагностика читает их правильно.
 */

import {
  bourdetDerivative,
  diagnose,
  transmissivityFromPlateau,
  REGIMES,
} from '../diagnostics';
import { wellFunction } from '../wellFunction';
import { drawdownWithBoundary, BOUNDARY_TYPES } from '../boundaries';
import { leakyDrawdown } from '../leakage';

/** Параметры модельной откачки: обычный напорный пласт */
const Q = 500;      // м³/сут
const T = 250;      // м²/сут
const S = 1e-4;
const r = 50;       // м

/** Полка производной для этих параметров */
const PLATEAU = Q / (4 * Math.PI * T);

/**
 * Ряд времён, равномерный по логарифму — так и планируют замеры на откачке
 *
 * @param {number} from - начало, сут
 * @param {number} to - конец, сут
 * @param {number} count - число точек
 * @returns {number[]} времена
 */
function logSpaced(from, to, count) {
  const step = (Math.log10(to) - Math.log10(from)) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.pow(10, Math.log10(from) + i * step));
}

/** Понижение по Тейсу в бесконечном пласте */
function theis(t) {
  const u = (r * r * S) / (4 * T * t);
  return (Q / (4 * Math.PI * T)) * wellFunction(u);
}

describe('bourdetDerivative', () => {
  test('на радиальном участке производная выходит на полку Q/(4πT)', () => {
    const measurements = logSpaced(0.01, 10, 30).map((t) => ({ t, s: theis(t) }));
    const derivative = bourdetDerivative(measurements);

    const late = derivative.filter((p) => p.t > 1);
    expect(late.length).toBeGreaterThan(3);
    for (const point of late) {
      expect(point.d).toBeCloseTo(PLATEAU, 2);
    }
  });

  test('крайние замеры пропускаются: односторонняя производная даёт выброс', () => {
    const measurements = logSpaced(0.01, 10, 12).map((t) => ({ t, s: theis(t) }));
    const derivative = bourdetDerivative(measurements);

    expect(derivative.length).toBe(measurements.length - 2);
    expect(derivative[0].t).toBeGreaterThan(measurements[0].t);
  });

  test('меньше трёх замеров — производной нет', () => {
    expect(bourdetDerivative([{ t: 1, s: 1 }, { t: 2, s: 2 }])).toEqual([]);
  });

  test('нули и отрицательные времена отбрасываются, порядок не важен', () => {
    const measurements = [
      { t: 10, s: theis(10) },
      { t: 0, s: 0 },
      { t: 1, s: theis(1) },
      { t: -5, s: 3 },
      { t: 0.1, s: theis(0.1) },
      { t: 0.01, s: theis(0.01) },
    ];
    const derivative = bourdetDerivative(measurements);

    expect(derivative.length).toBeGreaterThan(0);
    for (let i = 1; i < derivative.length; i++) {
      expect(derivative[i].t).toBeGreaterThan(derivative[i - 1].t);
    }
  });
});

describe('diagnose', () => {
  test('чистый Тейс читается как радиальный поток', () => {
    const measurements = logSpaced(0.01, 10, 30).map((t) => ({ t, s: theis(t) }));
    const result = diagnose(measurements);

    expect(result.regime).toBe(REGIMES.RADIAL);
    expect(Math.abs(result.lateSlope)).toBeLessThan(0.15);
    expect(result.plateau).toBeCloseTo(PLATEAU, 2);
  });

  test('непроницаемая граница удваивает полку производной', () => {
    // Граница отнесена на 600 м: отражение доходит к середине опыта,
    // и в записи виден и радиальный участок, и выход на удвоенную полку
    const measurements = logSpaced(0.001, 100, 40).map((t) => ({
      t,
      s: drawdownWithBoundary(
        { Q, T, S, r, t, L: 600, type: BOUNDARY_TYPES.BARRIER },
        wellFunction
      ).s,
    }));

    const result = diagnose(measurements);

    expect(result.regime).toBe(REGIMES.BARRIER);
    // Удвоение — подпись именно непроницаемой границы
    expect(result.ratio).toBeGreaterThan(1.7);
    expect(result.ratio).toBeLessThan(2.3);
  });

  test('T берётся по радиальному участку, а не по удвоенной полке', () => {
    const measurements = logSpaced(0.001, 100, 40).map((t) => ({
      t,
      s: drawdownWithBoundary(
        { Q, T, S, r, t, L: 600, type: BOUNDARY_TYPES.BARRIER },
        wellFunction
      ).s,
    }));

    const { plateau } = diagnose(measurements);

    // По поздней полке вышло бы вдвое меньше — это и есть частая ошибка,
    // от которой диагностика защищает
    expect(transmissivityFromPlateau(Q, plateau)).toBeGreaterThan(T * 0.9);
    expect(transmissivityFromPlateau(Q, plateau)).toBeLessThan(T * 1.1);
  });

  test('переток из смежного пласта уводит производную вниз', () => {
    // Утечка подпитывает пласт, понижение стабилизируется — производная падает
    const measurements = logSpaced(0.001, 100, 40).map((t) => ({
      t,
      s: leakyDrawdown({ Q, T, S, r, t, B: 300 }).s,
    }));

    const result = diagnose(measurements);

    expect(result.regime).toBe(REGIMES.RECHARGE);
    expect(result.ratio).toBeLessThan(0.7);
  });

  test('ёмкость ствола отмечается и не попадает в радиальный участок', () => {
    // Пока опорожняется сам ствол, пласт ещё не включился: понижение растёт
    // почти линейно и лишь потом выходит на кривую Тейса. Множитель
    // (1 − e^(−t/tc)) даёт как раз такой плавный переход
    const tc = 0.02;
    const measurements = logSpaced(1e-4, 10, 34).map((t) => ({
      t,
      s: theis(t) * (1 - Math.exp(-t / tc)),
    }));
    const result = diagnose(measurements);

    expect(result.wellboreEndsAt).toBeGreaterThan(0);
    expect(result.warnings).toContain('wellboreStorage');
    expect(result.radialFrom).toBeGreaterThan(result.wellboreEndsAt);
    expect(result.regime).toBe(REGIMES.RADIAL);
  });

  test('замеров мало — честное «не определено», а не догадка', () => {
    const result = diagnose([{ t: 1, s: 0.2 }, { t: 2, s: 0.3 }]);

    expect(result.regime).toBe(REGIMES.UNCLEAR);
    expect(result.warnings).toContain('needMorePoints');
    expect(result.derivative).toEqual([]);
  });

  test('пустой ввод не роняет расчёт', () => {
    expect(() => diagnose(undefined)).not.toThrow();
    expect(diagnose([]).regime).toBe(REGIMES.UNCLEAR);
  });
});

describe('transmissivityFromPlateau', () => {
  test('полка производной возвращает исходную водопроводимость', () => {
    expect(transmissivityFromPlateau(Q, PLATEAU)).toBeCloseTo(T, 6);
  });

  test('согласуется с полкой, найденной по модельным данным', () => {
    const measurements = logSpaced(0.01, 10, 30).map((t) => ({ t, s: theis(t) }));
    const { plateau } = diagnose(measurements);

    // Допуск 2%: полка усредняется по конечному числу замеров
    expect(transmissivityFromPlateau(Q, plateau)).toBeGreaterThan(T * 0.98);
    expect(transmissivityFromPlateau(Q, plateau)).toBeLessThan(T * 1.02);
  });

  test('бессмысленные аргументы дают NaN, а не число', () => {
    expect(transmissivityFromPlateau(Q, 0)).toBeNaN();
    expect(transmissivityFromPlateau(Q, -1)).toBeNaN();
    expect(transmissivityFromPlateau(NaN, PLATEAU)).toBeNaN();
  });
});
