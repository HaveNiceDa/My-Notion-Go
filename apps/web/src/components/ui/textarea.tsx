import type * as React from "react";

import { cn } from "@/lib/utils";

// Textarea 对齐 shadcn/ui 的“本地拥有组件源码”模式。
// 业务侧统一使用该封装，避免散落原生 textarea 样式和交互状态。
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
