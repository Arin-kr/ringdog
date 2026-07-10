"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { getToken } from "@/lib/auth";

// Wire format matches PRD `api_contracts.chatbot` (snake_case), which is
// what chatbot-service's Express routes actually accept/return.
interface ChatMessagesResponse {
  reply: string;
  session_id: string;
}

interface ChatBubble {
  role: "user" | "assistant";
  content: string;
}

// See apps/frontend/src/lib/apiClient.ts for why this defaults to a relative
// path rather than a localhost fallback.
const CHATBOT_API_BASE_URL = process.env.NEXT_PUBLIC_CHATBOT_API_BASE_URL ?? "";

/**
 * Floating chatbot widget available on every page (FR-CHAT-001). Renders the
 * running back-and-forth as chat bubbles (user right-aligned, assistant
 * left-aligned) rather than only the latest reply.
 *
 * TODO(M3): streaming replies.
 */
export function ChatWidget(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const text = message.trim();
    if (!text) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setMessage("");
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
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ChatMessagesResponse;
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setSessionId(data.session_id);
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

          <div className="chat-widget__body" ref={bodyRef}>
            {messages.length === 0 && !isLoading && (
              <p className="chat-widget__hint">Ask about products or your orders.</p>
            )}
            {messages.map((bubble, index) => (
              <div
                key={index}
                className={`chat-bubble chat-bubble--${bubble.role}`}
              >
                {bubble.content}
              </div>
            ))}
            {isLoading && (
              <div className="chat-bubble chat-bubble--assistant chat-bubble--pending">···</div>
            )}
            {error && <p className="chat-widget__error">{error}</p>}
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
