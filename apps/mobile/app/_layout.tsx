import "@/i18n";
import "@/global.css";

import { useOnlineManager } from "@/hooks/use-online-manager";
import { AppQueryProvider } from "@/providers/query-provider";
import { useAuthStore } from "@/stores/auth-store";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { Stack } from "expo-router/stack";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TamaguiProvider, Theme } from "tamagui";
import { View } from "@/tw";
import { config } from "../tamagui.config";

function RootLayoutInner() {
  const { t } = useTranslation();
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const isOnline = useOnlineManager();

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return (
    <View className="flex-1">
      <OfflineBanner visible={!isOnline} />
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
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme="light">
        <Theme name="light">
          <AppQueryProvider>
            <RootLayoutInner />
          </AppQueryProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
