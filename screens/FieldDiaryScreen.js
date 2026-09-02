/**
 * Полевой дневник — точки наблюдения с геопривязкой
 *
 * Тап по карте ставит точку в выбранном месте, кнопка внизу — в текущей
 * геопозиции. Оба пути ведут к одной записи в базе: в поле удобнее ставить
 * точку пальцем по карте, а при работе на самой скважине — по координатам.
 *
 * Координаты показываются моноширинным шрифтом: цифры выравниваются
 * по разрядам, и подмену знака в списке видно сразу.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import I18n from '../Localization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FieldMap from '../components/FieldMap';
import { MENU_BAR_HEIGHT } from '../components/BottomMenuBar';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  listPoints,
  createPoint,
  updatePoint,
  deletePoint,
  getPointStats,
} from '../db/points';
import { POINT_TYPES } from '../db/schema';
import PointSheet from '../components/PointSheet';
import {
  ATTACHMENT_KINDS,
  listAttachments,
  addAttachment,
  deleteAttachment,
} from '../db/attachments';
import { spacing, radius, type, elevation, pointTypeColors, numericAt } from '../theme';

const TYPE_OPTIONS = [
  { key: POINT_TYPES.WELL, labelKey: 'pointTypeWell' },
  { key: POINT_TYPES.SPRING, labelKey: 'pointTypeSpring' },
  { key: POINT_TYPES.PIT, labelKey: 'pointTypePit' },
  { key: POINT_TYPES.OBSERVATION, labelKey: 'pointTypeObservationPoint' },
];

/**
 * Форматирует координату с фиксированной точностью
 *
 * Четыре знака после запятой — это около 10 м на местности, чего достаточно
 * для привязки точки наблюдения.
 *
 * @param {number} value - координата
 * @returns {string} отформатированная координата
 */
function formatCoordinate(value) {
  return Number(value).toFixed(4);
}

/**
 * Форматирует время записи
 *
 * @param {number} timestamp - метка времени
 * @returns {string} время в формате ЧЧ:ММ
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Поле описания, растущее под свой текст
 *
 * Многострочное поле держит ту высоту, что задана стилем, и описание длиннее
 * двух строк прокручивается внутри рамки — в списке от него видно начало и
 * полосу прокрутки. Описание пишут, чтобы его читать, поэтому высота берётся
 * от содержимого, а заданная в стиле остаётся нижней границей.
 *
 * Объявлено на уровне модуля, а не в теле экрана: описанное внутри, оно было
 * бы новым типом компонента на каждом ре-рендере, и поле теряло бы фокус
 * после первого же символа.
 *
 * @param {Object} props
 * @param {number} props.minHeight - высота пустого поля
 */
function GrowingNoteInput({ minHeight, style, ...rest }) {
  const [height, setHeight] = useState(0);

  return (
    <TextInput
      {...rest}
      multiline
      textAlignVertical="top"
      onContentSizeChange={(event) => {
        const measured = Math.ceil(event.nativeEvent.contentSize.height);
        setHeight((prev) => (prev === measured ? prev : measured));
      }}
      style={[style, { height: Math.max(minHeight, height) }]}
    />
  );
}

/**
 * Сколько снимков и записей у точки
 *
 * @param {Array} [items] - вложения точки
 * @returns {{photos: number, records: number}} счётчики
 */
function countAttachments(items = []) {
  return {
    photos: items.filter((item) => item.kind === ATTACHMENT_KINDS.PHOTO).length,
    records: items.filter((item) => item.kind === ATTACHMENT_KINDS.AUDIO).length,
  };
}

/**
 * Подпись бейджа для чтения с экрана
 *
 * Счётчики раздельные: искать снимок среди записей и наоборот приходится
 * по-разному, и «три вложения» не сказало бы, чего именно три.
 *
 * @param {Array} [items] - вложения точки
 * @returns {Object|undefined} значение для accessibilityValue
 */
function badgeValue(items) {
  const { photos, records } = countAttachments(items);
  if (photos === 0 && records === 0) return undefined;
  return {
    text: `${photos} ${I18n.t('photoCount', { defaultValue: 'снимков' })}, ${records} ${I18n.t(
      'voiceNoteCount',
      { defaultValue: 'записей' }
    )}`,
  };
}

/**
 * Бейдж вложений в шапке карточки точки
 *
 * На пустой точке — одна контурная скрепка: без неё шторку нечем открыть и
 * первое вложение некуда добавить.
 *
 * @param {Object} props
 * @param {Array} [props.items] - вложения точки
 * @param {Object} props.colors - палитра темы
 */
function PointBadge({ items, colors }) {
  const { photos, records } = countAttachments(items);

  if (photos === 0 && records === 0) {
    return <MaterialIcons name="attach-file" size={18} color={colors.faint} />;
  }

  return (
    <View style={styles.badgeRow}>
      {photos > 0 && (
        <View style={styles.badgeItem}>
          <MaterialIcons name="photo-camera" size={15} color={colors.primaryAccent} />
          <Text style={[styles.badgeCount, { color: colors.primaryAccent }]}>{photos}</Text>
        </View>
      )}
      {records > 0 && (
        <View style={styles.badgeItem}>
          <MaterialIcons name="mic-none" size={15} color={colors.primaryAccent} />
          <Text style={[styles.badgeCount, { color: colors.primaryAccent }]}>{records}</Text>
        </View>
      )}
    </View>
  );
}

export default function FieldDiaryScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Кнопки развёрнутой карты поднимаются над меню приложения по фактической
  // высоте: раньше отступ был подобран числом и на телефонах с жестовой
  // навигацией кнопки садились прямо на полосу меню
  const buttonsAboveMenu = Math.max(insets.bottom, 26) + MENU_BAR_HEIGHT + 12;

  const [points, setPoints] = useState([]);
  const [stats, setStats] = useState({ total: 0, types: 0, lastRecordedAt: null });
  const [title, setTitle] = useState('');
  // Описание новой точки. Название её только называет, а чем она отличается от
  // соседней — глубиной, обсадкой, подходом, запахом воды — держится в
  // описании, и без него запись в дневнике ничего не сообщает
  const [note, setNote] = useState('');
  // Описания уже поставленных точек: правятся прямо в списке, ключ — точка
  const [noteDrafts, setNoteDrafts] = useState({});
  const [pointType, setPointType] = useState(POINT_TYPES.WELL);
  // Куда центрировать карту — задаётся после определения геопозиции
  const [center, setCenter] = useState(null);
  // Точка, для которой запрошено удаление
  const [pendingDelete, setPendingDelete] = useState(null);
  // Вложения всех точек: карта «точка → вложения». Читаются одним запросом
  // вместе со списком — запрос на точку дал бы столько обращений к базе,
  // сколько в дневнике точек
  const [attachments, setAttachments] = useState({});
  // Точка, чья шторка вложений открыта
  const [sheetPointId, setSheetPointId] = useState(null);
  // Сообщение о проблеме с геопозицией и признак ожидания координат
  const [notice, setNotice] = useState('');
  const [locating, setLocating] = useState(false);
  // Развёрнута ли карта на весь экран
  const [mapFullscreen, setMapFullscreen] = useState(false);

  const load = useCallback(async () => {
    const loaded = await listPoints();
    setPoints(loaded);
    // Поля описаний наполняются тем, что лежит в базе: экран перечитывается
    // при каждом возврате, и своё написанное геолог должен увидеть на месте
    setNoteDrafts(
      Object.fromEntries(loaded.map((point) => [point.id, point.note ?? '']))
    );
    setAttachments(await listAttachments(loaded.map((point) => point.id)));
    setStats(await getPointStats());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /**
   * Точки, у которых описание в поле разошлось с записанным в базе
   *
   * Пишутся только они: иначе каждое открытие дневника метило бы весь список
   * как правленый и гнало его в синхронизацию.
   *
   * @param {Array} list - точки
   * @param {Object} drafts - описания из полей, ключ — точка
   * @returns {Array} точки с неcохранённым описанием
   */
  const editedNotes = (list, drafts) =>
    list.filter(
      (point) =>
        drafts[point.id] !== undefined && drafts[point.id] !== point.note
    );

  /**
   * Автосохранение описаний
   *
   * Записью по onBlur описание терялось бы чаще, чем сохранялось: с
   * клавиатуры в поле уходят кнопкой «назад», а не касанием соседнего поля,
   * и последнее написанное никуда не попадало. Пауза в наборе — тот же
   * приём, что в журнале замеров.
   */
  useEffect(() => {
    const changed = editedNotes(points, noteDrafts);
    if (changed.length === 0) return undefined;

    const timer = setTimeout(() => {
      for (const point of changed) {
        updatePoint(point.id, { note: noteDrafts[point.id] }).catch(() => {});
      }
      // Записанное считается сохранённым: без этого следующий проход писал бы
      // те же описания снова
      setPoints((prev) =>
        prev.map((point) =>
          noteDrafts[point.id] !== undefined
            ? { ...point, note: noteDrafts[point.id] }
            : point
        )
      );
    }, 600);

    return () => clearTimeout(timer);
  }, [points, noteDrafts]);

  // Уход с экрана раньше паузы в наборе снимает отложенную запись вместе с
  // самим экраном, поэтому недописанное дожимается здесь. Ссылка, а не
  // зависимость: эффект должен сработать один раз, при размонтировании
  const pendingNotes = useRef({ points: [], drafts: {} });
  pendingNotes.current = { points, drafts: noteDrafts };

  useEffect(
    () => () => {
      const { points: last, drafts } = pendingNotes.current;
      for (const point of editedNotes(last, drafts)) {
        updatePoint(point.id, { note: drafts[point.id] }).catch(() => {});
      }
    },
    []
  );

  /**
   * Создаёт точку с заданными координатами
   */
  const addPointAt = async (lat, lon) => {
    const name = title.trim() || `${I18n.t(`pointType_${pointType}`, { defaultValue: 'Точка' })} ${points.length + 1}`;
    await createPoint({ title: name, lat, lon, type: pointType, note: note.trim() });
    setTitle('');
    setNote('');
    await load();
  };

  /**
   * Запрашивает текущие координаты устройства
   *
   * @returns {Promise<{latitude: number, longitude: number}|null>} координаты
   *   или null, если доступ не выдан либо позицию определить не удалось
   */
  const getMyCoords = async () => {
    setNotice('');
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Сообщение выводится плашкой на самом экране, а не Alert.alert:
        // на вебе тот не показывается вообще, и отказ в доступе выглядел
        // как будто кнопка просто не работает
        setNotice(
          I18n.t('locationDenied', {
            defaultValue: 'Нет доступа к геопозиции. Разрешите его в настройках или отметьте точку тапом по карте.',
          })
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return location.coords;
    } catch {
      setNotice(
        I18n.t('locationFailed', {
          defaultValue: 'Не удалось определить местоположение. Под землёй и в здании сигнала может не быть — поставьте точку по карте.',
        })
      );
      return null;
    } finally {
      setLocating(false);
    }
  };

  /**
   * Подводит карту к текущей геопозиции, ничего не записывая
   */
  const centerOnMyLocation = async () => {
    const coords = await getMyCoords();
    if (coords) setCenter({ lat: coords.latitude, lon: coords.longitude });
  };

  /**
   * Ставит точку по текущей геопозиции
   */
  const addPointAtMyLocation = async () => {
    const coords = await getMyCoords();
    if (!coords) return;
    // Сначала подводим карту к своей позиции, затем ставим точку —
    // так сразу видно, куда она встала
    setCenter({ lat: coords.latitude, lon: coords.longitude });
    await addPointAt(coords.latitude, coords.longitude);
  };

  const handleDelete = (point) => {
    setPendingDelete(point);
  };

  /**
   * Удаляет точку наблюдения и обновляет список
   */
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deletePoint(pendingDelete.id);
    setPendingDelete(null);
    await load();
  };

  /**
   * Записывает новое вложение открытой точки
   *
   * Список перечитывается целиком: без этого счётчик в карточке остался бы
   * прежним, и снятое выглядело бы потерянным.
   *
   * @param {Object} attachment - {kind, uri, durationMillis?, waveform?}
   */
  const handleAddAttachment = async (attachment) => {
    if (!sheetPointId) return;
    await addAttachment({ pointId: sheetPointId, ...attachment });
    await load();
  };

  /**
   * Удаляет вложение вместе с файлом
   *
   * @param {Object} attachment - удаляемое вложение
   */
  const handleDeleteAttachment = async (attachment) => {
    await deleteAttachment(attachment.id);
    await load();
  };

  const mapHeight = Math.min(320, Math.max(220, width * 0.62));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Карта вынесена из прокрутки: пока она была внутри списка, движение
          пальцем по ней доставалось прокрутке, и карта под пальцем стояла.
          Отдельным блоком такого конфликта нет в принципе */}
      <View style={[styles.mapBlock, mapFullscreen ? styles.mapBlockFull : styles.mapBlockInline]}>
        {/* Накладки позиционируются относительно этого контейнера, а он точно
            повторяет границы карты. Иначе на полях блока кнопки съезжали
            за её край */}
        <View style={[styles.mapArea, mapFullscreen && styles.mapAreaFull]}>
        <FieldMap
          points={points}
          onPressMap={addPointAt}
          center={center}
          height={mapFullscreen ? undefined : mapHeight}
          flush={mapFullscreen}
        />

        {!mapFullscreen && (
          <View style={[styles.mapHint, { backgroundColor: theme.colors.chip }]} pointerEvents="none">
            <MaterialIcons name="touch-app" size={15} color={theme.colors.primaryAccent} />
            <Text style={[styles.mapHintText, { color: theme.colors.text }]}>
              {I18n.t('tapMapToMark', { defaultValue: 'Нажмите на карту — отметить точку' })}
            </Text>
          </View>
        )}

        {/* Разворот карты на весь экран. В развёрнутом виде список скрыт,
            прокручивать нечего — карта получает жесты целиком */}
        <TouchableOpacity
          style={[
            styles.mapExpand,
            mapFullscreen && { bottom: buttonsAboveMenu },
            elevation.brandButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => setMapFullscreen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: mapFullscreen }}
          accessibilityLabel={
            mapFullscreen
              ? I18n.t('mapCollapse', { defaultValue: 'Свернуть карту' })
              : I18n.t('mapExpand', { defaultValue: 'Развернуть карту на весь экран' })
          }
        >
          <MaterialIcons
            name={mapFullscreen ? 'fullscreen-exit' : 'fullscreen'}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.mapLocate,
            mapFullscreen && { bottom: buttonsAboveMenu },
            elevation.brandButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={centerOnMyLocation}
          accessibilityRole="button"
          accessibilityLabel={I18n.t('centerOnMyLocation', {
            defaultValue: 'Показать моё местоположение на карте',
          })}
        >
          <MaterialIcons name="my-location" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        </View>
      </View>

      {mapFullscreen ? null : (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Статистика */}
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.total}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {I18n.t('pointsCount', { defaultValue: 'точек' })}
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.types}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {I18n.t('typesCount', { defaultValue: 'типа' })}
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {stats.lastRecordedAt ? formatTime(stats.lastRecordedAt) : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              {I18n.t('lastRecord', { defaultValue: 'запись' })}
            </Text>
          </View>
        </View>

        {/* Параметры новой точки */}
        <View
          style={[
            styles.newPointCard,
            elevation.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={I18n.t('pointTitlePlaceholder', { defaultValue: 'Название точки' })}
            placeholderTextColor={theme.colors.textSecondary}
            style={[
              styles.input,
              type.body,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
          />

          {/* Описание точки. Без него в дневнике остаются одни названия, по
              которым через неделю не вспомнить, чем «Скважина 3» отличалась
              от «Скважины 4» */}
          <GrowingNoteInput
            value={note}
            onChangeText={setNote}
            placeholder={I18n.t('pointNotePlaceholder', {
              defaultValue: 'Описание: что за точка, что замерено, как подойти',
            })}
            placeholderTextColor={theme.colors.textSecondary}
            minHeight={72}
            style={[
              styles.input,
              styles.noteInput,
              type.body,
              { borderColor: theme.colors.border, color: theme.colors.text },
            ]}
          />

          <View style={styles.typeRow}>
            {TYPE_OPTIONS.map((option) => {
              const active = option.key === pointType;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setPointType(option.key)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: active ? pointTypeColors[option.key] : 'transparent',
                      borderColor: active ? pointTypeColors[option.key] : theme.colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View
                    style={[styles.typeDot, { backgroundColor: active ? '#FFFFFF' : pointTypeColors[option.key] }]}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: active ? '#FFFFFF' : theme.colors.textSecondary },
                    ]}
                  >
                    {I18n.t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Второй способ поставить точку — по координатам устройства.
              Кнопка в потоке карточки: плавающая пряталась за нижним меню */}
          <TouchableOpacity
            style={[
              styles.locateButton,
              elevation.brandButton,
              { backgroundColor: theme.colors.primary, opacity: locating ? 0.6 : 1 },
            ]}
            onPress={addPointAtMyLocation}
            disabled={locating}
            accessibilityRole="button"
            accessibilityState={{ disabled: locating }}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="my-location" size={18} color="#FFFFFF" />
            )}
            <Text style={styles.locateButtonText}>
              {locating
                ? I18n.t('locating', { defaultValue: 'Определяем координаты…' })
                : I18n.t('markMyLocation', { defaultValue: 'Отметить моё местоположение' })}
            </Text>
          </TouchableOpacity>

          {!!notice && (
            <Text style={[type.caption, styles.notice, { color: theme.colors.error }]}>
              {notice}
            </Text>
          )}
        </View>

        {/* Список точек */}
        <Text style={[type.eyebrow, styles.sectionLabel, { color: theme.colors.textSecondary }]}>
          {I18n.t('observationPoints', { defaultValue: 'Точки наблюдения' })} · {points.length}
        </Text>

        {points.map((point) => (
          <View
            key={point.id}
            style={[
              styles.pointCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.pointRow}>
              <View
                style={[
                  styles.pointDot,
                  { backgroundColor: pointTypeColors[point.type] ?? pointTypeColors.observation },
                ]}
              />
              <View style={styles.pointInfo}>
                <Text style={[type.body, { color: theme.colors.text }]} numberOfLines={1}>
                  {point.title}
                </Text>
                <Text style={[styles.pointCoords, { color: theme.colors.textSecondary }]}>
                  {formatCoordinate(point.lat)}, {formatCoordinate(point.lon)} · {formatTime(point.recordedAt)}
                </Text>
              </View>
              {/* Вложения. Нажимается именно шапка, а не карточка целиком:
                  под ней лежит поле описания, и тап по нему должен ставить
                  курсор, а не открывать шторку */}
              <TouchableOpacity
                onPress={() => setSheetPointId(point.id)}
                style={styles.pointBadge}
                accessibilityRole="button"
                accessibilityLabel={`${I18n.t('openAttachments', {
                  defaultValue: 'Вложения точки',
                })}: ${point.title}`}
                accessibilityValue={badgeValue(attachments[point.id])}
              >
                <PointBadge items={attachments[point.id]} colors={theme.colors} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDelete(point)}
                style={styles.pointDelete}
                accessibilityRole="button"
                accessibilityLabel={I18n.t('delete')}
              >
                <MaterialIcons name="delete-outline" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Описание правится прямо в списке: в поле точку ставят одним
                движением, а описывают её потом — иногда через час, когда
                отошли от скважины */}
            <GrowingNoteInput
              value={noteDrafts[point.id] ?? ''}
              onChangeText={(value) =>
                setNoteDrafts((prev) => ({ ...prev, [point.id]: value }))
              }
              placeholder={I18n.t('addPointNote', { defaultValue: 'Добавить описание' })}
              placeholderTextColor={theme.colors.textSecondary}
              minHeight={44}
              accessibilityLabel={`${I18n.t('pointNote', {
                defaultValue: 'Описание точки',
              })}: ${point.title}`}
              style={[
                styles.pointNote,
                type.body,
                { borderColor: theme.colors.border, color: theme.colors.text },
              ]}
            />
          </View>
        ))}

        {points.length === 0 && (
          <View
            style={[
              styles.empty,
              { backgroundColor: theme.colors.surfaceSunken, borderColor: theme.colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="map-marker-plus-outline"
              size={32}
              color={theme.colors.textSecondary}
            />
            <Text style={[type.caption, styles.emptyText, { color: theme.colors.textSecondary }]}>
              {I18n.t('tapMapToAddPoint', {
                defaultValue: 'Нажмите на карту, чтобы отметить точку',
              })}
            </Text>
          </View>
        )}

        <View style={{ height: 160 }} />
      </ScrollView>
      )}

      <PointSheet
        point={points.find((item) => item.id === sheetPointId) ?? null}
        attachments={attachments[sheetPointId] ?? []}
        visible={sheetPointId !== null}
        onClose={() => setSheetPointId(null)}
        onAdd={handleAddAttachment}
        onDelete={handleDeleteAttachment}
      />

      <ConfirmDialog
        visible={!!pendingDelete}
        title={I18n.t('deletePoint', { defaultValue: 'Удалить точку?' })}
        message={pendingDelete ? `«${pendingDelete.title}» будет удалена из дневника.` : ''}
        confirmLabel={I18n.t('delete', { defaultValue: 'Удалить' })}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  mapBlock: {
    position: 'relative',
  },
  mapBlockInline: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  // Границы самой карты: к ним привязаны подсказка и круглые кнопки
  mapArea: {
    position: 'relative',
  },
  mapAreaFull: {
    flex: 1,
  },
  // Развёрнутая карта занимает всё, что осталось от экрана: сверху шапка
  // навигации, снизу меню приложения — они остаются на местах
  mapBlockFull: {
    flex: 1,
  },
  // Кнопка разворота — зеркально кнопке геопозиции, у левого края
  mapExpand: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHint: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#14070E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  mapHintText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  mapLocate: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    ...numericAt(22),
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  newPointCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // Пустое поле описания открыто на две-три строки: столько в нём и пишут.
  // Дальше высоту задаёт сам текст, см. GrowingNoteInput
  noteInput: {
    lineHeight: 20,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  pointCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Поле описания у поставленной точки. Ниже и с меньшими полями, чем в
  // карточке новой точки: таких полей в списке столько же, сколько точек, и
  // в полный рост они превратили бы список в столбец рамок
  pointNote: {
    marginTop: spacing.sm,
    lineHeight: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.md,
  },
  pointInfo: {
    flex: 1,
  },
  pointCoords: {
    ...type.numeric,
    fontSize: 11,
    marginTop: 2,
  },
  pointDelete: {
    padding: spacing.sm,
  },
  pointBadge: {
    padding: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeCount: {
    ...numericAt(12),
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  locateButton: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  notice: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  locateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
