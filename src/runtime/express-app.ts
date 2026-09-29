import type { Express } from "express";

function isExpressApp(value: unknown): value is Express {
  return (
    typeof value === "function" &&
    "listen" in value &&
    typeof value.listen === "function"
  );
}

export function resolveExpressApp(module: { default: unknown }): Express {
  const exported = module.default;
  if (isExpressApp(exported)) return exported;
  if (
    typeof exported === "object" &&
    exported !== null &&
    "default" in exported &&
    isExpressApp(exported.default)
  ) {
    return exported.default;
  }
  throw new Error("The backend module did not export an Express application.");
}
