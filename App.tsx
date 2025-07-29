// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { LanguageProvider } from './LanguageContext.js';
import { ThemeProvider } from './ThemeContext.js';
import DrawerNavigator from './navigation/DrawerNavigator.js';
import SplashScreen from './components/SplashScreen.js';

export default function App() {
  const [isLoading, setIsLoading] = React.useState(true);

  const handleSplashFinish = () => {
    setIsLoading(false);
  };

  return (
      <LanguageProvider>
        <ThemeProvider>
        <NavigationContainer>
          {isLoading ? (
            <SplashScreen onFinish={handleSplashFinish} />
          ) : (
          <DrawerNavigator />
          )}
        </NavigationContainer>
        </ThemeProvider>
      </LanguageProvider>
  );
}
