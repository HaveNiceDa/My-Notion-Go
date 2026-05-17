import type { AIConversation, AIMessage, StreamAIChatRequest } from "@my-notion-go/api-client";

export type AIChatMode = "chat" | "rag";

export type RAGCitation = {
  chunkId: string;
  documentId: string;
  documentTitle?: string;
  blockIds?: string[];
  position: number;
  score: number;
  preview: string;
};

export type ChatConversation = AIConversation;
export type ChatMessage = AIMessage & {
  streaming?: boolean;
};

export type SendAIChatInput = StreamAIChatRequest;

export type AIChatStreamEvent =
  | {
      event: "conversation";
      data: AIConversation;
    }
  | {
      event: "user_message";
      data: AIMessage;
    }
  | {
      event: "message";
      data: {
        delta: string;
      };
    }
  | {
      event: "citations";
      data: {
        items: RAGCitation[];
      };
    }
  | {
      event: "assistant_message";
      data: AIMessage;
    }
  | {
      event: "done";
      data: {
        conversationId: string;
      };
    }
  | {
      event: "error";
      data: {
        code?: string;
        message?: string;
      };
    };
