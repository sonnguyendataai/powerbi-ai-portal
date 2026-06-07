"use client";

import { useThemeLang } from "@/components/ThemeLanguageProvider";

export function SidebarControls() {
  const { theme, locale, toggleTheme, toggleLocale } = useThemeLang();

  return (
    <div className="sidebar-controls">
      <button
        type="button"
        className="sidebar-control-btn"
        onClick={toggleTheme}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span className="sidebar-control-icon">{theme === "dark" ? "☀️" : "🌙"}</span>
        <span className="sidebar-control-label">{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
      <button
        type="button"
        className="sidebar-control-btn"
        onClick={toggleLocale}
        title={locale === "en" ? "Chuyển sang tiếng Việt" : "Switch to English"}
        aria-label={locale === "en" ? "Switch to Vietnamese" : "Switch to English"}
      >
        <span className="sidebar-control-icon">{locale === "en" ? "🇻🇳" : "🇬🇧"}</span>
        <span className="sidebar-control-label">{locale === "en" ? "VI" : "EN"}</span>
      </button>
    </div>
  );
}
