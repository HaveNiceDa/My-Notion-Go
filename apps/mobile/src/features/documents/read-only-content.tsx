import { Card, InfoCard } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import { useTranslation } from "react-i18next";

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

export function ReadonlyDocumentContent({ blocks }: { blocks: unknown[] }) {
  const { t } = useTranslation();

  if (blocks.length === 0) {
    return (
      <InfoCard className="items-center py-8">
        <Text selectable className="text-base font-bold text-notion-text">
          {t("mobileDocuments.emptyContentTitle")}
        </Text>
        <Text selectable className="mt-1 text-center text-sm leading-5 text-notion-faint">
          {t("mobileDocuments.emptyContentDescription")}
        </Text>
      </InfoCard>
    );
  }

  return (
    <Card className="gap-4">
      {blocks.map((block, index) => (
        <ReadonlyBlock key={getBlockKey(block, index)} block={block} depth={0} />
      ))}
    </Card>
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
