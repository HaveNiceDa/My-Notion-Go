import { AlertCircle, Bot, Check, ChevronDown, Database, Loader2, MessageCircle, Plus, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { cn } from "@/lib/utils";
import { aiChatModeStorageKey, aiModels, aiModelStorageKey, getInitialAIChatMode, getInitialAIModelId, type AIChatMode, type AIModelId } from "./models";
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
  const [selectedMode, setSelectedMode] = useState<AIChatMode>(() => getInitialAIChatMode());
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

  const selectMode = (mode: AIChatMode) => {
    setSelectedMode(mode);
    window.localStorage.setItem(aiChatModeStorageKey, mode);
  };

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

      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 flex-none place-items-center rounded-full border border-border bg-background shadow-sm">
            <Bot size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold leading-tight">{chat.activeConversation?.title || t("aiChat.newConversationTitle")}</h2>
            <p className="max-w-60 truncate text-xs text-muted-foreground">{t("aiChat.subtitle")}</p>
          </div>
        </div>
        <Button className="size-8" onClick={onClose} size="icon" title={t("aiChat.close")} type="button" variant="ghost">
          <X size={18} />
        </Button>
      </header>

      <section aria-label={t("aiChat.conversations")} className="grid gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-xs font-medium text-muted-foreground">{t("aiChat.model")}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-8 max-w-[230px] justify-between gap-2 rounded-full px-3 text-left text-xs" disabled={chat.sending} type="button" variant="outline">
                <span className="truncate font-medium">{selectedModel.displayName}</span>
                <ChevronDown className="size-4 flex-none text-muted-foreground" />
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
        </div>

        <div className="grid gap-1.5">
          <p className="m-0 text-xs font-medium text-muted-foreground">{t("aiChat.mode")}</p>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {(["chat", "rag"] as const).map((mode) => (
              <Button
                className={cn("h-8 justify-center rounded-md text-xs", selectedMode === mode && "bg-background shadow-sm")}
                disabled={chat.sending}
                key={mode}
                onClick={() => selectMode(mode)}
                size="sm"
                type="button"
                variant={selectedMode === mode ? "outline" : "ghost"}
              >
                {mode === "rag" ? <Database size={14} /> : <Bot size={14} />}
                {t(`aiChat.modes.${mode}`)}
              </Button>
            ))}
          </div>
          <p className="m-0 text-xs leading-5 text-muted-foreground">{t(`aiChat.modeDescriptions.${selectedMode}`)}</p>
        </div>

        <Button
          className="h-8 justify-center rounded-md text-xs"
          disabled={chat.creatingConversation || chat.sending}
          onClick={() => chat.createConversation(t("aiChat.newConversationTitle"))}
          size="sm"
          type="button"
          variant="outline"
        >
          {chat.creatingConversation ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
          {t("aiChat.newConversation")}
        </Button>
        <div className="grid max-h-[112px] gap-0.5 overflow-auto">
          {chat.conversationsLoading ? <p className="m-0 text-xs text-muted-foreground">{t("aiChat.loadingConversations")}</p> : null}
          {chat.conversations.map((conversation) => (
            <Button
              className={cn(
                "h-8 w-full justify-start gap-2 rounded-md px-2 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground",
                conversation.id === chat.activeConversationId && "bg-secondary text-foreground",
              )}
              key={conversation.id}
              onClick={() => chat.selectConversation(conversation.id)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <MessageCircle size={14} />
              <span className="truncate">{conversation.title || t("aiChat.untitledConversation")}</span>
            </Button>
          ))}
        </div>
      </section>

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
                  {citations.slice(0, 3).map((citation) => (
                    <p className="m-0 line-clamp-2 leading-5" key={citation.chunkId}>
                      {citation.preview}
                    </p>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
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
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {selectedModel.displayName} · {t(`aiChat.modes.${selectedMode}`)}
            </span>
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
