import { cn } from "@/lib/cn";
import { Text, View } from "@/tw";
import type { ComponentProps, ReactNode } from "react";

type SectionProps = ComponentProps<typeof View> & {
  action?: ReactNode;
  description?: string;
  title: string;
};

export function Section({ action, children, className, description, title, ...props }: SectionProps) {
  return (
    <View className={cn("gap-1.5", className)} {...props}>
      <View className="flex-row items-end justify-between gap-3 px-1 py-1">
        <View className="min-w-0 flex-1">
          <Text selectable className="text-[14px] font-semibold text-notion-faint">
            {title}
          </Text>
          {description ? (
            <Text selectable className="mt-0.5 text-xs leading-4 text-notion-faint" numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
