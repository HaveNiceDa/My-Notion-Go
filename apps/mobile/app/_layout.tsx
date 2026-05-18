import "@/i18n";

import { AppQueryProvider } from "@/providers/query-provider";
import { Stack } from "expo-router/stack";
import { useTranslation } from "react-i18next";

export default function RootLayout() {
  const { t } = useTranslation();

  return (
    <AppQueryProvider>
      <Stack
        screenOptions={{
          headerLargeTitle: true,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: t("App.homeTitle") }} />
      </Stack>
    </AppQueryProvider>
  );
}
