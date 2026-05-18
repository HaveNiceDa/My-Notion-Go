import "@/i18n";
import "@/global.css";

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
        <Stack.Screen name="documents/[documentId]" options={{ title: t("mobileDocuments.detailTitle") }} />
        <Stack.Screen name="public/[publicId]" options={{ title: t("mobileDocuments.publicTitle") }} />
        <Stack.Screen name="search" options={{ title: t("search.title") }} />
        <Stack.Screen name="trash" options={{ title: t("trash.title") }} />
      </Stack>
    </AppQueryProvider>
  );
}
