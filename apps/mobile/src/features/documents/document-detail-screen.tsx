import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import { LoadingCard } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { AIChatSheet } from "@/features/ai/ai-chat-sheet";
import { Image, Text, View } from "@/tw";
import type { Document } from "@my-notion-go/api-client";
import { useEffect, useState } from "react";
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
  const [aiSheetOpen, setAiSheetOpen] = useState(false);

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
      <DocumentMetadataEditor document={document} onAskDocument={() => setAiSheetOpen(true)} />
      <Section title={t("mobileDocuments.readOnlyContent")}>
        <ReadonlyDocumentContent blocks={blocks} />
      </Section>
      <AIChatSheet initialMode="rag" onOpenChange={setAiSheetOpen} open={aiSheetOpen} />
    </View>
  );
}

function DocumentMetadataEditor({ document, onAskDocument }: { document: Document; onAskDocument: () => void }) {
  const { t } = useTranslation();
  const { togglePublishMutation, toggleStarMutation, updateMetadataMutation } = useMobileDocumentActions(document.id);
  const [open, setOpen] = useState(false);
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
      setOpen(false);
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

  function closeEditor() {
    setTitle(document.title);
    setIcon(document.icon);
    setOpen(false);
  }

  return (
    <View className="gap-2 px-1">
      <View className="flex-row flex-wrap gap-2">
        <Button label={t("mobileEditor.title")} onPress={() => setOpen(true)} variant="pill" />
        <Button
          label={t("aiChat.askDocument")}
          onPress={onAskDocument}
          variant="pill"
        />
        <Button
          disabled={actionLoading}
          isLoading={toggleStarMutation.isPending}
          label={document.isStarred ? t("documents.unstarPage") : t("documents.starPage")}
          onPress={() => {
            void toggleStar();
          }}
          variant="pill"
        />
        <Button
          disabled={actionLoading}
          isLoading={togglePublishMutation.isPending}
          label={document.isPublished ? t("publish.unpublish") : t("publish.publish")}
          onPress={() => {
            void togglePublish();
          }}
          variant="pill"
        />
      </View>

      {feedback ? (
        <InfoCard className={feedback.tone === "error" ? "bg-notion-danger-muted" : "py-2"}>
          <Text selectable className={feedback.tone === "error" ? "text-sm font-semibold text-notion-danger" : "text-sm font-semibold text-notion-subtle"}>
            {feedback.message}
          </Text>
        </InfoCard>
      ) : null}

      <BottomSheet
        closeLabel={t("common.cancel")}
        description={t("mobileEditor.description")}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeEditor();
            return;
          }
          setOpen(true);
        }}
        open={open}
        title={t("mobileEditor.title")}
      >
        <View className="gap-2">
          <Text selectable className="text-sm font-semibold text-notion-subtle">
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
          <Text selectable className="text-sm font-semibold text-notion-subtle">
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
            className="flex-1"
            disabled={actionLoading}
            isLoading={toggleStarMutation.isPending}
            label={document.isStarred ? t("documents.unstarPage") : t("documents.starPage")}
            onPress={() => {
              void toggleStar();
            }}
            variant="pill"
          />
          <Button
            className="flex-1"
            disabled={actionLoading}
            isLoading={togglePublishMutation.isPending}
            label={document.isPublished ? t("publish.unpublish") : t("publish.publish")}
            onPress={() => {
              void togglePublish();
            }}
            variant="pill"
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function DocumentHeader({ document, locale }: { document: Document; locale: string }) {
  const { t } = useTranslation();
  const title = document.title || t("documents.untitled");
  const icon = document.icon || "📄";

  return (
    <View className="gap-4">
      {document.coverImage ? (
        <Image className="h-36 rounded-2xl" resizeMode="cover" source={{ uri: document.coverImage }} />
      ) : (
        <View className="h-24 rounded-2xl bg-notion-hover" />
      )}
      <View className="gap-3 px-1">
        <IconTile icon={icon} size="lg" />
        <View className="gap-1.5">
          <Text selectable className="text-[28px] font-bold leading-9 text-notion-text">
            {title}
          </Text>
          <Text selectable className="text-[13px] leading-5 text-notion-faint">
            {t("documents.lastEdited", { time: formatDate(document.updatedAt, locale) })}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {document.isStarred ? <StatusPill label={t("documents.favorite")} /> : null}
          {document.isPublished ? <StatusPill label={t("publish.published")} /> : null}
          {document.isInKnowledgeBase ? <StatusPill label={t("documents.knowledgeBase")} /> : null}
        </View>
      </View>
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-notion-border bg-notion-surface px-3 py-1.5">
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
