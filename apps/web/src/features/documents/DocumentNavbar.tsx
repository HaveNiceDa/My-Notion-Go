import { Archive, Bot, Database, Loader2, MenuIcon, Moon, Star, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Document } from "@my-notion-go/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocumentNavbarTitle } from "./DocumentNavbarTitle";

type DocumentNavbarProps = {
  archiveLoading: boolean;
  document?: Document;
  hasActiveDocument: boolean;
  loading: boolean;
  ragActionLoading: boolean;
  starActionLoading: boolean;
  sidebarCollapsed: boolean;
  themeMode: "light" | "dark";
  onArchive: () => void;
  onToggleAIChat: () => void;
  onToggleKnowledgeBase: () => void;
  onToggleStar: () => void;
  onExpandSidebar: () => void;
  onToggleTheme: () => void;
};

// DocumentNavbar 对齐原工作区顶部栏：负责侧边栏展开、当前标题、主题切换和归档入口。
export function DocumentNavbar({
  archiveLoading,
  document,
  hasActiveDocument,
  loading,
  ragActionLoading,
  starActionLoading,
  sidebarCollapsed,
  themeMode,
  onArchive,
  onToggleAIChat,
  onToggleKnowledgeBase,
  onToggleStar,
  onExpandSidebar,
  onToggleTheme,
}: DocumentNavbarProps) {
  const { t } = useTranslation();
  const knowledgeBaseEnabled = document?.isInKnowledgeBase ?? true;

  return (
    <nav className="flex min-h-[45px] items-center justify-between gap-4 border-b border-transparent bg-background px-3">
      {sidebarCollapsed ? (
        <Button className="size-7" onClick={onExpandSidebar} size="icon" title={t("workspace.expandSidebar")} type="button" variant="ghost">
          <MenuIcon size={20} />
        </Button>
      ) : null}
      <DocumentNavbarTitle document={document} loading={loading} />
      <div className="flex items-center gap-2">
        {hasActiveDocument ? (
          <Button
            aria-pressed={Boolean(document?.isStarred)}
            className={cn(
              "h-8 rounded-full px-2.5 text-xs transition-colors",
              document?.isStarred ? "border-primary/30 bg-secondary text-foreground hover:bg-secondary/80" : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
            disabled={starActionLoading}
            onClick={onToggleStar}
            size="sm"
            title={document?.isStarred ? t("documents.unstarPage") : t("documents.starPage")}
            type="button"
            variant="outline"
          >
            {starActionLoading ? <Loader2 className="animate-spin" size={14} /> : <Star size={14} />}
            <span className="font-medium">{t("documents.favorite")}</span>
          </Button>
        ) : null}
        {hasActiveDocument ? (
          <Button
            aria-checked={knowledgeBaseEnabled}
            className={cn(
              "h-8 rounded-full px-2.5 text-xs transition-colors",
              knowledgeBaseEnabled
                ? "border-primary/30 bg-secondary text-foreground hover:bg-secondary/80"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
            disabled={ragActionLoading}
            onClick={onToggleKnowledgeBase}
            role="switch"
            size="sm"
            title={knowledgeBaseEnabled ? t("documents.knowledgeBaseDisable") : t("documents.knowledgeBaseEnable")}
            type="button"
            variant="outline"
          >
            {ragActionLoading ? <Loader2 className="animate-spin" size={14} /> : <Database size={14} />}
            <span className="font-medium">{t("documents.knowledgeBase")}</span>
          </Button>
        ) : null}
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
