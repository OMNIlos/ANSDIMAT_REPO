import React, { useContext } from "react";
import { View, StyleSheet, ScrollView, Linking } from "react-native";
import { Text, Button, Card } from "react-native-paper";
import I18n from "../Localization";
import LanguageContext from "../LanguageContext";

export default function ExamplesAndVideosScreen() {
  const { locale } = useContext(LanguageContext);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{I18n.t("examplesTitle")}</Text>

      <Text style={styles.sectionTitle}>{I18n.t("usageExamples")}</Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{I18n.t("pumpTestTitle")}</Text>
          <Text style={styles.cardText}>{I18n.t("pumpTestDescription")}</Text>
          <Button
            mode="outlined"
            onPress={() =>
              Linking.openURL(
                "https://ansdimat.com/Ru/video_cases/case_01.shtml"
              )
            }
            textColor="#800000"
          >
            {I18n.t("moreDetails")}
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>{I18n.t("pitModelTitle")}</Text>
          <Text style={styles.cardText}>{I18n.t("pitModelDescription")}</Text>
          <Button
            mode="outlined"
            onPress={() =>
              Linking.openURL(
                "https://ansdimat.com/Ru/video_cases/case_02.shtml"
              )
            }
            textColor="#800000"
          >
            {I18n.t("moreDetails")}
          </Button>
        </Card.Content>
      </Card>

      <Text style={styles.sectionTitle}>{I18n.t("tutorialVideos")}</Text>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>📹</Text>
          </View>
          <Text style={styles.cardTitle}>{I18n.t("video1Title")}</Text>
          <Button
            mode="contained"
            style={styles.watchButton}
            onPress={() =>
              Linking.openURL(
                "https://rutube.ru/video/a86ee3f1bdd6896d95afc1bd8aa13851/"
              )
            }
          >
            {I18n.t("watch")}
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>📹</Text>
          </View>
          <Text style={styles.cardTitle}>{I18n.t("video2Title")}</Text>
          <Button
            mode="contained"
            style={styles.watchButton}
            onPress={() =>
              Linking.openURL(
                "https://rutube.ru/video/6107cc6ecaf01a721d30661569f92ac0/"
              )
            }
          >
            {I18n.t("watch")}
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>📹</Text>
          </View>
          <Text style={styles.cardTitle}>{I18n.t("video3Title")}</Text>
          <Button
            mode="contained"
            style={styles.watchButton}
            onPress={() =>
              Linking.openURL(
                "https://rutube.ru/video/472c734ab749122fd95c4506a05e6d41/"
              )
            }
          >
            {I18n.t("watch")}
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>📹</Text>
          </View>
          <Text style={styles.cardTitle}>{I18n.t("video4Title")}</Text>
          <Button
            mode="contained"
            style={styles.watchButton}
            onPress={() =>
              Linking.openURL(
                "https://rutube.ru/video/2e106a4faaf4f34fa315b5a5ac8b8b2a/"
              )
            }
          >
            {I18n.t("watch")}
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>📹</Text>
          </View>
          <Text style={styles.cardTitle}>{I18n.t("video5Title")}</Text>
          <Button
            mode="contained"
            style={styles.watchButton}
            onPress={() =>
              Linking.openURL(
                "https://rutube.ru/video/23f1fc0ac55afbec746b9689a30fae0c/"
              )
            }
          >
            {I18n.t("watch")}
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>📹</Text>
          </View>
          <Text style={styles.cardTitle}>{I18n.t("video6Title")}</Text>
          <Button
            mode="contained"
            style={styles.watchButton}
            onPress={() =>
              Linking.openURL(
                "https://rutube.ru/video/a96c453b0b730de20ac58e0cc097acff/"
              )
            }
          >
            {I18n.t("watch")}
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>📹</Text>
          </View>
          <Text style={styles.cardTitle}>{I18n.t("video7Title")}</Text>
          <Button
            mode="contained"
            style={styles.watchButton}
            onPress={() =>
              Linking.openURL(
                "https://rutube.ru/video/a96c453b0b730de20ac58e0cc097acff/"
              )
            }
          >
            {I18n.t("watch")}
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 50,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    color: "#800000",
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    color: "#800000",
    marginTop: 20,
    marginBottom: 10,
    fontWeight: "600",
  },
  card: {
    marginBottom: 15,
    backgroundColor: "#f9f9f9",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  cardText: {
    marginBottom: 10,
    fontSize: 15,
  },
  watchButton: {
    backgroundColor: "#800000",
    marginTop: 5,
  },
  videoPlaceholder: {
    width: 120,
    height: 80,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 32,
    color: "#666",
  },
});
