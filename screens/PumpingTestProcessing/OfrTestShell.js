/**
 * Общая обвязка экранов ОФР со своей расчётной схемой
 *
 * Экспресс-опробование, поинтервальное нагнетание и налив в шурф считаются
 * по-разному, но живут одинаково: журнал читается из базы при открытии, поля
 * стоят в размерностях пользователя, а правка сразу уходит обратно в базу.
 * Всё это собрано здесь, чтобы три экрана занимались только своим расчётом.
 *
 * Хранение и запись идут в базовых единицах — метрах, минутах, паскалях, —
 * а перевод стоит на границе: `read` разворачивает базовое число в текст поля,
 * `write` собирает набор величин обратно. Иначе смена размерности в
 * настройках меняла бы смысл уже введённых чисел.
 *
 * Запись отложена: поле правят посимвольно, и писать в базу на каждое
 * нажатие значило бы держать очередь запросов длиной в набранное число.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
// Прокрутка из gesture-handler: только её умеет блокировать жест графика,
// пока палец тянет полотно. Обычный ScrollView из react-native этого не умеет
import {
  ScrollView,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useTheme } from 'react-native-paper';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import I18n from '../../Localization';
import { getProject, updateProject } from '../../db/projects';
import { defaultParams } from '../../db/params';
import { MENU_BAR_HEIGHT } from '../../components/BottomMenuBar';
import { styles as shared } from '../calculator/shared';
import { spacing, type } from '../../theme';

/** Задержка перед записью правки в базу, мс */
const SAVE_DELAY = 400;

/**
 * Держит исходные данные журнала и пишет их в базу
 *
 * @param {string} projectId - идентификатор журнала
 * @param {string} ofrType - вид ОФР; нужен, пока журнал не прочитан
 * @returns {{project: Object|null, params: Object|null, setParams: Function,
 *   loading: boolean}} состояние журнала
 */
export function useOfrParams(projectId, ofrType) {
  const [project, setProject] = useState(null);
  const [params, setParamsState] = useState(() => defaultParams(ofrType));
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);
  // Правка, ещё не ушедшая в базу: по ней экран дописывает её на выходе
  const pending = useRef(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    const loaded = await getProject(projectId);
    if (!loaded) {
      setLoading(false);
      return;
    }
    setProject(loaded);
    setParamsState(loaded.params ?? defaultParams(loaded.ofrType));
    setLoading(false);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /**
   * Записывает набор величин в базу
   *
   * @param {Object} next - набор величин в базовых единицах
   */
  const flush = useCallback(
    (next) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      pending.current = null;
      if (!projectId || !next) return;
      updateProject(projectId, { params: next }).catch(() => {
        // Запись не удалась — правка остаётся на экране, и следующая уйдёт
        // вместе со следующим нажатием. Ронять ввод из-за одного отказа
        // базы незачем
      });
    },
    [projectId]
  );

  const setParams = useCallback(
    (updater) => {
      setParamsState((previous) => {
        const next =
          typeof updater === 'function' ? updater(previous) : updater;
        pending.current = next;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => flush(next), SAVE_DELAY);
        return next;
      });
    },
    [flush]
  );

  // Уходя с экрана, недописанную правку дописываем, а не отменяем: иначе
  // последнее набранное число терялось бы на выходе по «назад»
  useEffect(
    () => () => {
      if (pending.current) flush(pending.current);
    },
    [flush]
  );

  return { project, params, setParams, loading };
}

/**
 * Поля ввода в размерностях пользователя поверх базовых чисел
 *
 * Пока поле в фокусе, оно живёт своим текстом: пересобирать его из числа на
 * каждое нажатие значило бы стирать незаконченный ввод — «0.» превращалось бы
 * в «0», а минус исчезал до того, как наберут цифру. Как только текст
 * разбирается в число, оно уходит в набор величин.
 *
 * @param {Object} params - набор величин в базовых единицах
 * @param {Function} setParams - запись набора
 * @param {Function} fromBase - перевод из базовой единицы
 * @param {Function} toBase - перевод в базовую единицу
 * @returns {{text: Function, change: Function, editing: Function,
 *   forget: Function, draftOr: Function, draftChange: Function}} чтение поля,
 *   запись, признак незаконченного ввода, сброс набранного текста и та же
 *   пара для полей, лежащих глубже `params`
 */
export function useParamFields(params, setParams, fromBase, toBase) {
  // Ключ → набранный текст. Живёт, пока поле правят: как только правка ушла
  // в базу и вернулась числом, показывается уже отформатированное число
  const [drafts, setDrafts] = useState({});

  // Смена размерности в настройках обнуляет черновики: иначе в поле осталось
  // бы число прежней единицы с новой подписью
  useEffect(() => setDrafts({}), [fromBase]);

  const text = useCallback(
    (key, quantity) => {
      if (drafts[key] !== undefined) return drafts[key];
      const value = params?.[key];
      // Ноль в базе значит «не задано» — так же, как в журналах откачек:
      // показывать его цифрой значило бы выдавать пустое поле за заполненное
      if (!isFinite(value) || value === 0) return '';
      const converted = quantity ? fromBase(value, quantity) : value;
      return isFinite(converted)
        ? String(Number(converted.toPrecision(6)))
        : '';
    },
    [drafts, params, fromBase]
  );

  const change = useCallback(
    (key, quantity) => (input) => {
      setDrafts((previous) => ({ ...previous, [key]: input }));
      const normalized = String(input).replace(',', '.').trim();
      const parsed = normalized === '' ? 0 : Number(normalized);
      if (!isFinite(parsed)) return;
      const value = quantity ? toBase(parsed, quantity) : parsed;
      setParams((previous) => ({ ...previous, [key]: value }));
    },
    [setParams, toBase]
  );

  /**
   * Правят ли поле прямо сейчас
   *
   * Пока в поле лежит незаконченный ввод, показывать вместо него посчитанное
   * значение нельзя: расход выводится из объёма и интервала, и подстановка
   * посреди набора стирала бы набранное на полуслове.
   *
   * @param {string} key - ключ величины
   * @returns {boolean} есть ли набранный текст
   */
  const editing = useCallback((key) => drafts[key] !== undefined, [drafts]);

  /**
   * Забывает набранный в поле текст
   *
   * Нужно, когда число приходит не из поля, а со стороны — подстановкой из
   * справочника пород. Черновик живёт, пока поле правят, и без сброса он
   * перекрыл бы подставленное значение: геолог жмёт «Супесь», а в поле
   * остаётся то, что он набрал руками до этого.
   *
   * @param {...string} keys - ключи величин
   */
  const forget = useCallback((...keys) => {
    setDrafts((previous) => {
      if (!keys.some((key) => previous[key] !== undefined)) return previous;
      const next = { ...previous };
      for (const key of keys) delete next[key];
      return next;
    });
  }, []);

  /**
   * Набранный текст поля, если его правят, иначе готовое значение
   *
   * Нужно полям, число которых лежит не в `params` по ключу, а глубже —
   * в ступенях поинтервального нагнетания. Круг «текст → число → текст» у них
   * тот же самый, и спасает от него тот же черновик: без него «0,» уходило
   * в ноль и возвращалось пустотой, а значение меньше единицы было не набрать.
   *
   * @param {string} key - ключ черновика, уникальный в пределах экрана
   * @param {string} ready - что показать, когда поле не правят
   * @returns {string} текст поля
   */
  const draftOr = useCallback(
    (key, ready) => (drafts[key] !== undefined ? drafts[key] : ready),
    [drafts]
  );

  /**
   * Обработчик правки поля, число которого лежит глубже `params`
   *
   * Число отдаётся наружу в размерности пользователя: куда его писать и как
   * переводить в базовую, знает экран, а не обвязка. Пустое поле отдаётся
   * как `null` — «не задано» и «ноль» на разных экранах значат разное.
   *
   * @param {string} key - ключ черновика
   * @param {Function} onValue - (value: number|null) => void
   * @returns {Function} обработчик onChangeText
   */
  const draftChange = useCallback(
    (key, onValue) => (input) => {
      setDrafts((previous) => ({ ...previous, [key]: input }));
      const normalized = String(input).replace(',', '.').trim();
      if (normalized === '') {
        onValue(null);
        return;
      }
      const parsed = Number(normalized);
      // Незаконченный ввод — «1,» разбирается в 1, «-» ни во что — оставляем
      // в поле как есть и в набор величин не пишем
      if (!isFinite(parsed)) return;
      onValue(parsed);
    },
    []
  );

  return { text, change, editing, forget, draftOr, draftChange };
}

/**
 * Каркас экрана: заголовок, прокрутка и отступ под плавающим меню
 *
 * @param {Object} props
 * @param {string} props.title - название вида опробования
 * @param {string} props.subtitle - решение, по которому идёт расчёт
 * @param {string} [props.name] - название журнала
 * @param {boolean} props.loading - журнал ещё читается
 * @param {React.ReactNode} [props.overlay] - накладка поверх экрана:
 *   развёрнутый график. Лежит рядом с прокруткой, а не внутри неё, иначе
 *   Modal оказался бы внутри прокручиваемого содержимого
 * @returns {React.ReactElement} экран
 */
export default function OfrTestShell({
  title,
  subtitle,
  name,
  loading,
  overlay,
  children,
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // Через контекст, а не через хук: без провайдера хук падает, и экран
  // нельзя было бы отрисовать в тесте отдельно от приложения
  const insets = React.useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  const contentWidth = Math.min(width, 720) - spacing.lg * 2;
  // Нужен графику: пока палец тянет полотно, прокрутка экрана блокируется
  const scrollRef = useRef(null);

  const body = useMemo(
    () =>
      typeof children === 'function'
        ? children({ contentWidth, scrollRef })
        : children,
    [children, contentWidth]
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          shared.content,
          { paddingBottom: Math.max(insets.bottom, 26) + MENU_BAR_HEIGHT + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {name ? (
            <Text
              style={[type.eyebrow, { color: theme.colors.faint }]}
              numberOfLines={1}
            >
              {name}
            </Text>
          ) : null}
          <Text style={[type.title, { color: theme.colors.text }]}>
            {I18n.t(title)}
          </Text>
          <Text style={[type.caption, { color: theme.colors.textSecondary }]}>
            {I18n.t(subtitle)}
          </Text>
        </View>
        {body}
      </ScrollView>
      {overlay}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
});
