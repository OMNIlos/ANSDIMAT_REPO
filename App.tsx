// App.tsx
import * as React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DrawerNavigator from './navigation/DrawerNavigator.js';
import theme from './theme.js';
import I18n from "./Localization.js";
import { LanguageProvider } from "./LanguageContext.js";

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <PaperProvider theme={theme}>
          <DrawerNavigator />
        </PaperProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
