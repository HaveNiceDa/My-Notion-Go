import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
import { Image, Text, View } from "@/tw";
import { useTranslation } from "react-i18next";
import { ReadonlyDocumentContent } from "./read-only-content";
import { useMobilePublicDocument } from "./use-mobile-public-document";

export function PublicDocumentScreen({ publicId }: { publicId: string }) {
  const { i18n, t } = useTranslation();
  const publicDocumentQuery = useMobilePublicDocument(publicId);
  const locale = i18n.language === "en" ? "en-US" : "zh-CN";

  if (!publicId) {
    return (
      <InfoCard className="items-center py-8">
        <Text selectable className="text-base font-bold text-notion-text">
          {t("mobileDocuments.publicPlaceholderTitle")}
        </Text>
        <Text selectable className="mt-1 text-center text-sm leading-5 text-notion-faint">
          {t("mobileDocuments.publicPlaceholderDescription")}
        </Text>
      </InfoCard>
    );
  }

  if (publicDocumentQuery.isLoading) {
    return (
      <LoadingCard>
        <Text selectable className="text-base leading-6 text-notion-subtle">
          {t("mobileDocuments.publicLoading")}
        </Text>
      </LoadingCard>
    );
  }

  if (publicDocumentQuery.isError) {
    return (
      <Card>
        <CardEyebrow selectable>{t("mobileDocuments.publicLinkLabel")}</CardEyebrow>
        <CardTitle selectable>{t("publicDocument.notFoundTitle")}</CardTitle>
        <CardDescription selectable>{t("publicDocument.notFoundDescription")}</CardDescription>
        <Button label={t("mobileDocuments.retry")} onPress={() => publicDocumentQuery.refetch()} />
      </Card>
    );
  }

  const document = publicDocumentQuery.data;
  if (!document) {
    return null;
  }

  const blocks = Array.isArray(document.content) ? document.content : [];

  return (
    <View className="gap-5">
      <Card>
        {document.coverImage ? (
          <Image className="-mx-6 -mt-6 mb-2 h-36 rounded-t-[28px]" resizeMode="cover" source={{ uri: document.coverImage }} />
        ) : (
          <View className="-mx-6 -mt-6 mb-2 h-24 rounded-t-[28px] bg-notion-muted" />
        )}
        <CardEyebrow selectable>{t("mobileDocuments.publicLinkLabel")}</CardEyebrow>
        <Text className="text-4xl">{document.icon || "📄"}</Text>
        <CardTitle selectable>{document.title || t("documents.untitled")}</CardTitle>
        <CardDescription selectable>{t("publicDocument.lastUpdated", { time: formatDate(document.updatedAt, locale) })}</CardDescription>
      </Card>

      <View className="gap-3">
        <Text selectable className="text-sm font-bold text-notion-text">
          {t("mobileDocuments.readOnlyContent")}
        </Text>
        <ReadonlyDocumentContent blocks={blocks} />
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
