/**
 * Слой диалога: затемнение на весь экран и окно поверх приложения
 *
 * На Android слой рисуется через Portal из react-native-paper — в том же
 * окне, что и приложение, а не отдельным окном Modal. Прозрачное окно Modal
 * на Android (новая архитектура, Reanimated 3.17 из Expo SDK 53) открывалось
 * пустым, если на экране был хоть один анимированный вид Reanimated: логотип
 * в шапке, графики, вкладки калькулятора. Невидимое окно перехватывало все
 * касания, пока его не закрывали кнопкой «Назад», — так «Выход» и «Удалить
 * журнал» выглядели неработающими. Слою в Portal до этого дела нет.
 *
 * Кнопка «Назад» закрывает слой так же, как закрывала Modal. Если закрыть
 * нельзя (идёт импорт журнала), нажатие поглощается: уйти с экрана посреди
 * записи было бы хуже.
 *
 * На iOS и в вебе остаётся Modal: там он работает, а в браузере вдобавок
 * держит фокус клавиатуры внутри окна.
 *
 * @param {Object} props
 * @param {boolean} props.visible - показан ли слой
 * @param {Function} [props.onRequestClose] - «Назад» или Esc; без него слой
 *   так не закрывается
 * @param {React.ReactNode} props.children - содержимое поверх экрана
 */

import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, Modal, Platform, StatusBar, StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
import { scrimOverHeader } from '../../theme';

/** Длительность проявления слоя, мс — как у animationType="fade" */
const FADE_MS = 180;

const IN_APP_WINDOW = Platform.OS === 'android';

export default function DialogLayer({ visible, onRequestClose, children }) {
  const fade = useRef(new Animated.Value(0)).current;
  // Обработчик — через ссылку: подписка на «Назад» не переставляется на
  // каждой отрисовке экрана, а вызывает всегда свежий
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    if (!IN_APP_WINDOW || !visible) return undefined;
    fade.setValue(0);
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    });
    animation.start();
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current?.();
      return true;
    });
    return () => {
      animation.stop();
      subscription.remove();
    };
  }, [visible, fade]);

  if (!IN_APP_WINDOW) {
    // Затемнение — на весь экран, под системные полосы: приложение рисуется от
    // края до края, и окно Modal без этих флагов кончалось раньше экрана
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onRequestClose}
      >
        {children}
      </Modal>
    );
  }

  if (!visible) return null;

  return (
    <Portal>
      {/* Строку состояния красит система поверх приложения, и слой её не
          накрывает — темнеет она сама. Окно Modal заходило под неё */}
      <StatusBar backgroundColor={scrimOverHeader} animated />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        {children}
      </Animated.View>
    </Portal>
  );
}
