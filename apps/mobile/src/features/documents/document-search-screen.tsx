import { InfoCard } from "@/components/ui/card";
import { DocumentRow } from "@/components/ui/document-row";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Text, View } from "@/tw";
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
    <View className="gap-4">
      <View className="gap-3 px-1">
        <View className="gap-1">
          <Text selectable className="text-2xl font-bold leading-8 text-notion-text">
            {t("search.title")}
          </Text>
          <Text selectable className="text-sm leading-5 text-notion-faint">
            {t("search.description")}
          </Text>
        </View>
        <Input
          accessibilityLabel={t("search.inputLabel")}
          autoCapitalize="none"
          onChangeText={setQuery}
          placeholder={t("search.placeholder")}
          returnKeyType="search"
          value={query}
        />
      </View>

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
  const { t } = useTranslation();

  return (
    <Section title={t("search.title")}>
      <View className="gap-0.5">
        {results.map((result, index) => (
          <SearchResultRow key={result.document.id} isLast={index === results.length - 1} result={result} />
        ))}
      </View>
    </Section>
  );
}

function SearchResultRow({ isLast, result }: { isLast: boolean; result: DocumentSearchResult }) {
  const { t } = useTranslation();
  const router = useRouter();
  const title = result.document.title || t("documents.untitled");

  return (
    <DocumentRow
      accessibilityLabel={t("mobileDocuments.openDocument", { title })}
      icon={result.document.icon || "📄"}
      isLast={isLast}
      onPress={() => router.push({ pathname: "/documents/[documentId]", params: { documentId: result.document.id } })}
      rightAccessory={
        <Text className="rounded-full bg-notion-hover px-2 py-0.5 text-[11px] font-semibold text-notion-faint">
          {result.matchType === "title" ? t("search.matchTitle") : t("search.matchContent")}
        </Text>
      }
      subtitle={result.preview}
      title={title}
    />
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
