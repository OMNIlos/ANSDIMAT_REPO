// DrawerNavigator.js
import React, { useState, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { NavigationContainer } from "@react-navigation/native";
import HomeScreen from "../screens/HomeScreen";
import AboutScreen from "../screens/AboutScreen";
import DownloadScreen from "../screens/DownloadScreen";
import ContactUs from "../screens/ContactUs";
import OrderScreen from "../screens/OrderScreen";
import ExamplesAndVideos from "../screens/ExamplesAndVideos";
import LanguageContext from "../LanguageContext.js";
import I18n from "../Localization";
import PumpingTestProcessingScreen from "../screens/PumpingTestProcessing/index.js";

const Drawer = createDrawerNavigator();

function CustomDrawerContent({ navigation }) {
  const [utilities, setUtilities] = useState(false);
  const { toggleLanguage, locale } = useContext(LanguageContext);

  return (
    <ScrollView style={{ ...styles.drawerContainer, marginTop: "15%" }}>
      <TouchableOpacity onPress={() => navigation.navigate(I18n.t("home"))}>
        <Image
          source={require("../assets/icon.png")}
          style={{ marginBottom: 10 }}
        />
        <Text style={styles.item}>{I18n.t("home")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate(I18n.t("about"))}>
        <Text style={styles.item}>{I18n.t("about")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setUtilities(!utilities)}>
        <Text style={utilities ? styles.openUtils : styles.item}>
          {I18n.t("utilities")} {utilities ? "▲" : "▼"}
        </Text>
      </TouchableOpacity>
      {utilities && (
        <View style={styles.subMenu}>
          <TouchableOpacity>
            <Text style={styles.subItem}>{I18n.t("util1")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("PumpingTestProcessing")}
          >
            <Text style={styles.subItem}>{I18n.t("util2")}</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity onPress={() => navigation.navigate(I18n.t("order"))}>
        <Text style={styles.item}>{I18n.t("order")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate(I18n.t("download"))}>
        <Text style={styles.item}>{I18n.t("download")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate(I18n.t("contact"))}>
        <Text style={styles.item}>{I18n.t("contact")}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate(I18n.t("examples"))}>
        <Text style={styles.item}>{I18n.t("examples")}</Text>
      </TouchableOpacity>

      {/* Кнопка переключения языка */}
      <TouchableOpacity onPress={toggleLanguage}>
        <Text style={{ ...styles.item, color: "#800020", marginTop: 20 }}>
          {I18n.t("toggleLang")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function DrawerNavigator() {
  const { locale } = useContext(LanguageContext);

  return (
    <NavigationContainer>
      <Drawer.Navigator
        key={locale}
        screenOptions={{
          headerTintColor: "#800020",
          drawerActiveTintColor: "#b22222",
        }}
        drawerContent={(props) => <CustomDrawerContent {...props} />}
      >
        <Drawer.Screen name={I18n.t("home")} component={HomeScreen} />
        <Drawer.Screen name={I18n.t("about")} component={AboutScreen} />
        <Drawer.Screen name={I18n.t("order")} component={OrderScreen} />
        <Drawer.Screen name={I18n.t("download")} component={DownloadScreen} />
        <Drawer.Screen name={I18n.t("contact")} component={ContactUs} />
        <Drawer.Screen
          name={I18n.t("examples")}
          component={ExamplesAndVideos}
        />
        <Drawer.Screen
          name="PumpingTestProcessing"
          component={PumpingTestProcessingScreen}
          options={{
            drawerLabel: () => null,
            title: null,
            drawerItemStyle: { height: 0 },
          }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  item: {
    fontSize: 16,
    paddingVertical: 10,
    color: "#333",
  },
  openUtils: {
    fontSize: 16,
    paddingVertical: 10,
    color: "#800020",
    fontWeight: "bold",
  },
  subMenu: {
    marginLeft: 20,
  },
  subItem: {
    fontSize: 14,
    paddingVertical: 8,
    color: "#666",
  },
});
