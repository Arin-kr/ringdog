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
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex w-[300px] flex-col overflow-hidden rounded-3xl bg-white shadow-soft-lg">
          <div className="flex items-center justify-between bg-primary-500 px-4 py-3 text-white">
            <span className="font-heading">RingDog Assistant</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div ref={bodyRef} className="flex max-h-[360px] min-h-[120px] flex-col gap-2 overflow-y-auto p-4 text-sm">
            {messages.length === 0 && !isLoading && (
              <p className="text-stone-400">Ask about products or your orders.</p>
            )}
            {messages.map((bubble, index) => (
              <div
                key={index}
                className={
                  bubble.role === "user"
                    ? "max-w-[80%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary-100 px-3 py-2 leading-relaxed text-primary-800"
                    : "max-w-[80%] self-start whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 leading-relaxed text-stone-700"
                }
              >
                {bubble.content}
              </div>
            ))}
            {isLoading && (
              <div className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 text-stone-400">
                ···
              </div>
            )}
            {error && <p className="text-red-600">{error}</p>}
          </div>

          <form className="flex gap-2 border-t border-stone-100 p-3" onSubmit={handleSubmit}>
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 rounded-full border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              type="submit"
              disabled={isLoading || !message.trim()}
              className="rounded-full bg-primary-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-600 disabled:opacity-50"
            >
              {isLoading ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Toggle chat widget"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-2xl text-white shadow-soft-lg transition hover:bg-primary-600"
      >
        💬
      </button>
    </div>
  );
}
