import "@/i18n";
import "@/global.css";

import { AppQueryProvider } from "@/providers/query-provider";
import { useAuthStore } from "@/stores/auth-store";
import { Stack } from "expo-router/stack";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TamaguiProvider, Theme } from "tamagui";
import { config } from "../tamagui.config";

export default function RootLayout() {
  const { t } = useTranslation();
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme="light">
        <Theme name="light">
          <AppQueryProvider>
          <Stack
            screenOptions={{
              headerLargeTitle: true,
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen name="index" options={{ title: t("App.homeTitle") }} />
            <Stack.Screen name="documents/[documentId]" options={{ title: t("mobileDocuments.detailTitle") }} />
            <Stack.Screen name="search" options={{ title: t("search.title") }} />
            <Stack.Screen name="trash" options={{ title: t("trash.title") }} />
          </Stack>
          </AppQueryProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
