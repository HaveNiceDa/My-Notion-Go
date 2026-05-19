import { InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import type { AIMessage } from "@my-notion-go/api-client";
import { useTranslation } from "react-i18next";
import { useMobileAIMessages } from "./use-mobile-ai-messages";

type AIConversationDetailScreenProps = {
  conversationId: string;
};

export function AIConversationDetailScreen({ conversationId }: AIConversationDetailScreenProps) {
  const { t } = useTranslation();
  const messagesQuery = useMobileAIMessages(conversationId);

  if (messagesQuery.isLoading) {
    return (
      <LoadingCard>
        <Text selectable className="text-base leading-6 text-notion-subtle">
          {t("aiChat.loadingMessages")}
        </Text>
      </LoadingCard>
    );
  }

  if (messagesQuery.isError) {
    return (
      <InfoCard>
        <Text selectable className="text-base font-semibold text-notion-text">
          {t("aiChat.errorTitle")}
        </Text>
        <Text selectable className="text-sm leading-5 text-notion-faint">
          {t("aiChat.errorFallback")}
        </Text>
      </InfoCard>
    );
  }

  const messages = messagesQuery.data ?? [];

  return (
    <View className="gap-5">
      <Section description={t("aiChat.modeDescriptions.chat")} title={t("aiChat.title")}>
        {messages.length > 0 ? (
          <View className="gap-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </View>
        ) : (
          <InfoCard>
            <Text selectable className="text-base font-semibold text-notion-text">
              {t("aiChat.emptyTitle")}
            </Text>
            <Text selectable className="text-sm leading-5 text-notion-faint">
              {t("aiChat.empty")}
            </Text>
          </InfoCard>
        )}
      </Section>

      <InfoCard>
        <Text selectable className="text-sm leading-5 text-notion-faint">
          {t("aiChat.placeholder")}
        </Text>
      </InfoCard>
    </View>
  );
}

function MessageBubble({ message }: { message: AIMessage }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <View className={cn("gap-1 rounded-2xl px-3 py-2", isUser ? "bg-notion-text" : "bg-notion-hover")}>
      <Text selectable className={cn("text-xs font-semibold", isUser ? "text-white/70" : "text-notion-faint")}>
        {t(`aiChat.roles.${message.role}`)}
      </Text>
      <Text selectable className={cn("text-[15px] leading-6", isUser ? "text-white" : "text-notion-subtle")}>
        {message.content}
      </Text>
    </View>
  );
}
