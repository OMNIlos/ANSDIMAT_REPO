/**
 * Вкладка «Зона санитарной охраны»
 *
 * Перенос веб-калькулятора ЗСО. Отвечает на вопрос, какую площадь вокруг
 * скважины придётся закрыть от застройки и стоков: границы второго и третьего
 * пояса СанПиН определяет по времени добегания загрязнения до скважины.
 *
 * Порядок тот же, что у прогноза и котлована: способ расчёта, план поясов,
 * исходные данные, результат. План стоит сразу под выбором способа — разница
 * между кругом объёмного способа и каплей аналитического видна на нём с
 * одного взгляда, а в трёх парах чисел теряется.
 */

import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../../Localization';
import { QUANTITIES } from '../../calc/units';
import { useUnits } from '../../UnitsContext';
import {
  WHPA_METHODS,
  beltContours,
  computeWhpa,
  contourArea,
  contourToGeo,
  percolation,
  turningPoints,
} from '../../calc/whpa';
import { WHPA_LITHOLOGY, whpaTypical } from '../../calc/lithology';
import WhpaPlan from '../../components/schemes/WhpaPlan';
import FieldMap from '../../components/FieldMap';
import { BELT_COLORS } from '../../components/schemes/WhpaPlan';
import AppearIn from '../../components/ui/AppearIn';
import PressableScale from '../../components/ui/PressableScale';
import { setMenuHidden } from '../../components/chromeVisibility';
import { spacing, elevation, type, fontFamily } from '../../theme';
import {
  Card,
  Collapsible,
  Field,
  Formula,
  Note,
  Notices,
  OptionRow,
  PresetRow,
  ResultCard,
  SectionLabel,
  StatRow,
  parseNumber,
  formatValue,
  formatCompact,
  styles as shared,
} from './shared';

/** Способы расчёта поясов в порядке веб-версии */
const METHODS = [
  { value: WHPA_METHODS.ANALYTICAL, labelKey: 'whpaMethodAnalyticalShort', captionKey: 'whpaMethodAnalytical' },
  { value: WHPA_METHODS.VOLUME, labelKey: 'whpaMethodVolumeShort', captionKey: 'whpaMethodVolume' },
];

/** Пояса в порядке нарастания: строгий режим, бактериальный, химический */
const BELTS = ['first', 'bacterial', 'chemical'];

export default function WhpaTab({ contentWidth }) {
  const theme = useTheme();
  const { unitLabel, toBase, fromBase } = useUnits();

  const inFlow = (text) => toBase(parseNumber(text), QUANTITIES.FLOW);
  const inLen = (text) => toBase(parseNumber(text), QUANTITIES.DISTANCE);
  const inCond = (text) => toBase(parseNumber(text), QUANTITIES.CONDUCTIVITY);
  const out = (value, quantity) => formatValue(fromBase(value, quantity));
  // Размеры поясов — десятки и сотни метров, и «50.000» в таблице только
  // мешает: до сантиметра границу ЗСО всё равно никто не выносит
  const metres = (value) => {
    const shown = fromBase(value, QUANTITIES.DISTANCE);
    return isFinite(shown) ? String(Number(shown.toFixed(1))) : '—';
  };

  const uFlow = unitLabel(QUANTITIES.FLOW);
  const uLen = unitLabel(QUANTITIES.DISTANCE);
  const uCond = unitLabel(QUANTITIES.CONDUCTIVITY);
  const uTrans = unitLabel(QUANTITIES.TRANSMISSIVITY);

  const [method, setMethod] = useState(WHPA_METHODS.ANALYTICAL);
  const [flow, setFlow] = useState('720');
  const [k, setK] = useState('7');
  const [thickness, setThickness] = useState('50');
  const [porosity, setPorosity] = useState('0.35');
  const [gradient, setGradient] = useState('0.0015');
  const [azimuth, setAzimuth] = useState('240');
  const [tBacterial, setTBacterial] = useState('400');
  const [tChemical, setTChemical] = useState('9125');
  const [firstBelt, setFirstBelt] = useState('50');
  const [latitude, setLatitude] = useState('60.281711');
  const [longitude, setLongitude] = useState('29.536609');
  const [turningBelt, setTurningBelt] = useState('chemical');
  // Обзор подгоняется под пояса, пока человек не взял карту в свои руки.
  // Считать по «первым появившимся контурам» нельзя: карта к тому моменту
  // ещё не загрузилась, и подгонка не срабатывала вовсе
  const [mapTouched, setMapTouched] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [locating, setLocating] = useState(false);
  // Отказ в геопозиции показывается плашкой на самой карте, а не Alert:
  // на вебе тот не выводится вовсе, и отказ выглядел бы сломанной кнопкой
  const [mapNotice, setMapNotice] = useState('');
  const [mapCenter, setMapCenter] = useState(null);

  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };

  // Развёрнутой карте плавающее меню только мешает: оно закрывает низ и
  // отнимает высоту у того, ради чего разворот и нажат
  useEffect(() => {
    setMenuHidden(mapFullscreen);
    return () => setMenuHidden(false);
  }, [mapFullscreen]);
  const [recharge, setRecharge] = useState('0.0003');
  // Разрез из примера веб-версии: сверху вниз, слабопроницаемая прослойка
  // вторым слоем — она и даёт основную задержку
  const [layers, setLayers] = useState([
    { id: '1', k: '10', m: '3', n: '0.15' },
    { id: '2', k: '0.0001', m: '2', n: '0.05' },
    { id: '3', k: '10', m: '2', n: '0.15' },
    { id: '4', k: '0.1', m: '4', n: '0.1' },
    { id: '5', k: '10', m: '1.5', n: '0.15' },
  ]);

  const analytical = method === WHPA_METHODS.ANALYTICAL;

  const raw = useMemo(
    () => ({
      method,
      Q: inFlow(flow),
      k: inCond(k),
      m: inLen(thickness),
      n: parseNumber(porosity),
      I: parseNumber(gradient),
      tBacterial: parseNumber(tBacterial),
      tChemical: parseNumber(tChemical),
      firstBeltRadius: inLen(firstBelt),
    }),
    [method, flow, k, thickness, porosity, gradient, tBacterial, tChemical, firstBelt]
  );

  const result = useMemo(() => computeWhpa(raw), [raw]);
  // Контуры считаются подбором корня в каждом направлении: без запоминания
  // они пересчитывались бы на каждое нажатие клавиши в любом поле
  const contours = useMemo(() => beltContours(result), [result]);

  const caption = I18n.t(
    (METHODS.find((item) => item.value === method) || METHODS[0]).captionKey
  );

  const hasError = (code) => !result.ok && result.errors.includes(code);

  const belt = (key) => (result.ok ? result.belts.find((item) => item.key === key) : null);
  const outer = belt('chemical');

  const origin = useMemo(() => {
    const lat = parseNumber(latitude);
    const lon = parseNumber(longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }, [latitude, longitude]);

  // Контуры на местности: те же пояса, развёрнутые по азимуту потока и
  // посаженные на устье скважины
  const geography = useMemo(() => {
    if (!origin) return [];
    return contours.map((item) => ({
      key: item.key,
      points: contourToGeo(item.contour, origin, parseNumber(azimuth)),
    }));
  }, [contours, origin, azimuth]);

  const polygons = useMemo(
    () =>
      geography
        .filter((item) => item.points.length > 2)
        // Самый широкий пояс ложится первым, остальные поверх него
        .slice()
        .reverse()
        .map((item) => ({
          id: item.key,
          points: item.points.map((point) => [point.lat, point.lon]),
          color: BELT_COLORS[item.key].stroke,
          fill: BELT_COLORS[item.key].stroke,
          fillOpacity: 0.16,
        })),
    [geography]
  );

  const wellPoint = useMemo(
    () =>
      origin
        ? [
            {
              id: 'well',
              lat: origin.lat,
              lon: origin.lon,
              title: I18n.t('whpaWellTitle'),
              label: true,
              draggable: true,
            },
          ]
        : [],
    [origin]
  );

  const outerContour = useMemo(
    () => (contours.find((item) => item.key === 'chemical') || {}).contour || [],
    [contours]
  );

  const turning = useMemo(() => {
    const found = geography.find((item) => item.key === turningBelt);
    return found ? turningPoints(found.points) : [];
  }, [geography, turningBelt]);

  const cover = useMemo(
    () =>
      percolation(
        parseNumber(recharge),
        layers.map((layer) => ({
          id: layer.id,
          k: inCond(layer.k),
          m: inLen(layer.m),
          n: parseNumber(layer.n),
        }))
      ),
    [recharge, layers]
  );

  /**
   * Ставит скважину в указанную на карте точку
   *
   * Шесть знаков после запятой — около десяти сантиметров на местности:
   * точнее устье скважины по карте всё равно не ткнуть
   *
   * @param {number} lat - широта
   * @param {number} lon - долгота
   */
  const placeWell = (lat, lon) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setLatitude(lat.toFixed(6));
    setLongitude(lon.toFixed(6));
    // Дальше карту не двигаем сами: человек уже показал, что ему нужно
    setMapTouched(true);
  };

  /**
   * Ставит скважину туда, где стоит человек
   *
   * Обзор при этом уводится на новое место: после определения геопозиции
   * ждут увидеть себя, а не прежний участок
   */
  const placeAtMyLocation = async () => {
    setMapNotice('');
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMapNotice(I18n.t('locationDenied'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      placeWell(position.coords.latitude, position.coords.longitude);
      setMapCenter({ lat: position.coords.latitude, lon: position.coords.longitude });
    } catch {
      setMapNotice(I18n.t('locationFailed'));
    } finally {
      setLocating(false);
    }
  };

  /**
   * Разворачивает карту на весь экран и обратно
   *
   * Разворот заново подгоняет обзор под пояса: карта в модальном окне —
   * отдельный экземпляр, и прежнее положение обзора к ней не относится
   *
   * @param {boolean} open - развернуть или свернуть
   */
  const toggleFullscreen = (open) => {
    setMapFullscreen(open);
    setMapTouched(false);
  };

  /**
   * Правит одно поле слоя разреза
   *
   * @param {string} id - слой
   * @param {string} field - поле
   * @param {string} value - новое значение
   */
  const editLayer = (id, field, value) => {
    setLayers((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  const addLayer = () =>
    setLayers((rows) => [...rows, { id: String(Date.now()), k: '1', m: '1', n: '0.1' }]);

  const removeLayer = (id) => setLayers((rows) => rows.filter((row) => row.id !== id));

  /**
   * Подставляет справочные параметры выбранной породы
   *
   * @param {string} id - идентификатор породы
   */
  const applyLithology = (id) => {
    const entry = WHPA_LITHOLOGY.find((item) => item.id === id);
    if (!entry) return;
    const typical = whpaTypical(entry);
    setK(String(Number(fromBase(typical.k, QUANTITIES.CONDUCTIVITY).toPrecision(4))));
    setPorosity(String(Number(typical.n.toFixed(3))));
  };

  /**
   * Карта с накладками: геопозиция и разворот
   *
   * Один и тот же вид рисуется в ленте и в развёрнутом окне — отличаются
   * только высота, отступы кнопок и значок разворота
   *
   * @param {Object} props
   * @param {number} [props.height] - высота карты; без неё карта займёт всё окно
   * @param {boolean} [props.fullscreen] - карта развёрнута на весь экран
   * @returns {React.ReactElement} карта
   */
  const renderMap = ({ height, fullscreen = false } = {}) => {
    const bottom = fullscreen ? Math.max(insets.bottom, spacing.md) + spacing.md : spacing.md;
    return (
      <View style={fullscreen ? styles.mapFull : styles.mapBlock}>
        <FieldMap
          points={wellPoint}
          polygons={polygons}
          fitPolygons={!mapTouched}
          center={mapCenter}
          onPressMap={placeWell}
          onMovePoint={(id, lat, lon) => placeWell(lat, lon)}
          height={height}
          flush={fullscreen}
        />

        {mapNotice ? (
          <View
            style={[
              styles.mapNotice,
              elevation.card,
              {
                top: (fullscreen ? insets.top : 0) + spacing.md,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[type.caption, { color: theme.colors.text }]}>{mapNotice}</Text>
          </View>
        ) : null}

        <PressableScale
          onPress={placeAtMyLocation}
          disabled={locating}
          style={[
            styles.mapLocate,
            elevation.brandButton,
            { bottom, backgroundColor: theme.colors.primary, opacity: locating ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={I18n.t('whpaAtMyLocation')}
        >
          <MaterialIcons name="my-location" size={20} color="#FFFFFF" />
        </PressableScale>

        <PressableScale
          onPress={() => toggleFullscreen(!fullscreen)}
          style={[
            styles.mapExpand,
            elevation.brandButton,
            { bottom, backgroundColor: theme.colors.primary },
          ]}
          accessibilityRole="button"
          accessibilityState={{ expanded: fullscreen }}
          accessibilityLabel={I18n.t(fullscreen ? 'mapCollapse' : 'mapExpand')}
        >
          <MaterialIcons
            name={fullscreen ? 'fullscreen-exit' : 'fullscreen'}
            size={22}
            color="#FFFFFF"
          />
        </PressableScale>
      </View>
    );
  };

  return (
    <>
      {/* Развёрнутая карта живёт в Modal, а не накладкой поверх вкладки:
          экран лежит в карточке навигатора, а та на вебе сдвинута
          трансформом ради переходов — и absolute, и fixed внутри неё уезжают
          вместе с прокруткой. Modal рендерится порталом в корень и всегда
          ровно по окну */}
      <Modal
        visible={mapFullscreen}
        animationType="fade"
        onRequestClose={() => toggleFullscreen(false)}
        supportedOrientations={['portrait', 'landscape']}
        statusBarTranslucent
      >
        <GestureHandlerRootView
          style={[styles.fullscreen, { backgroundColor: theme.colors.background }]}
        >
          {/* Только пока окно открыто: со снятым visible содержимое Modal на
              вебе остаётся в разметке, и свёрнутая карта продолжала бы
              держать свой экземпляр Leaflet с загруженными плитками */}
          {mapFullscreen ? renderMap({ fullscreen: true }) : null}
        </GestureHandlerRootView>
      </Modal>

      <AppearIn index={0}>
        <SectionLabel style={styles.firstLabel}>{I18n.t('whpaMethodGroup')}</SectionLabel>
        <OptionRow
          options={METHODS.map((item) => ({ value: item.value, label: I18n.t(item.labelKey) }))}
          value={method}
          onChange={setMethod}
        />
        <Note>{caption}</Note>
        <View style={styles.plan}>
          {/* На карте видно главное, ради чего ЗСО и считают: что попадает
              внутрь поясов. Без координат устья остаётся схема — она хотя бы
              показывает форму и масштаб */}
          {polygons.length > 0 ? (
            renderMap({ height: Math.round(contentWidth * 0.82) })
          ) : (
            <WhpaPlan
              contours={contours}
              azimuth={parseNumber(azimuth)}
              showFlow={analytical}
              width={contentWidth}
            />
          )}
        </View>
        <Note>
          {polygons.length > 0
            ? I18n.t('whpaMapHint')
            : result.ok
              ? I18n.t('whpaPlanNoCoords')
              : ''}
        </Note>
      </AppearIn>

      <AppearIn index={1}>
        <SectionLabel>{I18n.t('whpaIntakeGroup')}</SectionLabel>
        <Card>
          <Field
            label={I18n.t('whpaFlowRate')}
            symbol="Q"
            value={flow}
            onChange={setFlow}
            unit={uFlow}
            error={hasError('Q')}
          />
          <Field
            label={I18n.t('whpaLatitude')}
            symbol="φ"
            value={latitude}
            onChange={setLatitude}
            unit="°"
            hint={I18n.t('whpaCoordsHint')}
          />
          <Field
            label={I18n.t('whpaLongitude')}
            symbol="λ"
            value={longitude}
            onChange={setLongitude}
            unit="°"
          />
        </Card>
      </AppearIn>

      <AppearIn index={2}>
        <SectionLabel>{I18n.t('whpaAquiferGroup')}</SectionLabel>
        <PresetRow
          options={WHPA_LITHOLOGY.map((entry) => ({
            value: entry.id,
            label: `${I18n.t(entry.labelKey)} · ${formatCompact(whpaTypical(entry).k)}`,
          }))}
          onPick={applyLithology}
        />
        <Card style={styles.spaced}>
          <Field
            label={I18n.t('whpaConductivity')}
            symbol="k"
            value={k}
            onChange={setK}
            unit={uCond}
            error={hasError('k')}
          />
          <Field
            label={I18n.t('whpaThickness')}
            symbol="m"
            value={thickness}
            onChange={setThickness}
            unit={uLen}
            error={hasError('m')}
          />
          <Field
            label={I18n.t('whpaPorosity')}
            symbol="n"
            value={porosity}
            onChange={setPorosity}
            error={hasError('n') || hasError('n_gt_1')}
          />
        </Card>
        <Note>{I18n.t('whpaLithologyNote')}</Note>
      </AppearIn>

      {analytical ? (
        <AppearIn index={3}>
          <SectionLabel>{I18n.t('whpaFlowGroup')}</SectionLabel>
          <Card>
            <Field
              label={I18n.t('whpaGradient')}
              symbol="I"
              value={gradient}
              onChange={setGradient}
              error={hasError('I')}
              hint={result.ok ? `q = ${formatCompact(fromBase(result.q, QUANTITIES.TRANSMISSIVITY))} ${uTrans}` : null}
            />
            <Field
              label={I18n.t('whpaAzimuth')}
              symbol="α"
              value={azimuth}
              onChange={setAzimuth}
              unit="°"
              hint={I18n.t('whpaAzimuthHint')}
            />
          </Card>
        </AppearIn>
      ) : null}

      <AppearIn index={4}>
        <SectionLabel>{I18n.t('whpaBeltsGroup')}</SectionLabel>
        <Card>
          <Field
            label={I18n.t('whpaFirstBelt')}
            symbol="R₁"
            value={firstBelt}
            onChange={setFirstBelt}
            unit={uLen}
            error={hasError('firstBeltRadius')}
          />
          <Field
            label={I18n.t('whpaTimeBacterial')}
            symbol="Tм"
            value={tBacterial}
            onChange={setTBacterial}
            unit={I18n.t('unitDays')}
            error={hasError('tBacterial')}
            hint={I18n.t('whpaTimeBacterialHint')}
          />
          <Field
            label={I18n.t('whpaTimeChemical')}
            symbol="Tх"
            value={tChemical}
            onChange={setTChemical}
            unit={I18n.t('unitDays')}
            error={hasError('tChemical')}
            hint={I18n.t('whpaTimeChemicalHint')}
          />
        </Card>
      </AppearIn>

      {result.ok ? (
        <AppearIn index={5}>
          <ResultCard
            title={I18n.t('whpaResultTitle')}
            label="R"
            value={metres(outer.R)}
            unit={uLen}
            rows={[
              {
                label: `${I18n.t('whpaDownstream')}  r`,
                value: metres(outer.r),
                unit: uLen,
              },
              {
                label: `${I18n.t('whpaAcross')}  2d`,
                value: metres(2 * outer.d),
                unit: uLen,
              },
            ]}
          />
          <Notices codes={result.warnings} prefix="whpaWarn_" />

          <SectionLabel>{I18n.t('whpaSizesGroup')}</SectionLabel>
          <Card style={shared.listCard}>
            <View style={[styles.tableHead, { borderBottomColor: theme.colors.border }]}>
              <Text
                style={[styles.cell, styles.cellBelt, { color: theme.colors.faint }]}
                numberOfLines={1}
              >
                {I18n.t('whpaBeltColumn')}
              </Text>
              <Text style={[styles.cell, { color: theme.colors.faint }]}>R</Text>
              <Text style={[styles.cell, { color: theme.colors.faint }]}>r</Text>
              <Text style={[styles.cell, { color: theme.colors.faint }]}>2d</Text>
            </View>
            {BELTS.map((key) => {
              const item = belt(key);
              return (
                <View key={key} style={styles.tableRow}>
                  <Text
                    style={[styles.cell, styles.cellBelt, { color: theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {I18n.t(`whpaBelt_${key}Short`)}
                  </Text>
                  <Text style={[styles.cell, { color: theme.colors.text }]}>
                    {metres(item.R)}
                  </Text>
                  <Text style={[styles.cell, { color: theme.colors.text }]}>
                    {metres(item.r)}
                  </Text>
                  <Text style={[styles.cell, { color: theme.colors.text }]}>
                    {metres(2 * item.d)}
                  </Text>
                </View>
              );
            })}
          </Card>
          <Note>{I18n.t('whpaSizesNote')}</Note>

          <Collapsible title={I18n.t('whpaDetailsGroup')} note="ƒ">
            <Formula>{result.formula}</Formula>
            {analytical ? (
              <Card style={shared.listCard}>
                <StatRow
                  label={I18n.t('whpaStatQ')}
                  value={`${out(result.q, QUANTITIES.TRANSMISSIVITY)} ${uTrans}`}
                />
                <StatRow
                  label={I18n.t('whpaStatStagnation')}
                  value={`${metres(result.xL)} ${uLen}`}
                />
                <StatRow
                  label={I18n.t('whpaStatTauBacterial')}
                  value={formatValue(belt('bacterial').tau)}
                />
                <StatRow
                  label={I18n.t('whpaStatTauChemical')}
                  value={formatValue(belt('chemical').tau)}
                />
                <StatRow
                  label={I18n.t('whpaStatWidthLimit')}
                  value={`${metres(Math.PI * result.xL * 2)} ${uLen}`}
                />
                <StatRow
                  label={I18n.t('whpaStatArea')}
                  value={`${formatCompact(contourArea(outerContour) / 10000)} ${I18n.t('unitHectare')}`}
                />
              </Card>
            ) : null}
            <Note>{I18n.t('whpaSource')}</Note>
          </Collapsible>

          {turning.length > 0 ? (
            <Collapsible title={I18n.t('whpaTurningGroup')} note={`${turning.length}`}>
              <OptionRow
                options={BELTS.map((key) => ({
                  value: key,
                  label: I18n.t(`whpaBelt_${key}Short`),
                }))}
                value={turningBelt}
                onChange={setTurningBelt}
              />
              <Card style={[shared.listCard, styles.spaced]}>
                <View style={[styles.tableHead, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.cell, styles.cellIndex, { color: theme.colors.faint }]}>
                    {I18n.t('whpaTurningNo')}
                  </Text>
                  <Text style={[styles.cell, { color: theme.colors.faint }]}>
                    {I18n.t('whpaTurningLat')}
                  </Text>
                  <Text style={[styles.cell, { color: theme.colors.faint }]}>
                    {I18n.t('whpaTurningLon')}
                  </Text>
                </View>
                {turning.map((point, index) => (
                  <View key={`${point.lat}-${point.lon}`} style={styles.tableRow}>
                    <Text style={[styles.cell, styles.cellIndex, { color: theme.colors.faint }]}>
                      {index + 1}
                    </Text>
                    <Text style={[styles.cell, { color: theme.colors.text }]}>
                      {point.lat.toFixed(6)}
                    </Text>
                    <Text style={[styles.cell, { color: theme.colors.text }]}>
                      {point.lon.toFixed(6)}
                    </Text>
                  </View>
                ))}
              </Card>
              <Note>{I18n.t('whpaTurningNote')}</Note>
            </Collapsible>
          ) : null}
        </AppearIn>
      ) : (
        <AppearIn index={5}>
          <Notices codes={result.errors} prefix="whpaError_" tone="error" />
        </AppearIn>
      )}

      {/* Защищённость горизонта — отдельный расчёт: он про вертикальное
          просачивание сверху, а не про плановые размеры поясов */}
      <AppearIn index={6}>
        <SectionLabel>{I18n.t('whpaPercGroup')}</SectionLabel>
        <Note>{I18n.t('whpaPercLead')}</Note>
        <Card style={styles.spaced}>
          <Field
            label={I18n.t('whpaRecharge')}
            symbol="w"
            value={recharge}
            onChange={setRecharge}
            unit={uCond}
            hint={I18n.t('whpaRechargeHint')}
          />
        </Card>

        <SectionLabel>{I18n.t('whpaLayersGroup')}</SectionLabel>
        <Card style={shared.listCard}>
          <View style={[styles.tableHead, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.layerCell, styles.layerNo, { color: theme.colors.faint }]}>
              {I18n.t('whpaTurningNo')}
            </Text>
            <Text style={[styles.layerCell, { color: theme.colors.faint }]}>
              {I18n.t('whpaLayerK')}
            </Text>
            <Text style={[styles.layerCell, { color: theme.colors.faint }]}>
              {I18n.t('whpaLayerM')}
            </Text>
            <Text style={[styles.layerCell, { color: theme.colors.faint }]}>
              {I18n.t('whpaLayerN')}
            </Text>
            <Text style={[styles.layerCell, styles.layerTime, { color: theme.colors.faint }]}>
              {I18n.t('whpaLayerT0')}
            </Text>
            <View style={styles.layerAction} />
          </View>

          {layers.map((layer, index) => {
            const row = cover.layers[index] || {};
            return (
              <View
                key={layer.id}
                style={[styles.tableRow, { borderTopColor: theme.colors.border }]}
              >
                <Text style={[styles.layerCell, styles.layerNo, { color: theme.colors.faint }]}>
                  {index + 1}
                </Text>
                {['k', 'm', 'n'].map((field) => (
                  <TextInput
                    key={field}
                    value={layer[field]}
                    onChangeText={(value) => editLayer(layer.id, field, value)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder="—"
                    placeholderTextColor={theme.colors.faint}
                    selectionColor={theme.colors.primary}
                    style={[
                      styles.layerCell,
                      styles.layerInput,
                      { color: theme.colors.secondary },
                    ]}
                  />
                ))}
                <Text
                  style={[styles.layerCell, styles.layerTime, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {Number.isFinite(row.t0) ? formatCompact(row.t0) : '—'}
                </Text>
                <Pressable
                  onPress={() => removeLayer(layer.id)}
                  disabled={layers.length < 2}
                  style={styles.layerAction}
                  accessibilityRole="button"
                  accessibilityLabel={I18n.t('whpaRemoveLayer')}
                >
                  <MaterialIcons
                    name="close"
                    size={15}
                    color={layers.length < 2 ? theme.colors.border : theme.colors.faint}
                  />
                </Pressable>
              </View>
            );
          })}

          <Pressable
            onPress={addLayer}
            style={[styles.layerAdd, { borderTopColor: theme.colors.border }]}
            accessibilityRole="button"
          >
            <MaterialIcons name="add" size={16} color={theme.colors.primaryAccent} />
            <Text style={[type.caption, { color: theme.colors.primaryAccent }]}>
              {I18n.t('whpaAddLayer')}
            </Text>
          </Pressable>
        </Card>

        <ResultCard
          title={I18n.t('whpaPercResultTitle')}
          label="t₀"
          value={formatCompact(cover.t0)}
          unit={I18n.t('unitDays')}
        />
        <Notices
          codes={[cover.protected ? 'whpaPercProtected' : 'whpaPercUnprotected']}
          tone={cover.protected ? 'warning' : 'error'}
        />

        <Collapsible title={I18n.t('whpaDetailsGroup')} note="ƒ">
          <Formula>{I18n.t('whpaPercFormula')}</Formula>
          <Note>{I18n.t('whpaPercSource')}</Note>
        </Collapsible>
      </AppearIn>
    </>
  );
}

const styles = StyleSheet.create({
  firstLabel: {
    marginTop: 0,
  },
  spaced: {
    marginTop: spacing.md,
  },
  plan: {
    marginTop: spacing.md,
  },
  // Накладки позиционируются относительно этого блока, а он точно повторяет
  // границы карты
  mapBlock: {
    position: 'relative',
  },
  mapFull: {
    flex: 1,
  },
  fullscreen: {
    flex: 1,
  },
  mapExpand: {
    position: 'absolute',
    right: spacing.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Геопозиция стоит левее разворота, в один ряд с ним
  mapLocate: {
    position: 'absolute',
    right: spacing.md + 42 + spacing.sm,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapNotice: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  cell: {
    fontFamily: fontFamily.mono,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },
  cellBelt: {
    flex: 1.5,
    textAlign: 'left',
  },
  cellIndex: {
    flex: 0.4,
    textAlign: 'left',
  },

  // --- Разрез зоны аэрации ------------------------------------------------
  layerCell: {
    fontFamily: fontFamily.mono,
    flex: 1,
    // Без нулевого минимума веб отдаёт каждому <input> его «естественную»
    // ширину в двадцать знаков: строка разъезжалась, и последние колонки
    // выдавливало за край карточки
    minWidth: 0,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'right',
  },
  layerNo: {
    flex: 0.35,
    textAlign: 'left',
  },
  layerTime: {
    flex: 0.95,
  },
  layerInput: {
    paddingVertical: 0,
    borderWidth: 0,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  layerAction: {
    width: 22,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  layerAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
