import React, { useContext } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, BackHandler, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, Card, Surface, Divider, IconButton } from "react-native-paper";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from "../Localization";
import { LanguageContext } from "../LanguageContext";
import { useTheme } from "react-native-paper";
import { Image } from "react-native";

export default function AboutScreen({ navigation }) {
  const { locale } = useContext(LanguageContext);
  const theme = useTheme();

  const handleWebsiteOpen = () => {
    Linking.openURL('https://ansdimat.com');
  };

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

  const applications = [
    { id: 1, text: I18n.t("app1"), icon: 'water' },
    { id: 2, text: I18n.t("app2"), icon: 'map-marker' },
    { id: 3, text: I18n.t("app3"), icon: 'chart-line' },
    { id: 4, text: I18n.t("app4"), icon: 'settings' },
    { id: 5, text: I18n.t("app5"), icon: 'calculator' },
    { id: 6, text: I18n.t("app6"), icon: 'database' },
    { id: 7, text: I18n.t("app7"), icon: 'file-document' },
  ];

  const modules = [
    { id: 1, text: I18n.t("module1"), icon: 'water-pump' },
    { id: 2, text: I18n.t("module2"), icon: 'graph' },
    { id: 3, text: I18n.t("module3"), icon: 'chart-bell-curve' },
    { id: 4, text: I18n.t("module4"), icon: 'calculator-variant' },
    { id: 5, text: I18n.t("module5"), icon: 'map' },
    { id: 6, text: I18n.t("module6"), icon: 'flask' },
    { id: 7, text: I18n.t("module7"), icon: 'format-list-bulleted' },
    { id: 8, text: I18n.t("module8"), icon: 'file-chart' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Заголовок и логотип */}
        <Surface style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.headerContent}>
            <MaterialCommunityIcons name="water-well" size={64} color={theme.colors.primary} />
            <Text style={[styles.appTitle, { color: theme.colors.primary }]}>ANSDIMAT</Text>
            <Text style={[styles.subtitle, { color: theme.colors.text }]}>
              {I18n.t("aboutDevelopment")}
            </Text>
            <TouchableOpacity 
              style={[styles.websiteButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleWebsiteOpen}
            >
              <MaterialIcons name="language" size={20} color={theme.colors.white} />
              <Text style={[styles.buttonText, { color: theme.colors.white }]}>
                ansdimat.com
              </Text>
            </TouchableOpacity>
          </View>
        </Surface>

        {/* О программе */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="information" size={28} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                {I18n.t("whatIsTitle")}
              </Text>
            </View>
            <Text style={[styles.description, { color: theme.colors.text }]}>
              {I18n.t("whatIsDescription")}
            </Text>
          </Card.Content>
        </Card>

        {/* Применения */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="application" size={28} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                {I18n.t("applicationsTitle")}
              </Text>
            </View>
            <View style={styles.itemsGrid}>
              {applications.map(app => (
                <Surface key={app.id} style={[styles.itemCard, { backgroundColor: theme.colors.background }]}>
                  <MaterialCommunityIcons 
                    name={app.icon} 
                    size={24} 
                    color={theme.colors.secondary} 
                  />
                  <Text style={[styles.itemText, { color: theme.colors.text }]} numberOfLines={2}>
                    {app.text}
                  </Text>
                </Surface>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Модули */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="puzzle" size={28} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                {I18n.t("modulesTitle")}
              </Text>
            </View>
            <Text style={[styles.description, { color: theme.colors.text }]}>
              {I18n.t("modulesDescription")}
            </Text>
            <View style={styles.itemsGrid}>
              {modules.map(module => (
                <Surface key={module.id} style={[styles.itemCard, { backgroundColor: theme.colors.background }]}>
                  <MaterialCommunityIcons 
                    name={module.icon} 
                    size={24} 
                    color={theme.colors.secondary} 
                  />
                  <Text style={[styles.itemText, { color: theme.colors.text }]} numberOfLines={2}>
                    {module.text}
                  </Text>
                </Surface>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* География использования */}
        <Card style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="earth" size={28} color={theme.colors.primary} />
              <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                Филиалы АНСДИМАТ
              </Text>
            </View>

            <View
              style={{
                alignSelf: 'center',
                marginVertical: 12,
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: theme.colors.background,
                padding: 0,
                width: '100%',
              }}
            >
              <Image
                source={require('../assets/department.gif')}
                style={{ width: '100%', height: 160, display: 'flex' }}
                accessibilityLabel="Карта филиалов АНСДИМАТ"
              />
            </View>

            <Text style={[styles.description, { color: theme.colors.text }]}>
              {I18n.t("geographyDescription")}
            </Text>

            <Text style={[styles.englishText, { color: theme.colors.text }]}>
              ANSDIMAT includes solutions commonly applied in groundwater
              practice, along with custom modifications. Most support one or
              several pumping wells with constant or time-variable pumping. All
              solutions are explained in the help system.
            </Text>
          </Card.Content>
        </Card>

        {/* Нижний отступ */}
        <View style={{ height: 100 }} />
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
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    alignItems: 'center',
    padding: 32,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  englishText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginTop: 8,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  itemCard: {
    width: '47%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
    marginBottom: 8,
  },
  itemText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 16,
    flexShrink: 1,
  },
  mapPlaceholder: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
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
