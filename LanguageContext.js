// LanguageContext.js
import React from "react";
import I18n from "./Localization.js";

export const LanguageContext = React.createContext({
  locale: "ru",
  toggleLanguage: () => {},
});

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = React.useState("ru");

  const toggleLanguage = () => {
    const newLocale = locale === "ru" ? "en" : "ru";
    setLocale(newLocale);
    I18n.locale = newLocale;
  };

  return (
    <LanguageContext.Provider value={{ locale, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
