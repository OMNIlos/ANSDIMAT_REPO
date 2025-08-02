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

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  const [subscriptionStatus, setSubscriptionStatus] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    const status = await SubscriptionManager.getSubscriptionStatus();
    setSubscriptionStatus(status);
  };
  
  const menuItems = [
      {
        id: 'pumping',
        title: I18n.t('pumpingTest', { defaultValue: 'Обработка откачек' }),
        subtitle: I18n.t('pumpingTestDesc', { 
          defaultValue: 'Анализ данных откачки скважин' 
      }),
      icon: 'water-pump',
      iconFamily: 'community',
      color: theme.colors.primary,
      onPress: () => navigation.navigate('PumpingTestProcessing'),
      },
      {
        id: 'calculator',
        title: I18n.t('calculator', { defaultValue: 'Калькулятор' }),
        subtitle: I18n.t('calculatorDesc', { 
          defaultValue: 'Гидрогеологические расчеты' 
        }),
        icon: 'calculate',
        iconFamily: 'material',
        color: theme.colors.secondary,
        onPress: () => navigation.navigate('Calculator'),
      },
      {
        id: 'field-diary',
        title: I18n.t('field', { defaultValue: 'Полевой дневник' }),
        subtitle: I18n.t('fieldDesc', { 
          defaultValue: 'Запись данных в полевых условиях' 
        }),
        icon: 'map-outline',
        iconFamily: 'community', // Используем MaterialCommunityIcons, где есть map-outline
        color: theme.colors.primary,
        onPress: () => navigation.navigate('FieldDiary'),
      },
      {
      id: 'examples',
      title: I18n.t('examples', { defaultValue: 'Примеры и видео' }),
      subtitle: I18n.t('examplesDesc', { 
        defaultValue: 'Обучающие материалы' 
      }),
      icon: 'play-circle-outline',
      iconFamily: 'community',
      color: theme.colors.secondary,
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

  // Нижнее меню
  const bottomMenuItems = [
    {
      key: 'menu',
      label: 'Меню',
      icon: <MaterialIcons name="menu" size={28} color="#fff" />,
      onPress: () => navigation.openDrawer(),
    },
    {
      key: 'settings',
      label: 'Настройки',
      icon: <MaterialIcons name="settings" size={28} color="#fff" />,
      onPress: () => navigation.navigate('Settings'),
    },
    {
      key: 'help',
      label: 'Справка',
      icon: <MaterialIcons name="help-outline" size={28} color="#fff" />,
      onPress: () => navigation.navigate('About'),
    },
    {
      key: 'exit',
      label: 'Выход',
      icon: <MaterialCommunityIcons name="exit-to-app" size={28} color="#fff" />,
      onPress: () => {
        if (Platform.OS === 'android') {
          BackHandler.exitApp();
        } else {
          Alert.alert(
            'Выход из приложения',
            'Для выхода из приложения на iOS используйте системное меню (свайп вверх и закройте приложение вручную).'
          );
        }
      },
    },
  ];

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
      {/* Нижнее меню */}
      <View style={styles.bottomMenuContainer}>
        {bottomMenuItems.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.bottomMenuItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            {item.icon}
            <Text style={styles.bottomMenuLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  bottomMenuContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#7a1434', // бордовый
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginHorizontal: 16,
    marginBottom: 50,
    paddingVertical: 12,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomMenuItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomMenuLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
