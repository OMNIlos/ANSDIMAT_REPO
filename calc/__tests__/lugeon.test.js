/**
 * Проверка обработки поинтервальных нагнетаний (метод Люжона)
 *
 * Эталон — контрольный пример настольного АНСДИМАТ (отчёт «Пакерное
 * опробование (метод Люжона)», ANSDIMAT v.19.6.8): пять ступеней, десять
 * отсчётов расходомера на ступень, и посчитанные программой k по Мойе и Lu
 * по каждой ступени. Совпадение с ним ловит и путаницу в единицах (л/мин
 * против м³/сут), и подмену константы g.
 */

import {
  stageFlow,
  moyeConductivity,
  thiemConductivity,
  lugeonValue,
  lugeonClass,
  classifyLugeon,
  processLugeon,
  LUGEON_PATTERNS,
  LUGEON_FORMULAS,
  LUGEON_CLASSES,
  LUGEON_TO_CONDUCTIVITY,
  GRAVITY,
} from '../lugeon';

/** Показания расходомера по ступеням, м³; отсчёт раз в минуту */
const STAGES = [
  {
    pressure: 286132.4,
    readings: [8.836, 8.852, 8.867, 8.883, 8.899, 8.915, 8.931, 8.947, 8.962, 8.979],
  },
  {
    pressure: 417132.8,
    readings: [9.023, 9.043, 9.062, 9.083, 9.103, 9.123, 9.144, 9.164, 9.184, 9.204],
  },
  {
    pressure: 551580.6,
    readings: [9.252, 9.276, 9.3, 9.325, 9.348, 9.372, 9.396, 9.421, 9.445, 9.469],
  },
  {
    pressure: 420580.2,
    readings: [9.5, 9.52, 9.539, 9.559, 9.579, 9.599, 9.618, 9.638, 9.658, 9.678],
  },
  {
    pressure: 289579.8,
    readings: [9.715, 9.73, 9.745, 9.76, 9.775, 9.79, 9.805, 9.82, 9.835, 9.849],
  },
];

/** Геометрия опыта контрольного примера */
const GEOMETRY = { lw: 10, rw: 0.1, interval: 1 };

/** Средний расход по ступеням, л/мин — из отчёта */
const REFERENCE_FLOW = [15.88889, 20.11111, 24.11111, 19.77778, 14.88889];
/** Коэффициент фильтрации по ступеням, м/сут — из отчёта */
const REFERENCE_K = [
  6.132514e-2, 5.324437e-2, 4.827477e-2, 5.193268e-2, 0.0567814,
];
/** Параметр Люжона по ступеням — из отчёта */
const REFERENCE_LU = [5.552985, 4.821273, 4.371276, 4.702499, 5.14155];

describe('stageFlow', () => {
  test('считает средний расход по приращению показаний расходомера', () => {
    // (8.979 − 8.836) / 9 мин = 0.0158889 м³/мин = 22.88 м³/сут
    expect(stageFlow({ readings: STAGES[0].readings, interval: 1 })).toBeCloseTo(
      22.88,
      9
    );
  });

  test('совпадает со средним расходом отчёта во всех ступенях, л/мин', () => {
    STAGES.forEach((stage, index) => {
      const litersPerMinute =
        (stageFlow({ readings: stage.readings, interval: 1 }) * 1000) / 1440;
      expect(litersPerMinute).toBeCloseTo(REFERENCE_FLOW[index], 4);
    });
  });

  test('пропуски в середине не ломают расчёт', () => {
    const withGaps = [8.836, null, undefined, NaN, 8.899];
    // Крайние отсчёты те же, интервалов четыре
    expect(stageFlow({ readings: withGaps, interval: 1 })).toBeCloseTo(
      ((8.899 - 8.836) / 4) * 1440,
      9
    );
  });

  test('без интервала и по одному отсчёту расхода нет', () => {
    expect(stageFlow({ readings: [1, 2], interval: 0 })).toBeNaN();
    expect(stageFlow({ readings: [1], interval: 1 })).toBeNaN();
    expect(stageFlow({ readings: [], interval: 1 })).toBeNaN();
  });
});

describe('moyeConductivity', () => {
  test('воспроизводит k отчёта по каждой ступени', () => {
    STAGES.forEach((stage, index) => {
      const flow = stageFlow({ readings: stage.readings, interval: 1 });
      const k = moyeConductivity({
        flow,
        pressure: stage.pressure,
        lw: GEOMETRY.lw,
        rw: GEOMETRY.rw,
      });
      // Отчёт печатает семь значащих цифр — сверяем в этих пределах
      expect(k / REFERENCE_K[index]).toBeCloseTo(1, 5);
    });
  });

  test('плотность жидкости входит множителем', () => {
    const common = { flow: 22.88, pressure: 286132.4, lw: 10, rw: 0.1 };
    const light = moyeConductivity({ ...common, density: 500 });
    const normal = moyeConductivity({ ...common, density: 1000 });
    expect(light).toBeCloseTo(normal / 2, 12);
  });

  test('интервал короче диаметра скважины формулой не описан', () => {
    // 1 + ln(l_w/2r_w) ≤ 0 при l_w/r_w < 2/e
    expect(
      moyeConductivity({ flow: 10, pressure: 1e5, lw: 0.05, rw: 0.1 })
    ).toBeNaN();
  });

  test('без давления и расхода результата нет', () => {
    expect(moyeConductivity({ flow: 0, pressure: 1e5, lw: 10, rw: 0.1 })).toBeNaN();
    expect(moyeConductivity({ flow: 10, pressure: 0, lw: 10, rw: 0.1 })).toBeNaN();
  });

  test('константа g — та, что в настольном АНСДИМАТ', () => {
    expect(GRAVITY).toBe(9.81);
  });
});

describe('lugeonValue', () => {
  test('воспроизводит Lu отчёта по каждой ступени', () => {
    STAGES.forEach((stage, index) => {
      const flow = stageFlow({ readings: stage.readings, interval: 1 });
      const lu = lugeonValue({ flow, pressure: stage.pressure, lw: GEOMETRY.lw });
      expect(lu / REFERENCE_LU[index]).toBeCloseTo(1, 5);
    });
  });

  test('единица Люжона по определению: 1 л/мин на метр при 1 МПа', () => {
    // 1 л/мин = 1.44 м³/сут
    expect(lugeonValue({ flow: 1.44, pressure: 1e6, lw: 1 })).toBeCloseTo(1, 12);
  });

  test('обратно пропорционален давлению', () => {
    const at1 = lugeonValue({ flow: 10, pressure: 1e6, lw: 10 });
    const at2 = lugeonValue({ flow: 10, pressure: 2e6, lw: 10 });
    expect(at2).toBeCloseTo(at1 / 2, 12);
  });
});

describe('classifyLugeon', () => {
  test('равные значения — ламинарный поток, представительно среднее', () => {
    const { pattern, representative } = classifyLugeon([5, 5, 5, 5, 5]);
    expect(pattern).toBe(LUGEON_PATTERNS.LAMINAR);
    expect(representative).toBeCloseTo(5, 12);
  });

  test('провал на пике давления — турбулентный поток', () => {
    const { pattern, representative } = classifyLugeon([10, 6, 3, 6, 10]);
    expect(pattern).toBe(LUGEON_PATTERNS.TURBULENT);
    expect(representative).toBe(10);
  });

  test('всплеск на пике давления — расширение трещин', () => {
    const { pattern, representative } = classifyLugeon([3, 6, 12, 6, 3]);
    expect(pattern).toBe(LUGEON_PATTERNS.DILATION);
    expect(representative).toBe(3);
  });

  test('рост от ступени к ступени — размыв', () => {
    const { pattern, representative } = classifyLugeon([2, 4, 7, 10, 14]);
    expect(pattern).toBe(LUGEON_PATTERNS.WASHOUT);
    expect(representative).toBe(14);
  });

  test('падение от ступени к ступени — заполнение трещин', () => {
    const { pattern, representative } = classifyLugeon([14, 10, 7, 4, 2]);
    expect(pattern).toBe(LUGEON_PATTERNS.VOID_FILLING);
    expect(representative).toBe(2);
  });

  test('не пять ступеней — вид не определён', () => {
    expect(classifyLugeon([5, 5, 5]).pattern).toBe(LUGEON_PATTERNS.UNKNOWN);
  });
});

describe('processLugeon', () => {
  test('средние по опыту совпадают с отчётом', () => {
    const result = processLugeon({ stages: STAGES, ...GEOMETRY });
    expect(result.meanK / 5.431167e-2).toBeCloseTo(1, 5);
    expect(result.meanLu / 4.917916).toBeCloseTo(1, 5);
  });

  test('отдаёт строку на каждую ступень с давлением и расходом', () => {
    const result = processLugeon({ stages: STAGES, ...GEOMETRY });
    expect(result.stages).toHaveLength(5);
    expect(result.stages[2].pressure).toBe(551580.6);
    expect(result.stages[2].flow).toBeCloseTo(((9.469 - 9.252) / 9) * 1440, 9);
  });

  test('контрольный пример — петля прямого и обратного хода', () => {
    // Давление поднято до третьей ступени и опущено обратно. Lu на пике
    // меньше, чем на краях (4.37 против 5.55), а обратный ход повторяет
    // прямой — по Хоулсби это турбулентный поток, и представительным
    // считается значение при наименьшем давлении
    const { pattern, representativeLu } = processLugeon({
      stages: STAGES,
      ...GEOMETRY,
    });
    expect(pattern).toBe(LUGEON_PATTERNS.TURBULENT);
    expect(representativeLu / 5.552985).toBeCloseTo(1, 5);
  });

  test('незаполненная ступень не роняет средние', () => {
    const withEmpty = [...STAGES, { pressure: NaN, readings: [] }];
    const result = processLugeon({ stages: withEmpty, ...GEOMETRY });
    expect(result.stages).toHaveLength(6);
    expect(result.stages[5].k).toBeNaN();
    expect(result.meanK / 5.431167e-2).toBeCloseTo(1, 5);
  });

  test('пустой опыт даёт NaN, а не ноль', () => {
    const result = processLugeon({ stages: [], ...GEOMETRY });
    expect(result.meanK).toBeNaN();
    expect(result.meanLu).toBeNaN();
  });
});

describe('thiemConductivity', () => {
  test('даёт результат, близкий к формуле Мойе', () => {
    // Книга (разд. 13.6.2): «Формулы (13.66) и (13.67) дают близкие
    // результаты». Радиус влияния по умолчанию равен длине интервала
    const common = { flow: 22.88, pressure: 286132.4, lw: 10, rw: 0.1 };
    const moye = moyeConductivity(common);
    const thiem = thiemConductivity(common);
    expect(thiem / moye).toBeGreaterThan(0.8);
    expect(thiem / moye).toBeLessThan(1.25);
  });

  test('считает по напору Δh = ΔP/(ρg)', () => {
    const flow = 22.88;
    const pressure = 286132.4;
    const lw = 10;
    const rw = 0.1;
    const head = pressure / (1000 * GRAVITY);
    const expected = (flow / (2 * Math.PI * lw * head)) * Math.log(lw / rw);
    expect(thiemConductivity({ flow, pressure, lw, rw })).toBeCloseTo(expected, 12);
  });

  test('радиус влияния можно задать своим', () => {
    const common = { flow: 10, pressure: 1e5, lw: 10, rw: 0.1 };
    const wide = thiemConductivity({ ...common, influenceRadius: 100 });
    const narrow = thiemConductivity({ ...common, influenceRadius: 10 });
    // ln(R/r_w) растёт с радиусом влияния, значит и k
    expect(wide).toBeGreaterThan(narrow);
  });

  test('радиус влияния меньше радиуса скважины формулой не описан', () => {
    expect(
      thiemConductivity({ flow: 10, pressure: 1e5, lw: 10, rw: 0.1, influenceRadius: 0.05 })
    ).toBeNaN();
  });

  test('плотность жидкости входит множителем', () => {
    const common = { flow: 10, pressure: 1e5, lw: 10, rw: 0.1 };
    expect(thiemConductivity({ ...common, density: 500 })).toBeCloseTo(
      thiemConductivity({ ...common, density: 1000 }) / 2,
      12
    );
  });
});

describe('lugeonClass', () => {
  test('разбивает шкалу так же, как табл. 13.5', () => {
    expect(lugeonClass(0.5).id).toBe('veryLow');
    expect(lugeonClass(3).id).toBe('low');
    expect(lugeonClass(10).id).toBe('moderate');
    expect(lugeonClass(30).id).toBe('medium');
    expect(lugeonClass(75).id).toBe('high');
    expect(lugeonClass(500).id).toBe('veryHigh');
  });

  test('границы отходят к верхнему классу', () => {
    expect(lugeonClass(1).id).toBe('low');
    expect(lugeonClass(5).id).toBe('moderate');
    expect(lugeonClass(100).id).toBe('veryHigh');
  });

  test('не число классом не описывается', () => {
    expect(lugeonClass(NaN)).toBeNull();
    expect(lugeonClass(-1)).toBeNull();
  });

  test('диапазоны идут по возрастанию и покрывают шкалу целиком', () => {
    for (let i = 1; i < LUGEON_CLASSES.length; i += 1) {
      expect(LUGEON_CLASSES[i].max).toBeGreaterThan(LUGEON_CLASSES[i - 1].max);
    }
    expect(LUGEON_CLASSES[LUGEON_CLASSES.length - 1].max).toBe(Infinity);
  });

  test('оценочный перевод Lu в коэффициент фильтрации', () => {
    // 1 Lu ≈ 1.3·10⁻⁷ м/с ≈ 0.011 м/сут (Fell et al., 2005)
    expect(LUGEON_TO_CONDUCTIVITY).toBeCloseTo(1.3e-7 * 86400, 3);
  });
});

describe('processLugeon: выбор формулы', () => {
  test('по умолчанию считает по Мойе', () => {
    const result = processLugeon({ stages: STAGES, ...GEOMETRY });
    expect(result.formula).toBe(LUGEON_FORMULAS.MOYE);
    expect(result.meanK / 5.431167e-2).toBeCloseTo(1, 5);
  });

  test('формула Тима переключает расчёт k, но не параметр Люжона', () => {
    const moye = processLugeon({ stages: STAGES, ...GEOMETRY });
    const thiem = processLugeon({
      stages: STAGES,
      ...GEOMETRY,
      formula: LUGEON_FORMULAS.THIEM,
    });
    expect(thiem.formula).toBe(LUGEON_FORMULAS.THIEM);
    expect(thiem.meanK).not.toBeCloseTo(moye.meanK, 6);
    // Lu от способа расчёта k не зависит: это отдельная зависимость (13.65)
    expect(thiem.meanLu).toBeCloseTo(moye.meanLu, 12);
  });

  test('обе формулы дают один порядок', () => {
    const moye = processLugeon({ stages: STAGES, ...GEOMETRY });
    const thiem = processLugeon({
      stages: STAGES,
      ...GEOMETRY,
      formula: LUGEON_FORMULAS.THIEM,
    });
    expect(thiem.meanK / moye.meanK).toBeGreaterThan(0.8);
    expect(thiem.meanK / moye.meanK).toBeLessThan(1.25);
  });
});

describe('processLugeon: класс трещиноватости', () => {
  test('контрольный пример попадает в умеренный класс', () => {
    // Представительное Lu = 5.55 → диапазон 5—15
    const result = processLugeon({ stages: STAGES, ...GEOMETRY });
    expect(result.rockClass.id).toBe('moderate');
  });

  test('класс берётся по представительному значению, а не по среднему', () => {
    // Петля с провалом на пике: среднее 4.92 попало бы в «низкую», а
    // представительное 5.55 — в «умеренную»
    const result = processLugeon({ stages: STAGES, ...GEOMETRY });
    expect(result.meanLu).toBeLessThan(5);
    expect(result.representativeLu).toBeGreaterThan(5);
    expect(result.rockClass.id).toBe('moderate');
  });

  test('без ступеней класса нет', () => {
    expect(processLugeon({ stages: [], ...GEOMETRY }).rockClass).toBeNull();
  });
});
