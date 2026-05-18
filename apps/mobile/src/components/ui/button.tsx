import { cn } from "@/lib/cn";
import { Pressable, Text } from "@/tw";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Pressable> & {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  labelClassName?: string;
};

export function Button({ className, disabled, isLoading, label, labelClassName, loadingLabel, ...props }: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      className={cn("items-center rounded-full bg-notion-text px-5 py-3.5", isDisabled && "opacity-70", className)}
      disabled={isDisabled}
      {...props}
    >
      <Text className={cn("text-base font-bold text-white", labelClassName)}>
        {isLoading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}
