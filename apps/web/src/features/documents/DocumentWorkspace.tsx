import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemoizedFn } from "ahooks";
import { Bot } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { documentApi, ragApi, type DocumentTreeNode, type UpdateDocumentRequest } from "@my-notion-go/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { AIChatPanel } from "../ai-chat/AIChatPanel";
import { useAuthStore } from "../auth/authStore";
import { useRealtimeEvents } from "../realtime/useRealtimeEvents";
import { SearchCommand } from "../search/SearchCommand";
import { useSearchCommandStore } from "../search/searchStore";
import { useThemeStore } from "../theme/themeStore";
import { DocumentDetail } from "./DocumentDetail";
import { DocumentNavbar } from "./DocumentNavbar";
import { EmptyDocuments } from "./EmptyDocuments";
import { TrashView } from "./TrashView";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { documentQueryKey, documentsQueryKey, documentsTrashQueryKey } from "./queryKeys";

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
  const openSearchCommand = useSearchCommandStore((state) => state.openCommand);
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiChatOpen, setAIChatOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"documents" | "trash">("documents");
  const citationTarget = useMemo(() => getCitationTarget(searchParams), [searchParams]);
  useRealtimeEvents(accessToken, Boolean(accessToken));
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
  const trashQuery = useQuery({
    queryKey: documentsTrashQueryKey,
    queryFn: () => documentApi.trash(accessToken),
    enabled: Boolean(accessToken && viewMode === "trash"),
  });
  const currentDocumentQuery = useQuery({
    queryKey: documentQueryKey(documentId),
    queryFn: () => documentApi.get(documentId!, accessToken),
    enabled: Boolean(accessToken && documentId),
  });
  const favoriteDocuments = useMemo(() => orderFavoriteDocuments(collectFavoriteDocuments(treeQuery.data ?? [])), [treeQuery.data]);
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
  const toggleStarDocument = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) => documentApi.update(id, { isStarred: !starred }, accessToken),
    onSuccess(document) {
      queryClient.setQueryData(documentQueryKey(document.id), document);
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      toast.success(document.isStarred ? t("favorites.starSuccess") : t("favorites.unstarSuccess"));
    },
    onError() {
      toast.error(t("favorites.updateFailed"));
    },
  });
  const publishDocument = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      published ? documentApi.unpublish(id, accessToken) : documentApi.publish(id, accessToken),
    onSuccess(document) {
      queryClient.setQueryData(documentQueryKey(document.id), document);
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      toast.success(document.isPublished ? t("publish.publishSuccess") : t("publish.unpublishSuccess"));
    },
    onError() {
      toast.error(t("publish.updateFailed"));
    },
  });
  const reorderFavoritesMutation = useMutation({
    mutationFn: (orderedIds: string[]) => documentApi.updateFavoritesOrder(orderedIds, accessToken),
    async onMutate(orderedIds) {
      await queryClient.cancelQueries({ queryKey: documentsQueryKey });
      const previousTree = queryClient.getQueryData<DocumentTreeNode[]>(documentsQueryKey);
      queryClient.setQueryData<DocumentTreeNode[]>(documentsQueryKey, (tree) => (tree ? applyStarredPositions(tree, orderedIds) : tree));
      return { previousTree };
    },
    onError(_error, _orderedIds, context) {
      if (context?.previousTree) {
        queryClient.setQueryData(documentsQueryKey, context.previousTree);
      }
      toast.error(t("favorites.updateFailed"));
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
    },
  });
  const archiveDocument = useMutation({
    mutationFn: (id: string) => documentApi.archive(id, accessToken),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: documentsTrashQueryKey });
      navigate("/app");
    },
  });
  const restoreDocument = useMutation({
    mutationFn: (id: string) => documentApi.restore(id, accessToken),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: documentsTrashQueryKey });
      toast.success(t("trash.restoreSuccess"));
    },
    onError() {
      toast.error(t("trash.restoreFailed"));
    },
  });
  const deleteDocument = useMutation({
    mutationFn: (id: string) => documentApi.delete(id, accessToken),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      void queryClient.invalidateQueries({ queryKey: documentsTrashQueryKey });
      toast.success(t("trash.deleteSuccess"));
    },
    onError() {
      toast.error(t("trash.deleteFailed"));
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
  const toggleCurrentStar = useMemoizedFn(() => {
    if (!documentId || !currentDocumentQuery.data) {
      return;
    }
    toggleStarDocument.mutate({ id: documentId, starred: currentDocumentQuery.data.isStarred });
  });
  const publishCurrentDocument = useMemoizedFn(() => {
    if (!documentId || !currentDocumentQuery.data) {
      return;
    }
    publishDocument.mutate({ id: documentId, published: false });
  });
  const unpublishCurrentDocument = useMemoizedFn(() => {
    if (!documentId || !currentDocumentQuery.data) {
      return;
    }
    publishDocument.mutate({ id: documentId, published: true });
  });
  const openDocumentView = useMemoizedFn(() => {
    setViewMode("documents");
  });
  const openFavoriteDocument = useMemoizedFn((id: string) => {
    setViewMode("documents");
    navigate(`/documents/${id}`);
  });
  const reorderFavorites = useMemoizedFn((sourceDocumentId: string, targetDocumentId: string) => {
    reorderFavoritesMutation.mutate(reorderFavoriteOrder(favoriteDocuments, sourceDocumentId, targetDocumentId));
  });
  const openTrashView = useMemoizedFn(() => {
    setViewMode("trash");
    navigate("/app");
  });

  useEffect(() => {
    if (documentId) {
      setViewMode("documents");
    }
  }, [documentId]);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background">
      <WorkspaceSidebar
        activeDocumentId={documentId}
        activeView={viewMode}
        actionLoading={createDocument.isPending || updateDocument.isPending || toggleStarDocument.isPending || reorderFavoritesMutation.isPending}
        collapsed={sidebarCollapsed}
        createLoading={createDocument.isPending}
        favoriteDocuments={favoriteDocuments}
        logoutLoading={logoutLoading}
        onCollapse={() => setSidebarCollapsed(true)}
        onCreateChild={(parentId) => createDocument.mutate(parentId)}
        onCreateRoot={createRootDocument}
        onLogout={onLogout}
        onMove={(id, parentId) => updateDocument.mutate({ id, input: { parentId } })}
        onOpenDocument={openDocumentView}
        onOpenFavorite={openFavoriteDocument}
        onOpenSearch={openSearchCommand}
        onOpenTrash={openTrashView}
        onReorderFavorites={reorderFavorites}
        onRename={(id, title) => updateDocument.mutate({ id, input: { title } })}
        onToggleStar={(id, starred) => toggleStarDocument.mutate({ id, starred })}
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
          onPublish={publishCurrentDocument}
          onToggleStar={toggleCurrentStar}
          onToggleTheme={toggleTheme}
          onUnpublish={unpublishCurrentDocument}
          publishActionLoading={publishDocument.isPending}
          ragActionLoading={toggleKnowledgeBase.isPending}
          starActionLoading={toggleStarDocument.isPending}
          sidebarCollapsed={sidebarCollapsed}
          themeMode={themeMode}
        />

        <div className="min-h-0 flex-1 overflow-auto">
          {viewMode === "trash" ? (
            <TrashView
              deletingId={deleteDocument.isPending ? deleteDocument.variables : undefined}
              documents={trashQuery.data}
              loading={trashQuery.isLoading}
              onDelete={(id) => deleteDocument.mutate(id)}
              onRestore={(id) => restoreDocument.mutate(id)}
              restoringId={restoreDocument.isPending ? restoreDocument.variables : undefined}
            />
          ) : documentId ? (
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
      <SearchCommand />
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

function collectFavoriteDocuments(nodes: DocumentTreeNode[]): DocumentTreeNode[] {
  const result: DocumentTreeNode[] = [];
  for (const node of nodes) {
    if (node.isStarred && !node.isArchived) {
      result.push({ ...node, children: [] });
    }
    result.push(...collectFavoriteDocuments(node.children));
  }

  return result;
}

function orderFavoriteDocuments(documents: DocumentTreeNode[]) {
  return [...documents].sort((a, b) => {
    const aPosition = a.starredPosition;
    const bPosition = b.starredPosition;
    if (aPosition != null && bPosition != null && aPosition !== bPosition) {
      return aPosition - bPosition;
    }
    if (aPosition != null && bPosition == null) {
      return -1;
    }
    if (aPosition == null && bPosition != null) {
      return 1;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function reorderFavoriteOrder(documents: DocumentTreeNode[], sourceDocumentId: string, targetDocumentId: string) {
  const ids = documents.map((document) => document.id);
  const sourceIndex = ids.indexOf(sourceDocumentId);
  const targetIndex = ids.indexOf(targetDocumentId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return ids;
  }
  const [sourceId] = ids.splice(sourceIndex, 1);
  ids.splice(targetIndex, 0, sourceId);
  return ids;
}

function applyStarredPositions(nodes: DocumentTreeNode[], orderedIds: string[]): DocumentTreeNode[] {
  const positionByID = new Map(orderedIds.map((id, index) => [id, index + 1]));
  return nodes.map((node) => ({
    ...node,
    starredPosition: positionByID.get(node.id) ?? node.starredPosition,
    children: applyStarredPositions(node.children, orderedIds),
  }));
}
