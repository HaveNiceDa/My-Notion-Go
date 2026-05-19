import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ScrollView, View } from "@/tw";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AIConversationDetailScreen } from "./ai-conversation-detail-screen";
import { AIConversationListScreen } from "./ai-conversation-list-screen";

type AIChatSheetProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AIChatSheet({ onOpenChange, open }: AIChatSheetProps) {
  const { t } = useTranslation();
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
      description={selectedConversationId ? t("aiChat.modeDescriptions.chat") : t("aiChat.subtitle")}
      onOpenChange={handleOpenChange}
      open={open}
      snapPercent={0.72}
      title={t("aiChat.title")}
    >
      <View className="flex-1 gap-3">
        {selectedConversationId ? (
          <>
            <Button
              className="self-start px-2 py-1.5"
              label={t("aiChat.conversations")}
              labelClassName="text-sm text-notion-faint"
              onPress={() => setSelectedConversationId(null)}
              variant="ghost"
            />
            <ScrollView className="flex-1" contentContainerClassName="pb-2">
              <AIConversationDetailScreen conversationId={selectedConversationId} />
            </ScrollView>
          </>
        ) : (
          <ScrollView className="flex-1" contentContainerClassName="pb-2">
            <AIConversationListScreen onSelectConversation={setSelectedConversationId} />
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  );
}
