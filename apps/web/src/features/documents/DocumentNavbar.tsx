import { Archive, Bot, MenuIcon, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Document } from "@my-notion-go/api-client";
import { Button } from "@/components/ui/button";
import { DocumentNavbarTitle } from "./DocumentNavbarTitle";

type DocumentNavbarProps = {
  archiveLoading: boolean;
  document?: Document;
  hasActiveDocument: boolean;
  loading: boolean;
  sidebarCollapsed: boolean;
  themeMode: "light" | "dark";
  onArchive: () => void;
  onToggleAIChat: () => void;
  onExpandSidebar: () => void;
  onToggleTheme: () => void;
};

// DocumentNavbar 对齐原工作区顶部栏：负责侧边栏展开、当前标题、主题切换和归档入口。
export function DocumentNavbar({
  archiveLoading,
  document,
  hasActiveDocument,
  loading,
  sidebarCollapsed,
  themeMode,
  onArchive,
  onToggleAIChat,
  onExpandSidebar,
  onToggleTheme,
}: DocumentNavbarProps) {
  const { t } = useTranslation();

  return (
    <nav className="flex min-h-[45px] items-center justify-between gap-4 border-b border-transparent bg-background px-3">
      {sidebarCollapsed ? (
        <Button className="size-7" onClick={onExpandSidebar} size="icon" title={t("workspace.expandSidebar")} type="button" variant="ghost">
          <MenuIcon size={20} />
        </Button>
      ) : null}
      <DocumentNavbarTitle document={document} loading={loading} />
      <div className="flex items-center gap-2">
        <Button onClick={onToggleAIChat} size="sm" type="button" variant="ghost">
          <Bot size={16} />
          {t("aiChat.open")}
        </Button>
        <Button className="size-7" onClick={onToggleTheme} size="icon" title={t("documents.toggleTheme")} type="button" variant="ghost">
          {themeMode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        {hasActiveDocument ? (
          <Button disabled={archiveLoading} onClick={onArchive} size="sm" type="button" variant="ghost">
            <Archive size={16} />
            {t("documents.archive")}
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
