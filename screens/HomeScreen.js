import React, { useState, useContext } from "react";
import { View, StyleSheet, Image } from "react-native";
import { TextInput, Button, Text, Title } from "react-native-paper";
import I18n from "../Localization";
import LanguageContext from "../LanguageContext";
import AnimatedNetworkBackground from "../components/AnimatedNetworkBackground";

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const { locale } = useContext(LanguageContext);

  return (
    <View style={styles.container}>
      <AnimatedNetworkBackground />
      <View
        style={{
          ...styles.container,
          justifyContent: "center",
          paddingBottom: 128,
          alignContent: "center",
          marginTop: "40%",
        }}
      >
        <Image
          source={require("../assets/Снимок экрана 2025-06-29 в 11.20.33.png")}
          style={{
            alignSelf: "center",
            width: 120,
            height: 120,
            marginBottom: 32,
            borderRadius: 30,
          }}
        />
        <Title style={styles.title}>{I18n.t("homeTitle")}</Title>
        <TextInput
          label={I18n.t("search")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          mode="outlined"
          style={styles.input}
        />
        <Button mode="contained" onPress={() => {}} style={styles.button}>
          {I18n.t("searchButton")}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    position: "relative",
    justifyContent: "start",
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
    color: "#800020",
  },
  input: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#800020",
  },
});
