import { Button } from "@/components/ui/button";
import { InfoCard } from "@/components/ui/card";
import { DocumentRow } from "@/components/ui/document-row";
import { LoadingCard } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Text, View } from "@/tw";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMobileAIActions } from "./use-mobile-ai-actions";
import { useMobileAIConversations } from "./use-mobile-ai-conversations";

type AIConversationListScreenProps = {
  onSelectConversation: (conversationId: string) => void;
};

export function AIConversationListScreen({ onSelectConversation }: AIConversationListScreenProps) {
  const { i18n, t } = useTranslation();
  const conversationsQuery = useMobileAIConversations();
  const { createConversation } = useMobileAIActions();
  const locale = i18n.language === "en" ? "en-US" : "zh-CN";
  const conversations = useMemo(
    () => [...(conversationsQuery.data ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [conversationsQuery.data],
  );

  async function handleCreateConversation() {
    const conversation = await createConversation.mutateAsync(undefined);
    onSelectConversation(conversation.id);
  }

  if (conversationsQuery.isLoading) {
    return (
      <LoadingCard>
        <Text selectable className="text-base leading-6 text-notion-subtle">
          {t("aiChat.loadingConversations")}
        </Text>
      </LoadingCard>
    );
  }

  if (conversationsQuery.isError) {
    return (
      <InfoCard>
        <Text selectable className="text-base font-semibold text-notion-text">
          {t("aiChat.errorTitle")}
        </Text>
        <Text selectable className="text-sm leading-5 text-notion-faint">
          {t("aiChat.errorFallback")}
        </Text>
        <Button label={t("mobileDocuments.retry")} onPress={() => conversationsQuery.refetch()} variant="secondary" />
      </InfoCard>
    );
  }

  return (
    <View className="gap-4">
      <Button
        isLoading={createConversation.isPending}
        label={t("aiChat.newConversation")}
        loadingLabel={t("auth.processing")}
        onPress={handleCreateConversation}
        variant="primary"
      />

      <Section title={t("aiChat.conversations")}>
        {conversations.length > 0 ? (
          <View className="gap-0.5">
            {conversations.map((conversation) => {
              const title = conversation.title || t("aiChat.untitledConversation");
              return (
                <DocumentRow
                  accessibilityLabel={title}
                  icon="💬"
                  key={conversation.id}
                  onPress={() => onSelectConversation(conversation.id)}
                  subtitle={formatDate(conversation.updatedAt, locale)}
                  title={title}
                />
              );
            })}
          </View>
        ) : (
          <InfoCard>
            <Text selectable className="text-sm leading-5 text-notion-faint">
              {t("aiChat.empty")}
            </Text>
          </InfoCard>
        )}
      </Section>
    </View>
  );
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(date);
}
