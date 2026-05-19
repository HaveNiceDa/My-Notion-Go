import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
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
      <Card>
        <CardEyebrow selectable>{t("mobileDocuments.phaseLabel")}</CardEyebrow>
        <CardTitle selectable>{t("mobileDocuments.trashErrorTitle")}</CardTitle>
        <CardDescription selectable>{t("mobileDocuments.trashErrorDescription")}</CardDescription>
        <Button label={t("mobileDocuments.retry")} onPress={() => trashQuery.refetch()} />
      </Card>
    );
  }

  const documents = trashQuery.data ?? [];

  return (
    <View className="gap-5">
      <Card>
        <CardEyebrow selectable>{t("mobileDocuments.phaseLabel")}</CardEyebrow>
        <CardTitle selectable>{t("trash.title")}</CardTitle>
        <CardDescription selectable>{t("trash.description")}</CardDescription>
      </Card>

      {feedback ? (
        <InfoCard className={cn("py-3", feedback.tone === "error" && "bg-red-50")}>
          <Text selectable className={cn("text-sm font-semibold text-notion-subtle", feedback.tone === "error" && "text-red-700")}>
            {feedback.message}
          </Text>
        </InfoCard>
      ) : null}

      {documents.length > 0 ? (
        <View className="overflow-hidden rounded-[24px] bg-notion-surface">
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
  const icon = document.icon || "📄";
  const actionLoading = restoreLoading || deleteLoading;

  return (
    <View className={cn("gap-3 px-4 py-3.5", !isLast && "border-b border-notion-muted")}>
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-2xl bg-notion-muted">
          <Text className="text-lg">{icon}</Text>
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text selectable className="text-base font-semibold text-notion-text" numberOfLines={1}>
            {title}
          </Text>
          <Text selectable className="text-xs text-notion-faint" numberOfLines={1}>
            {t("trash.updatedAt", { time: formatDate(document.updatedAt, locale) })}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button
          className="flex-1 bg-notion-text py-3"
          isLoading={restoreLoading}
          label={t("trash.restore")}
          loadingLabel={t("trash.restoring")}
          onPress={() => onRestore(document)}
          disabled={actionLoading}
        />
        <Button
          className="flex-1 bg-red-600 py-3"
          isLoading={deleteLoading}
          label={t("trash.deleteForever")}
          loadingLabel={t("trash.deleting")}
          onPress={() => onDelete(document)}
          disabled={actionLoading}
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
