"use client";

import { FormEvent, useState } from "react";

import { getToken } from "@/lib/auth";

// Wire format matches PRD `api_contracts.chatbot` (snake_case), which is
// what chatbot-service's Express routes actually accept/return.
interface ChatMessagesResponse {
  reply: string;
  session_id: string;
}

const CHATBOT_API_BASE_URL =
  process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL ?? "http://localhost:4001";

/**
 * Floating chatbot widget available on every page (FR-CHAT-001).
 *
 * TODO(M3): render full message history, streaming replies, and pass the
 * user's JWT (once auth state exists) so personalized queries work.
 */
export function ChatWidget(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!message.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      const response = await fetch(`${CHATBOT_API_BASE_URL}/api/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ session_id: sessionId, message }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ChatMessagesResponse;
      setReply(data.reply);
      setSessionId(data.session_id);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-widget__panel">
          <div className="chat-widget__header">
            <span>RingDog Assistant</span>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat">
              ✕
            </button>
          </div>

          <div className="chat-widget__body">
            {reply && <p className="chat-widget__reply">{reply}</p>}
            {error && <p className="chat-widget__error">{error}</p>}
            {!reply && !error && <p className="chat-widget__hint">Ask about products or your orders.</p>}
          </div>

          <form className="chat-widget__form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !message.trim()}>
              {isLoading ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="chat-widget__toggle"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Toggle chat widget"
      >
        💬
      </button>
    </div>
  );
}
