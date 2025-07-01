import React, { useState, useEffect, useContext } from "react";
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
import Svg, { Line, Circle, G, Text as SvgText } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import I18n from "../../Localization";
import LanguageContext from "../../LanguageContext";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 32;
const CHART_HEIGHT = 260;

function log10(x) {
  return Math.log(x) / Math.LN10;
}

export default function DataProcessing() {
  const [activeProject, setActiveProject] = useState(null);
  const [journals, setJournals] = useState([]);
  const [selectedJournalIdx, setSelectedJournalIdx] = useState(0);
  const [selectedPoints, setSelectedPoints] = useState([]); // индексы выбранных точек
  const { locale } = useContext(LanguageContext);

  // Перезагружаем данные при фокусе на экране
  useFocusEffect(
    React.useCallback(() => {
      loadActiveProject();
    }, [])
  );

  async function loadActiveProject() {
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
  }

  async function deleteJournal(journalIndex) {
    Alert.alert(
      I18n.t("deleteJournal"),
      I18n.t("deleteJournalConfirm", { name: journals[journalIndex].testType }),
      [
        { text: I18n.t("cancel"), style: "cancel" },
        {
          text: I18n.t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              // Обновляем проект
              const updatedJournals = journals.filter(
                (_, idx) => idx !== journalIndex
              );
              const updatedProject = {
                ...activeProject,
                journals: updatedJournals,
              };

              // Сохраняем обновленный проект
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

              // Обновляем состояние
              setActiveProject(updatedProject);
              setJournals(updatedJournals);

              // Корректируем индекс выбранного журнала
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

  if (!activeProject) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#b22222" }}>{I18n.t("noActiveProject")}</Text>
      </View>
    );
  }
  if (!journals.length) {
    return (
      <View style={styles.center}>
        <Text>{I18n.t("noJournals")}</Text>
      </View>
    );
  }

  const journal = journals[selectedJournalIdx];
  // Преобразуем данные для графика
  const points = (journal.dataRows || [])
    .filter((row) => row.t && row.s && !isNaN(row.t) && !isNaN(row.s))
    .map((row) => ({ t: parseFloat(row.t), s: parseFloat(row.s) }))
    .filter((row) => row.t > 0);

  // Границы графика
  const minT = Math.min(...points.map((p) => p.t));
  const maxT = Math.max(...points.map((p) => p.t));
  const minS = Math.min(...points.map((p) => p.s));
  const maxS = Math.max(...points.map((p) => p.s));

  // Функция для преобразования координат в пиксели
  function getXY(t, s) {
    const x =
      ((log10(t) - log10(minT)) / (log10(maxT) - log10(minT) || 1)) *
        (CHART_WIDTH - 40) +
      30;
    const y =
      CHART_HEIGHT -
      30 -
      ((s - minS) / (maxS - minS || 1)) * (CHART_HEIGHT - 40);
    return { x, y };
  }

  // Если выбрано две точки — расчет наклона и пересечения
  let result = null;
  if (selectedPoints.length === 2) {
    const idx1 = selectedPoints[0];
    const idx2 = selectedPoints[1];
    const p1 = points[idx1];
    const p2 = points[idx2];
    if (p1 && p2) {
      const x1 = log10(p1.t);
      const x2 = log10(p2.t);
      const y1 = p1.s;
      const y2 = p2.s;
      const k = (y2 - y1) / (x2 - x1 || 1e-6);
      const b = y1 - k * x1;
      result = { k, b, x1, x2, y1, y2 };
    }
  }

  return (
    <ScrollView key={locale} style={{ flex: 1, padding: 16 }}>
      <Text style={styles.title}>{I18n.t("processingTitle")}</Text>
      <Text style={{ marginBottom: 8 }}>
        {I18n.t("project")}:{" "}
        <Text style={{ fontWeight: "bold" }}>{activeProject.name}</Text>
      </Text>
      <Text style={{ marginBottom: 8 }}>
        {I18n.t("journal")}:
        <FlatList
          horizontal
          data={journals}
          keyExtractor={(_, idx) => idx.toString()}
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
      </Text>
      <View style={{ alignItems: "center", marginVertical: 16 }}>
        <Svg
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          style={{ backgroundColor: "#f9f9f9", borderRadius: 12 }}
        >
          {/* Оси */}
          <Line
            x1={30}
            y1={CHART_HEIGHT - 30}
            x2={CHART_WIDTH - 10}
            y2={CHART_HEIGHT - 30}
            stroke="#888"
            strokeWidth={2}
          />
          <Line
            x1={30}
            y1={CHART_HEIGHT - 30}
            x2={30}
            y2={20}
            stroke="#888"
            strokeWidth={2}
          />
          {/* Точки */}
          {points.map((p, idx) => {
            const { x, y } = getXY(p.t, p.s);
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
          {/* Прямая по выбранным точкам */}
          {selectedPoints.length === 2 &&
            result &&
            (() => {
              // строим прямую по всей ширине графика
              const xMin = log10(minT);
              const xMax = log10(maxT);
              const yMin = result.k * xMin + result.b;
              const yMax = result.k * xMax + result.b;
              const p1 = getXY(Math.pow(10, xMin), yMin);
              const p2 = getXY(Math.pow(10, xMax), yMax);
              return (
                <Line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#b22222"
                  strokeWidth={2}
                />
              );
            })()}
        </Svg>
      </View>
      <Text style={{ textAlign: "center", color: "#888", marginBottom: 8 }}>
        {I18n.t("selectTwoPoints")}
      </Text>
      {selectedPoints.length === 2 && result && (
        <View style={styles.resultBox}>
          <Text style={{ fontWeight: "bold", color: "#800020" }}>
            {I18n.t("results")}:
          </Text>
          <Text>
            {I18n.t("slope")}: {result.k.toFixed(4)}
          </Text>
          <Text>
            {I18n.t("intercept")}: {result.b.toFixed(4)}
          </Text>
          <Text>{I18n.t("formula")}</Text>
        </View>
      )}
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
  journalContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
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
    alignItems: "center",
  },
});
