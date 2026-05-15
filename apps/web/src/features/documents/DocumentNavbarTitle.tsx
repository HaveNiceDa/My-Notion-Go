import { useTranslation } from "react-i18next";
import type { Document } from "@my-notion-go/api-client";

type DocumentNavbarTitleProps = {
  document?: Document;
  loading: boolean;
};

// DocumentNavbarTitle 复刻原 Navbar 里的轻量标题区域，只展示当前文档的 icon/title 或加载骨架。
export function DocumentNavbarTitle({ document, loading }: DocumentNavbarTitleProps) {
  const { t } = useTranslation();

  if (loading) {
    return <div className="navbar-title skeleton-line short" />;
  }

  return (
    <div className="navbar-title">
      {document?.icon ? <span>{document.icon}</span> : null}
      <span>{document?.title || t("documents.navbarFallback")}</span>
    </div>
  );
}
