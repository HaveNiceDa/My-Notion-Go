import type { AIConversation, AIMessage, StreamAIChatRequest } from "@my-notion-go/api-client";

export type MobileAIChatMode = "chat" | "rag";

export type MobileRAGCitation = {
  blockIds?: string[];
  chunkId: string;
  documentId: string;
  documentTitle?: string;
  position: number;
  preview: string;
  score: number;
};

export type MobileAIConversation = AIConversation;
export type MobileAIMessage = AIMessage & {
  streaming?: boolean;
};

export type MobileSendAIChatInput = StreamAIChatRequest;

export type MobileAIStreamEvent =
  | {
      data: AIConversation;
      event: "conversation";
    }
  | {
      data: AIMessage;
      event: "user_message";
    }
  | {
      data: {
        delta: string;
      };
      event: "message";
    }
  | {
      data: {
        items: MobileRAGCitation[];
      };
      event: "citations";
    }
  | {
      data: AIMessage;
      event: "assistant_message";
    }
  | {
      data: {
        conversationId: string;
      };
      event: "done";
    }
  | {
      data: {
        code?: string;
        message?: string;
      };
      event: "error";
    };
