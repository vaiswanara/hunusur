import React, { createContext, useContext, useState } from 'react';
import en from '../locales/en.json';
import te from '../locales/te.json';
import kn from '../locales/kn.json';

const LanguageContext = createContext();

const translations = { en, te, kn };

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('vamsha_lang') || 'en';
  });

  const setLanguage = (lang) => {
    localStorage.setItem('vamsha_lang', lang);
    setLanguageState(lang);
  };

  const t = (key, vars = {}) => {
    const keys = key.split('.');
    let val = translations[language];
    for (const k of keys) {
      if (val && typeof val === 'object') {
        val = val[k];
      } else {
        return key;
      }
    }
    if (typeof val !== 'string') return key;
    
    let result = val;
    for (const [vKey, vVal] of Object.entries(vars)) {
      result = result.replace(new RegExp(`{${vKey}}`, 'g'), vVal);
    }
    return result;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
