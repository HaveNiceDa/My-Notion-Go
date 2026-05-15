import { Plus } from "lucide-react";

type EmptyDocumentsProps = {
  creating: boolean;
  onCreate: () => void;
  userName: string;
};

// EmptyDocuments 对齐原 My-Notion 空文档页：使用原 empty 插画，并提供轻量的新建入口。
export function EmptyDocuments({ creating, onCreate, userName }: EmptyDocumentsProps) {
  return (
    <div className="empty-documents">
      <div>
        <img alt="Empty documents" className="light-logo" src="/empty.png" />
        <img alt="Empty documents" className="dark-logo" src="/empty-dark.png" />
      </div>
      <h2>Welcome to {userName ? `${userName}'s` : "your"} My-Notion</h2>
      <p>Start with a page, then build your workspace from the sidebar.</p>
      <button className="primary-button compact" disabled={creating} onClick={onCreate} type="button">
        <Plus size={16} />
        {creating ? "Creating..." : "Create a note"}
      </button>
    </div>
  );
}
