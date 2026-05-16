import type { PartialBlock } from "@blocknote/core";
import { en, zh } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../theme/themeStore";
import { useAutosaveDocumentContent, type AutosaveStatus } from "./useAutosaveDocumentContent";
import { useDocumentContent } from "./useDocumentContent";

type DocumentEditorProps = {
  accessToken: string;
  documentId: string;
};

// DocumentEditor 是正文编辑器容器：读取 JSONB 正文，初始化 BlockNote，并把变更交给自动保存 hook。
export function DocumentEditor({ accessToken, documentId }: DocumentEditorProps) {
  const { t } = useTranslation();
  const contentQuery = useDocumentContent(documentId, accessToken);

  if (contentQuery.isLoading) {
    return <p className="editor-status-text">{t("documents.contentLoading")}</p>;
  }

  if (contentQuery.isError || !contentQuery.data) {
    return <p className="editor-status-text error">{t("documents.contentLoadFailed")}</p>;
  }

  const initialContent = toBlockNoteContent(contentQuery.data.content);

  return (
    <BlockNoteEditorSurface
      accessToken={accessToken}
      documentId={documentId}
      key={documentId}
      initialContent={initialContent}
    />
  );
}

type BlockNoteEditorSurfaceProps = {
  accessToken: string;
  documentId: string;
  initialContent: PartialBlock[] | undefined;
};

type BlockNoteDictionary = NonNullable<Parameters<typeof useCreateBlockNote>[0]>["dictionary"];

// BlockNoteEditorSurface 按 documentId 重新挂载，确保切换文档时编辑器不会复用上一篇文档的本地状态。
function BlockNoteEditorSurface({ accessToken, documentId, initialContent }: BlockNoteEditorSurfaceProps) {
  const { i18n, t } = useTranslation();
  const themeMode = useThemeStore((state) => state.mode);
  const autosave = useAutosaveDocumentContent({ accessToken, documentId });
  const blockNoteDictionary = useMemo(
    () => createBlockNoteDictionary(i18n.language, t("editor.placeholder")),
    [i18n.language, t],
  );
  const editor = useCreateBlockNote({
    dictionary: blockNoteDictionary,
    initialContent,
  }, [blockNoteDictionary]);

  return (
    <section className="document-editor">
      <div className={`autosave-indicator ${autosave.status}`}>
        <span>{statusLabel(autosave.status, t)}</span>
      </div>
      <BlockNoteView
        editor={editor}
        onChange={() => autosave.scheduleSave(editor.document)}
        theme={themeMode}
      />
    </section>
  );
}

function createBlockNoteDictionary(language: string, placeholder: string): BlockNoteDictionary {
  const baseDictionary = (language === "en" ? en : zh) as NonNullable<BlockNoteDictionary>;

  return {
    ...baseDictionary,
    placeholders: {
      ...baseDictionary.placeholders,
      default: placeholder,
      emptyDocument: placeholder,
    },
  };
}

function statusLabel(status: AutosaveStatus, t: ReturnType<typeof useTranslation>["t"]) {
  if (status === "saving") {
    return t("editor.saving");
  }
  if (status === "saved") {
    return t("editor.saved");
  }
  if (status === "error") {
    return t("editor.error");
  }

  return t("editor.idle");
}

// BlockNote 没有正文时可以自己创建默认空段落，所以后端空数组直接交给编辑器默认逻辑。
// 只有后端返回非空 blocks 时才作为 initialContent 传入，避免把历史异常数据带进编辑器。
function toBlockNoteContent(content: unknown[]): PartialBlock[] | undefined {
  if (!Array.isArray(content) || content.length === 0) {
    return undefined;
  }

  const blocks = content.filter(isSafePartialBlock).map(sanitizeBlockNoteBlock);

  return blocks.length > 0 ? blocks : undefined;
}

function isSafePartialBlock(value: unknown): value is PartialBlock {
  if (!value || typeof value !== "object") {
    return false;
  }

  const block = value as { type?: unknown };
  return block.type === undefined || typeof block.type === "string";
}

function sanitizeBlockNoteBlock(block: PartialBlock): PartialBlock {
  const sanitized: PartialBlock = { ...block };
  if (!Array.isArray(sanitized.content) && typeof sanitized.content !== "string") {
    delete sanitized.content;
  }
  if (!Array.isArray(sanitized.children)) {
    delete sanitized.children;
  }

  return sanitized;
}
