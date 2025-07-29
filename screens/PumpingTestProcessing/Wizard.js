import React, { useState, useEffect, useCallback, useContext, memo } from "react";
import {
  View,
  Text,
  Button,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Alert,
  Modal,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import { LanguageContext } from "../../LanguageContext";
import DateTimePicker from "@react-native-community/datetimepicker";

// Добавляем типы зависимостей
const DATA_TYPES = [
  { key: "s-t", label: "s-t" },
  { key: "s1s2-t", label: "s1, s2-t" },
  { key: "s-r", label: "s-r" },
];

// Функции преобразования координат
function generateRowId() {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

export default function Wizard() {
  const { locale } = useContext(LanguageContext);

  // Перемещаем массивы внутрь компонента для обновления при смене языка
  const TEST_TYPES = [
    I18n.t("pumpingTest"),
    I18n.t("slugTest"),
    I18n.t("packerTest"),
  ];
  const LAYER_TYPES = [
    I18n.t("confined"),
    I18n.t("unconfined"),
    I18n.t("leaky"),
  ];
  const BOUNDARY_TYPES = [
    I18n.t("infinite"),
    I18n.t("constantHead"),
    I18n.t("noFlow"),
  ];

  const [step, setStep] = useState(0);
  const [testType, setTestType] = useState(TEST_TYPES[0]);
  const [layerType, setLayerType] = useState(LAYER_TYPES[0]);
  const [boundary, setBoundary] = useState(BOUNDARY_TYPES[0]);
  const [dataRows, setDataRows] = useState([
    { id: generateRowId(), t: "", s: "", datetime: new Date().toISOString() },
  ]);
  const [activeProject, setActiveProject] = useState(null);
  const [showDatePickerIdx, setShowDatePickerIdx] = useState(null);
  const [pickerValue, setPickerValue] = useState(new Date());
  const [pickerTempValue, setPickerTempValue] = useState(new Date());
  const [dataType, setDataType] = useState("s-t");

  // Обновляем состояния при смене языка
  useEffect(() => {
    setTestType(TEST_TYPES[0]);
    setLayerType(LAYER_TYPES[0]);
    setBoundary(BOUNDARY_TYPES[0]);
  }, [locale]);

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
    const updateRow = useCallback((idx, field, value) => {
      setDataRows((prevRows) =>
        prevRows.map((row, i) =>
          i === idx ? { ...row, [field]: value } : row
        )
      );
    }, []);
    
    const addRow = useCallback(() => {
      let row;
      if (dataType === "s-t") {
        row = { id: generateRowId(), t: "", s: "", datetime: new Date().toISOString() };
      } else if (dataType === "s1s2-t") {
        row = { id: generateRowId(), t: "", s1: "", s2: "", datetime: new Date().toISOString() };
      } else if (dataType === "s-r") {
        row = { id: generateRowId(), s: "", r: "", datetime: new Date().toISOString() };
      }
      setDataRows((prevRows) => [...prevRows, row]);
    }, [dataType]);
    
    const removeRow = useCallback((idx) => {
      setDataRows((prevRows) => {
        if (prevRows.length === 1) return prevRows;
        return prevRows.filter((_, i) => i !== idx);
      });
    }, []);
    
    const openDatePicker = useCallback((index) => {
      const row = dataRows[index];
      const d = row.datetime ? new Date(row.datetime) : new Date();
      setPickerValue(d);
      setPickerTempValue(d);
      setShowDatePickerIdx(index);
    }, [dataRows]);
    function onDateChange(event, selectedDate) {
      if (selectedDate) {
        setPickerTempValue(selectedDate);
      }
    }
    function onDatePickerOk() {
      if (showDatePickerIdx === null) return;
      const idx = showDatePickerIdx;
      setDataRows((prevRows) => {
        const newRows = [...prevRows];
        newRows[idx]["datetime"] = pickerTempValue.toISOString();
        return newRows;
      });
      setShowDatePickerIdx(null);
    }
    function onDatePickerCancel() {
      setShowDatePickerIdx(null);
    }
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{I18n.t("step4")}</Text>
        {/* Выбор типа данных */}
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          {DATA_TYPES.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={{
                padding: 8,
                borderWidth: 1,
                borderColor: dataType === type.key ? "#800020" : "#ccc",
                borderRadius: 8,
                marginRight: 8,
                backgroundColor: dataType === type.key ? "#800020" : "#fff",
              }}
              onPress={() => {
                setDataType(type.key);
                // Сбросить строки под новый тип
                if (type.key === "s-t") {
                  setDataRows([
                    { id: generateRowId(), t: "", s: "", datetime: new Date().toISOString() },
                  ]);
                } else if (type.key === "s1s2-t") {
                  setDataRows([
                    {
                      id: generateRowId(),
                      t: "",
                      s1: "",
                      s2: "",
                      datetime: new Date().toISOString(),
                    },
                  ]);
                } else if (type.key === "s-r") {
                  setDataRows([
                    { id: generateRowId(), s: "", r: "", datetime: new Date().toISOString() },
                  ]);
                }
              }}
            >
              <Text
                style={{ color: dataType === type.key ? "#fff" : "#800020" }}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          data={dataRows}
          keyExtractor={(item) => item.id}
          extraData={dataRows}
          removeClippedSubviews={false}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={100}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <View
              style={{
                flexDirection: "column",
                marginBottom: 12,
                padding: 8,
                backgroundColor: "#f9f9f9",
                borderRadius: 8,
              }}
            >
              {/* Для каждого типа — свои поля */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                {dataType === "s-t" && (
                  <>
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
                  </>
                )}
                {dataType === "s1s2-t" && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder={I18n.t("time")}
                      value={item.t}
                      onChangeText={(v) => updateRow(index, "t", v)}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="s1"
                      value={item.s1}
                      onChangeText={(v) => updateRow(index, "s1", v)}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="s2"
                      value={item.s2}
                      onChangeText={(v) => updateRow(index, "s2", v)}
                      keyboardType="numeric"
                    />
                  </>
                )}
                {dataType === "s-r" && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="s"
                      value={item.s}
                      onChangeText={(v) => updateRow(index, "s", v)}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="r"
                      value={item.r}
                      onChangeText={(v) => updateRow(index, "r", v)}
                      keyboardType="numeric"
                    />
                  </>
                )}
              </View>

              {/* Вторая строка с датой и кнопкой удаления */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 8,
                    backgroundColor: "#fff",
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: "#ddd",
                  }}
                  onPress={() => openDatePicker(index)}
                >
                  <Text
                    style={{ color: "#800020", fontSize: 18, marginRight: 8 }}
                  >
                    🕒
                  </Text>
                  <Text style={{ fontSize: 12, color: "#333" }}>
                    {item.datetime
                      ? new Date(item.datetime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        }) +
                        " " +
                        new Date(item.datetime).toLocaleDateString()
                      : I18n.t("selectDateTime")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeRow(index)}
                  style={{
                    backgroundColor: "#ffebee",
                    borderRadius: 20,
                    width: 40,
                    height: 40,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 18, color: "#b22222" }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
        {/* Модальное окно для выбора даты и времени */}
        {Platform.OS === "android" ? (
          showDatePickerIdx !== null && (
            <DateTimePicker
              value={pickerTempValue}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                if (event.type === "set" && selectedDate) {
                  const idx = showDatePickerIdx;
                  setDataRows((prevRows) => {
                    const newRows = [...prevRows];
                    newRows[idx]["datetime"] = selectedDate.toISOString();
                    return newRows;
                  });
                }
                setShowDatePickerIdx(null);
              }}
            />
          )
        ) : (
          <Modal
            visible={showDatePickerIdx !== null}
            transparent
            animationType="fade"
            onRequestClose={onDatePickerCancel}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0,0,0,0.3)",
              }}
            >
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 20,
                  width: 300,
                  alignItems: "center",
                }}
              >
                <DateTimePicker
                  value={pickerTempValue}
                  mode="datetime"
                  display="spinner"
                  onChange={onDateChange}
                  style={{ width: 260 }}
                />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    width: "100%",
                    marginTop: 16,
                  }}
                >
                  <TouchableOpacity
                    onPress={onDatePickerCancel}
                    style={{ flex: 1, alignItems: "center" }}
                  >
                    <Text
                      style={{
                        color: "#b22222",
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      Отмена
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onDatePickerOk}
                    style={{ flex: 1, alignItems: "center" }}
                  >
                    <Text
                      style={{
                        color: "#800020",
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      OK
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
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
      dataType, // сохраняем тип данных
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
    setDataRows([{ id: generateRowId(), t: "", s: "", datetime: new Date().toISOString() }]);
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
    width: 80,
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: "#fff",
    minWidth: 80,
  },
  addBtn: {
    alignSelf: "center",
    marginVertical: 10,
  },
});
