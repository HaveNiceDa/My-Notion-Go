import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingCard } from "@/components/ui/screen";
import { mobileWebBaseUrl } from "@/lib/api-config";
import { Image, Text, View } from "@/tw";
import type { Document } from "@my-notion-go/api-client";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReadonlyDocumentContent } from "./read-only-content";
import { useMobileDocumentActions } from "./use-mobile-document-actions";
import { useMobileDocumentContent, useMobileDocumentDetail } from "./use-mobile-document-detail";

type EditorFeedback = {
  tone: "success" | "error";
  message: string;
};

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
      <DocumentMetadataEditor document={document} />
      <View className="gap-3">
        <Text selectable className="text-sm font-bold text-notion-text">
          {t("mobileDocuments.readOnlyContent")}
        </Text>
        <ReadonlyDocumentContent blocks={blocks} />
      </View>
    </View>
  );
}

function DocumentMetadataEditor({ document }: { document: Document }) {
  const { t } = useTranslation();
  const { togglePublishMutation, toggleStarMutation, updateMetadataMutation } = useMobileDocumentActions(document.id);
  const [title, setTitle] = useState(document.title);
  const [icon, setIcon] = useState(document.icon);
  const [feedback, setFeedback] = useState<EditorFeedback | null>(null);
  const titleChanged = title.trim() !== document.title;
  const iconChanged = icon.trim() !== document.icon;
  const hasMetadataChanges = titleChanged || iconChanged;
  const actionLoading = updateMetadataMutation.isPending || toggleStarMutation.isPending || togglePublishMutation.isPending;

  useEffect(() => {
    setTitle(document.title);
    setIcon(document.icon);
  }, [document.icon, document.title]);

  async function saveMetadata() {
    if (!hasMetadataChanges) {
      return;
    }

    try {
      await updateMetadataMutation.mutateAsync({
        icon: icon.trim(),
        title: title.trim() || t("documents.untitled"),
      });
      setFeedback({ tone: "success", message: t("mobileEditor.metadataSaved") });
    } catch {
      setFeedback({ tone: "error", message: t("mobileEditor.metadataSaveFailed") });
    }
  }

  async function toggleStar() {
    try {
      await toggleStarMutation.mutateAsync(document);
      setFeedback({
        tone: "success",
        message: document.isStarred ? t("favorites.unstarSuccess") : t("favorites.starSuccess"),
      });
    } catch {
      setFeedback({ tone: "error", message: t("favorites.updateFailed") });
    }
  }

  async function togglePublish() {
    try {
      await togglePublishMutation.mutateAsync(document);
      setFeedback({
        tone: "success",
        message: document.isPublished ? t("publish.unpublishSuccess") : t("publish.publishSuccess"),
      });
    } catch {
      setFeedback({ tone: "error", message: t("publish.updateFailed") });
    }
  }

  return (
    <Card>
      <CardEyebrow selectable>{t("mobileEditor.phaseLabel")}</CardEyebrow>
      <CardTitle selectable>{t("mobileEditor.title")}</CardTitle>
      <CardDescription selectable>{t("mobileEditor.description")}</CardDescription>

      {feedback ? (
        <InfoCard className={feedback.tone === "error" ? "bg-red-50" : undefined}>
          <Text selectable className={feedback.tone === "error" ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-notion-subtle"}>
            {feedback.message}
          </Text>
        </InfoCard>
      ) : null}

      <View className="gap-2">
        <Text selectable className="text-sm font-semibold text-notion-text">
          {t("documents.titleInput")}
        </Text>
        <Input
          accessibilityLabel={t("documents.titleInput")}
          editable={!actionLoading}
          onChangeText={setTitle}
          placeholder={t("documents.renamePlaceholder")}
          value={title}
        />
      </View>

      <View className="gap-2">
        <Text selectable className="text-sm font-semibold text-notion-text">
          {t("mobileEditor.iconLabel")}
        </Text>
        <Input
          accessibilityLabel={t("mobileEditor.iconLabel")}
          editable={!actionLoading}
          maxLength={8}
          onChangeText={setIcon}
          placeholder={t("mobileEditor.iconPlaceholder")}
          value={icon}
        />
      </View>

      <Button
        disabled={!hasMetadataChanges || actionLoading}
        isLoading={updateMetadataMutation.isPending}
        label={t("mobileEditor.saveMetadata")}
        loadingLabel={t("editor.saving")}
        onPress={() => {
          void saveMetadata();
        }}
      />

      <View className="flex-row gap-2">
        <Button
          className="flex-1 bg-notion-muted"
          disabled={actionLoading}
          isLoading={toggleStarMutation.isPending}
          label={document.isStarred ? t("documents.unstarPage") : t("documents.starPage")}
          labelClassName="text-notion-text"
          onPress={() => {
            void toggleStar();
          }}
        />
        <Button
          className="flex-1 bg-notion-muted"
          disabled={actionLoading}
          isLoading={togglePublishMutation.isPending}
          label={document.isPublished ? t("publish.unpublish") : t("publish.publish")}
          labelClassName="text-notion-text"
          onPress={() => {
            void togglePublish();
          }}
        />
      </View>
    </Card>
  );
}

function DocumentHeader({ document, locale }: { document: Document; locale: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const title = document.title || t("documents.untitled");
  const icon = document.icon || "📄";
  const publicUrl = useMemo(() => `${mobileWebBaseUrl}/p/${document.publicId}`, [document.publicId]);

  async function copyPublicUrl() {
    await Clipboard.setStringAsync(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

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
      {document.isPublished ? (
        <View className="mt-4 gap-2">
          <Text selectable className="text-xs font-semibold uppercase tracking-[0.16em] text-notion-faint">
            {t("publish.publicLink")}
          </Text>
          <Text selectable className="text-xs leading-5 text-notion-subtle">
            {publicUrl}
          </Text>
          <View className="flex-row gap-2">
            <Button
              className="flex-1 py-3"
              label={copied ? t("publish.copied") : t("publish.copy")}
              onPress={() => {
                void copyPublicUrl();
              }}
            />
            <Button
              className="flex-1 bg-notion-muted py-3"
              label={t("mobileDocuments.openPublicPage")}
              labelClassName="text-notion-text"
              onPress={() => router.push({ pathname: "/public/[publicId]", params: { publicId: document.publicId } })}
            />
          </View>
        </View>
      ) : null}
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
