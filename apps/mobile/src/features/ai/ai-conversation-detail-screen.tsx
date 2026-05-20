import { InfoCard } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/screen";
import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import type { MobileAIMessage } from "./types";

type AIConversationDetailScreenProps = {
  isError: boolean;
  isLoading: boolean;
  messages: MobileAIMessage[];
  streamError: string | null;
};

export function AIConversationDetailScreen({
  isError,
  isLoading,
  messages,
  streamError,
}: AIConversationDetailScreenProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <LoadingCard>
        <Text selectable className="text-base leading-6 text-notion-subtle">
          {t("aiChat.loadingMessages")}
        </Text>
      </LoadingCard>
    );
  }

  if (isError) {
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

  return (
    <View className="gap-3">
      {streamError ? (
        <InfoCard>
          <Text selectable className="text-base font-semibold text-notion-text">
            {t("aiChat.errorTitle")}
          </Text>
          <Text selectable className="text-sm leading-5 text-notion-faint">
            {streamError || t("aiChat.errorFallback")}
          </Text>
        </InfoCard>
      ) : null}
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

function MessageBubble({ message }: { message: MobileAIMessage }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  return (
    <View className={cn("gap-1", isUser ? "items-end" : "items-start")}>
      <Text selectable className="px-1 text-xs font-semibold text-notion-faint">
        {t(`aiChat.roles.${message.role}`)}
      </Text>
      <View className={cn("max-w-[86%] rounded-2xl px-3 py-2", isUser ? "bg-notion-text" : "bg-notion-hover")}>
        {message.streaming && !message.content ? (
          <ThinkingDots label={t("aiChat.waitingResponse")} />
        ) : (
          <Text selectable className={cn("text-[15px] leading-6", isUser ? "text-white" : "text-notion-subtle")}>
            {message.content}
          </Text>
        )}
      </View>
    </View>
  );
}

function ThinkingDots({ label }: { label: string }) {
  const dots = useRef([new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]).current;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(dot, {
            duration: 360,
            easing: Easing.inOut(Easing.ease),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            duration: 360,
            easing: Easing.inOut(Easing.ease),
            toValue: 0.35,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, [dots]);

  return (
    <View accessibilityLabel={label} className="flex-row items-center gap-1 py-2">
      {dots.map((opacity, index) => (
        <Animated.View key={index} style={[styles.thinkingDot, { opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  thinkingDot: {
    backgroundColor: "#787774",
    borderRadius: 3,
    height: 6,
    width: 6,
  },
});
