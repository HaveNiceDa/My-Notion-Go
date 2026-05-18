import { cn } from "@/lib/cn";
import { ScrollView, View } from "@/tw";
import type { ComponentProps } from "react";

type ScreenScrollViewProps = ComponentProps<typeof ScrollView>;
type LoadingCardProps = ComponentProps<typeof View>;

export function ScreenScrollView({ className, contentContainerClassName, ...props }: ScreenScrollViewProps) {
  return (
    <ScrollView
      className={cn("flex-1 bg-notion-bg", className)}
      contentContainerClassName={cn("gap-5 p-5", contentContainerClassName)}
      contentInsetAdjustmentBehavior="automatic"
      {...props}
    />
  );
}

export function LoadingCard({ className, ...props }: LoadingCardProps) {
  return <View className={cn("min-h-60 items-center justify-center rounded-[28px] bg-notion-surface p-6", className)} {...props} />;
}
