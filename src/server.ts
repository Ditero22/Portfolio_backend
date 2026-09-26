import "dotenv/config";
import app from "./app.js";
import { purgeExpiredVisitorLogs } from "./modules/analytics/routes/analytics.routes.js";
import {
  closeRateLimitStore,
  connectRateLimitStore,
} from "./middleware/rate-limit.middleware.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectRateLimitStore();

  const server = app.listen(PORT, () => {
    console.log(`Portfolio backend listening on port ${PORT}.`);
  });

  const shutdown = () => {
    server.close(() => {
      void closeRateLimitStore().finally(() => process.exit(0));
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return server;
}

void startServer().catch(() => {
  console.error("Could not start the portfolio backend.");
  process.exitCode = 1;
});

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
