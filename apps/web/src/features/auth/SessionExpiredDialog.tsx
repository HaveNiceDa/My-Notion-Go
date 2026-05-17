import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type SessionExpiredDialogProps = {
  open: boolean;
  onReload: () => void;
  onRelogin: () => void;
};

export function SessionExpiredDialog({ open, onReload, onRelogin }: SessionExpiredDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="p-7" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("auth.sessionExpiredTitle")}</DialogTitle>
          <DialogDescription>{t("auth.sessionExpiredDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onReload} type="button" variant="outline">
            {t("auth.sessionExpiredReload")}
          </Button>
          <Button onClick={onRelogin} type="button">
            {t("auth.sessionExpiredRelogin")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
