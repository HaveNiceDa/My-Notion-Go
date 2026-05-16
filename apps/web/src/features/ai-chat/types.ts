import type { AIConversation, AIMessage, StreamAIChatRequest } from "@my-notion-go/api-client";

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
