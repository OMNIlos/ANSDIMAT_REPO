import React, { useState, useContext } from "react";
import { View, ScrollView, StyleSheet, Alert, Linking, Platform, BackHandler, TouchableOpacity } from "react-native";
import {
  TextInput,
  Button,
  Text,
  RadioButton,
  Title,
} from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from "../Localization";
import { LanguageContext } from "../LanguageContext";
import { useTheme } from "react-native-paper";

export default function OrderScreen({ navigation }) {
  const theme = useTheme();
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    licenseType: "single",
    comment: "",
  });
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

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async () => {
    // Валидация
    if (!form.name.trim() || !form.email.trim() || !form.licenseType) {
      Alert.alert(
        I18n.t("error"),
        I18n.t("fullName") +
          ", " +
          I18n.t("email") +
          ", " +
          I18n.t("licenseType") +
          " - " +
          I18n.t("noData")
      );
      return;
    }
    // Определяем email получателя
    const to =
      locale === "ru" ? "support-russia@ansdimat.com" : "support@ansdimat.com";
    // Формируем тему и тело письма
    const subject = encodeURIComponent(I18n.t("orderTitle"));
    const body = encodeURIComponent(
      `${I18n.t("fullName")}: ${form.name}\n` +
        `${I18n.t("organization")}: ${form.company}\n` +
        `${I18n.t("email")}: ${form.email}\n` +
        `${I18n.t("phone")}: ${form.phone}\n` +
        `${I18n.t("address")}: ${form.address}\n` +
        `${I18n.t("licenseType")}: ${
          form.licenseType === "single"
            ? I18n.t("singleLicense")
            : I18n.t("multiLicense")
        }\n` +
        `${I18n.t("comment")}: ${form.comment}`
    );
    const mailto = `mailto:${to}?subject=${subject}&body=${body}`;
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (canOpen) {
        await Linking.openURL(mailto);
        Alert.alert(
          I18n.t("orderSent"),
          I18n.t("orderThanks", { name: form.name })
        );
      } else {
        Alert.alert(I18n.t("error"), I18n.t("mailClientError"));
      }
    } catch (e) {
      Alert.alert(I18n.t("error"), I18n.t("mailSendError"));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Существующий контент */}
        <View style={styles.content}>
          <Title style={{ color: theme.colors.primary, textAlign: "center", marginBottom: 20 }}>{I18n.t("orderTitle")}</Title>

          <TextInput
            label={I18n.t("fullName")}
            mode="outlined"
            value={form.name}
            onChangeText={(v) => handleChange("name", v)}
            style={styles.input}
          />
          <TextInput
            label={I18n.t("organization")}
            mode="outlined"
            value={form.company}
            onChangeText={(v) => handleChange("company", v)}
            style={styles.input}
          />
          <TextInput
            label={I18n.t("email")}
            mode="outlined"
            value={form.email}
            onChangeText={(v) => handleChange("email", v)}
            style={styles.input}
            keyboardType="email-address"
          />
          <TextInput
            label={I18n.t("phone")}
            mode="outlined"
            value={form.phone}
            onChangeText={(v) => handleChange("phone", v)}
            style={styles.input}
            keyboardType="phone-pad"
          />
          <TextInput
            label={I18n.t("address")}
            mode="outlined"
            value={form.address}
            onChangeText={(v) => handleChange("address", v)}
            style={styles.input}
            multiline
          />

          <Text style={{ marginTop: 20, marginBottom: 10, color: theme.colors.text }}>
            {I18n.t("licenseType")}:
          </Text>
          <RadioButton.Group
            onValueChange={(value) => handleChange("licenseType", value)}
            value={form.licenseType}
          >
            <View style={styles.radioContainer}>
              <RadioButton.Item
                label={I18n.t("singleLicense")}
                value="single"
                color={theme.colors.primary}
              />
              <RadioButton.Item
                label={I18n.t("multiLicense")}
                value="multi"
                color={theme.colors.primary}
              />
            </View>
          </RadioButton.Group>

          <TextInput
            label={I18n.t("comment")}
            mode="outlined"
            value={form.comment}
            onChangeText={(v) => handleChange("comment", v)}
            style={styles.input}
            multiline
            numberOfLines={4}
          />

          <Button
            mode="contained"
            onPress={handleSubmit}
            style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
          >
            {I18n.t("sendOrder")}
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
  input: {
    marginBottom: 16,
  },
  radioContainer: {
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 20,
    marginBottom: 20,
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
