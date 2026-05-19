import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Pressable, Text, View } from "@/tw";
import type { ReactNode } from "react";
import { Modal, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BottomSheetProps = {
  children: ReactNode;
  closeLabel: string;
  contentClassName?: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  snapPercent?: number;
  title: string;
};

export function BottomSheet({
  children,
  closeLabel,
  contentClassName,
  description,
  onOpenChange,
  open,
  snapPercent,
  title,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal animationType="fade" onRequestClose={() => onOpenChange(false)} transparent visible={open}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityLabel={closeLabel}
          accessibilityRole="button"
          className="absolute inset-0 bg-black/20"
          onPress={() => onOpenChange(false)}
        />
        <View
          className="overflow-hidden rounded-t-[28px] border border-notion-border bg-notion-surface px-4 pt-3"
          style={{
            paddingBottom: Math.max(insets.bottom, 14),
            ...(snapPercent ? { height: height * snapPercent } : {}),
            boxShadow: "0 -10px 40px rgba(15, 23, 42, 0.12)",
          }}
        >
          <View className="items-center pb-3">
            <View className="h-1 w-10 rounded-full bg-notion-border" />
          </View>
          <View className="flex-row items-start justify-between gap-3 pb-4">
            <View className="min-w-0 flex-1">
              <Text selectable className="text-lg font-semibold leading-6 text-notion-text">
                {title}
              </Text>
              {description ? (
                <Text selectable className="mt-1 text-sm leading-5 text-notion-faint">
                  {description}
                </Text>
              ) : null}
            </View>
            <Button
              className="px-2 py-1.5"
              label={closeLabel}
              labelClassName="text-sm text-notion-faint"
              onPress={() => onOpenChange(false)}
              variant="ghost"
            />
          </View>
          <View className={cn("gap-3", contentClassName)}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}
