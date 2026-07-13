// IMPORTANT: the tracer must be initialized before any other import.
import "./tracer";

import http from "http";

import { logger } from "@ringdog/shared";

import { env } from "./config/env";
import { startOrderPlacedConsumer } from "./consumers/orderPlacedConsumer";

// Tiny health server for k8s liveness/readiness probes.
const healthServer = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

healthServer.listen(env.healthPort, () => {
  logger.info(`order-consumer health server on port ${env.healthPort}`);
});

startOrderPlacedConsumer().catch((err) => {
  logger.error("Failed to start order consumer", { error: String(err) });
  process.exit(1);
});
