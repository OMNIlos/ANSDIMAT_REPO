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
import { spacing, radius, type, elevation } from "../../theme";

const OFR_OPTIONS = [
  { key: OFR_TYPES.SINGLE, labelKey: "ofr_single" },
  { key: OFR_TYPES.CLUSTER, labelKey: "ofr_cluster" },
  { key: OFR_TYPES.FILL, labelKey: "ofr_fill" },
  { key: OFR_TYPES.RECOVERY, labelKey: "ofr_recovery" },
];

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
  // Журнал уходит наружу в тех же размерностях, в каких геолог его видел
  const { unitLabel, fromBase } = useUnits();

  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [ofrType, setOfrType] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
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
      navigation.navigate("DataProcessing", { projectId: created.id });
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
   * Отправляет журнал текстом
   *
   * Раньше уходил JSON.stringify всего объекта. Получатель открывал письмо
   * и видел дамп со служебными полями — прочитать замеры в нём невозможно,
   * а вставить в отчёт тем более. Теперь это таблица, которую можно
   * скопировать хоть в Excel.
   */
  const handleShare = async (project) => {
    const full = await getProject(project.id);
    if (!full) return;

    const header = [
      full.name,
      `${I18n.t(`ofr_${full.ofrType}`, { defaultValue: full.ofrType })} · ${formatDate(full.createdAt)}`,
      `Q = ${fromBase(full.Q, QUANTITIES.FLOW)} ${unitLabel(QUANTITIES.FLOW)}`,
      isFinite(full.results?.T) && full.results.T !== null
        ? `T = ${fromBase(full.results.T, QUANTITIES.TRANSMISSIVITY).toFixed(2)} ${unitLabel(QUANTITIES.TRANSMISSIVITY)}`
        : null,
      "",
      `t, ${unitLabel(QUANTITIES.TIME)}\ts, ${unitLabel(QUANTITIES.DRAWDOWN)}`,
    ].filter(Boolean);

    const show = (value, quantity) =>
      Number(fromBase(value, quantity).toPrecision(10));
    const rows = full.measurements.map(
      (m) => `${show(m.t, QUANTITIES.TIME)}\t${show(m.s, QUANTITIES.DRAWDOWN)}`,
    );

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
                navigation.navigate("DataProcessing", { projectId: project.id })
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

              {/* Что внутри журнала: тип опыта, сколько замеров и получена ли
                  водопроводимость. Без этого список — просто набор названий,
                  и заполненный журнал не отличить от заведённого и забытого */}
              <Text
                style={[
                  styles.projectMeta,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {I18n.t(`ofr_${project.ofrType}`, {
                  defaultValue: project.ofrType,
                })}
                {" · "}
                {project.measurementsCount > 0
                  ? I18n.t("measurementsCount", {
                      count: project.measurementsCount,
                      defaultValue: `${project.measurementsCount} замеров`,
                    })
                  : I18n.t("noMeasurements", { defaultValue: "замеров нет" })}
                {isFinite(project.results?.T) && project.results.T !== null
                  ? ` · T = ${fromBase(project.results.T, QUANTITIES.TRANSMISSIVITY).toFixed(1)} ${unitLabel(QUANTITIES.TRANSMISSIVITY)}`
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

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleShare(project)}
                accessibilityRole="button"
              >
                <MaterialIcons
                  name="ios-share"
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

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
