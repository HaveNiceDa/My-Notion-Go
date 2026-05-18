import { mobileApiBaseUrl } from "@/lib/api-config";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: "#F7F5F2" }}
      contentContainerStyle={{ gap: 20, padding: 20 }}
    >
      <StatusBar style="auto" />
      <View
        style={{
          gap: 14,
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
        <Text selectable style={{ color: "#1C1917", fontSize: 32, fontWeight: "700", lineHeight: 38 }}>
          {t("App.heroTitle")}
        </Text>
        <Text selectable style={{ color: "#57534E", fontSize: 16, lineHeight: 24 }}>
          {t("App.heroSubtitle")}
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("App.primaryAction")}
        style={{
          alignItems: "center",
          borderRadius: 999,
          backgroundColor: "#1C1917",
          paddingHorizontal: 18,
          paddingVertical: 14,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{t("App.primaryAction")}</Text>
      </Pressable>

      <Text selectable style={{ color: "#78716C", fontSize: 14, textAlign: "center" }}>
        {t("App.statusReady")}
      </Text>
    </ScrollView>
  );
}
