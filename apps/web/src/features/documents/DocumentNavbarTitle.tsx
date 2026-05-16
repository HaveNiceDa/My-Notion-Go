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
    return <div className="h-3.5 w-[46%] rounded-full bg-muted" />;
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
      {document?.icon ? <span>{document.icon}</span> : null}
      <span className="truncate">{document?.title || t("documents.navbarFallback")}</span>
    </div>
  );
}
