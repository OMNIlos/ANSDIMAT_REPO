import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
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
        id: 'field-diary',
        title: I18n.t('fieldDiary', { defaultValue: 'Полевой дневник' }),
        subtitle: I18n.t('fieldDiaryDesc', { 
          defaultValue: 'Запись данных в полевых условиях' 
        }),
        icon: 'map-outline',
        iconFamily: 'community', // Используем MaterialCommunityIcons, где есть map-outline
        color: theme.colors.secondary,
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
      color: theme.colors.primary,
      onPress: () => navigation.navigate('ExamplesAndVideos'),
    },
    
  ];

  const renderMenuItem = (item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, { borderColor: theme.colors.border }]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <Surface style={[styles.iconContainer, { backgroundColor: item.color }]}> 
        {item.iconFamily === 'community' ? (
          <MaterialCommunityIcons name={item.icon} size={28} color={theme.colors.white} />
        ) : (
          <MaterialIcons name={item.icon} size={28} color={theme.colors.white} />
        )}
      </Surface>
      
      <View style={styles.textContainer}>
        <Text style={[styles.itemTitle, { color: 'black' }]}> 
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
      onPress: () => {/* TODO: реализовать выход */},
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
        {/* Статус подписки */}
        <Card style={[styles.subscriptionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.subscriptionContent}>
            <View style={styles.subscriptionInfo}>
              <MaterialIcons 
                name={subscriptionStatus ? "verified" : "info"} 
                size={24} 
                color={subscriptionStatus ? theme.colors.primary : theme.colors.textSecondary} 
              />
              <View style={styles.subscriptionText}>
                <Text style={[styles.subscriptionTitle, { color: theme.colors.text }]}>
                  {I18n.t('subscriptionStatus', { defaultValue: 'Статус подписки' })}
                </Text>
                <Text style={[
                  styles.subscriptionStatus, 
                  { color: subscriptionStatus ? theme.colors.primary : theme.colors.textSecondary }
                ]}>
                  {subscriptionStatus 
                    ? I18n.t('active', { defaultValue: 'Активна' })
                    : I18n.t('inactive', { defaultValue: 'Неактивна' })
                  }
                </Text>
              </View>
            </View>
            
            {!subscriptionStatus && (
              <Button
                mode="contained"
                buttonColor={theme.colors.primary}
                textColor={theme.colors.white}
                compact
                onPress={() => navigation.navigate('Subscription')}
              >
                {I18n.t('upgrade', { defaultValue: 'Обновить' })}
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Основное меню */}
        <View style={styles.menuContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {I18n.t('mainMenu', { defaultValue: 'Основные функции' })}
          </Text>
          
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
    marginBottom: 24,
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginHorizontal: 16,
    marginBottom: 32,
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
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
