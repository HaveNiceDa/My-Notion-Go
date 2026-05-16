import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounceFn, useMemoizedFn, useUnmount } from "ahooks";
import { documentApi, type DocumentContent } from "@my-notion-go/api-client";
import { documentContentQueryKey } from "./queryKeys";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutosaveDocumentContentInput = {
  accessToken: string;
  documentId: string;
};

// useAutosaveDocumentContent 统一管理正文保存生命周期。
// 组件只需要提交最新 blocks，hook 负责防抖、调用 API、更新 React Query 缓存和暴露保存状态。
export function useAutosaveDocumentContent({ accessToken, documentId }: UseAutosaveDocumentContentInput) {
  const queryClient = useQueryClient();
  const latestContentRef = useRef<unknown[] | null>(null);
  const hasUnsavedContentRef = useRef(false);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const saveMutation = useMutation({
    mutationFn: (content: unknown[]) => documentApi.updateContent(documentId, { content }, accessToken),
    onSuccess(content, savedContent) {
      if (latestContentRef.current === savedContent) {
        hasUnsavedContentRef.current = false;
      }
      queryClient.setQueryData<DocumentContent>(documentContentQueryKey(documentId), content);
      setStatus("saved");
    },
    onError() {
      setStatus("error");
    },
  });
  const { run: debouncedSave, cancel } = useDebounceFn(
    (content: unknown[]) => {
      saveMutation.mutate(content);
    },
    {
      wait: 900,
    },
  );

  const scheduleSave = useMemoizedFn((content: unknown[]) => {
    latestContentRef.current = content;
    hasUnsavedContentRef.current = true;
    setStatus("saving");
    debouncedSave(content);
  });

  useUnmount(() => {
    cancel();
    const latestContent = latestContentRef.current;
    if (!hasUnsavedContentRef.current || latestContent === null) {
      return;
    }

    // 组件卸载可能发生在切换文档或关闭页面前；keepalive 尽量让最后一次正文保存离开页面后仍能送达后端。
    void documentApi.updateContent(documentId, { content: latestContent }, accessToken, { keepalive: true }).catch(() => undefined);
  });

  return {
    cancel,
    scheduleSave,
    status,
  };
}
