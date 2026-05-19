import { cn } from "@/lib/cn";
import { Pressable, Text, View } from "@/tw";
import type { ComponentProps } from "react";

type BottomActionBarProps = ComponentProps<typeof View>;
type BottomActionProps = ComponentProps<typeof Pressable> & {
  label: string;
  primary?: boolean;
};

export function BottomActionBar({ className, ...props }: BottomActionBarProps) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-2 rounded-[28px] border border-notion-border bg-notion-surface px-2 py-2",
        className,
      )}
      style={{ boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}
      {...props}
    />
  );
}

export function BottomAction({ className, label, primary = false, ...props }: BottomActionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className={cn(
        "h-11 flex-1 items-center justify-center rounded-full px-3",
        primary ? "bg-notion-text" : "bg-notion-hover",
        className,
      )}
      {...props}
    >
      <Text className={cn("text-sm font-semibold", primary ? "text-white" : "text-notion-subtle")} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
