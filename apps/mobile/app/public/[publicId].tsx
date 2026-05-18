import { ScreenScrollView } from "@/components/ui/screen";
import { PublicDocumentScreen } from "@/features/documents/public-document-screen";
import { useLocalSearchParams } from "expo-router";

export default function MobilePublicDocumentRoute() {
  const params = useLocalSearchParams<{ publicId?: string }>();
  const publicId = Array.isArray(params.publicId) ? params.publicId[0] : params.publicId;

  return (
    <ScreenScrollView>
      <PublicDocumentScreen publicId={publicId ?? ""} />
    </ScreenScrollView>
  );
}
