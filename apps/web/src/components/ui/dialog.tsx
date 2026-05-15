import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ComponentRef, HTMLAttributes } from "react";
import { forwardRef } from "react";

const Dialog = DialogPrimitive.Root;
const DialogClose = DialogPrimitive.Close;
const DialogDescription = DialogPrimitive.Description;
const DialogTitle = DialogPrimitive.Title;

const DialogOverlay = forwardRef<ComponentRef<typeof DialogPrimitive.Overlay>, ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className = "", ...props }, ref) => (
    <DialogPrimitive.Overlay ref={ref} className={`dialog-overlay ${className}`} {...props} />
  ),
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<ComponentRef<typeof DialogPrimitive.Content>, ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(
  ({ children, className = "", ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content ref={ref} className={`dialog-content ${className}`} {...props}>
        {children}
        <DialogPrimitive.Close className="dialog-close">
          <X size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`dialog-header ${className}`} {...props} />;
}

function DialogFooter({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`dialog-footer ${className}`} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle };
