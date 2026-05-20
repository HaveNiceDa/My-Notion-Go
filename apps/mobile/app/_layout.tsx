import "@/i18n";
import "@/global.css";

import { useOnlineManager } from "@/hooks/use-online-manager";
import { AppQueryProvider } from "@/providers/query-provider";
import { useAppearanceStore } from "@/stores/appearance-store";
import { useAuthStore } from "@/stores/auth-store";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Stack } from "expo-router/stack";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { TamaguiProvider, Theme } from "tamagui";
import { View } from "@/tw";
import { config } from "../tamagui.config";

function RootLayoutInner() {
  const { i18n, t } = useTranslation();
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const hydrateAppearance = useAppearanceStore((state) => state.hydrate);
  const theme = useAppearanceStore((state) => state.theme);
  const language = useAppearanceStore((state) => state.language);
  const isOnline = useOnlineManager();
  const isDark = theme === "dark";

  useEffect(() => {
    void hydrateAppearance();
  }, [hydrateAppearance]);

  useEffect(() => {
    if (language && i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return (
    <TamaguiProvider config={config} defaultTheme={theme}>
      <Theme name={theme}>
        <View className={`flex-1 ${isDark ? "dark" : ""}`}>
          <OfflineBanner visible={!isOnline} />
          <StatusBar style={isDark ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerLargeTitle: true,
              headerShadowVisible: false,
              headerStyle: {
                backgroundColor: isDark ? "#191919" : "#ffffff",
              },
              headerTintColor: isDark ? "#e8e8e8" : "#0a0a0a",
              contentStyle: {
                backgroundColor: isDark ? "#191919" : "#ffffff",
              },
            }}
          >
            <Stack.Screen name="index" options={{ title: t("App.homeTitle") }} />
            <Stack.Screen name="documents/[documentId]" options={{ title: t("mobileDocuments.detailTitle") }} />
            <Stack.Screen name="search" options={{ title: t("search.title") }} />
            <Stack.Screen name="trash" options={{ title: t("trash.title") }} />
          </Stack>
        </View>
      </Theme>
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppQueryProvider>
        <RootLayoutInner />
      </AppQueryProvider>
    </GestureHandlerRootView>
  );
}
