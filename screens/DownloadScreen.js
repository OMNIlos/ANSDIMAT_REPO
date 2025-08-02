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
