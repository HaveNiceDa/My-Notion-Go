import { useTranslation } from "react-i18next";

// LoadingScreen 只负责启动恢复登录态时的品牌化 loading 状态，避免路由壳混入展示细节。
export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className="loading-screen">
      <section className="loading-card">
        <img alt={t("common.brand")} className="auth-modal-logo light-logo" src="/logo.svg" />
        <img alt={t("common.brand")} className="auth-modal-logo dark-logo" src="/logo-dark.svg" />
        <p>{t("common.loadingSession")}</p>
      </section>
    </main>
  );
}
