import React, { useContext } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
} from "react-native";
import { Text, Button } from "react-native-paper";
import I18n from "../Localization";
import LanguageContext from "../LanguageContext";

export default function ContactUsScreen() {
  const { locale } = useContext(LanguageContext);

  const handlePress = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error("Ошибка при открытии ссылки", err)
    );
  };
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{I18n.t("contactsTitle")}</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>{I18n.t("australiaTitle")}</Text>
        <Text
          style={styles.text}
          onPress={() =>
            handlePress(
              "https://www.linkedin.com/in/anastasia-boronina-48884431"
            )
          }
        >
          Анастасия Боронина
        </Text>
        <Text style={styles.text}>Нева Грунтовые Воды Консалтинг</Text>
        <Text style={styles.text}>Номер телефона: +61 478 633 429</Text>
        <Text style={styles.text}>
          Email:{" "}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL("mailto:support@ansdimat.com")}
          >
            support@ansdimat.com
          </Text>
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{I18n.t("russiaTitle")}</Text>
        <Text
          style={styles.text}
          onPress={() =>
            handlePress(
              "https://www.linkedin.com/in/anton-nikulenkov-274157a5/"
            )
          }
        >
          Антон Никулинов
        </Text>
        <Text style={styles.text}>Институт геоэкологии, Академия Наук.</Text>
        <Text style={styles.text}>
          Адрес: 199004, Россия, Санкт-Петербург, средний проспект V.O., 41
        </Text>
        <Text style={styles.text}>
          Email:{" "}
          <Text
            style={styles.link}
            onPress={() =>
              Linking.openURL("mailto:support-russia@ansdimat.com")
            }
          >
            support-russia@ansdimat.com
          </Text>
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>{I18n.t("websiteSupport")}</Text>
        <Text style={styles.text}>
          Email:{" "}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL("mailto:info@ansdimat.com")}
          >
            info@ansdimat.com
          </Text>
        </Text>
      </View>

      <Button
        mode="contained"
        style={styles.button}
        onPress={() => Linking.openURL("https://ansdimat.com")}
      >
        {I18n.t("goToWebsite")}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    color: "#800000",
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: "#800000",
    marginBottom: 5,
  },
  text: {
    fontSize: 16,
    marginBottom: 3,
  },
  link: {
    color: "#800000",
    textDecorationLine: "underline",
  },
  button: {
    marginTop: 30,
    backgroundColor: "#800000",
  },
});
