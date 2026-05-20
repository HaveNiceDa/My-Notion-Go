import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Pressable, ScrollView, Text, TextInput, View } from "@/tw";
import { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, type ScrollView as NativeScrollView, type TextInput as NativeTextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { AIConversationDetailScreen } from "./ai-conversation-detail-screen";
import { AIConversationListScreen } from "./ai-conversation-list-screen";
import type { MobileAIChatMode } from "./types";
import { useMobileAIChat } from "./use-mobile-ai-chat";

type AIChatSheetProps = {
  initialMode?: MobileAIChatMode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AIChatSheet({ initialMode = "chat", onOpenChange, open }: AIChatSheetProps) {
  const { t } = useTranslation();
  const scrollViewRef = useRef<NativeScrollView | null>(null);
  const inputRef = useRef<NativeTextInput | null>(null);
  const [draft, setDraft] = useState("");
  const {
    cancelStreaming,
    messages,
    messagesError,
    messagesLoading,
    mode,
    selectConversation,
    selectedConversationId,
    sendMessage,
    sending,
    setMode,
    streamError,
  } = useMobileAIChat({ initialMode });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      selectConversation(null);
      setDraft("");
    }
    onOpenChange(nextOpen);
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) {
      return;
    }
    setDraft("");
    inputRef.current?.focus();
    await sendMessage(content);
  }

  function toggleMode() {
    setMode(mode === "rag" ? "chat" : "rag");
  }

  const sendDisabled = !draft.trim() || sending;
  const lastMessageContent = messages.at(-1)?.content;

  function scrollToChatEnd(animated = true) {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated });
      });
    });
  }

  useEffect(() => {
    if (open && selectedConversationId) {
      scrollToChatEnd(false);
    }
  }, [lastMessageContent, messages.length, open, selectedConversationId, sending]);

  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", () => {
        if (selectedConversationId) {
          scrollToChatEnd();
        }
      }),
      Keyboard.addListener("keyboardDidHide", () => {
        if (selectedConversationId) {
          scrollToChatEnd(false);
        }
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [selectedConversationId]);

  return (
    <BottomSheet
      closeLabel={t("common.cancel")}
      contentClassName="flex-1"
      footer={
        selectedConversationId ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Pressable
                accessibilityLabel={t(mode === "rag" ? "aiChat.knowledgeModeDisable" : "aiChat.knowledgeModeEnable")}
                accessibilityRole="button"
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  mode === "rag"
                    ? "border-notion-text/20 bg-notion-hover"
                    : "border-notion-border bg-notion-surface",
                )}
                disabled={sending}
                onPress={toggleMode}
              >
                <Text className={cn("text-xs font-semibold", mode === "rag" ? "text-notion-subtle" : "text-notion-faint")}>
                  {t("aiChat.knowledgeMode")}
                </Text>
              </Pressable>
              <Text className="text-[11px] leading-4 text-notion-faint">
                {t(`aiChat.modeDescriptions.${mode}`)}
              </Text>
            </View>
            <View className="flex-row items-end gap-2 rounded-2xl bg-notion-hover px-3 py-2">
              <TextInput
                accessibilityLabel={t("aiChat.inputLabel")}
                multiline
                onFocus={() => scrollToChatEnd()}
                onChangeText={setDraft}
                placeholder={t("aiChat.placeholder")}
                placeholderTextColor="#787774"
                ref={inputRef}
                returnKeyType="default"
                style={styles.input}
                value={draft}
              />
              {sending ? (
                <Pressable
                  accessibilityLabel={t("aiChat.stop")}
                  accessibilityRole="button"
                  className="h-9 w-9 items-center justify-center rounded-full bg-notion-faint"
                  onPress={cancelStreaming}
                >
                  <Text className="text-sm font-semibold leading-5 text-white">■</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel={t("aiChat.send")}
                accessibilityRole="button"
                className={cn(
                  "h-9 w-9 items-center justify-center rounded-full",
                  sendDisabled ? "bg-notion-muted" : "bg-notion-text",
                )}
                disabled={sendDisabled}
                onPress={handleSend}
              >
                <Text className={cn("text-lg font-semibold leading-6", sendDisabled ? "text-notion-faint" : "text-white")}>
                  ↑
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null
      }
      hideHeader
      onOpenChange={handleOpenChange}
      open={open}
      snapPercent={0.7}
      title={t("aiChat.title")}
    >
      <View className="flex-1">
        <View className="flex-row items-center justify-between border-b border-notion-border pb-3">
          <View className="min-w-0 flex-1">
            <Text selectable className="text-lg font-semibold leading-6 text-notion-text">
              {selectedConversationId ? t("aiChat.newConversationTitle") : t("aiChat.title")}
            </Text>
            <Text selectable className="mt-0.5 text-xs leading-4 text-notion-faint" numberOfLines={1}>
              {selectedConversationId ? t(`aiChat.modeDescriptions.${mode}`) : t("aiChat.subtitle")}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            {selectedConversationId ? (
              <Button
                className="px-2 py-1.5"
                label={t("aiChat.conversations")}
                labelClassName="text-sm text-notion-faint"
                onPress={() => selectConversation(null)}
                variant="ghost"
              />
            ) : null}
            <Button
              className="px-2 py-1.5"
              label={t("common.cancel")}
              labelClassName="text-sm text-notion-faint"
              onPress={() => handleOpenChange(false)}
              variant="ghost"
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={selectedConversationId ? styles.chatScrollContent : styles.scrollContent}
          onContentSizeChange={() => {
            if (selectedConversationId) {
              scrollToChatEnd();
            }
          }}
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          {selectedConversationId ? (
            <AIConversationDetailScreen
              isError={messagesError}
              isLoading={messagesLoading}
              messages={messages}
              streamError={streamError}
            />
          ) : (
            <AIConversationListScreen onSelectConversation={selectConversation} />
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chatScrollContent: {
    paddingBottom: 96,
    paddingTop: 12,
  },
  input: {
    color: "#0a0a0a",
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 108,
    minHeight: 40,
    outlineWidth: 0,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingBottom: 12,
    paddingTop: 12,
  },
  scrollView: {
    flex: 1,
  },
});
