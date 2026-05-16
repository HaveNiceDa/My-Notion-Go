import type { DocumentTreeNode } from "@my-notion-go/api-client";
import { DocumentTreeItem } from "./DocumentTreeItem";

type DocumentTreeProps = {
  activeDocumentId?: string;
  actionLoading: boolean;
  nodes: DocumentTreeNode[];
  onCreateChild: (parentId: string) => void;
  onMove: (documentId: string, parentId: string) => void;
  onRename: (documentId: string, title: string) => void;
};

// DocumentTree 只负责渲染根文档列表；递归行逻辑交给 DocumentTreeItem，避免树容器过重。
export function DocumentTree({ activeDocumentId, actionLoading, nodes, onCreateChild, onMove, onRename }: DocumentTreeProps) {
  return (
    <div className="document-tree">
      {nodes.map((node) => (
        <DocumentTreeItem
          activeDocumentId={activeDocumentId}
          actionLoading={actionLoading}
          key={node.id}
          level={0}
          node={node}
          onCreateChild={onCreateChild}
          onMove={onMove}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
