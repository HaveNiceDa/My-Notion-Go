import { AuthScreen } from "@/components/auth-screen";
import { LoadingCard, ScreenScrollView } from "@/components/ui/screen";
import { WorkspaceHome } from "@/components/workspace-home";
import { useAuthStore } from "@/stores/auth-store";
import { Text } from "@/tw";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function HomeScreen() {
  const { t } = useTranslation();
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return (
    <ScreenScrollView>
      <StatusBar style="auto" />
      {status === "restoring" ? (
        <LoadingCard>
          <Text selectable className="text-base leading-6 text-notion-subtle">
            {t("common.loadingSession")}
          </Text>
        </LoadingCard>
      ) : status === "authenticated" ? (
        <WorkspaceHome />
      ) : (
        <AuthScreen />
      )}
    </ScreenScrollView>
  );
}
