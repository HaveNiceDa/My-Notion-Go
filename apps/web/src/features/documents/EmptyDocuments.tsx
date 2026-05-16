import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type EmptyDocumentsProps = {
  creating: boolean;
  onCreate: () => void;
  userName: string;
};

// EmptyDocuments 对齐原 My-Notion 空文档页：使用原 empty 插画，并提供轻量的新建入口。
export function EmptyDocuments({ creating, onCreate, userName }: EmptyDocumentsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <div>
        <img alt={t("documents.emptyAlt")} className="light-logo size-[280px] object-contain" src="/empty.png" />
        <img alt={t("documents.emptyAlt")} className="dark-logo size-[280px] object-contain" src="/empty-dark.png" />
      </div>
      <h2 className="mb-2 mt-0 text-xl font-semibold">{userName ? t("documents.emptyTitle", { name: userName }) : t("documents.emptyTitleFallback")}</h2>
      <p className="mb-[18px] mt-0 text-muted-foreground">{t("documents.emptyDescription")}</p>
      <Button disabled={creating} onClick={onCreate} size="sm" type="button">
        <Plus size={16} />
        {creating ? t("documents.creating") : t("documents.createNote")}
      </Button>
    </div>
  );
}
