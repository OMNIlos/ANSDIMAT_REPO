/**
 * Проверка налива в шурф в зону аэрации (формула Биндемана)
 *
 * Эталон — контрольный пример настольного АНСДИМАТ (отчёт «Опробование в
 * зоне аэрации. Налив в шурф», ANSDIMAT v.19.6.8): 3 л за 10 мин в шурф
 * площадью 2.5 м², слой воды 0.1 м, глубина просачивания 10 м, капиллярное
 * поднятие 0.3 м — программа даёт k = 0.1661538 м/сут.
 */

import {
  flowFromVolume,
  boldyrevConductivity,
  bindemanConductivity,
  processVadoseFill,
  capillaryRise,
  CAPILLARY_LITHOLOGY,
  VADOSE_METHODS,
} from '../vadoseFill';

/** Контрольный пример: всё в базовых единицах — м³, мин, м², м */
const REFERENCE = {
  volume: 0.003,
  interval: 10,
  area: 2.5,
  head: 0.1,
  depth: 10,
  capillary: 0.3,
};

/** Коэффициент фильтрации контрольного примера, м/сут */
const REFERENCE_K = 0.1661538;

describe('flowFromVolume', () => {
  test('3 л за 10 мин — это 0.432 м³/сут', () => {
    expect(flowFromVolume({ volume: 0.003, interval: 10 })).toBeCloseTo(0.432, 12);
  });

  test('без объёма или интервала расхода нет', () => {
    expect(flowFromVolume({ volume: 0, interval: 10 })).toBeNaN();
    expect(flowFromVolume({ volume: 0.003, interval: 0 })).toBeNaN();
  });
});

describe('bindemanConductivity', () => {
  test('воспроизводит k контрольного примера', () => {
    const k = bindemanConductivity({
      flow: flowFromVolume(REFERENCE),
      area: REFERENCE.area,
      head: REFERENCE.head,
      depth: REFERENCE.depth,
      capillary: REFERENCE.capillary,
    });
    expect(k / REFERENCE_K).toBeCloseTo(1, 6);
  });

  test('без капиллярных сил k выше: напор считается только гравитационным', () => {
    const common = { flow: 0.432, area: 2.5, head: 0.1, depth: 10 };
    const withCapillary = bindemanConductivity({ ...common, capillary: 0.3 });
    const without = bindemanConductivity({ ...common, capillary: 0 });
    expect(without).toBeGreaterThan(withCapillary);
    // k = Q·z/(F·(H+z)) = 0.432·10/(2.5·10.1)
    expect(without).toBeCloseTo((0.432 * 10) / (2.5 * 10.1), 12);
  });

  test('при глубоком просачивании сходится с формулой Болдырева', () => {
    // z ≫ H + H_c: отношение z/(H + H_c + z) стремится к единице, и (13.69)
    // переходит в (13.68). Это единственная связь между методами
    const common = { flow: 1, area: 2, head: 0.1, capillary: 0.3 };
    const deep = bindemanConductivity({ ...common, depth: 1e7 });
    expect(deep).toBeCloseTo(boldyrevConductivity({ flow: 1, area: 2 }), 6);
  });

  test('глубокая зона просачивания сводит k к Q/F', () => {
    // При z ≫ H + h_c отношение z/(H+h_c+z) → 1
    const deep = bindemanConductivity({
      flow: 1,
      area: 2,
      head: 0.1,
      depth: 1e6,
      capillary: 0.3,
    });
    expect(deep).toBeCloseTo(0.5, 6);
  });

  test('нулевой слой воды в шурфе допустим, нулевая глубина — нет', () => {
    expect(
      bindemanConductivity({ flow: 0.432, area: 2.5, head: 0, depth: 10 })
    ).toBeCloseTo((0.432 * 10) / (2.5 * 10), 12);
    expect(
      bindemanConductivity({ flow: 0.432, area: 2.5, head: 0.1, depth: 0 })
    ).toBeNaN();
  });

  test('без площади шурфа и расхода результата нет', () => {
    expect(bindemanConductivity({ flow: 0.432, area: 0, head: 0.1, depth: 10 })).toBeNaN();
    expect(bindemanConductivity({ flow: 0, area: 2.5, head: 0.1, depth: 10 })).toBeNaN();
  });
});

describe('processVadoseFill', () => {
  test('считает расход из объёма и времени, если он не задан', () => {
    const result = processVadoseFill(REFERENCE);
    expect(result.flow).toBeCloseTo(0.432, 12);
    expect(result.k / REFERENCE_K).toBeCloseTo(1, 6);
  });

  test('заданный расход важнее объёма с интервалом', () => {
    const result = processVadoseFill({ ...REFERENCE, flow: 0.864 });
    expect(result.flow).toBeCloseTo(0.864, 12);
    // Эталон напечатан с семью значащими цифрами, и удвоенное отношение
    // несёт его округление — сверяем на разряд грубее
    expect(result.k / REFERENCE_K).toBeCloseTo(2, 5);
  });

  test('выключенный учёт капиллярных сил переводит расчёт на Болдырева', () => {
    // Разд. 20.7: флажок «Учитывать капиллярное давление» выбирает метод, а
    // не обнуляет одно слагаемое. Без него считают по (13.68) k = Q/F, где
    // ни слоя воды, ни глубины просачивания нет вовсе
    const result = processVadoseFill({ ...REFERENCE, useCapillary: false });
    expect(result.capillary).toBe(0);
    expect(result.method).toBe(VADOSE_METHODS.BOLDYREV);
    expect(result.k).toBeCloseTo(0.432 / 2.5, 12);
  });

  test('с учётом капиллярных сил считает по Биндеману', () => {
    const result = processVadoseFill(REFERENCE);
    expect(result.method).toBe(VADOSE_METHODS.BINDEMAN);
  });

  test('Болдырев даёт больше Биндемана — результат завышен', () => {
    const boldyrev = processVadoseFill({ ...REFERENCE, useCapillary: false });
    const bindeman = processVadoseFill(REFERENCE);
    expect(boldyrev.k).toBeGreaterThan(bindeman.k);
  });

  test('второй контрольный пример книги: суглинок лёгкий', () => {
    // Разд. 20.7, рис. 20.50: те же 3 л за 10 мин, шурф 2.5 м², H = 0.1 м,
    // z = 10 м, H_c = 0.8 м → k = 0.1585321 м/сут
    const result = processVadoseFill({ ...REFERENCE, capillary: 0.8 });
    expect(result.k / 0.1585321).toBeCloseTo(1, 6);
  });
});

describe('boldyrevConductivity', () => {
  test('k = Q/F', () => {
    expect(boldyrevConductivity({ flow: 0.432, area: 2.5 })).toBeCloseTo(
      0.1728,
      12
    );
  });

  test('без площади и расхода результата нет', () => {
    expect(boldyrevConductivity({ flow: 0.432, area: 0 })).toBeNaN();
    expect(boldyrevConductivity({ flow: 0, area: 2.5 })).toBeNaN();
  });
});

describe('CAPILLARY_LITHOLOGY', () => {
  test('подставляет половину максимального капиллярного поднятия', () => {
    // Песок мелкозернистый: максимум 0.35…1.1 м, середина 0.725, половина
    const fineSand = CAPILLARY_LITHOLOGY.find((entry) => entry.id === 'fineSand');
    expect(capillaryRise(fineSand)).toBeCloseTo(0.3625, 12);
  });

  test('диапазоны заданы по возрастанию и не вывернуты', () => {
    for (const entry of CAPILLARY_LITHOLOGY) {
      expect(entry.hMax).toBeGreaterThan(entry.hMin);
      expect(entry.hMin).toBeGreaterThan(0);
    }
  });

  test('чем мельче порода, тем выше капиллярное поднятие', () => {
    const rises = CAPILLARY_LITHOLOGY.map(capillaryRise);
    for (let i = 1; i < rises.length; i += 1) {
      expect(rises[i]).toBeGreaterThan(rises[i - 1]);
    }
  });

  test('неизвестная порода не даёт числа', () => {
    expect(capillaryRise(undefined)).toBeNaN();
    expect(capillaryRise({ id: 'x' })).toBeNaN();
  });
});
