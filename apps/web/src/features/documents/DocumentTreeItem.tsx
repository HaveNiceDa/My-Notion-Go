import { useState } from "react";
import { ChevronDown, ChevronRight, FileIcon, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { DocumentTreeNode } from "@my-notion-go/api-client";

type DocumentTreeItemProps = {
  activeDocumentId?: string;
  level: number;
  node: DocumentTreeNode;
  onCreateChild: (parentId: string) => void;
};

// DocumentTreeItem 对齐原 Item.tsx：负责单行缩进、展开折叠、当前态和 hover 新建子页按钮。
export function DocumentTreeItem({ activeDocumentId, level, node, onCreateChild }: DocumentTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div>
      <div
        className={`document-tree-row ${activeDocumentId === node.id ? "active" : ""}`}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
      >
        <button
          aria-label={expanded ? "Collapse page" : "Expand page"}
          className="tree-chevron"
          disabled={!hasChildren}
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {hasChildren ? <ChevronIcon size={14} /> : <span />}
        </button>
        <Link className="document-row-link" to={`/documents/${node.id}`}>
          {node.icon ? <span className="document-emoji">{node.icon}</span> : <FileIcon size={18} />}
          <span>{node.title}</span>
        </Link>
        <button aria-label="New sub page" className="icon-button row-action" onClick={() => onCreateChild(node.id)} type="button">
          <Plus size={14} />
        </button>
      </div>
      {expanded && hasChildren ? (
        <div>
          {node.children.map((child) => (
            <DocumentTreeItem
              activeDocumentId={activeDocumentId}
              key={child.id}
              level={level + 1}
              node={child}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
