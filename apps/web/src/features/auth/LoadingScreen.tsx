import { useTranslation } from "react-i18next";

// LoadingScreen 只负责启动恢复登录态时的品牌化 loading 状态，避免路由壳混入展示细节。
export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className="grid min-h-screen place-items-center overflow-auto bg-background">
      <section className="grid justify-items-center gap-3 text-muted-foreground">
        <img alt={t("common.brand")} className="light-logo size-9" src="/logo.svg" />
        <img alt={t("common.brand")} className="dark-logo size-9" src="/logo-dark.svg" />
        <p>{t("common.loadingSession")}</p>
      </section>
    </main>
  );
}
