import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SupportedLanguage } from "../../i18n";

type LanguageToggleProps = {
  compact?: boolean;
};

// LanguageToggle 负责切换当前语言；i18next 会把语言偏好持久化到 localStorage。
export function LanguageToggle({ compact = false }: LanguageToggleProps) {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language === "en" ? "en" : "zh";
  const nextLanguage: SupportedLanguage = currentLanguage === "zh" ? "en" : "zh";

  return (
    <button
      className={compact ? "icon-button" : "sidebar-row muted-row"}
      onClick={() => void i18n.changeLanguage(nextLanguage)}
      title={t("common.language")}
      type="button"
    >
      <Languages size={18} />
      {compact ? null : <span>{currentLanguage === "zh" ? t("common.chinese") : t("common.english")}</span>}
    </button>
  );
}
