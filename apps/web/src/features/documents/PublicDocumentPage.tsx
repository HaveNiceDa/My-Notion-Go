import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { publicDocumentApi } from "@my-notion-go/api-client";
import { ReadonlyDocumentContent } from "./DocumentEditor";

export function PublicDocumentPage() {
  const { i18n, t } = useTranslation();
  const { publicId } = useParams();
  const publicDocumentQuery = useQuery({
    queryKey: ["public-document", publicId],
    queryFn: () => publicDocumentApi.get(publicId!),
    enabled: Boolean(publicId),
    retry: false,
  });

  if (publicDocumentQuery.isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <article className="mx-auto w-[min(900px,100%)] px-6 py-12 pb-24 md:px-24 md:py-[74px]">
          <div className="mb-6 h-11 w-[62%] rounded-full bg-muted" />
          <div className="h-3.5 w-full rounded-full bg-muted" />
          <div className="mt-2 h-3.5 w-[72%] rounded-full bg-muted" />
        </article>
      </main>
    );
  }

  if (publicDocumentQuery.isError || !publicDocumentQuery.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
        <section>
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <FileText size={22} />
          </div>
          <h1 className="mt-4 text-xl font-semibold">{t("publicDocument.notFoundTitle")}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("publicDocument.notFoundDescription")}</p>
        </section>
      </main>
    );
  }

  const document = publicDocumentQuery.data;
  const updatedAt = new Date(document.updatedAt).toLocaleString(i18n.language === "en" ? "en-US" : "zh-CN");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <article className="mx-auto w-[min(900px,100%)] px-6 py-12 pb-24 md:px-24 md:py-[74px]">
        <div className="mb-[18px] h-24 rounded-[10px] bg-[linear-gradient(135deg,var(--secondary),color-mix(in_srgb,var(--secondary)_70%,var(--background)))]" />
        {document.icon ? <div className="mb-3 text-5xl leading-none">{document.icon}</div> : null}
        <h1 className="text-[clamp(34px,5vw,48px)] font-bold tracking-[-0.045em]">{document.title || t("documents.untitled")}</h1>
        <p className="mb-7 mt-2.5 text-[13px] text-muted-foreground">{t("publicDocument.lastUpdated", { time: updatedAt })}</p>
        <ReadonlyDocumentContent content={document.content} />
      </article>
    </main>
  );
}
