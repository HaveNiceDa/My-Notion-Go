import { useEffect, useState } from "react";
import { useMemoizedFn } from "ahooks";
import { Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Document } from "@my-notion-go/api-client";
import { EmptyDocuments } from "./EmptyDocuments";

type DocumentDetailProps = {
  document?: Document;
  loading: boolean;
  onRename: (title: string) => void;
  renaming: boolean;
};

// DocumentDetail 是文档详情 MVP：只负责 metadata 层的标题编辑，正文编辑器留给下一阶段。
export function DocumentDetail({ document, loading, onRename, renaming }: DocumentDetailProps) {
  const { i18n, t } = useTranslation();
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
      <article className="document-canvas">
        <div className="skeleton-line title" />
        <div className="skeleton-line" />
        <div className="skeleton-line wide" />
      </article>
    );
  }

  if (!document) {
    return <EmptyDocuments creating={false} onCreate={() => undefined} userName="" />;
  }

  const updatedAt = new Date(document.updatedAt).toLocaleString(i18n.language === "en" ? "en-US" : "zh-CN");

  return (
    <article className="document-canvas">
      <div className="document-cover-placeholder" />
      <input
        aria-label={t("documents.titleInput")}
        className="document-title-input"
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
      <p className="document-meta">{t("documents.lastEdited", { time: updatedAt })}</p>
      <div className="editor-placeholder">
        <Monitor size={18} />
        <p>{t("documents.editorNext")}</p>
      </div>
    </article>
  );
}
