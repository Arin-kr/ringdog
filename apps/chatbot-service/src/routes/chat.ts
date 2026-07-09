import { Router } from "express";
import { prisma } from "@ringdog/db";

import { tryGetUserIdFromAuthHeader } from "../lib/jwt";
import { buildContext } from "../services/contextBuilder";
import { generateReply } from "../services/bedrockClient";

export const chatRouter: Router = Router();

/** POST /api/chat/messages — FR-CHAT-001/002 */
chatRouter.post("/messages", async (req, res, next) => {
  const { session_id: sessionId, message } = req.body as { session_id?: string; message?: string };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: { message: "message is required" } });
    return;
  }

  try {
    // Optional JWT: logged-in users get personalized context (FR-CHAT-001).
    const userId = tryGetUserIdFromAuthHeader(req.headers.authorization);

    const session = sessionId
      ? await prisma.chatSession.findUnique({ where: { id: sessionId } })
      : await prisma.chatSession.create({ data: { userId: userId ?? null } });

    if (!session) {
      res.status(404).json({ error: { message: "Chat session not found" } });
      return;
    }

    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: "user", content: message },
    });

    const context = await buildContext(userId ?? session.userId ?? undefined);
    const { reply, tokensUsed } = await generateReply(message, context);

    await prisma.chatMessage.create({
      data: { sessionId: session.id, role: "assistant", content: reply, tokensUsed },
    });

    res.status(200).json({ reply, session_id: session.id });
  } catch (err) {
    next(err);
  }
});

/** GET /api/chat/sessions/:session_id */
chatRouter.get("/sessions/:session_id", async (req, res, next) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: req.params.session_id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!session) {
      res.status(404).json({ error: { message: "Chat session not found" } });
      return;
    }

    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
});
