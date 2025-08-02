import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
  Image,
} from "react-native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import Svg, { Rect, Text as SvgText, Polyline } from "react-native-svg";
import I18n from "../Localization";
import { SubscriptionManager } from "../utils/SubscriptionManager";
import PremiumBanner from "../components/PremiumBanner";
import { useTheme } from "react-native-paper";

const Tab = createMaterialTopTabNavigator();

// --- Перевод величин (как раньше) ---
const FILTRATION_UNITS = [
  {
    key: "m_day",
    label: () => I18n.t("mDay"),
    factor: 1,
  },
  {
    key: "m_hour",
    label: () => I18n.t("mHour"),
    factor: 1 / 24,
  },
  {
    key: "m_min",
    label: () => I18n.t("mMin"),
    factor: 1 / 1440,
  },
  {
    key: "m_sec",
    label: () => I18n.t("mSec"),
    factor: 1 / 86400,
  },
  {
    key: "cm_day",
    label: () => I18n.t("cmDay"),
    factor: 100,
  },
  {
    key: "cm_hour",
    label: () => I18n.t("cmHour"),
    factor: 100 / 24,
  },
  {
    key: "cm_min",
    label: () => I18n.t("cmMin"),
    factor: 100 / 1440,
  },
  {
    key: "cm_sec",
    label: () => I18n.t("cmSec"),
    factor: 100 / 86400,
  },
  {
    key: "mm_day",
    label: () => I18n.t("mmDay"),
    factor: 1000,
  },
  {
    key: "mm_hour",
    label: () => I18n.t("mmHour"),
    factor: 1000 / 24,
  },
  {
    key: "mm_min",
    label: () => I18n.t("mmMin"),
    factor: 1000 / 1440,
  },
  {
    key: "mm_sec",
    label: () => I18n.t("mmSec"),
    factor: 1000 / 86400,
  },
  {
    key: "ft_day",
    label: () => I18n.t("ftDay"),
    factor: 3.28084,
  },
  {
    key: "ft_hour",
    label: () => I18n.t("ftHour"),
    factor: 3.28084 / 24,
  },
  {
    key: "ft_min",
    label: () => I18n.t("ftMin"),
    factor: 3.28084 / 1440,
  },
  {
    key: "ft_sec",
    label: () => I18n.t("ftSec"),
    factor: 3.28084 / 86400,
  },
  {
    key: "meynser",
    label: () => I18n.t("meynser"),
    factor: 24.54239,
  },
];

function UnitConverterScreen() {
  const [inputValue, setInputValue] = useState("1");
  const [inputUnit, setInputUnit] = useState("m_day");
  let value = parseFloat(inputValue.replace(",", "."));
  if (isNaN(value)) value = 0;
  const base =
    value / (FILTRATION_UNITS.find((u) => u.key === inputUnit)?.factor || 1);
  const results = FILTRATION_UNITS.map((u) => ({
    key: u.key,
    label: u.label(),
    value: (base * u.factor).toPrecision(8).replace(/\.0+$/, ""),
  }));
  const theme = useTheme();
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.background }}>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}
      >
        <TextInput
          style={{...styles.input, borderColor: theme.colors.border}}
          value={inputValue}
          onChangeText={setInputValue}
          keyboardType="numeric"
          placeholder="1"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginLeft: 8 }}
        >
          {FILTRATION_UNITS.map((u) => (
            <TouchableOpacity
              key={u.key}
              style={[
                styles.unitBtn,
                inputUnit === u.key && styles.unitBtnActive,
              ]}
              onPress={() => setInputUnit(u.key)}
            >
              <Text style={{ color: inputUnit === u.key ? theme.colors.text : theme.colors.reverse }}>
                {u.label()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <ScrollView style={{ maxHeight: 400 }}>
        {results.map((r) => (
          <View key={r.key} style={styles.resultRow}>
            <Text style={{...styles.resultValue, color: theme.colors.reverse}}>{r.value}</Text>
            <Text style={{...styles.resultUnit, color: theme.colors.text}}>{r.label}</Text>
          </View>
        ))}
      </ScrollView>
      
    </View>
  );
}

// --- Оценка параметров ---
function ParameterEstimationScreen() {
  const chartRef = useRef();
  const [Q, setQ] = useState("100");
  const [s, setS] = useState("15");
  const [m, setM] = useState("20");
  const [aquifer, setAquifer] = useState("unconfined");
  const [imperfect, setImperfect] = useState(false);
  const theme = useTheme();
  // Формулы
  let k = 0;
  let formula = "";
  if (aquifer === "unconfined") {
    // k = 2.43Q / (s(2m-s))
    const Qn = parseFloat(Q.replace(",", "."));
    const sn = parseFloat(s.replace(",", "."));
    const mn = parseFloat(m.replace(",", "."));
    if (sn > 0 && mn > 0 && 2 * mn - sn !== 0) {
      k = (2.43 * Qn) / (sn * (2 * mn - sn));
      formula = `k = 2.43Q / (s(2m-s))`;
    }
  } else {
    // k = Q / (1.814 * m * s)
    const Qn = parseFloat(Q.replace(",", "."));
    const sn = parseFloat(s.replace(",", "."));
    const mn = parseFloat(m.replace(",", "."));
    if (sn > 0 && mn > 0) {
      k = Qn / (1.814 * mn * sn);
      formula = `k = Q / (1.814ms)`;
    }
  }
  if (imperfect) {
    formula += " (несовершенная скважина)";
    // Можно добавить поправку, если формула известна
  }
  const result = { k, Q, s, m, aquifer, imperfect };

  function exportJSONResult() {
    return exportJSON(result, "parameter_estimation.json");
  }
  function exportPNGResult() {
    return exportPNG(chartRef, "parameter_estimation.png");
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{color: theme.colors.text}}>Q, м³/сут:</Text>
        <TextInput
          style={styles.input}
          value={Q}
          onChangeText={setQ}
          keyboardType="numeric"
        />
        <Text style={{color: theme.colors.text}}>s, м:</Text>
        <TextInput
          style={styles.input}
          value={s}
          onChangeText={setS}
          keyboardType="numeric"
        />
        <Text style={{color: theme.colors.text}}>m, м:</Text>
        <TextInput
          style={styles.input}
          value={m}
          onChangeText={setM}
          keyboardType="numeric"
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginVertical: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => setAquifer("unconfined")}
            style={[
              styles.aquiferBtn,
              aquifer === "unconfined" && styles.aquiferBtnActive,
            ]}
          >
            <Text
              style={{ color: aquifer === "unconfined" ? "#fff" : "#800020" }}
            >
              Безнапорный
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAquifer("confined")}
            style={[
              styles.aquiferBtn,
              aquifer === "confined" && styles.aquiferBtnActive,
            ]}
          >
            <Text
              style={{ color: aquifer === "confined" ? "#fff" : "#800020" }}
            >
              Напорный
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Switch value={imperfect} onValueChange={setImperfect} />
          <Text style={{ marginLeft: 8 }}>Несовершенная скважина</Text>
        </View>
      </View>
      <Text style={{ marginBottom: 8, color: "#800020", fontWeight: "bold" }}>
        {formula}
      </Text>
      <View
        ref={chartRef}
        collapsable={false}
        style={{ alignItems: "center", marginVertical: 24 }}
      >
        <Svg width={260} height={100}>
          <Rect
            x={20}
            y={20}
            width={220}
            height={60}
            fill="#e0f7fa"
            stroke="#800020"
            strokeWidth={2}
          />
          <SvgText
            x={130}
            y={50}
            fontSize="15"
            fill="#800020"
            textAnchor="middle"
          >
            k
          </SvgText>
          <SvgText
            x={130}
            y={75}
            fontSize="20"
            fill="#800020"
            textAnchor="middle"
          >
            {k ? k.toPrecision(5) : "-"}
          </SvgText>
        </Svg>
      </View>
      <TouchableOpacity style={styles.exportBtn} onPress={exportJSONResult}>
        <Text style={styles.exportBtnText}>Экспорт в JSON</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.exportBtn} onPress={exportPNGResult}>
        <Text style={styles.exportBtnText}>Экспорт в PNG</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function exportJSON(data, filename = "result.json") {
  const fileUri = FileSystem.cacheDirectory + filename;
  return FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  }).then(() => Sharing.shareAsync(fileUri, { mimeType: "application/json" }));
}

function exportPNG(ref, filename = "result.png") {
  return captureRef(ref, { format: "png", quality: 1 })
    .then((uri) => Sharing.shareAsync(uri, { mimeType: "image/png" }))
            .catch(() => Alert.alert(I18n.t("error"), I18n.t("savePNGError")));
}

// --- Вспомогательная функция W(u) для уравнения Тейса ---
function wellFunction(u) {
  // Аппроксимация экспоненциального интеграла W(u)
  if (u < 1e-6) return 0; // избежать логарифма нуля
  if (u < 1) {
    // Ряд Тейлора
    let sum = 0;
    let term = u;
    for (let n = 1; n <= 6; n++) {
      const prev = term;
      term *= -u / (n * n);
      sum += term;
      if (Math.abs(term - prev) < 1e-10) break;
    }
    return -0.5772156649 - Math.log(u) + u - (u * u) / 4 + sum;
  }
  // Для u>=1 используем экспоненциальное затухание
  return Math.exp(-u) / u;
}

function DrawdownForecastScreen() {
  const chartRef = useRef();
  const [Q, setQ] = useState("500");
  const [t, setT] = useState("10");
  const [r, setR] = useState("30");
  const [T, setTval] = useState("50");
  const [S, setS] = useState("0.0001");
  const [Ss, setSs] = useState("0.000004");
  const theme = useTheme();
  const Qn = parseFloat(Q.replace(",", "."));
  const tn = parseFloat(t.replace(",", "."));
  const rn = parseFloat(r.replace(",", "."));
  const Tn = parseFloat(T.replace(",", "."));
  const Sn = parseFloat(S.replace(",", "."));

  let s = 0;
  if (tn > 0 && rn > 0 && Tn > 0 && Sn > 0) {
    const u = (rn * rn * Sn) / (4 * Tn * tn);
    const W = wellFunction(u);
    s = (Qn / (4 * Math.PI * Tn)) * W;
  }
  const result = { Q: Qn, t: tn, r: rn, T: Tn, S: Sn, s };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{color: theme.colors.text}}>Q, м³/сут:</Text>
      <TextInput
        style={styles.input}
        value={Q}
        onChangeText={setQ}
        keyboardType="numeric"
      />
      <Text style={{color: theme.colors.text}}>t, сут:</Text>
      <TextInput
        style={styles.input}
        value={t}
        onChangeText={setT}
        keyboardType="numeric"
      />
      <Text style={{color: theme.colors.text}}>r, м:</Text>
      <TextInput
        style={styles.input}
        value={r}
        onChangeText={setR}
        keyboardType="numeric"
      />
      <Text style={{color: theme.colors.text}}>T, м²/сут:</Text>
      <TextInput
        style={styles.input}
        value={T}
        onChangeText={setTval}
        keyboardType="numeric"
      />
      <Text style={{color: theme.colors.text}}>S, - :</Text>
      <TextInput
        style={styles.input}
        value={S}
        onChangeText={setS}
        keyboardType="numeric"
      />
      <View
        ref={chartRef}
        collapsable={false}
        style={{ alignItems: "center", marginVertical: 24 }}
      >
        <Svg width={260} height={90}>
          <Rect
            x={20}
            y={20}
            width={220}
            height={50}
            fill="#f3f8e6"
            stroke="#800020"
            strokeWidth={2}
          />
          <SvgText
            x={130}
            y={50}
            fontSize="16"
            fill="#800020"
            textAnchor="middle"
          >
            s = {s ? s.toPrecision(5) : "-"} м
          </SvgText>
        </Svg>
      </View>
      <TouchableOpacity
        style={styles.exportBtn}
        onPress={() => exportJSON(result, "forecast_drawdown.json")}
      >
        <Text style={styles.exportBtnText}>{I18n.t("exportToJSON")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.exportBtn}
        onPress={() => exportPNG(chartRef, "forecast_drawdown.png")}
      >
        <Text style={styles.exportBtnText}>{I18n.t("exportToPNG")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PitInflowScreen() {
  const chartRef = useRef();
  const theme = useTheme();
  const [k, setK] = useState("5");
  const [m, setM] = useState("20");
  const [ro, setRo] = useState("118.3");
  const [R, setR] = useState("5723");
  const [s0, setS0] = useState("10");
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);

  // Проверяем доступ к премиум функциям
  React.useEffect(() => {
    async function checkPremiumAccess() {
      const hasAccess = await SubscriptionManager.hasPremiumAccess();
      setHasPremiumAccess(hasAccess);
    }
    checkPremiumAccess();
  }, []);

  const kn = parseFloat(k.replace(",", "."));
  const mn = parseFloat(m.replace(",", "."));
  const ron = parseFloat(ro.replace(",", "."));
  const Rn = parseFloat(R.replace(",", "."));
  const s0n = parseFloat(s0.replace(",", "."));

  let Q = 0;
  if (kn > 0 && mn > 0 && ron > 0 && Rn > ron) {
    Q = (2 * Math.PI * kn * mn * s0n) / Math.log(Rn / ron);
  }
  const result = { k: kn, m: mn, ro: ron, R: Rn, s0: s0n, Q };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      {!hasPremiumAccess && (
        <PremiumBanner
          title={I18n.t("pitInflowTab")}
          description={I18n.t("premiumFeaturePitInflow")}
          style={{ marginBottom: 16 }}
        />
      )}

      {hasPremiumAccess ? (
        <>
          <Text style={{color: theme.colors.text}}>k, м/сут:</Text>
          <TextInput
            style={styles.input}
            value={k}
            onChangeText={setK}
            keyboardType="numeric"
          />
          <Text style={{color: theme.colors.text}}>m, м:</Text>
          <TextInput
            style={styles.input}
            value={m}
            onChangeText={setM}
            keyboardType="numeric"
          />
          <Text style={{color: theme.colors.text}}>ro, м:</Text>
          <TextInput
            style={styles.input}
            value={ro}
            onChangeText={setRo}
            keyboardType="numeric"
          />
          <Text style={{color: theme.colors.text}}>R, м:</Text>
          <TextInput
            style={styles.input}
            value={R}
            onChangeText={setR}
            keyboardType="numeric"
          />
          <Text style={{color: theme.colors.text}}>s0, м:</Text>
          <TextInput
            style={styles.input}
            value={s0}
            onChangeText={setS0}
            keyboardType="numeric"
          />
          <View
            ref={chartRef}
            collapsable={false}
            style={{ alignItems: "center", marginVertical: 24 }}
          >
            <Svg width={260} height={90}>
              <Rect
                x={20}
                y={20}
                width={220}
                height={50}
                fill="#e8e6f8"
                stroke="#800020"
                strokeWidth={2}
              />
              <SvgText
                x={130}
                y={50}
                fontSize="16"
                fill="#800020"
                textAnchor="middle"
              >
                Q = {Q ? Q.toPrecision(5) : "-"} м³/сут
              </SvgText>
            </Svg>
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => exportJSON(result, "pit_inflow.json")}
          >
            <Text style={styles.exportBtnText}>{I18n.t("exportToJSON")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => exportPNG(chartRef, "pit_inflow.png")}
          >
            <Text style={styles.exportBtnText}>{I18n.t("exportToPNG")}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

function BarrageScreen() {
  const chartRef = useRef();
  const theme = useTheme();
  const [k, setK] = useState("0.1");
  const [q, setQ] = useState("0.4");
  const [m, setM] = useState("20");

  const kn = parseFloat(k.replace(",", "."));
  const qn = parseFloat(q.replace(",", "."));
  const mn = parseFloat(m.replace(",", "."));
  let smax = 0;
  if (kn > 0) smax = (qn * mn) / kn;

  const result = { k: kn, q: qn, m: mn, smax };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{color: theme.colors.text}}>k, м/сут:</Text>
      <TextInput
        style={styles.input}
        value={k}
        onChangeText={setK}
        keyboardType="numeric"
      />
      <Text style={{color: theme.colors.text}}>q, м²/сут:</Text>
      <TextInput
        style={styles.input}
        value={q}
        onChangeText={setQ}
        keyboardType="numeric"
      />
      <Text style={{color: theme.colors.text}}>m, м:</Text>
      <TextInput
        style={styles.input}
        value={m}
        onChangeText={setM}
        keyboardType="numeric"
      />
      <View
        ref={chartRef}
        collapsable={false}
        style={{ alignItems: "center", marginVertical: 24 }}
      >
        <Svg width={260} height={90}>
          <Rect
            x={20}
            y={20}
            width={220}
            height={50}
            fill="#fcefdc"
            stroke="#800020"
            strokeWidth={2}
          />
          <SvgText
            x={130}
            y={50}
            fontSize="16"
            fill="#800020"
            textAnchor="middle"
          >
            sₘₐₓ = {smax ? smax.toPrecision(5) : "-"} м
          </SvgText>
        </Svg>
      </View>
      <TouchableOpacity
        style={styles.exportBtn}
        onPress={() => exportJSON(result, "barrage.json")}
      >
        <Text style={styles.exportBtnText}>{I18n.t("exportToJSON")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.exportBtn}
        onPress={() => exportPNG(chartRef, "barrage.png")}
      >
        <Text style={styles.exportBtnText}>{I18n.t("exportToPNG")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfiltrationLeakageScreen() {
  const chartRef = useRef();
  const theme = useTheme();
  const [e, setE] = useState("0.1"); // ε (м/сут)
  const [percentInfiltration, setPercentInfiltration] = useState("10"); // Процент инфильтрации
  const [Sy, setSy] = useState("0.2"); // Sy
  const [A, setA] = useState("10"); // A (м)
  const [k, setK] = useState("5"); // k (м/сут)
  const [m, setM] = useState("20"); // m (м)
  const [t, setT] = useState("100"); // t (сут)
  const [x, setX] = useState("0"); // x (м)
  const [steady, setSteady] = useState(true); // Стационар/Нестационар
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);

  // Проверяем доступ к премиум функциям
  React.useEffect(() => {
    async function checkPremiumAccess() {
      const hasAccess = await SubscriptionManager.hasPremiumAccess();
      setHasPremiumAccess(hasAccess);
    }
    checkPremiumAccess();
  }, []);

  const en = parseFloat(e.replace(",", "."));
  const percentInfiltrationn = parseFloat(
    percentInfiltration.replace(",", ".")
  );
  const Syn = parseFloat(Sy.replace(",", "."));
  const An = parseFloat(A.replace(",", "."));
  const kn = parseFloat(k.replace(",", "."));
  const mn = parseFloat(m.replace(",", "."));
  const tn = parseFloat(t.replace(",", "."));
  const xn = parseFloat(x.replace(",", "."));

  // Пересчет ε в мм/год
  const e_mm_year = en * 365;

  // Расчет P (мм/год) по проценту инфильтрации
  const P_mm_year = (e_mm_year * percentInfiltrationn) / 100;

  // Диффузивность пласта (м²/сут). Проверяем Sy>0, иначе D=0
  const D = Syn > 0 ? (mn * mn) / (2 * Syn) : 0;

  let s_max_steady = 0;
  let s_max_transient = 0;
  let s_profile = [];

  if (kn > 0 && mn > 0 && Syn > 0) {
    if (steady) {
      s_max_steady = (en * mn) / kn;
    } else {
      s_max_transient =
        Syn > 0 ? ((2 * en) / Syn) * Math.sqrt((D * tn) / Math.PI) : 0;
    }
  }

  if (Syn > 0 && tn > 0) {
    const x_values = [];
    const s_values = [];
    const dx = An / 10; // Шаг по x
    for (let x = -An; x <= An; x += dx) {
      let s = 0;
      if (steady) {
        s =
          Syn > 0 && D > 0
            ? ((en * tn) / Syn) * Math.exp((-x * x) / (4 * D * tn))
            : 0;
      } else {
        s =
          Syn > 0 && D > 0
            ? ((en * tn) / (2 * Math.PI * Syn)) *
              Math.exp((-x * x) / (4 * D * tn))
            : 0;
      }
      x_values.push(x);
      s_values.push(s);
    }
    s_profile = x_values.map((x, index) => ({ x, s: s_values[index] }));
  }

  const result = {
    e: en,
    percentInfiltration: percentInfiltrationn,
    Sy: Syn,
    A: An,
    k: kn,
    m: mn,
    t: tn,
    x: xn,
    steady: steady,
    e_mm_year: e_mm_year,
    P_mm_year: P_mm_year,
    s_max_steady: s_max_steady,
    s_max_transient: s_max_transient,
    s_profile: s_profile,
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16, marginBottom: 100 }}>
      {!hasPremiumAccess && (
        <PremiumBanner
          title={I18n.t("infiltrationLeakageTab")}
          description={I18n.t("premiumOnly")}
          style={{ marginBottom: 16 }}
        />
      )}

      {hasPremiumAccess ? (
        <>
          <View style={{ marginBottom: 12 }}>
            <Text style={{color: theme.colors.text}}>ε (м/сут):</Text>
            <TextInput
              style={styles.input}
              value={e}
              onChangeText={setE}
              keyboardType="numeric"
            />
            <Text style={{color: theme.colors.text}}>Процент инфильтрации (%):</Text>
            <TextInput
              style={styles.input}
              value={percentInfiltration}
              onChangeText={setPercentInfiltration}
              keyboardType="numeric"
            />
            <Text style={{color: theme.colors.text}}>Sy, - :</Text>
            <TextInput
              style={styles.input}
              value={Sy}
              onChangeText={setSy}
              keyboardType="numeric"
            />
            <Text style={{color: theme.colors.text}}>A, м (полуширина области):</Text>
            <TextInput
              style={styles.input}
              value={A}
              onChangeText={setA}
              keyboardType="numeric"
            />
            <Text style={{color: theme.colors.text}}>k, м/сут:</Text>
            <TextInput
              style={styles.input}
              value={k}
              onChangeText={setK}
              keyboardType="numeric"
            />
            <Text style={{color: theme.colors.text}}>m, м:</Text>
            <TextInput
              style={styles.input}
              value={m}
              onChangeText={setM}
              keyboardType="numeric"
            />
            <Text style={{color: theme.colors.text}}>t, сут:</Text>
            <TextInput
              style={styles.input}
              value={t}
              onChangeText={setT}
              keyboardType="numeric"
            />
            <Text style={{color: theme.colors.text}}>x, м:</Text>
            <TextInput
              style={styles.input}
              value={x}
              onChangeText={setX}
              keyboardType="numeric"
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginVertical: 8,
              }}
            >
              <TouchableOpacity
                onPress={() => setSteady(true)}
                style={[styles.steadyBtn, steady && styles.steadyBtnActive]}
              >
                <Text style={{ color: steady ? "#fff" : "#800020" }}>
                  Стационарный
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSteady(false)}
                style={[styles.steadyBtn, !steady && styles.steadyBtnActive]}
              >
                <Text style={{ color: !steady ? "#fff" : "#800020" }}>
                  Нестационарный
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text
            style={{ marginBottom: 8, color: theme.colors.text, fontWeight: "bold" }}
          >
            Результаты:
          </Text>
          <View style={styles.resultRow}>
            <Text style={{...styles.resultValue, color: theme.colors.text}}>
              {I18n.t("e_mm_year", { defaultValue: "ε (мм/год)" })}:
            </Text>
            <Text style={{...styles.resultValue, color: theme.colors.reverse}}>{e_mm_year.toPrecision(5)}</Text>
            <Text style={{...styles.resultUnit, color: theme.colors.text}}>мм/год</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={{...styles.resultValue, color: theme.colors.text}}>
              {I18n.t("P_mm_year", { defaultValue: "P (мм/год)" })}:
            </Text>
            <Text style={{...styles.resultValue, color: theme.colors.reverse}}>{P_mm_year.toPrecision(5)}</Text>
            <Text style={{...styles.resultUnit, color: theme.colors.text}}>мм/год</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={{...styles.resultValue, color: theme.colors.text}}>
              {I18n.t("sMaxSteady", { defaultValue: "s_max (steady)" })}:
            </Text>
            <Text style={{...styles.resultValue, color: theme.colors.reverse}}>
              {s_max_steady.toPrecision(5)}
            </Text>
            <Text style={{...styles.resultUnit, color: theme.colors.text}}>м</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={{...styles.resultValue, color: theme.colors.text}}>
              {I18n.t("sMaxTransient", { defaultValue: "s_max (transient)" })}:
            </Text>
            <Text style={{...styles.resultValue, color: theme.colors.reverse}}>
              {s_max_transient.toPrecision(5)}
            </Text>
            <Text style={{...styles.resultUnit, color: theme.colors.text}}>м</Text>
          </View>
          <View
            ref={chartRef}
            collapsable={false}
            style={{ alignItems: "center", marginVertical: 24 }}
          >
            <Svg width={260} height={150}>
              <Rect
                x={20}
                y={20}
                width={220}
                height={120}
                fill="#e6f9f8"
                stroke="#800020"
                strokeWidth={2}
              />
              <SvgText
                x={130}
                y={140}
                fontSize="16"
                fill="#800020"
                textAnchor="middle"
              >
                s(x)
              </SvgText>
              {/* Polyline график профиля */}
              {s_profile.length > 1 && (
                <Polyline
                  points={s_profile
                    .map((p) => `${130 + p.x * 5},${140 - p.s * 10}`)
                    .join(" ")}
                  fill="none"
                  stroke="#800020"
                  strokeWidth="2"
                />
              )}
            </Svg>
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => exportJSON(result, "infiltration_leakage.json")}
          >
            <Text style={styles.exportBtnText}>{I18n.t("exportToJSON")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => exportPNG(chartRef, "infiltration_leakage.png")}
          >
            <Text style={styles.exportBtnText}>{I18n.t("exportToPNG")}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

export default function CalculatorScreen() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarIndicatorStyle: { backgroundColor: theme.colors.primary, height: 3 },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          textTransform: "none",
        },
        tabBarScrollEnabled: true,
      }}
    >
      <Tab.Screen
        name="UnitConverter"
        component={UnitConverterScreen}
        options={{
          title: I18n.t("filtrationCoeff"),
        }}
      />
      <Tab.Screen
        name="ParameterEstimation"
        component={ParameterEstimationScreen}
        options={{
          title: I18n.t("parameterEstimationTab"),
        }}
      />
      <Tab.Screen
        name="DrawdownForecast"
        component={DrawdownForecastScreen}
        options={{
          title: I18n.t("drawdownForecastTab"),
        }}
      />
      <Tab.Screen
        name="PitInflow"
        component={PitInflowScreen}
        options={{
          title: I18n.t("pitInflowTab"),
        }}
      />
      <Tab.Screen
        name="Barrage"
        component={BarrageScreen}
        options={{ title: I18n.t("barrageTab") }}
      />
      <Tab.Screen
        name="InfiltrationLeakage"
        component={InfiltrationLeakageScreen}
        options={{
          title: I18n.t("infiltrationLeakageTab"),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#800020",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    width: 120,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 12,
    marginTop: 2,
  },
  inputRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  label: { width: 80, fontSize: 15, color: "#222", marginRight: 8 },
  unitBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: "#fff",
  },
  unitBtnActive: { backgroundColor: "#800020" },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  resultValue: {
    width: 110,
    fontWeight: "bold",
    color: "#800020",
    fontSize: 16,
  },
  resultUnit: { fontSize: 15, color: "#333", marginLeft: 8 },
  exportBtn: {
    backgroundColor: "#800020",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    alignItems: "center",
    minWidth: 160,
  },
  exportBtnText: { color: "#fff", fontWeight: "bold" },
  aquiferBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: "#fff",
  },
  aquiferBtnActive: { backgroundColor: "#800020" },
  banner: {
    marginVertical: 15,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  svgBox: {
    alignItems: "center",
    marginVertical: 18,
    padding: 8,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  exportBtnGroup: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 10,
  },
  shapeBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: "#fff",
  },
  shapeBtnActive: { backgroundColor: "#800020" },
  steadyBtn: {
    borderWidth: 1,
    borderColor: "#800020",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: "#fff",
  },
  steadyBtnActive: { backgroundColor: "#800020" },
});
