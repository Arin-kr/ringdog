// IMPORTANT: the tracer must be initialized before any other import so
// dd-trace can instrument Express/Prisma/Kafka etc. at require-time.
import "./tracer";

import { createApp } from "./app";
import { env } from "./config/env";
import { runStartupTasks } from "./startup/bootstrap";

const app = createApp();

runStartupTasks();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", message: `backend-api listening on port ${env.port}` }));
});
