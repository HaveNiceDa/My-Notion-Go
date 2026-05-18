import { mobileApiBaseUrl } from "@/lib/api-config";
import { useAuthStore } from "@/stores/auth-store";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

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
    <View style={{ gap: 20 }}>
      <View
        style={{
          gap: 12,
          borderRadius: 28,
          borderCurve: "continuous",
          backgroundColor: "#FFFFFF",
          padding: 24,
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <Text selectable style={{ color: "#78716C", fontSize: 13, fontWeight: "600", letterSpacing: 0.4 }}>
          {t("App.phaseLabel")}
        </Text>
        <Text selectable style={{ color: "#1C1917", fontSize: 30, fontWeight: "700", lineHeight: 36 }}>
          {t("App.signedInTitle", { name: user?.name || user?.email })}
        </Text>
        <Text selectable style={{ color: "#57534E", fontSize: 16, lineHeight: 24 }}>
          {t("App.signedInSubtitle")}
        </Text>
      </View>

      <View
        style={{
          gap: 8,
          borderRadius: 20,
          borderCurve: "continuous",
          backgroundColor: "#EDE9E3",
          padding: 16,
        }}
      >
        <Text selectable style={{ color: "#78716C", fontSize: 13, fontWeight: "600" }}>
          {t("auth.email")}
        </Text>
        <Text selectable style={{ color: "#292524", fontSize: 15 }}>
          {user?.email}
        </Text>
      </View>

      <View
        style={{
          gap: 8,
          borderRadius: 20,
          borderCurve: "continuous",
          backgroundColor: "#EDE9E3",
          padding: 16,
        }}
      >
        <Text selectable style={{ color: "#78716C", fontSize: 13, fontWeight: "600" }}>
          {t("App.apiLabel")}
        </Text>
        <Text selectable style={{ color: "#292524", fontSize: 15, fontVariant: ["tabular-nums"] }}>
          {mobileApiBaseUrl}
        </Text>
      </View>

      <Text selectable style={{ color: "#78716C", fontSize: 14, lineHeight: 20, textAlign: "center" }}>
        {t("App.documentsNext")}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isLoggingOut ? t("workspace.loggingOut") : t("workspace.logout")}
        disabled={isLoggingOut}
        onPress={handleLogout}
        style={{
          alignItems: "center",
          borderRadius: 999,
          backgroundColor: "#1C1917",
          opacity: isLoggingOut ? 0.7 : 1,
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
          {isLoggingOut ? t("workspace.loggingOut") : t("workspace.logout")}
        </Text>
      </Pressable>
    </View>
  );
}
