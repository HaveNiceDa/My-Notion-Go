import { useEffect, useState } from "react";
import { useDebounce, useMemoizedFn } from "ahooks";
import { FileText, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "../auth/authStore";
import { useDocumentSearch } from "./useDocumentSearch";
import { useSearchCommandStore } from "./searchStore";

export function SearchCommand() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const open = useSearchCommandStore((state) => state.open);
  const setOpen = useSearchCommandStore((state) => state.setOpen);
  const closeCommand = useSearchCommandStore((state) => state.closeCommand);
  const toggleCommand = useSearchCommandStore((state) => state.toggleCommand);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, { wait: 350 });
  const searchQuery = useDocumentSearch(debouncedQuery, accessToken, open);

  // Cmd/Ctrl + K 是工作区级快捷键，统一收敛在 SearchCommand，避免侧边栏和页面分别监听。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleCommand();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCommand]);

  const handleSelectDocument = useMemoizedFn((documentId: string) => {
    navigate(`/documents/${documentId}`);
    closeCommand();
    setQuery("");
  });

  const trimmedQuery = query.trim();
  const results = searchQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[min(640px,calc(100vw-32px))] overflow-hidden p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{t("search.title")}</DialogTitle>
          <DialogDescription>{t("search.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            aria-label={t("search.inputLabel")}
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search.placeholder")}
            value={query}
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">Esc</kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {!trimmedQuery ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("search.start")}</p> : null}
          {trimmedQuery && searchQuery.isLoading ? (
            <p className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("search.loading")}
            </p>
          ) : null}
          {trimmedQuery && searchQuery.isError ? <p className="px-3 py-8 text-center text-sm text-destructive">{t("search.failed")}</p> : null}
          {trimmedQuery && !searchQuery.isLoading && !searchQuery.isError && results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("search.empty")}</p>
          ) : null}
          {results.length ? (
            <div className="grid gap-1">
              {results.map((result) => (
                <Button
                  key={result.document.id}
                  className="h-auto justify-start gap-3 rounded-lg px-3 py-2 text-left"
                  onClick={() => handleSelectDocument(result.document.id)}
                  type="button"
                  variant="ghost"
                >
                  <span className="grid size-8 flex-none place-items-center rounded-md bg-muted text-base">
                    {result.document.icon || <FileText className="size-4 text-muted-foreground" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{result.document.title || t("documents.untitled")}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {result.matchType === "title" ? t("search.matchTitle") : t("search.matchContent")}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
