export type ChatRole = "user" | "assistant";

export interface ChatSession {
  id: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  tokensUsed: number | null;
  createdAt: string;
}

export interface SendChatMessageInput {
  sessionId?: string;
  message: string;
}

export interface SendChatMessageResult {
  reply: string;
  sessionId: string;
}
