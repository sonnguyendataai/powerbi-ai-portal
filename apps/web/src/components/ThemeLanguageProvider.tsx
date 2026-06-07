"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translations, type Locale, type TranslationKey } from "@/i18n";

interface ThemeLangContextValue {
  theme: "dark" | "light";
  locale: Locale;
  t: (key: TranslationKey) => string;
  toggleTheme: () => void;
  toggleLocale: () => void;
}

const ThemeLangContext = createContext<ThemeLangContextValue>({
  theme: "dark",
  locale: "en",
  t: (key) => translations.en[key],
  toggleTheme: () => {},
  toggleLocale: () => {},
});

export function useThemeLang() {
  return useContext(ThemeLangContext);
}

export function ThemeLanguageProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("portal-theme");
    const savedLocale = localStorage.getItem("portal-locale");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    if (savedLocale === "vi" || savedLocale === "en") setLocale(savedLocale);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("portal-theme", theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("portal-locale", locale);
  }, [locale, mounted]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === "en" ? "vi" : "en"));
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[locale][key] ?? translations.en[key],
    [locale],
  );

  return (
    <ThemeLangContext.Provider value={{ theme, locale, t, toggleTheme, toggleLocale }}>
      {children}
    </ThemeLangContext.Provider>
  );
}
