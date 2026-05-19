import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Pressable, ScrollView, Text, TextInput, View } from "@/tw";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { AIConversationDetailScreen } from "./ai-conversation-detail-screen";
import { AIConversationListScreen } from "./ai-conversation-list-screen";

type AIChatSheetProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AIChatSheet({ onOpenChange, open }: AIChatSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedConversationId(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <BottomSheet
      closeLabel={t("common.cancel")}
      contentClassName="flex-1"
      footer={
        selectedConversationId ? (
          <View className="flex-row items-end gap-2 rounded-2xl bg-notion-hover px-3 py-2">
            <TextInput
              accessibilityLabel={t("aiChat.inputLabel")}
              multiline
              onChangeText={setDraft}
              placeholder={t("aiChat.placeholder")}
              placeholderTextColor="#787774"
              style={styles.input}
              value={draft}
            />
            <Pressable
              accessibilityLabel={t("aiChat.send")}
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center rounded-full bg-notion-text"
            >
              <Text className="text-lg font-semibold leading-6 text-white">↑</Text>
            </Pressable>
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
              {selectedConversationId ? t("aiChat.modeDescriptions.chat") : t("aiChat.subtitle")}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            {selectedConversationId ? (
              <Button
                className="px-2 py-1.5"
                label={t("aiChat.conversations")}
                labelClassName="text-sm text-notion-faint"
                onPress={() => setSelectedConversationId(null)}
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
          style={styles.scrollView}
        >
          {selectedConversationId ? (
            <AIConversationDetailScreen conversationId={selectedConversationId} />
          ) : (
            <AIConversationListScreen onSelectConversation={setSelectedConversationId} />
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
    minHeight: 40,
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
