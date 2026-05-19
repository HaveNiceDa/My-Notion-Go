import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import type { ComponentProps } from "react";

type IconTileProps = ComponentProps<typeof View> & {
  icon?: string;
  size?: "sm" | "md" | "lg";
};

export function IconTile({ className, icon, size = "md", ...props }: IconTileProps) {
  const sizeClassName = {
    lg: "h-10 w-10 rounded-xl",
    md: "h-8 w-8 rounded-lg",
    sm: "h-7 w-7 rounded-md",
  }[size];
  const textClassName = {
    lg: "text-xl",
    md: "text-base",
    sm: "text-sm",
  }[size];

  return (
    <View className={cn("items-center justify-center bg-notion-hover", sizeClassName, className)} {...props}>
      <Text className={cn("text-notion-subtle", textClassName)}>{icon || "📄"}</Text>
    </View>
  );
}
