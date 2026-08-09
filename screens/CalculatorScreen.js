/**
 * Калькулятор гидрогеолога — расчёты, нужные в поле
 *
 * 1. Коэффициент фильтрации — пересчёт значения по всем единицам сразу.
 * 2. Оценка параметров — k по данным опытной откачки.
 * 3. Прогноз понижения — метод Тейса.
 * 4. Приток в котлован — стационарная формула Дюпюи.
 * 5. Барраж — граничные условия пласта методом отображений и подпор
 *    уровня перед непроницаемым сооружением.
 * 6. Инфильтрационные утечки — пласт с перетеканием (Хантуш — Джейкоб).
 *
 * Вся математика вынесена в `calc/` и покрыта тестами: экран только
 * собирает ввод и показывает результат, поэтому формулы проверяются
 * отдельно от интерфейса.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../Localization';
import { convertToAllUnits, FILTRATION_UNITS } from '../calc/units';
import {
  estimateConductivity,
  predictDrawdownTheis,
  pitInflow,
  AQUIFER_TYPES,
} from '../calc/aquifer';
import { wellFunction } from '../calc/wellFunction';
import { BOUNDARY_TYPES, barrageRise, drawdownWithBoundary } from '../calc/boundaries';
import { leakageFactor, leakageRate, leakyDrawdown, steadyLeakyDrawdown } from '../calc/leakage';
import DepressionCone from '../components/DepressionCone';
import { spacing, radius, type, elevation, numericAt } from '../theme';

const TABS = [
  { key: 'filtration', labelKey: 'tabFiltration' },
  { key: 'params', labelKey: 'tabParams' },
  { key: 'forecast', labelKey: 'tabForecast' },
  { key: 'pit', labelKey: 'tabPit' },
  { key: 'barrage', labelKey: 'tabBarrage' },
  { key: 'leakage', labelKey: 'tabLeakage' },
];

/**
 * Разбирает число, принимая запятую как разделитель
 *
 * @param {string} text - введённый текст
 * @returns {number} число или NaN
 */
function parseNumber(text) {
  if (typeof text !== 'string') return Number(text);
  const normalized = text.replace(',', '.').trim();
  return normalized === '' ? NaN : Number(normalized);
}

/**
 * Форматирует результат расчёта
 *
 * Очень малые и очень большие значения показываем в экспоненциальной
 * записи: коэффициент фильтрации в м/сек — это порядка 10⁻⁵.
 *
 * @param {number} value - значение
 * @returns {string} отформатированное значение
 */
function formatValue(value) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 0.001 || abs >= 1e6)) return value.toExponential(4);
  if (abs >= 1000) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(3);
  return value.toPrecision(4);
}

export default function CalculatorScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState('filtration');

  // Та же ширина, что у карточек: контент ограничен 720 px и отбит полями
  const contentWidth = Math.min(width, 720) - spacing.lg * 2;

  // Коэффициент фильтрации
  const [kValue, setKValue] = useState('5');
  const [kUnit, setKUnit] = useState('m_day');

  // Оценка параметров
  const [pQ, setPQ] = useState('100');
  const [pS, setPS] = useState('15');
  const [pM, setPM] = useState('20');
  const [pR, setPR] = useState('');
  const [pR0, setPR0] = useState('');
  const [aquifer, setAquifer] = useState(AQUIFER_TYPES.UNCONFINED);
  const [imperfect, setImperfect] = useState(false);
  const [penetration, setPenetration] = useState('0.5');

  // Прогноз по Тейсу
  const [fQ, setFQ] = useState('1000');
  const [fT, setFT] = useState('500');
  const [fS, setFS] = useState('0.0001');
  const [fR, setFR] = useState('50');
  const [fTime, setFTime] = useState('1');

  // Приток в котлован
  const [ck, setCk] = useState('10');
  const [cm, setCm] = useState('15');
  const [cs0, setCs0] = useState('5');
  const [cR, setCR] = useState('400');
  const [cr0, setCr0] = useState('20');

  // Барраж и граничные условия
  const [bQ, setBQ] = useState('1000');
  const [bT, setBT] = useState('500');
  const [bS, setBS] = useState('0.0001');
  const [bR, setBR] = useState('50');
  const [bTime, setBTime] = useState('1');
  const [bL, setBL] = useState('200');
  const [boundary, setBoundary] = useState(BOUNDARY_TYPES.BARRIER);
  const [bGradient, setBGradient] = useState('0.005');
  const [bLength, setBLength] = useState('150');

  // Инфильтрационные утечки (пласт с перетеканием)
  const [lQ, setLQ] = useState('1000');
  const [lT, setLT] = useState('500');
  const [lS, setLS] = useState('0.0001');
  const [lR, setLR] = useState('50');
  const [lTime, setLTime] = useState('1');
  const [lThickness, setLThickness] = useState('5');
  const [lK, setLK] = useState('0.01');
  const [lArea, setLArea] = useState('10000');

  /**
   * Поле ввода с подписью и единицей измерения
   */
  const renderField = (label, value, onChange, unit) => (
    <View style={[styles.field, { borderBottomColor: theme.colors.border }]} key={label}>
      <Text style={[type.body, styles.fieldLabel, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={theme.colors.textSecondary}
        style={[styles.fieldInput, { color: theme.colors.secondary }]}
      />
      {unit ? (
        <Text style={[styles.fieldUnit, { color: theme.colors.textSecondary }]}>{unit}</Text>
      ) : null}
    </View>
  );

  /**
   * Синяя карточка результата с формулой
   */
  const renderResult = (label, value, unit, formula) => (
    <View style={[styles.resultCard, elevation.dataButton, { backgroundColor: theme.colors.secondary }]}>
      <Text style={styles.resultCaption}>{I18n.t('result', { defaultValue: 'Результат' })}</Text>
      <View style={styles.resultValueRow}>
        <Text style={styles.resultLabel}>{label} =</Text>
        <Text style={styles.resultValue}>{value}</Text>
        <Text style={styles.resultUnit}>{unit}</Text>
      </View>
      {formula ? <Text style={styles.resultFormula}>{formula}</Text> : null}
    </View>
  );

  /**
   * Вкладка пересчёта коэффициента фильтрации
   */
  const renderFiltration = () => {
    const converted = convertToAllUnits(parseNumber(kValue), kUnit);

    return (
      <>
        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[type.eyebrow, { color: theme.colors.textSecondary }]}>
            {I18n.t('value', { defaultValue: 'Значение' })}
          </Text>
          <TextInput
            value={kValue}
            onChangeText={setKValue}
            keyboardType="decimal-pad"
            style={[styles.bigInput, { color: theme.colors.text }]}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitRow}>
            {FILTRATION_UNITS.map((unit) => {
              const active = unit.key === kUnit;
              return (
                <TouchableOpacity
                  key={unit.key}
                  onPress={() => setKUnit(unit.key)}
                  style={[
                    styles.unitChip,
                    {
                      backgroundColor: active ? theme.colors.primary : 'transparent',
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.unitChipText,
                      { color: active ? '#FFFFFF' : theme.colors.textSecondary },
                    ]}
                  >
                    {I18n.t(unit.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          {I18n.t('convertedToAllUnits', { defaultValue: 'Пересчёт по всем единицам' })}
        </Text>

        <View
          style={[
            styles.card,
            styles.listCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {converted.map((row) => {
            const active = row.key === kUnit;
            return (
              <View
                key={row.key}
                style={[
                  styles.convertRow,
                  {
                    borderBottomColor: theme.colors.border,
                    backgroundColor: active ? theme.colors.primaryWash : 'transparent',
                  },
                ]}
              >
                <Text style={[type.body, { color: theme.colors.text }]}>{I18n.t(row.labelKey)}</Text>
                <Text style={[styles.convertValue, { color: theme.colors.text }]}>
                  {formatValue(row.value)}
                </Text>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  /**
   * Вкладка оценки коэффициента фильтрации по данным откачки
   */
  const renderParams = () => {
    const { k, formula, warnings } = estimateConductivity({
      Q: parseNumber(pQ),
      s: parseNumber(pS),
      m: parseNumber(pM),
      aquiferType: aquifer,
      R: parseNumber(pR),
      r0: parseNumber(pR0),
      imperfect,
      penetrationRatio: parseNumber(penetration),
    });

    return (
      <>
        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {renderField(I18n.t('flowRate'), pQ, setPQ, 'м³/сут')}
          {renderField(I18n.t('drawdown'), pS, setPS, 'м')}
          {renderField(I18n.t('thickness', { defaultValue: 'Мощность m' }), pM, setPM, 'м')}
          {renderField(I18n.t('influenceRadius', { defaultValue: 'Радиус влияния R' }), pR, setPR, 'м')}
          {renderField(I18n.t('wellRadius'), pR0, setPR0, 'м')}

          <Text style={[type.body, styles.groupLabel, { color: theme.colors.text }]}>
            {I18n.t('aquiferType', { defaultValue: 'Тип пласта' })}
          </Text>
          <View style={[styles.segment, { backgroundColor: theme.colors.surfaceSunken }]}>
            {[
              { key: AQUIFER_TYPES.UNCONFINED, labelKey: 'unconfined' },
              { key: AQUIFER_TYPES.CONFINED, labelKey: 'confined' },
            ].map((option) => {
              const active = option.key === aquifer;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setAquifer(option.key)}
                  style={[styles.segmentItem, active && { backgroundColor: theme.colors.surface }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.colors.primaryAccent : theme.colors.textSecondary },
                    ]}
                  >
                    {I18n.t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.switchRow}>
            <Text style={[type.body, { color: theme.colors.text }]}>{I18n.t('imperfectWell')}</Text>
            <Switch
              value={imperfect}
              onValueChange={setImperfect}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>

          {imperfect &&
            renderField(
              I18n.t('penetrationRatio', { defaultValue: 'Доля вскрытия l/m' }),
              penetration,
              setPenetration,
              ''
            )}
        </View>

        {renderResult('k', formatValue(k), 'м/сут', formula)}

        {warnings.includes('defaultInfluenceRatio') && (
          <Text style={[type.caption, styles.warning, { color: theme.colors.textSecondary }]}>
            {I18n.t('defaultInfluenceRatioNote', {
              defaultValue:
                'R и r₀ не заданы — принято отношение R/r₀ = 300. Для точного результата укажите фактические значения.',
            })}
          </Text>
        )}
        {warnings.includes('drawdownExceedsThickness') && (
          <Text style={[type.caption, styles.warning, { color: theme.colors.error }]}>
            {I18n.t('drawdownExceedsThicknessNote', {
              defaultValue: 'Понижение больше мощности пласта — проверьте исходные данные.',
            })}
          </Text>
        )}
      </>
    );
  };

  /**
   * Вкладка прогноза понижения по методу Тейса
   */
  const renderForecast = () => {
    const { s, u, W } = predictDrawdownTheis(
      {
        Q: parseNumber(fQ),
        T: parseNumber(fT),
        S: parseNumber(fS),
        r: parseNumber(fR),
        t: parseNumber(fTime),
      },
      wellFunction
    );

    return (
      <>
        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {renderField(I18n.t('flowRate'), fQ, setFQ, 'м³/сут')}
          {renderField(
            I18n.t('transmissivity', { defaultValue: 'Водопроводимость T' }),
            fT,
            setFT,
            'м²/сут'
          )}
          {renderField(I18n.t('storativity', { defaultValue: 'Водоотдача S' }), fS, setFS, '')}
          {renderField(I18n.t('distance', { defaultValue: 'Расстояние r' }), fR, setFR, 'м')}
          {renderField(I18n.t('time'), fTime, setFTime, 'сут')}
        </View>

        {renderResult('s', formatValue(s), 'м', 's = Q/(4π·T) · W(u),  u = r²S/(4Tt)')}

        <View style={styles.auxRow}>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            u = {formatValue(u)}
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            W(u) = {formatValue(W)}
          </Text>
        </View>

        {/* Одно число не отвечает на главный вопрос проектировщика — куда
            воронка дотягивается. Разрез отвечает */}
        <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          {I18n.t('coneSection', { defaultValue: 'Разрез депрессионной воронки' })}
        </Text>
        <DepressionCone
          Q={parseNumber(fQ)}
          T={parseNumber(fT)}
          S={parseNumber(fS)}
          t={parseNumber(fTime)}
          markerR={parseNumber(fR)}
          width={contentWidth}
        />
      </>
    );
  };

  /**
   * Вкладка притока в котлован
   */
  const renderPit = () => {
    const { Q, formula } = pitInflow({
      k: parseNumber(ck),
      m: parseNumber(cm),
      s0: parseNumber(cs0),
      R: parseNumber(cR),
      r0: parseNumber(cr0),
    });

    return (
      <>
        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {renderField(
            I18n.t('filtrationCoefficient', { defaultValue: 'Коэф. фильтрации k' }),
            ck,
            setCk,
            'м/сут'
          )}
          {renderField(I18n.t('thickness', { defaultValue: 'Мощность m' }), cm, setCm, 'м')}
          {renderField(I18n.t('pitDrawdown', { defaultValue: 'Понижение s₀' }), cs0, setCs0, 'м')}
          {renderField(I18n.t('influenceRadius', { defaultValue: 'Радиус влияния R' }), cR, setCR, 'м')}
          {renderField(I18n.t('pitRadius', { defaultValue: 'Радиус котлована r₀' }), cr0, setCr0, 'м')}
        </View>

        {renderResult('Q', formatValue(Q), 'м³/сут', formula)}
      </>
    );
  };

  /**
   * Сегментированный переключатель
   *
   * @param {Array<{key: string, labelKey: string}>} options - варианты
   * @param {string} value - выбранный ключ
   * @param {Function} onChange - обработчик выбора
   */
  const renderSegment = (options, value, onChange) => (
    <View style={[styles.segment, { backgroundColor: theme.colors.surfaceSunken }]}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.segmentItem, active && { backgroundColor: theme.colors.surface }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? theme.colors.primaryAccent : theme.colors.textSecondary },
              ]}
            >
              {I18n.t(option.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /**
   * Вкладка «Барраж»: пласт с прямолинейной границей и подпор перед стеной
   */
  const renderBarrage = () => {
    const { s, sInfinite, effect, rImage, warnings } = drawdownWithBoundary({
      Q: parseNumber(bQ),
      T: parseNumber(bT),
      S: parseNumber(bS),
      r: parseNumber(bR),
      t: parseNumber(bTime),
      L: parseNumber(bL),
      boundary,
    });

    const { rise, formula: riseFormula } = barrageRise({
      gradient: parseNumber(bGradient),
      barrierLength: parseNumber(bLength),
    });

    const isBarrier = boundary === BOUNDARY_TYPES.BARRIER;

    return (
      <>
        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {renderField(I18n.t('flowRate'), bQ, setBQ, 'м³/сут')}
          {renderField(
            I18n.t('transmissivity', { defaultValue: 'Водопроводимость T' }),
            bT,
            setBT,
            'м²/сут'
          )}
          {renderField(I18n.t('storativity', { defaultValue: 'Водоотдача S' }), bS, setBS, '')}
          {renderField(I18n.t('distance', { defaultValue: 'Расстояние r' }), bR, setBR, 'м')}
          {renderField(I18n.t('time'), bTime, setBTime, 'сут')}
          {renderField(
            I18n.t('distanceToBoundary', { defaultValue: 'Расстояние до границы L' }),
            bL,
            setBL,
            'м'
          )}

          <Text style={[type.body, styles.groupLabel, { color: theme.colors.text }]}>
            {I18n.t('boundaryType', { defaultValue: 'Тип границы' })}
          </Text>
          {renderSegment(
            [
              { key: BOUNDARY_TYPES.BARRIER, labelKey: 'boundaryBarrier' },
              { key: BOUNDARY_TYPES.RECHARGE, labelKey: 'boundaryRecharge' },
            ],
            boundary,
            setBoundary
          )}
        </View>

        {renderResult(
          's',
          formatValue(s),
          'м',
          isBarrier ? 's = Q/(4π·T) · [W(u) + W(u′)]' : 's = Q/(4π·T) · [W(u) − W(u′)]'
        )}

        <View style={styles.auxRow}>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            {I18n.t('withoutBoundary', { defaultValue: 'Без границы' })} = {formatValue(sInfinite)} м
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            {I18n.t('boundaryEffect', { defaultValue: 'Вклад границы' })} = {formatValue(effect)} м
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            r′ = {formatValue(rImage)} м
          </Text>
        </View>

        {warnings.includes('boundaryNotReached') && (
          <Text style={[type.caption, styles.warning, { color: theme.colors.textSecondary }]}>
            {I18n.t('boundaryNotReachedNote', {
              defaultValue:
                'Возмущение ещё не дошло до границы — она пока не влияет на понижение.',
            })}
          </Text>
        )}
        {warnings.includes('observationBeyondBoundary') && (
          <Text style={[type.caption, styles.warning, { color: theme.colors.error }]}>
            {I18n.t('observationBeyondBoundaryNote', {
              defaultValue: 'Точка наблюдения оказалась за границей пласта: r должно быть меньше L.',
            })}
          </Text>
        )}

        {/* Подпор перед непроницаемым сооружением */}
        <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          {I18n.t('barrageRiseTitle', { defaultValue: 'Подпор перед сооружением' })}
        </Text>
        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {renderField(
            I18n.t('naturalGradient', { defaultValue: 'Уклон потока i' }),
            bGradient,
            setBGradient,
            ''
          )}
          {renderField(
            I18n.t('barrierLength', { defaultValue: 'Длина сооружения b' }),
            bLength,
            setBLength,
            'м'
          )}
        </View>

        {renderResult('ΔH', formatValue(rise), 'м', riseFormula)}
      </>
    );
  };

  /**
   * Вкладка «Инфильтрационные утечки»: пласт с перетеканием
   */
  const renderLeakage = () => {
    const T = parseNumber(lT);
    const aquitardThickness = parseNumber(lThickness);
    const aquitardK = parseNumber(lK);

    const B = leakageFactor({ T, aquitardThickness, aquitardK });
    const { s, beta, W } = leakyDrawdown({
      Q: parseNumber(lQ),
      T,
      S: parseNumber(lS),
      r: parseNumber(lR),
      t: parseNumber(lTime),
      B,
    });
    const steady = steadyLeakyDrawdown({ Q: parseNumber(lQ), T, r: parseNumber(lR), B });
    const { rate, total, formula: rateFormula } = leakageRate({
      s,
      aquitardThickness,
      aquitardK,
      area: parseNumber(lArea),
    });

    return (
      <>
        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {renderField(I18n.t('flowRate'), lQ, setLQ, 'м³/сут')}
          {renderField(
            I18n.t('transmissivity', { defaultValue: 'Водопроводимость T' }),
            lT,
            setLT,
            'м²/сут'
          )}
          {renderField(I18n.t('storativity', { defaultValue: 'Водоотдача S' }), lS, setLS, '')}
          {renderField(I18n.t('distance', { defaultValue: 'Расстояние r' }), lR, setLR, 'м')}
          {renderField(I18n.t('time'), lTime, setLTime, 'сут')}
          {renderField(
            I18n.t('aquitardThickness', { defaultValue: 'Мощность слабопроницаемого слоя m′' }),
            lThickness,
            setLThickness,
            'м'
          )}
          {renderField(
            I18n.t('aquitardK', { defaultValue: 'Коэф. фильтрации слоя k′' }),
            lK,
            setLK,
            'м/сут'
          )}
        </View>

        {renderResult('s', formatValue(s), 'м', 's = Q/(4π·T) · W(u, r/B)')}

        <View style={styles.auxRow}>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            B = {formatValue(B)} м
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            r/B = {formatValue(beta)}
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            W(u, r/B) = {formatValue(W)}
          </Text>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            {I18n.t('steadyDrawdown', { defaultValue: 'Стационар' })} = {formatValue(steady.s)} м
          </Text>
        </View>

        {/* Расход перетекания */}
        <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          {I18n.t('leakageVolumeTitle', { defaultValue: 'Расход перетекания' })}
        </Text>
        <View
          style={[
            styles.card,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {renderField(I18n.t('leakageArea', { defaultValue: 'Площадь F' }), lArea, setLArea, 'м²')}
        </View>

        {renderResult('w', formatValue(rate), 'м/сут', rateFormula)}

        <View style={styles.auxRow}>
          <Text style={[styles.auxText, { color: theme.colors.textSecondary }]}>
            {I18n.t('leakageTotal', { defaultValue: 'Расход по площади' })} = {formatValue(total)} м³/сут
          </Text>
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Вкладки */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: theme.colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tab, { backgroundColor: active ? theme.colors.primary : 'transparent' }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.tabText, { color: active ? '#FFFFFF' : theme.colors.textSecondary }]}
              >
                {I18n.t(item.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === 'filtration' && renderFiltration()}
        {tab === 'params' && renderParams()}
        {tab === 'forecast' && renderForecast()}
        {tab === 'pit' && renderPit()}
        {tab === 'barrage' && renderBarrage()}
        {tab === 'leakage' && renderLeakage()}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Высота задана явно: горизонтальная прокрутка с flexGrow: 0 на Android
  // меряет себя короче содержимого, и у букв срезало нижние выносные
  // элементы — «фильтрации», «параметров». 18 (строка) + 12×2 (поля) + 12
  tabBar: {
    flexGrow: 0,
    height: 54,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBarContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
  },
  tabText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
  bigInput: {
    ...numericAt(34),
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
  unitRow: {
    marginTop: spacing.sm,
  },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.sm,
  },
  unitChipText: {
    ...type.numeric,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  convertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  convertValue: {
    ...type.numeric,
    fontSize: 15,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    flex: 1,
  },
  fieldInput: {
    ...type.numeric,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 80,
  },
  fieldUnit: {
    ...type.numeric,
    fontSize: 12,
    marginLeft: spacing.sm,
    minWidth: 46,
  },
  groupLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.chip,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  resultCard: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.card,
  },
  resultCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  resultValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  resultLabel: {
    ...numericAt(20),
    color: '#FFFFFF',
  },
  resultValue: {
    ...numericAt(30),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultUnit: {
    ...type.numeric,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  resultFormula: {
    ...type.numeric,
    fontSize: 12,
    // Формула набрана моноширинным со скобками и дробями: при высоте строки
    // от родительского токена нижние края скобок срезались
    lineHeight: 18,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.md,
  },
  warning: {
    marginTop: spacing.md,
  },
  auxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  auxText: {
    ...type.numeric,
    fontSize: 12,
  },
});
