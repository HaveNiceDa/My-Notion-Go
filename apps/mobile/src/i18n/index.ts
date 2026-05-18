import { i18nResources } from "@my-notion-go/shared";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: "zh",
  interpolation: {
    escapeValue: false,
  },
  lng: "zh",
  resources: i18nResources,
});

export { i18n };
