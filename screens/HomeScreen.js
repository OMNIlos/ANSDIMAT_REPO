/**
 * Главный экран приложения АНСДИМАТ
 * 
 * Этот экран является центральной точкой навигации и содержит:
 * - Приветствие пользователя
 * - Карточки основных разделов приложения
 * - Информацию о подписке
 * - Ссылки на дополнительные ресурсы
 * - Адаптивный дизайн для светлой и темной темы
 * 
 * Основные разделы:
 * - Обработка откачек (PumpingTestProcessing)
 * - Калькулятор (Calculator)
 * - Полевой дневник (FieldDiary)
 * - Примеры и видео (ExamplesAndVideos)
 * - Ссылка на десктопную версию
 * 
 * @param {Object} navigation - Объект навигации React Navigation
 */

import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Linking,
  Image,
  BackHandler,
  Platform,
  Alert,
} from 'react-native';
import {
  useTheme,
  Card,
  Title,
  Paragraph,
  Button,
  Surface,
  IconButton,
} from 'react-native-paper';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LanguageContext } from '../LanguageContext.js';
import { SubscriptionManager } from '../utils/SubscriptionManager';
import I18n from '../Localization';
import Vector4 from '../components/Vector4';

// Получаем ширину экрана для адаптивного дизайна
const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  // Получаем текущую тему для адаптивного дизайна
  const theme = useTheme();
  // Получаем текущий язык из контекста
  const { locale } = useContext(LanguageContext);
  // Состояние статуса подписки пользователя
  const [subscriptionStatus, setSubscriptionStatus] = useState(false);

  /**
   * Эффект для проверки статуса подписки при загрузке экрана
   * Вызывается один раз при монтировании компонента
   */
  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  /**
   * Проверяет статус подписки пользователя
   * Обновляет состояние subscriptionStatus на основе данных из SubscriptionManager
   */
  const checkSubscriptionStatus = async () => {
    const status = await SubscriptionManager.getSubscriptionStatus();
    setSubscriptionStatus(status);
  };
  
  /**
   * Массив пунктов главного меню
   * 
   * Каждый пункт содержит:
   * - id: уникальный идентификатор
   * - title: название раздела (локализованное)
   * - subtitle: описание раздела (локализованное)
   * - icon: название иконки
   * - iconFamily: семейство иконок (material или community)
   * - color: цвет акцента для раздела
   * - onPress: функция навигации или действия
   */
  const menuItems = [
    {
      id: 'pumping',
      title: I18n.t('pumpingTest', { defaultValue: 'Обработка откачек' }),
      subtitle: I18n.t('pumpingTestDesc', { 
        defaultValue: 'Анализ данных откачки скважин' 
      }),
      icon: 'water-pump',
      iconFamily: 'community', // MaterialCommunityIcons
      color: theme.colors.primary, // Основной бордовый цвет
      onPress: () => navigation.navigate('PumpingTestProcessing'),
    },
    {
      id: 'calculator',
      title: I18n.t('calculator', { defaultValue: 'Калькулятор' }),
      subtitle: I18n.t('calculatorDesc', { 
        defaultValue: 'Гидрогеологические расчеты' 
      }),
      icon: 'calculate',
      iconFamily: 'material', // MaterialIcons
      color: theme.colors.secondary, // Синий акцент
      onPress: () => navigation.navigate('Calculator'),
    },
    {
      id: 'field-diary',
      title: I18n.t('field', { defaultValue: 'Полевой дневник' }),
      subtitle: I18n.t('fieldDesc', { 
        defaultValue: 'Запись данных в полевых условиях' 
      }),
      icon: 'map-outline',
      iconFamily: 'community', // MaterialCommunityIcons
      color: theme.colors.primary, // Основной бордовый цвет
      onPress: () => navigation.navigate('FieldDiary'),
    },
    {
      id: 'examples',
      title: I18n.t('examples', { defaultValue: 'Примеры и видео' }),
      subtitle: I18n.t('examplesDesc', { 
        defaultValue: 'Обучающие материалы' 
      }),
      icon: 'play-circle-outline',
      iconFamily: 'community', // MaterialCommunityIcons
      color: theme.colors.secondary, // Синий акцент
      onPress: () => navigation.navigate('ExamplesAndVideos'),
    },
    {
      id: 'program-adds',
      title: I18n.t("homeTitle", { defaultValue: 'АНСДИМАТ' }),
      subtitle: I18n.t('programAddsDesc', { 
        defaultValue: 'Программа для повседневных гидрогеологических расчетов для windows.' 
      }), 
      onPress: () => Linking.openURL('https://www.ansdimat.com/'),
    },
    
  ];

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, { borderColor: theme.colors.border, backgroundColor: item.id === 'program-adds' ? theme.colors.d4d4d4 : theme.colors.surface }]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <Surface style={item.id === 'program-adds' ? [{width: 40, height: 40, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 16,}] : [styles.iconContainer, { backgroundColor: item.color }]}> 
        {item.id === 'program-adds' ? (
          <Image
            source={require('../assets/Logo_main.png')}
            style={{ width: 40, height: 40 }}
            resizeMode="contain"
          />
        ) : item.iconFamily === 'community' ? (
          <MaterialCommunityIcons name={item.icon} size={28} color={theme.colors.white} />
        ) : (
          <MaterialIcons name={item.icon} size={28} color={theme.colors.white} />
        )}
      </Surface>
      
      <View style={styles.textContainer}>
        <Text style={[styles.itemTitle, { color: theme.colors.text }]}> 
          {item.title}
        </Text>
        <Text style={[styles.itemSubtitle, { color: theme.colors.textSecondary }]}> 
          {item.subtitle}
        </Text>
      </View>
      
      <MaterialIcons 
        name="arrow-forward-ios" 
        size={16} 
        color={theme.colors.textSecondary} 
      />
    </TouchableOpacity>
  );



  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >

        {/* Основное меню */}
        <View style={styles.menuContainer}>
          <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {I18n.t('mainMenu', { defaultValue: 'Основные функции' })}
            </Text>

            <Vector4 width={60} height={50} color={theme.colors.text} /> 
          </View>
          
          
          <View style={styles.menuGrid}>
            {menuItems.map(renderMenuItem)}
          </View>
        </View>

        
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subscriptionCard: {
    marginBottom: 24,
    elevation: 2,
  },
  subscriptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subscriptionText: {
    marginLeft: 12,
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  subscriptionStatus: {
    fontSize: 14,
  },
  menuContainer: {
    marginBottom: 50,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  menuGrid: {
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  quickActions: {
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },

});
