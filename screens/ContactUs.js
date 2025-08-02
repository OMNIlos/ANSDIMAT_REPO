import React, { useContext } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
  Platform,
  BackHandler,
  Alert,
} from "react-native";
import { Text, Button } from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from "../Localization";
import { LanguageContext } from "../LanguageContext";
import { useTheme } from "react-native-paper";

export default function ContactUsScreen({ navigation }) {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);

  const handlePress = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error(I18n.t("linkOpenError"), err)
    );
  };

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
