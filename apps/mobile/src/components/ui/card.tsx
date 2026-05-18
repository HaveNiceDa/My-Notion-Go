import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import type { ComponentProps } from "react";

type CardProps = ComponentProps<typeof View>;
type TextProps = ComponentProps<typeof Text>;

export function Card({ className, ...props }: CardProps) {
  return <View className={cn("gap-3 rounded-[28px] bg-notion-surface p-6 shadow-sm", className)} {...props} />;
}

export function InfoCard({ className, ...props }: CardProps) {
  return <View className={cn("gap-2 rounded-2xl bg-notion-muted p-4", className)} {...props} />;
}

export function CardEyebrow({ className, ...props }: TextProps) {
  return <Text className={cn("text-[13px] font-semibold tracking-wide text-notion-faint", className)} {...props} />;
}

export function CardTitle({ className, ...props }: TextProps) {
  return <Text className={cn("text-3xl font-bold leading-9 text-notion-text", className)} {...props} />;
}

export function CardDescription({ className, ...props }: TextProps) {
  return <Text className={cn("text-base leading-6 text-notion-subtle", className)} {...props} />;
}
