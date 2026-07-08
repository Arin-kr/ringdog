import express, { Express } from "express";

import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { productsRouter } from "./routes/products";
import { cartRouter } from "./routes/cart";
import { ordersRouter } from "./routes/orders";

export function createApp(): Express {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/orders", ordersRouter);

  app.use(errorHandler);

  return app;
}
