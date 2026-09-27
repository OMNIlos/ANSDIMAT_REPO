import {
  PIT_LITHOLOGY,
  WELL_LITHOLOGY,
  findLithology,
  storativityFromSs,
} from '../lithology';

describe('справочники грунтов', () => {
  it('у каждой породы положительный коэффициент фильтрации', () => {
    [...PIT_LITHOLOGY, ...WELL_LITHOLOGY].forEach((entry) => {
      expect(entry.k).toBeGreaterThan(0);
    });
  });

  it('идентификаторы внутри справочника уникальны', () => {
    [PIT_LITHOLOGY, WELL_LITHOLOGY].forEach((catalog) => {
      const ids = catalog.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('водоотдача пород водозабора лежит в физичных пределах', () => {
    WELL_LITHOLOGY.forEach((entry) => {
      expect(entry.Sy).toBeGreaterThan(0);
      expect(entry.Sy).toBeLessThan(0.5);
      expect(entry.Ss).toBeGreaterThan(0);
    });
  });

  it('проницаемость падает от гравия к глине', () => {
    const gravel = findLithology(WELL_LITHOLOGY, 'gravel');
    const clay = findLithology(WELL_LITHOLOGY, 'clay');
    expect(gravel.k).toBeGreaterThan(clay.k);
  });

  it('неизвестный идентификатор не находится', () => {
    expect(findLithology(PIT_LITHOLOGY, 'basalt')).toBeUndefined();
  });
});

describe('storativityFromSs', () => {
  // Веб-калькулятор при мощности 25 м подставляет для мелкого песка S = 0.0075
  it('переводит справочную ёмкость в водоотдачу пласта', () => {
    const fineSand = findLithology(WELL_LITHOLOGY, 'fineSand');
    expect(storativityFromSs(fineSand.Ss, 25)).toBeCloseTo(0.0075, 10);
  });

  it('без мощности значение не определено', () => {
    expect(storativityFromSs(3e-4, 0)).toBeNaN();
  });
});
