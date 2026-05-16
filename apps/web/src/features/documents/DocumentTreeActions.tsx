import { MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentTreeNode } from "@my-notion-go/api-client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { RenameDocumentDialog } from "./RenameDocumentDialog";

type DocumentTreeActionsProps = {
  disabled: boolean;
  node: DocumentTreeNode;
  onCreateChild: (parentId: string) => void;
  onRename: (documentId: string, title: string) => void;
};

// DocumentTreeActions 对齐原 My-Notion Item：hover 后右侧只露出更多菜单和加号，重命名放进菜单弹窗。
export function DocumentTreeActions({ disabled, node, onCreateChild, onRename }: DocumentTreeActionsProps) {
  const { t } = useTranslation();
  const [renameOpen, setRenameOpen] = useState(false);
  const actionButtonClass = "h-[22px] w-5 rounded p-0 text-muted-foreground opacity-0 hover:bg-[var(--secondary-hover)] group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div className="ml-auto inline-flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t("documents.moreActions")}
            className={actionButtonClass}
            disabled={disabled}
            onClick={(event) => event.stopPropagation()}
            size="icon"
            title={t("documents.moreActions")}
            type="button"
            variant="ghost"
          >
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              setRenameOpen(true);
            }}
          >
            <Pencil size={14} />
            <span>{t("documents.renamePage")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        aria-label={t("documents.newSubPage")}
        className={actionButtonClass}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onCreateChild(node.id);
        }}
        size="icon"
        title={t("documents.newSubPage")}
        type="button"
        variant="ghost"
      >
        <Plus size={14} />
      </Button>
      <RenameDocumentDialog
        currentTitle={node.title}
        loading={disabled}
        onOpenChange={setRenameOpen}
        onRename={(title) => onRename(node.id, title)}
        open={renameOpen}
      />
    </div>
  );
}
