import { networkInterfaces } from "node:os";

const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigurationError";
  }
}

export function isConfiguredOriginAllowed(origin: string | undefined) {
  return Boolean(origin && getAllowedBrowserOrigins().includes(origin));
}

export function getAllowedBrowserOrigins() {
  if (process.env.NODE_ENV === "production") return configuredOrigins;

  const port = Number(process.env.DEV_FRONTEND_PORT ?? 5173);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new RuntimeConfigurationError(
      "DEV_FRONTEND_PORT must be a valid TCP port.",
    );
  }
  const hosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal)
        hosts.add(address.address);
    }
  }
  return [
    ...new Set([
      ...configuredOrigins,
      ...Array.from(hosts, (host) => `http://${host}:${port}`),
    ]),
  ];
}

export function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  const missing = [
    "DATABASE_URL",
    "JWT_SECRET",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ].filter((name) => !process.env[name]?.trim());

  const secret = process.env.JWT_SECRET?.trim() ?? "";
  if (secret.length > 0 && secret.length < 32) {
    throw new RuntimeConfigurationError(
      "JWT_SECRET must contain at least 32 characters in production.",
    );
  }

  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
  if (!Number.isSafeInteger(proxyHops) || proxyHops < 1) {
    throw new RuntimeConfigurationError(
      "TRUST_PROXY_HOPS must be at least 1 in production behind Render's proxy.",
    );
  }

  if (configuredOrigins.length === 0) missing.push("CORS_ORIGINS");
  for (const origin of configuredOrigins) {
    try {
      const parsed = new URL(origin);
      if (
        parsed.origin !== origin ||
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error();
      }
    } catch {
      throw new RuntimeConfigurationError(
        "CORS_ORIGINS must contain HTTPS origins without paths.",
      );
    }
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
        throw new Error();
      }
    } catch {
      throw new RuntimeConfigurationError(
        "DATABASE_URL must be a valid PostgreSQL connection URL.",
      );
    }
  }

  const publicUrl = process.env.R2_PUBLIC_URL?.trim();
  if (publicUrl) {
    try {
      if (new URL(publicUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new RuntimeConfigurationError(
        "R2_PUBLIC_URL must be a valid HTTPS URL.",
      );
    }
  }

  if (missing.length > 0) {
    throw new RuntimeConfigurationError(
      `Missing required production configuration: ${missing.join(", ")}.`,
    );
  }
}
