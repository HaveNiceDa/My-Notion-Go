import { LogOut, Moon, PanelLeftClose, Plus, Search, Settings, Sun } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
  width: number;
  onCollapse: () => void;
  onCreateRoot: () => void;
  onCreateChild: (parentId: string) => void;
  onLogout: () => void;
  onMove: (documentId: string, parentId: string) => void;
  onRename: (documentId: string, title: string) => void;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
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
  width,
  onCollapse,
  onCreateRoot,
  onCreateChild,
  onLogout,
  onMove,
  onRename,
  onResizeStart,
  onToggleTheme,
}: WorkspaceSidebarProps) {
  const { t } = useTranslation();
  const sidebarRowClass = "min-h-[30px] w-full justify-start gap-2 rounded px-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-[var(--secondary-hover)] hover:text-muted-foreground";

  return (
    <aside
      className={`group/sidebar fixed inset-y-0 left-0 z-30 flex h-full flex-col overflow-auto bg-secondary px-1 py-2 shadow-[var(--shadow)] transition-[min-width,flex-basis,padding] duration-200 md:static md:relative md:z-auto md:shadow-none ${
        collapsed ? "w-0 min-w-0 flex-[0_0_0] border-0 p-0" : "min-w-[220px]"
      }`}
      style={collapsed ? undefined : { flexBasis: width, width }}
    >
      <div className="flex items-center justify-between gap-2 px-1.5 pb-2 pt-1">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden" title={user?.email}>
          <span className="grid size-[26px] flex-none place-items-center rounded-md bg-muted text-[13px] font-bold uppercase text-foreground">{user?.name?.[0] || user?.email?.[0] || "M"}</span>
          <div>
            <strong className="block truncate text-sm leading-tight">{user?.name || t("common.brand")}</strong>
            <span className="block max-w-[148px] truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
        </div>
        <Button className="hidden size-7 md:inline-flex" onClick={onCollapse} size="icon" title={t("workspace.collapseSidebar")} type="button" variant="ghost">
          <PanelLeftClose size={18} />
        </Button>
      </div>

      <nav className="grid gap-0.5">
        <Button className={sidebarRowClass} type="button" variant="ghost">
          <Search size={18} />
          <span>{t("workspace.search")}</span>
        </Button>
        <Button className={sidebarRowClass} type="button" variant="ghost">
          <Settings size={18} />
          <span>{t("workspace.settings")}</span>
        </Button>
      </nav>

      <section className="mt-4">
        <div className="flex min-h-[30px] items-center justify-between px-2 pl-3 text-xs font-semibold text-muted-foreground">
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
        {tree && tree.length === 0 ? <p className="mx-3 my-1.5 text-[13px] text-muted-foreground">{t("workspace.noPages")}</p> : null}
      </section>

      <div className="mt-auto grid gap-0.5 pt-3">
        <LanguageToggle />
        <Button className={sidebarRowClass} onClick={onToggleTheme} type="button" variant="ghost">
          {themeMode === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          <span>{themeMode === "dark" ? t("common.darkMode") : t("common.lightMode")}</span>
        </Button>
        <Button className={sidebarRowClass} disabled={logoutLoading} onClick={onLogout} type="button" variant="ghost">
          <LogOut size={18} />
          <span>{logoutLoading ? t("workspace.loggingOut") : t("workspace.logout")}</span>
        </Button>
      </div>
      {!collapsed ? (
        // resize handle 独立于滚动内容，拖拽时不会触发文档树 hover/action 状态。
        <div
          aria-label={t("workspace.resizeSidebar")}
          aria-orientation="vertical"
          className="absolute inset-y-0 right-0 hidden w-1 cursor-col-resize bg-transparent transition hover:bg-primary/10 group-hover/sidebar:bg-primary/5 md:block"
          onPointerDown={onResizeStart}
          role="separator"
        />
      ) : null}
    </aside>
  );
}
