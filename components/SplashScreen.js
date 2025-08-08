/**
 * Компонент экрана загрузки (Splash Screen)
 * 
 * Этот компонент отображается при запуске приложения и содержит:
 * - Логотип приложения
 * - Название приложения
 * - Подзаголовок с описанием
 * - Информацию о сайте и копирайте
 * 
 * Автоматически скрывается через 2.5 секунды и вызывает onFinish callback
 * 
 * @param {Function} onFinish - Callback функция, вызываемая по истечении таймера
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Dimensions, Image } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../Localization';

// Получаем размеры экрана для адаптивного дизайна
const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  // Получаем текущую тему для адаптивного дизайна
  const theme = useTheme();
  // Получаем текущий год для копирайта
  const currentYear = new Date().getFullYear();
  
  /**
   * Эффект для автоматического скрытия экрана загрузки
   * Устанавливает таймер на 2.5 секунды, после чего вызывает onFinish
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish(); // Вызываем callback для перехода к основному приложению
    }, 2500); // Время отображения экрана загрузки (2.5 секунды)

    // Очищаем таймер при размонтировании компонента
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    // Основной контейнер с фоном в цвете primary (бордовый)
    <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
      {/* Настройка статус-бара для соответствия дизайну */}
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />
      
      {/* Контейнер для логотипа и текста */}
      <View style={styles.logoContainer}>
        {/* Контейнер для логотипа с прозрачным фоном */}
        <View style={[styles.logoBackground, { backgroundColor: 'transparent' }]}>
          {/* Логотип приложения */}
          <Image
            source={require('../assets/splash.png')}
            style={{ width: 120, height: 120, borderRadius: 18 }}
            resizeMode="contain"
          />
        </View>
        
        {/* Название приложения */}
        <Text style={[styles.appName, { color: theme.colors.white }]}>
          {I18n.t('homeTitle')}
        </Text>
        
        {/* Подзаголовок с описанием приложения */}
        <Text style={[styles.subtitle, { color: theme.colors.white }]}>
          {I18n.t('appSubtitle')}
        </Text>
      </View>
      
      {/* Футер с информацией о сайте и копирайтом */}
      <View style={styles.footer}>
        {/* Ссылка на сайт */}
        <Text style={[styles.website, { color: theme.colors.white }]}>
          ansdimat.com
        </Text>
        {/* Копирайт с текущим годом */}
        <Text style={[styles.copyright, { color: theme.colors.white }]}>
          © {currentYear} {I18n.t('homeTitle')}
        </Text>
      </View>
    </View>
  );
}

/**
 * Стили для компонента SplashScreen
 * 
 * Определяют внешний вид и расположение всех элементов экрана загрузки
 */
const styles = StyleSheet.create({
  // Основной контейнер - занимает весь экран с центрированным содержимым
  container: {
    flex: 1, // Занимает все доступное пространство
    justifyContent: 'center', // Центрирует содержимое по вертикали
    alignItems: 'center', // Центрирует содержимое по горизонтали
    paddingHorizontal: 20, // Отступы по бокам для адаптивности
  },
  
  // Контейнер для логотипа и текста - центрирует элементы
  logoContainer: {
    alignItems: 'center', // Центрирует элементы по горизонтали
    justifyContent: 'center', // Центрирует элементы по вертикали
    flex: 1, // Занимает все доступное пространство
  },
  
  // Контейнер для логотипа с закругленными углами
  logoBackground: {
    width: 120, // Ширина логотипа
    height: 120, // Высота логотипа
    borderRadius: 20, // Радиус закругления углов
    justifyContent: 'center', // Центрирует логотип по вертикали
    alignItems: 'center', // Центрирует логотип по горизонтали
    marginBottom: 30, // Отступ снизу для разделения с текстом
  },

  // Стиль для названия приложения
  appName: {
    fontSize: 32, // Размер шрифта
    fontWeight: 'bold', // Жирный шрифт
    textAlign: 'center', // Выравнивание по центру
    marginBottom: 15, // Отступ снизу
    letterSpacing: 2, // Расстояние между буквами
  },
  
  // Стиль для подзаголовка
  subtitle: {
    fontSize: 16, // Размер шрифта
    textAlign: 'center', // Выравнивание по центру
    opacity: 0.9, // Прозрачность для визуальной иерархии
    maxWidth: width * 0.8, // Максимальная ширина (80% от ширины экрана)
    lineHeight: 22, // Высота строки для читаемости
  },
  
  // Контейнер для футера - позиционируется внизу экрана
  footer: {
    position: 'absolute', // Абсолютное позиционирование
    bottom: 50, // Отступ от низа экрана
    alignItems: 'center', // Центрирует элементы по горизонтали
  },
  
  // Стиль для ссылки на сайт
  website: {
    fontSize: 16, // Размер шрифта
    fontWeight: '600', // Полужирный шрифт
    marginBottom: 5, // Отступ снизу
  },
  
  // Стиль для копирайта
  copyright: {
    fontSize: 12, // Размер шрифта
    opacity: 0.8, // Прозрачность для визуальной иерархии
  },
}); 