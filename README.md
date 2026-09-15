# SkillSwap

SkillSwap is a peer-to-peer learning platform where users exchange skills. A user can describe the skills they offer, the skills they want to learn, their availability, and their visibility preferences. The application helps users discover compatible learning partners and manage skill-swap requests.

This repository is an interview-oriented full-stack application built from an earlier prototype. The current implementation uses PostgreSQL persistence, server-side sessions, password hashing, authorization rules, server-side discovery, an explainable matching engine, and a request-management workflow.

## Current Status

Implemented and validated:

- React/Vite frontend
- Express/TypeScript backend
- PostgreSQL persistence through Drizzle ORM
- HTTP-only cookie sessions
- bcrypt password hashing
- Registration, login, logout, and current-user lookup
- Public/private profiles
- Profile editing
- Server-side search, filtering, sorting, and pagination
- Skill normalization and common aliases
- Compatibility matching with explanations
- Sent and received swap-request management
- Accept, reject, and cancel request actions
- Ownership and state-transition authorization
- Duplicate and self-request prevention
- TypeScript checking
- Matching unit tests
- Production build

Not yet implemented:

- Persistent in-app notifications
- Ratings and reviews
- Completed-swap state and review eligibility
- Full API integration-test coverage
- End-to-end browser tests
- Docker or cloud deployment configuration

## Features

### Authentication

- Register with username, name, email, password, skills, availability, and visibility.
- Log in with email and password.
- Passwords are hashed with `bcryptjs` and are never returned to the client.
- Authentication is stored in a server-side Express session.
- The browser receives an HTTP-only `connect.sid` cookie.
- The frontend checks the current session through `GET /api/auth/me`.
- Logout destroys the server session and clears the cookie.

### Profiles

Users can create and edit:

- Name
- Email
- Location
- Avatar URL
- Skills offered
- Skills wanted
- Availability
- Public/private visibility

Users cannot directly modify:

- User ID
- Password hash
- Rating
- Request ownership fields

Profile updates are handled by `PATCH /api/users/me` and are protected by authentication middleware.

### Discovery

The discovery page supports server-side:

- Name and username search
- Offered-skill filtering
- Wanted-skill filtering
- Availability filtering
- Location filtering
- Sorting by name, rating, or newest
- Pagination

The backend returns a paginated response instead of sending the entire user table to the browser.

Private users are excluded from public discovery. When authenticated, the current user is also excluded from discovery results.

### Skill normalization

Skill input is normalized before storage and comparison:

- Leading and trailing whitespace is removed.
- Repeated whitespace is normalized.
- Values are compared case-insensitively.
- Duplicate skills are removed.
- Common aliases are supported:
  - `js` -> `javascript`
  - `ts` -> `typescript`
  - `reactjs` -> `react`
  - `nodejs` -> `node.js`

The implementation is intentionally conservative and does not merge arbitrary unrelated skills.

### Matching

Authenticated users can open `/matches` or call `GET /api/matches` to receive ranked compatible users.

The matching service considers:

- Skills the current user wants that the candidate offers
- Skills the current user offers that the candidate wants
- Availability overlap
- Exact location match
- Candidate rating

Every match includes:

- Candidate profile
- Compatibility score from 0 to 100
- Matching skills
- Human-readable reasons

A candidate must have at least one mutual skill overlap to appear as a match. Location or availability alone cannot create a match.

### Swap requests

The request lifecycle is:

```text
User A discovers User B
        |
        v
User A sends a request
        |
        v
pending
   /       \
accept    reject
  |          |
accepted   rejected

The sender may cancel while the request is pending.
```

The request dashboard at `/requests` separates:

- Received requests
- Sent requests

Supported actions:

- Recipient accepts a pending request.
- Recipient rejects a pending request.
- Sender cancels a pending request.
- No user can modify another user's request.
- Accepted, rejected, and cancelled requests cannot transition again.
- Self-requests are rejected.
- Duplicate active requests are rejected in both directions.

## Architecture

```mermaid
flowchart TD
    Browser[React + Vite browser app]
    Router[Wouter routes]
    Query[TanStack React Query]
    API[Express REST API]
    Auth[Express session middleware]
    Services[Validation and matching services]
    Storage[DatabaseStorage repository]
    Drizzle[Drizzle ORM]
    PostgreSQL[(PostgreSQL)]
    SessionTable[(PostgreSQL session table)]

    Browser --> Router
    Router --> Query
    Query --> API
    API --> Auth
    Auth --> Services
    Services --> Storage
    Storage --> Drizzle
    Drizzle --> PostgreSQL
    Auth --> SessionTable
```

### Request flow

1. The browser sends a request with `credentials: "include"`.
2. Express session middleware reads the HTTP-only session cookie.
3. `requireAuth` loads the authenticated user and attaches it to `req.user`.
4. Routes validate request input with Zod.
5. Business rules are checked before mutations.
6. `DatabaseStorage` executes Drizzle queries against PostgreSQL.
7. Routes return explicit safe response objects.
8. React Query updates or invalidates relevant client queries.

## Technology Stack

### Frontend

- React 18
- Vite
- TypeScript and JSX
- Wouter
- TanStack React Query
- Tailwind CSS
- Radix UI primitives
- Lucide icons
- React Hook Form dependencies are available for future form expansion

### Backend

- Node.js
- Express
- TypeScript
- Express Session
- `connect-pg-simple`
- `bcryptjs`
- Zod

### Database

- PostgreSQL
- Drizzle ORM
- Drizzle Kit
- `pg` connection pool
- SQL migration in [migrations/0000_initial.sql](migrations/0000_initial.sql)

## Project Structure

```text
client/
  index.html
  src/
    App.tsx                 Application routes and providers
    main.tsx                React entry point
    index.css               Tailwind and application styles
    components/             Shared UI and legacy reusable components
    hooks/                  Client hooks such as toast handling
    lib/
      auth.tsx              Shared server-session auth provider
      queryClient.ts        API and React Query helpers
    pages/
      home.jsx              Discovery, filters, pagination, request modal
      login.jsx             Login form
      signup.jsx            Registration and initial profile form
      profile.jsx           Authenticated profile editor
      requests.jsx          Sent and received request dashboard
      matches.jsx           Ranked compatibility results

server/
  index.ts                  Express application bootstrap
  routes.ts                 Auth, profile, discovery, matches, and request routes
  auth.ts                   Required and optional authentication middleware
  db.ts                     PostgreSQL pool and Drizzle database instance
  storage.ts                Database repository and public-user mapping
  matching.ts               Explainable compatibility ranking service
  matching.test.ts          Matching unit tests
  utils.ts                  Skill and email normalization helpers
  vite.ts                   Development Vite integration and production static serving

shared/
  schema.ts                 Drizzle tables, enum, constraints, and inferred types

migrations/
  0000_initial.sql          PostgreSQL schema migration

.env.example                Required environment variable template
```

## Database Model

### Users

The `users` table contains:

- `id`: serial primary key
- `username`: unique public handle
- `password_hash`: bcrypt password hash
- `name`: display name
- `email`: unique email address
- `location`: optional location
- `avatar`: optional avatar URL
- `skills_offered`: PostgreSQL text array
- `skills_wanted`: PostgreSQL text array
- `availability`: PostgreSQL text array
- `rating`: integer on the existing 0-50 display scale
- `is_public`: discovery visibility flag
- `created_at`: creation timestamp
- `updated_at`: last-update timestamp

### Swap requests

The `swap_requests` table contains:

- `id`: serial primary key
- `from_user_id`: sender foreign key
- `to_user_id`: recipient foreign key
- `status`: PostgreSQL enum
- `message`: optional request message
- `created_at`: creation timestamp
- `updated_at`: last-update timestamp

Allowed statuses:

```text
pending
accepted
rejected
cancelled
```

Database constraints include:

- Non-null request participants
- Foreign keys with cascade deletion
- A check preventing self-requests
- An index for request participants
- An index for request status
- A partial unique index preventing duplicate pending or accepted requests for the same direction

The service layer additionally prevents duplicate active requests in either direction.

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Validate input, hash password, create user, start session | No |
| `POST` | `/api/auth/login` | Verify credentials and start session | No |
| `POST` | `/api/auth/logout` | Destroy session and clear cookie | Optional |
| `GET` | `/api/auth/me` | Return the authenticated user | Required |

### Users and profiles

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/users/public` | Search and paginate public users | Optional |
| `GET` | `/api/users/me` | Return the current user's profile | Required |
| `PATCH` | `/api/users/me` | Update the current user's editable profile fields | Required |
| `GET` | `/api/users/:id` | Return a public user or the owner's private profile | Optional |

Discovery query parameters:

```text
search
skill
offeredSkill
wantedSkill
availability
location
sort=name|rating|newest
page
limit
```

Example:

```text
GET /api/users/public?offeredSkill=python&sort=rating&page=1&limit=12
```

Example response:

```json
{
  "users": [],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 0,
    "totalPages": 0
  }
}
```

### Matches

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/matches` | Return ranked compatible public users | Required |

Example response shape:

```json
{
  "matches": [
    {
      "user": {
        "id": 2,
        "name": "Example User",
        "skillsOffered": ["react"],
        "skillsWanted": ["python"]
      },
      "compatibilityScore": 97,
      "matchingSkills": ["python", "react"],
      "reasons": [
        "They offer a skill you want",
        "You offer a skill they want",
        "Availability overlaps"
      ]
    }
  ]
}
```

### Swap requests

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/swap-requests` | Return requests where the current user is sender or recipient | Required |
| `POST` | `/api/swap-requests` | Create a pending request | Required |
| `GET` | `/api/swap-requests/user/:userId` | Compatibility endpoint for the current user's request list | Required |
| `PATCH` | `/api/swap-requests/:id/status` | Accept, reject, or cancel according to ownership rules | Required |
| `DELETE` | `/api/swap-requests/:id` | Cancel a pending request owned by the sender | Required |

The server derives the sender from the authenticated session. A client cannot choose another user as `fromUserId`.

## Security Architecture

### Password security

- Passwords are validated for length at the API boundary.
- Passwords are hashed using bcrypt with a work factor of 12.
- Only `passwordHash` is stored in the database.
- Password hashes are removed before user objects are serialized.

### Session security

- Sessions are stored in PostgreSQL through `connect-pg-simple`.
- Session cookies are HTTP-only.
- Cookies use `sameSite: "lax"`.
- Cookies are marked secure in production.
- Session lifetime is seven days.
- The application requires `SESSION_SECRET` at startup.

### Authorization

- `requireAuth` rejects unauthenticated protected requests with HTTP 401.
- Profile updates operate only on `req.user.id`.
- Request reads are restricted to the current user's sent or received requests.
- Recipients alone can accept or reject requests.
- Senders alone can cancel pending requests.
- Non-pending requests cannot transition.

### Response privacy

The backend does not directly serialize database user rows for public responses.

Public user responses exclude:

- Password hash
- Email address
- Session data
- Internal database details

Authenticated user responses may include the user's own email, but never the password hash.

## Running Locally

### Prerequisites

- Node.js 20 or newer recommended
- npm
- PostgreSQL 14 or newer recommended

### Environment variables

Copy the template:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/skillswap
SESSION_SECRET=use-a-long-random-secret
NODE_ENV=development
DATABASE_POOL_SIZE=10
```

Do not commit `.env` or real credentials.

### Install dependencies

```bash
npm install
```

### Prepare the database

The project provides a SQL migration at [migrations/0000_initial.sql](migrations/0000_initial.sql).

The Drizzle push command is also available:

```bash
npm run db:push
```

The application will refuse to start if `DATABASE_URL` or `SESSION_SECRET` is missing.

### Start development mode

```bash
npm run dev
```

The development server serves the API and Vite client at:

```text
http://localhost:5000
```

### Production build and start

```bash
npm run build
npm start
```

The production build creates the client bundle in `dist/public` and the bundled server at `dist/index.js`.

## Development Commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the development server |
| `npm run check` | Run TypeScript checking |
| `npm test` | Run TypeScript unit tests |
| `npm run build` | Build the client and server |
| `npm start` | Start the production build |
| `npm run db:push` | Push the Drizzle schema to PostgreSQL |

## Testing

The repository currently contains focused unit tests for the matching engine in [server/matching.test.ts](server/matching.test.ts).

Current verified result:

```text
2 tests passed
0 tests failed
```

The tests cover:

- Mutual skill compatibility ranking
- Candidate ordering
- Exclusion of candidates without skill compatibility

Recommended next testing work:

- Registration and duplicate-account integration tests
- Password hashing and login tests
- Session and logout tests
- Profile ownership tests
- Private-profile visibility tests
- Request authorization tests
- Duplicate and self-request tests
- Request state-transition tests
- PostgreSQL repository tests
- Browser end-to-end tests

## Validation Results

The current source tree has passed:

- `npm run check`
- `npm test`
- `npm run build`

The build reports an outdated Browserslist database warning. This does not currently block compilation.

Full API integration testing requires a reachable PostgreSQL database configured through `DATABASE_URL`. The local static checks and matching tests do not prove that a configured production database is reachable.

## Known Limitations and Next Steps

### Notifications

The request system does not yet persist notifications. A future `notifications` table should support:

- Recipient user ID
- Notification type
- Message
- Related request ID
- Read/unread state
- Creation timestamp

### Ratings and reviews

The current rating field is displayed but there is no review workflow. A production implementation should add a `reviews` table and enforce:

- Ratings from 1 to 5
- One review per reviewer per completed swap
- Reviewer participation in the swap
- No self-reviews
- Review eligibility only after a completed interaction

### Completed swaps

The current request state machine ends at `accepted`, `rejected`, or `cancelled`. A future completion flow should deliberately add a `completed` status and update transition and review rules consistently.

### Production hardening

Before deployment, consider adding:

- Rate limiting on authentication and request creation
- Security headers such as Helmet
- Explicit CORS configuration if frontend and API use different origins
- CSRF protection if the deployment topology requires it
- Structured logging and monitoring
- Health and readiness endpoints
- Docker and CI/CD configuration
- Dependency vulnerability remediation

## Interview Talking Points

### Product explanation

> SkillSwap is a peer-to-peer learning platform. Users publish the skills they can teach and the skills they want to learn. The platform filters public profiles, ranks mutually compatible partners, and provides an authorized request workflow for starting a skill exchange.

### Architecture explanation

> The React/Vite client uses TanStack Query to communicate with an Express REST API. Express validates requests with Zod and authenticates users through PostgreSQL-backed HTTP-only sessions. Business operations use a database repository implemented with Drizzle ORM, while matching is isolated in a pure service that can be tested independently.

### Security explanation

> The server is the source of truth for identity. Passwords are bcrypt-hashed, sessions are stored server-side, protected routes use authentication middleware, and resource mutations verify ownership. Public DTOs are constructed explicitly so password hashes and private email data are never exposed.

### Matching explanation

> Matching scores mutual skill exchange more heavily than one-way interest. The algorithm awards points for skills the candidate offers that the current user wants, skills the current user offers that the candidate wants, availability overlap, location compatibility, and rating. Matches include reasons so the score is explainable to the user.

### Resume-compatible description

A truthful current description is:

> Built a full-stack peer-to-peer skill exchange platform using React, Express, PostgreSQL, Drizzle ORM, and server-side sessions. Implemented secure authentication, editable profiles, server-side skill discovery, explainable compatibility matching, and authorized swap-request workflows with accept, reject, cancel, duplicate-prevention, and self-request validation.

Do not claim a measured “60% improvement” unless an experiment or production metric exists to support it.
