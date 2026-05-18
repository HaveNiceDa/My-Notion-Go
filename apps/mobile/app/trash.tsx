import { ScreenScrollView } from "@/components/ui/screen";
import { TrashScreen } from "@/features/documents/trash-screen";

export default function MobileTrashRoute() {
  return (
    <ScreenScrollView>
      <TrashScreen />
    </ScreenScrollView>
  );
}
