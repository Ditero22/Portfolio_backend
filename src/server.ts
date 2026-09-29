import "dotenv/config";
import {
  closeRateLimitStore,
  connectRateLimitStore,
} from "./middleware/rate-limit.middleware.js";
import { validateProductionEnvironment } from "./security/origins.js";
import { logServerError } from "./security/safe-log.js";
import { resolveExpressApp } from "./runtime/express-app.js";

const PORT = Number(process.env.PORT ?? 5000);
const HOST = process.env.HOST?.trim() || "0.0.0.0";

async function startServer() {
  validateProductionEnvironment();
  if (!Number.isSafeInteger(PORT) || PORT < 0 || PORT > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535.");
  }
  const [appModule, analyticsModule] = await Promise.all([
    import("./app.js"),
    import("./modules/analytics/routes/analytics.routes.js"),
  ]);
  const app = resolveExpressApp(appModule);
  const { purgeExpiredVisitorLogs } = analyticsModule;
  await connectRateLimitStore();

  const server = app.listen(PORT, HOST);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  const listeningPort =
    address && typeof address === "object" ? address.port : PORT;
  console.log(`Portfolio backend listening on http://${HOST}:${listeningPort}.`);
  void purgeExpiredVisitorLogs().catch(() => {
    console.error("Could not run visitor log retention cleanup at startup.");
  });

  const retentionCleanup = setInterval(
    () => {
      void purgeExpiredVisitorLogs().catch(() => {
        console.error("Could not run visitor log retention cleanup.");
      });
    },
    24 * 60 * 60 * 1000,
  );
  retentionCleanup.unref();

  const shutdown = () => {
    server.close(() => {
      void closeRateLimitStore().finally(() => process.exit(0));
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return server;
}

void startServer().catch((error: unknown) => {
  logServerError("Could not start the portfolio backend.", error);
  process.exitCode = 1;
});
