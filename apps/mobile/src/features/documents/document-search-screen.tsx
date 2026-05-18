import { Card, CardDescription, CardEyebrow, CardTitle, InfoCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { Pressable, Text, View } from "@/tw";
import type { DocumentSearchResult } from "@my-notion-go/api-client";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMobileDocumentSearch } from "./use-mobile-document-search";

export function DocumentSearchScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const searchQuery = useMobileDocumentSearch(query);
  const normalizedQuery = query.trim();

  return (
    <View className="gap-5">
      <Card>
        <CardEyebrow selectable>{t("mobileDocuments.phaseLabel")}</CardEyebrow>
        <CardTitle selectable>{t("search.title")}</CardTitle>
        <CardDescription selectable>{t("search.description")}</CardDescription>
        <Input
          accessibilityLabel={t("search.inputLabel")}
          autoCapitalize="none"
          className="mt-2"
          onChangeText={setQuery}
          placeholder={t("search.placeholder")}
          returnKeyType="search"
          value={query}
        />
      </Card>

      {normalizedQuery.length === 0 ? (
        <HintCard label={t("search.start")} />
      ) : searchQuery.isLoading ? (
        <HintCard label={t("search.loading")} />
      ) : searchQuery.isError ? (
        <HintCard label={t("search.failed")} />
      ) : searchQuery.data && searchQuery.data.length > 0 ? (
        <SearchResults results={searchQuery.data} />
      ) : (
        <HintCard label={t("search.empty")} />
      )}
    </View>
  );
}

function SearchResults({ results }: { results: DocumentSearchResult[] }) {
  return (
    <View className="overflow-hidden rounded-[24px] bg-notion-surface">
      {results.map((result, index) => (
        <SearchResultRow key={result.document.id} isLast={index === results.length - 1} result={result} />
      ))}
    </View>
  );
}

function SearchResultRow({ isLast, result }: { isLast: boolean; result: DocumentSearchResult }) {
  const { t } = useTranslation();
  const router = useRouter();
  const title = result.document.title || t("documents.untitled");
  const icon = result.document.icon || "📄";

  return (
    <Pressable
      accessibilityLabel={t("mobileDocuments.openDocument", { title })}
      accessibilityRole="button"
      className={cn("flex-row items-start gap-3 px-4 py-3.5", !isLast && "border-b border-notion-muted")}
      onPress={() => router.push({ pathname: "/documents/[documentId]", params: { documentId: result.document.id } })}
    >
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-notion-muted">
        <Text className="text-lg">{icon}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text selectable className="shrink text-base font-semibold text-notion-text" numberOfLines={1}>
            {title}
          </Text>
          <Text className="rounded-full bg-notion-muted px-2 py-0.5 text-[11px] font-semibold text-notion-faint">
            {result.matchType === "title" ? t("search.matchTitle") : t("search.matchContent")}
          </Text>
        </View>
        <Text selectable className="text-xs leading-5 text-notion-faint" numberOfLines={2}>
          {result.preview}
        </Text>
      </View>
    </Pressable>
  );
}

function HintCard({ label }: { label: string }) {
  return (
    <InfoCard className="items-center py-8">
      <Text selectable className="text-center text-sm leading-5 text-notion-faint">
        {label}
      </Text>
    </InfoCard>
  );
}
