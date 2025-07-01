import React, { useState, useEffect, useCallback, useContext } from "react";
import {
  View,
  Text,
  Button,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import LanguageContext from "../../LanguageContext";

const TEST_TYPES = [
  I18n.t("pumpingTest"),
  I18n.t("slugTest"),
  I18n.t("packerTest"),
];
const LAYER_TYPES = [I18n.t("confined"), I18n.t("unconfined"), I18n.t("leaky")];
const BOUNDARY_TYPES = [
  I18n.t("infinite"),
  I18n.t("constantHead"),
  I18n.t("noFlow"),
];

export default function Wizard() {
  const [step, setStep] = useState(0);
  const [testType, setTestType] = useState(TEST_TYPES[0]);
  const [layerType, setLayerType] = useState(LAYER_TYPES[0]);
  const [boundary, setBoundary] = useState(BOUNDARY_TYPES[0]);
  const [dataRows, setDataRows] = useState([{ t: "", s: "" }]);
  const [activeProject, setActiveProject] = useState(null);
  const { locale } = useContext(LanguageContext);

  useFocusEffect(
    useCallback(() => {
      loadActiveProject();
    }, [])
  );

  async function loadActiveProject() {
    const id = await AsyncStorage.getItem("pumping_active_project_id");
    if (!id) {
      setActiveProject(null);
      return;
    }
    const projectsRaw = await AsyncStorage.getItem("pumping_projects");
    if (!projectsRaw) return;
    const projects = JSON.parse(projectsRaw);
    const project = projects.find((p) => p.id === id);
    setActiveProject(project || null);
  }

  // Шаг 1: выбор типа опробования
  function Step1() {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{I18n.t("step1")}</Text>
        {TEST_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={styles.selectBtn}
            onPress={() => setTestType(type)}
          >
            <Text style={{ color: testType === type ? "#800020" : "#222" }}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.navBtns}>
          <Button
            title={I18n.t("next")}
            onPress={() => setStep(1)}
            color="#800020"
          />
        </View>
      </View>
    );
  }

  // Шаг 2: выбор типа пласта
  function Step2() {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{I18n.t("step2")}</Text>
        {LAYER_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={styles.selectBtn}
            onPress={() => setLayerType(type)}
          >
            <Text style={{ color: layerType === type ? "#800020" : "#222" }}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.navBtns}>
          <Button title={I18n.t("back")} onPress={() => setStep(0)} />
          <Button
            title={I18n.t("next")}
            onPress={() => setStep(2)}
            color="#800020"
          />
        </View>
      </View>
    );
  }

  // Шаг 3: граничные условия
  function Step3() {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{I18n.t("step3")}</Text>
        {BOUNDARY_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={styles.selectBtn}
            onPress={() => setBoundary(type)}
          >
            <Text style={{ color: boundary === type ? "#800020" : "#222" }}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.navBtns}>
          <Button title={I18n.t("back")} onPress={() => setStep(1)} />
          <Button
            title={I18n.t("next")}
            onPress={() => setStep(3)}
            color="#800020"
          />
        </View>
      </View>
    );
  }

  // Шаг 4: ввод данных (таблица)
  function Step4() {
    function updateRow(idx, field, value) {
      const newRows = [...dataRows];
      newRows[idx][field] = value;
      setDataRows(newRows);
    }
    function addRow() {
      setDataRows([...dataRows, { t: "", s: "" }]);
    }
    function removeRow(idx) {
      if (dataRows.length === 1) return;
      setDataRows(dataRows.filter((_, i) => i !== idx));
    }
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{I18n.t("step4")}</Text>
        <FlatList
          data={dataRows}
          keyExtractor={(_, idx) => idx.toString()}
          renderItem={({ item, index }) => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <TextInput
                style={styles.input}
                placeholder={I18n.t("time")}
                value={item.t}
                onChangeText={(v) => updateRow(index, "t", v)}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                placeholder={I18n.t("drawdown")}
                value={item.s}
                onChangeText={(v) => updateRow(index, "s", v)}
                keyboardType="numeric"
              />
              <TouchableOpacity onPress={() => removeRow(index)}>
                <Text style={{ fontSize: 20, color: "#b22222", marginLeft: 8 }}>
                  🗑️
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addRow}>
          <Text style={{ color: "#800020", fontSize: 16 }}>
            + {I18n.t("addRow")}
          </Text>
        </TouchableOpacity>
        <View style={styles.navBtns}>
          <Button title={I18n.t("back")} onPress={() => setStep(2)} />
          <Button
            title={I18n.t("next")}
            onPress={() => setStep(4)}
            color="#800020"
          />
        </View>
      </View>
    );
  }

  // Шаг 5: подтверждение и сохранение
  async function saveJournal() {
    if (!activeProject) {
      Alert.alert(I18n.t("noActiveProject"), I18n.t("selectProjectFirst"));
      return;
    }
    const journal = {
      testType,
      layerType,
      boundary,
      dataRows,
      date: Date.now(),
    };
    // Обновляем проект
    const projectsRaw = await AsyncStorage.getItem("pumping_projects");
    let projects = projectsRaw ? JSON.parse(projectsRaw) : [];
    projects = projects.map((p) =>
      p.id === activeProject.id
        ? { ...p, journals: [...(p.journals || []), journal] }
        : p
    );
    await AsyncStorage.setItem("pumping_projects", JSON.stringify(projects));
    Alert.alert(I18n.t("success"), I18n.t("journalSaved"));
    setStep(0);
    setDataRows([{ t: "", s: "" }]);
    loadActiveProject();
  }

  function Step5() {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{I18n.t("step5")}</Text>
        <Text>
          {I18n.t("testType")}: {testType}
        </Text>
        <Text>
          {I18n.t("layerType")}: {layerType}
        </Text>
        <Text>
          {I18n.t("boundaryConditions")}: {boundary}
        </Text>
        <Text>
          {I18n.t("dataTable")}: {dataRows.length} {I18n.t("rows")}
        </Text>
        <View style={styles.navBtns}>
          <Button title={I18n.t("back")} onPress={() => setStep(3)} />
          <Button
            title={I18n.t("save")}
            onPress={saveJournal}
            color="#800020"
          />
        </View>
      </View>
    );
  }

  return (
    <View key={locale} style={{ flex: 1, padding: 16 }}>
      {!activeProject && (
        <View
          style={{
            backgroundColor: "#ffeaea",
            padding: 10,
            borderRadius: 8,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: "#b22222", textAlign: "center" }}>
            {I18n.t("noActiveProject")}. {I18n.t("selectProjectFirst")}
          </Text>
        </View>
      )}
      {step === 0 && <Step1 />}
      {step === 1 && <Step2 />}
      {step === 2 && <Step3 />}
      {step === 3 && <Step4 />}
      {step === 4 && <Step5 />}
    </View>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
    justifyContent: "center",
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#800020",
    textAlign: "center",
  },
  selectBtn: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  navBtns: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    width: 70,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  addBtn: {
    alignSelf: "center",
    marginVertical: 10,
  },
});
