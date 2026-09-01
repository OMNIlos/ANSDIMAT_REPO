/**
 * Обработка откачек — создание журнала и список проектов
 *
 * Сверху форма нового журнала: тип ОФР и название. Ниже — ранее созданные
 * проекты. Каждая строка ведёт либо в журнал замеров, либо сразу в обработку,
 * поэтому вернуться к расчёту можно в один тап.
 *
 * Источник данных — локальная SQLite: приложение работает в поле без связи.
 */

import React, { useCallback, useState } from "react";
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
import { spacing, radius, type, elevation } from "../../theme";

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

export default function ProjectsScreen({ navigation }) {
  const theme = useTheme();
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

  const load = useCallback(async () => {
    setProjects(await listProjects());
  }, []);

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

  const selectedLabel = ofrType
    ? I18n.t(OFR_OPTIONS.find((o) => o.key === ofrType).labelKey)
    : I18n.t("selectOfrType", { defaultValue: "Выберите тип ОФР" });

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
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

      {/* Ранее созданные */}
      <View style={styles.listHeader}>
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
              { color: theme.colors.textSecondary },
            ]}
          >
            {I18n.t("noProjects")}
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
              onPress={() =>
                navigation.navigate(routeFor(project.ofrType), {
                  projectId: project.id,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={project.name}
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
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {formatDate(project.createdAt)}
                </Text>
              </View>

              {/* Что внутри журнала: тип опыта, сколько замеров и получен ли
                  результат. Без этого список — просто набор названий, и
                  заполненный журнал не отличить от заведённого и забытого.

                  У нагнетания и налива замеров в этом смысле нет: данные
                  лежат ступенями и полями формы. Писать им «замеров нет»
                  значило бы называть заполненный журнал пустым, поэтому там
                  сразу стоит посчитанный коэффициент фильтрации */}
              <Text
                style={[
                  styles.projectMeta,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {I18n.t(`ofr_${project.ofrType}`, {
                  defaultValue: project.ofrType,
                })}
                {hasDrawdownJournal(project.ofrType)
                  ? ` · ${
                      project.measurementsCount > 0
                        ? I18n.t("measurementsCount", {
                            count: project.measurementsCount,
                            defaultValue: `${project.measurementsCount} замеров`,
                          })
                        : I18n.t("noMeasurements", {
                            defaultValue: "замеров нет",
                          })
                    }`
                  : ""}
                {isFinite(project.results?.T) && project.results.T !== null
                  ? ` · T = ${fromBase(project.results.T, QUANTITIES.TRANSMISSIVITY).toFixed(1)} ${unitLabel(QUANTITIES.TRANSMISSIVITY)}`
                  : ""}
                {conductivityOf(project) !== null
                  ? ` · k = ${formatValue(fromBase(conductivityOf(project), QUANTITIES.CONDUCTIVITY))} ${unitLabel(QUANTITIES.CONDUCTIVITY)}`
                  : ""}
              </Text>
            </TouchableOpacity>

            <View style={styles.projectActions}>
              <View style={styles.actionSpacer} />

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleStar(project)}
                accessibilityRole="button"
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
    fontSize: 15,
    fontWeight: "700",
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
    fontSize: 13,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: {
    marginTop: spacing.md,
  },
  projectRow: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  projectTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  projectName: {
    flex: 1,
    marginRight: spacing.md,
  },
  projectDate: {
    ...type.numeric,
    fontSize: 12,
  },
  projectMeta: {
    ...type.numeric,
    fontSize: 12,
    marginTop: 4,
  },
  projectActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
  },
  actionButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSpacer: {
    flex: 1,
  },
});
