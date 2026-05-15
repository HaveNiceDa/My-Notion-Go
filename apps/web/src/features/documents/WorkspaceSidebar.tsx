import { LogOut, Moon, PanelLeftClose, Plus, Search, Settings, Sun } from "lucide-react";
import type { User, DocumentTreeNode } from "@my-notion-go/api-client";
import { DocumentTree } from "./DocumentTree";
import { TreeSkeleton } from "./TreeSkeleton";

type WorkspaceSidebarProps = {
  activeDocumentId?: string;
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
  onToggleTheme: () => void;
};

// WorkspaceSidebar 对齐原 Navigation：集中负责用户区、基础入口、文档树和底部操作。
export function WorkspaceSidebar({
  activeDocumentId,
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
  onToggleTheme,
}: WorkspaceSidebarProps) {
  return (
    <aside className={`workspace-sidebar ${collapsed ? "workspace-sidebar-collapsed" : ""}`}>
      <div className="sidebar-topbar">
        <div className="user-pill" title={user?.email}>
          <span className="user-avatar">{user?.name?.[0] || user?.email?.[0] || "M"}</span>
          <div>
            <strong>{user?.name || "My Notion"}</strong>
            <span>{user?.email}</span>
          </div>
        </div>
        <button className="icon-button subtle desktop-only" onClick={onCollapse} type="button">
          <PanelLeftClose size={18} />
        </button>
      </div>

      <nav className="sidebar-actions">
        <button className="sidebar-row muted-row" type="button">
          <Search size={18} />
          <span>Search</span>
        </button>
        <button className="sidebar-row muted-row" type="button">
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </nav>

      <section className="document-section">
        <div className="section-heading">
          <span>Private</span>
          <button aria-label="New page" className="icon-button subtle" disabled={createLoading} onClick={onCreateRoot} type="button">
            <Plus size={16} />
          </button>
        </div>

        {treeLoading ? <TreeSkeleton /> : null}
        {tree?.length ? <DocumentTree activeDocumentId={activeDocumentId} nodes={tree} onCreateChild={onCreateChild} /> : null}
        {tree && tree.length === 0 ? <p className="empty-sidebar-text">No pages inside.</p> : null}
      </section>

      <div className="sidebar-footer">
        <button className="sidebar-row muted-row" onClick={onToggleTheme} type="button">
          {themeMode === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          <span>{themeMode === "dark" ? "Dark mode" : "Light mode"}</span>
        </button>
        <button className="sidebar-row muted-row" disabled={logoutLoading} onClick={onLogout} type="button">
          <LogOut size={18} />
          <span>{logoutLoading ? "Logging out..." : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
}
