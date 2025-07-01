// App.tsx
import * as React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import DrawerNavigator from './navigation/DrawerNavigator.js';
import theme from './theme.js';
import I18n from "./Localization.js";
import LanguageContext from "./LanguageContext.js";


export default function App() {
  const [locale, setLocale] = React.useState('ru');

  const toggleLanguage = () => {
    const newLocale = locale === 'ru' ? 'en' : 'ru';
    setLocale(newLocale);
    I18n.locale = newLocale;
  };

  return (
    <LanguageContext.Provider value={{ toggleLanguage, locale }}>
      <PaperProvider theme={theme}>
        <DrawerNavigator />
      </PaperProvider>
    </LanguageContext.Provider>
  );
}
