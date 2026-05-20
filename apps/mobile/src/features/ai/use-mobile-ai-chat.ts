import { useAuthStore } from "@/stores/auth-store";
import type { AIConversation, AIMessage } from "@my-notion-go/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { mobileAIApi } from "./mobile-ai-api";
import { mobileAIQueryKeys } from "./query-keys";
import type { MobileAIChatMode, MobileAIMessage, MobileAIStreamEvent, MobileRAGCitation } from "./types";
import { useMobileAIMessages } from "./use-mobile-ai-messages";

type UseMobileAIChatOptions = {
  mode?: MobileAIChatMode;
  model?: string;
};

export function useMobileAIChat({ mode = "chat", model }: UseMobileAIChatOptions = {}) {
  const queryClient = useQueryClient();
  const runWithAuth = useAuthStore((state) => state.runWithAuth);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentCitationsRef = useRef<MobileRAGCitation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MobileAIMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const messagesQuery = useMobileAIMessages(selectedConversationId ?? "");

  useEffect(() => {
    if (messagesQuery.data) {
      setMessages(messagesQuery.data);
    } else if (!selectedConversationId) {
      setMessages([]);
    }
  }, [messagesQuery.data, selectedConversationId]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const selectConversation = useCallback((conversationId: string | null) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    currentCitationsRef.current = [];
    setSending(false);
    setStreamError(null);
    setSelectedConversationId(conversationId);
    if (!conversationId) {
      setMessages([]);
    }
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      const content = message.trim();
      if (!content || !selectedConversationId || abortControllerRef.current) {
        return false;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      currentCitationsRef.current = [];
      setSending(true);
      setStreamError(null);
      setMessages((currentMessages) => appendPendingExchange(currentMessages, selectedConversationId, content));

      try {
        await runWithAuth((accessToken) =>
          mobileAIApi.streamChat({
            accessToken,
            input: {
              conversationId: selectedConversationId,
              message: content,
              model,
            },
            mode,
            onEvent: (event) => {
              handleStreamEvent(event, {
                currentCitationsRef,
                queryClient,
                setMessages,
                setSelectedConversationId,
                setStreamError,
              });
            },
            signal: controller.signal,
          }),
        );
        await queryClient.invalidateQueries({ queryKey: mobileAIQueryKeys.messages(selectedConversationId) });
        return true;
      } catch (error) {
        if (isAbortError(error)) {
          return false;
        }
        setMessages((currentMessages) => removeStreamingAssistantMessage(currentMessages));
        setStreamError(error instanceof Error ? error.message : "");
        return false;
      } finally {
        abortControllerRef.current = null;
        currentCitationsRef.current = [];
        setSending(false);
        void queryClient.invalidateQueries({ queryKey: mobileAIQueryKeys.conversations() });
      }
    },
    [mode, model, queryClient, runWithAuth, selectedConversationId],
  );

  const cancelStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    currentCitationsRef.current = [];
    setSending(false);
    setMessages((currentMessages) => removeStreamingAssistantMessage(currentMessages));
  }, []);

  return {
    cancelStreaming,
    messages,
    messagesError: messagesQuery.isError,
    messagesLoading: messagesQuery.isLoading,
    refetchMessages: messagesQuery.refetch,
    selectConversation,
    selectedConversationId,
    sendMessage,
    sending,
    streamError,
  };
}

type StreamEventHandlers = {
  currentCitationsRef: MutableRefObject<MobileRAGCitation[]>;
  queryClient: ReturnType<typeof useQueryClient>;
  setMessages: Dispatch<SetStateAction<MobileAIMessage[]>>;
  setSelectedConversationId: (conversationId: string) => void;
  setStreamError: Dispatch<SetStateAction<string | null>>;
};

function handleStreamEvent(event: MobileAIStreamEvent, handlers: StreamEventHandlers) {
  switch (event.event) {
    case "conversation":
      upsertConversation(handlers.queryClient, event.data);
      handlers.setSelectedConversationId(event.data.id);
      break;
    case "user_message":
      handlers.setMessages((messages) => replacePendingUserMessage(messages, event.data));
      break;
    case "message":
      handlers.setMessages((messages) =>
        upsertStreamingAssistantMessage(messages, event.data.delta, handlers.currentCitationsRef.current),
      );
      break;
    case "citations":
      handlers.currentCitationsRef.current = event.data.items;
      handlers.setMessages((messages) => updateStreamingAssistantCitations(messages, event.data.items));
      break;
    case "assistant_message":
      handlers.setMessages((messages) => replaceStreamingAssistantMessage(messages, event.data));
      handlers.currentCitationsRef.current = [];
      break;
    case "error":
      handlers.setMessages((messages) => removeStreamingAssistantMessage(messages));
      handlers.setStreamError(event.data.message ?? "");
      break;
    case "done":
      void handlers.queryClient.invalidateQueries({ queryKey: mobileAIQueryKeys.messages(event.data.conversationId) });
      break;
  }
}

function upsertConversation(queryClient: ReturnType<typeof useQueryClient>, conversation: AIConversation) {
  queryClient.setQueryData<AIConversation[]>(mobileAIQueryKeys.conversations(), (conversations = []) => {
    const exists = conversations.some((item) => item.id === conversation.id);
    if (exists) {
      return conversations.map((item) => (item.id === conversation.id ? conversation : item));
    }
    return [conversation, ...conversations];
  });
}

function appendMessage(messages: MobileAIMessage[], message: AIMessage): MobileAIMessage[] {
  if (messages.some((item) => item.id === message.id)) {
    return messages;
  }
  return [...messages, message];
}

function appendPendingExchange(
  messages: MobileAIMessage[],
  conversationId: string,
  content: string,
): MobileAIMessage[] {
  const now = new Date().toISOString();
  return [
    ...messages.filter((message) => !message.streaming),
    {
      content,
      conversationId,
      createdAt: now,
      id: "mobile-pending-user-message",
      metadata: { optimistic: true },
      role: "user",
      updatedAt: now,
    },
    {
      content: "",
      conversationId,
      createdAt: now,
      id: "mobile-streaming-assistant-message",
      metadata: {},
      role: "assistant",
      streaming: true,
      updatedAt: now,
    },
  ];
}

function replacePendingUserMessage(messages: MobileAIMessage[], message: AIMessage): MobileAIMessage[] {
  if (messages.some((item) => item.id === message.id)) {
    return messages;
  }
  const pendingUserIndex = messages.findIndex((item) => item.id === "mobile-pending-user-message");
  if (pendingUserIndex < 0) {
    return appendMessage(messages, message);
  }

  return messages.map((item, index) => (index === pendingUserIndex ? message : item));
}

function upsertStreamingAssistantMessage(
  messages: MobileAIMessage[],
  delta: string,
  citations: MobileRAGCitation[],
): MobileAIMessage[] {
  const streaming = messages.find((message) => message.streaming);
  if (!streaming) {
    // The backend later emits assistant_message with a durable id; this local row holds live deltas only.
    return [
      ...messages,
      {
        content: delta,
        conversationId: messages.at(-1)?.conversationId ?? "",
        createdAt: new Date().toISOString(),
        id: "mobile-streaming-assistant-message",
        metadata: citations.length > 0 ? { rag: { citations, enabled: true } } : {},
        role: "assistant",
        streaming: true,
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  return messages.map((message) => (message.streaming ? { ...message, content: message.content + delta } : message));
}

function updateStreamingAssistantCitations(
  messages: MobileAIMessage[],
  citations: MobileRAGCitation[],
): MobileAIMessage[] {
  if (citations.length === 0) {
    return messages;
  }

  return messages.map((message) =>
    message.streaming
      ? {
          ...message,
          metadata: {
            ...message.metadata,
            rag: {
              citations,
              enabled: true,
            },
          },
        }
      : message,
  );
}

function replaceStreamingAssistantMessage(messages: MobileAIMessage[], message: AIMessage): MobileAIMessage[] {
  const withoutStreaming = messages.filter((item) => !item.streaming && item.id !== message.id);
  return [...withoutStreaming, message];
}

function removeStreamingAssistantMessage(messages: MobileAIMessage[]): MobileAIMessage[] {
  return messages.filter((message) => !message.streaming);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
