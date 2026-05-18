import { ScreenScrollView } from "@/components/ui/screen";
import { DocumentSearchScreen } from "@/features/documents/document-search-screen";

export default function MobileSearchRoute() {
  return (
    <ScreenScrollView>
      <DocumentSearchScreen />
    </ScreenScrollView>
  );
}
