// IMPORTANT: the tracer must be initialized before any other import.
import "./tracer";

import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", message: `chatbot-service listening on port ${env.port}` }));
});
