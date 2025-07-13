import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Line, Circle, G, Text as SvgText, Rect } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import LanguageContext from "../../LanguageContext";
import { TextInput } from "react-native-paper";
import Slider from "@react-native-community/slider";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 32;
const CHART_HEIGHT = 300;
const CHART_PADDING = 60;

// Функции преобразования координат
const FUNCTIONS = {
  // s-t
  "s-t": {
    name: "s-t",
    xTransform: (t) => t,
    yTransform: (s) => s,
    xLabel: "t",
    yLabel: "s",
    xUnit: I18n.t("unitMinutes"),
    yUnit: I18n.t("unitMeters"),
    type: "s-t",
  },
  "s-√t": {
    name: "s-√t",
    xTransform: (t) => Math.sqrt(t),
    yTransform: (s) => s,
    xLabel: "√t",
    yLabel: "s",
    xUnit: I18n.t("unitMinutesSqrt"),
    yUnit: I18n.t("unitMeters"),
    type: "s-t",
  },
  "lg(s)-lg(t)": {
    name: "lg(s)-lg(t)",
    xTransform: (t) => Math.log10(t),
    yTransform: (s) => Math.log10(s),
    xLabel: "lg(t)",
    yLabel: "lg(s)",
    xUnit: I18n.t("unitLogMinutes"),
    yUnit: I18n.t("unitLogMeters"),
    type: "s-t",
  },
  "s-lg(t)": {
    name: "s-log(t)",
    xTransform: (t) => Math.log10(t),
    yTransform: (s) => s,
    xLabel: "lg(t)",
    yLabel: "s",
    xUnit: "",
    yUnit: I18n.t("unitMeters"),
    type: "s-t",
  },
  "1/s-t": {
    name: "1/s-t",
    xTransform: (t) => t,
    yTransform: (s) => 1 / s,
    xLabel: "t",
    yLabel: "1/s",
    xUnit: I18n.t("unitMinutes"),
    yUnit: I18n.t("unitPerMeter"),
    type: "s-t",
  },
  "s-t^n": {
    name: "s-t^n",
    xTransform: (t, n) => Math.pow(t, n),
    yTransform: (s) => s,
    xLabel: "t",
    yLabel: "s",
    xUnit: I18n.t("unitMinutesPowerN"),
    yUnit: I18n.t("unitMeters"),
    type: "s-t",
    needsN: true,
  },
  "s-lg(t/r^2)": {
    name: "s-lg(t/r^2)",
    xTransform: (t, r) => Math.log10(t / Math.pow(r, 2)),
    yTransform: (s) => s,
    xLabel: "lg(t/r^2)",
    yLabel: "s",
    xUnit: I18n.t("unitLogMinutesPerMeterSquared"),
    yUnit: I18n.t("unitMeters"),
    type: "s-t",
    needsR: true,
  },
  // s1,s2-t
  "(s1/s2)-t": {
    name: "(s1/s2)-t",
    xTransform: (t) => t,
    yTransform: (s1, s2) => (s2 !== 0 ? s1 / s2 : null),
    xLabel: "t",
    yLabel: "s1/s2",
    xUnit: I18n.t("unitMinutes"),
    yUnit: I18n.t("unitDimensionless"),
    type: "s1s2-t",
  },
  "(s1-s2)-t": {
    name: "(s1-s2)-t",
    xTransform: (t) => t,
    yTransform: (s1, s2) => s1 - s2,
    xLabel: "t",
    yLabel: "s1-s2",
    xUnit: I18n.t("unitMinutes"),
    yUnit: I18n.t("unitMeters"),
    type: "s1s2-t",
  },
  // s-r
  "lg(s)-lg(r)": {
    name: "lg(s)-lg(r)",
    xTransform: (r) => Math.log10(r),
    yTransform: (s) => Math.log10(s),
    xLabel: "lg(r)",
    yLabel: "lg(s)",
    xUnit: I18n.t("unitLogMeters"),
    yUnit: I18n.t("unitLogMeters"),
    type: "s-r",
  },
  "s-√r": {
    name: "s-√r",
    xTransform: (r) => Math.sqrt(r),
    yTransform: (s) => s,
    xLabel: "√r",
    yLabel: "s",
    xUnit: I18n.t("unitMetersSqrt"),
    yUnit: I18n.t("unitMeters"),
    type: "s-r",
  },
  "1/s-r": {
    name: "1/s-r",
    xTransform: (r) => r,
    yTransform: (s) => 1 / s,
    xLabel: "r",
    yLabel: "1/s",
    xUnit: I18n.t("unitMeters"),
    yUnit: I18n.t("unitPerMeter"),
    type: "s-r",
  },
  "s-r^n": {
    name: "s-r^n",
    xTransform: (r, n) => Math.pow(r, n),
    yTransform: (s) => s,
    xLabel: "r^n",
    yLabel: "s",
    xUnit: I18n.t("unitMetersPowerN"),
    yUnit: I18n.t("unitMeters"),
    type: "s-r",
    needsN: true,
  },
};

// Единицы измерения
const UNITS = {
  time: [I18n.t("minutes"), I18n.t("seconds"), I18n.t("hours")],
  distance: [I18n.t("meters"), I18n.t("centimeters"), I18n.t("millimeters")],
};

// Добавим функции пересчета единиц
const TIME_FACTORS = {
  [I18n.t("minutes")]: 1,
  [I18n.t("seconds")]: 1 / 60,
  [I18n.t("hours")]: 60,
};
const DIST_FACTORS = {
  [I18n.t("meters")]: 1,
  [I18n.t("centimeters")]: 0.01,
  [I18n.t("millimeters")]: 0.001,
};

export default function DataProcessing() {
  // Все хуки только здесь, до любого return и вычислений!
  const [activeProject, setActiveProject] = useState(null);
  const [journals, setJournals] = useState([]);
  const [selectedJournalIdx, setSelectedJournalIdx] = useState(0);
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [selectedFunction, setSelectedFunction] = useState("s-t");
  const [units, setUnits] = useState({
    time: I18n.t("minutes"),
    distance: I18n.t("meters"),
  });
  const [zoom, setZoom] = useState({ x: 1, y: 1 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [lineParams, setLineParams] = useState({ k: 0, b: 0 });
  const [isDraggingLine, setIsDraggingLine] = useState(false);
  const [n, setN] = useState(1);
  const [r, setR] = useState(1);
  const { locale } = useContext(LanguageContext);
  const chartRef = useRef();

  // Мемоизируем вычисления, которые зависят от состояния
  const journal = useMemo(
    () => journals[selectedJournalIdx],
    [journals, selectedJournalIdx]
  );
  const dataType = useMemo(() => journal?.dataType || "s-t", [journal]);
  const FUNCTION_KEYS = useMemo(
    () =>
      Object.keys(FUNCTIONS).filter((key) => FUNCTIONS[key].type === dataType),
    [dataType]
  );
  const func = useMemo(
    () =>
      FUNCTIONS[selectedFunction] ||
      FUNCTIONS[FUNCTION_KEYS[0]] ||
      FUNCTIONS["s-t"],
    [selectedFunction, FUNCTION_KEYS]
  );

  // Мемоизируем обработку точек для предотвращения пересчетов
  const points = useMemo(() => {
    let processedPoints = [];

    if (dataType === "s-t") {
      processedPoints = (journal?.dataRows || [])
        .filter((row) => row.t && row.s && !isNaN(row.t) && !isNaN(row.s))
        .map((row) => {
          const t = parseFloat(row.t);
          const s = parseFloat(row.s);
          let x, y;
          if (selectedFunction === "s-t^n") {
            x = func.xTransform(t, n);
            y = func.yTransform(s);
          } else if (selectedFunction === "s-lg(t/r^2)") {
            x = func.xTransform(t, r);
            y = func.yTransform(s);
          } else if (selectedFunction === "lg(s)-lg(t)") {
            if (t <= 0 || s <= 0) return null;
            x = func.xTransform(t);
            y = func.yTransform(s);
          } else {
            x = func.xTransform(t);
            y = func.yTransform(s);
          }
          return { t, s, x, y };
        })
        .filter(
          (row) => row && row.t > 0 && isFinite(row.x) && isFinite(row.y)
        );
    } else if (dataType === "s1s2-t") {
      processedPoints = (journal?.dataRows || [])
        .filter(
          (row) =>
            row.t &&
            row.s1 &&
            row.s2 &&
            !isNaN(row.t) &&
            !isNaN(row.s1) &&
            !isNaN(row.s2)
        )
        .map((row) => {
          const t = parseFloat(row.t);
          const s1 = parseFloat(row.s1);
          const s2 = parseFloat(row.s2);
          let x, y;
          if (selectedFunction === "(s1/s2)-t") {
            if (s2 === 0) return null;
            x = func.xTransform(t);
            y = func.yTransform(s1, s2);
          } else if (selectedFunction === "(s1-s2)-t") {
            x = func.xTransform(t);
            y = func.yTransform(s1, s2);
          } else {
            return null;
          }
          return { t, s1, s2, x, y };
        })
        .filter((row) => row && isFinite(row.x) && isFinite(row.y));
    } else if (dataType === "s-r") {
      processedPoints = (journal?.dataRows || [])
        .filter((row) => row.s && row.r && !isNaN(row.s) && !isNaN(row.r))
        .map((row) => {
          const s = parseFloat(row.s);
          const rVal = parseFloat(row.r);
          let x, y;
          if (selectedFunction === "s-r^n") {
            x = func.xTransform(rVal, n);
            y = func.yTransform(s);
          } else if (selectedFunction === "lg(s)-lg(r)") {
            if (s <= 0 || rVal <= 0) return null;
            x = func.xTransform(rVal);
            y = func.yTransform(s);
          } else {
            x = func.xTransform(rVal);
            y = func.yTransform(s);
          }
          return { s, r: rVal, x, y };
        })
        .filter((row) => row && isFinite(row.x) && isFinite(row.y));
    }

    // Ограничиваем количество точек для предотвращения переполнения памяти
    const MAX_POINTS = 1000;
    if (processedPoints.length > MAX_POINTS) {
      processedPoints = processedPoints.slice(0, MAX_POINTS);
    }

    return processedPoints;
  }, [journal?.dataRows, dataType, selectedFunction, func, n, r]);

  // Мемоизируем вычисления границ графика
  const chartBounds = useMemo(() => {
    if (points.length === 0) return null;

    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxY = Math.max(...points.map((p) => p.y));

    const xRange = maxX - minX;
    const yRange = maxY - minY;

    const chartMinX = minX - xRange * 0.1 + pan.x;
    const chartMaxX = maxX + xRange * 0.1 + pan.x;
    const chartMinY = minY - yRange * 0.1 + pan.y;
    const chartMaxY = maxY + yRange * 0.1 + pan.y;

    // Применяем зум
    const zoomedMinX = chartMinX + ((chartMaxX - chartMinX) * (1 - zoom.x)) / 2;
    const zoomedMaxX = chartMaxX - ((chartMaxX - chartMinX) * (1 - zoom.x)) / 2;
    const zoomedMinY = chartMinY + ((chartMaxY - chartMinY) * (1 - zoom.y)) / 2;
    const zoomedMaxY = chartMaxY - ((chartMaxY - chartMinY) * (1 - zoom.y)) / 2;

    return {
      zoomedMinX,
      zoomedMaxX,
      zoomedMinY,
      zoomedMaxY,
    };
  }, [points, pan.x, pan.y, zoom.x, zoom.y]);

  // Мемоизируем функцию для преобразования координат в пиксели
  const getXY = useMemo(() => {
    return (x, y) => {
      if (!chartBounds) return { x: 0, y: 0 };
      const pixelX =
        ((x - chartBounds.zoomedMinX) /
          (chartBounds.zoomedMaxX - chartBounds.zoomedMinX)) *
          (CHART_WIDTH - 2 * CHART_PADDING) +
        CHART_PADDING;
      const pixelY =
        CHART_HEIGHT -
        CHART_PADDING -
        ((y - chartBounds.zoomedMinY) /
          (chartBounds.zoomedMaxY - chartBounds.zoomedMinY)) *
          (CHART_HEIGHT - 2 * CHART_PADDING);
      return { x: pixelX, y: pixelY };
    };
  }, [chartBounds]);

  // --- вычисления, которые должны быть внутри компонента ---
  React.useEffect(() => {
    if (!FUNCTION_KEYS.includes(selectedFunction)) {
      setSelectedFunction(FUNCTION_KEYS[0] || "s-t");
    }
    // eslint-disable-next-line
  }, [dataType, FUNCTION_KEYS, selectedFunction]);
  // --- конец вычислений ---

  useFocusEffect(
    React.useCallback(() => {
      loadActiveProject();
    }, [])
  );

  useEffect(() => {
    if (selectedPoints.length === 2) {
      const idx1 = selectedPoints[0];
      const idx2 = selectedPoints[1];
      const journal = journals[selectedJournalIdx];
      const func = FUNCTIONS[selectedFunction];
      const points = (journal?.dataRows || [])
        .filter((row) => row.t && row.s && !isNaN(row.t) && !isNaN(row.s))
        .map((row) => ({
          t: parseFloat(row.t),
          s: parseFloat(row.s),
          x: func.xTransform(parseFloat(row.t)),
          y: func.yTransform(parseFloat(row.s)),
        }))
        .filter((row) => row.t > 0 && isFinite(row.x) && isFinite(row.y));
      const p1 = points[idx1];
      const p2 = points[idx2];
      if (p1 && p2) {
        const k = (p2.y - p1.y) / (p2.x - p1.x || 1e-6);
        const b = p1.y - k * p1.x;
        setLineParams({ k, b });
      }
    }
    // eslint-disable-next-line
  }, [selectedPoints, journals, selectedJournalIdx, selectedFunction]);

  // Если selectedFunction невалиден, сбрасываем на первый ключ
  useEffect(() => {
    if (!FUNCTIONS[selectedFunction]) {
      setSelectedFunction(FUNCTION_KEYS[0]);
    }
    // eslint-disable-next-line
  }, [selectedFunction]);

  async function loadActiveProject() {
    try {
      const id = await AsyncStorage.getItem("pumping_active_project_id");
      if (!id) {
        setActiveProject(null);
        setJournals([]);
        return;
      }
      const projectsRaw = await AsyncStorage.getItem("pumping_projects");
      if (!projectsRaw) return;
      const projects = JSON.parse(projectsRaw);
      const project = projects.find((p) => p.id === id);
      setActiveProject(project || null);
      setJournals(project && project.journals ? project.journals : []);
      setSelectedJournalIdx(0);
      setSelectedPoints([]);
    } catch (error) {
      console.error("Error loading active project:", error);
      setActiveProject(null);
      setJournals([]);
    }
  }

  async function deleteJournal(journalIndex) {
    Alert.alert(
      I18n.t("deleteJournal"),
      I18n.t("deleteJournalConfirm", {
        name: journals[journalIndex]?.testType,
      }),
      [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const updatedJournals = journals.filter(
                (_, idx) => idx !== journalIndex
              );
              const updatedProject = {
                ...activeProject,
                journals: updatedJournals,
              };
              const projectsRaw = await AsyncStorage.getItem(
                "pumping_projects"
              );
              const projects = JSON.parse(projectsRaw);
              const projectIndex = projects.findIndex(
                (p) => p.id === activeProject.id
              );
              projects[projectIndex] = updatedProject;
              await AsyncStorage.setItem(
                "pumping_projects",
                JSON.stringify(projects)
              );
              setActiveProject(updatedProject);
              setJournals(updatedJournals);
              if (updatedJournals.length === 0) {
                setSelectedJournalIdx(0);
              } else if (selectedJournalIdx >= updatedJournals.length) {
                setSelectedJournalIdx(updatedJournals.length - 1);
              }
              setSelectedPoints([]);
              Alert.alert(I18n.t("success"), I18n.t("journalDeleted"));
            } catch (error) {
              Alert.alert(I18n.t("error"), I18n.t("exportError"));
            }
          },
        },
      ]
    );
  }

  // Проверка на наличие активного проекта
  if (!activeProject) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{
            color: "#b22222",
            fontSize: 16,
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {I18n.t("noActiveProject")}
        </Text>
        <Text style={{ color: "#666", textAlign: "center" }}>
          {I18n.t("selectProjectFirst")}
        </Text>
      </View>
    );
  }

  // Проверка на наличие журналов
  if (!journals || journals.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text
          style={{
            color: "#b22222",
            fontSize: 16,
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {I18n.t("noJournals")}
        </Text>
        <Text style={{ color: "#666", textAlign: "center" }}>
          {I18n.t("createJournalInWizard")}
        </Text>
      </View>
    );
  }

  if (!func) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#b22222" }}>{I18n.t("functionNotFound")}</Text>
      </View>
    );
  }
  const timeFactor =
    TIME_FACTORS[journal?.units?.time || I18n.t("minutes")] /
    TIME_FACTORS[units.time];
  const distFactor =
    DIST_FACTORS[journal?.units?.distance || I18n.t("meters")] /
    DIST_FACTORS[units.distance];

  if (points.length === 0) {
    return (
      <View style={styles.center}>
        <Text>{I18n.t("noValidDataForChart")}</Text>
      </View>
    );
  }

  if (!chartBounds) {
    return (
      <View style={styles.center}>
        <Text>{I18n.t("noValidDataForChart")}</Text>
      </View>
    );
  }

  const { zoomedMinX, zoomedMaxX, zoomedMinY, zoomedMaxY } = chartBounds;

  // Обработка перетаскивания линии
  const handleLineDrag = (event) => {
    // Упрощенная логика - просто отмечаем, что линия была изменена
    setIsDraggingLine(true);
  };

  let result = null;
  if (selectedPoints.length === 2) {
    const idx1 = selectedPoints[0];
    const idx2 = selectedPoints[1];
    const p1 = points[idx1];
    const p2 = points[idx2];
    if (p1 && p2) {
      const k = (p2.y - p1.y) / (p2.x - p1.x || 1e-6);
      const b = p1.y - k * p1.x;
      result = { k, b, x1: p1.x, x2: p2.x, y1: p1.y, y2: p2.y };
    }
  }

  // Генерация делений осей
  const xTicks = [];
  const yTicks = [];
  const tickCount = 5;

  for (let i = 0; i <= tickCount; i++) {
    const x = zoomedMinX + (zoomedMaxX - zoomedMinX) * (i / tickCount);
    const y = zoomedMinY + (zoomedMaxY - zoomedMinY) * (i / tickCount);
    xTicks.push(x);
    yTicks.push(y);
  }

  // Кнопки управления линией
  // Центр графика для пересчета b при изменении наклона
  const centerX = (zoomedMinX + zoomedMaxX) / 2;
  const centerY = (zoomedMinY + zoomedMaxY) / 2;

  // Универсальные обработчики для всех функций
  function handleSlopeChange(delta) {
    setLineParams((prev) => ({ ...prev, k: prev.k + delta }));
    setIsDraggingLine(true);
  }
  function handleShiftY(delta) {
    setLineParams((prev) => ({ ...prev, b: prev.b + delta }));
    setIsDraggingLine(true);
  }
  function handleSliderK(val) {
    setLineParams((prev) => ({ ...prev, k: val }));
    setIsDraggingLine(true);
  }
  function handleSliderB(val) {
    setLineParams((prev) => ({ ...prev, b: val }));
    setIsDraggingLine(true);
  }
  function handleInputK(val) {
    let v = parseFloat(val.replace(",", "."));
    if (isNaN(v)) v = 0;
    setLineParams((prev) => ({ ...prev, k: v }));
    setIsDraggingLine(true);
  }
  function handleInputB(val) {
    let v = parseFloat(val.replace(",", "."));
    if (isNaN(v)) v = 0;
    setLineParams((prev) => ({ ...prev, b: v }));
    setIsDraggingLine(true);
  }

  // Формулы для разных функций
  const FORMULAS = {
    "s-lg(t)": "s = k·lg(t) + b",
    "s-t": "s = k·t + b",
    "s-√t": "s = k·√t + b",
    "1/s-t": "1/s = k·t + b",
    "lg(s)-lg(t)": "lg(s) = k·lg(t) + b",
    "s-t^n": `s = k·t^n + b, n = ${n}`,
    "s-lg(t/r^2)": `s = k·lg(t/r^2)+b, r = ${r}`,
  };

  async function saveChartToGallery() {
    try {
      const uri = await captureRef(chartRef, {
        format: "png",
        quality: 1,
      });
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(I18n.t("error"), I18n.t("noGalleryAccess"));
        return;
      }
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync("Ansdimat", asset, false);
      Alert.alert(I18n.t("success"), I18n.t("chartSavedSuccess"));
    } catch (e) {
      Alert.alert(I18n.t("error"), I18n.t("chartSaveError"));
    }
  }

  return (
    <ScrollView
      key={locale}
      style={{ flex: 1, padding: 16, paddingBottom: 100 }}
    >
      <Text style={styles.title}>{I18n.t("processingTitle")}</Text>

      {/* Выбор функции */}
      <View style={styles.controlSection}>
        <Text style={styles.sectionTitle}>{I18n.t("function")}:</Text>
        <FlatList
          horizontal
          data={FUNCTION_KEYS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.functionBtn,
                selectedFunction === item && styles.functionBtnActive,
              ]}
              onPress={() => setSelectedFunction(item)}
            >
              <Text
                style={{
                  color: selectedFunction === item ? "#fff" : "#800020",
                }}
              >
                {FUNCTIONS[item].name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Выбор единиц измерения */}
      <View style={styles.controlSection}>
        <Text style={styles.sectionTitle}>{I18n.t("units")}:</Text>
        <View style={styles.unitsRow}>
          <Text>{I18n.t("time")}: </Text>
          <FlatList
            horizontal
            data={UNITS.time}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.unitBtn,
                  units.time === item && styles.unitBtnActive,
                ]}
                onPress={() => setUnits({ ...units, time: item })}
              >
                <Text
                  style={{
                    color: units.time === item ? "#fff" : "#800020",
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
        <View style={styles.unitsRow}>
          <Text>{I18n.t("distance")}: </Text>
          <FlatList
            horizontal
            data={UNITS.distance}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.unitBtn,
                  units.distance === item && styles.unitBtnActive,
                ]}
                onPress={() => setUnits({ ...units, distance: item })}
              >
                <Text
                  style={{
                    color: units.distance === item ? "#fff" : "#800020",
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      {/* Управление масштабом */}
      <View style={styles.controlSection}>
        <Text style={styles.sectionTitle}>{I18n.t("scale")}:</Text>
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom({ x: zoom.x * 1.2, y: zoom.y * 1.2 })}
          >
            <Text>🔍+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom({ x: zoom.x / 1.2, y: zoom.y / 1.2 })}
          >
            <Text>🔍-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => {
              setZoom({ x: 1, y: 1 });
              setPan({ x: 0, y: 0 });
            }}
          >
            <Text>🏠</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ marginBottom: 8 }}>
        {I18n.t("project")}:{" "}
        <Text style={{ fontWeight: "bold" }}>{activeProject.name}</Text>
      </Text>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}
      >
        <Text style={{ marginRight: 8 }}>{I18n.t("journal")}:</Text>
        <FlatList
          horizontal
          data={journals}
          keyExtractor={(_, idx) => idx.toString()}
          contentContainerStyle={{ flexDirection: "row", alignItems: "center" }}
          renderItem={({ item, index }) => (
            <View style={styles.journalContainer}>
              <TouchableOpacity
                style={[
                  styles.journalBtn,
                  index === selectedJournalIdx && styles.journalBtnActive,
                ]}
                onPress={() => {
                  setSelectedJournalIdx(index);
                  setSelectedPoints([]);
                }}
              >
                <Text
                  style={{
                    color: index === selectedJournalIdx ? "#fff" : "#800020",
                  }}
                >
                  {item.testType} ({new Date(item.date).toLocaleDateString()})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteJournal(index)}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>

      {func.needsN && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text style={{ marginRight: 8 }}>n:</Text>
          <TouchableOpacity
            style={styles.unitBtn}
            onPress={() => setN(Math.max(0.01, n - 0.1))}
          >
            <Text>-</Text>
          </TouchableOpacity>
          <TextInput
            value={n.toString()}
            onChangeText={(v) => {
              let val = parseFloat(v.replace(",", "."));
              if (isNaN(val) || val <= 0) val = 0.01;
              setN(val);
            }}
            keyboardType="numeric"
            style={{
              width: 50,
              height: 32,
              marginHorizontal: 8,
              backgroundColor: "#fff",
              textAlign: "center",
              paddingVertical: 0,
            }}
            dense
            mode="outlined"
          />
          <TouchableOpacity
            style={styles.unitBtn}
            onPress={() => setN(n + 0.1)}
          >
            <Text>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {func.needsR && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text style={{ marginRight: 8 }}>r:</Text>
          <TouchableOpacity
            style={styles.unitBtn}
            onPress={() => setR(Math.max(0.01, r - 0.1))}
          >
            <Text>-</Text>
          </TouchableOpacity>
          <TextInput
            value={r.toString()}
            onChangeText={(v) => {
              let val = parseFloat(v.replace(",", "."));
              if (isNaN(val) || val <= 0) val = 0.01;
              setR(val);
            }}
            keyboardType="numeric"
            style={{
              width: 50,
              height: 32,
              marginHorizontal: 8,
              backgroundColor: "#fff",
              textAlign: "center",
              paddingVertical: 0,
            }}
            dense
            mode="outlined"
          />
          <TouchableOpacity
            style={styles.unitBtn}
            onPress={() => setR(r + 0.1)}
          >
            <Text>+</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontWeight: "bold", color: "#800020", marginBottom: 4 }}>
          Наклон (k):
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <TouchableOpacity
            style={styles.lineBtn}
            onPress={() => handleSlopeChange(-0.1)}
          >
            <Text>-</Text>
          </TouchableOpacity>
          <Slider
            style={{ flex: 1, marginHorizontal: 8 }}
            minimumValue={-10}
            maximumValue={10}
            value={lineParams.k}
            onValueChange={handleSliderK}
            step={0.01}
          />
          <TouchableOpacity
            style={styles.lineBtn}
            onPress={() => handleSlopeChange(+0.1)}
          >
            <Text>+</Text>
          </TouchableOpacity>
          <TextInput
            value={lineParams.k.toString()}
            onChangeText={handleInputK}
            keyboardType="numeric"
            style={{
              width: 60,
              height: 32,
              marginLeft: 8,
              backgroundColor: "#fff",
              textAlign: "center",
              paddingVertical: 0,
            }}
            dense
            mode="outlined"
          />
        </View>
      </View>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontWeight: "bold", color: "#800020", marginBottom: 4 }}>
          Сдвиг (b):
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <TouchableOpacity
            style={styles.lineBtn}
            onPress={() => handleShiftY(-0.1)}
          >
            <Text>-</Text>
          </TouchableOpacity>
          <Slider
            style={{ flex: 1, marginHorizontal: 8 }}
            minimumValue={-100}
            maximumValue={100}
            value={lineParams.b}
            onValueChange={handleSliderB}
            step={0.01}
          />
          <TouchableOpacity
            style={styles.lineBtn}
            onPress={() => handleShiftY(+0.1)}
          >
            <Text>+</Text>
          </TouchableOpacity>
          <TextInput
            value={lineParams.b.toString()}
            onChangeText={handleInputB}
            keyboardType="numeric"
            style={{
              width: 60,
              height: 32,
              marginLeft: 8,
              backgroundColor: "#fff",
              textAlign: "center",
              paddingVertical: 0,
            }}
            dense
            mode="outlined"
          />
        </View>
      </View>

      <View style={{ alignItems: "center", marginVertical: 16 }}>
        <View ref={chartRef} collapsable={false}>
          <Svg
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            style={{ backgroundColor: "#f9f9f9", borderRadius: 12 }}
          >
            {/* Сетка */}
            {xTicks.map((x, i) => {
              const pixelX = getXY(x, zoomedMinY).x;
              return (
                <Line
                  key={`x-grid-${i}`}
                  x1={pixelX}
                  y1={CHART_PADDING}
                  x2={pixelX}
                  y2={CHART_HEIGHT - CHART_PADDING}
                  stroke="#e0e0e0"
                  strokeWidth={1}
                />
              );
            })}
            {yTicks.map((y, i) => {
              const pixelY = getXY(zoomedMinX, y).y;
              return (
                <Line
                  key={`y-grid-${i}`}
                  x1={CHART_PADDING}
                  y1={pixelY}
                  x2={CHART_WIDTH - CHART_PADDING}
                  y2={pixelY}
                  stroke="#e0e0e0"
                  strokeWidth={1}
                />
              );
            })}

            {/* Оси */}
            <Line
              x1={CHART_PADDING}
              y1={CHART_HEIGHT - CHART_PADDING}
              x2={CHART_WIDTH - CHART_PADDING}
              y2={CHART_HEIGHT - CHART_PADDING}
              stroke="#888"
              strokeWidth={2}
            />
            <Line
              x1={CHART_PADDING}
              y1={CHART_HEIGHT - CHART_PADDING}
              x2={CHART_PADDING}
              y2={CHART_PADDING}
              stroke="#888"
              strokeWidth={2}
            />

            {/* Подписи осей */}
            <SvgText
              x={CHART_WIDTH / 2}
              y={CHART_HEIGHT - CHART_PADDING + 36}
              fontSize="13"
              fill="#333"
              textAnchor="middle"
            >
              {func.xLabel} ({func.xUnit})
            </SvgText>
            <SvgText
              x={CHART_PADDING - 38}
              y={CHART_HEIGHT / 2}
              fontSize="13"
              fill="#333"
              textAnchor="middle"
              transform={`rotate(-90, ${CHART_PADDING - 38}, ${
                CHART_HEIGHT / 2
              })`}
            >
              {func.yLabel} ({func.yUnit})
            </SvgText>

            {/* Деления осей */}
            {xTicks.map((x, i) => {
              const pixelX = getXY(x, zoomedMinY).x;
              return (
                <G key={`x-tick-${i}`}>
                  <Line
                    x1={pixelX}
                    y1={CHART_HEIGHT - CHART_PADDING}
                    x2={pixelX}
                    y2={CHART_HEIGHT - CHART_PADDING + 5}
                    stroke="#333"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={pixelX}
                    y={CHART_HEIGHT - CHART_PADDING + 15}
                    fontSize="10"
                    fill="#333"
                    textAnchor="middle"
                  >
                    {x.toFixed(2)}
                  </SvgText>
                </G>
              );
            })}
            {yTicks.map((y, i) => {
              const pixelY = getXY(zoomedMinX, y).y;
              return (
                <G key={`y-tick-${i}`}>
                  <Line
                    x1={CHART_PADDING}
                    y1={pixelY}
                    x2={CHART_PADDING - 5}
                    y2={pixelY}
                    stroke="#333"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={CHART_PADDING - 10}
                    y={pixelY + 3}
                    fontSize="10"
                    fill="#333"
                    textAnchor="end"
                  >
                    {y.toFixed(2)}
                  </SvgText>
                </G>
              );
            })}

            {/* Точки */}
            {points.map((p, idx) => {
              const { x, y } = getXY(p.x, p.y);
              const isSelected = selectedPoints.includes(idx);
              return (
                <G key={idx}>
                  <Circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 7 : 5}
                    fill={isSelected ? "#b22222" : "#800020"}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedPoints(
                          selectedPoints.filter((i) => i !== idx)
                        );
                      } else if (selectedPoints.length < 2) {
                        setSelectedPoints([...selectedPoints, idx]);
                      } else {
                        setSelectedPoints([idx]);
                      }
                    }}
                  />
                  <SvgText x={x + 6} y={y - 6} fontSize="10" fill="#333">
                    {idx + 1}
                  </SvgText>
                </G>
              );
            })}

            {/* Перетаскиваемая прямая */}
            <Line
              x1={CHART_PADDING}
              y1={getXY(zoomedMinX, lineParams.k * zoomedMinX + lineParams.b).y}
              x2={CHART_WIDTH - CHART_PADDING}
              y2={getXY(zoomedMaxX, lineParams.k * zoomedMaxX + lineParams.b).y}
              stroke="#b22222"
              strokeWidth={2}
              strokeDasharray={isDraggingLine ? "5,5" : "none"}
            />
          </Svg>
        </View>
        {(selectedPoints.length === 2 || isDraggingLine) && (
          <View style={styles.resultBox}>
            <Text style={{ fontWeight: "bold", color: "#800020" }}>
              {I18n.t("results")}:
            </Text>
            <Text>
              {I18n.t("slope")}: {lineParams.k.toFixed(4)}
            </Text>
            <Text>
              {I18n.t("intercept")}: {lineParams.b.toFixed(4)}
            </Text>
            <Text>{FORMULAS[selectedFunction]}</Text>
          </View>
        )}
        <TouchableOpacity
          style={{
            marginTop: 12,
            backgroundColor: "#800020",
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 20,
          }}
          onPress={saveChartToGallery}
        >
          <Text style={{ color: "#fff", fontWeight: "bold" }}>
            {I18n.t("saveChartToGallery")}
          </Text>
        </TouchableOpacity>
        <View
          style={{
            flexDirection: "column",
            gap: 8,
            marginVertical: 20,
            marginHorizontal: 20,
          }}
        >
          <Text style={{ color: "#800020", fontWeight: "bold" }}>
            {I18n.t("attentionNote")}
          </Text>
        </View>
      </View>

      <Text style={{ textAlign: "center", color: "#888", marginBottom: 100 }}>
        {I18n.t("selectTwoPoints")} {I18n.t("dragLine")}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#800020",
    marginBottom: 10,
    textAlign: "center",
  },
  controlSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#800020",
    marginBottom: 8,
  },
  functionBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  functionBtnActive: {
    backgroundColor: "#800020",
    borderColor: "#800020",
  },
  unitsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  unitBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff",
    marginRight: 6,
  },
  unitBtnActive: {
    backgroundColor: "#800020",
    borderColor: "#800020",
  },
  zoomControls: {
    flexDirection: "row",
    gap: 8,
  },
  zoomBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  lineControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  lineBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  journalContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
  },
  journalBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fff",
  },
  journalBtnActive: {
    backgroundColor: "#800020",
    borderColor: "#800020",
  },
  deleteBtn: {
    backgroundColor: "#ffebee",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#d32f2f",
  },
  resultBox: {
    backgroundColor: "#f3eaea",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 15,
    alignItems: "center",
  },
});
