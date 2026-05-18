import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import type { Document } from "@my-notion-go/api-client";
import { useTranslation } from "react-i18next";
import { useMobileTrashDocuments } from "./use-mobile-trash-documents";

export function TrashScreen() {
  const { i18n, t } = useTranslation();
  const trashQuery = useMobileTrashDocuments();
  const locale = i18n.language === "en" ? "en-US" : "zh-CN";

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

      {documents.length > 0 ? (
        <View className="overflow-hidden rounded-[24px] bg-notion-surface">
          {documents.map((document, index) => (
            <TrashRow key={document.id} document={document} isLast={index === documents.length - 1} locale={locale} />
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

function TrashRow({ document, isLast, locale }: { document: Document; isLast: boolean; locale: string }) {
  const { t } = useTranslation();
  const title = document.title || t("documents.untitled");
  const icon = document.icon || "📄";

  return (
    <View className={cn("flex-row items-center gap-3 px-4 py-3.5", !isLast && "border-b border-notion-muted")}>
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
