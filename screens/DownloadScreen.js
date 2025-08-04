import React, { useContext } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, BackHandler, Alert } from "react-native";
import { Text, Button } from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from "../Localization";
import { LanguageContext } from "../LanguageContext";
import { useTheme } from "react-native-paper";


export default function DownloadScreen({ navigation }) {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);



  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Существующий контент */}
        <View style={styles.content}>
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

        {/* Нижний отступ */}
        <View style={{ height: 100 }} />
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
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
  button: {
    // Существующие стили кнопки
  },

});
