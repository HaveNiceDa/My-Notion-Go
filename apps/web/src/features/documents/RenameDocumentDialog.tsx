import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type RenameDocumentDialogProps = {
  currentTitle: string;
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (title: string) => void;
};

// RenameDocumentDialog 对齐原 My-Notion 的 RenameModal：用 shadcn/Radix Dialog 承载重命名表单，避免原生 prompt。
export function RenameDocumentDialog({ currentTitle, loading, open, onOpenChange, onRename }: RenameDocumentDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(currentTitle);

  useEffect(() => {
    if (open) {
      setTitle(currentTitle);
    }
  }, [currentTitle, open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === currentTitle) {
      onOpenChange(false);
      return;
    }

    onRename(nextTitle);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("documents.renameDialogTitle")}</DialogTitle>
            <DialogDescription>{t("documents.renameDialogDescription")}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            disabled={loading}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("documents.renamePlaceholder")}
            value={title}
          />
          <DialogFooter>
            <Button disabled={loading} onClick={() => onOpenChange(false)} type="button" variant="ghost">
              {t("common.cancel")}
            </Button>
            <Button disabled={loading || !title.trim()} size="sm" type="submit">
              {loading ? t("documents.renaming") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
