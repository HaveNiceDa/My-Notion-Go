import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
import { cn } from "@/lib/cn";
import { mobileApiBaseUrl } from "@/lib/api-config";
import { useAuthStore } from "@/stores/auth-store";
import { Pressable, Text, View } from "@/tw";
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
      <Card>
        <CardEyebrow selectable>{t("mobileDocuments.phaseLabel")}</CardEyebrow>
        <CardTitle selectable>{t("mobileDocuments.errorTitle")}</CardTitle>
        <CardDescription selectable>{t("mobileDocuments.errorDescription")}</CardDescription>
        <Button label={t("mobileDocuments.retry")} onPress={() => documentsQuery.refetch()} />
      </Card>
    );
  }

  return (
    <View className="gap-5">
      <Card>
        <CardEyebrow selectable>{t("mobileDocuments.phaseLabel")}</CardEyebrow>
        <CardTitle selectable>{t("mobileDocuments.title")}</CardTitle>
        <CardDescription selectable>{t("mobileDocuments.subtitle")}</CardDescription>
        <View className="mt-1 flex-row gap-2">
          <MetricPill label={t("mobileDocuments.totalCount", { count: activeDocuments.length })} />
          <MetricPill label={t("mobileDocuments.favoriteCount", { count: favoriteDocuments.length })} />
        </View>
      </Card>

      <View className="flex-row gap-2">
        <QuickAction label={t("workspace.search")} onPress={() => router.push("/search")} />
        <QuickAction label={t("workspace.favorites")} />
        <QuickAction label={t("workspace.trash")} onPress={() => router.push("/trash")} />
      </View>

      <DocumentSection
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

      <View className="gap-3">
        <Text selectable className="text-sm font-bold text-notion-text">
          {t("mobileDocuments.allDocuments")}
        </Text>
        {activeDocuments.length > 0 ? (
          <View className="overflow-hidden rounded-[24px] bg-notion-surface">
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
      </View>

      <InfoCard>
        <CardEyebrow selectable>{t("auth.email")}</CardEyebrow>
        <Text selectable className="text-[15px] text-stone-800">
          {user?.email}
        </Text>
        <CardEyebrow selectable className="mt-2">
          {t("App.apiLabel")}
        </CardEyebrow>
        <Text selectable className="text-[15px] text-stone-800 tabular-nums">
          {mobileApiBaseUrl}
        </Text>
        <Button
          accessibilityLabel={isLoggingOut ? t("workspace.loggingOut") : t("workspace.logout")}
          className="mt-2"
          isLoading={isLoggingOut}
          label={t("workspace.logout")}
          loadingLabel={t("workspace.loggingOut")}
          onPress={handleLogout}
        />
      </InfoCard>
    </View>
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
    <View className="gap-3">
      <Text selectable className="text-sm font-bold text-notion-text">
        {title}
      </Text>
      {nodes.length > 0 ? (
        <View className="overflow-hidden rounded-[24px] bg-notion-surface">
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
    </View>
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
  const icon = document.icon || "📄";

  return (
    <Pressable
      accessibilityLabel={t("mobileDocuments.openDocument", { title })}
      accessibilityRole="button"
      className={cn("flex-row items-center gap-3 px-4 py-3.5", !isLast && "border-b border-notion-muted")}
      onPress={() => router.push({ pathname: "/documents/[documentId]", params: { documentId: document.id } })}
      style={showDepth ? { paddingLeft: 16 + document.depth * 14 } : undefined}
    >
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-notion-muted">
        <Text className="text-lg">{icon}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-1.5">
          <Text selectable className="shrink text-base font-semibold text-notion-text" numberOfLines={1}>
            {title}
          </Text>
          {document.isStarred ? <Text className="text-xs text-notion-faint">★</Text> : null}
        </View>
        <Text selectable className="text-xs text-notion-faint" numberOfLines={1}>
          {t("mobileDocuments.updatedAt", { time: formatDate(document.updatedAt, locale) })}
        </Text>
      </View>
      {document.children.length > 0 ? (
        <Text className="text-xs font-semibold text-notion-faint">
          {t("mobileDocuments.childCount", { count: document.children.length })}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MetricPill({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-notion-muted px-3 py-1.5">
      <Text selectable className="text-xs font-semibold text-notion-faint">
        {label}
      </Text>
    </View>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress?: () => void }) {
  if (!onPress) {
    return (
      <View className="flex-1 items-center rounded-2xl bg-notion-surface px-3 py-3">
        <Text selectable className="text-sm font-semibold text-notion-text">
          {label}
        </Text>
      </View>
    );
  }

  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" className="flex-1 items-center rounded-2xl bg-notion-surface px-3 py-3" onPress={onPress}>
      <Text selectable className="text-sm font-semibold text-notion-text">
        {label}
      </Text>
    </Pressable>
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
