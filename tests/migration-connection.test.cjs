const { test } = require("node:test");
const assert = require("node:assert/strict");
const { migrationDatabaseUrl } = require("../scripts/migrate.cjs");

test("Neon migrations use a direct connection without changing runtime settings", () => {
  const pooled =
    "postgresql://user:encoded%40password@ep-test-pooler.c-4.aws.neon.tech/db?sslmode=require";
  const direct = new URL(migrationDatabaseUrl(pooled));
  assert.equal(direct.hostname, "ep-test.c-4.aws.neon.tech");
  assert.equal(direct.password, "encoded%40password");
  assert.equal(direct.searchParams.get("sslmode"), "require");
  assert.equal(new URL(pooled).hostname, "ep-test-pooler.c-4.aws.neon.tech");
});

test("migration connections preserve other providers and honor an explicit DIRECT_URL", () => {
  const database = "postgresql://user:password@localhost:5432/db";
  assert.equal(migrationDatabaseUrl(database), database);
  assert.equal(
    migrationDatabaseUrl(database, " postgresql://user:password@direct.example/db "),
    "postgresql://user:password@direct.example/db",
  );
  assert.equal(migrationDatabaseUrl(undefined), undefined);
});
