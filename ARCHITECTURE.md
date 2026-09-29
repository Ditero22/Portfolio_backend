# Backend architecture

## Request flow

`src/server.ts` loads the environment, connects the configured rate-limit store, starts the Express server, and schedules visitor-log retention cleanup. `src/app.ts` configures proxy trust, CORS, API and sensitive-route rate limits, JSON parsing, health checks, feature routers, and a final safe error response. Keep process lifecycle work in `server.ts` and request middleware/router wiring in `app.ts`.

## Module boundaries

`src/modules/` is organized by API feature: `auth`, `blog`, `project`, `experience`, `analytics`, `portfolioContent`, `settings`, and `resume`. Modules use `routes/` to register endpoints, `controllers/` for request/response handling, `services/` for reusable business and database operations, and `validation/` for the project request parser where those boundaries help. `storage/` is a shared adapter used by uploads and storage reporting. Feature code can use shared `src/database/` clients and `src/middleware/` policies; shared infrastructure should not import feature modules. `src/types/` contains a narrow ambient declaration for the `cors` API used by the app.

The project intentionally uses a modest modular architecture rather than identical layers in every feature. Auth and blog split route registration, HTTP controllers, and service/database work. The project module now follows the same pattern, with its substantial input validation separated from request handling and Prisma operations. Simpler CRUD modules keep their validation, Prisma queries, and response handling together in a feature route module. Extract a controller or service when a distinct responsibility can be reused or independently tested; avoid forwarding-only layers.

Routes own their externally visible paths, authentication middleware, HTTP status codes, and response shapes. Keep `requireAuth` on every admin mutation/read that is private. Validate untrusted request bodies at the API boundary. Do not change existing endpoint contracts as part of refactors.

## Data and integrations

`src/database/prisma.ts` creates the shared Prisma client. Modules currently access it directly for feature queries. `prisma/schema.prisma` defines the PostgreSQL model and `prisma/migrations/` records schema evolution. Treat migrations as append-only after they have been applied; use a new migration for future schema changes. Seed/sample content lives under `prisma/` and should only run through its explicit seed command.

`src/database/redis.ts` is optional infrastructure selected by `RATE_LIMIT_STORE`. The API uses the in-memory limiter store for one process and Redis when shared state is configured. `src/modules/storage/r2-upload.service.ts` owns the R2 client and object operations. Google Identity verification is contained in the auth module. Keep secrets in backend environment variables; `.env.example` lists the expected names without real values.

## Tests and changes

`tests/*.test.cjs` exercise API behavior with the test harness and test-only configuration. `npm test` compiles the TypeScript API first. Preserve endpoint behavior, auth rules, retention policy, existing database rows, and migration history during cleanups. Add validation or tests at the module boundary when behavior changes; do not introduce a repository layer unless it meaningfully isolates database behavior.
