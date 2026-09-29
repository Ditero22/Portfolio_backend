# dtro Portfolio API

Express 5 API for the dtro portfolio. It uses Prisma with PostgreSQL, Cloudflare R2 for uploaded media, and optional Redis for shared rate limits and PIN-recovery challenges.

## Local development

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and configure the database and private backend settings.
3. Generate the Prisma client with `npx prisma generate`.
4. Apply pending migrations to the configured database with `npm run db:migrate:deploy`.
5. Start the API with `npm run dev`.

The default address is `0.0.0.0:5000`, configurable through `HOST` and `PORT`. Check `http://127.0.0.1:5000/api/health` before troubleshooting individual API routes.

The frontend development server proxies `/api` to this API, so a phone can use the frontend's LAN address without making requests to the phone's own localhost. The backend includes localhost and this computer's LAN IPv4 origins on `DEV_FRONTEND_PORT` (default `5173`) in its development allowlist. Add other development origins to `CORS_ORIGINS` when needed. Production uses only the exact configured origins.

If another device cannot open the frontend LAN address, check that both devices are on the same network and that Windows Firewall permits the Node development server on private networks. The application does not modify firewall rules.

Never commit `.env` or put backend secrets in frontend `VITE_` variables. The environment variable names and safe placeholders are documented in `.env.example`.

For image uploads, `R2_PUBLIC_URL` must be a reachable public bucket or image Worker base URL. An image Worker must serve the `blog/`, `projects/`, and `certifications/` keys from the same bucket used by the API. A successful upload only confirms the object was stored; verify its returned public URL also returns the image. Keep private `resumes/` keys behind the existing authenticated resume routes.

The existing Cloudflare image Worker source is tracked in `cloudflare/images/worker.mjs`. It uses the existing `IMAGES` R2 binding, allows only those three image prefixes, and preserves GET/HEAD support and immutable caching.

## Security configuration

- In production, set `NODE_ENV=production`, use a unique `JWT_SECRET` with at least 32 random characters, and set `CORS_ORIGINS` to the exact HTTPS origin(s) serving the frontend. Production startup rejects missing or invalid critical settings.
- The production default trusts one reverse-proxy hop for client-IP detection. Render deployments should keep `TRUST_PROXY_HOPS=1`; local development can use `0`. Verify this value if the proxy chain changes, since it affects per-IP rate limits.
- The API uses bearer JWTs limited to five hours, and every protected route requires the `admin` role and the `admin` identity. The browser keeps that bearer token in local storage; this preserves the current sign-in behavior, but an XSS bug could expose the token.
- The in-memory rate-limit store is appropriate for one API process. Set `RATE_LIMIT_STORE=redis` and `REDIS_URL` before running multiple API instances so their limits and PIN-recovery challenges are shared.
- When changing the frontend host or backend API host, update backend `CORS_ORIGINS` and frontend `VITE_API_URL` together. The frontend build uses that API URL when generating its CSP.

## Checks and deployment

- `npm run build` compiles TypeScript.
- `npm test` builds the API and runs the backend tests.
- `npm start` runs `npm run db:migrate:deploy` before starting `dist/server.js`. Migrations use `DIRECT_URL` when configured, or the direct Neon hostname derived from `DATABASE_URL`, so Prisma's session advisory lock does not remain on a pooled connection. The API keeps its existing pooled connection.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for module boundaries, request flow, and database conventions.
