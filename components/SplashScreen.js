import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const theme = useTheme();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2500); // Увеличиваем время загрузки

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />
      
      <View style={styles.logoContainer}>
        <View style={[styles.logoBackground, { backgroundColor: theme.colors.white }]}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <Text style={[styles.appName, { color: theme.colors.white }]}>
          АНСДИМАТ
        </Text>
        
        <Text style={[styles.subtitle, { color: theme.colors.white }]}>
          Анализ и обработка гидрогеологических данных
        </Text>
      </View>
      
      <View style={styles.footer}>
        <Text style={[styles.website, { color: theme.colors.white }]}>
          ansdimat.com
        </Text>
        <Text style={[styles.copyright, { color: theme.colors.white }]}>
          © 2024 Ансдимат
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  logo: {
    width: 80,
    height: 80,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
    maxWidth: width * 0.8,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  website: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  copyright: {
    fontSize: 12,
    opacity: 0.8,
  },
}); 