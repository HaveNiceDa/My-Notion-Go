import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { LoadingCard } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
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
      <View className="gap-4">
        {document.coverImage ? (
          <Image className="h-36 rounded-2xl" resizeMode="cover" source={{ uri: document.coverImage }} />
        ) : (
          <View className="h-24 rounded-2xl bg-notion-hover" />
        )}
        <View className="gap-3 px-1">
          <CardEyebrow selectable>{t("mobileDocuments.publicLinkLabel")}</CardEyebrow>
          <IconTile icon={document.icon || "📄"} size="lg" />
          <View className="gap-1.5">
            <Text selectable className="text-[28px] font-bold leading-9 text-notion-text">
              {document.title || t("documents.untitled")}
            </Text>
            <Text selectable className="text-[13px] leading-5 text-notion-faint">
              {t("publicDocument.lastUpdated", { time: formatDate(document.updatedAt, locale) })}
            </Text>
          </View>
        </View>
      </View>

      <Section title={t("mobileDocuments.readOnlyContent")}>
        <ReadonlyDocumentContent blocks={blocks} />
      </Section>
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
