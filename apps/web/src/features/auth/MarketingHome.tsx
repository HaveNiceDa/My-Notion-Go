import { useState } from "react";
import { useMemoizedFn } from "ahooks";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@my-notion-go/api-client";
import { useThemeStore } from "../theme/themeStore";
import { AuthDialog } from "./AuthDialog";
import type { AuthMode } from "./types";

type MarketingHomeProps = {
  initialAuthMode?: AuthMode;
};

// MarketingHome 复刻原 My-Notion 营销首页结构：顶部品牌栏、Hero 文案、插画和 Clerk 风格登录弹窗入口。
export function MarketingHome({ initialAuthMode }: MarketingHomeProps) {
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
          <img alt="My-Notion" className="brand-logo light-logo" src="/logo.svg" />
          <img alt="My-Notion" className="brand-logo dark-logo" src="/logo-dark.svg" />
          <span>My-Notion</span>
        </Link>
        <div className="marketing-nav-actions">
          <button className="ghost-button" onClick={() => openAuth("login")} type="button">
            登录
          </button>
          <button className="primary-button compact" onClick={() => openAuth("register")} type="button">
            Get My-Notion free
          </button>
          <button className="icon-button" onClick={toggleTheme} title="切换主题" type="button">
            {themeMode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="hero-copy">
          <h1>Your Ideas, Documents, & Plans. Unified.</h1>
          <p>
            My-Notion Go Edition keeps the original product feeling while rebuilding the full stack with React, Go,
            and PostgreSQL.
          </p>
          <button className="primary-button hero-cta" onClick={() => openAuth("register")} type="button">
            Get My-Notion free
            <ArrowRight size={18} />
          </button>
          <span className="hero-api-note">API: {apiClient.baseUrl}</span>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div>
            <img alt="Documents" className="light-logo" src="/documents.png" />
            <img alt="Documents" className="dark-logo" src="/documents-dark.png" />
          </div>
          <div className="hero-reading">
            <img alt="Reading" className="light-logo" src="/reading.png" />
            <img alt="Reading" className="dark-logo" src="/reading-dark.png" />
          </div>
        </div>
      </section>

      {authMode ? <AuthDialog mode={authMode} onClose={closeAuth} onSwitchMode={setAuthMode} /> : null}
    </main>
  );
}
