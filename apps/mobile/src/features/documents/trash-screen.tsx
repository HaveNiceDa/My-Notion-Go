import { Button } from "@/components/ui/button";
import { InfoCard } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { LoadingCard } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import type { Document } from "@my-notion-go/api-client";
import { useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useMobileTrashActions } from "./use-mobile-trash-actions";
import { useMobileTrashDocuments } from "./use-mobile-trash-documents";

type TrashFeedback = {
  tone: "success" | "error";
  message: string;
};

export function TrashScreen() {
  const { i18n, t } = useTranslation();
  const trashQuery = useMobileTrashDocuments();
  const { deleteMutation, restoreMutation } = useMobileTrashActions();
  const [feedback, setFeedback] = useState<TrashFeedback | null>(null);
  const locale = i18n.language === "en" ? "en-US" : "zh-CN";

  async function handleRestore(document: Document) {
    try {
      await restoreMutation.mutateAsync(document.id);
      setFeedback({ tone: "success", message: t("trash.restoreSuccess") });
    } catch {
      setFeedback({ tone: "error", message: t("trash.restoreFailed") });
    }
  }

  function handleDelete(document: Document) {
    const title = document.title || t("documents.untitled");

    Alert.alert(t("trash.confirmDeleteTitle"), t("trash.confirmDeleteDescription", { title }), [
      { style: "cancel", text: t("common.cancel") },
      {
        onPress: () => {
          void deleteMutation
            .mutateAsync(document.id)
            .then(() => setFeedback({ tone: "success", message: t("trash.deleteSuccess") }))
            .catch(() => setFeedback({ tone: "error", message: t("trash.deleteFailed") }));
        },
        style: "destructive",
        text: t("trash.deleteForever"),
      },
    ]);
  }

  if (trashQuery.isLoading) {
    return (
      <LoadingCard>
        <Text selectable className="text-base leading-6 text-notion-subtle">
          {t("mobileDocuments.trashLoading")}
        </Text>
      </LoadingCard>
    );
  }

  if (trashQuery.isError) {
    return (
      <InfoCard>
        <Text selectable className="text-base font-semibold text-notion-text">
          {t("mobileDocuments.trashErrorTitle")}
        </Text>
        <Text selectable className="text-sm leading-5 text-notion-faint">
          {t("mobileDocuments.trashErrorDescription")}
        </Text>
        <Button label={t("mobileDocuments.retry")} onPress={() => trashQuery.refetch()} variant="secondary" />
      </InfoCard>
    );
  }

  const documents = trashQuery.data ?? [];

  return (
    <View className="gap-4">
      <View className="gap-1 px-1">
        <Text selectable className="text-2xl font-bold leading-8 text-notion-text">
          {t("trash.title")}
        </Text>
        <Text selectable className="text-sm leading-5 text-notion-faint">
          {t("trash.description")}
        </Text>
      </View>

      {feedback ? (
        <InfoCard className={cn("py-3", feedback.tone === "error" && "bg-notion-danger-muted")}>
          <Text selectable className={cn("text-sm font-semibold text-notion-subtle", feedback.tone === "error" && "text-notion-danger")}>
            {feedback.message}
          </Text>
        </InfoCard>
      ) : null}

      {documents.length > 0 ? (
        <Section title={t("trash.title")}>
          <View className="gap-1">
            {documents.map((document, index) => (
              <TrashRow
                key={document.id}
                deleteLoading={deleteMutation.isPending && deleteMutation.variables === document.id}
                document={document}
                isLast={index === documents.length - 1}
                locale={locale}
                restoreLoading={restoreMutation.isPending && restoreMutation.variables === document.id}
                onDelete={handleDelete}
                onRestore={handleRestore}
              />
            ))}
          </View>
        </Section>
      ) : (
        <InfoCard className="items-center py-8">
          <Text selectable className="text-base font-bold text-notion-text">
            {t("trash.emptyTitle")}
          </Text>
          <Text selectable className="mt-1 text-center text-sm leading-5 text-notion-faint">
            {t("trash.emptyDescription")}
          </Text>
        </InfoCard>
      )}
    </View>
  );
}

function TrashRow({
  deleteLoading,
  document,
  isLast,
  locale,
  restoreLoading,
  onDelete,
  onRestore,
}: {
  deleteLoading: boolean;
  document: Document;
  isLast: boolean;
  locale: string;
  restoreLoading: boolean;
  onDelete: (document: Document) => void;
  onRestore: (document: Document) => void;
}) {
  const { t } = useTranslation();
  const title = document.title || t("documents.untitled");
  const actionLoading = restoreLoading || deleteLoading;

  return (
    <View className={cn("gap-2.5 rounded-lg px-2 py-2", isLast && "mb-1")}>
      <View className="flex-row items-center gap-2.5">
        <IconTile icon={document.icon || "📄"} size="sm" />
        <View className="min-w-0 flex-1 gap-1">
          <Text selectable className="text-[15px] font-medium text-notion-subtle" numberOfLines={1}>
            {title}
          </Text>
          <Text selectable className="text-xs text-notion-faint" numberOfLines={1}>
            {t("trash.updatedAt", { time: formatDate(document.updatedAt, locale) })}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          isLoading={restoreLoading}
          label={t("trash.restore")}
          loadingLabel={t("trash.restoring")}
          onPress={() => onRestore(document)}
          disabled={actionLoading}
          variant="pill"
        />
        <Button
          className="flex-1"
          isLoading={deleteLoading}
          label={t("trash.deleteForever")}
          loadingLabel={t("trash.deleting")}
          onPress={() => onDelete(document)}
          disabled={actionLoading}
          variant="danger"
        />
      </View>
    </View>
  );
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
