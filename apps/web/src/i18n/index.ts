import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

const languageStorageKey = "my-notion-go.language";
export type SupportedLanguage = "zh" | "en";

function getInitialLanguage(): SupportedLanguage {
  const stored = window.localStorage.getItem(languageStorageKey);
  if (stored === "zh" || stored === "en") {
    return stored;
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

// i18n 是前端所有业务文案的统一入口。组件只通过 useTranslation 取文案，不再直接写中英文字符串。
void i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (language) => {
  if (language === "zh" || language === "en") {
    window.localStorage.setItem(languageStorageKey, language);
  }
});

export { i18n };
