import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { env } from "../config/env";

const FALLBACK_MESSAGE =
  "Sorry, I'm having trouble answering right now. Please try again in a moment.";

export interface GenerateReplyResult {
  reply: string;
  tokensUsed: number | null;
}

const bedrockClient = env.bedrockMockMode
  ? undefined
  : new BedrockRuntimeClient({ region: env.awsRegion });

/**
 * Generates an assistant reply for a chat message.
 *
 * - When `BEDROCK_MOCK_MODE=true` (the .env.example default), returns a
 *   canned/templated response with no network calls, so local dev works
 *   without AWS credentials.
 * - Otherwise invokes `BEDROCK_MODEL_ID` via Bedrock Runtime. On failure,
 *   returns a user-friendly fallback message per FR-CHAT-002 instead of
 *   throwing.
 *
 * TODO(M3): real prompt engineering (product/order context injection,
 * streaming responses) and Datadog LLM Observability span wiring
 * (FR-CHAT-003).
 */
export async function generateReply(message: string, context: string): Promise<GenerateReplyResult> {
  if (env.bedrockMockMode || !bedrockClient) {
    return {
      reply: `[mock] Thanks for your message: "${message}". (Context: ${context.slice(0, 80)}...)`,
      tokensUsed: null,
    };
  }

  try {
    const command = new InvokeModelCommand({
      modelId: env.bedrockModelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 512,
        system: context,
        messages: [{ role: "user", content: message }],
      }),
    });

    const response = await bedrockClient.send(command);
    const payload = JSON.parse(new TextDecoder().decode(response.body)) as {
      content?: { text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const reply = payload.content?.[0]?.text ?? FALLBACK_MESSAGE;
    const tokensUsed =
      (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0) || null;

    return { reply, tokensUsed };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", message: "Bedrock invocation failed", error: String(err) }));
    return { reply: FALLBACK_MESSAGE, tokensUsed: null };
  }
}
