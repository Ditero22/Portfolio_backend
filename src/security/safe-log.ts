export function logServerError(context: string, error: unknown) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

  console.error(context, {
    name,
    ...(error instanceof Error && name === "RuntimeConfigurationError"
      ? { message: error.message }
      : {}),
    ...(typeof code === "string" && /^[A-Z0-9_-]{1,32}$/i.test(code)
      ? { code }
      : {}),
  });
}
