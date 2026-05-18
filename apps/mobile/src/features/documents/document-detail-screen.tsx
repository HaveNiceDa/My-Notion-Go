import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
import { Image, Text, View } from "@/tw";
import type { Document } from "@my-notion-go/api-client";
import { useTranslation } from "react-i18next";
import { ReadonlyDocumentContent } from "./read-only-content";
import { useMobileDocumentContent, useMobileDocumentDetail } from "./use-mobile-document-detail";

export function DocumentDetailScreen({ documentId }: { documentId: string }) {
  const { i18n, t } = useTranslation();
  const documentQuery = useMobileDocumentDetail(documentId);
  const contentQuery = useMobileDocumentContent(documentId);
  const locale = i18n.language === "en" ? "en-US" : "zh-CN";

  if (documentQuery.isLoading || contentQuery.isLoading) {
    return (
      <LoadingCard>
        <Text selectable className="text-base leading-6 text-notion-subtle">
          {t("mobileDocuments.detailLoading")}
        </Text>
      </LoadingCard>
    );
  }

  if (documentQuery.isError || contentQuery.isError) {
    return (
      <Card>
        <CardEyebrow selectable>{t("mobileDocuments.phaseLabel")}</CardEyebrow>
        <CardTitle selectable>{t("mobileDocuments.detailErrorTitle")}</CardTitle>
        <CardDescription selectable>{t("mobileDocuments.detailErrorDescription")}</CardDescription>
        <Button
          label={t("mobileDocuments.retry")}
          onPress={() => {
            void documentQuery.refetch();
            void contentQuery.refetch();
          }}
        />
      </Card>
    );
  }

  if (!documentQuery.data) {
    return (
      <InfoCard className="items-center py-8">
        <Text selectable className="text-base font-bold text-notion-text">
          {t("mobileDocuments.detailMissingTitle")}
        </Text>
        <Text selectable className="mt-1 text-center text-sm leading-5 text-notion-faint">
          {t("mobileDocuments.detailMissingDescription")}
        </Text>
      </InfoCard>
    );
  }

  const document = documentQuery.data;
  const blocks = Array.isArray(contentQuery.data?.content) ? contentQuery.data.content : [];

  return (
    <View className="gap-5">
      <DocumentHeader document={document} locale={locale} />
      <View className="gap-3">
        <Text selectable className="text-sm font-bold text-notion-text">
          {t("mobileDocuments.readOnlyContent")}
        </Text>
        <ReadonlyDocumentContent blocks={blocks} />
      </View>
    </View>
  );
}

function DocumentHeader({ document, locale }: { document: Document; locale: string }) {
  const { t } = useTranslation();
  const title = document.title || t("documents.untitled");
  const icon = document.icon || "📄";

  return (
    <Card>
      {document.coverImage ? (
        <Image className="-mx-6 -mt-6 mb-2 h-36 rounded-t-[28px]" resizeMode="cover" source={{ uri: document.coverImage }} />
      ) : (
        <View className="-mx-6 -mt-6 mb-2 h-24 rounded-t-[28px] bg-notion-muted" />
      )}
      <Text className="text-4xl">{icon}</Text>
      <CardTitle selectable>{title}</CardTitle>
      <CardDescription selectable>{t("documents.lastEdited", { time: formatDate(document.updatedAt, locale) })}</CardDescription>
      <View className="mt-1 flex-row flex-wrap gap-2">
        {document.isStarred ? <StatusPill label={t("documents.favorite")} /> : null}
        {document.isPublished ? <StatusPill label={t("publish.published")} /> : null}
        {document.isInKnowledgeBase ? <StatusPill label={t("documents.knowledgeBase")} /> : null}
      </View>
    </Card>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-notion-muted px-3 py-1.5">
      <Text selectable className="text-xs font-semibold text-notion-faint">
        {label}
      </Text>
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
