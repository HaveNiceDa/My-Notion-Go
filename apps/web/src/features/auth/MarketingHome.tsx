import { useState } from "react";
import { useMemoizedFn } from "ahooks";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@my-notion-go/api-client";
import { Button } from "@/components/ui/button";
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
    <main className="min-h-screen overflow-auto bg-background">
      <nav className="sticky top-0 z-20 flex w-full items-center justify-between gap-4 border-b border-transparent bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-6 py-[22px] backdrop-blur-[14px] max-[640px]:flex-col max-[640px]:items-start">
        <Link className="flex min-w-0 items-center gap-2.5 font-bold" to="/">
          <img alt={t("common.brand")} className="light-logo size-7" src="/logo.svg" />
          <img alt={t("common.brand")} className="dark-logo size-7" src="/logo-dark.svg" />
          <span>{t("common.brand")}</span>
        </Link>
        <div className="flex items-center gap-2 max-[640px]:w-full max-[640px]:flex-wrap">
          <Button onClick={() => openAuth("login")} size="sm" type="button" variant="ghost">
            {t("marketing.login")}
          </Button>
          <Button onClick={() => openAuth("register")} size="sm" type="button">
            {t("marketing.cta")}
          </Button>
          <LanguageToggle compact />
          <Button onClick={toggleTheme} size="icon" title={t("common.toggleTheme")} type="button" variant="ghost">
            {themeMode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </div>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] w-[min(1120px,calc(100%_-_48px))] grid-cols-[minmax(320px,1fr)_minmax(320px,1.1fr)] items-center gap-8 text-center max-[900px]:grid-cols-1 max-[900px]:py-16 max-[640px]:w-[min(calc(100%_-_32px),1120px)] max-[640px]:text-left">
        <div className="max-w-[760px] justify-self-center">
          <h1 className="m-0 mb-[18px] text-[clamp(34px,7vw,72px)] font-bold leading-[0.96] tracking-[-0.055em]">{t("marketing.heading")}</h1>
          <p className="mx-auto my-0 max-w-[620px] text-[clamp(16px,2.2vw,22px)] leading-[1.55] text-muted-foreground max-[640px]:ml-0">{t("marketing.subheading")}</p>
          <Button className="mt-[26px]" onClick={() => openAuth("register")} type="button">
            {t("marketing.cta")}
            <ArrowRight size={18} />
          </Button>
          <span className="mt-3.5 block text-xs text-muted-foreground">{t("marketing.apiLabel", { baseUrl: apiClient.baseUrl })}</span>
        </div>
        <div className="flex items-center justify-center" aria-hidden="true">
          <div>
            <img alt={t("marketing.documentsAlt")} className="light-logo w-[min(42vw,390px)]" src="/documents.png" />
            <img alt={t("marketing.documentsAlt")} className="dark-logo w-[min(42vw,390px)]" src="/documents-dark.png" />
          </div>
          <div className="max-[900px]:hidden">
            <img alt={t("marketing.readingAlt")} className="light-logo w-[min(34vw,360px)]" src="/reading.png" />
            <img alt={t("marketing.readingAlt")} className="dark-logo w-[min(34vw,360px)]" src="/reading-dark.png" />
          </div>
        </div>
      </section>

      {authMode ? <AuthDialog mode={authMode} onClose={closeAuth} onSwitchMode={setAuthMode} /> : null}
    </main>
  );
}
