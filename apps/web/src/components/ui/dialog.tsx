import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ComponentRef, HTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<ComponentRef<typeof DialogPrimitive.Overlay>, ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className = "", ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out", className)}
      {...props}
    />
  ),
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<ComponentRef<typeof DialogPrimitive.Content>, ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ children, className = "", ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 text-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X size={16} />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 grid gap-2 text-left", className)} {...props} />;
}

function DialogFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-5 flex justify-end gap-2", className)} {...props} />;
}

const DialogTitle = forwardRef<ComponentRef<typeof DialogPrimitive.Title>, ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className = "", ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = forwardRef<
  ComponentRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className = "", ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger };
