// LanguageContext.js
import React from "react";

const LanguageContext = React.createContext({
  locale: "ru",
  toggleLanguage: () => {},
});

export default LanguageContext;
