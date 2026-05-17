import { Archive, Bot, Check, Copy, Database, Globe2, Loader2, MenuIcon, Moon, Star, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Document } from "@my-notion-go/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DocumentNavbarTitle } from "./DocumentNavbarTitle";

type DocumentNavbarProps = {
  archiveLoading: boolean;
  document?: Document;
  hasActiveDocument: boolean;
  loading: boolean;
  ragActionLoading: boolean;
  publishActionLoading: boolean;
  starActionLoading: boolean;
  sidebarCollapsed: boolean;
  themeMode: "light" | "dark";
  onArchive: () => void;
  onToggleAIChat: () => void;
  onToggleKnowledgeBase: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
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
  publishActionLoading,
  starActionLoading,
  sidebarCollapsed,
  themeMode,
  onArchive,
  onToggleAIChat,
  onToggleKnowledgeBase,
  onPublish,
  onUnpublish,
  onToggleStar,
  onExpandSidebar,
  onToggleTheme,
}: DocumentNavbarProps) {
  const { t } = useTranslation();
  const [publishOpen, setPublishOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const knowledgeBaseEnabled = document?.isInKnowledgeBase ?? true;
  const publicUrl = useMemo(() => {
    if (!document?.publicId) {
      return "";
    }
    return `${window.location.origin}/p/${document.publicId}`;
  }, [document?.publicId]);

  const copyPublicUrl = async () => {
    if (!publicUrl) {
      return;
    }
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

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
            aria-pressed={Boolean(document?.isPublished)}
            className={cn(
              "h-8 rounded-full px-2.5 text-xs transition-colors",
              document?.isPublished ? "border-primary/30 bg-secondary text-foreground hover:bg-secondary/80" : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setPublishOpen(true)}
            size="sm"
            title={document?.isPublished ? t("publish.manage") : t("publish.publish")}
            type="button"
            variant="outline"
          >
            <Globe2 size={14} />
            <span className="font-medium">{document?.isPublished ? t("publish.published") : t("publish.publish")}</span>
          </Button>
        ) : null}
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
      <Dialog onOpenChange={setPublishOpen} open={publishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{document?.isPublished ? t("publish.manageTitle") : t("publish.title")}</DialogTitle>
            <DialogDescription>{document?.isPublished ? t("publish.manageDescription") : t("publish.description")}</DialogDescription>
          </DialogHeader>

          {document?.isPublished ? (
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Globe2 size={14} />
                <span>{t("publish.publicLink")}</span>
              </div>
              <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1">
                <input
                  className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-muted-foreground outline-none"
                  id="public-url"
                  readOnly
                  value={publicUrl}
                />
                <Button className="h-8 flex-none gap-1.5 px-2.5" onClick={copyPublicUrl} size="sm" type="button" variant="ghost">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? t("publish.copied") : t("publish.copy")}
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter className={document?.isPublished ? "mt-6 justify-between" : undefined}>
            {document?.isPublished ? (
              <>
                <Button
                  className="text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] hover:text-[var(--danger)]"
                  disabled={publishActionLoading}
                  onClick={onUnpublish}
                  type="button"
                  variant="ghost"
                >
                  {publishActionLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {t("publish.unpublish")}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    {t("publish.done")}
                  </Button>
                </DialogClose>
              </>
            ) : (
              <Button disabled={publishActionLoading} onClick={onPublish} type="button">
                {publishActionLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {t("publish.publish")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
