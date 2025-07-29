import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { lightTheme, darkTheme } from './theme.js';

export const ThemeContext = React.createContext({
  themeMode: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = React.useState('light');
  const toggleTheme = () => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  const value = React.useMemo(() => ({ themeMode, toggleTheme }), [themeMode]);
  const currentTheme = themeMode === 'light' ? lightTheme : darkTheme;
  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={currentTheme}>{children}</PaperProvider>
    </ThemeContext.Provider>
  );
} 