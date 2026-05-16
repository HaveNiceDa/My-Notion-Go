import { useState, type DragEvent } from "react";
import { ChevronDown, ChevronRight, FileIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { DocumentTreeNode } from "@my-notion-go/api-client";
import { DocumentTreeActions } from "./DocumentTreeActions";

type DocumentTreeItemProps = {
  activeDocumentId?: string;
  actionLoading: boolean;
  level: number;
  node: DocumentTreeNode;
  onCreateChild: (parentId: string) => void;
  onMove: (documentId: string, parentId: string) => void;
  onRename: (documentId: string, title: string) => void;
};

// DocumentTreeItem 对齐原 Item.tsx：负责单行缩进、展开折叠、当前态和 hover 新建子页按钮。
export function DocumentTreeItem({
  activeDocumentId,
  actionLoading,
  level,
  node,
  onCreateChild,
  onMove,
  onRename,
}: DocumentTreeItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = node.children.length > 0;
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (actionLoading) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", node.id);
    event.dataTransfer.effectAllowed = "move";
    setDragging(true);
  };

  const handleDragEnd = () => {
    setDragging(false);
    setDragOver(false);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);

    const draggedDocumentId = event.dataTransfer.getData("text/plain");
    if (!draggedDocumentId || draggedDocumentId === node.id) {
      return;
    }

    onMove(draggedDocumentId, node.id);
    setExpanded(true);
  };

  return (
    <div>
      <div
        className={`document-tree-row ${activeDocumentId === node.id ? "active" : ""} ${dragging ? "dragging" : ""} ${dragOver ? "drag-over" : ""}`}
        draggable={!actionLoading}
        onDragEnd={handleDragEnd}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
      >
        <button
          aria-label={expanded ? t("documents.collapsePage") : t("documents.expandPage")}
          className="tree-chevron"
          disabled={!hasChildren}
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {hasChildren ? <ChevronIcon size={14} /> : <span />}
        </button>
        <Link className="document-row-link" draggable={false} to={`/documents/${node.id}`}>
          {node.icon ? <span className="document-emoji">{node.icon}</span> : <FileIcon size={18} />}
          <span>{node.title}</span>
        </Link>
        <DocumentTreeActions
          disabled={actionLoading}
          node={node}
          onCreateChild={onCreateChild}
          onRename={onRename}
        />
      </div>
      {expanded && hasChildren ? (
        <div>
          {node.children.map((child) => (
            <DocumentTreeItem
              activeDocumentId={activeDocumentId}
              actionLoading={actionLoading}
              key={child.id}
              level={level + 1}
              node={child}
              onCreateChild={onCreateChild}
              onMove={onMove}
              onRename={onRename}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
