import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet } from "tamagui";

type BottomSheetProps = {
  children: ReactNode;
  closeLabel: string;
  contentClassName?: string;
  description?: string;
  footer?: ReactNode;
  hideHeader?: boolean;
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
  footer,
  hideHeader = false,
  onOpenChange,
  open,
  snapPercent,
  title,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Sheet
      dismissOnSnapToBottom
      modal
      onOpenChange={onOpenChange}
      open={open}
      snapPoints={[Math.round((snapPercent ?? 0.42) * 100)]}
      zIndex={100_000}
    >
      <Sheet.Overlay backgroundColor="rgba(0,0,0,0.2)" />
      <Sheet.Handle />
      <Sheet.Frame borderTopLeftRadius={28} borderTopRightRadius={28} style={styles.frame}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboard}>
          <View className="flex-1 px-4 pt-3" style={{ paddingBottom: footer ? 0 : Math.max(insets.bottom, 14) }}>
            {hideHeader ? null : (
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
            )}
            <View className={cn("gap-3", contentClassName)} style={styles.body}>
              {children}
            </View>
            {footer ? (
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Sheet.Frame>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e5e2",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  frame: {
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  keyboard: {
    flex: 1,
  },
});
