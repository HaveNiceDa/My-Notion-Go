import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Text, View } from "@/tw";
import { useAppearanceStore, type AppLanguage, type AppTheme } from "@/stores/appearance-store";
import { useTranslation } from "react-i18next";
import { Sheet } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SettingsSheetProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SettingsSheet({ onOpenChange, open }: SettingsSheetProps) {
  const { i18n, t } = useTranslation();
  const theme = useAppearanceStore((s) => s.theme);
  const setTheme = useAppearanceStore((s) => s.setTheme);
  const setLanguage = useAppearanceStore((s) => s.setLanguage);
  const insets = useSafeAreaInsets();

  const languageOptions: { label: string; value: AppLanguage }[] = [
    { label: t("common.chinese"), value: "zh" },
    { label: t("common.english"), value: "en" },
  ];

  const themeOptions: { label: string; value: AppTheme }[] = [
    { label: t("common.lightMode"), value: "light" },
    { label: t("common.darkMode"), value: "dark" },
  ];

  async function handleLanguageChange(lang: AppLanguage) {
    await setLanguage(lang);
    await i18n.changeLanguage(lang);
  }

  return (
    <Sheet dismissOnSnapToBottom modal onOpenChange={onOpenChange} open={open} snapPoints={[38]} zIndex={100_000}>
      <Sheet.Overlay backgroundColor="rgba(0,0,0,0.2)" />
      <Sheet.Handle />
      <Sheet.Frame borderTopLeftRadius={28} borderTopRightRadius={28}>
        <View className="gap-5 bg-notion-bg px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
          <Text selectable className="text-lg font-semibold leading-6 text-notion-text">
            {t("settings.title")}
          </Text>

          <Section title={t("common.language")}>
            <View className="flex-row gap-2">
              {languageOptions.map((option) => (
                <Button
                  key={option.value}
                  className="flex-1"
                  label={option.label}
                  onPress={() => void handleLanguageChange(option.value)}
                  variant={i18n.language.startsWith(option.value) ? "primary" : "secondary"}
                />
              ))}
            </View>
          </Section>

          <Section title={t("common.toggleTheme")}>
            <View className="flex-row gap-2">
              {themeOptions.map((option) => (
                <Button
                  key={option.value}
                  className="flex-1"
                  label={option.label}
                  onPress={() => void setTheme(option.value)}
                  variant={theme === option.value ? "primary" : "secondary"}
                />
              ))}
            </View>
          </Section>
        </View>
      </Sheet.Frame>
    </Sheet>
  );
}
