import type { PartialBlock } from "@blocknote/core";
import { en, zh } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../theme/themeStore";
import { useAutosaveDocumentContent, type AutosaveStatus } from "./useAutosaveDocumentContent";
import { useDocumentContent } from "./useDocumentContent";

type DocumentEditorProps = {
  accessToken: string;
  citationTarget: CitationHighlightTarget | null;
  documentId: string;
};

export type CitationHighlightTarget = {
  blockId?: string;
  chunkId: string;
  position?: number;
};

// DocumentEditor 是正文编辑器容器：读取 JSONB 正文，初始化 BlockNote，并把变更交给自动保存 hook。
export function DocumentEditor({ accessToken, citationTarget, documentId }: DocumentEditorProps) {
  const { t } = useTranslation();
  const contentQuery = useDocumentContent(documentId, accessToken);

  if (contentQuery.isLoading) {
    return <p className="my-5 text-sm text-muted-foreground">{t("documents.contentLoading")}</p>;
  }

  if (contentQuery.isError || !contentQuery.data) {
    return <p className="my-5 text-sm text-[var(--danger)]">{t("documents.contentLoadFailed")}</p>;
  }

  const initialContent = toBlockNoteContent(contentQuery.data.content);
  const contentSyncKey = `${documentId}:${contentQuery.data.version}:${contentQuery.data.contentHash}`;

  return (
    <BlockNoteEditorSurface
      accessToken={accessToken}
      citationTarget={citationTarget}
      contentSyncKey={contentSyncKey}
      documentId={documentId}
      key={documentId}
      initialContent={initialContent}
    />
  );
}

type ReadonlyDocumentContentProps = {
  content: unknown[];
};

export function ReadonlyDocumentContent({ content }: ReadonlyDocumentContentProps) {
  const { i18n, t } = useTranslation();
  const themeMode = useThemeStore((state) => state.mode);
  const blockNoteDictionary = useMemo(
    () => createBlockNoteDictionary(i18n.language, t("editor.placeholder")),
    [i18n.language, t],
  );
  const editor = useCreateBlockNote({
    dictionary: blockNoteDictionary,
    initialContent: toBlockNoteContent(content),
  }, [blockNoteDictionary]);

  return (
    <section className="document-editor mt-4">
      <BlockNoteView editable={false} editor={editor} theme={themeMode} />
    </section>
  );
}

type BlockNoteEditorSurfaceProps = {
  accessToken: string;
  citationTarget: CitationHighlightTarget | null;
  contentSyncKey: string;
  documentId: string;
  initialContent: PartialBlock[] | undefined;
};

type BlockNoteDictionary = NonNullable<Parameters<typeof useCreateBlockNote>[0]>["dictionary"];

// BlockNoteEditorSurface 按 documentId 重新挂载，确保切换文档时编辑器不会复用上一篇文档的本地状态。
function BlockNoteEditorSurface({ accessToken, citationTarget, contentSyncKey, documentId, initialContent }: BlockNoteEditorSurfaceProps) {
  const { i18n, t } = useTranslation();
  const themeMode = useThemeStore((state) => state.mode);
  const autosave = useAutosaveDocumentContent({ accessToken, documentId });
  const editorRootRef = useRef<HTMLElement | null>(null);
  const applyingRemoteContentRef = useRef(false);
  const lastAppliedContentSyncKeyRef = useRef(contentSyncKey);
  const blockNoteDictionary = useMemo(
    () => createBlockNoteDictionary(i18n.language, t("editor.placeholder")),
    [i18n.language, t],
  );
  const editor = useCreateBlockNote({
    dictionary: blockNoteDictionary,
    initialContent,
  }, [blockNoteDictionary]);

  useEffect(() => {
    if (lastAppliedContentSyncKeyRef.current === contentSyncKey) {
      return;
    }
    lastAppliedContentSyncKeyRef.current = contentSyncKey;
    if (isSameBlockNoteDocument(editor.document, initialContent)) {
      return;
    }

    // React Query 已经拿到远端最终态，但 BlockNote 不会自动消费新的 initialContent，需要显式替换当前 blocks。
    applyingRemoteContentRef.current = true;
    editor.replaceBlocks(editor.document, initialContent ?? createEmptyBlockNoteContent());
    window.setTimeout(() => {
      applyingRemoteContentRef.current = false;
    }, 0);
  }, [contentSyncKey, editor, initialContent]);

  useEffect(() => {
    if (!citationTarget) {
      return;
    }

    // BlockNote 会在 React commit 后再挂载内部 ProseMirror DOM；延迟一帧可以稳定拿到 data-id 节点。
    const frameID = window.requestAnimationFrame(() => {
      highlightCitationSource(editorRootRef.current, citationTarget);
    });
    return () => window.cancelAnimationFrame(frameID);
  }, [citationTarget]);

  return (
    <section className="document-editor mt-4" ref={editorRootRef}>
      <div className={`mb-2 flex min-h-5 justify-end text-xs ${autosave.status === "error" ? "text-[var(--danger)]" : "text-muted-foreground"}`}>
        <span>{statusLabel(autosave.status, t)}</span>
      </div>
      <BlockNoteView
        editor={editor}
        onChange={() => {
          if (applyingRemoteContentRef.current) {
            return;
          }
          autosave.scheduleSave(editor.document);
        }}
        theme={themeMode}
      />
    </section>
  );
}

function highlightCitationSource(root: HTMLElement | null, target: CitationHighlightTarget) {
  const sourceElement = findCitationSourceElement(root, target);
  if (!sourceElement) {
    return;
  }

  sourceElement.scrollIntoView({ behavior: "smooth", block: "center" });
  sourceElement.animate(
    [
      { backgroundColor: "rgba(250, 204, 21, 0.28)", outline: "2px solid rgba(245, 158, 11, 0.65)" },
      { backgroundColor: "rgba(250, 204, 21, 0.12)", outline: "2px solid rgba(245, 158, 11, 0.25)" },
      { backgroundColor: "transparent", outline: "2px solid transparent" },
    ],
    {
      duration: 1800,
      easing: "ease-out",
    },
  );
}

function findCitationSourceElement(root: HTMLElement | null, target: CitationHighlightTarget) {
  if (!root) {
    return null;
  }

  if (target.blockId) {
    const blockContent = root.querySelector<HTMLElement>(`[data-id="${escapeCSSValue(target.blockId)}"]`);
    const blockOuter = blockContent?.closest<HTMLElement>(".bn-block-outer");
    return blockOuter ?? blockContent;
  }

  if (typeof target.position === "number" && target.position >= 0) {
    const blocks = root.querySelectorAll<HTMLElement>(".bn-block-outer");
    return blocks.item(target.position) ?? null;
  }

  return null;
}

function escapeCSSValue(value: string) {
  return window.CSS?.escape ? window.CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
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
export function toBlockNoteContent(content: unknown[]): PartialBlock[] | undefined {
  if (!Array.isArray(content) || content.length === 0) {
    return undefined;
  }

  const blocks = content.filter(isSafePartialBlock).map(sanitizeBlockNoteBlock);

  return blocks.length > 0 ? blocks : undefined;
}

function createEmptyBlockNoteContent(): PartialBlock[] {
  return [{ type: "paragraph" }];
}

function isSameBlockNoteDocument(currentContent: unknown[], nextContent: PartialBlock[] | undefined) {
  return JSON.stringify(currentContent) === JSON.stringify(nextContent ?? createEmptyBlockNoteContent());
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
