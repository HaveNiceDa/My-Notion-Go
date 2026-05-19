import { cn } from "@/lib/cn";
import { Pressable, Text } from "@/tw";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Pressable> & {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  labelClassName?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "pill";
};

export function Button({
  className,
  disabled,
  isLoading,
  label,
  labelClassName,
  loadingLabel,
  variant = "primary",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;
  const variantClassName = {
    danger: "bg-notion-danger",
    ghost: "bg-transparent px-3 py-2",
    pill: "rounded-full border border-notion-border bg-notion-surface px-3.5 py-2.5",
    primary: "bg-notion-text",
    secondary: "bg-notion-hover",
  }[variant];
  const variantLabelClassName =
    variant === "primary" || variant === "danger" ? "text-white" : "text-notion-text";

  return (
    <Pressable
      accessibilityRole="button"
      className={cn("items-center rounded-xl px-4 py-3", variantClassName, isDisabled && "opacity-60", className)}
      disabled={isDisabled}
      {...props}
    >
      <Text className={cn("text-[15px] font-semibold", variantLabelClassName, labelClassName)}>
        {isLoading && loadingLabel ? loadingLabel : label}
      </Text>
    </Pressable>
  );
}
