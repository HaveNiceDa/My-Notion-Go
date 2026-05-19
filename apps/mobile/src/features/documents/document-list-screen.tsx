import { Button } from "@/components/ui/button";
import { BottomAction, BottomActionBar } from "@/components/ui/bottom-action-bar";
import { InfoCard } from "@/components/ui/card";
import { DocumentRow as UIDocumentRow } from "@/components/ui/document-row";
import { IconTile } from "@/components/ui/icon-tile";
import { LoadingCard } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { mobileApiBaseUrl } from "@/lib/api-config";
import { useAuthStore } from "@/stores/auth-store";
import { Pressable, ScrollView, Text, View } from "@/tw";
import type { DocumentTreeNode } from "@my-notion-go/api-client";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMobileDocumentTree } from "./use-mobile-document-tree";

type FlatDocumentNode = DocumentTreeNode & {
  depth: number;
};

export function DocumentListScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const documentsQuery = useMobileDocumentTree();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const flatDocuments = useMemo(() => flattenDocumentTree(documentsQuery.data ?? []), [documentsQuery.data]);
  const activeDocuments = flatDocuments.filter((document) => !document.isArchived);
  const favoriteDocuments = activeDocuments.filter((document) => document.isStarred).slice(0, 5);
  const recentDocuments = [...activeDocuments].sort(sortByUpdatedAtDesc).slice(0, 3);
  const locale = i18n.language === "en" ? "en-US" : "zh-CN";

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (documentsQuery.isLoading) {
    return (
      <LoadingCard>
        <Text selectable className="text-base leading-6 text-notion-subtle">
          {t("mobileDocuments.loading")}
        </Text>
      </LoadingCard>
    );
  }

  if (documentsQuery.isError) {
    return (
      <InfoCard>
        <Text selectable className="text-base font-semibold text-notion-text">
          {t("mobileDocuments.errorTitle")}
        </Text>
        <Text selectable className="text-sm leading-5 text-notion-faint">
          {t("mobileDocuments.errorDescription")}
        </Text>
        <Button label={t("mobileDocuments.retry")} onPress={() => documentsQuery.refetch()} variant="secondary" />
      </InfoCard>
    );
  }

  return (
    <View className="gap-5">
      <WorkspaceHeader
        email={user?.email}
        favoriteCount={favoriteDocuments.length}
        totalCount={activeDocuments.length}
        userName={user?.name}
      />

      <RecentSection
        emptyLabel={t("mobileDocuments.noRecent")}
        locale={locale}
        nodes={recentDocuments}
        title={t("mobileDocuments.recent")}
      />

      <DocumentSection
        emptyLabel={t("mobileDocuments.noFavorites")}
        locale={locale}
        nodes={favoriteDocuments}
        title={t("workspace.favorites")}
      />

      <Section title={t("mobileDocuments.allDocuments")}>
        {activeDocuments.length > 0 ? (
          <View className="gap-0.5">
            {activeDocuments.map((document, index) => (
              <DocumentRow
                key={document.id}
                document={document}
                isLast={index === activeDocuments.length - 1}
                locale={locale}
                showDepth
              />
            ))}
          </View>
        ) : (
          <EmptyState />
        )}
      </Section>

      <View className="gap-1 px-1">
        <Text selectable className="text-[13px] text-notion-faint" numberOfLines={1}>
          {user?.email}
        </Text>
        <Text selectable className="text-[12px] text-notion-faint tabular-nums" numberOfLines={1}>
          {mobileApiBaseUrl}
        </Text>
        <Button
          accessibilityLabel={isLoggingOut ? t("workspace.loggingOut") : t("workspace.logout")}
          className="mt-1 self-start"
          isLoading={isLoggingOut}
          label={t("workspace.logout")}
          loadingLabel={t("workspace.loggingOut")}
          onPress={handleLogout}
          variant="secondary"
        />
      </View>

      <BottomActionBar>
        <BottomAction label={t("workspace.search")} onPress={() => router.push("/search")} />
        <BottomAction label={t("aiChat.open")} />
        <BottomAction label={t("workspace.trash")} onPress={() => router.push("/trash")} primary />
      </BottomActionBar>
    </View>
  );
}

function WorkspaceHeader({
  email,
  favoriteCount,
  totalCount,
  userName,
}: {
  email?: string;
  favoriteCount: number;
  totalCount: number;
  userName?: string;
}) {
  const { t } = useTranslation();
  const displayName = userName || email || t("common.brand");

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <IconTile icon="📚" size="lg" />
        <View className="min-w-0 flex-1">
          <Text selectable className="text-xl font-bold leading-7 text-notion-text" numberOfLines={1}>
            {displayName}
          </Text>
          <Text selectable className="text-[13px] leading-5 text-notion-faint" numberOfLines={1}>
            {t("mobileDocuments.phaseLabel")}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <MetricPill label={t("mobileDocuments.totalCount", { count: totalCount })} />
        <MetricPill label={t("mobileDocuments.favoriteCount", { count: favoriteCount })} />
      </View>
    </View>
  );
}

function RecentSection({
  emptyLabel,
  locale,
  nodes,
  title,
}: {
  emptyLabel: string;
  locale: string;
  nodes: FlatDocumentNode[];
  title: string;
}) {
  return (
    <Section title={title}>
      {nodes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-4">
          {nodes.map((document) => (
            <RecentCard key={document.id} document={document} locale={locale} />
          ))}
        </ScrollView>
      ) : (
        <InfoCard>
          <Text selectable className="text-sm leading-5 text-notion-faint">
            {emptyLabel}
          </Text>
        </InfoCard>
      )}
    </Section>
  );
}

function RecentCard({ document, locale }: { document: FlatDocumentNode; locale: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const title = document.title || t("documents.untitled");

  return (
    <Pressable
      accessibilityLabel={t("mobileDocuments.openDocument", { title })}
      accessibilityRole="button"
      className="w-36 gap-3 rounded-2xl border border-notion-border bg-notion-surface p-3"
      onPress={() => router.push({ pathname: "/documents/[documentId]", params: { documentId: document.id } })}
    >
      <IconTile icon={document.icon || "📄"} />
      <View className="gap-1">
        <Text selectable className="text-sm font-semibold leading-5 text-notion-subtle" numberOfLines={2}>
          {title}
        </Text>
        <Text selectable className="text-xs text-notion-faint" numberOfLines={1}>
          {formatDate(document.updatedAt, locale)}
        </Text>
      </View>
    </Pressable>
  );
}

function DocumentSection({
  emptyLabel,
  locale,
  nodes,
  title,
}: {
  emptyLabel: string;
  locale: string;
  nodes: FlatDocumentNode[];
  title: string;
}) {
  return (
    <Section title={title}>
      {nodes.length > 0 ? (
        <View className="gap-0.5">
          {nodes.map((document, index) => (
            <DocumentRow key={document.id} document={document} isLast={index === nodes.length - 1} locale={locale} />
          ))}
        </View>
      ) : (
        <InfoCard>
          <Text selectable className="text-sm leading-5 text-notion-faint">
            {emptyLabel}
          </Text>
        </InfoCard>
      )}
    </Section>
  );
}

function DocumentRow({
  document,
  isLast,
  locale,
  showDepth = false,
}: {
  document: FlatDocumentNode;
  isLast: boolean;
  locale: string;
  showDepth?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const title = document.title || t("documents.untitled");

  return (
    <UIDocumentRow
      accessibilityLabel={t("mobileDocuments.openDocument", { title })}
      depth={showDepth ? document.depth : 0}
      icon={document.icon || "📄"}
      isLast={isLast}
      onPress={() => router.push({ pathname: "/documents/[documentId]", params: { documentId: document.id } })}
      rightAccessory={
        <View className="flex-row items-center gap-2">
          {document.isStarred ? <Text className="text-xs text-notion-faint">★</Text> : null}
          {document.children.length > 0 ? (
            <Text className="text-xs font-semibold text-notion-faint">
              {t("mobileDocuments.childCount", { count: document.children.length })}
            </Text>
          ) : null}
        </View>
      }
      subtitle={t("mobileDocuments.updatedAt", { time: formatDate(document.updatedAt, locale) })}
      title={title}
    />
  );
}

function MetricPill({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-notion-hover px-3 py-1.5">
      <Text selectable className="text-xs font-semibold text-notion-faint">
        {label}
      </Text>
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <InfoCard className="items-center py-8">
      <Text selectable className="text-base font-bold text-notion-text">
        {t("mobileDocuments.emptyTitle")}
      </Text>
      <Text selectable className="mt-1 text-center text-sm leading-5 text-notion-faint">
        {t("mobileDocuments.emptyDescription")}
      </Text>
    </InfoCard>
  );
}

function flattenDocumentTree(nodes: DocumentTreeNode[], depth = 0): FlatDocumentNode[] {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flattenDocumentTree(node.children, depth + 1)]);
}

function sortByUpdatedAtDesc(a: DocumentTreeNode, b: DocumentTreeNode) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
