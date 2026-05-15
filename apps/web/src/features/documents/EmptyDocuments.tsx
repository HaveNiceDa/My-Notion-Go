import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

type EmptyDocumentsProps = {
  creating: boolean;
  onCreate: () => void;
  userName: string;
};

// EmptyDocuments 对齐原 My-Notion 空文档页：使用原 empty 插画，并提供轻量的新建入口。
export function EmptyDocuments({ creating, onCreate, userName }: EmptyDocumentsProps) {
  const { t } = useTranslation();

  return (
    <div className="empty-documents">
      <div>
        <img alt={t("documents.emptyAlt")} className="light-logo" src="/empty.png" />
        <img alt={t("documents.emptyAlt")} className="dark-logo" src="/empty-dark.png" />
      </div>
      <h2>{userName ? t("documents.emptyTitle", { name: userName }) : t("documents.emptyTitleFallback")}</h2>
      <p>{t("documents.emptyDescription")}</p>
      <button className="primary-button compact" disabled={creating} onClick={onCreate} type="button">
        <Plus size={16} />
        {creating ? t("documents.creating") : t("documents.createNote")}
      </button>
    </div>
  );
}
