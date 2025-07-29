import React, { useContext } from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button } from "react-native-paper";
import I18n from "../Localization";
import { LanguageContext } from "../LanguageContext";
import { useTheme } from "react-native-paper";

export default function DownloadScreen() {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);

  return (
    <View style={{ padding: 20, backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.primary, textAlign: "center", marginBottom: 20 }}>{I18n.t("downloadText")}</Text>
      <Button
        mode="contained"
        style={[styles.button,
          { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }]}
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
});
