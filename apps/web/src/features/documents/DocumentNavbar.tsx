import { Archive, MenuIcon, Moon, Sun } from "lucide-react";
import type { Document } from "@my-notion-go/api-client";
import { DocumentNavbarTitle } from "./DocumentNavbarTitle";

type DocumentNavbarProps = {
  archiveLoading: boolean;
  document?: Document;
  hasActiveDocument: boolean;
  loading: boolean;
  sidebarCollapsed: boolean;
  themeMode: "light" | "dark";
  onArchive: () => void;
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
  onExpandSidebar,
  onToggleTheme,
}: DocumentNavbarProps) {
  return (
    <nav className="document-navbar">
      {sidebarCollapsed ? (
        <button className="icon-button subtle" onClick={onExpandSidebar} type="button">
          <MenuIcon size={20} />
        </button>
      ) : null}
      <DocumentNavbarTitle document={document} loading={loading} />
      <div className="document-navbar-actions">
        <button className="icon-button subtle" onClick={onToggleTheme} title="Toggle theme" type="button">
          {themeMode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {hasActiveDocument ? (
          <button className="ghost-button danger" disabled={archiveLoading} onClick={onArchive} type="button">
            <Archive size={16} />
            Archive
          </button>
        ) : null}
      </div>
    </nav>
  );
}
