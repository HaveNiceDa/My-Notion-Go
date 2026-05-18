import { cn } from "@/lib/cn";
import { TextInput } from "@/tw";
import type { ComponentProps } from "react";

type InputProps = ComponentProps<typeof TextInput>;

export function Input({ className, placeholderTextColor = "#78716C", ...props }: InputProps) {
  return (
    <TextInput
      className={cn("rounded-2xl border border-notion-border px-3.5 py-3 text-base text-notion-text", className)}
      placeholderTextColor={placeholderTextColor}
      {...props}
    />
  );
}
