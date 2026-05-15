import { useState } from "react";
import { useMemoizedFn } from "ahooks";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@my-notion-go/api-client";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { useThemeStore } from "../theme/themeStore";
import { AuthDialog } from "./AuthDialog";
import type { AuthMode } from "./types";

type MarketingHomeProps = {
  initialAuthMode?: AuthMode;
};

// MarketingHome 复刻原 My-Notion 营销首页结构：顶部品牌栏、Hero 文案、插画和 Clerk 风格登录弹窗入口。
export function MarketingHome({ initialAuthMode }: MarketingHomeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const [authMode, setAuthMode] = useState<AuthMode | null>(initialAuthMode ?? null);
  const openAuth = useMemoizedFn((mode: AuthMode) => {
    setAuthMode(mode);
    navigate(mode === "login" ? "/login" : "/register", { replace: false });
  });
  const closeAuth = useMemoizedFn(() => {
    setAuthMode(null);
    navigate("/", { replace: false });
  });

  return (
    <main className="marketing-shell">
      <nav className="marketing-navbar">
        <Link className="brand-lockup" to="/">
          <img alt={t("common.brand")} className="brand-logo light-logo" src="/logo.svg" />
          <img alt={t("common.brand")} className="brand-logo dark-logo" src="/logo-dark.svg" />
          <span>{t("common.brand")}</span>
        </Link>
        <div className="marketing-nav-actions">
          <button className="ghost-button" onClick={() => openAuth("login")} type="button">
            {t("marketing.login")}
          </button>
          <button className="primary-button compact" onClick={() => openAuth("register")} type="button">
            {t("marketing.cta")}
          </button>
          <LanguageToggle compact />
          <button className="icon-button" onClick={toggleTheme} title={t("common.toggleTheme")} type="button">
            {themeMode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="hero-copy">
          <h1>{t("marketing.heading")}</h1>
          <p>{t("marketing.subheading")}</p>
          <button className="primary-button hero-cta" onClick={() => openAuth("register")} type="button">
            {t("marketing.cta")}
            <ArrowRight size={18} />
          </button>
          <span className="hero-api-note">{t("marketing.apiLabel", { baseUrl: apiClient.baseUrl })}</span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div>
            <img alt={t("marketing.documentsAlt")} className="light-logo" src="/documents.png" />
            <img alt={t("marketing.documentsAlt")} className="dark-logo" src="/documents-dark.png" />
          </div>
          <div className="hero-reading">
            <img alt={t("marketing.readingAlt")} className="light-logo" src="/reading.png" />
            <img alt={t("marketing.readingAlt")} className="dark-logo" src="/reading-dark.png" />
          </div>
        </div>
      </section>

      {authMode ? <AuthDialog mode={authMode} onClose={closeAuth} onSwitchMode={setAuthMode} /> : null}
    </main>
  );
}
