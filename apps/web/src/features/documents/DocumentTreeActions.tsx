import { MoreHorizontal, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentTreeNode } from "@my-notion-go/api-client";
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

  return (
    <div className="document-row-actions">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t("documents.moreActions")}
            className="tree-action-button row-action"
            disabled={disabled}
            onClick={(event) => event.stopPropagation()}
            title={t("documents.moreActions")}
            type="button"
          >
            <MoreHorizontal size={16} />
          </button>
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
      <button
        aria-label={t("documents.newSubPage")}
        className="tree-action-button row-action"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onCreateChild(node.id);
        }}
        title={t("documents.newSubPage")}
        type="button"
      >
        <Plus size={14} />
      </button>
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
