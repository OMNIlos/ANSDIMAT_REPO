import React, { useContext } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button } from "react-native-paper";
import I18n from "../Localization";
import LanguageContext from "../LanguageContext";

export default function DownloadScreen() {
  const { locale } = useContext(LanguageContext);

  return (
    <View style={styles.container}>
      <Text>{I18n.t("downloadText")}</Text>
      <Button
        mode="contained"
        style={{ marginTop: 20, backgroundColor: "#800020" }}
        onPress={() => {
          // Здесь можно будет вставить логику загрузки
        }}
      >
        {I18n.t("downloadButton")}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
});
