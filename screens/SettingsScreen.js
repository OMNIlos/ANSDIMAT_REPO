/**
 * Настройки (settings)
 *
 * Воссоздаёт экран из дизайн-прототипа:
 * - «Оформление»: сегменты темы (Светлая/Тёмная/Системная) + язык RU/EN
 * - «Подписка»: бордовый Premium-баннер — скрыт, пока премиум выключен
 * - «Данные и расчёты»: тумблеры (планшет, автокоординаты, моноширинные цифры)
 * - «О приложении»: карточка с логотипом и версией
 *
 * Тумблеры хранятся в SQLite (repository db/settings), тема и язык — в контекстах.
 */

import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { ThemeContext } from "../ThemeContext";
import { LanguageContext } from "../LanguageContext";
import { useAuth } from "../AuthContext";
import { useEntitlements } from "../billing/EntitlementsContext";
import { PREMIUM_ENABLED } from "../billing/config";
import I18n from "../Localization";
import Segmented from "../components/ui/Segmented";
import Toggle from "../components/ui/Toggle";
import { getSettings, setSetting } from "../db/settings";
import { useUnits } from "../UnitsContext";
import { UNITS, QUANTITIES } from "../calc/units";
import { fontFamily, brandHeader } from "../theme";

export default function SettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const { themeMode, setMode } = useContext(ThemeContext);
  const { locale, setLanguage } = useContext(LanguageContext);
  const { user } = useAuth();
  const { entitlements } = useEntitlements();
  const { width } = useWindowDimensions();
  const contentMaxWidth = width >= 700 ? 620 : undefined;

  const [flags, setFlags] = useState({
    tablet: true,
    autoLocation: true,
    tabularNums: true,
  });
  const { units, setUnit } = useUnits();

  useEffect(() => {
    getSettings()
      .then((s) =>
        setFlags({
          tablet: s.tablet,
          autoLocation: s.autoLocation,
          tabularNums: s.tabularNums,
        }),
      )
      .catch(() => {});
  }, []);

  const toggleFlag = (key) => {
    const next = !flags[key];
    setFlags((prev) => ({ ...prev, [key]: next }));
    setSetting(key, next).catch(() => {});
  };

  const themeOptions = [
    { key: "light", label: I18n.t("themeLight", { defaultValue: "Светлая" }) },
    { key: "dark", label: I18n.t("themeDark", { defaultValue: "Тёмная" }) },
    {
      key: "system",
      label: I18n.t("themeSystem", { defaultValue: "Системная" }),
    },
  ];

  const toggleRows = [
    {
      key: "tablet",
      icon: "tablet-mac",
      label: I18n.t("settingTablet", { defaultValue: "Адаптация под планшет" }),
    },
    {
      key: "autoLocation",
      icon: "my-location",
      label: I18n.t("settingAutoLocation", {
        defaultValue: "Автоопределение координат",
      }),
    },
    {
      key: "tabularNums",
      icon: "pin",
      label: I18n.t("settingTabularNums", {
        defaultValue: "Моноширинные цифры",
      }),
    },
  ];

  const Eyebrow = ({ children, style }) => (
    <Text style={[styles.eyebrow, { color: colors.textSecondary }, style]}>
      {children}
    </Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={brandHeader} barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View
          style={[
            styles.content,
            contentMaxWidth && { maxWidth: contentMaxWidth },
          ]}
        >
          {/* Оформление */}
          <Eyebrow style={{ marginTop: 0 }}>
            {I18n.t("appearance", { defaultValue: "Оформление" })}
          </Eyebrow>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.rowLabel,
                { color: colors.text, marginBottom: 11 },
              ]}
            >
              {I18n.t("theme", { defaultValue: "Тема" })}
            </Text>
            <Segmented
              options={themeOptions}
              value={themeMode}
              onChange={setMode}
            />

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <View style={styles.langRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                {I18n.t("appLanguage", { defaultValue: "Язык интерфейса" })}
              </Text>
              <View style={styles.langChips}>
                {["ru", "en"].map((lg) => {
                  const active = lg === locale;
                  return (
                    <TouchableOpacity
                      key={lg}
                      onPress={() => setLanguage(lg)}
                      style={[
                        styles.langChip,
                        {
                          backgroundColor: active
                            ? colors.primary
                            : colors.surfaceSunken,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.langChipText,
                          { color: active ? "#FFFFFF" : colors.textSecondary },
                        ]}
                      >
                        {lg.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Аккаунт */}
          <Eyebrow>
            {I18n.t("accountSection", { defaultValue: "Аккаунт" })}
          </Eyebrow>
          <TouchableOpacity
            style={[
              styles.card,
              styles.accountCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => navigation.navigate(user ? "Account" : "Auth")}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View
              style={[
                styles.accountAvatar,
                {
                  backgroundColor: user
                    ? colors.secondary
                    : colors.surfaceSunken,
                },
              ]}
            >
              <MaterialIcons
                name={user ? "person" : "login"}
                size={22}
                color={user ? "#FFFFFF" : colors.textSecondary}
              />
            </View>
            <View style={styles.accountText}>
              <Text
                style={[styles.rowLabel, { color: colors.text }]}
                numberOfLines={1}
              >
                {user
                  ? user.email
                  : I18n.t("signInToSync", { defaultValue: "Войти в аккаунт" })}
              </Text>
              <Text
                style={[styles.accountHint, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {user
                  ? I18n.t("accountManage", {
                      defaultValue: "Синхронизация, пароль, удаление",
                    })
                  : I18n.t("syncAcrossDevices", {
                      defaultValue: "Синхронизация между устройствами",
                    })}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={20}
              color={colors.faint}
            />
          </TouchableOpacity>

          {/* Подписка. Скрыта вместе со всем премиумом: PREMIUM_ENABLED
              выключен, платить не за что — баннер вёл бы на пустой экран */}
          {PREMIUM_ENABLED && (
            <>
              <Eyebrow>
                {I18n.t("subscription", { defaultValue: "Подписка" })}
              </Eyebrow>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigation.navigate("Subscription")}
              >
                <LinearGradient
                  colors={["#8A0A3D", "#4A001F"]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={styles.premiumCard}
                >
                  <MaterialIcons
                    name="workspace-premium"
                    size={30}
                    color="#E0A83C"
                  />
                  <View style={styles.premiumText}>
                    <Text style={styles.premiumTitle}>
                      {entitlements.premium
                        ? I18n.t("planPremium", { defaultValue: "Премиум-доступ" })
                        : I18n.t("basicVersion", {
                            defaultValue: "Базовая версия",
                          })}
                    </Text>
                    <Text style={styles.premiumSub}>
                      {entitlements.premium
                        ? I18n.t("premiumActive", {
                            defaultValue:
                              "Синхронизация и расширенные расчёты открыты",
                          })
                        : I18n.t("premiumPitch", {
                            defaultValue:
                              "Расширьте до Premium: приток, барраж, утечки",
                          })}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={22}
                    color="rgba(255,255,255,0.8)"
                  />
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* Данные и расчёты */}
          <Eyebrow>
            {I18n.t("dataAndCalc", { defaultValue: "Данные и расчёты" })}
          </Eyebrow>
          <View
            style={[
              styles.card,
              styles.cardFlush,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {toggleRows.map((row, i) => (
              <View
                key={row.key}
                style={[
                  styles.toggleRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <View style={styles.toggleLeft}>
                  <MaterialIcons
                    name={row.icon}
                    size={22}
                    color={colors.primaryAccent}
                  />
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    {row.label}
                  </Text>
                </View>
                <Toggle
                  value={flags[row.key]}
                  onValueChange={() => toggleFlag(row.key)}
                  accessibilityLabel={row.label}
                />
              </View>
            ))}
          </View>

          {/* Размерности. Выбор действует на ввод и на показ результата:
              считает приложение всегда в базовых единицах, поэтому уже
              введённые замеры от смены размерности не меняются.

              Варианты разложены чипами, а не спрятаны в выпадающий список:
              paper-овское Menu рисует себя в портал по координатам якоря, и
              внутри прокрученных настроек список уезжал наверх, утаскивая за
              собой прокрутку. Здесь же выбирать не из чего измерять — и все
              единицы видны сразу, их от двух до пяти */}
          <Eyebrow>
            {I18n.t("unitsSection", { defaultValue: "Размерности" })}
          </Eyebrow>
          <View
            style={[
              styles.card,
              styles.cardFlush,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {Object.values(QUANTITIES).map((quantity, i) => (
              <View
                key={quantity}
                style={[
                  styles.unitRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  {I18n.t(UNITS[quantity].labelKey)}
                </Text>
                <View style={styles.unitChips}>
                  {UNITS[quantity].options.map((option) => {
                    const active = option.key === units[quantity];
                    return (
                      <TouchableOpacity
                        key={option.key}
                        onPress={() => setUnit(quantity, option.key)}
                        style={[
                          styles.unitChip,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : colors.surfaceSunken,
                            borderColor: active
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${I18n.t(UNITS[quantity].labelKey)}: ${I18n.t(option.labelKey)}`}
                      >
                        <Text
                          style={[
                            styles.unitChipText,
                            {
                              color: active ? "#FFFFFF" : colors.textSecondary,
                            },
                          ]}
                        >
                          {I18n.t(option.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* О приложении */}
          <Eyebrow>
            {I18n.t("aboutApp", { defaultValue: "О приложении" })}
          </Eyebrow>
          <TouchableOpacity
            style={[
              styles.card,
              styles.aboutCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => navigation.navigate("About")}
            activeOpacity={0.85}
          >
            <Image
              source={require("../assets/logo-mark.png")}
              style={styles.aboutLogo}
              resizeMode="contain"
            />
            <View style={styles.aboutText}>
              <Text style={[styles.aboutTitle, { color: colors.text }]}>
                {I18n.t("homeTitle", { defaultValue: "АНСДИМАТ" })}
              </Text>
              <Text style={[styles.aboutSub, { color: colors.textSecondary }]}>
                {I18n.t("appSubtitle", {
                  defaultValue: "полевой калькулятор гидрогеолога",
                })}
              </Text>
            </View>
            <Text style={[styles.version, { color: colors.faint }]}>
              v1.0.0
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 128,
    alignItems: "center",
  },
  content: { width: "100%" },

  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4,
  },

  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowColor: "#14070E",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  cardFlush: { padding: 0, overflow: "hidden" },

  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  accountText: { flex: 1 },
  accountHint: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    marginTop: 1,
  },

  rowLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    fontWeight: "700",
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },

  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  langChips: { flexDirection: "row", gap: 6 },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  langChipText: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 12,
    fontWeight: "600",
  },

  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#4A001F",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  premiumText: { flex: 1 },
  premiumTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  premiumSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  toggleLeft: { flexDirection: "row", alignItems: "center", gap: 13, flex: 1 },
  toggleLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 14.5,
    fontWeight: "600",
  },

  // Подпись величины сверху, единицы под ней: пять чипов с длинными
  // подписями («гал/сут на фут²») в одну строку с названием не помещаются
  unitRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  // Перенос по строкам, а не горизонтальная прокрутка: настройки листаются
  // вертикально, и вложенный горизонтальный список перехватывал бы жест
  unitChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unitChipText: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 12.5,
    fontWeight: "600",
  },
  unitsHint: {
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
    marginHorizontal: 4,
  },

  aboutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  aboutLogo: { width: 42, height: 42 },
  aboutText: { flex: 1 },
  aboutTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  aboutSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    marginTop: 1,
  },
  version: {
    fontFamily: fontFamily.mono,
    fontSize: 11.5,
  },
});
