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
  },
});

type AppTamaguiConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
