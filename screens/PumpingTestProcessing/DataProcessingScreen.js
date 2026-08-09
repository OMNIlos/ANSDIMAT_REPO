/**
 * Обработка ОФР — редактируемый журнал замеров и график понижения
 *
 * Экран собирает вместе три вещи, которые геолог держит рядом при обработке:
 * дебит, таблицу «время — понижение» и график. Любая правка в таблице
 * сразу пересчитывает график и водопроводимость, поэтому подбор наклона
 * ведётся без промежуточных нажатий «пересчитать».
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Прокрутка из gesture-handler: только её умеет блокировать жест графика,
// пока палец тянет полотно. Обычный ScrollView из react-native этого не умеет
import { ScrollView } from 'react-native-gesture-handler';
import I18n from '../../Localization';
import DrawdownChart, { FIT_MODES } from '../../components/DrawdownChart';
import DiagnosticPlot from '../../components/DiagnosticPlot';
import RegimeVerdict from '../../components/RegimeVerdict';
import { toggleSelection } from '../../calc/chartGeometry';
import { X_MODES, processDrawdown, transmissivityFromSlope } from '../../calc/cooperJacob';
import { processRecovery } from '../../calc/recovery';
import { diagnose } from '../../calc/diagnostics';
import ValueCard from '../../components/ui/ValueCard';
import { MENU_BAR_HEIGHT } from '../../components/BottomMenuBar';
import {
  getProject,
  updateProject,
  replaceMeasurements,
  addMeasurement,
  deleteMeasurement,
} from '../../db/projects';
import { spacing, radius, type, elevation, numericAt } from '../../theme';

const X_MODE_OPTIONS = [
  { key: X_MODES.LOG, label: 'lg t' },
  { key: X_MODES.LINEAR, label: 't' },
  { key: X_MODES.SQRT, label: '√t' },
];

/** Фазы опыта: откачка (понижение) и восстановление уровня */
const PHASES = {
  PUMPING: 'pumping',
  RECOVERY: 'recovery',
};

/**
 * Виды графика: подбор прямой и диагностика режима фильтрации
 *
 * Это два разных занятия. На первом графике геолог ведёт прямую и получает T,
 * на втором — смотрит, применима ли вообще формула, по которой она считается.
 * Показывать оба сразу значило бы удвоить экран, поэтому они переключаются.
 */
const VIEWS = {
  FIT: 'fit',
  DIAGNOSTIC: 'diagnostic',
};

const PHASE_OPTIONS = [
  { key: PHASES.PUMPING, labelKey: 'phasePumping', fallback: 'Откачка' },
  { key: PHASES.RECOVERY, labelKey: 'phaseRecovery', fallback: 'Восстановление' },
];

/**
 * Разбирает введённое число, принимая и запятую, и точку
 *
 * В поле пользователи набирают «0,34» с русской раскладки — без этого
 * значение молча становится NaN.
 *
 * @param {string} text - введённый текст
 * @returns {number} число или NaN
 */
function parseNumber(text) {
  if (typeof text !== 'string') return Number(text);
  const normalized = text.replace(',', '.').trim();
  if (normalized === '') return NaN;
  return Number(normalized);
}

export default function DataProcessingScreen({ route, navigation }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Ссылка на прокрутку нужна графику: его жест перекрывает её на время
  // перетаскивания полотна
  const scrollRef = useRef(null);
  const projectId = route?.params?.projectId;

  const [project, setProject] = useState(null);
  const [rows, setRows] = useState([]);
  const [qText, setQText] = useState('');
  const [xMode, setXMode] = useState(X_MODES.LOG);
  const [loading, setLoading] = useState(true);
  // Фаза опыта: понижение на откачке или восстановление уровня после
  // остановки насоса. ТЗ требует оба вида — обрабатываются они по-разному
  const [phase, setPhase] = useState(PHASES.PUMPING);
  const [durationText, setDurationText] = useState('');

  const contentWidth = Math.min(width, 720) - spacing.lg * 2;
  // Развёрнутый график: из высоты экрана вычитаем шапку навигации,
  // собственную шапку графика с переключателями, подпись цены деления
  // и плавающее нижнее меню — иначе полотно уезжает под меню
  const CHART_CHROME = 232;
  const fullscreenChartHeight = Math.max(
    260,
    height - insets.bottom - MENU_BAR_HEIGHT - CHART_CHROME
  );

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    const loaded = await getProject(projectId);
    if (!loaded) {
      setLoading(false);
      return;
    }
    setProject(loaded);
    setQText(String(loaded.Q ?? ''));
    setDurationText(loaded.pumpingDuration ? String(loaded.pumpingDuration) : '');
    // Журнал восстановления сразу открываем в соответствующей фазе
    if (loaded.ofrType === 'recovery') setPhase(PHASES.RECOVERY);
    setRows(
      loaded.measurements.map((m) => ({
        id: m.id,
        tText: String(m.t),
        sText: String(m.s),
      }))
    );
    setLoading(false);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Замеры в числовом виде — общий источник для графика и расчёта.
  // Пересчитываются только при правке таблицы: диагностика перебирает точки
  // окнами, и гонять её на каждый ре-рендер экрана незачем
  const measurements = useMemo(
    () =>
      rows
        .map((row) => ({ t: parseNumber(row.tText), s: parseNumber(row.sText) }))
        .filter((m) => isFinite(m.t) && isFinite(m.s)),
    [rows]
  );

  const Q = parseNumber(qText);
  const isRecovery = phase === PHASES.RECOVERY;
  const pumpingDuration = parseNumber(durationText);

  const result = processDrawdown({ measurements, Q, mode: xMode });
  const recovery = processRecovery({ measurements, Q, pumpingDuration });

  // График в обеих фазах один и тот же: по оси X откладывается логарифм.
  // На восстановлении вместо времени берётся отношение t/t′ — это и есть
  // координата прямой Тейса, поэтому пересчёт сводится к подмене данных
  const chartMeasurements = isRecovery
    ? recovery.points.map((point) => ({ t: point.t / point.tPrime, s: point.y }))
    : measurements;
  const chartMode = isRecovery ? X_MODES.LOG : xMode;

  // Прямую строит график: по всем точкам или по двум выбранным вручную.
  // Наклон именно этой прямой и даёт водопроводимость.
  const [fit, setFit] = useState(null);
  // Способ построения прямой и выбранные точки: общие для графика и таблицы,
  // поэтому живут здесь, а не внутри графика
  const [fitMode, setFitMode] = useState(FIT_MODES.AUTO);
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [chartView, setChartView] = useState(VIEWS.FIT);
  // Развёрнут ли график на весь экран
  const [chartFullscreen, setChartFullscreen] = useState(false);

  // Диагностика идёт по замерам откачки: на восстановлении время отсчитывается
  // от остановки насоса, и производная по нему означала бы другое
  const diagnosis = useMemo(() => diagnose(measurements), [measurements]);

  const handleToggleSelect = useCallback((index) => {
    setSelectedPoints((prev) => toggleSelection(prev, index));
  }, []);

  const handleFitModeChange = useCallback((next) => {
    setFitMode(next);
    setSelectedPoints([]);
  }, []);
  const usesManualFit = fit?.source === 'twoPoints';
  // Пока вручную выбрана не пара точек, результата нет: показывать вместо него
  // наклон регрессии значило бы выдавать чужой расчёт за выбранный геологом
  const awaitingSelection = usesManualFit && (fit?.selectedCount ?? 0) < 2;
  // Наклон по умолчанию берётся из расчёта той фазы, которая сейчас открыта
  const baseSlope = isRecovery ? recovery.slope : result.slope;
  const activeSlope = awaitingSelection
    ? NaN
    : fit && isFinite(fit.slope)
      ? fit.slope
      : baseSlope;
  // На восстановлении ось X всегда логарифмическая, поэтому формула
  // T = 0.183·Q/a применима без оговорок
  const slopeApplicable = isRecovery || result.applicable;
  const activeT = slopeApplicable ? transmissivityFromSlope(Q, activeSlope) : NaN;

  /**
   * Чего не хватает, чтобы посчитать водопроводимость
   *
   * Формула T = 0.183·Q/a требует и дебит, и наклон прямой. Если чего-то нет,
   * в карточке стоит прочерк — и без пояснения непонятно, что именно доделать.
   *
   * @returns {string} причина или пустая строка, если T посчитана
   */
  const missingT = useMemo(() => {
    if (isFinite(activeT)) return '';

    if (!slopeApplicable) {
      return I18n.t('needLogMode', {
        defaultValue: 'Переключите ось X в режим lg t — по другим осям T не считается.',
      });
    }
    if (measurements.length < 2) {
      return I18n.t('needTwoMeasurements', {
        defaultValue: 'Внесите хотя бы два замера: по одной точке прямую не провести.',
      });
    }
    if (awaitingSelection) {
      return I18n.t('needTwoSelected', {
        defaultValue: 'Отметьте на графике две точки, через которые провести прямую.',
      });
    }
    if (!(Q > 0)) {
      return I18n.t('needFlowRate', {
        defaultValue: 'Укажите дебит Q — без него водопроводимость не рассчитать.',
      });
    }
    return I18n.t('needSlope', {
      defaultValue: 'Понижение не растёт со временем: наклон прямой равен нулю, T не определена.',
    });
  }, [activeT, slopeApplicable, measurements.length, awaitingSelection, Q]);

  /**
   * Сохраняет дебит и замеры вместе с результатом расчёта
   */
  const persist = useCallback(
    async (nextRows, nextQ) => {
      if (!projectId) return;
      const method = isRecovery ? 'theis-recovery' : 'cooper-jacob';
      await updateProject(projectId, {
        Q: isFinite(nextQ) ? nextQ : 0,
        pumpingDuration: isFinite(pumpingDuration) ? pumpingDuration : 0,
        results: {
          // Сохраняем ту прямую, которую геолог видит на графике,
          // включая проведённую вручную по двум точкам
          T: isFinite(activeT) ? activeT : null,
          slope: isFinite(activeSlope) ? activeSlope : null,
          method: slopeApplicable ? (usesManualFit ? `${method}-two-points` : method) : null,
        },
      });
      await replaceMeasurements(
        projectId,
        nextRows
          .map((row) => ({ id: row.id, t: parseNumber(row.tText), s: parseNumber(row.sText) }))
          .filter((m) => isFinite(m.t) && isFinite(m.s))
      );
    },
    [projectId, activeT, activeSlope, slopeApplicable, usesManualFit, isRecovery, pumpingDuration]
  );

  // Ссылка на актуальный persist: он пересоздаётся на каждом пересчёте
  // наклона, и без ссылки автосохранение перезапускалось бы после каждого
  // символа, так и не дожидаясь паузы
  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Автосохранение. Раньше запись шла только по onBlur, и значение,
  // набранное в последнем поле перед уходом с экрана, пропадало: с клавиатуры
  // уходят кнопкой «назад», а не касанием соседнего поля
  useEffect(() => {
    if (!projectId || loading) return undefined;
    const timer = setTimeout(() => {
      persistRef.current(rows, parseNumber(qText));
    }, 600);
    return () => clearTimeout(timer);
  }, [projectId, loading, rows, qText, durationText]);

  /**
   * Подпись под результатом: какой метод сработал и насколько точно
   *
   * @returns {string} пояснение к расчёту
   */
  const renderMethodNote = () => {
    if (!isRecovery && !result.applicable) return I18n.t('methodNeedLogAxis');

    const base = I18n.t(isRecovery ? 'methodRecovery' : 'methodCooperJacob');
    if (usesManualFit) return `${base} ${I18n.t('methodTwoPoints')}`;

    const r2 = isRecovery ? recovery.r2 : result.r2;
    return `${base} ${I18n.t('methodFitQuality', {
      r2: isFinite(r2) ? r2.toFixed(3) : '—',
    })}`;
  };

  const handleRowChange = (id, field, value) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const handleRowBlur = () => {
    persist(rows, Q);
  };

  const handleAddRow = async () => {
    if (!projectId) return;
    const created = await addMeasurement(projectId, { t: 0, s: 0 });
    setRows((prev) => [...prev, { id: created.id, tText: '', sText: '' }]);
  };

  const handleDeleteRow = async (id) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
    await deleteMeasurement(id);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={[type.body, { color: theme.colors.textSecondary }]}>
          {I18n.t('projectNotFound')}
        </Text>
      </View>
    );
  }

  // Развёрнутый график занимает весь экран и лежит вне прокрутки: только так
  // вертикальное перетаскивание достаётся ему, а не списку. Тот же приём,
  // что у карты в полевом дневнике
  if (chartFullscreen) {
    return (
      <View style={[styles.fullscreen, { backgroundColor: theme.colors.background }]}>
        <DrawdownChart
          measurements={chartMeasurements}
          mode={chartMode}
          width={width - spacing.md * 2}
          height={fullscreenChartHeight}
          onFitChange={setFit}
          fitMode={fitMode}
          onFitModeChange={handleFitModeChange}
          selected={selectedPoints}
          onToggleSelect={handleToggleSelect}
          caption={isRecovery ? "s′ — lg(t/t′)" : undefined}
          fullscreen
          onToggleFullscreen={() => setChartFullscreen(false)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Шапка проекта */}
      <View
        style={[
          styles.projectCard,
          elevation.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={[styles.projectIcon, { backgroundColor: theme.colors.primary }]}>
          <MaterialCommunityIcons name="water-pump" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.projectText}>
          <Text style={[type.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={[styles.projectMeta, { color: theme.colors.textSecondary }]}>
            {I18n.t(`ofr_${project.ofrType}`, { defaultValue: project.ofrType })} ·{' '}
            {measurements.length} {I18n.t('measurementsShort', { defaultValue: 'замеров' })}
          </Text>
        </View>
      </View>

      {/* Фаза опыта */}
      <View style={styles.modeRow}>
        {PHASE_OPTIONS.map((option) => {
          const active = option.key === phase;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setPhase(option.key)}
              style={[
                styles.phaseChip,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surfaceSunken,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.modeChipText,
                  { color: active ? '#FFFFFF' : theme.colors.textSecondary },
                ]}
              >
                {I18n.t(option.labelKey, { defaultValue: option.fallback })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Дебит */}
      <View
        style={[
          styles.field,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        {/* Единица вынесена из подписи и стоит после числа: внутри подписи
            она ломала строку надвое на узких экранах, а рядом со значением
            ещё и читается по-человечески — «1000 м³/сут» */}
        <Text style={[type.body, styles.fieldLabel, { color: theme.colors.text }]}>
          {I18n.t('flowRateQ', { defaultValue: 'Дебит Q' })}
        </Text>
        <TextInput
          value={qText}
          onChangeText={setQText}
          onBlur={() => persist(rows, parseNumber(qText))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.colors.textSecondary}
          style={[styles.fieldInput, { color: theme.colors.secondary }]}
        />
        <Text style={[styles.fieldUnit, { color: theme.colors.textSecondary }]}>{I18n.t('unitFlowRate')}</Text>
      </View>

      {/* Продолжительность откачки — точка отсчёта восстановления */}
      {isRecovery && (
        <View
          style={[
            styles.field,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[type.body, styles.fieldLabel, { color: theme.colors.text }]}>
            {I18n.t('pumpingDuration', { defaultValue: 'Откачка длилась' })}
          </Text>
          <TextInput
            value={durationText}
            onChangeText={setDurationText}
            onBlur={() => persist(rows, Q)}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.fieldInput, { color: theme.colors.secondary }]}
          />
          <Text style={[styles.fieldUnit, { color: theme.colors.textSecondary }]}>{I18n.t('unitMinutes')}</Text>
        </View>
      )}

      {/* Журнал замеров */}
      <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.textSecondary }]}>
        {I18n.t('measurementsJournal', { defaultValue: 'Журнал замеров' })}
      </Text>

      <View
        style={[
          styles.table,
          elevation.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={[styles.tableHead, { borderBottomColor: theme.colors.border }]}>
          {fitMode === FIT_MODES.TWO_POINTS && <View style={styles.pickCell} />}
          {/* На восстановлении время отсчитывается от НАЧАЛА откачки, а не от
              остановки насоса: иначе t − длительность откачки выходит
              отрицательным и точка выпадает из расчёта. Пишем это прямо
              в шапке — догадаться из подписи «t, мин» невозможно */}
          <Text style={[styles.headCell, { color: theme.colors.textSecondary }]}>
            {isRecovery
              ? I18n.t('timeFromPumpStart', { defaultValue: 't от начала откачки, мин' })
              : I18n.t('columnTime')}
          </Text>
          <Text style={[styles.headCell, { color: theme.colors.textSecondary }]}>{I18n.t('columnDrawdown')}</Text>
          <View style={styles.deleteCell} />
        </View>

        {rows.map((row, rowIndex) => (
          <View key={row.id} style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}>
            {/* Отметка точки для прямой: тот же выбор, что и касанием
                по графику, но попасть по строке проще, чем по кружку */}
            {fitMode === FIT_MODES.TWO_POINTS && (
              <TouchableOpacity
                onPress={() => handleToggleSelect(rowIndex)}
                style={styles.pickCell}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedPoints.includes(rowIndex) }}
                accessibilityLabel={`${I18n.t('measurement', { defaultValue: 'Замер' })} ${rowIndex + 1}`}
              >
                <MaterialIcons
                  name={selectedPoints.includes(rowIndex) ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={selectedPoints.includes(rowIndex) ? theme.colors.primaryAccent : theme.colors.faint}
                />
              </TouchableOpacity>
            )}
            <TextInput
              value={row.tText}
              onChangeText={(value) => handleRowChange(row.id, 'tText', value)}
              onBlur={handleRowBlur}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.cellInput, { color: theme.colors.text }]}
            />
            <TextInput
              value={row.sText}
              onChangeText={(value) => handleRowChange(row.id, 'sText', value)}
              onBlur={handleRowBlur}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.cellInput, { color: theme.colors.text }]}
            />
            <TouchableOpacity
              onPress={() => handleDeleteRow(row.id)}
              style={styles.deleteCell}
              accessibilityRole="button"
              accessibilityLabel={I18n.t('delete')}
            >
              <MaterialIcons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addRow}
          onPress={handleAddRow}
          accessibilityRole="button"
        >
          <MaterialIcons name="add" size={18} color={theme.colors.primaryAccent} />
          <Text style={[styles.addRowText, { color: theme.colors.primaryAccent }]}>
            {I18n.t('addMeasurement', { defaultValue: 'Добавить замер' })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* График */}
      <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.textSecondary }]}>
        {chartView === VIEWS.DIAGNOSTIC
          ? I18n.t('diagnosticChart', { defaultValue: 'Диагностика режима' })
          : isRecovery
            ? I18n.t('recoveryChart', { defaultValue: 'График восстановления' })
            : I18n.t('drawdownChart', { defaultValue: 'График понижения' })}
      </Text>

      {/* Выбор вида. На восстановлении диагностика не строится: там по оси
          времени отложено отношение t/t′, и производная по нему значила бы
          не то, что читают по её форме */}
      {!isRecovery && (
        <View style={[styles.viewSwitch, { backgroundColor: theme.colors.surfaceSunken }]}>
          {[
            { key: VIEWS.FIT, labelKey: 'viewFit', fallback: 'Подбор прямой' },
            { key: VIEWS.DIAGNOSTIC, labelKey: 'viewDiagnostic', fallback: 'Диагностика' },
          ].map((option) => {
            const active = option.key === chartView;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setChartView(option.key)}
                style={[styles.viewChip, active && { backgroundColor: theme.colors.surface }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.viewChipText,
                    {
                      color: active ? theme.colors.primaryAccent : theme.colors.textSecondary,
                      fontWeight: active ? '700' : '600',
                    },
                  ]}
                >
                  {I18n.t(option.labelKey, { defaultValue: option.fallback })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isRecovery && (
        <Text style={[type.caption, styles.hint, { color: theme.colors.textSecondary }]}>
          {I18n.t('recoveryAxisHint', {
            defaultValue: 'По оси X — отношение t/t′: время от начала откачки к времени от её остановки',
          })}
        </Text>
      )}

      {/* На восстановлении ось X всегда логарифмическая: другие режимы
          сделали бы прямую Тейса кривой, поэтому выбор режима не показываем.
          В диагностике оси заданы самим методом и не переключаются */}
      <View style={styles.modeRow}>
        {(isRecovery || chartView === VIEWS.DIAGNOSTIC ? [] : X_MODE_OPTIONS).map((option) => {
          const active = option.key === xMode;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setXMode(option.key)}
              style={[
                styles.modeChip,
                {
                  backgroundColor: active ? theme.colors.primary : theme.colors.surfaceSunken,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.modeChipText,
                  { color: active ? '#FFFFFF' : theme.colors.textSecondary },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {chartView === VIEWS.DIAGNOSTIC && !isRecovery ? (
        <>
          <DiagnosticPlot result={diagnosis} width={contentWidth} />
          <RegimeVerdict result={diagnosis} Q={Q} comparisonT={activeT} />
        </>
      ) : (
        <DrawdownChart
          measurements={chartMeasurements}
          mode={chartMode}
          width={contentWidth}
          onFitChange={setFit}
          scrollRef={scrollRef}
          fitMode={fitMode}
          onFitModeChange={handleFitModeChange}
          selected={selectedPoints}
          onToggleSelect={handleToggleSelect}
          fullscreen={false}
          onToggleFullscreen={() => setChartFullscreen(true)}
          caption={isRecovery ? "s′ — lg(t/t′)" : undefined}
        />
      )}

      {/* Результат */}
      <View style={styles.resultRow}>
        <ValueCard
          accent
          label={I18n.t('transmissivityLabel')}
          value={isFinite(activeT) ? activeT.toFixed(2) : '—'}
        />
        <ValueCard
          label={I18n.t('slope', { defaultValue: 'Наклон a' })}
          value={isFinite(activeSlope) ? activeSlope.toFixed(4) : '—'}
        />
      </View>

      {/* Почему в карточке прочерк. Раньше пустое поле не объясняло ничего:
          чаще всего не заполнен дебит, а понять это было неоткуда */}
      {!!missingT && (
        <Text style={[type.caption, styles.missing, { color: theme.colors.primaryAccent }]}>
          {missingT}
        </Text>
      )}

      <Text style={[styles.methodNote, { color: theme.colors.textSecondary }]}>
        {renderMethodNote()}
      </Text>

      {/* Замеры есть, а точек для графика нет: значит время меньше
          длительности откачки. Общая заглушка «внесите замеры» тут врёт */}
      {isRecovery && measurements.length >= 2 && chartMeasurements.length === 0 && (
        <Text style={[type.caption, styles.missing, { color: theme.colors.primaryAccent }]}>
          {!(pumpingDuration > 0)
            ? I18n.t('recoveryNoDuration', {
                defaultValue: 'Укажите, сколько длилась откачка — без этого восстановление не построить.',
              })
            : I18n.t('recoveryTimeTooSmall', {
                defaultValue:
                  'Время замеров меньше длительности откачки. В журнале восстановления время отсчитывается от начала откачки, а не от остановки насоса.',
              })}
        </Text>
      )}

      {isRecovery && recovery.warnings.includes('needMoreMeasurements') && (
        <Text style={[type.caption, styles.hint, { color: theme.colors.error }]}>
          {I18n.t('recoveryNeedDuration', {
            defaultValue:
              'Укажите продолжительность откачки и внесите замеры после остановки насоса — иначе восстановление не обработать.',
          })}
        </Text>
      )}
      {isRecovery && recovery.warnings.includes('recoveryInterceptNotZero') && (
        <Text style={[type.caption, styles.hint, { color: theme.colors.textSecondary }]}>
          {I18n.t('recoveryInterceptNote', {
            defaultValue:
              'Прямая не проходит через начало координат: возможно влияние границ пласта или непостоянный дебит на откачке.',
          })}
        </Text>
      )}

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Развёрнутый график: занимает экран, поля по краям — чтобы кнопки
  // масштаба и «Сброс» не упирались в границы
  fullscreen: {
    flex: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  content: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    // Шапка проекта отделена от переключателя фазы: без отступа карточка
    // и чипы читались как один блок
    marginBottom: spacing.lg,
  },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  projectText: {
    flex: 1,
  },
  projectMeta: {
    ...type.numeric,
    fontSize: 12,
    marginTop: 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Подпись занимает свою естественную ширину и при нехватке места ужимается,
  // а остаток строки забирает поле ввода. С flex:1 на подписи выходило
  // наоборот: она схлопывалась до одного слова и переносилась на две строки
  fieldLabel: {
    flexShrink: 1,
    marginRight: spacing.md,
  },
  fieldInput: {
    ...numericAt(18),
    flex: 1,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 70,
    paddingVertical: 2,
  },
  fieldUnit: {
    ...type.numeric,
    fontSize: 12,
    marginLeft: 6,
    minWidth: 48,
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  table: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cellInput: {
    ...type.numeric,
    flex: 1,
    fontSize: 15,
    paddingVertical: spacing.md,
  },
  pickCell: {
    width: 30,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  deleteCell: {
    width: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  addRowText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeChipText: {
    ...type.numeric,
    fontSize: 14,
    fontWeight: '600',
  },
  // Фаза опыта подписана словами, поэтому чипу нужны поля пошире
  phaseChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  hint: {
    marginBottom: spacing.md,
  },
  // Переключатель вида графика: сегменты в общей подложке, как в калькуляторе
  viewSwitch: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.chip,
    marginBottom: spacing.md,
  },
  viewChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.chip - 3,
  },
  viewChipText: {
    fontSize: 13,
  },
  resultRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  resultCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.card,
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.8)',
  },
  resultValue: {
    ...numericAt(26),
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: spacing.xs,
  },
  missing: {
    marginTop: spacing.md,
    lineHeight: 18,
    fontWeight: '600',
  },
  methodNote: {
    ...type.caption,
    marginTop: spacing.md,
  },
});
