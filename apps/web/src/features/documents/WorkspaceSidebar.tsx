import { LogOut, Moon, PanelLeftClose, Plus, Search, Settings, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { User, DocumentTreeNode } from "@my-notion-go/api-client";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "../i18n/LanguageToggle";
import { DocumentTree } from "./DocumentTree";
import { TreeSkeleton } from "./TreeSkeleton";

type WorkspaceSidebarProps = {
  activeDocumentId?: string;
  actionLoading: boolean;
  collapsed: boolean;
  createLoading: boolean;
  logoutLoading: boolean;
  themeMode: "light" | "dark";
  tree: DocumentTreeNode[] | undefined;
  treeLoading: boolean;
  user: User | null;
  onCollapse: () => void;
  onCreateRoot: () => void;
  onCreateChild: (parentId: string) => void;
  onLogout: () => void;
  onMove: (documentId: string, parentId: string) => void;
  onRename: (documentId: string, title: string) => void;
  onToggleTheme: () => void;
};

// WorkspaceSidebar 对齐原 Navigation：集中负责用户区、基础入口、文档树和底部操作。
export function WorkspaceSidebar({
  activeDocumentId,
  actionLoading,
  collapsed,
  createLoading,
  logoutLoading,
  themeMode,
  tree,
  treeLoading,
  user,
  onCollapse,
  onCreateRoot,
  onCreateChild,
  onLogout,
  onMove,
  onRename,
  onToggleTheme,
}: WorkspaceSidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className={`workspace-sidebar ${collapsed ? "workspace-sidebar-collapsed" : ""}`}>
      <div className="sidebar-topbar">
        <div className="user-pill" title={user?.email}>
          <span className="user-avatar">{user?.name?.[0] || user?.email?.[0] || "M"}</span>
          <div>
            <strong>{user?.name || t("common.brand")}</strong>
            <span>{user?.email}</span>
          </div>
        </div>
        <Button className="desktop-only size-7" onClick={onCollapse} size="icon" title={t("workspace.collapseSidebar")} type="button" variant="ghost">
          <PanelLeftClose size={18} />
        </Button>
      </div>

      <nav className="sidebar-actions">
        <Button className="sidebar-row muted-row h-auto justify-start" type="button" variant="ghost">
          <Search size={18} />
          <span>{t("workspace.search")}</span>
        </Button>
        <Button className="sidebar-row muted-row h-auto justify-start" type="button" variant="ghost">
          <Settings size={18} />
          <span>{t("workspace.settings")}</span>
        </Button>
      </nav>

      <section className="document-section">
        <div className="section-heading">
          <span>{t("workspace.private")}</span>
          <Button aria-label={t("workspace.newPage")} className="size-7" disabled={createLoading} onClick={onCreateRoot} size="icon" type="button" variant="ghost">
            <Plus size={16} />
          </Button>
        </div>

        {treeLoading ? <TreeSkeleton /> : null}
        {tree?.length ? (
          <DocumentTree
            activeDocumentId={activeDocumentId}
            actionLoading={actionLoading}
            nodes={tree}
            onCreateChild={onCreateChild}
            onMove={onMove}
            onRename={onRename}
          />
        ) : null}
        {tree && tree.length === 0 ? <p className="empty-sidebar-text">{t("workspace.noPages")}</p> : null}
      </section>

      <div className="sidebar-footer">
        <LanguageToggle />
        <Button className="sidebar-row muted-row h-auto justify-start" onClick={onToggleTheme} type="button" variant="ghost">
          {themeMode === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          <span>{themeMode === "dark" ? t("common.darkMode") : t("common.lightMode")}</span>
        </Button>
        <Button className="sidebar-row muted-row h-auto justify-start" disabled={logoutLoading} onClick={onLogout} type="button" variant="ghost">
          <LogOut size={18} />
          <span>{logoutLoading ? t("workspace.loggingOut") : t("workspace.logout")}</span>
        </Button>
      </div>
    </aside>
  );
}
