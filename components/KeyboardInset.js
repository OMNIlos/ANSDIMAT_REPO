/**
 * Место под экранной клавиатурой на Android
 *
 * Приложение рисуется от края до края (`edgeToEdgeEnabled`), и в этом режиме
 * Android больше не ужимает окно под клавиатуру: `adjustResize` не работает.
 * Поле ввода в нижней половине экрана — новая строка журнала, заметка,
 * длинная форма калькулятора — оставалось под клавишами, и вводить приходилось
 * вслепую.
 *
 * Обёртка стоит вокруг каждого экрана стека (см. `screenLayout` в
 * навигаторе). Когда клавиатура открыта, она отводит снизу ровно столько,
 * сколько клавиатура перекрывает. Экран ужимается, а прокрутка Android при
 * смене своей высоты сама доводит поле с фокусом до видимой части — так же,
 * как это делал `adjustResize`.
 *
 * Перекрытие меряется от положения обёртки в окне (`measureInWindow`), а не
 * от раскладки относительно родителя, как у KeyboardAvoidingView: над экраном
 * стоит шапка навигатора, и расчёт от родителя ошибался бы на её высоту.
 *
 * На iOS и в вебе ничего не делает: там окно или браузер справляются сами.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, StyleSheet, View } from 'react-native';

export default function KeyboardInset({ children }) {
  const ref = useRef(null);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardHeight = event?.endCoordinates?.height;
      if (typeof keyboardHeight !== 'number') return;
      // Всё в координатах окна: measureInWindow отсчитывает от низа строки
      // состояния, а screenY клавиатуры — от верха экрана, и расчёт по нему
      // недодавал ровно высоту строки состояния (на S10e с вырезом — 39 dp,
      // поле оставалось под верхним рядом клавиш). Окно кончается у полосы
      // навигации, клавиатура стоит на ней же
      const keyboardTop = Dimensions.get('window').height - keyboardHeight;
      ref.current?.measureInWindow((x, y, width, height) => {
        setInset(Math.max(0, Math.round(y + height - keyboardTop)));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={ref} style={[styles.fill, inset > 0 && { paddingBottom: inset }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
