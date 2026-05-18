import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
import { cn } from "@/lib/cn";
import { Image, Text, View } from "@/tw";
import type { Document } from "@my-notion-go/api-client";
import { useTranslation } from "react-i18next";
import { useMobileDocumentContent, useMobileDocumentDetail } from "./use-mobile-document-detail";

type RichTextLeaf = {
  text?: unknown;
};

type BlockNoteBlock = {
  children?: unknown;
  content?: unknown;
  props?: {
    level?: unknown;
  };
  type?: unknown;
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
      <View className="gap-3">
        <Text selectable className="text-sm font-bold text-notion-text">
          {t("mobileDocuments.readOnlyContent")}
        </Text>
        {blocks.length > 0 ? (
          <Card className="gap-4">
            {blocks.map((block, index) => (
              <ReadonlyBlock key={getBlockKey(block, index)} block={block} depth={0} />
            ))}
          </Card>
        ) : (
          <InfoCard className="items-center py-8">
            <Text selectable className="text-base font-bold text-notion-text">
              {t("mobileDocuments.emptyContentTitle")}
            </Text>
            <Text selectable className="mt-1 text-center text-sm leading-5 text-notion-faint">
              {t("mobileDocuments.emptyContentDescription")}
            </Text>
          </InfoCard>
        )}
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

function ReadonlyBlock({ block, depth }: { block: unknown; depth: number }) {
  const { t } = useTranslation();
  const parsed = toBlockNoteBlock(block);
  if (!parsed) {
    return null;
  }

  const text = extractBlockText(parsed.content) || t("mobileDocuments.unsupportedBlock");
  const type = typeof parsed.type === "string" ? parsed.type : "paragraph";
  const level = typeof parsed.props?.level === "number" ? parsed.props.level : 1;
  const children = Array.isArray(parsed.children) ? parsed.children : [];

  return (
    <View className="gap-3" style={depth > 0 ? { paddingLeft: Math.min(depth, 3) * 14 } : undefined}>
      <Text
        selectable
        className={cn(
          "leading-6 text-notion-subtle",
          type === "heading" && level <= 1 && "text-2xl font-bold leading-8 text-notion-text",
          type === "heading" && level === 2 && "text-xl font-bold leading-7 text-notion-text",
          type === "heading" && level >= 3 && "text-lg font-bold leading-6 text-notion-text",
          type === "bulletListItem" && "pl-2",
          type === "numberedListItem" && "pl-2",
          type === "quote" && "border-l-4 border-notion-border pl-3 italic",
          type === "codeBlock" && "rounded-2xl bg-notion-muted p-3 font-mono text-sm",
        )}
      >
        {formatBlockPrefix(type)}
        {text}
      </Text>
      {children.map((child, index) => (
        <ReadonlyBlock key={getBlockKey(child, index)} block={child} depth={depth + 1} />
      ))}
    </View>
  );
}

function toBlockNoteBlock(value: unknown): BlockNoteBlock | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as BlockNoteBlock;
}

function extractBlockText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content.map(extractInlineText).join("").trim();
}

function extractInlineText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const leaf = value as RichTextLeaf;
  return typeof leaf.text === "string" ? leaf.text : "";
}

function formatBlockPrefix(type: string) {
  if (type === "bulletListItem") {
    return "• ";
  }
  if (type === "numberedListItem") {
    return "1. ";
  }
  if (type === "checkListItem") {
    return "☐ ";
  }
  return "";
}

function getBlockKey(block: unknown, index: number) {
  if (block && typeof block === "object" && "id" in block) {
    const id = (block as { id?: unknown }).id;
    if (typeof id === "string") {
      return id;
    }
  }
  return String(index);
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
