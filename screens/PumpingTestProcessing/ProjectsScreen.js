/**
 * Обработка откачек — создание журнала и список проектов
 *
 * Сверху форма нового журнала: тип ОФР и название. Ниже — ранее созданные
 * проекты. Каждая строка ведёт либо в журнал замеров, либо сразу в обработку,
 * поэтому вернуться к расчёту можно в один тап.
 *
 * Источник данных — локальная SQLite: приложение работает в поле без связи.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Share,
} from "react-native";
import { useTheme, Menu } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import DrawdownCurve from "../../components/DrawdownCurve";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import AppearIn from "../../components/ui/AppearIn";
import {
  listProjects,
  createProject,
  deleteProject,
  toggleStarred,
  getProject,
} from "../../db/projects";
import { OFR_TYPES } from "../../db/schema";
import { useUnits } from "../../UnitsContext";
import { QUANTITIES } from "../../calc/units";
import { shareProjectFile } from "../../share/exportProject";
import {
  hasDrawdownJournal,
  hasFlowRate,
  ofrSummaryLines,
} from "../../share/ofrTextSummary";
import { processLugeon } from "../../calc/lugeon";
import { processVadoseFill } from "../../calc/vadoseFill";
import { formatValue } from "../calculator/shared";
import { useImport } from "../../share/ImportContext";
import { spacing, radius, type, elevation, fontFamily } from "../../theme";
import { useContentMaxWidth } from "../../lib/appPrefs";

export const OFR_OPTIONS = [
  { key: OFR_TYPES.SINGLE, labelKey: "ofr_single" },
  { key: OFR_TYPES.CLUSTER, labelKey: "ofr_cluster" },
  { key: OFR_TYPES.SLUG, labelKey: "ofr_slug" },
  { key: OFR_TYPES.LUGEON, labelKey: "ofr_lugeon" },
  { key: OFR_TYPES.VADOSE, labelKey: "ofr_vadose" },
];

/**
 * Экран обработки по виду ОФР
 *
 * Откачки обрабатываются прямой Купера — Джейкоба на общем экране, у
 * остальных видов схема своя: у экспресс-опробования график lg(s⁰/s) — t,
 * у поинтервального нагнетания таблица ступеней, у налива в шурф расчёт по
 * одной формуле без журнала. Сводить их в один экран значило бы держать три
 * несвязанных интерфейса под общими кнопками.
 *
 * Виды прежних версий сюда не попадают и открываются на общем экране — там
 * они и обрабатывались, см. LEGACY_OFR_TYPES.
 */
const SCREEN_BY_OFR = {
  [OFR_TYPES.SLUG]: "SlugTest",
  [OFR_TYPES.LUGEON]: "LugeonTest",
  [OFR_TYPES.VADOSE]: "VadoseFill",
};

/**
 * Куда вести журнал этого вида ОФР
 *
 * @param {string} ofrType - вид ОФР, см. OFR_TYPES
 * @returns {string} имя маршрута
 */
export function routeFor(ofrType) {
  return SCREEN_BY_OFR[ofrType] ?? "DataProcessing";
}

/** Неразрывный пробел: число не отрывается от своей размерности */
const NBSP = "\u00A0";

/** Соединитель слов: запрещает перенос у косой черты в «м/сут» */
const WORD_JOINER = "\u2060";

/**
 * Коэффициент фильтрации журнала для строки списка
 *
 * У нагнетания и налива результат не хранится: он выводится из исходных
 * данных и не может с ними разойтись. Считать его здесь дёшево — в списке
 * лежат готовые `params`, и лишнего обращения к базе не нужно.
 *
 * Экспресс-опробование сюда не входит: его k держится наклоном прямой, а
 * замеры в список не приходят.
 *
 * @param {Object} project - строка списка журналов
 * @returns {number|null} k, м/сут; null, если у вида его нет или он не считается
 */
function conductivityOf(project) {
  const params = project?.params;
  if (!params) return null;
  let k = NaN;
  if (project.ofrType === OFR_TYPES.VADOSE) {
    k = processVadoseFill(params).k;
  } else if (project.ofrType === OFR_TYPES.LUGEON) {
    k = processLugeon({
      stages: params.stages,
      interval: params.interval,
      lw: params.lw,
      rw: params.rw,
      density: params.density,
    }).meanK;
  }
  return isFinite(k) ? k : null;
}

/**
 * Форматирует дату создания проекта
 *
 * @param {number} timestamp - метка времени
 * @returns {string} дата в формате ДД.ММ.ГГГГ
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export default function ProjectsScreen({ navigation, route }) {
  const theme = useTheme();
  // Колонка 720 px — если включена «Адаптация под планшет»
  const column = useContentMaxWidth(720);
  // Таблица замеров уходит наружу в тех же размерностях, в каких геолог её
  // видел. К файлу проекта это не относится: там всё в базовых единицах,
  // иначе получатель с другими настройками прочёл бы чужие числа как свои
  const { unitLabel, fromBase } = useUnits();
  const { openFromPicker } = useImport();

  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [ofrType, setOfrType] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  // Журнал, для которого открыто меню «поделиться». Идентификатор, а не
  // флаг: меню своё у каждой карточки
  const [shareMenuFor, setShareMenuFor] = useState(null);
  // Проект, для которого запрошено удаление
  const [pendingDelete, setPendingDelete] = useState(null);
  const [nameError, setNameError] = useState("");
  // Названия пары скважин, с которой заводится куст. Пустые поля не ошибка:
  // подставятся имена по соглашению АНСДИМАТ — «w» опытной, «p»
  // наблюдательной
  const [pumpingWell, setPumpingWell] = useState("");
  const [observationWell, setObservationWell] = useState("");
  const [creating, setCreating] = useState(false);

  // Переход с плитки «Архив откачек» на главной: экран тот же, но
  // прокручивается сразу к списку ранее созданных журналов
  const scrollRef = useRef(null);
  // Где начинается список — заголовок «Ранее созданные», px от начала прокрутки
  const archiveY = useRef(null);
  // Прокрутку к архиву ещё предстоит сделать
  const archivePending = useRef(false);
  // Список прочитан из базы: до этого высота содержимого меньше настоящей,
  // и прокрутка упёрлась бы в край, не донеся заголовок до верха
  const listLoaded = useRef(false);

  /**
   * Подводит список журналов к верху экрана, если об этом просили
   *
   * Зовётся из всех мест, где может появиться недостающее: замер заголовка,
   * смена высоты содержимого после загрузки списка, приход параметра.
   * Отработав на загруженном списке, просьба снимается — иначе каждое
   * удаление журнала снова уводило бы экран к архиву.
   */
  const scrollToArchive = useCallback(() => {
    if (!archivePending.current || archiveY.current === null) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, archiveY.current - spacing.md),
      animated: true,
    });
    if (listLoaded.current) archivePending.current = false;
  }, []);

  const focus = route?.params?.focus;
  useEffect(() => {
    if (focus !== "archive") return;
    archivePending.current = true;
    // Параметр гасится сразу: возврат на экран из журнала не должен снова
    // перематывать к архиву
    navigation.setParams({ focus: undefined });
    scrollToArchive();
  }, [focus, navigation, scrollToArchive]);

  const load = useCallback(async () => {
    setProjects(await listProjects());
    listLoaded.current = true;
    // Если высота содержимого не поменялась (журналов нет), onContentSizeChange
    // не придёт — прокрутка доводится следующим кадром
    requestAnimationFrame(scrollToArchive);
  }, [scrollToArchive]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      // Ошибка показывается под самим полем, а не системным диалогом:
      // на вебе Alert.alert из react-native ничего не показывает вообще,
      // и нажатие «Создать» выглядело как будто кнопка сломана
      setNameError(
        I18n.t("enterProjectName", {
          defaultValue: "Введите название журнала",
        }),
      );
      return;
    }
    setNameError("");
    setCreating(true);
    try {
      const created = await createProject({
        name: trimmed,
        ofrType: ofrType ?? OFR_TYPES.SINGLE,
        pumpingWellName: pumpingWell.trim(),
        observationWellName: observationWell.trim(),
      });
      setName("");
      setOfrType(null);
      setPumpingWell("");
      setObservationWell("");
      await load();
      navigation.navigate(routeFor(created.ofrType), { projectId: created.id });
    } catch {
      setNameError(
        I18n.t("createFailed", {
          defaultValue: "Не удалось создать журнал. Попробуйте ещё раз.",
        }),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (project) => {
    setPendingDelete(project);
  };

  /**
   * Удаляет журнал вместе с замерами и обновляет список
   */
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteProject(pendingDelete.id);
    setPendingDelete(null);
    await load();
  };

  /**
   * Отправляет журнал файлом `.ansdimat`
   *
   * Основной способ обмена: получатель открывает файл двойным нажатием и
   * получает рабочий журнал со скважинами, обеими фазами замеров и
   * результатами расчёта — всё то, что в таблицу замеров не помещается.
   */
  const handleShareFile = async (project) => {
    setShareMenuFor(null);
    try {
      await shareProjectFile(project.id);
    } catch {
      // Пользователь закрыл системное окно или файл не записался. Второе
      // почти невозможно: журнал только что прочитан из той же базы
    }
  };

  /**
   * Отправляет журнал текстом
   *
   * Раньше уходил JSON.stringify всего объекта. Получатель открывал письмо
   * и видел дамп со служебными полями — прочитать замеры в нём невозможно,
   * а вставить в отчёт тем более. Теперь это таблица, которую можно
   * скопировать хоть в Excel.
   *
   * Остаётся рядом с файлом намеренно: вставить замеры в отчёт — отдельная
   * задача, и файл проекта её не решает.
   */
  const handleShareText = async (project) => {
    setShareMenuFor(null);
    const full = await getProject(project.id);
    if (!full) return;

    // Дебит и таблица «время — понижение» есть не у всех видов ОФР:
    // нагнетание задаётся ступенями давления, налив в шурф — расходом и
    // размерами выработки. Пустая таблица с шапкой «t, мин» была бы для них
    // не выгрузкой, а бланком, см. share/ofrTextSummary.js
    const journal = hasDrawdownJournal(full.ofrType);

    const header = [
      full.name,
      `${I18n.t(`ofr_${full.ofrType}`, { defaultValue: full.ofrType })} · ${formatDate(full.createdAt)}`,
      hasFlowRate(full.ofrType)
        ? `Q = ${fromBase(full.Q, QUANTITIES.FLOW)} ${unitLabel(QUANTITIES.FLOW)}`
        : null,
      isFinite(full.results?.T) && full.results.T !== null
        ? `T = ${fromBase(full.results.T, QUANTITIES.TRANSMISSIVITY).toFixed(2)} ${unitLabel(QUANTITIES.TRANSMISSIVITY)}`
        : null,
      ...ofrSummaryLines(full, { fromBase, unitLabel }),
      ...(journal
        ? [
            "",
            `t, ${unitLabel(QUANTITIES.TIME)}\ts, ${unitLabel(QUANTITIES.DRAWDOWN)}`,
          ]
        : []),
    ].filter((line) => line !== null && line !== undefined);

    const show = (value, quantity) =>
      Number(fromBase(value, quantity).toPrecision(10));
    const rows = journal
      ? full.measurements.map(
          (m) => `${show(m.t, QUANTITIES.TIME)}\t${show(m.s, QUANTITIES.DRAWDOWN)}`,
        )
      : [];

    // Восстановление уходит отдельным блоком со своей шапкой: время в нём
    // отсчитывается от остановки насоса, и подклеенное к откачке одной
    // таблицей оно читалось бы как продолжение того же ряда
    const recovery = full.recoveryMeasurements ?? [];
    const recoveryBlock = recovery.length
      ? [
          "",
          I18n.t("journalRecovery", {
            defaultValue: "Журнал замеров: восстановление",
          }),
          `t′, ${unitLabel(QUANTITIES.TIME)}\t${I18n.t("columnRecovery", {
            unit: unitLabel(QUANTITIES.DRAWDOWN),
          })}`,
          ...recovery.map(
            (m) =>
              `${show(m.t, QUANTITIES.TIME)}\t${show(m.s, QUANTITIES.DRAWDOWN)}`,
          ),
        ]
      : [];

    try {
      await Share.share({
        title: full.name,
        message: [...header, ...rows, ...recoveryBlock].join("\n"),
      });
    } catch {
      // Пользователь закрыл диалог — это не ошибка
    }
  };

  const handleStar = async (project) => {
    await toggleStarred(project.id);
    await load();
  };

  /**
   * Открывает журнал на экране его вида ОФР
   *
   * @param {Object} project - журнал из списка
   */
  const openProject = (project) =>
    navigation.navigate(routeFor(project.ofrType), { projectId: project.id });

  /**
   * Что внутри журнала — части строки под названием
   *
   * Слова идут гарнитурой интерфейса, числа с размерностью — моноширинной.
   * Внутри «k = 0.042 м/сут» строка не рвётся: пробелы неразрывные, а у
   * косой черты стоят соединители слов — иначе браузер переносил
   * размерность надвое, «м/» на одной строке и «сут» на другой.
   *
   * @param {Object} project - журнал из списка
   * @returns {Array<{text: string, numeric?: boolean}>} части строки
   */
  const projectMeta = (project) => {
    const glue = (text) =>
      text.replace(/ /g, NBSP).replace(/\//g, `${WORD_JOINER}/${WORD_JOINER}`);
    const parts = [
      { text: I18n.t(`ofr_${project.ofrType}`, { defaultValue: project.ofrType }) },
    ];
    if (hasDrawdownJournal(project.ofrType)) {
      parts.push({
        text:
          project.measurementsCount > 0
            ? I18n.t("measurementsCount", {
                count: project.measurementsCount,
                defaultValue: `${project.measurementsCount} замеров`,
              })
            : I18n.t("noMeasurements", { defaultValue: "замеров нет" }),
      });
    }
    if (isFinite(project.results?.T) && project.results.T !== null) {
      const T = fromBase(project.results.T, QUANTITIES.TRANSMISSIVITY).toFixed(1);
      parts.push({
        text: glue(`T = ${T} ${unitLabel(QUANTITIES.TRANSMISSIVITY)}`),
        numeric: true,
      });
    }
    const k = conductivityOf(project);
    if (k !== null) {
      parts.push({
        text: glue(
          `k = ${formatValue(fromBase(k, QUANTITIES.CONDUCTIVITY))} ${unitLabel(QUANTITIES.CONDUCTIVITY)}`
        ),
        numeric: true,
      });
    }
    return parts;
  };

  const selectedLabel = ofrType
    ? I18n.t(OFR_OPTIONS.find((o) => o.key === ofrType).labelKey)
    : I18n.t("selectOfrType", { defaultValue: "Выберите тип ОФР" });

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, { maxWidth: column ?? "100%" }]}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={scrollToArchive}
    >
      {/* Форма нового журнала */}
      <Text style={[type.eyebrow, { color: theme.colors.textSecondary }]}>
        {I18n.t("newJournal", { defaultValue: "Новый журнал" })}
      </Text>
      <Text
        style={[type.title, styles.formTitle, { color: theme.colors.text }]}
      >
        {I18n.t("fillAndProcess", {
          defaultValue: "Заполнить и обработать ОФР",
        })}
      </Text>

      <View
        style={[
          styles.formCard,
          elevation.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={[styles.select, { borderColor: theme.colors.border }]}
              onPress={() => setMenuVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={selectedLabel}
            >
              <Text
                style={[
                  type.body,
                  {
                    color: ofrType
                      ? theme.colors.text
                      : theme.colors.textSecondary,
                  },
                ]}
              >
                {selectedLabel}
              </Text>
              <MaterialIcons
                name="expand-more"
                size={22}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          }
        >
          {OFR_OPTIONS.map((option) => (
            <Menu.Item
              key={option.key}
              title={I18n.t(option.labelKey)}
              onPress={() => {
                setOfrType(option.key);
                setMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        {/* Кустовая откачка заводится сразу с парой скважин: качать неоткуда
            и следить не за чем, если ни одной нет. Наблюдательные добавляются
            и потом, опытная в опробовании ровно одна */}
        {ofrType === OFR_TYPES.CLUSTER && (
          <>
            <TextInput
              value={pumpingWell}
              onChangeText={setPumpingWell}
              placeholder={I18n.t("pumpingWellName", {
                defaultValue: "Опытная скважина",
              })}
              placeholderTextColor={theme.colors.textSecondary}
              style={[
                styles.input,
                type.body,
                { borderColor: theme.colors.border, color: theme.colors.text },
              ]}
            />
            <TextInput
              value={observationWell}
              onChangeText={setObservationWell}
              placeholder={I18n.t("observationWellName", {
                defaultValue: "Наблюдательная скважина",
              })}
              placeholderTextColor={theme.colors.textSecondary}
              style={[
                styles.input,
                type.body,
                { borderColor: theme.colors.border, color: theme.colors.text },
              ]}
            />
          </>
        )}

        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (nameError) setNameError("");
          }}
          onSubmitEditing={handleCreate}
          returnKeyType="done"
          placeholder={I18n.t("projectNamePlaceholder")}
          placeholderTextColor={theme.colors.textSecondary}
          style={[
            styles.input,
            type.body,
            {
              borderColor: nameError ? theme.colors.error : theme.colors.border,
              color: theme.colors.text,
            },
          ]}
        />

        {!!nameError && (
          <Text style={[type.caption, { color: theme.colors.error }]}>
            {nameError}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.createButton,
            elevation.brandButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: creating ? 0.6 : 1,
            },
          ]}
          onPress={handleCreate}
          disabled={creating}
          accessibilityRole="button"
          accessibilityState={{ disabled: creating }}
        >
          <Text style={styles.createButtonText}>
            {I18n.t("create", { defaultValue: "Создать" })}
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Ранее созданные — сюда ведёт плитка «Архив откачек» с главной */}
      <View
        style={styles.listHeader}
        onLayout={(event) => {
          archiveY.current = event.nativeEvent.layout.y;
          scrollToArchive();
        }}
      >
        <Text style={[type.eyebrow, { color: theme.colors.textSecondary }]}>
          {I18n.t("previouslyCreated", { defaultValue: "Ранее созданные" })} ·{" "}
          {projects.length}
        </Text>

        {/* Явный импорт — основной путь на Android: системный поставщик
            документов прячет имя файла, и объявленный в манифесте фильтр
            по расширению до таких ссылок не достаёт */}
        <TouchableOpacity
          style={[styles.importButton, { borderColor: theme.colors.border }]}
          onPress={openFromPicker}
          accessibilityRole="button"
        >
          <MaterialIcons
            name="file-download"
            size={16}
            color={theme.colors.textSecondary}
          />
          <Text
            style={[styles.importButtonText, { color: theme.colors.textSecondary }]}
          >
            {I18n.t("importFromFile", { defaultValue: "Импорт" })}
          </Text>
        </TouchableOpacity>
      </View>

      {projects.length === 0 ? (
        <View
          style={[
            styles.empty,
            {
              backgroundColor: theme.colors.surfaceSunken,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <DrawdownCurve
            width={120}
            height={44}
            color={theme.colors.textSecondary}
            opacity={0.5}
            strokeWidth={1.5}
          />
          <Text
            style={[
              type.body,
              styles.emptyText,
              { color: theme.colors.text },
            ]}
          >
            {I18n.t("noProjects")}
          </Text>
          {/* Пустой список — приглашение к действию, а не констатация: куда
              нажать, чтобы журнал появился */}
          <Text
            style={[
              type.caption,
              styles.emptyHint,
              { color: theme.colors.textSecondary },
            ]}
          >
            {I18n.t("noProjectsHint")}
          </Text>
        </View>
      ) : (
        projects.map((project, index) => (
          <AppearIn
            key={project.id}
            index={index}
            style={[
              styles.projectRow,
              elevation.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Нажимается вся карточка. Раньше открыть журнал можно было
                только двумя иконками внизу, которые вели в одно и то же
                место — палец же по привычке бьёт в название */}
            <TouchableOpacity
              onPress={() => openProject(project)}
              accessibilityRole="button"
              accessibilityLabel={project.name}
              activeOpacity={0.7}
            >
              <View style={styles.projectTop}>
                <Text
                  style={[
                    type.cardTitle,
                    styles.projectName,
                    { color: theme.colors.secondary },
                  ]}
                  numberOfLines={1}
                >
                  {project.name}
                </Text>
                <Text
                  style={[
                    styles.projectDate,
                    { color: theme.colors.faint },
                  ]}
                >
                  {formatDate(project.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Что внутри журнала — тип опыта, сколько замеров и получен ли
                результат — стоит в одной строке с кнопками. Под кнопками
                раньше оставалась пустая полоса во всю ширину карточки, и
                список из пяти журналов не помещался на экран.

                У нагнетания и налива замеров в этом смысле нет: данные
                лежат ступенями и полями формы. Писать им «замеров нет»
                значило бы называть заполненный журнал пустым, поэтому там
                сразу стоит посчитанный коэффициент фильтрации */}
            <View style={styles.projectFoot}>
              <TouchableOpacity
                style={styles.projectMetaTap}
                onPress={() => openProject(project)}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.projectMeta,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {projectMeta(project).map((part, partIndex) => (
                    <React.Fragment key={partIndex}>
                      {partIndex > 0 ? " · " : ""}
                      <Text
                        style={part.numeric ? styles.projectMetaNumber : null}
                      >
                        {part.text}
                      </Text>
                    </React.Fragment>
                  ))}
                </Text>
              </TouchableOpacity>

              <View style={styles.projectActions}>

              {/* Подпись обязательна: кнопка — один значок, и без неё
                  экранный диктор читал её как «кнопка» без названия */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleStar(project)}
                accessibilityRole="button"
                accessibilityLabel={I18n.t(
                  project.starred ? "unfavoriteProject" : "favoriteProject",
                )}
                accessibilityState={{ selected: project.starred }}
              >
                <MaterialIcons
                  name={project.starred ? "star" : "star-outline"}
                  size={18}
                  color={
                    project.starred
                      ? theme.colors.gold
                      : theme.colors.textSecondary
                  }
                />
              </TouchableOpacity>

              {/* Способов поделиться два, и они не взаимозаменяемы: файл
                  переносит журнал целиком, текст — таблицу замеров для
                  отчёта. Выбор отдан меню, чтобы иконка не решала за
                  геолога, что именно ему сейчас нужно */}
              <Menu
                visible={shareMenuFor === project.id}
                onDismiss={() => setShareMenuFor(null)}
                anchor={
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShareMenuFor(project.id)}
                    accessibilityRole="button"
                    accessibilityLabel={I18n.t("share", {
                      defaultValue: "Поделиться",
                    })}
                  >
                    <MaterialIcons
                      name="ios-share"
                      size={18}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                }
              >
                <Menu.Item
                  onPress={() => handleShareFile(project)}
                  leadingIcon="file-export-outline"
                  title={I18n.t("shareAsFile", {
                    defaultValue: "Файл проекта (.ansdimat)",
                  })}
                />
                <Menu.Item
                  onPress={() => handleShareText(project)}
                  leadingIcon="table"
                  title={I18n.t("shareAsText", {
                    defaultValue: "Таблица замеров (текст)",
                  })}
                />
              </Menu>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDelete(project)}
                accessibilityRole="button"
                accessibilityLabel={I18n.t("delete")}
              >
                <MaterialIcons
                  name="delete-outline"
                  size={18}
                  color={theme.colors.error}
                />
              </TouchableOpacity>
              </View>
            </View>
          </AppearIn>
        ))
      )}

      <View style={{ height: 120 }} />

      <ConfirmDialog
        visible={!!pendingDelete}
        title={I18n.t("deleteJournal", { defaultValue: "Удалить журнал?" })}
        message={
          pendingDelete
            ? `«${pendingDelete.name}» — журнал и все его замеры будут удалены безвозвратно.`
            : ""
        }
        confirmLabel={I18n.t("delete", { defaultValue: "Удалить" })}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  formTitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  formCard: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  createButton: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  listHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  importButtonText: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: {
    marginTop: spacing.md,
    fontFamily: fontFamily.semibold,
  },
  emptyHint: {
    marginTop: spacing.xs,
    maxWidth: 300,
    textAlign: "center",
  },
  projectRow: {
    paddingTop: 14,
    paddingBottom: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 11,
  },
  projectTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  projectName: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.md,
  },
  projectDate: {
    ...type.numeric,
    fontSize: 11.5,
    lineHeight: 16,
  },
  // Строка под названием: слева что внутри журнала, справа кнопки. Кнопки
  // прижаты к правому краю карточки, а строка забирает всё остальное место
  projectFoot: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: spacing.sm,
  },
  projectMetaTap: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
  },
  projectMeta: {
    ...type.caption,
    fontSize: 12.5,
    lineHeight: 17,
  },
  projectMetaNumber: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 12,
  },
  projectActions: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: -spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
