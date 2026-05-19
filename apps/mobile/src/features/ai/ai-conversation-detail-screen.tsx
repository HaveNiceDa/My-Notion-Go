import { InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
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
    <View className="gap-3">
      {messages.length > 0 ? (
        messages.map((message) => <MessageBubble key={message.id} message={message} />)
      ) : (
        <View className="items-center gap-2 py-10">
          <Text selectable className="text-base font-semibold text-notion-text">
            {t("aiChat.emptyTitle")}
          </Text>
          <Text selectable className="max-w-64 text-center text-sm leading-5 text-notion-faint">
            {t("aiChat.empty")}
          </Text>
        </View>
      )}
    </View>
  );
}

function MessageBubble({ message }: { message: AIMessage }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <View className={cn("gap-1", isUser ? "items-end" : "items-start")}>
      <Text selectable className="px-1 text-xs font-semibold text-notion-faint">
        {t(`aiChat.roles.${message.role}`)}
      </Text>
      <View className={cn("max-w-[86%] rounded-2xl px-3 py-2", isUser ? "bg-notion-text" : "bg-notion-hover")}>
        <Text selectable className={cn("text-[15px] leading-6", isUser ? "text-white" : "text-notion-subtle")}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}
