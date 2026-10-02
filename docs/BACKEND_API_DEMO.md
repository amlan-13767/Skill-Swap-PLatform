# SkillSwap Backend API Demo

This interview demo exercises SkillSwap over HTTP only. It uses Node's built-in `fetch`, the Express API routes, session authentication, validation, and the configured PostgreSQL database. It does not start an Express server or use the frontend/browser.

## Run the Demo

Use two terminals from the project root.

Terminal 1:

```powershell
npm run dev
```

Terminal 2:

```powershell
npm run demo:backend
```

The default API base URL is `http://localhost:5000`. To use another local port:

```powershell
$env:SKILLSWAP_API_URL="http://localhost:5001"
npm run demo:backend
```

The backend must already be running. If it is unavailable, the script prints the `npm run dev` instruction and exits without a stack trace.

## Authentication And Session

The script logs in through `POST /api/auth/login`. It captures the returned `Set-Cookie` header, retains only the cookie pair, and sends it with subsequent authenticated requests. It never prints passwords, cookies, session IDs, or server secrets. At the end, it makes a best-effort call to `POST /api/auth/logout`.

The default seeded account is `demo.riya@skillswap.local`. The demo uses the seed script's configured password (`DEMO_PASSWORD`, or its local default). Credentials can be overridden without editing the script:

```powershell
$env:SKILLSWAP_DEMO_EMAIL="demo.riya@skillswap.local"
$env:SKILLSWAP_DEMO_PASSWORD="your-local-demo-password"
npm run demo:backend
```

Secrets entered in the environment are not printed. If login returns invalid credentials or the demo account is absent, seed local data with:

```powershell
npm run seed:demo
```

## Demonstrated APIs

The script checks these existing routes and their current response contracts:

- `GET /api/users/public?limit=1` for backend connectivity
- `POST /api/auth/login` and `GET /api/auth/me` for session authentication
- `GET /api/users/me`, `GET /api/users/public`, and `GET /api/users/:id` for profiles
- `GET /api/matches` for server-generated match scores/reasons
- `GET /api/swap-requests` and, only when no active request exists, `POST /api/swap-requests`
- `GET /api/notifications` for notification records and a read/unread count derived from their `read` field
- `GET /api/chat/conversations`, `POST /api/chat/conversations` for an accepted pair when needed, and `GET /api/chat/conversations/:id/messages`
- `GET /api/users/:id/reviews`, `GET /api/users/:id`, and, only for an eligible accepted exchange without an existing review, `POST /api/users/:id/reviews`
- An unauthenticated `GET /api/notifications` to verify protected access returns 401/403

The demo does not send chat messages by default. Opening a conversation uses the existing messages route, which advances that participant's read timestamp. If a seeded accepted swap has no conversation yet, the script may create one through the authorized conversation endpoint; that endpoint is idempotent for the accepted user pair. It creates at most one swap request when there is no active request, and at most one review when the authenticated demo user is eligible and no duplicate exists.

## Relationship To The Frontend

The terminal script follows the same HTTP routes and session-cookie behavior as the React application, but does not import frontend code or call storage/database functions. Match scores are read from the matching API response rather than calculated by the script. Authorization is exercised through protected endpoints.

The final summary reports passed, skipped, and failed workflow steps. Empty result sets are harmless; actual API failures are reported with the HTTP status and endpoint, and cause a non-zero exit code.
