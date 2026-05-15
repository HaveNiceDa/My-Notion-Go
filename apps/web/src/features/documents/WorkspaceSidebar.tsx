import { LogOut, Moon, PanelLeftClose, Plus, Search, Settings, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { User, DocumentTreeNode } from "@my-notion-go/api-client";
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
        <button className="icon-button subtle desktop-only" onClick={onCollapse} title={t("workspace.collapseSidebar")} type="button">
          <PanelLeftClose size={18} />
        </button>
      </div>

      <nav className="sidebar-actions">
        <button className="sidebar-row muted-row" type="button">
          <Search size={18} />
          <span>{t("workspace.search")}</span>
        </button>
        <button className="sidebar-row muted-row" type="button">
          <Settings size={18} />
          <span>{t("workspace.settings")}</span>
        </button>
      </nav>

      <section className="document-section">
        <div className="section-heading">
          <span>{t("workspace.private")}</span>
          <button aria-label={t("workspace.newPage")} className="icon-button subtle" disabled={createLoading} onClick={onCreateRoot} type="button">
            <Plus size={16} />
          </button>
        </div>

        {treeLoading ? <TreeSkeleton /> : null}
        {tree?.length ? (
          <DocumentTree
            activeDocumentId={activeDocumentId}
            actionLoading={actionLoading}
            nodes={tree}
            onCreateChild={onCreateChild}
            onRename={onRename}
          />
        ) : null}
        {tree && tree.length === 0 ? <p className="empty-sidebar-text">{t("workspace.noPages")}</p> : null}
      </section>

      <div className="sidebar-footer">
        <LanguageToggle />
        <button className="sidebar-row muted-row" onClick={onToggleTheme} type="button">
          {themeMode === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          <span>{themeMode === "dark" ? t("common.darkMode") : t("common.lightMode")}</span>
        </button>
        <button className="sidebar-row muted-row" disabled={logoutLoading} onClick={onLogout} type="button">
          <LogOut size={18} />
          <span>{logoutLoading ? t("workspace.loggingOut") : t("workspace.logout")}</span>
        </button>
      </div>
    </aside>
  );
}
