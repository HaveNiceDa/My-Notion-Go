import { useEffect, useState } from "react";
import { useMemoizedFn } from "ahooks";
import { useTranslation } from "react-i18next";
import type { Document } from "@my-notion-go/api-client";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "../auth/authStore";
import { DocumentEditor, type CitationHighlightTarget } from "./DocumentEditor";
import { EmptyDocuments } from "./EmptyDocuments";

type DocumentDetailProps = {
  citationTarget: CitationHighlightTarget | null;
  document?: Document;
  loading: boolean;
  onRename: (title: string) => void;
  renaming: boolean;
};

// DocumentDetail 是文档详情 MVP：只负责 metadata 层的标题编辑，正文编辑器留给下一阶段。
export function DocumentDetail({ citationTarget, document, loading, onRename, renaming }: DocumentDetailProps) {
  const { i18n, t } = useTranslation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [title, setTitle] = useState(document?.title || "");

  useEffect(() => {
    setTitle(document?.title || "");
  }, [document?.title]);

  // 标题保存使用 ahooks 的稳定回调，避免输入框事件在重渲染时拿到旧闭包。
  const commitTitle = useMemoizedFn(() => {
    const nextTitle = title.trim() || t("documents.untitled");
    if (document && nextTitle !== document.title) {
      onRename(nextTitle);
    }
    setTitle(nextTitle);
  });

  if (loading) {
    return (
      <article className="mx-auto w-[min(900px,100%)] px-6 py-12 pb-24 md:px-24 md:py-[74px] md:pb-[120px]">
        <div className="mb-6 h-11 w-[62%] rounded-full bg-muted" />
        <div className="h-3.5 w-full rounded-full bg-muted" />
        <div className="mt-2 h-3.5 w-[72%] rounded-full bg-muted" />
      </article>
    );
  }

  if (!document) {
    return <EmptyDocuments creating={false} onCreate={() => undefined} userName="" />;
  }

  const updatedAt = new Date(document.updatedAt).toLocaleString(i18n.language === "en" ? "en-US" : "zh-CN");

  return (
    <article className="mx-auto w-[min(900px,100%)] px-6 py-12 pb-24 md:px-24 md:py-[74px] md:pb-[120px]">
      <div className="mb-[18px] h-24 rounded-[10px] bg-[linear-gradient(135deg,var(--secondary),color-mix(in_srgb,var(--secondary)_70%,var(--background)))]" />
      <Input
        aria-label={t("documents.titleInput")}
        className="h-auto border-transparent bg-transparent px-0 py-1 text-[clamp(34px,5vw,48px)] font-bold tracking-[-0.045em] shadow-none focus-visible:border-border focus-visible:px-2.5 focus-visible:ring-[var(--ring)]"
        disabled={renaming}
        onBlur={commitTitle}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        value={title}
      />
      <p className="mb-7 mt-2.5 text-[13px] text-muted-foreground">{t("documents.lastEdited", { time: updatedAt })}</p>
      <DocumentEditor accessToken={accessToken} citationTarget={citationTarget} documentId={document.id} />
    </article>
  );
}
