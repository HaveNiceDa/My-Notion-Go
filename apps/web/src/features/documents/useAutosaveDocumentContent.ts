import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounceFn, useMemoizedFn } from "ahooks";
import { documentApi, type DocumentContent, type RAGDocumentStatus } from "@my-notion-go/api-client";
import { documentContentQueryKey, ragDocumentStatusQueryKey } from "./queryKeys";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutosaveDocumentContentInput = {
  accessToken: string;
  documentId: string;
};

// useAutosaveDocumentContent 统一管理正文保存生命周期。
// 组件只需要提交最新 blocks，hook 负责防抖、调用 API、更新 React Query 缓存和暴露保存状态。
export function useAutosaveDocumentContent({ accessToken, documentId }: UseAutosaveDocumentContentInput) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const saveMutation = useMutation({
    mutationFn: (content: unknown[]) => documentApi.updateContent(documentId, { content }, accessToken),
    onSuccess(content) {
      queryClient.setQueryData<DocumentContent>(documentContentQueryKey(documentId), content);
      markRAGStatusRefreshing(queryClient, documentId);
      void queryClient.invalidateQueries({ queryKey: ragDocumentStatusQueryKey(documentId) });
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
    setStatus("saving");
    debouncedSave(content);
  });

  return {
    cancel,
    scheduleSave,
    status,
  };
}

function markRAGStatusRefreshing(queryClient: ReturnType<typeof useQueryClient>, documentId: string) {
  queryClient.setQueryData<RAGDocumentStatus>(ragDocumentStatusQueryKey(documentId), (status) => {
    if (!status?.isInKnowledgeBase || status.status === "disabled") {
      return status;
    }

    // 正文保存成功后后端会后台重建索引；前端先进入 indexing，随后由 status query 轮询校准真实结果。
    return {
      ...status,
      status: "indexing",
      updatedAt: new Date().toISOString(),
    };
  });
}
