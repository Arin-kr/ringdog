// IMPORTANT: the tracer must be initialized before any other import so
// dd-trace can instrument Express/Prisma/Kafka etc. at require-time.
import "./tracer";

import { logger } from "@ringdog/shared";

import { createApp } from "./app";
import { env } from "./config/env";
import { runStartupTasks } from "./startup/bootstrap";

const app = createApp();

runStartupTasks();

app.listen(env.port, () => {
  logger.info(`backend-api listening on port ${env.port}`);
});
