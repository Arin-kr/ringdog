import express, { Express, NextFunction, Request, Response } from "express";

import { chatRouter } from "./routes/chat";

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/chat", chatRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ level: "error", message: err.message, path: req.path }));
    res.status(500).json({ error: { message: "Internal server error" } });
  });

  return app;
}
