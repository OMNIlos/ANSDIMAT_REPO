import React, { useContext } from "react";
import { View, StyleSheet, ScrollView, Image } from "react-native";
import { Text } from "react-native-paper";
import I18n from "../Localization";
import LanguageContext from "../LanguageContext";

export default function AboutScreen() {
  const { locale } = useContext(LanguageContext);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>{I18n.t("aboutStory")}</Text>
        <Text style={styles.p1}>{I18n.t("aboutDevelopment")}</Text>

        <View style={{ marginTop: 30 }}>
          <Text style={styles.h1}>{I18n.t("whatIsTitle")}</Text>
          <Text style={styles.p1}>{I18n.t("whatIsDescription")}</Text>
          <Text style={styles.p1}>{I18n.t("applicationsTitle")}</Text>
          <Text style={styles.p1}>{I18n.t("app1")}</Text>
          <Text style={styles.p1}>{I18n.t("app2")}</Text>
          <Text style={styles.p1}>{I18n.t("app3")}</Text>
          <Text style={styles.p1}>{I18n.t("app4")}</Text>
          <Text style={styles.p1}>{I18n.t("app5")}</Text>
          <Text style={styles.p1}>{I18n.t("app6")}</Text>
          <Text style={styles.p1}>{I18n.t("app7")}</Text>

          <Text style={styles.h1}>{I18n.t("modulesTitle")}</Text>
          <Text style={styles.p1}>{I18n.t("modulesDescription")}</Text>
          <Text style={styles.p1}>{I18n.t("module1")}</Text>
          <Text style={styles.p1}>{I18n.t("module2")}</Text>
          <Text style={styles.p1}>{I18n.t("module3")}</Text>
          <Text style={styles.p1}>{I18n.t("module4")}</Text>
          <Text style={styles.p1}>{I18n.t("module5")}</Text>
          <Text style={styles.p1}>{I18n.t("module6")}</Text>
          <Text style={styles.p1}>{I18n.t("module7")}</Text>
          <Text style={styles.p1}>{I18n.t("module8")}</Text>

          <Text style={styles.p1}>
            ANSDIMAT includes solutions commonly applied in groundwater
            practice, along with custom modifications. Most support one or
            several pumping wells with constant or time-variable pumping. All
            solutions are explained in the help system.
          </Text>
        </View>

        <View style={{ marginTop: 40 }}>
          <Image
            source={require("../assets/client_geography.png")} // путь к карте
            style={{
              width: "100%",
              height: 200,
              resizeMode: "contain",
              marginBottom: 32,
            }}
          />
          <Text style={styles.h1}>{I18n.t("geographyTitle")}</Text>
          <Text style={styles.p1}>{I18n.t("geographyDescription")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  h1: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  p1: {
    fontSize: 16,
    marginBottom: 10,
  },
});
