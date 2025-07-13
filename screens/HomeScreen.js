import React, { useState, useContext, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TextInput, Button, Text, Title } from "react-native-paper";
import I18n from "../Localization";
import LanguageContext from "../LanguageContext";
import AnimatedNetworkBackground from "../components/AnimatedNetworkBackground";
import { useNavigation } from "@react-navigation/native";
import SubscriptionManager from "../utils/SubscriptionManager";

// Простая функция транслитерации (рус -> лат и лат -> рус)
function translit(str) {
  const ru = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz";
  const en = "abvgdeejzijklmnoprstufhccss'y'euaabcdefghijklmnopqrstuvwxyz";
  const map = {};
  for (let i = 0; i < ru.length; i++) map[ru[i]] = en[i] || ru[i];
  for (let i = 0; i < en.length; i++) map[en[i]] = ru[i] || en[i];
  return str
    .split("")
    .map((c) => map[c.toLowerCase()] || c)
    .join("");
}

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const { locale } = useContext(LanguageContext);
  const navigation = useNavigation();

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  async function loadSubscriptionStatus() {
    const status = await SubscriptionManager.getSubscriptionStatus();
    setSubscriptionStatus(status);
  }

  // Массив страниц с route, label и альтернативными ключами для поиска
  const PAGES = useMemo(
    () => [
      {
        route: "Home",
        label: I18n.t("home"),
        keys: [I18n.t("home"), "home", "главная"],
      },
      {
        route: "About",
        label: I18n.t("about"),
        keys: [I18n.t("about"), "about", "о нас", "о компании"],
      },
      {
        route: "Order",
        label: I18n.t("order"),
        keys: [I18n.t("order"), "order", "заказ"],
      },
      {
        route: "Download",
        label: I18n.t("download"),
        keys: [I18n.t("download"), "download", "скачать"],
      },
      {
        route: "Contact",
        label: I18n.t("contact"),
        keys: [I18n.t("contact"), "contact", "контакты", "связаться"],
      },
      {
        route: "Examples",
        label: I18n.t("examples"),
        keys: [I18n.t("examples"), "examples", "примеры", "видео"],
      },
      {
        route: "Calculator",
        label: I18n.t("util1"),
        keys: [I18n.t("util1"), "calculator", "калькулятор"],
      },
      {
        route: "PumpingTestProcessing",
        label: I18n.t("util2"),
        keys: [
          I18n.t("util2"),
          "pumpingtestprocessing",
          "обработка",
          "откачки",
        ],
      },
    ],
    [locale]
  );

  // Фильтрация страниц по поисковому запросу (рус, англ, транслит)
  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const qTrans = translit(q);
    return PAGES.filter((p) =>
      p.keys.some(
        (k) =>
          k.toLowerCase().includes(q) ||
          k.toLowerCase().includes(qTrans) ||
          translit(k.toLowerCase()).includes(q) // поиск по обратной транслитерации
      )
    );
  }, [searchQuery, PAGES]);

  return (
    <SafeAreaView style={styles.container}>
      <AnimatedNetworkBackground />
      <View
        style={{
          ...styles.container,
          justifyContent: "center",
          paddingBottom: 128,
          alignContent: "center",
          paddingTop: 20,
        }}
      >
        <Image
          source={require("../assets/main.png")}
          style={{
            alignSelf: "center",
            width: 120,
            height: 120,
            marginBottom: 32,
          }}
        />
        <Title style={styles.title}>{I18n.t("homeTitle")}</Title>

        {/* Индикатор подписки */}
        {subscriptionStatus && (
          <TouchableOpacity
            style={[
              styles.subscriptionIndicator,
              {
                backgroundColor: subscriptionStatus.isActive
                  ? "#4CAF50"
                  : "#F44336",
              },
            ]}
            onPress={() => navigation.navigate("Subscription")}
          >
            <Text style={styles.subscriptionText}>
              {subscriptionStatus.isActive ? "✓ Premium" : "Upgrade to Premium"}
            </Text>
          </TouchableOpacity>
        )}

        <TextInput
          label={I18n.t("search")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {/* Список автодополнения */}
        {filteredPages.length > 0 && (
          <View style={styles.suggestionsBox}>
            <FlatList
              data={filteredPages}
              keyExtractor={(item) => item.route}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => {
                    navigation.navigate(item.route);
                    setSearchQuery("");
                  }}
                >
                  <Text style={styles.suggestionText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
        <Button
          mode="contained"
          onPress={() => {
            if (filteredPages.length === 1) {
              navigation.navigate(filteredPages[0].route);
              setSearchQuery("");
            }
          }}
          style={styles.button}
        >
          {I18n.t("searchButton")}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    position: "relative",
    justifyContent: "start",
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
    color: "#800020",
  },
  input: {
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#800020",
    marginTop: 10,
  },
  suggestionsBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 10,
    maxHeight: 180,
    zIndex: 10,
    elevation: 2,
  },
  subscriptionIndicator: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subscriptionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionText: {
    fontSize: 16,
    color: "#800020",
  },
});
