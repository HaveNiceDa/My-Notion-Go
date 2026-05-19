import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/cn";
import { Pressable, Text, View } from "@/tw";
import type { ComponentProps, ReactNode } from "react";

type DocumentRowProps = ComponentProps<typeof Pressable> & {
  depth?: number;
  icon?: string;
  isLast?: boolean;
  rightAccessory?: ReactNode;
  subtitle?: string;
  title: string;
};

export function DocumentRow({
  className,
  depth = 0,
  icon,
  isLast = false,
  rightAccessory,
  subtitle,
  title,
  ...props
}: DocumentRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn("min-h-11 flex-row items-center gap-2.5 px-2.5 py-2", !isLast && "border-b border-notion-border", className)}
      style={{ paddingLeft: 10 + depth * 14 }}
      {...props}
    >
      <IconTile icon={icon} size="sm" />
      <View className="min-w-0 flex-1">
        <Text selectable className="text-[15px] font-medium leading-5 text-notion-subtle" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable className="mt-0.5 text-xs leading-4 text-notion-faint" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightAccessory}
    </Pressable>
  );
}
