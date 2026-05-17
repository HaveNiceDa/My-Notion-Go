import { AlertTriangle, FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Document } from "@my-notion-go/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TrashViewProps = {
  deletingId?: string;
  documents: Document[] | undefined;
  loading: boolean;
  restoringId?: string;
  onDelete: (documentId: string) => void;
  onRestore: (documentId: string) => void;
};

export function TrashView({ deletingId, documents, loading, restoringId, onDelete, onRestore }: TrashViewProps) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  return (
    <section className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-8 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("trash.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("trash.description")}</p>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-3">
          <div className="h-14 rounded-xl bg-muted" />
          <div className="h-14 rounded-xl bg-muted" />
          <div className="h-14 rounded-xl bg-muted" />
        </div>
      ) : null}

      {!loading && documents?.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-10 text-center">
          <div>
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Trash2 size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold">{t("trash.emptyTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("trash.emptyDescription")}</p>
          </div>
        </div>
      ) : null}

      {!loading && documents?.length ? (
        <div className="grid gap-2">
          {documents.map((document) => (
            <article key={document.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <span className="grid size-10 flex-none place-items-center rounded-lg bg-muted text-lg text-muted-foreground">
                {document.icon || <FileText size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-medium">{document.title || t("documents.untitled")}</h2>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{t("trash.updatedAt", { time: formatDate(document.updatedAt) })}</p>
              </div>
              <div className="flex flex-none items-center gap-2">
                <Button
                  className="gap-2"
                  disabled={Boolean(restoringId || deletingId)}
                  onClick={() => onRestore(document.id)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {restoringId === document.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw size={16} />}
                  <span>{t("trash.restore")}</span>
                </Button>
                <Button
                  className="gap-2 text-destructive hover:text-destructive"
                  disabled={Boolean(restoringId || deletingId)}
                  onClick={() => setDeleteTarget(document)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {deletingId === document.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 size={16} />}
                  <span>{t("trash.deleteForever")}</span>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle size={20} />
            </div>
            <DialogTitle>{t("trash.confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>{t("trash.confirmDeleteDescription", { title: deleteTarget?.title || t("documents.untitled") })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteTarget(null)} type="button" variant="outline">
              {t("common.cancel")}
            </Button>
            <Button
              className="gap-2"
              disabled={Boolean(deletingId)}
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
              type="button"
              variant="destructive"
            >
              {deletingId ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("trash.deleteForever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
