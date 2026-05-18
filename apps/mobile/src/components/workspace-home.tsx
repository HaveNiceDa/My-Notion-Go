import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { mobileApiBaseUrl } from "@/lib/api-config";
import { useAuthStore } from "@/stores/auth-store";
import { Text, View } from "@/tw";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function WorkspaceHome() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <View className="gap-5">
      <Card>
        <CardEyebrow selectable>{t("App.phaseLabel")}</CardEyebrow>
        <CardTitle selectable>{t("App.signedInTitle", { name: user?.name || user?.email })}</CardTitle>
        <CardDescription selectable>{t("App.signedInSubtitle")}</CardDescription>
      </Card>

      <InfoCard>
        <CardEyebrow selectable>{t("auth.email")}</CardEyebrow>
        <Text selectable className="text-[15px] text-stone-800">{user?.email}</Text>
      </InfoCard>

      <InfoCard>
        <CardEyebrow selectable>{t("App.apiLabel")}</CardEyebrow>
        <Text selectable className="text-[15px] text-stone-800 tabular-nums">{mobileApiBaseUrl}</Text>
      </InfoCard>

      <Text selectable className="text-center text-sm leading-5 text-notion-faint">
        {t("App.documentsNext")}
      </Text>

      <Button
        accessibilityLabel={isLoggingOut ? t("workspace.loggingOut") : t("workspace.logout")}
        isLoading={isLoggingOut}
        label={t("workspace.logout")}
        loadingLabel={t("workspace.loggingOut")}
        onPress={handleLogout}
      />
    </View>
  );
}
