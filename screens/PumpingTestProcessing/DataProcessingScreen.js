/**
 * Обработка ОФР — редактируемый журнал замеров и график понижения
 *
 * Экран собирает вместе три вещи, которые геолог держит рядом при обработке:
 * дебит, таблицу «время — понижение» и график. Любая правка в таблице
 * сразу пересчитывает график и водопроводимость, поэтому подбор наклона
 * ведётся без промежуточных нажатий «пересчитать».
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useTheme } from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Прокрутка из gesture-handler: только её умеет блокировать жест графика,
// пока палец тянет полотно. Обычный ScrollView из react-native этого не умеет
import {
  ScrollView,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import I18n from "../../Localization";
import DrawdownChart, { FIT_MODES } from "../../components/DrawdownChart";
import DiagnosticPlot from "../../components/DiagnosticPlot";
import RegimeVerdict from "../../components/RegimeVerdict";
import { toggleSelection, freeLine } from "../../calc/chartGeometry";
import { SERIES_ROLES, residualDrawdown } from "../../calc/chartSeries";
import {
  chartRawSeries,
  finalDrawdownAtStop,
  recoveryAbscissa,
} from "./useChartSeries";
import {
  X_MODES,
  processDrawdown,
  transformTime,
  lineThroughPoints,
  transmissivityFromSlope,
} from "../../calc/cooperJacob";
import {
  TRACKING_KINDS,
  processAreaTracking,
  processCombinedTracking,
} from "../../calc/tracking";
import {
  processRecovery,
  recoveryCompleteness,
  diffusivityFromRecovery,
} from "../../calc/recovery";
import { diagnose } from "../../calc/diagnostics";
import ValueCard from "../../components/ui/ValueCard";
import { MENU_BAR_HEIGHT } from "../../components/BottomMenuBar";
import Segmented from "../../components/ui/Segmented";
import { useContentMaxWidth } from "../../lib/appPrefs";
import { setMenuHidden } from "../../components/chromeVisibility";
import {
  getProject,
  updateProject,
  replaceMeasurements,
  addMeasurement,
  deleteMeasurement,
} from "../../db/projects";
import {
  OFR_TYPES,
  LEGACY_OFR_TYPES,
  MEASUREMENT_PHASES,
  WELL_ROLES,
} from "../../db/schema";
import {
  createWell,
  deleteWell,
  setWellDistance,
  setWellFinalDrawdown,
  setWellPosition,
} from "../../db/wells";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PremiumLock from "../../components/ui/PremiumLock";
import { useEntitlements } from "../../billing/EntitlementsContext";
import DiagonalHatch from "../../components/DiagonalHatch";
import * as Location from "expo-location";
import FieldMap from "../../components/FieldMap";
import { DEFAULT_CENTER } from "../../components/leafletMapHtml";
import { distanceBetween, offsetBy } from "../../calc/geo";
import { useUnits } from "../../UnitsContext";
import { QUANTITIES } from "../../calc/units";
import { spacing, radius, type, elevation, numericAt, fontFamily } from "../../theme";

/**
 * Виды графика
 *
 * Первые три — оси времени: один и тот же ряд замеров, спрямляемый по-разному.
 * Последние два — прослеживания с расстоянием в абсциссе (табл. 4.1 АНСДИМАТ):
 * там меняется не ось, а сам набор точек — в него входит весь куст. Держать
 * их в одной строке всё равно правильно: для геолога это выбор графика, а не
 * выбор оси.
 */
const GRAPH_MODES = {
  LOG: X_MODES.LOG,
  LINEAR: X_MODES.LINEAR,
  SQRT: X_MODES.SQRT,
  AREA: "lgR",
  COMBINED: "lgTR2",
};

/** Виды с расстоянием в абсциссе имеют смысл только у кустовой откачки */
const GRAPH_MODE_OPTIONS = [
  { key: GRAPH_MODES.LOG, label: "lg t" },
  { key: GRAPH_MODES.LINEAR, label: "t" },
  { key: GRAPH_MODES.SQRT, label: "√t" },
  { key: GRAPH_MODES.AREA, label: "lg r", clusterOnly: true },
  { key: GRAPH_MODES.COMBINED, label: "lg t/r²", clusterOnly: true },
];

/** Вид прослеживания, отвечающий выбранному графику */
const TRACKING_BY_MODE = {
  [GRAPH_MODES.AREA]: TRACKING_KINDS.AREA,
  [GRAPH_MODES.COMBINED]: TRACKING_KINDS.COMBINED,
};

/** Подпись осей графика */
const GRAPH_CAPTIONS = {
  [GRAPH_MODES.AREA]: "s — lg r",
  [GRAPH_MODES.COMBINED]: "s — lg(t/r²)",
};

/**
 * Фазы опыта: откачка (понижение) и восстановление уровня
 *
 * Совпадают с периодами, которыми размечены замеры в базе: кнопка выбирает
 * не только способ обработки, но и журнал, открытый для ввода.
 */
const PHASES = {
  PUMPING: MEASUREMENT_PHASES.PUMPING,
  RECOVERY: MEASUREMENT_PHASES.RECOVERY,
};

/**
 * Виды графика: подбор прямой и диагностика режима фильтрации
 *
 * Это два разных занятия. На первом графике геолог ведёт прямую и получает T,
 * на втором — смотрит, применима ли вообще формула, по которой она считается.
 * Показывать оба сразу значило бы удвоить экран, поэтому они переключаются.
 */
const VIEWS = {
  FIT: "fit",
  DIAGNOSTIC: "diagnostic",
};

const PHASE_OPTIONS = [
  { key: PHASES.PUMPING, labelKey: "phasePumping", fallback: "Откачка" },
  {
    key: PHASES.RECOVERY,
    labelKey: "phaseRecovery",
    fallback: "Восстановление",
  },
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
/**
 * Ключ журнала у видов ОФР без скважин
 *
 * Журналы лежат в общей карте «скважина → строки». У одиночной откачки,
 * налива и восстановления скважина одна и в базе не заводится, поэтому её
 * ряду нужен свой ключ.
 */
const SINGLE_WELL = "__single__";

/**
 * Расстояние по умолчанию между опытной и наблюдательной скважиной, м
 *
 * С чего начинается куст на карте, если расстояние ещё не введено. Ноль не
 * годится: все маркеры легли бы в одну точку, и растащить их было бы нечем.
 */
const DEFAULT_SPACING = 50;

/**
 * Показывать ли карту куста
 *
 * Карта выключена целиком — и сама, и плашка «в Premium» вместо неё, — пока
 * подписка не запущена: предлагать купить то, чего ещё нельзя купить, хуже,
 * чем не предлагать вовсе. Расстояния всё это время вводятся в таблице, она
 * и была основным способом; карта их только дублировала.
 *
 * Возврат — одним значением: весь код карты на месте и ходит через этот
 * флаг, включая раскладку скважин по координатам.
 */
const CLUSTER_MAP_ENABLED = false;

/** Масштаб карты куста: на нём полсотни метров занимают заметную часть экрана */
const WELL_MAP_ZOOM = 18;

/** Пустой журнал: общая ссылка, чтобы пересчёты не срабатывали вхолостую */
const NO_ROWS = [];

/** Значащих цифр в поле ввода при переводе в выбранную размерность */
const SHOWN_PRECISION = 10;

/**
 * Значащих цифр при записи в базу — на разряд грубее показанного
 *
 * Показ уже округлён, поэтому обратный перевод не попадает в исходное число
 * точно: 0.9 м, показанные в футах и пересчитанные назад, дают
 * 0.90000000015. Округление с той же точностью, что и показ, этот остаток
 * сохраняет, и цикл «открыл — сохранил» уводит замер всё дальше. Разряд
 * запаса остаток гасит, и число возвращается в себя. Полевой замер девяти
 * значащих цифр не имеет и подавно.
 */
const STORED_PRECISION = 9;

function parseNumber(text) {
  if (typeof text !== "string") return Number(text);
  const normalized = text.replace(",", ".").trim();
  if (normalized === "") return NaN;
  return Number(normalized);
}

/**
 * Переводит строки таблицы в числовые замеры
 *
 * Незаполненные и недобранные строки отбрасываются: пустая строка в конце
 * журнала — обычное состояние во время ввода, а не ошибка.
 *
 * Числа приводятся к базовым единицам: расчёты в `calc/` написаны для минут
 * и метров, а в полях стоит то, что выбрано в настройках.
 *
 * @param {Array<{tText: string, sText: string}>} journalRows - строки журнала
 * @param {Function} toBase - перевод в базовую единицу, см. UnitsContext
 * @returns {Array<{t: number, s: number}>} замеры в минутах и метрах
 */
/**
 * Округляет значение перед записью в базу
 *
 * Обратный перевод показанного значения не попадает в исходное число точно:
 * 1 минута, показанная в часах, возвращается как 1.0000000002. Само по себе
 * это незаметно, но цикл «открыл — сохранил» повторяется, и замер уползает.
 * Округление делает цикл устойчивым: число возвращается в себя.
 *
 * @param {number} value - значение в базовой единице
 * @returns {number} округлённое значение
 */
function roundBase(value) {
  return isFinite(value) ? Number(value.toPrecision(STORED_PRECISION)) : value;
}

/**
 * Подписывает пьезопроводность в карточке
 *
 * Значения разбегаются на порядки: у песков это тысячи м²/сут, у трещиноватых
 * пород — миллионы. Ни фиксированный знак после запятой, ни постоянная
 * экспонента тут не годятся, поэтому крайности уходят в степенную запись, а
 * привычная середина остаётся обычным числом.
 *
 * @param {number} value - пьезопроводность в выбранной размерности
 * @returns {string} подпись или прочерк
 */
function formatDiffusivity(value) {
  if (!isFinite(value) || value <= 0) return "—";
  if (value >= 1e6 || value < 0.01) return value.toExponential(2);
  return String(Number(value.toPrecision(4)));
}

/**
 * Подписывает водоотдачу в карточке
 *
 * Водоотдача безразмерна и у напорных пластов имеет порядок 1e-4: с двумя
 * знаками после запятой в карточке стоял бы ноль.
 *
 * @param {number} value - водоотдача
 * @returns {string} подпись или прочерк
 */
function formatStorativity(value) {
  if (!isFinite(value) || value <= 0) return "—";
  return value < 0.01
    ? value.toExponential(2)
    : String(Number(value.toPrecision(3)));
}

/**
 * Переводит строки журнала в замеры в базовых единицах
 *
 * Замер помнит строку, из которой взят: незаполненные строки сюда не
 * попадают, а на восстановлении отсеиваются ещё и замеры до остановки насоса.
 * Считать номер точки на графике по номеру строки в таблице после такого
 * прореживания нельзя — отметка вставала бы на соседнюю точку.
 */
function toMeasurements(journalRows, toBase) {
  return journalRows
    .map((row) => ({
      row: row.id,
      t: toBase(parseNumber(row.tText), QUANTITIES.TIME),
      s: toBase(parseNumber(row.sText), QUANTITIES.DRAWDOWN),
    }))
    .filter((m) => isFinite(m.t) && isFinite(m.s));
}

/**
 * Журнал замеров: таблица «время — уровень» с добавлением и удалением строк
 *
 * Вынесен на уровень модуля, а не описан внутри экрана: объявленный в теле
 * функции, он оказывался бы новым типом компонента на каждом ре-рендере, и
 * поле ввода теряло бы фокус после первого же символа.
 *
 * @param {Object} props
 * @param {Object} props.theme - тема оформления
 * @param {Array} props.rows - строки журнала
 * @param {string} props.timeLabel - подпись столбца времени
 * @param {string} props.valueLabel - подпись столбца уровня
 * @param {boolean} [props.selectable] - показывать отметку выбора точки
 * @param {number[]} [props.selected] - номера отмеченных точек на графике
 * @param {Map<string, number>} [props.pointIndexes] - номер точки на графике
 *   по строке журнала; строки, которых на полотне нет, отмечать нечем
 */
function MeasurementJournal({
  theme,
  rows,
  timeLabel,
  valueLabel,
  onChange,
  onBlur,
  onAdd,
  onDelete,
  selectable = false,
  selected = [],
  pointIndexes,
  onToggleSelect,
}) {
  return (
    <View
      style={[
        styles.table,
        elevation.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[styles.tableHead, { borderBottomColor: theme.colors.border }]}
      >
        {selectable && <View style={styles.pickCell} />}
        <Text
          style={[
            styles.headCell,
            styles.cellDivider,
            {
              color: theme.colors.textSecondary,
              borderRightColor: theme.colors.border,
            },
          ]}
        >
          {timeLabel}
        </Text>
        <Text style={[styles.headCell, { color: theme.colors.textSecondary }]}>
          {valueLabel}
        </Text>
        <View style={styles.deleteCell} />
      </View>

      {rows.map((row, rowIndex) => {
        // Номер этой строки на полотне. Строки без него на графике нет —
        // она пустая либо выпала из ряда, — и отметить её нечем
        const pointIndex = pointIndexes?.get(row.id) ?? -1;
        const onPlot = pointIndex >= 0;
        const checked = onPlot && selected.includes(pointIndex);

        return (
        <View
          key={row.id}
          style={[styles.tableRow, { borderBottomColor: theme.colors.border }]}
        >
          {/* Отметка точки для прямой: тот же выбор, что и касанием
              по графику, но попасть по строке проще, чем по кружку */}
          {selectable && (
            <TouchableOpacity
              onPress={() => onToggleSelect(pointIndex)}
              disabled={!onPlot}
              style={styles.pickCell}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: !onPlot }}
              accessibilityLabel={`${I18n.t("measurement", { defaultValue: "Замер" })} ${rowIndex + 1}`}
            >
              <MaterialIcons
                name={checked ? "radio-button-checked" : "radio-button-unchecked"}
                size={20}
                color={
                  checked
                    ? theme.colors.primaryAccent
                    : onPlot
                      ? theme.colors.faint
                      : "transparent"
                }
              />
            </TouchableOpacity>
          )}
          <TextInput
            value={row.tText}
            onChangeText={(value) => onChange(row.id, "tText", value)}
            onBlur={onBlur}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={theme.colors.textSecondary}
            style={[
              styles.cellInput,
              styles.cellDivider,
              {
                color: theme.colors.text,
                borderRightColor: theme.colors.border,
              },
            ]}
          />
          <TextInput
            value={row.sText}
            onChangeText={(value) => onChange(row.id, "sText", value)}
            onBlur={onBlur}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.cellInput, { color: theme.colors.text }]}
          />
          <TouchableOpacity
            onPress={() => onDelete(row.id)}
            style={styles.deleteCell}
            accessibilityRole="button"
            accessibilityLabel={I18n.t("delete")}
          >
            <MaterialIcons
              name="close"
              size={18}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        );
      })}

      <TouchableOpacity
        style={styles.addRow}
        onPress={onAdd}
        accessibilityRole="button"
      >
        <MaterialIcons
          name="add"
          size={18}
          color={theme.colors.primaryAccent}
        />
        <Text
          style={[styles.addRowText, { color: theme.colors.primaryAccent }]}
        >
          {I18n.t("addMeasurement", { defaultValue: "Добавить замер" })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DataProcessingScreen({ route, navigation }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Размерности ввода и вывода. Внутри всё считается в базовых единицах,
  // перевод стоит только на границе: при чтении из базы и при записи
  const { unitLabel, toBase, fromBase } = useUnits();
  // Ссылка на прокрутку нужна графику: его жест перекрывает её на время
  // перетаскивания полотна
  const scrollRef = useRef(null);
  const projectId = route?.params?.projectId;

  const [project, setProject] = useState(null);
  // Журналы всех скважин разом: ключ — скважина, значение — строки таблицы.
  // Держать в состоянии только открытую скважину нельзя, кривые соседних
  // рисуются на том же графике
  const [journals, setJournals] = useState({});
  const [wells, setWells] = useState([]);
  const [activeWellId, setActiveWellId] = useState(null);
  // Куда увести карту после переноса куста: без этого она осталась бы
  // смотреть на старое место, а маркеры уехали бы за край.
  //
  // Объявлено здесь, а не рядом с остальным состоянием карты ниже: его
  // читает мемо `mapCenter`, и объявление под ним давало обращение к
  // константе до инициализации — экран падал в белое на любом типе ОФР
  const [mapCenterOverride, setMapCenterOverride] = useState(null);
  // Замеры восстановления живут отдельным журналом: время в них отсчитывается
  // от остановки насоса, и общей таблицей с откачкой они быть не могут
  const [recoveryJournals, setRecoveryJournals] = useState({});
  const [qText, setQText] = useState("");
  const [graphMode, setGraphMode] = useState(GRAPH_MODES.LOG);
  // Момент, на который снят срез по кусту для площадного прослеживания.
  // Пусто — значит берётся последний общий момент, см. moment ниже
  const [pickedMoment, setPickedMoment] = useState(null);
  const [loading, setLoading] = useState(true);
  // Фаза опыта: понижение на откачке или восстановление уровня после
  // остановки насоса. ТЗ требует оба вида — обрабатываются они по-разному
  const [phase, setPhase] = useState(PHASES.PUMPING);
  const [durationText, setDurationText] = useState("");
  /**
   * Понижение на момент остановки насоса — по журналам
   *
   * Ключ тот же, что у журналов замеров: у куста понижение на остановке своё
   * у каждой скважины — опытная садится на метры, дальняя наблюдательная на
   * сантиметры. Одно число на весь проект давало остаточное понижение чужой
   * скважины, разница выходила отрицательной, обрезалась нулём, и кривая
   * восстановления ложилась ровной горизонталью по нулю. Табл. «Окончание»
   * настольного АНСДИМАТ ведётся так же — по скважинам.
   */
  const [finalDrawdownTexts, setFinalDrawdownTexts] = useState({});

  // Колонка 720 px — если включена «Адаптация под планшет»; иначе вся ширина
  const column = useContentMaxWidth(720);
  const contentWidth = Math.min(width, column ?? width) - spacing.lg * 2;
  // Развёрнутый график: из высоты экрана вычитаем шапку навигации,
  // собственную шапку графика с переключателями, подпись цены деления
  // и плавающее нижнее меню — иначе полотно уезжает под меню
  // Карта под таблицей: не выше трети экрана, но и не полоска — иначе
  // растащить маркеры пальцем не выйдет
  const mapHeight = Math.min(320, Math.max(220, width * 0.62));
  // Кнопки развёрнутой карты поднимаются над плавающим меню по его
  // фактической высоте. Нижняя безопасная зона бывает нулевой (веб, старые
  // телефоны), поэтому берётся не меньше 26 — иначе кнопка садилась прямо
  // на полосу меню
  const buttonsAboveMenu = Math.max(insets.bottom, 26) + MENU_BAR_HEIGHT + 12;

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
    // Значение показывается в выбранной размерности. Хвосты вида
    // 0.30000000000000004 после перевода режем до 6 знаков: столько точности
    // в полевом замере всё равно нет
    const show = (value, quantity) => {
      if (!value) return "";
      const converted = fromBase(value, quantity);
      return isFinite(converted)
        ? String(Number(converted.toPrecision(SHOWN_PRECISION)))
        : "";
    };
    setQText(show(loaded.Q, QUANTITIES.FLOW));
    setDurationText(show(loaded.pumpingDuration, QUANTITIES.TIME));
    // Журнал восстановления сразу открываем в соответствующей фазе
    // Журналов типа «восстановление уровня» больше не заводят, но
    // заведённые прежде открываются как раньше — сразу в своей фазе
    if (loaded.ofrType === LEGACY_OFR_TYPES.RECOVERY) setPhase(PHASES.RECOVERY);
    const toRow = (m) => ({
      id: m.id,
      tText: show(m.t, QUANTITIES.TIME),
      sText: show(m.s, QUANTITIES.DRAWDOWN),
    });
    const loadedWells = loaded.wells ?? [];
    setWells(loadedWells);
    // Понижение на остановке: у журналов с одной скважиной оно проектное, у
    // куста лежит в строке скважины. Пусто — значит берётся из последнего
    // замера журнала откачки, см. finalDrawdownAtStop
    setFinalDrawdownTexts({
      [SINGLE_WELL]: show(loaded.finalDrawdown, QUANTITIES.DRAWDOWN),
      ...Object.fromEntries(
        loadedWells.map((well) => [
          well.id,
          show(well.finalDrawdown, QUANTITIES.DRAWDOWN),
        ]),
      ),
    });
    // Открытой остаётся прежняя скважина, если она никуда не делась: экран
    // перечитывается при каждом возврате, и сбрасывать выбор было бы обидно
    setActiveWellId((prev) =>
      prev && loadedWells.some((well) => well.id === prev)
        ? prev
        : ((
            loadedWells.find((well) => well.role === WELL_ROLES.OBSERVATION) ??
            loadedWells[0]
          )?.id ?? null),
    );

    const grouped = {};
    for (const measurement of loaded.measurements) {
      const key = measurement.wellId ?? SINGLE_WELL;
      (grouped[key] ??= []).push(toRow(measurement));
    }
    setJournals(grouped);

    const groupedRecovery = {};
    for (const measurement of loaded.recoveryMeasurements ?? []) {
      const key = measurement.wellId ?? SINGLE_WELL;
      (groupedRecovery[key] ??= []).push(toRow(measurement));
    }
    setRecoveryJournals(groupedRecovery);

    // Расстояния показываются в выбранной размерности, хранятся в метрах
    setDistanceTexts(
      Object.fromEntries(
        loadedWells.map((well) => [
          well.id,
          well.distance ? show(well.distance, QUANTITIES.DISTANCE) : "",
        ]),
      ),
    );
    setLoading(false);
    // fromBase меняется вместе с настройкой размерности: журнал нужно
    // перечитать и показать в новых единицах, иначе в полях останутся числа
    // от прежней размерности с новой подписью
  }, [projectId, fromBase]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Строки открытой скважины. Обёртка поверх карты журналов: все обработчики
  // таблицы написаны под «rows/setRows» и про скважины знать не обязаны
  const journalKey = activeWellId ?? SINGLE_WELL;
  const rows = journals[journalKey] ?? NO_ROWS;
  const setRows = useCallback(
    (updater) =>
      setJournals((prev) => {
        const current = prev[journalKey] ?? NO_ROWS;
        const next = typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [journalKey]: next };
      }),
    [journalKey],
  );

  // То же самое для журнала восстановления: у куста он свой у каждой скважины
  const recoveryRows = recoveryJournals[journalKey] ?? NO_ROWS;
  const setRecoveryRows = useCallback(
    (updater) =>
      setRecoveryJournals((prev) => {
        const current = prev[journalKey] ?? NO_ROWS;
        const next = typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [journalKey]: next };
      }),
    [journalKey],
  );

  // Замеры в числовом виде — общий источник для графика и расчёта.
  // Пересчитываются только при правке таблицы: диагностика перебирает точки
  // окнами, и гонять её на каждый ре-рендер экрана незачем
  const measurements = useMemo(
    () => toMeasurements(rows, toBase),
    [rows, toBase],
  );
  const recoveryMeasurements = useMemo(
    () => toMeasurements(recoveryRows, toBase),
    [recoveryRows, toBase],
  );

  const Q = toBase(parseNumber(qText), QUANTITIES.FLOW);
  const isRecovery = phase === PHASES.RECOVERY;
  const pumpingDuration = toBase(parseNumber(durationText), QUANTITIES.TIME);

  // Одиночная и кустовая откачки ведут два раздельных журнала — понижение и
  // восстановление, как таблицы «Понижение» и «Восстановление» настольного
  // АНСДИМАТ. У куста пара журналов своя у каждой скважины. Остальные виды
  // ОФР заполняют один журнал, и на восстановлении его строки — это и есть
  // замеры после остановки насоса
  const dualJournals =
    project?.ofrType === OFR_TYPES.SINGLE ||
    project?.ofrType === OFR_TYPES.CLUSTER;

  const clusterWells = project?.ofrType === OFR_TYPES.CLUSTER;

  // Карта куста закрыта подпиской. Права выдаёт сервер, поэтому без ответа и
  // без входа в аккаунт карта считается закрытой — иначе премиум открывался бы
  // отсутствием связи
  const { has } = useEntitlements();
  const mapAllowed = CLUSTER_MAP_ENABLED && has("clusterMap");

  // Поле понижения на остановке правит открытый журнал, а не проект целиком
  const finalDrawdownText = finalDrawdownTexts[journalKey] ?? "";
  const setFinalDrawdownText = useCallback(
    (value) =>
      setFinalDrawdownTexts((prev) => ({ ...prev, [journalKey]: value })),
    [journalKey],
  );

  /**
   * Понижение на момент остановки насоса у открытой скважины
   *
   * Заданное руками важнее журнала: он не всегда доведён до остановки. Пустое
   * поле — берём последнюю строку журнала откачки этой же скважины, потому
   * что насос работал до неё. Раньше число было одно на весь проект, и у
   * куста остаточное понижение считалось от понижения чужой скважины.
   */
  const finalDrawdown = dualJournals
    ? finalDrawdownAtStop({
        measurements,
        stored: toBase(parseNumber(finalDrawdownText), QUANTITIES.DRAWDOWN),
      })
    : toBase(parseNumber(finalDrawdownText), QUANTITIES.DRAWDOWN);

  /**
   * Подставляет понижение на остановке из журнала откачки
   *
   * Раньше число стояло только подсказкой в пустом поле: расчёт его брал, а
   * на вид поле оставалось незаполненным, и было непонятно, увидело
   * приложение журнал или нет. Теперь оно вписывается значением — то же
   * самое делает клавиша Ins в табл. «Окончание» настольного АНСДИМАТ.
   *
   * Подставляем один раз на журнал: очищенное руками поле обратно не
   * заполняется, иначе стереть его было бы нельзя — журнал меняется от
   * каждого нажатия, и эффект переписывал бы пустоту числом.
   */
  const seededStops = useRef(new Set()).current;
  useEffect(() => {
    if (!dualJournals || !isRecovery || loading) return;
    if (seededStops.has(journalKey)) return;
    const fromJournal = finalDrawdownAtStop({ measurements });
    if (!(fromJournal > 0)) return;
    seededStops.add(journalKey);
    setFinalDrawdownTexts((prev) => {
      if ((prev[journalKey] ?? "") !== "") return prev;
      const shown = fromBase(fromJournal, QUANTITIES.DRAWDOWN);
      return {
        ...prev,
        [journalKey]: isFinite(shown)
          ? String(Number(shown.toPrecision(SHOWN_PRECISION)))
          : "",
      };
    });
  }, [
    dualJournals,
    isRecovery,
    loading,
    journalKey,
    measurements,
    fromBase,
    seededStops,
  ]);

  /**
   * Восстановился ли уровень
   *
   * Ноль журнала восстановления отвечает понижению на момент остановки,
   * поэтому остаточное понижение — это разница между ним и последним
   * замером восстановления. Опыт принято считать законченным, когда
   * остаток упал ниже 5 % от понижения на остановке.
   */
  const completeness = useMemo(() => {
    if (!recoveryMeasurements.length) return { ratio: NaN, complete: false };
    const lastRecovery =
      recoveryMeasurements[recoveryMeasurements.length - 1].s;
    return recoveryCompleteness(finalDrawdown - lastRecovery, finalDrawdown);
  }, [recoveryMeasurements, finalDrawdown]);

  // Прямая Тейса строится только там, где журнал один. У одиночной откачки
  // восстановление на график не выводится, и вести по нему прямую не по чему:
  // и график, и водопроводимость остаются за журналом откачки
  const theisRecovery = isRecovery && !dualJournals;

  // Способ построения прямой и выбранные точки: общие для графика и таблицы,
  // поэтому живут здесь, а не внутри графика
  const [fitMode, setFitMode] = useState(FIT_MODES.AUTO);
  const [selectedPoints, setSelectedPoints] = useState([]);
  /**
   * Масштабы графика по ключу системы координат
   *
   * Живёт здесь, а не в графике: развёрнутый и обычный график — две разные
   * ветки рендера, то есть два разных монтирования компонента, и хранилище
   * внутри него не пережило бы разворот на весь экран и обратно.
   */
  const viewportStore = useRef(new Map()).current;
  /**
   * Свободные точки в базовых единицах
   *
   * Хранятся так же, как всё остальное: абсцисса — уже преобразованная (lg t,
   * lg r), но в минутах и метрах, ордината — понижение в метрах. График
   * работает в единицах пользователя, и перевод стоит на границе — иначе смена
   * размерности сдвигала бы прямую, а вместе с ней и пьезопроводность.
   */
  const [freeAnchors, setFreeAnchors] = useState(null);

  /**
   * Скважины, снятые с полотна
   *
   * Куст из пяти скважин даёт пять кривых, и разобрать их вместе нельзя.
   * Скрытие не трогает ни журналы, ни расчёт: убирается только линия
   * сравнения. Открытую скважину скрыть нечем — по ней идёт прямая, и она
   * выбирается теми же чипами выше.
   */
  const [hiddenWells, setHiddenWells] = useState(() => new Set());
  const toggleWellVisible = useCallback((wellId) => {
    setHiddenWells((prev) => {
      const next = new Set(prev);
      if (next.has(wellId)) next.delete(wellId);
      else next.add(wellId);
      return next;
    });
  }, []);

  /**
   * Доступны ли виды с расстоянием в абсциссе
   *
   * Кусту — да: у остальных видов ОФР расстояний нет вовсе. И только на
   * откачке: площадное s — lg r и комбинированное s — lg(t/r²) читают
   * понижение при работающем насосе, а на восстановлении такой зависимости
   * нет — остаточное понижение по Джейкобу равно 0.183·Q/T·lg(t/t′) и от r
   * не зависит. Раньше эти виды оставались открытыми и в фазе
   * восстановления: на полотне лежали те же точки откачки, подписи осей
   * менялись, и прямую по ним можно было ещё и подвинуть.
   */
  const distanceModes = clusterWells && !isRecovery;

  // Вид приводится здесь, а не сбрасывается эффектом: журнал открывают из
  // списка, и с чужим видом графика экран успел бы мигнуть пустым полотном
  const effectiveMode =
    distanceModes || !TRACKING_BY_MODE[graphMode] ? graphMode : GRAPH_MODES.LOG;
  const trackingKind = TRACKING_BY_MODE[effectiveMode] ?? TRACKING_KINDS.TIME;
  // Ось времени осталась выбором только у временнóго прослеживания: у
  // остальных абсцисса задана самим видом и всегда логарифмическая
  const xMode =
    trackingKind === TRACKING_KINDS.TIME ? effectiveMode : X_MODES.LOG;

  // Мемоизация здесь не про скорость: `recovery.points` попадает в точки
  // графика, а через них в его исходную видимую область. Пересчёт на каждом
  // рендере давал новый массив, и график считал, что данные сменились
  const recovery = useMemo(
    () => processRecovery({ measurements, Q, pumpingDuration }),
    [measurements, Q, pumpingDuration],
  );

  const activeWell = wells.find((well) => well.id === activeWellId) ?? null;

  // Замеры всех скважин куста в базовых единицах. Площадному и
  // комбинированному прослеживанию нужен весь куст сразу, а не только тот
  // журнал, что открыт на экране
  const wellMeasurements = useMemo(() => {
    const byWell = {};
    for (const [key, journalRows] of Object.entries(journals)) {
      byWell[key] = toMeasurements(journalRows, toBase);
    }
    return byWell;
  }, [journals, toBase]);

  // Скважины, у которых есть расстояние: без него точку на графике с r не
  // поставить. Опытная входит наравне с наблюдательными — в её строке стоит
  // радиус ствола r₀, и это тоже расстояние
  const wellsWithDistance = useMemo(
    () => (clusterWells ? wells.filter((well) => well.distance > 0) : []),
    [clusterWells, wells],
  );

  /**
   * Моменты времени, снятые хотя бы в двух скважинах куста
   *
   * Площадное прослеживание — срез по кусту на один момент, поэтому годятся
   * только совпадающие замеры: интерполировать понижение между отсчётами
   * значило бы ставить на график то, чего в журнале нет. Ключом идёт
   * `roundBase`, тем же округлением, с каким замер лёг в базу, — иначе
   * полчаса, введённые как «0.5 ч» и как «30 мин», разошлись бы в последнем
   * разряде и попали в разные моменты.
   */
  const commonMoments = useMemo(() => {
    const wellsPerMoment = new Map();
    for (const well of wellsWithDistance) {
      const seen = new Set();
      for (const m of wellMeasurements[well.id] ?? NO_ROWS) {
        const key = roundBase(m.t);
        // Повторный замер в той же скважине вторым свидетелем не считается
        if (!(key > 0) || seen.has(key)) continue;
        seen.add(key);
        wellsPerMoment.set(key, (wellsPerMoment.get(key) ?? 0) + 1);
      }
    }
    return [...wellsPerMoment.entries()]
      .filter(([, count]) => count >= 2)
      .map(([time]) => time)
      .sort((a, b) => a - b);
  }, [wellsWithDistance, wellMeasurements]);

  // По умолчанию берётся последний общий момент: к концу откачки условие
  // применимости способа прямой линии выполнено и в дальних скважинах
  const moment = commonMoments.includes(pickedMoment)
    ? pickedMoment
    : (commonMoments[commonMoments.length - 1] ?? NaN);

  /**
   * Прямая Тейса на полотне
   *
   * Двумя путями: вид ОФР «восстановление уровня», где журнал один, и выбор
   * кривой восстановления у одиночной и кустовой откачки. В обоих случаях по
   * оси абсцисс отложено отношение t/t′, а не время, и от этого зависит всё
   * остальное — от подписи оси до формулы расчёта.
   */
  // Фаза восстановления обрабатывается прямой Тейса всегда: на полотне
  // только остаточное понижение, а оно спрямляется по lg(t/t′) и нигде
  // больше. Кривой откачки рядом с ним теперь не бывает, см. chartRawSeries
  const theisPlot = isRecovery;

  /**
   * Кривые открытого графика в базовых единицах
   *
   * `t` у точки — сырая абсцисса вида прослеживания: время в минутах,
   * расстояние в метрах, t/r² в мин/м² или безразмерное t/t′. Логарифм берут
   * те, кому он нужен, — обработка и график по отдельности.
   */
  const rawSeries = useMemo(() => {
    // Вид ОФР «восстановление уровня»: журнал один, и его строки — это и есть
    // замеры после остановки насоса. Расчёт уже сделан processRecovery
    if (theisRecovery) {
      return recovery.points.length
        ? [
            {
              id: "recovery",
              name: activeWell?.name,
              role: SERIES_ROLES.FIT,
              measurements: recovery.points.map((point) => ({
                row: point.row,
                t: point.t / point.tPrime,
                s: point.y,
              })),
            },
          ]
        : [];
    }

    return chartRawSeries({
      trackingKind,
      measurements,
      recoveryMeasurements,
      finalDrawdown,
      pumpingDuration,
      wellsWithDistance,
      wellMeasurements,
      moment,
      isRecovery: isRecovery && dualJournals,
      activeWellName: activeWell?.name,
      // Тем же округлением, с каким замер лёг в базу: иначе полчаса, введённые
      // как «0.5 ч» и как «30 мин», разойдутся в последнем разряде и попадут
      // в разные моменты
      sameMoment: (t, at) => roundBase(t) === at,
    });
  }, [
    theisRecovery,
    recovery.points,
    trackingKind,
    measurements,
    recoveryMeasurements,
    finalDrawdown,
    pumpingDuration,
    wellsWithDistance,
    wellMeasurements,
    moment,
    isRecovery,
    dualJournals,
    activeWell,
  ]);

  // Ряд, по которому идёт прямая и отмечаются точки. Обработка написана под
  // плоский список, и менять её ради второй кривой незачем: кривая сравнения
  // в расчёт не входит по определению
  const basePoints = useMemo(() => {
    const fitted = rawSeries.find((one) => one.role === SERIES_ROLES.FIT);
    return (fitted?.measurements ?? []).map((m) => ({
      x: m.t,
      s: m.s,
      row: m.row,
      group: m.group,
      groupName: m.groupName,
    }));
  }, [rawSeries]);

  /**
   * Номер точки на полотне по строке журнала
   *
   * Отметки точек нумерованы по ряду, который лежит на графике, а не по
   * таблице: пустые строки и замеры до остановки насоса в ряд не попадают,
   * а на площадном прослеживании точки ещё и переставлены по расстоянию.
   * Строка, которой на полотне нет, отмечена быть не может — по ней нечего
   * проводить прямую.
   */
  const pointIndexByRow = useMemo(() => {
    const byRow = new Map();
    basePoints.forEach((point, index) => {
      if (point.row != null) byRow.set(point.row, index);
    });
    return byRow;
  }, [basePoints]);

  /**
   * Обработка восстановления у одиночной и кустовой откачки
   *
   * `processRecovery` написан под журнал, где время идёт от начала откачки, а
   * значение — остаточное понижение. Здесь журнал свой: время от остановки
   * насоса, значение — подъём уровня. Приводим одно к другому и пользуемся
   * уже проверенным методом, вместо того чтобы писать второй такой же.
   */
  const dualRecovery = useMemo(() => {
    if (!(dualJournals && isRecovery)) {
      return { slope: NaN, intercept: NaN, r2: NaN, warnings: [] };
    }
    const fromStart = residualDrawdown({
      measurements: recoveryMeasurements,
      finalDrawdown,
    }).map((m) => ({ t: pumpingDuration + m.t, s: m.s }));
    return processRecovery({ measurements: fromStart, Q, pumpingDuration });
  }, [
    dualJournals,
    isRecovery,
    recoveryMeasurements,
    finalDrawdown,
    pumpingDuration,
    Q,
  ]);

  /**
   * Переводит абсциссу в ту величину, по которой строится прямая
   *
   * @param {number} x - сырая абсцисса точки
   * @returns {number|null} значение на оси; null, если точка непригодна
   */
  const toAbscissa = useCallback(
    (x) =>
      trackingKind === TRACKING_KINDS.TIME && !theisPlot
        ? transformTime(x, xMode)
        : x > 0
          ? Math.log10(x)
          : null,
    [trackingKind, theisPlot, xMode],
  );

  /**
   * Прямая, проведённая геологом по двум отмеченным точкам
   *
   * Считается по базовым точкам, а не по тем, что на графике: график построен
   * в выбранных пользователем единицах, и свободный член у него другой. Наклону
   * это безразлично, а пьезопроводность уехала бы вместе с отсечкой.
   */
  const manualLine = useMemo(() => {
    if (fitMode === FIT_MODES.FREEDOM) {
      const line = freeLine(freeAnchors);
      // Вырожденную прямую не подменяем регрессией: раньше она пропадала
      // с полотна, а T в карточке молча менялось на другое число, и понять
      // это по экрану было невозможно
      if (!line.ready) {
        return freeAnchors?.length === 2
          ? { slope: NaN, intercept: NaN }
          : undefined;
      }
      return line;
    }
    if (selectedPoints.length !== 2) return undefined;
    const at = (index) => {
      const point = basePoints[index];
      if (!point) return null;
      const x = toAbscissa(point.x);
      return x == null || !isFinite(x) ? null : { x, y: point.s };
    };
    const line = lineThroughPoints(
      at(selectedPoints[0]),
      at(selectedPoints[1]),
    );
    return isFinite(line.slope) ? line : undefined;
  }, [fitMode, freeAnchors, selectedPoints, basePoints, toAbscissa]);

  // Обработка того графика, который открыт. Форма результата у всех трёх
  // видов одна, поэтому карточки ниже не разбирают, какой из них выбран
  const result =
    trackingKind === TRACKING_KINDS.AREA
      ? processAreaTracking({
          points: basePoints,
          Q,
          time: moment,
          line: manualLine,
        })
      : trackingKind === TRACKING_KINDS.COMBINED
        ? processCombinedTracking({ points: basePoints, Q, line: manualLine })
        : processDrawdown({
            measurements: measurements,
            Q,
            mode: xMode,
            // Водоотдача и пьезопроводность требуют расстояния: у одиночной
            // откачки его нет, и обе останутся с прочерком
            r: activeWell?.distance,
            line: manualLine,
          });

  /**
   * Множитель перевода абсциссы в выбранные пользователем единицы
   *
   * Точки отдаются графику в тех же размерностях, что стоят в журнале, иначе
   * на оси были бы минуты и метры, а в таблице часы и футы. У комбинированного
   * абсцисса составная — время на квадрат длины, — поэтому множитель
   * собирается из двух. Отношение t/t′ на прямой Тейса безразмерно.
   */
  const abscissaFactor = useMemo(() => {
    if (theisPlot) return 1;
    const distance = fromBase(1, QUANTITIES.DISTANCE);
    if (trackingKind === TRACKING_KINDS.AREA) return distance;
    const time = fromBase(1, QUANTITIES.TIME);
    if (trackingKind === TRACKING_KINDS.COMBINED) {
      return time / (distance * distance);
    }
    return time;
  }, [theisPlot, trackingKind, fromBase]);

  // Кривые в тех размерностях, что стоят в журнале. Роль серии график знает
  // сам: по ней он решает, где вести прямую и на чём отмечать точки
  const dataSeries = useMemo(
    () =>
      rawSeries.map((one) => ({
        id: one.id,
        name: one.name,
        role: one.role,
        measurements: one.measurements.map((m) => ({
          t: m.t * abscissaFactor,
          s: fromBase(m.s, QUANTITIES.DRAWDOWN),
          group: m.group,
          groupName: m.groupName,
        })),
      })),
    [rawSeries, abscissaFactor, fromBase],
  );

  /**
   * Сдвиг абсциссы между базовыми единицами и координатами графика
   *
   * График строит ось по уже преобразованному значению: логарифму, корню или
   * самому времени. Смена размерности умножает величину под преобразованием,
   * а после него превращается в сдвиг у логарифма и в множитель у остальных.
   * Свободные точки живут в базовых единицах, поэтому переводятся здесь.
   */
  const abscissaShift = xMode === X_MODES.LOG ? Math.log10(abscissaFactor) : 0;
  const abscissaScale =
    xMode === X_MODES.LOG
      ? 1
      : xMode === X_MODES.SQRT
        ? Math.sqrt(abscissaFactor)
        : abscissaFactor;

  // Свободные точки для графика: из базовых единиц в те, что на осях
  const chartAnchors = useMemo(
    () =>
      freeAnchors?.length === 2
        ? freeAnchors.map((anchor) => ({
            x: anchor.x * abscissaScale + abscissaShift,
            y: fromBase(anchor.y, QUANTITIES.DRAWDOWN),
          }))
        : null,
    [freeAnchors, abscissaScale, abscissaShift, fromBase],
  );

  /**
   * Принимает свободные точки от графика и переводит их в базовые единицы
   *
   * @param {Array<{x: number, y: number}>} next - точки в координатах графика
   */
  const handleAnchorsChange = useCallback(
    (next) => {
      if (next?.length !== 2) return;
      setFreeAnchors(
        next.map((anchor) => ({
          x: (anchor.x - abscissaShift) / abscissaScale,
          y: toBase(anchor.y, QUANTITIES.DRAWDOWN),
        })),
      );
    },
    [abscissaShift, abscissaScale, toBase],
  );
  const chartMode = theisPlot ? X_MODES.LOG : xMode;
  const chartCaption = theisPlot
    ? "s′ — lg(t/t′)"
    : GRAPH_CAPTIONS[effectiveMode];

  /**
   * Чем задана система координат графика
   *
   * По смене этого ключа график заново подгоняет видимую область под данные.
   * Сюда входит всё, от чего зависят сами оси, и не входят значения замеров:
   * поправив опечатку в журнале, геолог не должен терять масштаб.
   *
   * Открытая скважина попадает в ключ только у временнóго прослеживания — на
   * графиках с расстоянием весь куст лежит на одной плоскости, и переключение
   * скважины там ничего не меняет.
   */
  const chartViewKey = [
    effectiveMode,
    phase,
    trackingKind === TRACKING_KINDS.TIME ? activeWellId : "cluster",
    trackingKind === TRACKING_KINDS.AREA ? moment : "",
    // Фаза меняет саму ось: у прямой Тейса по абсциссе отложено отношение
    // t/t′, а не время
    isRecovery ? "recovery" : "",
    // Смена размерности растягивает оси: прежнее окно смотрело бы не туда
    abscissaFactor,
    fromBase(1, QUANTITIES.DRAWDOWN),
  ].join("|");

  // Что отложено по оси абсцисс. У прямой Тейса отношение безразмерно, у
  // комбинированного размерность составная
  const chartAxisTitle = theisPlot
    ? "t/t′"
    : trackingKind === TRACKING_KINDS.AREA
      ? `r, ${unitLabel(QUANTITIES.DISTANCE)}`
      : trackingKind === TRACKING_KINDS.COMBINED
        ? `t/r², ${unitLabel(QUANTITIES.TIME)}/${unitLabel(QUANTITIES.DISTANCE)}²`
        : undefined;

  /**
   * Почему на полотне пусто
   *
   * У пустого графика причин несколько, и общая подсказка «внесите замеры»
   * врёт, когда замеры внесены, а не хватает расстояний или общего момента.
   * Заглушка на полотне — первое, куда смотрят, и объяснение должно стоять
   * там, а не только под карточками.
   */
  const chartEmpty = useMemo(() => {
    if (basePoints.length > 0) return null;
    // Прямая Тейса строится по замерам после остановки насоса, и другого
    // источника у неё нет. Общая подсказка «внесите замеры в журнале выше»
    // показывает на журнал откачки, который как раз заполнен
    if (theisPlot && dualJournals && !recoveryMeasurements.length) {
      return {
        title: I18n.t("recoveryEmptyTitle", {
          defaultValue: "Журнал восстановления пуст",
        }),
        hint: I18n.t("recoveryEmptyHint", {
          defaultValue:
            "Внесите замеры после остановки насоса — прямая Тейса строится по ним.",
        }),
      };
    }
    // Журнал восстановления заполнен, а остатка не вышло: подъём уровня во
    // всех строках больше понижения на остановке. Кривая раньше ложилась
    // горизонталью по нулю и молчала о причине, см. residualDrawdown
    if (isRecovery && dualJournals && recoveryMeasurements.length > 0) {
      return !(finalDrawdown > 0)
        ? {
            title: I18n.t("recoveryNoStopTitle", {
              defaultValue: "Не задано понижение на остановке",
            }),
            hint: I18n.t("recoveryNoStopHint", {
              defaultValue:
                "Остаточное понижение отсчитывается от него. Заполните журнал откачки этой скважины до момента остановки насоса или впишите понижение в поле выше.",
            }),
          }
        : {
            title: I18n.t("recoveryOvershootTitle", {
              defaultValue: "Журнал не сходится с понижением на остановке",
            }),
            hint: I18n.t("recoveryOvershootHint", {
              defaultValue:
                "Подъём уровня во всех строках больше понижения на остановке, и остатка не остаётся. Проверьте, что в журнале восстановления стоит подъём уровня от момента остановки, а понижение на остановке взято у этой же скважины.",
            }),
          };
    }
    if (trackingKind === TRACKING_KINDS.AREA) {
      if (wellsWithDistance.length < 2) {
        return {
          title: I18n.t("areaEmptyTitle", {
            defaultValue: "Площадной график строится по кусту",
          }),
          hint: I18n.t("needTwoDistances"),
        };
      }
      return {
        title: I18n.t("areaEmptyTitle", {
          defaultValue: "Площадной график строится по кусту",
        }),
        hint: I18n.t("needCommonMoment"),
      };
    }
    if (trackingKind === TRACKING_KINDS.COMBINED && !wellsWithDistance.length) {
      return {
        title: I18n.t("combinedEmptyTitle", {
          defaultValue: "Комбинированный график требует расстояний",
        }),
        hint: I18n.t("needDistances"),
      };
    }
    return null;
  }, [
    basePoints.length,
    theisPlot,
    dualJournals,
    isRecovery,
    finalDrawdown,
    recoveryMeasurements.length,
    trackingKind,
    wellsWithDistance.length,
  ]);

  // Кустовая откачка: одна скважина — одна кривая. Прямая ведётся по
  // открытой, остальные идут рядом для сравнения. Строки журналов уже стоят
  // в выбранных размерностях, переводить их для графика не нужно.
  //
  // Только у временнóго прослеживания: на графиках с расстоянием весь куст
  // уже лежит в основном ряду, и соседние кривые задвоили бы точки
  const extraSeries = useMemo(() => {
    if (!clusterWells) return [];

    // Строки журналов стоят в выбранных размерностях, и кривые сравнения
    // собираются прямо из них: `dataSeries` переводит свои ряды туда же
    const numbers = (rowsOf) =>
      (rowsOf ?? NO_ROWS)
        .map((row) => ({
          t: parseNumber(row.tText),
          s: parseNumber(row.sText),
        }))
        .filter((m) => isFinite(m.t) && isFinite(m.s));

    const others = wells.filter(
      (well) => well.id !== activeWellId && !hiddenWells.has(well.id),
    );

    // Фаза восстановления: рядом с открытой скважиной идут восстановления
    // соседей, а не их откачки. Ось общая — отношение t/t′ безразмерно, —
    // а понижение на остановке у каждой скважины своё, поэтому остаток
    // считается по её собственному журналу откачки
    if (isRecovery) {
      if (!dualJournals) return [];
      const durationShown = parseNumber(durationText);
      return others
        .map((well) => ({
          id: well.id,
          name: well.name,
          role: SERIES_ROLES.REFERENCE,
          measurements: recoveryAbscissa({
            measurements: residualDrawdown({
              measurements: numbers(recoveryJournals[well.id]),
              finalDrawdown: finalDrawdownAtStop({
                measurements: numbers(journals[well.id]),
                stored:
                  well.finalDrawdown > 0
                    ? fromBase(well.finalDrawdown, QUANTITIES.DRAWDOWN)
                    : 0,
              }),
            }),
            pumpingDuration: durationShown,
          }),
        }))
        .filter((series) => series.measurements.length > 0);
    }

    // На видах с расстоянием весь куст уже лежит одним рядом: вторая кривая
    // задвоила бы точки
    if (trackingKind !== TRACKING_KINDS.TIME) return [];

    return others
      .map((well) => ({
        id: well.id,
        name: well.name,
        role: SERIES_ROLES.REFERENCE,
        measurements: numbers(journals[well.id]),
      }))
      .filter((series) => series.measurements.length > 0);
  }, [
    clusterWells,
    trackingKind,
    isRecovery,
    dualJournals,
    durationText,
    wells,
    activeWellId,
    hiddenWells,
    journals,
    recoveryJournals,
    fromBase,
  ]);

  // Всё, что рисуется на полотне: свои кривые и соседние скважины куста
  const chartSeries = useMemo(
    () => [...dataSeries, ...extraSeries],
    [dataSeries, extraSeries],
  );

  /**
   * Есть ли на полотне выбор кривой
   *
   * Только у куста и только там, где кривая и есть скважина: в координатах
   * s — lg t на откачке и на всей фазе восстановления. Выбрать кривую значит
   * открыть её журнал вместе с её расстоянием r. На видах с расстоянием весь
   * куст лежит одним рядом, и выбирать там нечего.
   */
  const seriesPickable =
    clusterWells &&
    (isRecovery || trackingKind === TRACKING_KINDS.TIME) &&
    extraSeries.length > 0;

  // Опытная скважина — столбец таблицы расстояний: считают до неё
  const pumpingWell =
    wells.find((well) => well.role === WELL_ROLES.PUMPING) ?? null;
  const observationCount = wells.filter(
    (well) => well.role === WELL_ROLES.OBSERVATION,
  ).length;

  // Скважины на карте. Опытная выделена цветом бренда, наблюдательные —
  // акцентным: на карте роль видно без легенды
  const mapPoints = useMemo(
    () =>
      wells
        .filter(
          (well) => Number.isFinite(well.lat) && Number.isFinite(well.lon),
        )
        .map((well) => ({
          id: well.id,
          lat: well.lat,
          lon: well.lon,
          title: well.name,
          color:
            well.role === WELL_ROLES.PUMPING
              ? theme.colors.primary
              : theme.colors.primaryAccent,
          draggable: true,
          label: true,
        })),
    [wells, theme.colors.primary, theme.colors.primaryAccent],
  );

  // Пунктир — лучи от опытной скважины: он и есть то, что стоит в таблице
  const mapConnect = useMemo(
    () =>
      pumpingWell
        ? { color: theme.colors.primaryAccent, fromId: pumpingWell.id }
        : undefined,
    [pumpingWell, theme.colors.primaryAccent],
  );

  const mapCenter = useMemo(
    () =>
      mapCenterOverride ??
      (pumpingWell && Number.isFinite(pumpingWell.lat)
        ? { lat: pumpingWell.lat, lon: pumpingWell.lon }
        : undefined),
    [mapCenterOverride, pumpingWell],
  );

  /**
   * Дописывает к подписи журнала имя открытой скважины
   *
   * У куста журналов вдвое больше: две фазы на каждую скважину. Без имени
   * непонятно, чьи замеры правятся, а без фазы — какие именно
   *
   * @param {string} label - подпись журнала
   * @returns {string} подпись с именем скважины у кустовой откачки
   */
  const withWellName = (label) =>
    clusterWells && activeWell ? `${label} — «${activeWell.name}»` : label;

  const [chartView, setChartView] = useState(VIEWS.FIT);
  // Развёрнут ли график на весь экран
  const [chartFullscreen, setChartFullscreen] = useState(false);
  /**
   * Высота места, которое график занимает в списке
   *
   * На время разворота график из списка убирается, а его место занимает
   * пустышка той же высоты. Без неё список бы укоротился, прокрутка съехала
   * бы к новому концу, и возврат в обычный вид показывал бы уже не то место.
   */
  const [chartSlotHeight, setChartSlotHeight] = useState(0);
  const handleChartSlotLayout = useCallback(
    (event) => {
      // Мерим только развёрнутый в списке график: в свёрнутом состоянии там
      // стоит пустышка, и её высота — это уже измеренная величина
      if (chartFullscreen) return;
      const next = event.nativeEvent.layout.height;
      setChartSlotHeight((prev) => (Math.abs(prev - next) < 1 ? prev : next));
    },
    [chartFullscreen],
  );

  // Плавающее меню приложения на развёрнутом графике убирается совсем: оно
  // висит поверх любого экрана и отнимает низ у той самой координатной
  // плоскости, ради которой разворот и нажимают. Возврат обязателен и при
  // уходе с экрана — иначе меню пропадёт по всему приложению
  useEffect(() => {
    setMenuHidden(chartFullscreen);
    return () => setMenuHidden(false);
  }, [chartFullscreen]);
  // Добавление наблюдательной скважины: форма раскрывается по нажатию «+»
  const [addingWell, setAddingWell] = useState(false);
  const [newWellName, setNewWellName] = useState("");
  const [wellError, setWellError] = useState("");
  const [pendingWellDelete, setPendingWellDelete] = useState(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  // Потеря подписки сворачивает развёрнутую карту. Без этого состояние
  // осталось бы взведённым, и после повторной оплаты экран открылся бы сразу
  // картой во весь экран — вместо того места, где человек остановился
  useEffect(() => {
    if (!mapAllowed) setMapFullscreen(false);
  }, [mapAllowed]);
  const [locating, setLocating] = useState(false);
  // Сообщение о геопозиции показывается плашкой на самой карте, а не
  // Alert.alert: на вебе тот не выводится вовсе, и отказ в доступе выглядел
  // бы как сломанная кнопка
  const [mapNotice, setMapNotice] = useState("");
  // Расстояния до опытной скважины в выбранной размерности: ключ — скважина
  const [distanceTexts, setDistanceTexts] = useState({});

  // Диагностика идёт по замерам откачки: на восстановлении время отсчитывается
  // от остановки насоса, и производная по нему означала бы другое
  const diagnosis = useMemo(() => diagnose(measurements), [measurements]);

  const handleToggleSelect = useCallback((index) => {
    setSelectedPoints((prev) => toggleSelection(prev, index));
  }, []);

  /**
   * Открывает журнал другой скважины куста
   *
   * Отметки точек и свободная прямая при этом сбрасываются: точка помнит своё
   * место в журнале, а журнал теперь другой — прежние номера показали бы
   * галочки не на тех строках, а свободная прямая осталась бы стоять там, где
   * её вели по чужой кривой.
   *
   * @param {string} wellId - идентификатор скважины
   */
  const handleWellChange = useCallback(
    (wellId) => {
      setActiveWellId((prev) => {
        if (prev === wellId) return prev;
        setSelectedPoints([]);
        setFreeAnchors(null);
        return wellId;
      });
    },
    [],
  );

  /**
   * Выбирает кривую, по которой ведётся прямая
   *
   * Кривые куста на плоскости s — lg t это скважины: у каждой своя, и прямая
   * идёт по открытой. Выбор кривой на полотне и есть открытие её журнала —
   * вместе с ним меняется расстояние r, а с ним пьезопроводность и водоотдача.
   *
   * @param {string} seriesId - идентификатор кривой; у соседних он совпадает
   *   с идентификатором скважины
   */
  const handleSelectSeries = useCallback(
    (seriesId) => {
      if (wells.some((well) => well.id === seriesId)) {
        handleWellChange(seriesId);
      }
    },
    [wells, handleWellChange],
  );

  const handleFitModeChange = useCallback((next) => {
    setFitMode(next);
    // Отметки замеров не снимаются: вернувшись в авто, геолог должен увидеть
    // ту же прямую, что вёл до перехода.
    // Свободные точки, наоборот, сбрасываются — график поставит их заново на
    // ту прямую, которая сейчас на плоскости
    if (next === FIT_MODES.FREEDOM) setFreeAnchors(null);
  }, []);
  // Прямую вёл геолог, а не метод наименьших квадратов: либо через две
  // отмеченные точки, либо свободную
  const usesManualFit = !!manualLine;

  /**
   * Числа открытого графика
   *
   * Берутся из обработки целиком, а не пересчитываются по наклону: у
   * площадного прослеживания свой множитель (0.366 вместо 0.183) и обратный
   * знак наклона, и формула T = 0.183·Q/a к нему не подходит.
   *
   * У прямой Тейса пересчёт свой. Отсечка на ней смысла пьезопроводности не
   * несёт — прямая обязана выходить из начала координат, — поэтому a берётся
   * из понижения на остановке насоса, см. diffusivityFromRecovery. Расстояние
   * для неё есть только у куста: у одиночной откачки и у отдельного журнала
   * восстановления скважин в проекте нет, и a там остаётся с прочерком.
   */
  const active = useMemo(() => {
    if (theisPlot) {
      // Журнал один у вида ОФР «восстановление уровня», два — у одиночной и
      // кустовой откачки; метод один и тот же
      const source = theisRecovery ? recovery : dualRecovery;
      const slope = manualLine ? manualLine.slope : source.slope;
      const T = transmissivityFromSlope(Q, slope);
      const a = diffusivityFromRecovery({
        slope,
        finalDrawdown,
        pumpingDuration,
        r: activeWell?.distance,
      });
      return {
        slope,
        T,
        S: isFinite(T) && a > 0 ? T / a : NaN,
        a,
      };
    }
    return result;
  }, [
    theisPlot,
    theisRecovery,
    recovery,
    dualRecovery,
    manualLine,
    Q,
    result,
    finalDrawdown,
    pumpingDuration,
    activeWell,
  ]);

  const activeSlope = active.slope;
  // На прямой Тейса ось X всегда логарифмическая, поэтому формула
  // T = 0.183·Q/a применима без оговорок
  const slopeApplicable = theisPlot || result.applicable;
  const activeT = slopeApplicable ? active.T : NaN;
  const activeS = active.S;
  const activeA = active.a;

  // Сколько точек лежит на открытом графике: у видов с расстоянием это не
  // длина журнала — там точки собраны по всему кусту
  const pointCount = basePoints.length;

  /**
   * Чего не хватает, чтобы посчитать водопроводимость
   *
   * Формула T = 0.183·Q/a требует и дебит, и наклон прямой. Если чего-то нет,
   * в карточке стоит прочерк — и без пояснения непонятно, что именно доделать.
   *
   * @returns {string} причина или пустая строка, если T посчитана
   */
  const missingT = useMemo(() => {
    if (isFinite(activeT)) return "";
    // Причину пустого полотна график уже написал на себе: повторять её
    // второй раз под карточками незачем
    if (chartEmpty) return "";

    // Свободные точки встали на одну вертикаль: наклона у такой прямой нет.
    // График сказал это на себе, но карточка с прочерком должна объяснять
    // ровно ту же причину, а не общую «внесите замеры»
    if (fitMode === FIT_MODES.FREEDOM && !freeLine(freeAnchors).ready) {
      return I18n.t("freedomDegenerate", {
        defaultValue:
          "Точки встали на одну вертикаль — такая прямая наклона не имеет. Разведите их по времени.",
      });
    }

    if (!slopeApplicable) {
      return I18n.t("needLogMode", {
        defaultValue:
          "Переключите ось X в режим lg t — по другим осям T не считается.",
      });
    }
    // Площадному прослеживанию нужен срез по кусту: без общего момента
    // времени точек нет вовсе, и общая подсказка «внесите замеры» врёт
    if (trackingKind === TRACKING_KINDS.AREA && !(moment > 0)) {
      return wellsWithDistance.length < 2
        ? I18n.t("needTwoDistances", {
            defaultValue:
              "Введите расстояния хотя бы до двух скважин: площадной график строится по кусту.",
          })
        : I18n.t("needCommonMoment", {
            defaultValue:
              "Нет момента времени, снятого хотя бы в двух скважинах. Площадной график строится по одновременным замерам.",
          });
    }
    if (trackingKind === TRACKING_KINDS.COMBINED && !wellsWithDistance.length) {
      return I18n.t("needDistances", {
        defaultValue:
          "Введите расстояния до скважин — без них комбинированный график не построить.",
      });
    }
    if (pointCount < 2) {
      return I18n.t("needTwoMeasurements", {
        defaultValue:
          "Внесите хотя бы два замера: по одной точке прямую не провести.",
      });
    }
    if (!(Q > 0)) {
      return I18n.t("needFlowRate", {
        defaultValue:
          "Укажите дебит Q — без него водопроводимость не рассчитать.",
      });
    }
    return I18n.t("needSlope", {
      defaultValue:
        "Понижение не растёт со временем: наклон прямой равен нулю, T не определена.",
    });
  }, [
    activeT,
    chartEmpty,
    fitMode,
    freeAnchors,
    slopeApplicable,
    trackingKind,
    moment,
    wellsWithDistance.length,
    pointCount,
    Q,
  ]);

  /**
   * Чего не хватает, чтобы посчитать пьезопроводность и водоотдачу
   *
   * Обе идут от свободного члена прямой, и обеим нужно расстояние. Прямая уже
   * может быть проведена, а карточки стоять с прочерком — без пояснения это
   * выглядит как поломка.
   *
   * @returns {string} причина или пустая строка
   */
  const missingA = useMemo(() => {
    if (!isFinite(activeT) || isFinite(activeA)) return "";
    if (theisPlot) {
      return I18n.t("recoveryNoDiffusivity", {
        defaultValue:
          "Прямая Тейса даёт только водопроводимость: расстояние в неё не входит.",
      });
    }
    if (trackingKind === TRACKING_KINDS.TIME && !(activeWell?.distance > 0)) {
      return clusterWells
        ? I18n.t("needWellDistance", {
            defaultValue:
              "Введите расстояние до этой скважины — без него пьезопроводность и водоотдачу не получить.",
          })
        : I18n.t("singleNoDistance", {
            defaultValue:
              "Пьезопроводность и водоотдача требуют расстояния до наблюдательной скважины: у одиночной откачки его нет.",
          });
    }
    return "";
  }, [activeT, activeA, theisPlot, trackingKind, activeWell, clusterWells]);

  /**
   * Сохраняет дебит и оба журнала замеров вместе с результатом расчёта
   *
   * @param {Array} nextRows - строки журнала откачки
   * @param {number} nextQ - дебит
   * @param {Array} [nextRecoveryRows] - строки журнала восстановления
   */
  const persist = useCallback(
    async (nextRows, nextQ, nextRecoveryRows = recoveryRows) => {
      if (!projectId) return;
      // Вид прослеживания входит в пометку метода: T по площадному графику
      // получена по другой формуле, и в отчёте это разные числа
      const method = theisPlot
        ? "theis-recovery"
        : trackingKind === TRACKING_KINDS.TIME
          ? "cooper-jacob"
          : `cooper-jacob-${trackingKind}`;
      await updateProject(projectId, {
        Q: isFinite(nextQ) ? roundBase(nextQ) : 0,
        pumpingDuration: isFinite(pumpingDuration)
          ? roundBase(pumpingDuration)
          : 0,
        // У куста понижение на остановке своё у каждой скважины и лежит в её
        // строке, см. handleFinalDrawdownBlur. Проектное поле осталось за
        // журналами с одной скважиной — перезапись его числом открытой
        // скважины подменяла бы значение при каждом переключении
        ...(clusterWells
          ? {}
          : {
              finalDrawdown: isFinite(finalDrawdown)
                ? roundBase(finalDrawdown)
                : 0,
            }),
        results: {
          // Сохраняем ту прямую, которую геолог видит на графике,
          // включая проведённую вручную по двум точкам
          T: isFinite(activeT) ? activeT : null,
          slope: isFinite(activeSlope) ? activeSlope : null,
          method: slopeApplicable
            ? usesManualFit
              ? `${method}-two-points`
              : method
            : null,
        },
      });
      // В базе всё лежит в базовых единицах: смена размерности в настройках
      // не должна задним числом менять смысл уже введённых замеров
      const toStored = (journalRows) =>
        journalRows
          .map((row) => ({
            id: row.id,
            t: roundBase(toBase(parseNumber(row.tText), QUANTITIES.TIME)),
            s: roundBase(toBase(parseNumber(row.sText), QUANTITIES.DRAWDOWN)),
          }))
          .filter((m) => isFinite(m.t) && isFinite(m.s));

      // Фаза помечает журнал, которому принадлежит строка. Виды ОФР с
      // единственным журналом держат замеры в основном — там они и лежали
      // до разделения, и переносить их некуда
      await replaceMeasurements(
        projectId,
        toStored(nextRows),
        MEASUREMENT_PHASES.PUMPING,
        activeWellId,
      );

      // Журнал восстановления переписываем только там, где он есть: у
      // остальных видов пустой список пометил бы удалёнными чужие строки
      if (dualJournals) {
        await replaceMeasurements(
          projectId,
          toStored(nextRecoveryRows),
          MEASUREMENT_PHASES.RECOVERY,
          activeWellId,
        );
      }
    },
    [
      projectId,
      activeT,
      activeSlope,
      slopeApplicable,
      usesManualFit,
      theisPlot,
      trackingKind,
      pumpingDuration,
      finalDrawdown,
      clusterWells,
      toBase,
      activeWellId,
      recoveryRows,
      dualJournals,
    ],
  );

  /**
   * Записывает понижение на остановке в строку открытой скважины
   *
   * Ноль значит «не задано»: число тогда берётся из последней строки журнала
   * откачки. Запись идёт только при настоящем изменении — иначе каждое
   * открытие журнала помечало бы скважину изменённой и гнало её в синхронизацию.
   */
  const commitWellFinalDrawdown = useCallback(() => {
    if (!clusterWells || !activeWellId) return;
    const value = toBase(parseNumber(finalDrawdownText), QUANTITIES.DRAWDOWN);
    const stored = isFinite(value) && value > 0 ? roundBase(value) : 0;
    const well = wells.find((one) => one.id === activeWellId);
    if (!well || well.finalDrawdown === stored) return;
    setWells((prev) =>
      prev.map((one) =>
        one.id === activeWellId ? { ...one, finalDrawdown: stored } : one,
      ),
    );
    setWellFinalDrawdown(activeWellId, stored).catch(() => {});
  }, [clusterWells, activeWellId, finalDrawdownText, wells, toBase]);

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
      persistRef.current(rows, parseNumber(qText), recoveryRows);
    }, 600);
    return () => clearTimeout(timer);
  }, [
    projectId,
    loading,
    rows,
    qText,
    durationText,
    finalDrawdownText,
    recoveryRows,
    clusterWells,
  ]);

  /**
   * Автосохранение понижения на остановке у скважины куста
   *
   * Тем же способом, что и остальные поля: с клавиатуры уходят кнопкой
   * «назад», а не касанием соседнего поля, и onBlur там не случается —
   * набранное в последнем поле пропадало бы вместе с экраном.
   */
  useEffect(() => {
    if (loading) return undefined;
    const timer = setTimeout(commitWellFinalDrawdown, 600);
    return () => clearTimeout(timer);
  }, [loading, commitWellFinalDrawdown]);

  /**
   * Подпись под результатом: какой метод сработал и насколько точно
   *
   * @returns {string} пояснение к расчёту
   */
  const renderMethodNote = () => {
    if (!theisPlot && !result.applicable)
      return I18n.t("methodNeedLogAxis");

    // Вид прослеживания называется прямо: по площадному графику T считается
    // с другим множителем, и подпись «Купер — Джейкоб» без уточнения не
    // сказала бы, откуда взялось число
    const base = theisPlot
      ? I18n.t("methodRecovery")
      : trackingKind === TRACKING_KINDS.AREA
        ? I18n.t("methodAreaTracking", {
            defaultValue: "Площадное прослеживание, T = 0.366·Q/C.",
          })
        : trackingKind === TRACKING_KINDS.COMBINED
          ? I18n.t("methodCombinedTracking", {
              defaultValue: "Комбинированное прослеживание, T = 0.183·Q/C.",
            })
          : I18n.t("methodCooperJacob");
    if (fitMode === FIT_MODES.FREEDOM) {
      return `${base} ${I18n.t("methodFreeLine", {
        defaultValue: "Прямая проведена свободно, по двум поставленным точкам.",
      })}`;
    }
    if (usesManualFit) return `${base} ${I18n.t("methodTwoPoints")}`;

    const r2 = theisPlot
      ? (theisRecovery ? recovery.r2 : dualRecovery.r2)
      : result.r2;
    return `${base} ${I18n.t("methodFitQuality", {
      r2: isFinite(r2) ? r2.toFixed(3) : "—",
    })}`;
  };

  /**
   * Собирает обработчики правки для журнала одной фазы
   *
   * Журналов на экране может быть два, и они отличаются только тем, в какое
   * состояние и с какой фазой пишутся строки.
   *
   * @param {string} journalPhase - период опробования, см. MEASUREMENT_PHASES
   * @returns {Object} обработчики таблицы
   */
  const journalHandlers = (journalPhase) => {
    const setJournalRows =
      journalPhase === MEASUREMENT_PHASES.RECOVERY ? setRecoveryRows : setRows;

    return {
      onChange: (id, field, value) =>
        setJournalRows((prev) =>
          prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
        ),
      onBlur: () => persist(rows, Q, recoveryRows),
      onAdd: async () => {
        if (!projectId) return;
        const created = await addMeasurement(projectId, {
          t: 0,
          s: 0,
          phase: journalPhase,
          wellId: activeWellId,
        });
        setJournalRows((prev) => [
          ...prev,
          { id: created.id, tText: "", sText: "" },
        ]);
      },
      onDelete: async (id) => {
        setJournalRows((prev) => prev.filter((row) => row.id !== id));
        await deleteMeasurement(id);
      },
    };
  };

  /**
   * Раскладывает по карте скважины, которых на ней ещё нет
   *
   * Опытная встаёт в центр, наблюдательные — вокруг неё по кругу на своих
   * расстояниях из таблицы. Так карта с первого открытия показывает уже
   * введённые числа, а не пустое поле, и перетаскивание начинается с
   * осмысленной картинки.
   *
   * Ставится только недостающее: у скважины, уже разложенной по карте,
   * координаты не трогаются.
   */
  useEffect(() => {
    if (!CLUSTER_MAP_ENABLED || !clusterWells || !wells.length) return;
    // Number.isFinite: глобальный isFinite приводит null к нулю, и скважина
    // без координат считалась бы уже расставленной — все маркеры ложились
    // в одну точку у нулевого меридиана
    const missing = wells.filter(
      (well) => !Number.isFinite(well.lat) || !Number.isFinite(well.lon),
    );
    if (!missing.length) return;

    const pumping = wells.find((well) => well.role === WELL_ROLES.PUMPING);
    const origin =
      pumping && Number.isFinite(pumping.lat) && Number.isFinite(pumping.lon)
        ? { lat: pumping.lat, lon: pumping.lon }
        : { lat: DEFAULT_CENTER.lat, lon: DEFAULT_CENTER.lon };

    const observers = wells.filter((well) => well.role !== WELL_ROLES.PUMPING);
    const placed = wells.map((well) => {
      if (Number.isFinite(well.lat) && Number.isFinite(well.lon)) return well;
      if (well.role === WELL_ROLES.PUMPING) return { ...well, ...origin };

      // Разводим по кругу: две скважины на одном расстоянии не должны
      // оказаться в одной точке
      const index = observers.indexOf(well);
      const bearing = observers.length ? (360 / observers.length) * index : 0;
      const spacing = well.distance > 0 ? well.distance : DEFAULT_SPACING;
      return { ...well, ...offsetBy(origin, spacing, bearing) };
    });

    setWells(placed);
    placed.forEach((well) => {
      if (missing.some((item) => item.id === well.id)) {
        setWellPosition(well.id, { lat: well.lat, lon: well.lon }).catch(
          () => {},
        );
      }
    });
  }, [clusterWells, wells]);

  /**
   * Переносит куст к текущему местоположению пользователя
   *
   * Опытная скважина встаёт туда, где стоит геолог, наблюдательные — вокруг
   * неё по своим расстояниям из таблицы. Сами расстояния при этом не
   * меняются: куст переносится целиком, а не пересобирается.
   */
  const placeAtMyLocation = async () => {
    setMapNotice("");
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setMapNotice(
          I18n.t("locationDenied", {
            defaultValue:
              "Нет доступа к геопозиции. Разрешите его в настройках или расставьте скважины по карте.",
          }),
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const origin = {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      };

      const observers = wells.filter(
        (well) => well.role !== WELL_ROLES.PUMPING,
      );
      const moved = wells.map((well) => {
        if (well.role === WELL_ROLES.PUMPING) return { ...well, ...origin };
        const index = observers.indexOf(well);
        const bearing = observers.length ? (360 / observers.length) * index : 0;
        const spacing = well.distance > 0 ? well.distance : DEFAULT_SPACING;
        return { ...well, ...offsetBy(origin, spacing, bearing) };
      });

      setWells(moved);
      setMapCenterOverride(origin);
      moved.forEach((well) => {
        setWellPosition(well.id, { lat: well.lat, lon: well.lon }).catch(
          () => {},
        );
      });
    } catch {
      setMapNotice(
        I18n.t("locationFailed", {
          defaultValue:
            "Не удалось определить местоположение. Под землёй и в здании сигнала может не быть — расставьте скважины по карте.",
        }),
      );
    } finally {
      setLocating(false);
    }
  };

  /**
   * Пересчитывает расстояния после того, как скважину подвинули по карте
   *
   * Расстояние считается от опытной скважины до каждой наблюдательной, и
   * сдвиг самой опытной меняет их все разом. Её собственная строка не
   * трогается: там лежит радиус r0, а не расстояние до себя.
   *
   * @param {string} id - какую скважину подвинули
   * @param {number} lat - новая широта
   * @param {number} lon - новая долгота
   */
  const handleWellMove = useCallback(
    (id, lat, lon) => {
      const moved = wells.map((well) =>
        well.id === id ? { ...well, lat, lon } : well,
      );
      setWellPosition(id, { lat, lon }).catch(() => {});

      const pumping = moved.find((well) => well.role === WELL_ROLES.PUMPING);
      if (!pumping) {
        setWells(moved);
        return;
      }

      const next = moved.map((well) => {
        if (well.role === WELL_ROLES.PUMPING) return well;
        const distance = roundBase(distanceBetween(pumping, well));
        if (!isFinite(distance) || distance === well.distance) return well;
        setWellDistance(well.id, distance).catch(() => {});
        return { ...well, distance };
      });
      setWells(next);

      // Поля таблицы показывают то же самое в выбранной размерности
      setDistanceTexts((texts) => {
        const updated = { ...texts };
        next.forEach((well) => {
          if (well.role === WELL_ROLES.PUMPING) return;
          const shown = fromBase(well.distance, QUANTITIES.DISTANCE);
          updated[well.id] = isFinite(shown)
            ? String(Number(shown.toPrecision(SHOWN_PRECISION)))
            : "";
        });
        return updated;
      });
    },
    [wells, fromBase],
  );

  /**
   * Заводит наблюдательную скважину и сразу открывает её журнал
   *
   * Опытная тут не создаётся: в опробовании она одна и заведена вместе с
   * проектом. Вторую отклонит и репозиторий — ограничение держится там,
   * потому что скважина может приехать и синхронизацией.
   */
  const handleAddWell = async () => {
    const trimmed = newWellName.trim();
    if (!trimmed) {
      setWellError(
        I18n.t("enterWellName", { defaultValue: "Введите название скважины" }),
      );
      return;
    }
    const created = await createWell(projectId, {
      name: trimmed,
      role: WELL_ROLES.OBSERVATION,
    });
    if (!created) return;

    setWells((prev) => [...prev, created]);
    setActiveWellId(created.id);
    setNewWellName("");
    setWellError("");
    setAddingWell(false);
  };

  /**
   * Сохраняет расстояние от скважины до опытной
   *
   * В базе оно лежит в метрах, в поле стоит выбранная размерность — перевод
   * тот же, что и у замеров.
   *
   * @param {string} wellId - идентификатор скважины
   */
  const handleDistanceBlur = async (wellId) => {
    const value = toBase(
      parseNumber(distanceTexts[wellId] ?? ""),
      QUANTITIES.DISTANCE,
    );
    const distance = isFinite(value) ? roundBase(value) : 0;
    await setWellDistance(wellId, distance);
    setWells((prev) =>
      prev.map((well) => (well.id === wellId ? { ...well, distance } : well)),
    );
  };

  /**
   * Сохраняет понижение на момент остановки насоса
   *
   * У куста оно лежит в строке скважины, у журналов с одной скважиной — в
   * самом проекте. Пустое поле значит «взять из журнала откачки»: в базу
   * уходит ноль, а число подставляет finalDrawdownAtStop.
   */
  const handleFinalDrawdownBlur = () => {
    if (!clusterWells || !activeWellId) {
      persist(rows, Q);
      return;
    }
    commitWellFinalDrawdown();
  };

  /**
   * Удаляет наблюдательную скважину вместе с её замерами
   */
  const confirmWellDelete = async () => {
    const well = pendingWellDelete;
    setPendingWellDelete(null);
    if (!well || !(await deleteWell(well.id))) return;

    const left = wells.filter((item) => item.id !== well.id);
    setWells(left);
    setJournals((prev) => {
      const next = { ...prev };
      delete next[well.id];
      return next;
    });
    if (activeWellId === well.id) {
      setActiveWellId(
        (left.find((item) => item.role === WELL_ROLES.OBSERVATION) ?? left[0])
          ?.id ?? null,
      );
    }
  };

  /**
   * Переключает фазу опыта, сбрасывает отметки и подставляет длительность
   *
   * Длительность берётся из последней строки журнала откачки: насос работал
   * до неё. В настольном АНСДИМАТ то же самое делает клавиша Ins в табл.
   * «Окончание». Требовать от геолога вводить это число второй раз руками
   * незачем — оно уже введено строкой выше.
   *
   * Понижение на остановке здесь больше не подставляется: оно выводится из
   * журнала той скважины, что открыта сейчас, см. finalDrawdownAtStop.
   * Подстановка срабатывала один раз, числом открытой в тот момент скважины,
   * и оставалась на месте при переходе к соседней — у куста это давало
   * остаточное понижение чужой скважины и горизонталь по нулю на графике.
   *
   * @param {string} next - выбранная фаза
   */
  const handlePhaseChange = (next) => {
    if (next === phase) return;
    setPhase(next);
    // Отметки и свободная прямая сбрасываются, как и при переходе к соседней
    // скважине: на полотне теперь другая кривая — у откачки понижение по
    // времени, у восстановления остаточное понижение по lg(t/t′), — и
    // прежние отметки указывали бы на чужие точки
    setSelectedPoints([]);
    setFreeAnchors(null);
    // Фаза задаёт и то, по какой кривой считаются T, a, C и S: выбрал
    // восстановление — числа идут по восстановлению, и другой кривой на
    // полотне нет
    if (next !== PHASES.RECOVERY || !dualJournals || !measurements.length)
      return;

    // Замеры лежат в базовых единицах, а поля показывают выбранные: без
    // перевода при настройке «часы» в поле длительности вставали минуты
    const show = (value, quantity) => {
      const converted = fromBase(value, quantity);
      return isFinite(converted)
        ? String(Number(converted.toPrecision(SHOWN_PRECISION)))
        : "";
    };

    const last = measurements[measurements.length - 1];
    if (isFinite(last.t) && last.t > 0) {
      setDurationText(show(last.t, QUANTITIES.TIME));
    }
  };

  if (loading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!project) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <Text style={[type.body, { color: theme.colors.textSecondary }]}>
          {I18n.t("projectNotFound")}
        </Text>
      </View>
    );
  }

  // Развёрнутая карта занимает экран целиком и лежит вне прокрутки: иначе
  // перетаскивание маркера доставалось бы списку.
  //
  // Право проверяется и здесь, а не только у кнопки разворота: подписка может
  // кончиться, пока карта уже раскрыта на весь экран
  if (mapFullscreen && mapAllowed) {
    return (
      <View
        style={[styles.mapFull, { backgroundColor: theme.colors.background }]}
      >
        <FieldMap
          points={mapPoints}
          connect={mapConnect}
          center={mapCenter}
          onMovePoint={handleWellMove}
          flush
        />
        {!!mapNotice && (
          <View
            style={[
              styles.mapNotice,
              {
                top: insets.top + spacing.md,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[type.caption, { color: theme.colors.text }]}>
              {mapNotice}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.mapLocate,
            { bottom: buttonsAboveMenu },
            elevation.brandButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: locating ? 0.6 : 1,
            },
          ]}
          onPress={placeAtMyLocation}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel={I18n.t("wellsAtMyLocation", {
            defaultValue: "Перенести куст к моему местоположению",
          })}
        >
          <MaterialIcons name="my-location" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.mapExpand,
            { bottom: buttonsAboveMenu },
            elevation.brandButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setMapFullscreen(false)}
          accessibilityRole="button"
          accessibilityState={{ expanded: true }}
          accessibilityLabel={I18n.t("mapCollapse", {
            defaultValue: "Свернуть карту",
          })}
        >
          <MaterialIcons name="fullscreen-exit" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={[styles.content, { maxWidth: column ?? "100%" }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Шапка проекта */}
        <View
          style={[
            styles.projectCard,
            elevation.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.projectIcon,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <MaterialCommunityIcons name="water-pump" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.projectText}>
            <Text
              style={[type.cardTitle, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {project.name}
            </Text>
            <Text
              style={[styles.projectMeta, { color: theme.colors.textSecondary }]}
            >
              {I18n.t(`ofr_${project.ofrType}`, {
                defaultValue: project.ofrType,
              })}
              {" · "}
              {I18n.t("measurementsCount", {
                count: measurements.length + recoveryMeasurements.length,
              })}
            </Text>
          </View>
        </View>

        {/* Скважины куста. Открытая скважина задаёт, чей журнал правится и по
            чьим точкам ведётся прямая; кривые остальных идут на том же графике */}
        {clusterWells && (
          <>
            <Text
              style={[
                type.eyebrow,
                styles.sectionLabel,
                { color: theme.colors.textSecondary, marginTop: 0 },
              ]}
            >
              {I18n.t("wellsSection", { defaultValue: "Скважины" })}
            </Text>

            <View style={styles.wellChips}>
              {wells.map((well) => {
                const active = well.id === activeWellId;
                // Правое поле ужимается только там, где есть урна: иначе чип
                // без неё выглядел бы съехавшим влево
                const deletable =
                  well.role === WELL_ROLES.OBSERVATION && observationCount > 1;
                return (
                  <TouchableOpacity
                    key={well.id}
                    onPress={() => handleWellChange(well.id)}
                    style={[
                      styles.wellChip,
                      deletable && styles.wellChipDeletable,
                      {
                        backgroundColor: active
                          ? theme.colors.primary
                          : theme.colors.surfaceSunken,
                        borderColor: active
                          ? theme.colors.primary
                          : theme.colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.wellChipName,
                        { color: active ? "#FFFFFF" : theme.colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {well.name}
                    </Text>

                    {/* Удаление живёт в самом чипе: искать кнопку под списком
                        значило бы гадать, к какой скважине она относится.
                        Опытную не удаляем — без неё куста нет, последнюю
                        наблюдательную тоже: следить будет не за чем */}
                    {deletable && (
                      <TouchableOpacity
                        onPress={() => setPendingWellDelete(well)}
                        style={styles.wellChipDelete}
                        accessibilityRole="button"
                        accessibilityLabel={`${I18n.t("delete", {
                          defaultValue: "Удалить",
                        })} ${well.name}`}
                      >
                        <MaterialIcons
                          name="delete-outline"
                          size={17}
                          color={
                            active ? "rgba(255,255,255,0.85)" : theme.colors.error
                          }
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={() => setAddingWell((prev) => !prev)}
                style={[styles.wellAddChip, { borderColor: theme.colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={I18n.t("addObservationWell", {
                  defaultValue: "Добавить наблюдательную",
                })}
              >
                <MaterialIcons
                  name={addingWell ? "close" : "add"}
                  size={18}
                  color={theme.colors.primaryAccent}
                />
              </TouchableOpacity>
            </View>

            {/* Что показывать на полотне. Отдельно от выбора открытой
                скважины: та задаёт, чей журнал правится и по чьим точкам идёт
                прямая, — снять её с графика нельзя. Остальные кривые нужны
                для сравнения, и на кусте из пяти скважин их приходится
                разгружать. Расчёт от видимости не зависит вовсе */}
            {wells.length > 1 && (
              <View style={styles.wellChips}>
                {wells
                  .filter((well) => well.id !== activeWellId)
                  .map((well) => {
                    const shown = !hiddenWells.has(well.id);
                    return (
                      <TouchableOpacity
                        key={well.id}
                        onPress={() => toggleWellVisible(well.id)}
                        style={[
                          styles.visibilityChip,
                          {
                            borderColor: shown
                              ? theme.colors.secondary
                              : theme.colors.border,
                            backgroundColor: shown
                              ? theme.colors.surface
                              : theme.colors.surfaceSunken,
                          },
                        ]}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: shown }}
                      >
                        <MaterialIcons
                          name={shown ? "visibility" : "visibility-off"}
                          size={15}
                          color={
                            shown
                              ? theme.colors.secondary
                              : theme.colors.textSecondary
                          }
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.visibilityChipName,
                            {
                              color: shown
                                ? theme.colors.text
                                : theme.colors.textSecondary,
                            },
                          ]}
                        >
                          {well.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}

            {addingWell && (
              <View style={styles.wellForm}>
                <TextInput
                  value={newWellName}
                  onChangeText={(value) => {
                    setNewWellName(value);
                    if (wellError) setWellError("");
                  }}
                  onSubmitEditing={handleAddWell}
                  returnKeyType="done"
                  placeholder={I18n.t("observationWellName", {
                    defaultValue: "Наблюдательная скважина",
                  })}
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[
                    styles.wellInput,
                    {
                      borderColor: wellError
                        ? theme.colors.error
                        : theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                />
                <TouchableOpacity
                  onPress={handleAddWell}
                  style={[
                    styles.wellAddButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.wellAddButtonText}>
                    {I18n.t("add", { defaultValue: "Добавить" })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!!wellError && (
              <Text
                style={[type.caption, styles.hint, { color: theme.colors.error }]}
              >
                {wellError}
              </Text>
            )}
          </>
        )}

        {/* Расстояния до опытной скважины. Подписей у таблицы нет намеренно:
            её читают по шапке — слева фирменный знак, справа имя опытной
            скважины, до которой считают. Строка «опытная — опытная» держит её
            собственный радиус, и он помечен «(r)» вместо отдельной колонки */}
        {clusterWells && pumpingWell && (
          <View
            style={[
              styles.table,
              elevation.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.distanceHead,
                { borderBottomColor: theme.colors.border },
              ]}
            >
              {/* Пустая ячейка на пересечении заголовков: заштрихована, потому
                  что вводить в неё нечего. Цвет — фоновый, чтобы угол читался
                  как вырез, а не как ещё одна кнопка */}
              <DiagonalHatch
                color={theme.colors.textSecondary}
                style={[
                  styles.distanceCell,
                  styles.distanceDivider,
                  {
                    backgroundColor: theme.colors.background,
                    borderRightColor: theme.colors.border,
                  },
                ]}
              />
              <View style={styles.distanceCell}>
                <Text
                  style={[styles.distanceHeadName, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {pumpingWell.name}
                </Text>
              </View>
            </View>

            {wells.map((well) => {
              const isPumping = well.role === WELL_ROLES.PUMPING;
              return (
                <View
                  key={well.id}
                  style={[
                    styles.distanceRow,
                    { borderBottomColor: theme.colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.distanceCell,
                      styles.distanceDivider,
                      { borderRightColor: theme.colors.border },
                    ]}
                  >
                    <Text
                      style={[styles.distanceWell, { color: theme.colors.text }]}
                      numberOfLines={1}
                    >
                      {well.name}
                    </Text>
                  </View>
                  <View style={[styles.distanceCell, styles.distanceValueCell]}>
                    <TextInput
                      value={distanceTexts[well.id] ?? ""}
                      onChangeText={(value) =>
                        setDistanceTexts((prev) => ({
                          ...prev,
                          [well.id]: value,
                        }))
                      }
                      onBlur={() => handleDistanceBlur(well.id)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={theme.colors.textSecondary}
                      style={[styles.distanceValue, { color: theme.colors.text }]}
                    />
                    <Text
                      style={[
                        styles.distanceUnit,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {isPumping
                        ? `${unitLabel(QUANTITIES.DISTANCE)} (r)`
                        : unitLabel(QUANTITIES.DISTANCE)}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Последняя строка самой таблицы, а не плашка под ней: обрезается
                её же скруглением и отделена той же линией, что и строки */}
            <TouchableOpacity
              style={[
                styles.distanceAdd,
                {
                  backgroundColor: theme.colors.primary,
                  borderTopColor: theme.colors.border,
                },
              ]}
              onPress={() => setAddingWell(true)}
              accessibilityRole="button"
            >
              <MaterialIcons name="add" size={17} color="#FFFFFF" />
              <Text style={styles.distanceAddText}>
                {I18n.t("addTableRow", { defaultValue: "Добавить строку" })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Карта куста под таблицей: то же расстояние, но руками. Скважину
            тащат по карте, расстояние считается по координатам и садится
            в таблицу — там его потом можно поправить и вручную */}
        {CLUSTER_MAP_ENABLED && clusterWells && mapPoints.length > 0 && !mapAllowed && (
          <PremiumLock
            style={styles.mapBlock}
            height={mapHeight}
            title={I18n.t("clusterMapLockTitle", {
              defaultValue: "Карта куста — в Premium",
            })}
            note={I18n.t("clusterMapLockNote", {
              defaultValue:
                "Без подписки расстояния до скважин вводятся в таблице выше.",
            })}
            onPress={() => navigation?.navigate?.("Subscription")}
          />
        )}

        {clusterWells && mapPoints.length > 0 && mapAllowed && (
          <View style={styles.mapBlock}>
            <FieldMap
              points={mapPoints}
              connect={mapConnect}
              center={mapCenter}
              onMovePoint={handleWellMove}
              height={mapHeight}
            />

            {!!mapNotice && (
              <View
                style={[
                  styles.mapNotice,
                  { top: spacing.md, backgroundColor: theme.colors.surface },
                ]}
              >
                <Text style={[type.caption, { color: theme.colors.text }]}>
                  {mapNotice}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.mapLocate,
                elevation.brandButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: locating ? 0.6 : 1,
                },
              ]}
              onPress={placeAtMyLocation}
              disabled={locating}
              accessibilityRole="button"
              accessibilityLabel={I18n.t("wellsAtMyLocation", {
                defaultValue: "Перенести куст к моему местоположению",
              })}
            >
              <MaterialIcons name="my-location" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mapExpand,
                elevation.brandButton,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setMapFullscreen(true)}
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              accessibilityLabel={I18n.t("mapExpand", {
                defaultValue: "Развернуть карту на весь экран",
              })}
            >
              <MaterialIcons name="fullscreen" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Фаза опыта */}
        <View style={[styles.modeRow, styles.phaseRow]}>
          {PHASE_OPTIONS.map((option) => {
            const active = option.key === phase;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => handlePhaseChange(option.key)}
                style={[
                  styles.phaseChip,
                  {
                    backgroundColor: active
                      ? theme.colors.primary
                      : theme.colors.surfaceSunken,
                    borderColor: active
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.phaseChipText,
                    { color: active ? "#FFFFFF" : theme.colors.textSecondary },
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
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Единица вынесена из подписи и стоит после числа: внутри подписи
              она ломала строку надвое на узких экранах, а рядом со значением
              ещё и читается по-человечески — «1000 м³/сут» */}
          <Text
            style={[type.body, styles.fieldLabel, { color: theme.colors.text }]}
          >
            {I18n.t("flowRateQ", { defaultValue: "Дебит Q" })}
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
          <Text style={[styles.fieldUnit, { color: theme.colors.textSecondary }]}>
            {unitLabel(QUANTITIES.FLOW)}
          </Text>
        </View>

        {/* Продолжительность откачки — точка отсчёта восстановления */}
        {isRecovery && (
          <>
            <View
              style={[
                styles.field,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  type.body,
                  styles.fieldLabel,
                  { color: theme.colors.text },
                ]}
              >
                {I18n.t("pumpingDuration", { defaultValue: "Откачка длилась" })}
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
              <Text
                style={[styles.fieldUnit, { color: theme.colors.textSecondary }]}
              >
                {unitLabel(QUANTITIES.TIME)}
              </Text>
            </View>

            {/* Понижение на момент остановки — второй ноль отсчёта: от него
                ведётся журнал восстановления. Табл. «Окончание» в настольной
                версии, там же она названа обязательной для этой обработки.

                У куста поле правит открытую скважину: понижение на остановке
                своё у каждой. Пустым его можно и оставить — тогда берётся
                последний замер журнала откачки, и он же стоит подсказкой */}
            {dualJournals && (
              <View
                style={[
                  styles.field,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    type.body,
                    styles.fieldLabel,
                    { color: theme.colors.text },
                  ]}
                >
                  {I18n.t("finalDrawdown", {
                    defaultValue: "Понижение на остановке",
                  })}
                </Text>
                <TextInput
                  value={finalDrawdownText}
                  onChangeText={setFinalDrawdownText}
                  onBlur={handleFinalDrawdownBlur}
                  keyboardType="decimal-pad"
                  placeholder={
                    finalDrawdown > 0
                      ? String(
                          Number(
                            fromBase(
                              finalDrawdown,
                              QUANTITIES.DRAWDOWN,
                            ).toPrecision(SHOWN_PRECISION),
                          ),
                        )
                      : "0"
                  }
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[styles.fieldInput, { color: theme.colors.secondary }]}
                />
                <Text
                  style={[
                    styles.fieldUnit,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {unitLabel(QUANTITIES.DRAWDOWN)}
                </Text>
              </View>
            )}

            {/* Откуда взялись числа в полях: подставлены, а не введены руками —
                иначе выглядит так, будто приложение помнит чужой ввод */}
          </>
        )}

        {/* Журнал откачки. У одиночной откачки он открыт в обеих фазах: на
            восстановлении понижение всё равно нужно — по нему строится прямая
            и считается водопроводимость */}
        <Text
          style={[
            type.eyebrow,
            styles.sectionLabel,
            { color: theme.colors.textSecondary },
          ]}
        >
          {withWellName(
            dualJournals
              ? I18n.t("journalPumping", {
                  defaultValue: "Журнал замеров: откачка",
                })
              : I18n.t("measurementsJournal", { defaultValue: "Журнал замеров" }),
          )}
        </Text>

        {/* Единственный журнал на восстановлении читается как замеры после
            остановки насоса, и время в нём отсчитывается от НАЧАЛА откачки:
            иначе t − длительность откачки выходит отрицательным и точка
            выпадает из расчёта. Пишем это прямо в шапке — догадаться
            из подписи «t, мин» невозможно */}
        <MeasurementJournal
          theme={theme}
          rows={rows}
          {...journalHandlers(MEASUREMENT_PHASES.PUMPING)}
          timeLabel={
            theisRecovery
              ? I18n.t("timeFromPumpStart", {
                  unit: unitLabel(QUANTITIES.TIME),
                  defaultValue: "t от начала откачки, мин",
                })
              : I18n.t("columnTime", { unit: unitLabel(QUANTITIES.TIME) })
          }
          valueLabel={I18n.t("columnDrawdown", {
            unit: unitLabel(QUANTITIES.DRAWDOWN),
          })}
          {/* Отметки стоят в той таблице, чей ряд лежит на полотне. У
              одиночной и кустовой откачки на восстановлении это второй
              журнал, и здесь отмечать нечего; у видов ОФР с одним журналом
              на полотно идут его же строки, и отметки остаются тут */
          ...(dualJournals && isRecovery
            ? {}
            : {
                selectable: fitMode === FIT_MODES.AUTO,
                selected: selectedPoints,
                pointIndexes: pointIndexByRow,
                onToggleSelect: handleToggleSelect,
              })}
        />

        {/* Журнал восстановления — второй таблицей под откачкой. Общей таблицы
            у них быть не может: время здесь идёт от остановки насоса, а ноль
            восстановления отвечает понижению на этот момент */}
        {dualJournals && isRecovery && (
          <>
            <Text
              style={[
                type.eyebrow,
                styles.sectionLabel,
                { color: theme.colors.textSecondary },
              ]}
            >
              {withWellName(
                I18n.t("journalRecovery", {
                  defaultValue: "Журнал замеров: восстановление",
                }),
              )}
            </Text>

            <MeasurementJournal
              theme={theme}
              rows={recoveryRows}
              {...journalHandlers(MEASUREMENT_PHASES.RECOVERY)}
              timeLabel={I18n.t("timeFromPumpStop", {
                unit: unitLabel(QUANTITIES.TIME),
                defaultValue: "t′ от остановки насоса, мин",
              })}
              valueLabel={I18n.t("columnRecovery", {
                unit: unitLabel(QUANTITIES.DRAWDOWN),
                defaultValue: "восстановление, м",
              })}
              /* Прямую по двум точкам ведут по той кривой, что на полотне.
                 На восстановлении это остаточное понижение, и отмечать точки
                 нужно здесь: отметки на журнале откачки показывали бы номера
                 строк чужого ряда */
              selectable={fitMode === FIT_MODES.AUTO}
              selected={selectedPoints}
              pointIndexes={pointIndexByRow}
              onToggleSelect={handleToggleSelect}
            />

            {/* Закончен ли опыт. Уровень считают восстановленным, когда
                остаточное понижение упало ниже 5 % от понижения на остановке —
                по одному последнему замеру этого не видно */}
          </>
        )}

        {/* График */}
        <Text
          style={[
            type.eyebrow,
            styles.sectionLabel,
            { color: theme.colors.textSecondary },
          ]}
        >
          {chartView === VIEWS.DIAGNOSTIC
            ? I18n.t("diagnosticChart", { defaultValue: "Диагностика режима" })
            : theisPlot
              ? I18n.t("recoveryChart", { defaultValue: "График восстановления" })
              : I18n.t("drawdownChart", { defaultValue: "График понижения" })}
        </Text>

        {/* Выбор вида. На прямой Тейса диагностика не строится: там по оси
            времени отложено отношение t/t′, и производная по нему значила бы
            не то, что читают по её форме */}
        {!theisPlot && (
          <Segmented
            style={styles.viewSwitch}
            options={[
              {
                key: VIEWS.FIT,
                label: I18n.t("viewFit", { defaultValue: "Подбор прямой" }),
              },
              {
                key: VIEWS.DIAGNOSTIC,
                label: I18n.t("viewDiagnostic", { defaultValue: "Диагностика" }),
              },
            ]}
            value={chartView}
            onChange={setChartView}
          />
        )}

        {/* Объяснение пустого ряда. Заглушка внутри полотна показывается
            только когда на нём нет вообще ничего, а у куста рядом лежат
            кривые соседних скважин — и открытая скважина оставалась без
            кривой молча */}
        {!!chartEmpty && (
          <Text
            style={[
              type.caption,
              styles.hint,
              { color: theme.colors.textSecondary },
            ]}
          >
            {chartEmpty.title}. {chartEmpty.hint}
          </Text>
        )}

        {theisPlot && (
          <Text
            style={[
              type.caption,
              styles.hint,
              { color: theme.colors.textSecondary },
            ]}
          >
            {I18n.t("recoveryAxisHint", {
              defaultValue:
                "По оси X — отношение t/t′: время от начала откачки к времени от её остановки",
            })}
          </Text>
        )}

        {/* На прямой Тейса ось X всегда логарифмическая: другие режимы
            сделали бы прямую Тейса кривой, поэтому выбор режима не показываем.
            В диагностике оси заданы самим методом и не переключаются.

            Виды с расстоянием в абсциссе показываются только у кустовой
            откачки и только на откачке: у остальных видов ОФР расстояний нет
            вовсе, а на восстановлении остаточное понижение от r не зависит */}
        <View style={styles.modeRow}>
          {(theisPlot || chartView === VIEWS.DIAGNOSTIC
            ? []
            : GRAPH_MODE_OPTIONS.filter(
                (option) => distanceModes || !option.clusterOnly,
              )
          ).map((option) => {
            const active = option.key === effectiveMode;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setGraphMode(option.key)}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: active
                      ? theme.colors.primary
                      : theme.colors.surfaceSunken,
                    borderColor: active
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.modeChipText,
                    { color: active ? "#FFFFFF" : theme.colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Момент, на который снят срез по кусту. Показываются только те
            моменты, что есть хотя бы у двух скважин: по одной точке площадной
            график не построить, а интерполировать понижение между отсчётами
            значило бы ставить на график то, чего в журнале нет */}
        {trackingKind === TRACKING_KINDS.AREA &&
          chartView === VIEWS.FIT &&
          commonMoments.length > 0 && (
            <>
              <Text
                style={[
                  type.eyebrow,
                  styles.momentLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {I18n.t("momentLabel", { defaultValue: "Момент времени" })}
              </Text>
              <View style={styles.momentRow}>
                {commonMoments.map((time) => {
                  const active = time === moment;
                  const shown = fromBase(time, QUANTITIES.TIME);
                  return (
                    <TouchableOpacity
                      key={time}
                      onPress={() => setPickedMoment(time)}
                      style={[
                        styles.momentChip,
                        {
                          backgroundColor: active
                            ? theme.colors.primary
                            : theme.colors.surfaceSunken,
                          borderColor: active
                            ? theme.colors.primary
                            : theme.colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          {
                            color: active
                              ? "#FFFFFF"
                              : theme.colors.textSecondary,
                          },
                        ]}
                      >
                        {`${Number(shown.toPrecision(SHOWN_PRECISION))} ${unitLabel(
                          QUANTITIES.TIME,
                        )}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

        {/* Место графика в списке. На время разворота содержимое отсюда
            убирается, а высота остаётся прежней: развёрнутый график лежит
            накладкой поверх списка, и список под ней не должен шевелиться */}
        <View
          onLayout={handleChartSlotLayout}
          style={chartFullscreen ? { height: chartSlotHeight } : null}
        >
          {!chartFullscreen &&
            (chartView === VIEWS.DIAGNOSTIC && !theisPlot ? (
              <>
                <DiagnosticPlot
                  result={diagnosis}
                  width={contentWidth}
                  viewportStore={viewportStore}
                  scrollRef={scrollRef}
                />
                <RegimeVerdict result={diagnosis} Q={Q} comparisonT={activeT} />
              </>
            ) : (
              <DrawdownChart
                series={chartSeries}
                mode={chartMode}
                width={contentWidth}
                scrollRef={scrollRef}
                fitMode={fitMode}
                onFitModeChange={handleFitModeChange}
                selected={selectedPoints}
                onToggleSelect={handleToggleSelect}
                anchors={chartAnchors}
                onAnchorsChange={handleAnchorsChange}
                fullscreen={false}
                onToggleFullscreen={() => setChartFullscreen(true)}
                caption={chartCaption}
                viewKey={chartViewKey}
                xAxisTitle={chartAxisTitle}
                emptyTitle={chartEmpty?.title}
                emptyHint={chartEmpty?.hint}
                timeUnit={unitLabel(QUANTITIES.TIME)}
                drawdownUnit={unitLabel(QUANTITIES.DRAWDOWN)}
                viewportStore={viewportStore}
                activeSeriesName={activeWell?.name}
                onSelectSeries={seriesPickable ? handleSelectSeries : undefined}
              />
            ))}
        </View>

        {/* По чьей кривой идут числа. У куста расстояние своё у каждой
            скважины, а в пьезопроводность и водоотдачу оно входит явно:
            по двум кривым на одном полотне получаются два разных ответа */}
        {clusterWells && trackingKind === TRACKING_KINDS.TIME && !!activeWell && (
          <Text
            style={[
              type.caption,
              styles.missing,
              { color: theme.colors.textSecondary },
            ]}
          >
            {I18n.t("fitBySeries", {
              well: activeWell.name,
              defaultValue: `Прямая по кривой «${activeWell.name}»`,
            })}
            {activeWell.distance > 0
              ? ` · r = ${Number(
                  fromBase(activeWell.distance, QUANTITIES.DISTANCE).toPrecision(
                    SHOWN_PRECISION,
                  ),
                )} ${unitLabel(QUANTITIES.DISTANCE)}`
              : ""}
          </Text>
        )}

        {/* Результат */}
        <View style={styles.resultRow}>
          <ValueCard
            accent
            label={I18n.t("transmissivityLabel", {
              unit: unitLabel(QUANTITIES.TRANSMISSIVITY),
            })}
            value={
              isFinite(activeT)
                ? fromBase(activeT, QUANTITIES.TRANSMISSIVITY).toFixed(2)
                : "—"
            }
          />
          <ValueCard
            label={I18n.t("diffusivityLabel", {
              unit: unitLabel(QUANTITIES.DIFFUSIVITY),
            })}
            value={formatDiffusivity(fromBase(activeA, QUANTITIES.DIFFUSIVITY))}
          />
        </View>

        <View style={styles.resultRow}>
          <ValueCard
            label={I18n.t("storativity", { defaultValue: "Водоотдача S" })}
            value={formatStorativity(activeS)}
          />
          <ValueCard
            label={`${I18n.t("slope", { defaultValue: "Наклон прямой C" })}, ${unitLabel(
              QUANTITIES.DRAWDOWN,
            )}`}
            value={
              isFinite(activeSlope)
                ? fromBase(activeSlope, QUANTITIES.DRAWDOWN).toFixed(4)
                : "—"
            }
          />
        </View>

        {/* Почему в карточке прочерк. Раньше пустое поле не объясняло ничего:
            чаще всего не заполнен дебит, а понять это было неоткуда */}
        {!!missingA && (
          <Text
            style={[
              type.caption,
              styles.missing,
              { color: theme.colors.textSecondary },
            ]}
          >
            {missingA}
          </Text>
        )}

        {!!missingT && (
          <Text
            style={[
              type.caption,
              styles.missing,
              { color: theme.colors.primaryAccent },
            ]}
          >
            {missingT}
          </Text>
        )}

        <Text style={[styles.methodNote, { color: theme.colors.textSecondary }]}>
          {renderMethodNote()}
        </Text>

        {/* Замеры есть, а точек для графика нет: значит время меньше
            длительности откачки. Общая заглушка «внесите замеры» тут врёт */}
        {theisRecovery &&
          measurements.length >= 2 &&
          basePoints.length === 0 && (
            <Text
              style={[
                type.caption,
                styles.missing,
                { color: theme.colors.primaryAccent },
              ]}
            >
              {!(pumpingDuration > 0)
                ? I18n.t("recoveryNoDuration", {
                    defaultValue:
                      "Укажите, сколько длилась откачка — без этого восстановление не построить.",
                  })
                : I18n.t("recoveryTimeTooSmall", {
                    defaultValue:
                      "Время замеров меньше длительности откачки. В журнале восстановления время отсчитывается от начала откачки, а не от остановки насоса.",
                  })}
            </Text>
          )}

        {theisRecovery && recovery.warnings.includes("needMoreMeasurements") && (
          <Text
            style={[type.caption, styles.hint, { color: theme.colors.error }]}
          >
            {I18n.t("recoveryNeedDuration", {
              defaultValue:
                "Укажите продолжительность откачки и внесите замеры после остановки насоса — иначе восстановление не обработать.",
            })}
          </Text>
        )}
        {theisRecovery &&
          recovery.warnings.includes("recoveryInterceptNotZero") && (
            <Text
              style={[
                type.caption,
                styles.hint,
                { color: theme.colors.textSecondary },
              ]}
            >
              {I18n.t("recoveryInterceptNote", {
                defaultValue:
                  "Прямая не проходит через начало координат: возможно влияние границ пласта или непостоянный дебит на откачке.",
              })}
            </Text>
          )}

        <View style={{ height: 120 }} />

        <ConfirmDialog
          visible={!!pendingWellDelete}
          title={I18n.t("deleteWellTitle", { defaultValue: "Удалить скважину?" })}
          message={
            pendingWellDelete
              ? `«${pendingWellDelete.name}» — ${I18n.t("deleteWellMessage", {
                  defaultValue:
                    "Замеры этой скважины будут удалены вместе с ней.",
                })}`
              : ""
          }
          confirmLabel={I18n.t("delete", { defaultValue: "Удалить" })}
          destructive
          onConfirm={confirmWellDelete}
          onCancel={() => setPendingWellDelete(null)}
        />
      </ScrollView>

      {/* Развёрнутый график живёт в Modal, а не вместо экрана. Список при
          этом остаётся смонтированным и хранит свою прокрутку: возврат в
          обычный вид показывает то самое место, откуда график разворачивали.
          Обычной накладкой это не сделать — экран лежит в карточке
          навигатора, а та на вебе выше окна и вдобавок сдвинута transform
          ради переходов: и absolute, и fixed внутри неё уезжают вместе с
          прокруткой. Modal же рендерится порталом в корень и всегда ровно
          по окну.

          Свой GestureHandlerRootView обязателен: содержимое Modal лежит вне
          корневого, и без него жесты полотна не дошли бы до графика */}
      <Modal
        visible={chartFullscreen}
        animationType="none"
        onRequestClose={() => setChartFullscreen(false)}
        supportedOrientations={["portrait", "landscape"]}
        statusBarTranslucent
      >
        <GestureHandlerRootView
          style={[
            styles.fullscreen,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <DrawdownChart
            series={chartSeries}
            mode={chartMode}
            width={width}
            height={height}
            fitMode={fitMode}
            onFitModeChange={handleFitModeChange}
            selected={selectedPoints}
            onToggleSelect={handleToggleSelect}
            anchors={chartAnchors}
            onAnchorsChange={handleAnchorsChange}
            caption={chartCaption}
            viewKey={chartViewKey}
            xAxisTitle={chartAxisTitle}
            emptyTitle={chartEmpty?.title}
            emptyHint={chartEmpty?.hint}
            timeUnit={unitLabel(QUANTITIES.TIME)}
            drawdownUnit={unitLabel(QUANTITIES.DRAWDOWN)}
            viewportStore={viewportStore}
            activeSeriesName={activeWell?.name}
            onSelectSeries={seriesPickable ? handleSelectSeries : undefined}
            fullscreen
            onToggleFullscreen={() => setChartFullscreen(false)}
          />
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Экран целиком: список и накладка развёрнутого графика лежат в нём
  screen: {
    flex: 1,
  },
  // Развёрнутый график занимает окно Modal целиком, без полей: управление
  // лежит поверх полотна, а не отнимает у него высоту
  fullscreen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontWeight: "600",
    textAlign: "right",
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
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headCell: {
    ...type.label,
    flex: 1,
    // Нулевой минимум — и здесь, и у полей: на вебе <input> держит свою
    // «естественную» ширину, и колонка значений съезжала вправо от шапки
    minWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Вертикальная граница между колонками: без неё в тёмной теме таблица
  // читалась как список строк, а не как ячейки
  cellDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingRight: spacing.md,
    marginRight: spacing.md,
  },
  cellInput: {
    ...type.numeric,
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    paddingVertical: spacing.md,
  },
  pickCell: {
    width: 30,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  deleteCell: {
    width: 32,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: 6,
  },
  addRowText: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
  },
  // Чипов бывает пять — три оси времени и два прослеживания с расстоянием.
  // В одну строку на телефоне они не влезают, поэтому строка переносится.
  // Минимальная ширина взята по самой длинной подписи «lg t/r²»: будь она
  // меньше, формула переносилась бы внутри чипа и читалась как две
  modeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  // Ширина по подписи, а не поровну на строку: чипы разной длины, и при
  // переносе одинокий пятый растянулся бы на всю вторую строку
  modeChip: {
    minWidth: 56,
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Момент времени площадного графика: чипов столько, сколько общих отсчётов
  // у скважин куста, и они тоже переносятся
  momentLabel: {
    marginBottom: spacing.sm,
  },
  momentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  momentChip: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeChipText: {
    ...type.numeric,
    fontSize: 14,
    fontFamily: fontFamily.monoSemibold,
  },
  // Карта куста: накладки позиционируются относительно этого блока, а он
  // точно повторяет границы карты
  mapBlock: {
    position: "relative",
    // Карта отделена от таблицы: без отступа она примыкала к кнопке
    // «Добавить строку» и читалась как её продолжение
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  mapFull: {
    flex: 1,
  },
  mapExpand: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  // Геопозиция стоит левее разворота, в один ряд с ним
  mapLocate: {
    position: "absolute",
    right: spacing.md + 44 + spacing.sm,
    bottom: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  mapNotice: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    zIndex: 2,
  },
  mapHint: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  mapHintText: {
    fontSize: 12,
    fontFamily: fontFamily.semibold,
  },

  // Таблица расстояний. Шапка: слева заштрихованная пустая ячейка,
  // справа имя опытной скважины — до неё и считают
  distanceHead: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth,
    // Высота задаётся здесь: штриховка тянется по ячейке, а не наоборот
    height: 52,
  },
  /**
   * Ячейка таблицы расстояний
   *
   * Поля живут на содержимом, а не на самой ячейке: в Yoga отступы
   * прибавляются к `flexBasis: 0` сверх доли, и ячейка с paddingHorizontal
   * выходила на 24 px шире соседки — вертикальная линия в шапке не совпадала
   * с линией в строках.
   */
  distanceCell: {
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  distanceDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  distanceHeadName: {
    // Имя скважины — слово, а не число: гарнитурой интерфейса, как и
    // подписи в чипах, а не моноширинной
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  // Своя строка вместо общей: колонки разделены вертикальной линией, и
  // поля уходят внутрь ячеек, иначе граница не дотягивалась бы до краёв
  distanceRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  distanceValueCell: {
    flexDirection: "row",
    alignItems: "center",
  },
  distanceWell: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  distanceValue: {
    ...type.numeric,
    flex: 1,
    fontSize: 15,
    fontFamily: fontFamily.monoSemibold,
    textAlign: "right",
    paddingLeft: spacing.lg,
    paddingVertical: spacing.md,
  },
  distanceUnit: {
    ...type.numeric,
    fontSize: 12,
    marginLeft: 8,
    marginRight: spacing.lg,
    minWidth: 40,
  },
  // Строка таблицы, а не плашка под ней: скругление даёт сама карточка
  distanceAdd: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  distanceAddText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: fontFamily.semibold,
  },

  // Скважины куста: чипы переносятся по строкам — наблюдательных может быть
  // сколько угодно
  wellChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  wellChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 220,
  },
  // Урна сама несёт своё поле, поэтому справа чип ужимается
  visibilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  visibilityChipName: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    maxWidth: 96,
  },
  wellChipDeletable: {
    paddingRight: spacing.xs,
  },
  wellChipDelete: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  wellChipName: {
    fontFamily: fontFamily.bold,
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  // Высота набирается теми же полями, что у чипов: фиксированная не
  // совпадала с ними и «плюс» стоял выше строки
  wellAddChip: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  wellForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  wellInput: {
    ...type.body,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  wellAddButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  wellAddButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: fontFamily.bold,
  },
  // Своя строка у фазы: у таблицы расстояний сверху не было отступа вовсе,
  // а перед дебитом он складывался вдвое
  phaseRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  // Фаза опыта подписана словами, поэтому чипу нужны поля пошире
  phaseChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Фаза опыта — слово, а не обозначение: гарнитурой интерфейса. Моноширинная
  // «Откачка» рядом с моноширинными «lg t» читалась как ещё одна ось
  phaseChipText: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  hint: {
    marginBottom: spacing.md,
  },
  // Пояснения к журналу и к подставленному значению: висят под своим блоком,
  // а не над следующим, поэтому отступ сверху меньше, чем снизу
  journalNote: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  fieldNote: {
    marginTop: spacing.xs,
    marginLeft: spacing.lg,
  },
  // Переключатель вида графика: сегменты в общей подложке, как в калькуляторе
  viewSwitch: {
    marginBottom: spacing.md,
  },
  // Карточек четыре: T и a в первой строке, S и наклон во второй. В одну
  // строку они на телефоне не влезают, а перенос внутри строки развалил бы
  // пары «результат — то, из чего он получен»
  resultRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  resultCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.card,
  },
  resultLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.8)",
  },
  resultValue: {
    ...numericAt(26),
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: spacing.xs,
  },
  missing: {
    marginTop: spacing.md,
    lineHeight: 18,
    fontFamily: fontFamily.semibold,
  },
  methodNote: {
    ...type.caption,
    marginTop: spacing.md,
  },
});
