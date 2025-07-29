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
import { LanguageContext } from "../LanguageContext";
import { useTheme } from "react-native-paper";

export default function ContactUsScreen() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);

  const handlePress = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error(I18n.t("linkOpenError"), err)
    );
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.primary}}>{I18n.t("contactsTitle")}</Text>

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
          {I18n.t("anastasiaBoronina")}
        </Text>
        <Text style={styles.text}>{I18n.t("nevaGroundwaterConsulting")}</Text>
        <Text style={styles.text}>
          {I18n.t("phoneNumber")}: +61 478 633 429
        </Text>
        <Text style={styles.text}>
          {I18n.t("email")}:{" "}
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
          {I18n.t("antonNikulenkov")}
        </Text>
        <Text style={styles.text}>{I18n.t("instituteOfGeoecology")}</Text>
        <Text style={styles.text}>
          {I18n.t("address")}: {I18n.t("russiaAddress")}
        </Text>
        <Text style={styles.text}>
          {I18n.t("email")}:{" "}
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
          {I18n.t("email")}:{" "}
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
        style={[styles.button,
          { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }]}
        onPress={() => Linking.openURL("https://ansdimat.com")}
      >
        {I18n.t("goToWebsite")}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({

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
