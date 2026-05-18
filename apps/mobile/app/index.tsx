import { AuthScreen } from "@/components/auth-screen";
import { WorkspaceHome } from "@/components/workspace-home";
import { useAuthStore } from "@/stores/auth-store";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  const { t } = useTranslation();
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: "#F7F5F2" }}
      contentContainerStyle={{ gap: 20, padding: 20 }}
    >
      <StatusBar style="auto" />
      {status === "restoring" ? (
        <View
          style={{
            alignItems: "center",
            borderRadius: 28,
            borderCurve: "continuous",
            backgroundColor: "#FFFFFF",
            justifyContent: "center",
            minHeight: 240,
            padding: 24,
          }}
        >
          <Text selectable style={{ color: "#57534E", fontSize: 16, lineHeight: 24 }}>
            {t("common.loadingSession")}
          </Text>
        </View>
      ) : status === "authenticated" ? (
        <WorkspaceHome />
      ) : (
        <AuthScreen />
      )}
    </ScrollView>
  );
}
