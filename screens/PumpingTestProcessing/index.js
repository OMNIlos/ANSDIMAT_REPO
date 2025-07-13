import React, { useContext, lazy, Suspense } from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { View, ActivityIndicator } from "react-native";
import I18n from "../../Localization";
import LanguageContext from "../../LanguageContext";

// Ленивая загрузка компонентов
const ProjectManager = lazy(() => import("./ProjectManager"));
const Wizard = lazy(() => import("./Wizard"));
const DataProcessing = lazy(() => import("./DataProcessing"));
const ExportManager = lazy(() => import("./ExportManager"));
const JournalManager = lazy(() => import("./JournalManager"));

const Tab = createMaterialTopTabNavigator();

export default function PumpingTestProcessingScreen() {
  const { locale } = useContext(LanguageContext);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopColor: "#e0e0e0",
            elevation: 0,
            shadowOpacity: 0,
            height: 50,
          },
          tabBarActiveTintColor: "#800020",
          tabBarInactiveTintColor: "#666",
          tabBarIndicatorStyle: {
            backgroundColor: "#800020",
            height: 3,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
            textTransform: "none",
            paddingHorizontal: 4,
          },
          tabBarItemStyle: {
            paddingHorizontal: 8,
          },
          tabBarScrollEnabled: true,
          tabBarAllowFontScaling: false,
        }}
      >
        <Tab.Screen
          name="ProjectManager"
          options={{ title: I18n.t("projectManagement") }}
        >
          {() => (
            <Suspense
              fallback={
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color="#800020" />
                </View>
              }
            >
              <ProjectManager />
            </Suspense>
          )}
        </Tab.Screen>
        <Tab.Screen name="Wizard" options={{ title: I18n.t("wizard") }}>
          {() => (
            <Suspense
              fallback={
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color="#800020" />
                </View>
              }
            >
              <Wizard />
            </Suspense>
          )}
        </Tab.Screen>
        <Tab.Screen
          name="DataProcessing"
          options={{ title: I18n.t("dataProcessing") }}
        >
          {() => (
            <Suspense
              fallback={
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color="#800020" />
                </View>
              }
            >
              <DataProcessing />
            </Suspense>
          )}
        </Tab.Screen>
        <Tab.Screen
          name="JournalManager"
          options={{ title: I18n.t("journalManagement") }}
        >
          {() => (
            <Suspense
              fallback={
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color="#800020" />
                </View>
              }
            >
              <JournalManager />
            </Suspense>
          )}
        </Tab.Screen>
        <Tab.Screen name="ExportManager" options={{ title: I18n.t("export") }}>
          {() => (
            <Suspense
              fallback={
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <ActivityIndicator size="large" color="#800020" />
                </View>
              }
            >
              <ExportManager />
            </Suspense>
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </View>
  );
}
