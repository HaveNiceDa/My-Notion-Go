import { Bot, Check, ChevronDown, Loader2, MessageCircle, Plus, Send, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { aiModels, aiModelStorageKey, getInitialAIModelId, type AIModelId } from "./models";
import { useAIChat } from "./useAIChat";

type AIChatPanelProps = {
  accessToken: string;
  open: boolean;
  onClose: () => void;
};

export function AIChatPanel({ accessToken, open, onClose }: AIChatPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<AIModelId>(() => getInitialAIModelId());
  const selectedModel = aiModels.find((model) => model.id === selectedModelId) ?? aiModels[0];
  const chat = useAIChat({ accessToken, model: selectedModelId });

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

  return (
    <aside
      aria-label={t("aiChat.panelLabel")}
      className="fixed inset-y-0 right-0 z-40 flex h-full w-[min(100vw,360px)] flex-col border-l border-border bg-background shadow-[var(--shadow)] md:static md:z-auto md:w-[360px] md:flex-[0_0_360px] md:shadow-[-16px_0_40px_rgba(15,23,42,0.06)]"
    >
      <header className="flex min-h-[58px] items-center justify-between gap-3 border-b border-border py-2.5 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-[30px] flex-none place-items-center rounded-lg bg-secondary">
            <Bot size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold">{t("aiChat.title")}</h2>
            <p className="max-w-60 truncate text-xs text-muted-foreground">{chat.activeConversation?.title || t("aiChat.subtitle")}</p>
          </div>
        </div>
        <Button className="size-8" onClick={onClose} size="icon" title={t("aiChat.close")} type="button" variant="ghost">
          <X size={18} />
        </Button>
      </header>

      <section aria-label={t("aiChat.conversations")} className="grid gap-2 border-b border-border p-3">
        <div className="grid gap-1.5">
          <p className="m-0 text-xs font-medium text-muted-foreground">{t("aiChat.model")}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-auto min-h-9 justify-between gap-2 px-3 py-2 text-left" disabled={chat.sending} type="button" variant="outline">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{selectedModel.displayName}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">{t(selectedModel.descriptionKey)}</span>
                </span>
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

        <Button
          disabled={chat.creatingConversation || chat.sending}
          onClick={() => chat.createConversation(t("aiChat.newConversationTitle"))}
          size="sm"
          type="button"
          variant="outline"
        >
          {chat.creatingConversation ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
          {t("aiChat.newConversation")}
        </Button>
        <div className="grid max-h-[132px] gap-0.5 overflow-auto">
          {chat.conversationsLoading ? <p className="m-0 text-xs text-muted-foreground">{t("aiChat.loadingConversations")}</p> : null}
          {chat.conversations.map((conversation) => (
            <Button
              className={cn(
                "h-[30px] w-full justify-start gap-2 rounded-md px-2 text-left text-muted-foreground hover:bg-secondary hover:text-foreground",
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

      <section aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 py-4">
        {chat.messagesLoading ? <p className="m-0 text-xs text-muted-foreground">{t("aiChat.loadingMessages")}</p> : null}
        {!chat.messagesLoading && chat.messages.length === 0 ? (
          <div className="grid flex-1 place-items-center gap-2.5 text-center text-[13px] text-muted-foreground">
            <Bot size={24} />
            <p className="m-0">{t("aiChat.empty")}</p>
          </div>
        ) : null}
        {chat.messages.map((message) => (
          <article className={cn("flex flex-col items-start gap-1", message.role === "user" && "items-end")} key={message.id}>
            <div className="text-xs text-muted-foreground">{t(`aiChat.roles.${message.role}`)}</div>
            <div
              className={cn(
                "max-w-[88%] whitespace-pre-wrap rounded-xl bg-secondary px-[11px] py-[9px] text-sm leading-[1.55] text-foreground",
                message.role === "user" && "bg-primary text-primary-foreground",
              )}
            >
              {message.content}
              {message.streaming ? <span className="ml-0.5 inline-block h-[1em] w-1.5 animate-[blink_1s_steps(2,start)_infinite] bg-current align-[-2px]" /> : null}
            </div>
          </article>
        ))}
      </section>

      {chat.streamError ? (
        <p className="mx-3 mb-2 mt-0 rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-muted)] px-2.5 py-2 text-[13px] text-[var(--danger)]">
          {chat.streamError}
        </p>
      ) : null}

      <form className="grid gap-2 border-t border-border p-3" onSubmit={submit}>
        <Textarea
          aria-label={t("aiChat.inputLabel")}
          className="resize-none rounded-[10px] border-border px-[11px] py-2.5 text-sm leading-normal focus-visible:border-foreground"
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
        <div className="flex items-center justify-end gap-2">
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
      </form>
    </aside>
  );
}
