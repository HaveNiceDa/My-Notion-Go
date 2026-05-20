import { Platform } from "react-native";
import { create } from "zustand";

export type AppTheme = "light" | "dark";
export type AppLanguage = "zh" | "en";

type AppearanceState = {
  hydrated: boolean;
  language: AppLanguage;
  theme: AppTheme;
  hydrate: () => Promise<void>;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
};

const STORAGE_KEY = "my-notion-go.appearance";

let memoryAppearance: { language: AppLanguage; theme: AppTheme } | null = null;

function getWebAppearance(): { language: AppLanguage; theme: AppTheme } | null {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{ language: AppLanguage; theme: AppTheme }>;
    return {
      language: parsed.language === "en" ? "en" : "zh",
      theme: parsed.theme === "dark" ? "dark" : "light",
    };
  } catch {
    return null;
  }
}

function persistAppearance(appearance: { language: AppLanguage; theme: AppTheme }) {
  memoryAppearance = appearance;
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  }
}

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  hydrated: false,
  language: "zh",
  theme: "light",

  async hydrate() {
    const stored = memoryAppearance ?? getWebAppearance();
    if (stored) {
      set({ hydrated: true, language: stored.language, theme: stored.theme });
    } else {
      set({ hydrated: true });
    }
  },

  setLanguage(language) {
    const { theme } = get();
    persistAppearance({ language, theme });
    set({ language });
  },

  setTheme(theme) {
    const { language } = get();
    persistAppearance({ language, theme });
    set({ theme });
  },
}));
