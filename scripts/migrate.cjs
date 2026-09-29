const { execFileSync } = require("node:child_process");
const path = require("node:path");

function migrationDatabaseUrl(databaseUrl, directUrl) {
  if (directUrl?.trim()) return directUrl.trim();
  if (!databaseUrl) return databaseUrl;
  const url = new URL(databaseUrl);
  if (url.hostname.endsWith(".neon.tech")) {
    url.hostname = url.hostname.replace("-pooler.", ".");
  }
  return url.href;
}

if (require.main === module) {
  require("dotenv").config({ quiet: true });
  try {
    const databaseUrl = migrationDatabaseUrl(
      process.env.DATABASE_URL,
      process.env.DIRECT_URL,
    );
    execFileSync(
      process.execPath,
      [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
      {
        cwd: path.resolve(__dirname, ".."),
        env: {
          ...process.env,
          ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
        },
        stdio: "inherit",
      },
    );
  } catch {
    console.error("Database migration failed. Check the Prisma diagnostics above.");
    process.exitCode = 1;
  }
}

module.exports = { migrationDatabaseUrl };
