import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemoizedFn } from "ahooks";
import { useNavigate, useParams } from "react-router-dom";
import { documentApi } from "@my-notion-go/api-client";
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
  const navigate = useNavigate();
  const { documentId } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
          title: "Untitled",
        },
        accessToken,
      ),
    onSuccess(document) {
      void queryClient.invalidateQueries({ queryKey: documentsQueryKey });
      navigate(`/documents/${document.id}`);
    },
  });
  const updateDocument = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => documentApi.update(id, { title }, accessToken),
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

  // 新建和归档是工作区级动作，使用稳定回调传给多个子组件，避免子组件重复理解 mutation 细节。
  const createRootDocument = useMemoizedFn(() => {
    createDocument.mutate(undefined);
  });
  const archiveCurrentDocument = useMemoizedFn(() => {
    if (documentId) {
      archiveDocument.mutate(documentId);
    }
  });

  return (
    <main className="workspace-shell">
      <WorkspaceSidebar
        activeDocumentId={documentId}
        collapsed={sidebarCollapsed}
        createLoading={createDocument.isPending}
        logoutLoading={logoutLoading}
        onCollapse={() => setSidebarCollapsed(true)}
        onCreateChild={(parentId) => createDocument.mutate(parentId)}
        onCreateRoot={createRootDocument}
        onLogout={onLogout}
        onToggleTheme={toggleTheme}
        themeMode={themeMode}
        tree={treeQuery.data}
        treeLoading={treeQuery.isLoading}
        user={user}
      />

      <section className="workspace-main">
        <DocumentNavbar
          archiveLoading={archiveDocument.isPending}
          document={currentDocumentQuery.data}
          hasActiveDocument={Boolean(documentId)}
          loading={currentDocumentQuery.isLoading}
          onArchive={archiveCurrentDocument}
          onExpandSidebar={() => setSidebarCollapsed(false)}
          onToggleTheme={toggleTheme}
          sidebarCollapsed={sidebarCollapsed}
          themeMode={themeMode}
        />

        {documentId ? (
          <DocumentDetail
            document={currentDocumentQuery.data}
            loading={currentDocumentQuery.isLoading}
            onRename={(title) => updateDocument.mutate({ id: documentId, title })}
            renaming={updateDocument.isPending}
          />
        ) : (
          <EmptyDocuments creating={createDocument.isPending} onCreate={createRootDocument} userName={user?.name || ""} />
        )}
      </section>
    </main>
  );
}
