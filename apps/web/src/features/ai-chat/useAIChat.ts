import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiChatApi, type AIConversation, type AIMessage } from "@my-notion-go/api-client";
import { webAIChatApi } from "./api";
import { aiConversationsQueryKey, aiMessagesQueryKey } from "./queryKeys";
import type { AIChatStreamEvent, ChatMessage } from "./types";

type UseAIChatOptions = {
accessToken: string;
  model: string;
};

export function useAIChat({ accessToken, model }: UseAIChatOptions) {
  const queryClient = useQueryClient();
  // AbortController 放在 ref 里，避免每个 SSE chunk 触发重新渲染；UI 的发送态由 sending state 单独驱动。
  const abortControllerRef = useRef<AbortController | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);

  const conversationsQuery = useQuery({
    queryKey: aiConversationsQueryKey,
    queryFn: () => aiChatApi.conversations(accessToken),
    enabled: Boolean(accessToken),
  });

  const messagesQuery = useQuery({
    queryKey: aiMessagesQueryKey(activeConversationId),
    queryFn: () => aiChatApi.messages(activeConversationId!, accessToken),
    enabled: Boolean(accessToken && activeConversationId),
  });

  const createConversationMutation = useMutation({
    mutationFn: (title: string) => aiChatApi.createConversation({ title }, accessToken),
    onSuccess(conversation) {
      upsertConversation(queryClient, conversation);
      setActiveConversationId(conversation.id);
      setMessages([]);
    },
  });

  // React Query 缓存是服务端真相；messages state 额外承载“正在流式生成”的临时 assistant 消息。
  useEffect(() => {
    if (messagesQuery.data) {
      setMessages(messagesQuery.data);
    } else if (!activeConversationId) {
      setMessages([]);
    }
  }, [activeConversationId, messagesQuery.data]);

  useUnmount(() => {
    abortControllerRef.current?.abort();
  });

  const activeConversation = useMemo(
    () => conversationsQuery.data?.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversationsQuery.data],
  );

  const createConversation = useMemoizedFn((title: string) => {
    createConversationMutation.mutate(title);
  });

  const selectConversation = useMemoizedFn((conversationId: string) => {
    setActiveConversationId(conversationId);
    setStreamError(null);
    setStreamingMessage("");
  });

  const sendMessage = useMemoizedFn(async (message: string) => {
    const content = message.trim();
    if (!content || !accessToken || abortControllerRef.current) {
      return;
    }

    setStreamError(null);
    setStreamingMessage("");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSending(true);

    try {
      await webAIChatApi.streamChat({
        accessToken,
        signal: controller.signal,
        input: {
          conversationId: activeConversationId,
          message: content,
          model,
        },
        onEvent: (event) => {
          handleStreamEvent(event, {
            queryClient,
            setActiveConversationId,
            setMessages,
            setStreamingMessage,
            setStreamError,
          });
        },
      });
      if (activeConversationId) {
        await queryClient.invalidateQueries({ queryKey: aiMessagesQueryKey(activeConversationId) });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setMessages((messages) => removeStreamingAssistantMessage(messages));
      setStreamError(error instanceof Error ? error.message : "");
    } finally {
      abortControllerRef.current = null;
      setSending(false);
      setStreamingMessage("");
      void queryClient.invalidateQueries({ queryKey: aiConversationsQueryKey });
    }
  });

  const cancelStreaming = useMemoizedFn(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSending(false);
    setStreamingMessage("");
  });

  return {
    activeConversation,
    activeConversationId,
    cancelStreaming,
    conversations: conversationsQuery.data ?? [],
    conversationsLoading: conversationsQuery.isLoading,
    createConversation,
    creatingConversation: createConversationMutation.isPending,
    messages,
    messagesLoading: messagesQuery.isLoading,
    selectConversation,
    sendMessage,
    sending,
    streamError,
    streamingMessage,
  };
}

type StreamEventHandlers = {
  queryClient: ReturnType<typeof useQueryClient>;
  setActiveConversationId: (id: string) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setStreamingMessage: Dispatch<SetStateAction<string>>;
  setStreamError: Dispatch<SetStateAction<string | null>>;
};

function handleStreamEvent(event: AIChatStreamEvent, handlers: StreamEventHandlers) {
  switch (event.event) {
    case "conversation":
      upsertConversation(handlers.queryClient, event.data);
      handlers.setActiveConversationId(event.data.id);
      break;
    case "user_message":
      handlers.setMessages((messages) => appendMessage(messages, event.data));
      break;
    case "message":
      handlers.setStreamingMessage((content) => content + event.data.delta);
      handlers.setMessages((messages) => upsertStreamingAssistantMessage(messages, event.data.delta));
      break;
    case "assistant_message":
      handlers.setMessages((messages) => replaceStreamingAssistantMessage(messages, event.data));
      handlers.setStreamingMessage("");
      break;
    case "error":
      handlers.setMessages((messages) => removeStreamingAssistantMessage(messages));
      handlers.setStreamError(event.data.message ?? "");
      break;
    case "done":
      void handlers.queryClient.invalidateQueries({ queryKey: aiMessagesQueryKey(event.data.conversationId) });
      break;
  }
}

function upsertConversation(queryClient: ReturnType<typeof useQueryClient>, conversation: AIConversation) {
  queryClient.setQueryData<AIConversation[]>(aiConversationsQueryKey, (conversations = []) => {
    const exists = conversations.some((item) => item.id === conversation.id);
    if (exists) {
      return conversations.map((item) => (item.id === conversation.id ? conversation : item));
    }
    return [conversation, ...conversations];
  });
}

function appendMessage(messages: ChatMessage[], message: AIMessage): ChatMessage[] {
  if (messages.some((item) => item.id === message.id)) {
    return messages;
  }
  return [...messages, message];
}

function upsertStreamingAssistantMessage(messages: ChatMessage[], delta: string): ChatMessage[] {
  const streaming = messages.find((message) => message.streaming);
  if (!streaming) {
    // 后端最终会返回 assistant_message 的真实 id；流式过程中先用本地临时消息承接 delta。
    return [
      ...messages,
      {
        id: "streaming-assistant-message",
        conversationId: messages.at(-1)?.conversationId ?? "",
        role: "assistant",
        content: delta,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        streaming: true,
      },
    ];
  }

  return messages.map((message) => (message.streaming ? { ...message, content: message.content + delta } : message));
}

function replaceStreamingAssistantMessage(messages: ChatMessage[], message: AIMessage): ChatMessage[] {
  // 用落库后的 assistant 消息替换临时 streaming 消息，保证刷新后列表和服务端状态一致。
  const withoutStreaming = messages.filter((item) => !item.streaming && item.id !== message.id);
  return [...withoutStreaming, message];
}

function removeStreamingAssistantMessage(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => !message.streaming);
}
