import { AlertCircle, Bot, Check, ChevronDown, Database, Loader2, Plus, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { cn } from "@/lib/utils";
import { aiModels, aiModelStorageKey, getInitialAIModelId, type AIChatMode, type AIModelId } from "./models";
import type { ChatMessage, RAGCitation } from "./types";
import { useAIChat } from "./useAIChat";

type AIChatPanelProps = {
  accessToken: string;
  open: boolean;
  onClose: () => void;
};

export function AIChatPanel({ accessToken, open, onClose }: AIChatPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [selectedMode, setSelectedMode] = useState<AIChatMode>("chat");
  const [selectedModelId, setSelectedModelId] = useState<AIModelId>(() => getInitialAIModelId());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedModel = aiModels.find((model) => model.id === selectedModelId) ?? aiModels[0];
  const chat = useAIChat({ accessToken, mode: selectedMode, model: selectedModelId });
  // AI 面板可以拉伸，但需要上限保护，避免在小屏或编辑区较窄时抢占太多正文空间。
  const panelResize = useResizableWidth({
    defaultWidth: 380,
    edge: "right",
    maxWidth: 520,
    minWidth: 320,
    storageKey: "my-notion-go.ai-chat.width",
  });

  useEffect(() => {
    // 流式输出会高频追加 delta；滚到底部锚点比手动计算 scrollTop 更不容易受消息高度变化影响。
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: chat.sending ? "smooth" : "auto" });
  }, [chat.messages, chat.sending, chat.streamError]);

  // 面板关闭时直接卸载，避免隐藏状态下继续订阅消息流或占用右侧布局宽度。
  if (!open) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || chat.sending) {
      return;
    }

    // 先清空输入框再发起流式请求，让用户立即感知提交已生效；失败提示由 Hook 的 streamError 承接。
    setDraft("");
    await chat.sendMessage(message);
  };

  const selectModel = (modelId: AIModelId) => {
    setSelectedModelId(modelId);
    window.localStorage.setItem(aiModelStorageKey, modelId);
  };

  const toggleKnowledgeMode = () => {
    const nextMode: AIChatMode = selectedMode === "rag" ? "chat" : "rag";
    setSelectedMode(nextMode);
    toast.success(t(nextMode === "rag" ? "aiChat.knowledgeModeEnabledToast" : "aiChat.knowledgeModeDisabledToast"));
  };

  const waitingForAssistant = chat.sending && !chat.messages.some((message) => message.streaming);

  return (
    <aside
      aria-label={t("aiChat.panelLabel")}
      className="group/ai-panel fixed inset-y-0 right-0 z-40 flex h-full w-[min(100vw,380px)] flex-col border-l border-border bg-background shadow-[var(--shadow)] md:relative md:static md:z-auto md:shadow-[-16px_0_40px_rgba(15,23,42,0.05)]"
      style={{ flexBasis: panelResize.width, width: `min(100vw, ${panelResize.width}px)` }}
    >
      <div
        aria-label={t("aiChat.resizePanel")}
        aria-orientation="vertical"
        className="absolute inset-y-0 left-0 hidden w-1 cursor-col-resize bg-transparent transition hover:bg-primary/10 group-hover/ai-panel:bg-primary/5 md:block"
        onPointerDown={panelResize.startResize}
        role="separator"
      />

      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-border px-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-8 min-w-0 max-w-[230px] justify-start gap-1.5 rounded-md px-2 text-left text-sm font-medium text-foreground hover:bg-secondary" type="button" variant="ghost">
              <span className="truncate">{chat.activeConversation?.title || t("aiChat.newConversationTitle")}</span>
              <ChevronDown className="size-4 flex-none text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-auto">
            {chat.conversationsLoading ? <DropdownMenuItem disabled>{t("aiChat.loadingConversations")}</DropdownMenuItem> : null}
            {chat.conversations.map((conversation) => (
              <DropdownMenuItem
                className={cn("cursor-pointer text-foreground focus:text-foreground", conversation.id === chat.activeConversationId && "bg-secondary font-medium")}
                key={conversation.id}
                onSelect={() => chat.selectConversation(conversation.id)}
              >
                <span className="truncate">
                  {conversation.title || t("aiChat.untitledConversation")}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-none items-center gap-1">
          <Button
            className="size-8"
            disabled={chat.creatingConversation || chat.sending}
            onClick={() => chat.createConversation(t("aiChat.newConversationTitle"))}
            size="icon"
            title={t("aiChat.newConversation")}
            type="button"
            variant="ghost"
          >
            {chat.creatingConversation ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          </Button>
          <Button className="size-8" onClick={onClose} size="icon" title={t("aiChat.close")} type="button" variant="ghost">
            <X size={18} />
          </Button>
        </div>
      </header>

      <section aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-5">
        {chat.messagesLoading ? <p className="m-0 text-xs text-muted-foreground">{t("aiChat.loadingMessages")}</p> : null}
        {!chat.messagesLoading && chat.messages.length === 0 ? (
          <div className="flex flex-1 flex-col justify-end pb-8 text-left">
            <span className="mb-4 grid size-12 place-items-center rounded-full border border-border bg-background shadow-sm">
              <Bot size={24} />
            </span>
            <h3 className="mb-3 text-xl font-semibold text-foreground">{t("aiChat.emptyTitle")}</h3>
            <div className="grid gap-2 text-sm text-muted-foreground">
              {/* 当前阶段先展示 Notion AI 风格的能力提示，后续接上下文工具后再升级成可点击快捷操作。 */}
              {["summarize", "translate", "analyze", "task"].map((key) => (
                <p className="m-0" key={key}>
                  {t(`aiChat.suggestions.${key}`)}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        {chat.messages.map((message) => {
          const citations = getRAGCitations(message);
          return (
            <article className={cn("flex flex-col items-start gap-1.5", message.role === "user" && "items-end")} key={message.id}>
              <div className="px-1 text-[11px] font-medium text-muted-foreground">{t(`aiChat.roles.${message.role}`)}</div>
              <div
                className={cn(
                  "max-w-[92%] whitespace-pre-wrap rounded-2xl bg-secondary px-3 py-2.5 text-sm leading-[1.6] text-foreground",
                  message.role === "user" && "rounded-br-md bg-primary px-3.5 text-primary-foreground",
                  message.role !== "user" && "rounded-bl-md",
                )}
              >
                {message.content}
                {message.streaming ? <span className="ml-0.5 inline-block h-[1em] w-1.5 animate-[blink_1s_steps(2,start)_infinite] bg-current align-[-2px]" /> : null}
              </div>
              {citations.length > 0 ? (
                <div className="grid max-w-[92%] gap-1 rounded-xl border border-border bg-background/80 px-2.5 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Database size={13} />
                    {t("aiChat.citationsTitle", { count: citations.length })}
                  </div>
                  {citations.slice(0, 3).map((citation, index) => (
                    <Button
                      asChild
                      className="h-auto min-w-0 justify-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                      key={citation.chunkId}
                      title={t("aiChat.openCitationDocument")}
                      variant="ghost"
                    >
                      <a href={buildCitationHref(citation)} rel="noopener noreferrer" target="_blank">
                        <span className="mt-0.5 grid size-5 flex-none place-items-center rounded-full bg-secondary text-[10px] font-semibold text-foreground">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium text-foreground">
                              {citation.documentTitle || t("aiChat.citationUntitledDocument")}
                            </span>
                            <span className="flex-none rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {t("aiChat.citationScore", { score: formatCitationScore(citation.score) })}
                            </span>
                          </span>
                          <span className="block truncate leading-5">{citation.preview}</span>
                        </span>
                      </a>
                    </Button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
        {waitingForAssistant ? <WaitingAssistantMessage label={t("aiChat.waitingResponse")} /> : null}
        <div ref={messagesEndRef} />
      </section>

      {chat.streamError !== null ? (
        <div className="mx-3 mb-2 mt-0 flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-muted)] px-2.5 py-2 text-[13px] text-[var(--danger)]" role="alert">
          <AlertCircle className="mt-0.5 size-4 flex-none" />
          <div className="grid gap-0.5">
            <p className="m-0 font-medium">{t("aiChat.errorTitle")}</p>
            <p className="m-0 leading-5">{chat.streamError || t("aiChat.errorFallback")}</p>
          </div>
        </div>
      ) : null}

      <form className="border-t border-border p-3" onSubmit={submit}>
        <div className="rounded-2xl border border-input bg-background p-2 shadow-sm focus-within:border-primary/70 focus-within:ring-2 focus-within:ring-ring">
          <Textarea
            aria-label={t("aiChat.inputLabel")}
            className="min-h-[76px] resize-none border-0 px-1 py-1 text-sm leading-normal shadow-none focus-visible:ring-0"
            disabled={chat.sending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={t("aiChat.placeholder")}
            rows={3}
            value={draft}
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-7 max-w-32 justify-start gap-1.5 rounded-full px-2 text-xs text-foreground" disabled={chat.sending} type="button" variant="outline">
                    <span className="truncate">{selectedModel.displayName}</span>
                    <ChevronDown className="size-3.5 flex-none" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-80">
                  {aiModels.map((model) => (
                    <DropdownMenuItem className="items-start gap-2" key={model.id} onSelect={() => selectModel(model.id)}>
                      <Check className={cn("mt-0.5 size-4", model.id === selectedModelId ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{model.displayName}</span>
                        <span className="block text-xs leading-5 text-muted-foreground">{t(model.descriptionKey)}</span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                aria-pressed={selectedMode === "rag"}
                className={cn(
                  "h-7 justify-start gap-1.5 rounded-full px-2 text-xs",
                  selectedMode === "rag" ? "border-primary/30 bg-secondary text-foreground" : "text-muted-foreground",
                )}
                disabled={chat.sending}
                onClick={toggleKnowledgeMode}
                title={t(selectedMode === "rag" ? "aiChat.knowledgeModeDisable" : "aiChat.knowledgeModeEnable")}
                type="button"
                variant="outline"
              >
                <Database size={13} />
                <span>{t("aiChat.knowledgeMode")}</span>
              </Button>
            </div>
            {chat.sending ? (
              <Button onClick={chat.cancelStreaming} size="sm" type="button" variant="outline">
                {t("aiChat.stop")}
              </Button>
            ) : null}
            <Button disabled={!draft.trim() || chat.sending} size="sm" type="submit">
              {chat.sending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              {t("aiChat.send")}
            </Button>
          </div>
        </div>
      </form>
    </aside>
  );
}

function WaitingAssistantMessage({ label }: { label: string }) {
  return (
    <article className="flex flex-col items-start gap-1.5">
      <div className="px-1 text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="flex max-w-[92%] items-center gap-2 rounded-2xl rounded-bl-md bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
        {/* 首个 SSE delta 返回前没有 assistant 临时消息，这里用轻量动画明确展示请求仍在等待上游响应。 */}
        <Loader2 className="size-4 animate-spin" />
        <span className="flex items-center gap-1" aria-label={label}>
          <span className="size-1.5 animate-bounce rounded-full bg-current" />
          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
        </span>
      </div>
    </article>
  );
}

function getRAGCitations(message: ChatMessage): RAGCitation[] {
  const rag = message.metadata.rag;
  if (!isRAGMetadata(rag)) {
    return [];
  }
  return rag.citations;
}

function isRAGMetadata(value: unknown): value is { citations: RAGCitation[] } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const citations = (value as { citations?: unknown }).citations;
  return Array.isArray(citations);
}

function formatCitationScore(score: number) {
  if (!Number.isFinite(score)) {
    return "0%";
  }
  return `${Math.round(score * 100)}%`;
}

function buildCitationHref(citation: RAGCitation) {
  const params = new URLSearchParams({
    citationChunkId: citation.chunkId,
    citationPosition: String(citation.position),
  });
  const firstBlockID = citation.blockIds?.find((blockID) => blockID.trim() !== "");
  if (firstBlockID) {
    params.set("citationBlockId", firstBlockID);
  }
  return `/documents/${citation.documentId}?${params.toString()}`;
}
