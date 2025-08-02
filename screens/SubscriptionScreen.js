import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  BackHandler,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from "../Localization";
import { LanguageContext } from "../LanguageContext";
import { SubscriptionManager } from "../utils/SubscriptionManager";
import { useTheme } from "react-native-paper";

export default function SubscriptionScreen({ navigation }) {
  const theme = useTheme();
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");
  const [subscriptionType, setSubscriptionType] = useState(null);
  const [expiryDate, setExpiryDate] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { locale } = useContext(LanguageContext);

  // Нижнее меню
  const bottomMenuItems = [
    {
      key: 'menu',
      label: 'Меню',
      icon: <MaterialIcons name="menu" size={28} color="#fff" />,
      onPress: () => navigation.openDrawer(),
    },
    {
      key: 'settings',
      label: 'Настройки',
      icon: <MaterialIcons name="settings" size={28} color="#fff" />,
      onPress: () => navigation.navigate('Settings'),
    },
    {
      key: 'help',
      label: 'Справка',
      icon: <MaterialIcons name="help-outline" size={28} color="#fff" />,
      onPress: () => navigation.navigate('About'),
    },
    {
      key: 'exit',
      label: 'Выход',
      icon: <MaterialCommunityIcons name="exit-to-app" size={28} color="#fff" />,
      onPress: () => {
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
        } else {
          Alert.alert(
            'Выход из приложения',
            'Для выхода из приложения на iOS используйте системное меню (свайп вверх и закройте приложение вручную).'
          );
        }
      },
    },
  ];

  useFocusEffect(
    React.useCallback(() => {
      loadSubscriptionStatus();
    }, [])
  );

  async function loadSubscriptionStatus() {
    try {
      const status = await SubscriptionManager.getSubscriptionStatus();
      setSubscriptionStatus(status.isActive ? "active" : "inactive");
      setSubscriptionType(status.type);
      setExpiryDate(status.expiryDate);
    } catch (error) {
      console.error("Error loading subscription status:", error);
    }
  }

  async function simulatePurchase(subscriptionType) {
    setIsLoading(true);

    // Симуляция процесса покупки
    setTimeout(async () => {
      try {
        const now = new Date();
        const expiryDate = new Date(now);

        if (subscriptionType === "monthly") {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else if (subscriptionType === "yearly") {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }

        await SubscriptionManager.setSubscriptionStatus(
          "active",
          subscriptionType,
          expiryDate
        );

        setSubscriptionStatus("active");
        setSubscriptionType(subscriptionType);
        setExpiryDate(expiryDate);

        Alert.alert(I18n.t("success"), I18n.t("purchaseSuccessful"), [
          { text: I18n.t("ok") },
        ]);
      } catch (error) {
        Alert.alert(I18n.t("error"), I18n.t("purchaseFailed"), [
          { text: I18n.t("ok") },
        ]);
      } finally {
        setIsLoading(false);
      }
    }, 2000);
  }

  async function cancelSubscription() {
    Alert.alert(
      I18n.t("cancelSubscription"),
              I18n.t("cancelSubscriptionConfirm"),
      [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("yes"),
          style: "destructive",
          onPress: async () => {
            try {
              await SubscriptionManager.cancelSubscription();

              setSubscriptionStatus("inactive");
              setSubscriptionType(null);
              setExpiryDate(null);

              Alert.alert(I18n.t("success"), I18n.t("subscriptionCancelled"), [
                { text: I18n.t("ok") },
              ]);
            } catch (error) {
              Alert.alert(I18n.t("error"), I18n.t("cancelSubscriptionError"));
            }
          },
        },
      ]
    );
  }

  async function restorePurchases() {
    setIsLoading(true);

    // Симуляция восстановления покупок
    setTimeout(() => {
      Alert.alert(I18n.t("info"), I18n.t("subscriptionRestored"), [
        { text: I18n.t("ok") },
      ]);
      setIsLoading(false);
    }, 1500);
  }

  function formatDate(date) {
    if (!date) return "";
    return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function getStatusColor() {
    switch (subscriptionStatus) {
      case "active":
        return "#4CAF50";
      case "expired":
        return "#FF9800";
      default:
        return "#F44336";
    }
  }

  function getStatusText() {
    switch (subscriptionStatus) {
      case "active":
        return I18n.t("subscriptionActive");
      case "expired":
        return I18n.t("subscriptionExpires");
      default:
        return I18n.t("subscriptionInactive");
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Существующий контент */}
        <View style={styles.content}>
          <View style={{...styles.header, backgroundColor: theme.colors.primary}}>
            <Text style={styles.title}>{I18n.t("subscriptionTitle")}</Text>
            <Text style={styles.description}>
              {I18n.t("subscriptionDescription")}
            </Text>
          </View>

          {/* Текущий статус подписки */}
          <View style={{...styles.statusCard, backgroundColor: theme.colors.surface }}>
            <Text style={{...styles.statusTitle, color: theme.colors.text}}>{I18n.t("currentPlan")}</Text>
            <View style={styles.statusContent}>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: getStatusColor() },
                ]}
              />
              <View style={styles.statusInfo}>
                <Text style={{...styles.statusText, color: theme.colors.text}}>{getStatusText()}</Text>
                {subscriptionType && (
                  <Text style={styles.subscriptionType}>
                    {subscriptionType === "monthly"
                      ? I18n.t("monthlySubscription")
                      : I18n.t("yearlySubscription")}
                  </Text>
                )}
                {expiryDate && (
                  <Text style={styles.expiryDate}>
                    {I18n.t("subscriptionExpires")}: {formatDate(expiryDate)}
                  </Text>
                )}
              </View>
            </View>

            {subscriptionStatus === "active" && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelSubscription}
              >
                <Text style={styles.cancelButtonText}>
                  {I18n.t("cancelSubscription")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Планы подписки */}
          {subscriptionStatus !== "active" && (
            <View style={styles.plansContainer}>
              <Text style={styles.sectionTitle}>{I18n.t("upgradeToPremium")}</Text>

              {/* Месячная подписка */}
              <View style={styles.planCard}>
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>
                    {I18n.t("monthlySubscription")}
                  </Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.price}>$9.99</Text>
                    <Text style={styles.pricePeriod}>{I18n.t("perMonth")}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.subscribeButton,
                    isLoading && styles.disabledButton,
                  ]}
                  onPress={() => simulatePurchase("monthly")}
                  disabled={isLoading}
                >
                  <Text style={styles.subscribeButtonText}>
                    {isLoading ? I18n.t("loading") : I18n.t("subscribe")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Годовая подписка */}
              <View style={[styles.planCard, styles.recommendedPlan]}>
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedText}>
                    {I18n.t("saveWithYearly")}
                  </Text>
                </View>
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>
                    {I18n.t("yearlySubscription")}
                  </Text>
                  <View style={styles.priceContainer}>
                    <Text style={styles.price}>$99.99</Text>
                    <Text style={styles.pricePeriod}>{I18n.t("perYear")}</Text>
                  </View>
                </View>
                <Text style={styles.savingsText}>Экономия $19.89 в год</Text>
                <TouchableOpacity
                  style={[
                    styles.subscribeButton,
                    styles.recommendedButton,
                    isLoading && styles.disabledButton,
                  ]}
                  onPress={() => simulatePurchase("yearly")}
                  disabled={isLoading}
                >
                  <Text style={styles.subscribeButtonText}>
                    {isLoading ? I18n.t("loading") : I18n.t("subscribe")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Возможности подписки */}
          <View style={styles.featuresContainer}>
            <Text style={styles.sectionTitle}>
              {I18n.t("subscriptionFeatures")}
            </Text>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text style={styles.featureText}>{I18n.t("unlimitedProjects")}</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text style={styles.featureText}>{I18n.t("advancedAnalytics")}</Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text style={styles.featureText}>
                {I18n.t("advancedFunctionality")}
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text style={styles.featureText}>{I18n.t("exportAllFormats")}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Подписка автоматически продлевается, если не отменена за 24 часа до
              окончания периода.
            </Text>
          </View>
        </View>

        {/* Нижний отступ */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Нижнее меню */}
      <View style={styles.bottomMenuContainer}>
        {bottomMenuItems.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.bottomMenuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            {item.icon}
            <Text style={styles.bottomMenuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    opacity: 0.9,
  },
  statusCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
  },
  subscriptionType: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  expiryDate: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  cancelButton: {
    backgroundColor: "#f44336",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  plansContainer: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#800020",
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recommendedPlan: {
    borderWidth: 2,
    borderColor: "#800020",
    position: "relative",
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: "#800020",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  price: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#800020",
  },
  pricePeriod: {
    fontSize: 14,
    color: "#666",
  },
  savingsText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
    marginBottom: 16,
  },
  subscribeButton: {
    backgroundColor: "#800020",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  recommendedButton: {
    backgroundColor: "#800020",
  },
  disabledButton: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  featuresContainer: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 18,
    color: "#4CAF50",
    marginRight: 12,
    fontWeight: "bold",
  },
  featureText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  restoreButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#800020",
    margin: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  restoreButtonText: {
    color: "#800020",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    padding: 16,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 18,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  content: {
    // Существующие стили контента
  },
  bottomMenuContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#7a1434', // бордовый
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginHorizontal: 16,
    marginBottom: 50,
    paddingVertical: 12,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomMenuItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomMenuLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
