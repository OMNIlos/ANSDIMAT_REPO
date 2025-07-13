import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import I18n from "../Localization";
import LanguageContext from "../LanguageContext";

export default function PremiumBanner({
  title = "Upgrade to Premium",
  description = "Get unlimited access to all features",
  showIcon = true,
  style = { width: "100%" },
}) {
  const navigation = useNavigation();
  const { locale } = useContext(LanguageContext);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => navigation.navigate("Subscription")}
    >
      <View style={styles.content}>
        {showIcon && (
          <View style={styles.iconContainer}>
            <Image source={require("../assets/main.png")} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <View style={styles.arrowContainer}>
          <Text style={styles.arrow}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#800020",
    borderRadius: 12,
    //margin: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  description: {
    color: "#fff",
    fontSize: 14,
    opacity: 0.9,
  },
  arrowContainer: {
    marginLeft: 12,
  },
  arrow: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
