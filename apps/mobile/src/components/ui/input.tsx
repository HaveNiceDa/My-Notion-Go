import { cn } from "@/lib/cn";
import { TextInput } from "@/tw";
import type { ComponentProps } from "react";

type InputProps = ComponentProps<typeof TextInput>;

export function Input({ className, placeholderTextColor = "#78716C", ...props }: InputProps) {
  return (
    <TextInput
      className={cn("rounded-xl border border-notion-border bg-notion-surface px-3 py-2.5 text-[15px] text-notion-text", className)}
      placeholderTextColor={placeholderTextColor}
      {...props}
    />
  );
}
