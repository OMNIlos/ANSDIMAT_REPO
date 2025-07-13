import React, { useState, useContext } from "react";
import { View, ScrollView, StyleSheet, Alert, Linking } from "react-native";
import {
  TextInput,
  Button,
  Text,
  RadioButton,
  Title,
} from "react-native-paper";
import I18n from "../Localization";
import LanguageContext from "../LanguageContext";

export default function OrderScreen() {
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
    <ScrollView contentContainerStyle={styles.container}>
      <Title style={styles.title}>{I18n.t("orderTitle")}</Title>

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
        keyboardType="email-address"
        value={form.email}
        onChangeText={(v) => handleChange("email", v)}
        style={styles.input}
      />
      <TextInput
        label={I18n.t("phone")}
        mode="outlined"
        keyboardType="phone-pad"
        value={form.phone}
        onChangeText={(v) => handleChange("phone", v)}
        style={styles.input}
      />
      <TextInput
        label={I18n.t("address")}
        mode="outlined"
        value={form.address}
        onChangeText={(v) => handleChange("address", v)}
        style={styles.input}
      />

      <Text style={{ marginTop: 10, marginBottom: 5 }}>
        {I18n.t("licenseType")}
      </Text>
      <RadioButton.Group
        onValueChange={(v) => handleChange("licenseType", v)}
        value={form.licenseType}
      >
        <RadioButton.Item label={I18n.t("singleLicense")} value="single" />
        <RadioButton.Item label={I18n.t("multiLicense")} value="multi" />
      </RadioButton.Group>

      <TextInput
        label={I18n.t("comment")}
        mode="outlined"
        multiline
        numberOfLines={4}
        value={form.comment}
        onChangeText={(v) => handleChange("comment", v)}
        style={styles.input}
      />

      <Button mode="contained" onPress={handleSubmit} style={styles.button}>
        {I18n.t("submit")}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    color: "#800020",
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#800020",
    marginTop: 20,
  },
});
