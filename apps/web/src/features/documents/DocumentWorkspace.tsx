import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemoizedFn } from "ahooks";
import { Bot } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { documentApi, ragApi, type UpdateDocumentRequest } from "@my-notion-go/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { AIChatPanel } from "../ai-chat/AIChatPanel";
import { useAuthStore } from "../auth/authStore";
import { useThemeStore } from "../theme/themeStore";
import { DocumentDetail } from "./DocumentDetail";
import { DocumentNavbar } from "./DocumentNavbar";
import { EmptyDocuments } from "./EmptyDocuments";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { documentQueryKey, documentsQueryKey } from "./queryKeys";

type DocumentWorkspaceProps = {
  onLogout: () => void;
  logoutLoading: boolean;
};

// DocumentWorkspace 是 Document MVP 的容器层：集中编排 React Query、mutation 和路由跳转，展示细节交给子组件。
export function DocumentWorkspace({ onLogout, logoutLoading }: DocumentWorkspaceProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { documentId } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiChatOpen, setAIChatOpen] = useState(false);
  const citationTarget = useMemo(() => getCitationTarget(searchParams), [searchParams]);
  // sidebar 宽度属于整体工作区布局状态，放在容器层可避免侧边栏内部重渲染时丢失宽度。
  const sidebarResize = useResizableWidth({
    defaultWidth: 240,
    edge: "left",
    maxWidth: 420,
    minWidth: 220,
    storageKey: "my-notion-go.sidebar.width",
  });

  const treeQuery = useQuery({
    queryKey: documentsQueryKey,
    queryFn: () => documentApi.tree(accessToken),
    enabled: Boolean(accessToken),
  });
  const currentDocumentQuery = useQuery({
    queryKey: documentQueryKey(documentId),
    queryFn: () => documentApi.get(documentId!, accessToken),
    enabled: Boolean(accessToken && documentId),
  });
  const createDocument = useMutation({
    mutationFn: (parentId?: string) =>
      documentApi.create(
        {
          parentId,
          title: t("documents.untitled"),
        },
        accessToken,
      ),
    onSuccess(document) {
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      navigate(`/documents/${document.id}`);
    },
  });
  const updateDocument = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateDocumentRequest }) => documentApi.update(id, input, accessToken),
    onSuccess(document) {
      queryClient.setQueryData(documentQueryKey(document.id), document);
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    },
  });
  const archiveDocument = useMutation({
    mutationFn: (id: string) => documentApi.archive(id, accessToken),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      navigate("/app");
    },
  });
  const toggleKnowledgeBase = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      enabled ? ragApi.disable(id, accessToken, { keepalive: true }) : ragApi.enable(id, accessToken, { keepalive: true }),
    onSuccess(status) {
      syncKnowledgeBaseFlag(queryClient, status);
      toast.success(status.isInKnowledgeBase ? t("documents.knowledgeBaseEnabledToast") : t("documents.knowledgeBaseDisabledToast"), {
        description: status.isInKnowledgeBase ? t("documents.knowledgeBaseEnabledDescription") : t("documents.knowledgeBaseDisabledDescription"),
      });
    },
    onError() {
      toast.error(t("documents.knowledgeBaseFailedToast"), {
        description: t("documents.knowledgeBaseFailedDescription"),
      });
    },
  });

  // 新建和归档是工作区级动作，使用稳定回调传给多个子组件，避免子组件重复理解 mutation 细节。
  const createRootDocument = useMemoizedFn(() => {
    createDocument.mutate(undefined);
  });
  const archiveCurrentDocument = useMemoizedFn(() => {
    if (documentId) {
      archiveDocument.mutate(documentId);
    }
  });
  const toggleCurrentKnowledgeBase = useMemoizedFn(() => {
    if (!documentId || !currentDocumentQuery.data) {
      return;
    }
    const enabled = currentDocumentQuery.data.isInKnowledgeBase;
    toggleKnowledgeBase.mutate({ id: documentId, enabled });
  });

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background">
      <WorkspaceSidebar
        activeDocumentId={documentId}
        actionLoading={createDocument.isPending || updateDocument.isPending}
        collapsed={sidebarCollapsed}
        createLoading={createDocument.isPending}
        logoutLoading={logoutLoading}
        onCollapse={() => setSidebarCollapsed(true)}
        onCreateChild={(parentId) => createDocument.mutate(parentId)}
        onCreateRoot={createRootDocument}
        onLogout={onLogout}
        onMove={(id, parentId) => updateDocument.mutate({ id, input: { parentId } })}
        onRename={(id, title) => updateDocument.mutate({ id, input: { title } })}
        onToggleTheme={toggleTheme}
        themeMode={themeMode}
        tree={treeQuery.data}
        treeLoading={treeQuery.isLoading}
        user={user}
        width={sidebarResize.width}
        onResizeStart={sidebarResize.startResize}
      />

      <section className="flex h-full min-w-0 flex-1 flex-col bg-background">
        <DocumentNavbar
          archiveLoading={archiveDocument.isPending}
          document={currentDocumentQuery.data}
          hasActiveDocument={Boolean(documentId)}
          loading={currentDocumentQuery.isLoading}
          onArchive={archiveCurrentDocument}
          onExpandSidebar={() => setSidebarCollapsed(false)}
          onToggleAIChat={() => setAIChatOpen((open) => !open)}
          onToggleKnowledgeBase={toggleCurrentKnowledgeBase}
          onToggleTheme={toggleTheme}
          ragActionLoading={toggleKnowledgeBase.isPending}
          sidebarCollapsed={sidebarCollapsed}
          themeMode={themeMode}
        />

        <div className="min-h-0 flex-1 overflow-auto">
          {documentId ? (
            <DocumentDetail
              citationTarget={citationTarget}
              document={currentDocumentQuery.data}
              loading={currentDocumentQuery.isLoading}
              onRename={(title) => updateDocument.mutate({ id: documentId, input: { title } })}
              renaming={updateDocument.isPending}
            />
          ) : (
            <EmptyDocuments creating={createDocument.isPending} onCreate={createRootDocument} userName={user?.name || ""} />
          )}
        </div>
      </section>

      {!aiChatOpen ? (
        <Button
          aria-label={t("aiChat.open")}
          className="fixed bottom-8 right-8 z-30 size-12 rounded-full border bg-background shadow-lg hover:bg-secondary"
          onClick={() => setAIChatOpen(true)}
          size="icon"
          title={t("aiChat.open")}
          type="button"
          variant="outline"
        >
          <Bot size={22} />
        </Button>
      ) : null}

      <AIChatPanel accessToken={accessToken} onClose={() => setAIChatOpen(false)} open={aiChatOpen} />
    </main>
  );
}

function syncKnowledgeBaseFlag(queryClient: ReturnType<typeof useQueryClient>, status: { documentId: string; isInKnowledgeBase: boolean }) {
  queryClient.setQueryData(documentQueryKey(status.documentId), (document) =>
    document ? { ...document, isInKnowledgeBase: status.isInKnowledgeBase } : document,
  );
  void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
}

function getCitationTarget(searchParams: URLSearchParams) {
  const chunkId = searchParams.get("citationChunkId")?.trim();
  if (!chunkId) {
    return null;
  }

  const position = Number(searchParams.get("citationPosition"));
  return {
    blockId: searchParams.get("citationBlockId")?.trim() || undefined,
    chunkId,
    position: Number.isFinite(position) ? position : undefined,
  };
}
