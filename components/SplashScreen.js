import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Dimensions, Image } from 'react-native';
import { useTheme } from 'react-native-paper';
import I18n from '../Localization';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const theme = useTheme();
  const currentYear = new Date().getFullYear();
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
                        <View style={[styles.logoBackground, { backgroundColor: 'transparent' }]}>
          <Image
            source={require('../assets/splash.png')}
            style={{ width: 80, height: 80, borderRadius: 15 }}
            resizeMode="contain"
            
          />
        </View>
        
        <Text style={[styles.appName, { color: theme.colors.white }]}>
          {I18n.t('homeTitle')}
        </Text>
        
        <Text style={[styles.subtitle, { color: theme.colors.white }]}>
          {I18n.t('appSubtitle')}
        </Text>
      </View>
      
      <View style={styles.footer}>
        <Text style={[styles.website, { color: theme.colors.white }]}>
          ansdimat.com
        </Text>
        <Text style={[styles.copyright, { color: theme.colors.white }]}>
          © {currentYear} {I18n.t('homeTitle')}
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