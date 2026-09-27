/**
 * Проверка обработки восстановления уровня
 *
 * Эталон строится синтетически: по заданной T генерируются «замеры» точно по
 * формуле Тейса s' = 0.183·Q/T·lg(t/t'), и обработка обязана вернуть исходную T.
 * Такая проверка ловит и ошибки в знаках, и путаницу t с t'.
 */

import {
  processRecovery,
  recoveryCompleteness,
  toRecoveryPoints,
  diffusivityFromRecovery,
  storageRatioFromIntercept,
} from '../recovery';
import { COOPER_JACOB_FACTOR } from '../cooperJacob';

describe('toRecoveryPoints', () => {
  test('считает x = lg(t/t′)', () => {
    // Откачка шла 100 мин; замер на 200-й минуте → t′ = 100, t/t′ = 2
    const [point] = toRecoveryPoints([{ t: 200, s: 1.5 }], 100);
    expect(point.x).toBeCloseTo(Math.log10(2), 12);
    expect(point.y).toBeCloseTo(1.5, 12);
    expect(point.tPrime).toBe(100);
  });

  test('отбрасывает замеры до остановки насоса', () => {
    const points = toRecoveryPoints(
      [
        { t: 50, s: 3 },
        { t: 100, s: 3 },
        { t: 150, s: 2 },
      ],
      100
    );
    expect(points).toHaveLength(1);
    expect(points[0].t).toBe(150);
  });

  test('без продолжительности откачки точек нет', () => {
    expect(toRecoveryPoints([{ t: 150, s: 2 }], 0)).toEqual([]);
  });
});

describe('processRecovery', () => {
  const Q = 500;
  const pumpingDuration = 120;

  /**
   * Генерирует замеры восстановления для заданной водопроводимости
   *
   * @param {number} T - водопроводимость, м²/сут
   * @returns {Array<{t: number, s: number}>} синтетические замеры
   */
  function synthetic(T) {
    const slope = (0.183 * Q) / T;
    return [130, 150, 180, 240, 360, 600, 1200].map((t) => ({
      t,
      s: slope * Math.log10(t / (t - pumpingDuration)),
    }));
  }

  test('восстанавливает исходную водопроводимость', () => {
    const T = 250;
    const result = processRecovery({
      measurements: synthetic(T),
      Q,
      pumpingDuration,
    });
    // 0.183 в генераторе округлено, точное значение 2.3/(4π)
    expect(Math.abs(result.T - T) / T).toBeLessThan(2e-3);
    expect(result.r2).toBeGreaterThan(0.999);
  });

  test('прямая проходит через начало координат', () => {
    const result = processRecovery({
      measurements: synthetic(250),
      Q,
      pumpingDuration,
    });
    expect(Math.abs(result.intercept)).toBeLessThan(1e-6);
    expect(result.warnings).not.toContain('recoveryInterceptNotZero');
  });

  test('предупреждает о сдвиге прямой', () => {
    // Постоянный сдвиг всех замеров на 1 м — признак влияния границ
    const shifted = synthetic(250).map((m) => ({ ...m, s: m.s + 1 }));
    const result = processRecovery({ measurements: shifted, Q, pumpingDuration });
    expect(result.warnings).toContain('recoveryInterceptNotZero');
  });

  test('строит прямую по двум выбранным точкам', () => {
    const T = 250;
    const measurements = synthetic(T);
    const points = toRecoveryPoints(measurements, pumpingDuration);
    const result = processRecovery({
      measurements,
      Q,
      pumpingDuration,
      twoPoints: [points[0], points[points.length - 1]],
    });
    expect(Math.abs(result.T - T) / T).toBeLessThan(2e-3);
  });

  test('без достаточного числа замеров возвращает NaN', () => {
    const result = processRecovery({
      measurements: [{ t: 130, s: 1 }],
      Q,
      pumpingDuration,
    });
    expect(result.T).toBeNaN();
    expect(result.warnings).toContain('needMoreMeasurements');
  });
});

describe('пьезопроводность по восстановлению', () => {
  // Табл. 3.13 АНСДИМАТ: lg a = lg(r²/2.25) + s₀/C − lg t₀, время в сутках
  const Q = 500;
  const T = 250;
  const a = 5000;
  const r = 12;
  const pumpingDuration = 720; // 12 ч
  const C = (COOPER_JACOB_FACTOR * Q) / T;

  /**
   * Понижение на конец откачки по Куперу — Джейкобу
   *
   * s₀ = C·lg(2.25·a·t₀/r²), время в сутках: именно эта точка замыкает
   * уравнение для пьезопроводности
   */
  const finalDrawdown =
    C * Math.log10((2.25 * a * (pumpingDuration / 1440)) / (r * r));

  /** Замеры остаточного понижения точно по прямой Тейса */
  const measurements = [780, 840, 960, 1200, 1800, 3000].map((t) => ({
    t,
    s: C * Math.log10(t / (t - pumpingDuration)),
  }));

  test('возвращает заданную пьезопроводность', () => {
    const value = diffusivityFromRecovery({
      slope: C,
      finalDrawdown,
      pumpingDuration,
      r,
    });
    expect(value / a).toBeCloseTo(1, 6);
  });

  test('обработка отдаёт a и водоотдачу S = T/a', () => {
    const result = processRecovery({
      measurements,
      Q,
      pumpingDuration,
      r,
      finalDrawdown,
    });
    expect(result.a / a).toBeCloseTo(1, 4);
    expect(result.S / (T / a)).toBeCloseTo(1, 4);
  });

  test('без расстояния и без понижения на остановке остаётся прочерк', () => {
    const noRadius = processRecovery({ measurements, Q, pumpingDuration, finalDrawdown });
    const noDrawdown = processRecovery({ measurements, Q, pumpingDuration, r });
    expect(noRadius.a).toBeNaN();
    expect(noRadius.S).toBeNaN();
    expect(noDrawdown.a).toBeNaN();
  });

  test('минуты журнала переводятся в сутки формулы', () => {
    // Без поправки lg 1440 пьезопроводность вышла бы ровно в 1440 раз меньше
    const value = diffusivityFromRecovery({
      slope: C,
      finalDrawdown,
      pumpingDuration,
      r,
    });
    const naive = Math.pow(
      10,
      Math.log10((r * r) / 2.25) + finalDrawdown / C - Math.log10(pumpingDuration)
    );
    expect(value / naive).toBeCloseTo(1440, 3);
  });
});

describe('storageRatioFromIntercept', () => {
  test('прямая из начала координат даёт S/S′ = 1', () => {
    expect(storageRatioFromIntercept(0.5, 0)).toBeCloseTo(1, 12);
  });

  test('отсечка в один наклон даёт десятикратное расхождение', () => {
    expect(storageRatioFromIntercept(0.5, 0.5)).toBeCloseTo(10, 9);
  });

  test('без наклона отношения нет', () => {
    expect(storageRatioFromIntercept(0, 0.5)).toBeNaN();
  });
});

describe('recoveryCompleteness', () => {
  test('восстановление завершено при остатке ниже 5 %', () => {
    expect(recoveryCompleteness(0.1, 5).complete).toBe(true);
    expect(recoveryCompleteness(0.5, 5).complete).toBe(false);
  });

  test('считает долю невосстановленного уровня', () => {
    expect(recoveryCompleteness(0.5, 5).ratio).toBeCloseTo(0.1, 12);
  });

  test('без максимального понижения ничего не считает', () => {
    expect(recoveryCompleteness(0.5, 0).ratio).toBeNaN();
  });
});
