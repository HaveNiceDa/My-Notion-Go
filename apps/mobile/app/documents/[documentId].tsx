import { ScreenScrollView } from "@/components/ui/screen";
import { DocumentDetailScreen } from "@/features/documents/document-detail-screen";
import { useLocalSearchParams } from "expo-router";

export default function MobileDocumentDetailRoute() {
  const params = useLocalSearchParams<{ documentId?: string }>();
  const documentId = Array.isArray(params.documentId) ? params.documentId[0] : params.documentId;

  return (
    <ScreenScrollView>
      <DocumentDetailScreen documentId={documentId ?? ""} />
    </ScreenScrollView>
  );
}
