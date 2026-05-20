import { createAnimations } from "@tamagui/animations-react-native";
import { defaultConfig } from "@tamagui/config/v5";
import { createTamagui } from "tamagui";

const animations = createAnimations({
  fast: {
    damping: 22,
    mass: 1,
    stiffness: 320,
  },
  medium: {
    damping: 18,
    mass: 0.95,
    stiffness: 180,
  },
});

export const config = createTamagui({
  ...defaultConfig,
  animations,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: "#ffffff",
      backgroundHover: "#f1f1ef",
      backgroundPress: "#ededeb",
      borderColor: "#e5e5e2",
      color: "#0a0a0a",
      placeholderColor: "#787774",
      primary: "#0a0a0a",
      primaryForeground: "#ffffff",
    },
    dark: {
      ...defaultConfig.themes.dark,
      background: "#191919",
      backgroundHover: "#2f2f2f",
      backgroundPress: "#373737",
      backgroundTransparent: "rgba(25,25,25,0.85)",
      borderColor: "#3a3a3a",
      color: "#e8e8e8",
      colorHover: "#f0f0f0",
      colorPress: "#ffffff",
      colorTransparent: "rgba(232,232,232,0.85)",
      placeholderColor: "#9b9b9b",
      primary: "#e8e8e8",
      primaryForeground: "#191919",
      shadowColor: "#000000",
      shadowColorHover: "#000000",
      shadowColorPress: "#000000",
      shadowColorFocus: "#000000",
    },
  },
});

type AppTamaguiConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
