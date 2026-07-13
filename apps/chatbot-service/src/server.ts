// IMPORTANT: the tracer must be initialized before any other import.
import "./tracer";

import { logger } from "@ringdog/shared";

import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  logger.info(`chatbot-service listening on port ${env.port}`);
});
