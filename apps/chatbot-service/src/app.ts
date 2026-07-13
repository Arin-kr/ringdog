import express, { Express, NextFunction, Request, Response } from "express";
import { logger } from "@ringdog/shared";

import { chatRouter } from "./routes/chat";

function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}

export function createApp(): Express {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/chat", chatRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error(err.message, { path: req.path });
    res.status(500).json({ error: { message: "Internal server error" } });
  });

  return app;
}
