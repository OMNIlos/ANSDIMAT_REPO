// DrawerNavigator.js
import React, { useState, useContext, useEffect } from "react";
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
import SubscriptionScreen from "../screens/SubscriptionScreen";
import ExamplesAndVideos from "../screens/ExamplesAndVideos";
import LanguageContext from "../LanguageContext.js";
import I18n from "../Localization";
import PumpingTestProcessingScreen from "../screens/PumpingTestProcessing/index.js";
import CalculatorScreen from "../screens/CalculatorScreen";

const Drawer = createDrawerNavigator();

function CustomDrawerContent({ navigation, state }) {
  const [utilities, setUtilities] = useState(false);
  const { toggleLanguage, locale } = useContext(LanguageContext);

  // Сохраняем состояние utilities при смене языка
  useEffect(() => {
    // Состояние utilities сохраняется автоматически
  }, [locale]);

  return (
    <ScrollView style={{ ...styles.drawerContainer, marginTop: "15%" }}>
      <TouchableOpacity
        onPress={() => {
          navigation.navigate("Home");
          navigation.closeDrawer();
        }}
      >
        <Image
          source={require("../assets/icon.png")}
          style={{ marginBottom: 10 }}
        />
        <Text
          style={[
            styles.item,
            state.routes[state.index]?.name === "Home" && styles.activeItem,
          ]}
        >
          {I18n.t("home")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          navigation.navigate("About");
          navigation.closeDrawer();
        }}
      >
        <Text
          style={[
            styles.item,
            state.routes[state.index]?.name === "About" && styles.activeItem,
          ]}
        >
          {I18n.t("about")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setUtilities(!utilities)}>
        <Text style={utilities ? styles.openUtils : styles.item}>
          {I18n.t("utilities")} {utilities ? "▲" : "▼"}
        </Text>
      </TouchableOpacity>
      {utilities && (
        <View style={styles.subMenu}>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate("Calculator");
              navigation.closeDrawer();
            }}
          >
            <Text
              style={[
                styles.subItem,
                state.routes[state.index]?.name === "Calculator" &&
                  styles.activeItem,
              ]}
            >
              {I18n.t("util1")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              navigation.navigate("PumpingTestProcessing");
              navigation.closeDrawer();
            }}
          >
            <Text
              style={[
                styles.subItem,
                state.routes[state.index]?.name === "PumpingTestProcessing" &&
                  styles.activeItem,
              ]}
            >
              {I18n.t("util2")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        onPress={() => {
          navigation.navigate("Order");
          navigation.closeDrawer();
        }}
      >
        <Text
          style={[
            styles.item,
            state.routes[state.index]?.name === "Order" && styles.activeItem,
          ]}
        >
          {I18n.t("order")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          navigation.navigate("Subscription");
          navigation.closeDrawer();
        }}
      >
        <Text
          style={[
            styles.item,
            state.routes[state.index]?.name === "Subscription" &&
              styles.activeItem,
          ]}
        >
          {I18n.t("subscription")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          navigation.navigate("Download");
          navigation.closeDrawer();
        }}
      >
        <Text
          style={[
            styles.item,
            state.routes[state.index]?.name === "Download" && styles.activeItem,
          ]}
        >
          {I18n.t("download")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          navigation.navigate("Contact");
          navigation.closeDrawer();
        }}
      >
        <Text
          style={[
            styles.item,
            state.routes[state.index]?.name === "Contact" && styles.activeItem,
          ]}
        >
          {I18n.t("contact")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          navigation.navigate("Examples");
          navigation.closeDrawer();
        }}
      >
        <Text
          style={[
            styles.item,
            state.routes[state.index]?.name === "Examples" && styles.activeItem,
          ]}
        >
          {I18n.t("examples")}
        </Text>
      </TouchableOpacity>

      {/* Кнопка переключения языка */}
      <TouchableOpacity
        onPress={() => {
          toggleLanguage();
          // Не закрываем drawer при переключении языка
        }}
      >
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
        screenOptions={{
          headerTintColor: "#800020",
          drawerActiveTintColor: "#b22222",
          headerShown: true,
          headerStyle: {
            backgroundColor: "#fff",
          },
          headerTitleStyle: {
            color: "#800020",
            fontWeight: "bold",
          },
        }}
        drawerContent={(props) => <CustomDrawerContent {...props} />}
      >
        <Drawer.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: I18n.t("home"), headerShown: true }}
        />
        <Drawer.Screen
          name="About"
          component={AboutScreen}
          options={{ title: I18n.t("about"), headerShown: true }}
        />
        <Drawer.Screen
          name="Order"
          component={OrderScreen}
          options={{ title: I18n.t("order"), headerShown: true }}
        />
        <Drawer.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{ title: I18n.t("subscription"), headerShown: true }}
        />
        <Drawer.Screen
          name="Download"
          component={DownloadScreen}
          options={{ title: I18n.t("download"), headerShown: true }}
        />
        <Drawer.Screen
          name="Contact"
          component={ContactUs}
          options={{ title: I18n.t("contact"), headerShown: true }}
        />
        <Drawer.Screen
          name="Examples"
          component={ExamplesAndVideos}
          options={{ title: I18n.t("examples"), headerShown: true }}
        />
        <Drawer.Screen
          name="PumpingTestProcessing"
          component={PumpingTestProcessingScreen}
          options={{ title: I18n.t("util2"), headerShown: true }}
        />
        <Drawer.Screen
          name="Calculator"
          component={CalculatorScreen}
          options={{
            drawerLabel: I18n.t("util1", { defaultValue: "Калькулятор" }),
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
  activeItem: {
    color: "#800020",
    fontWeight: "bold",
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
