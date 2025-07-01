import React, { useContext } from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import ProjectManager from "./ProjectManager";
import Wizard from "./Wizard";
import DataProcessing from "./DataProcessing";
import ExportManager from "./ExportManager";
import I18n from "../../Localization";
import LanguageContext from "../../LanguageContext";

const Tab = createMaterialTopTabNavigator();

export default function PumpingTestProcessingScreen() {
  const { locale } = useContext(LanguageContext);

  return (
    <Tab.Navigator key={locale}>
      <Tab.Screen
        name={I18n.t("projectManagement")}
        component={ProjectManager}
      />
      <Tab.Screen name={I18n.t("wizard")} component={Wizard} />
      <Tab.Screen name={I18n.t("dataProcessing")} component={DataProcessing} />
      <Tab.Screen name={I18n.t("export")} component={ExportManager} />
    </Tab.Navigator>
  );
}
