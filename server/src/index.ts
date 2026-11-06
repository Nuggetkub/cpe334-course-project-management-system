import { HOST, PORT } from "./config.js";
import { createApp } from "./app.js";
import { disconnectPrisma } from "./prisma.js";

const server = createApp().listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});

// Cloud Run sends SIGTERM before stopping an instance: finish in-flight
// requests, release DB connections, then exit.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    void disconnectPrisma().finally(() => process.exit(0));
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
