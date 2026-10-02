# SkillSwap feature audit

This audit reflects the current repository state as implemented in the codebase at the time of review. It distinguishes between features that are actually usable from the browser and features that only exist as partial backend scaffolding.

## Overall classification legend

- IMPLEMENTED: usable from the browser with a working backend path.
- PARTIAL: feature exists but is incomplete, missing key validation, missing UI states, or not fully wired to real end-to-end flows.
- BROKEN: code exists but runtime behavior fails or silently traps users in failure states.
- NOT IMPLEMENTED: no practical support in the app schema, backend, or UI.

## Feature audit

### 1. Authentication

- registration: PARTIAL
  - API route exists in [server/routes.ts](server/routes.ts).
  - Validation is present and backend hashing uses bcrypt.
  - The real issue is the app can still return 500 when the database is not initialized or is missing required tables.
- login: PARTIAL
  - Backend route exists and compares hashed password values.
  - Client-side feedback is still raw in some flows without consistent user-friendly messaging.
- logout: PARTIAL
  - Backend route exists, but UI and global error handling are not consistently standardized.
- sessions: PARTIAL
  - Express session middleware is configured with Postgres session storage.
  - Session table initialization is not fully guaranteed by the app at startup.
- password validation: PARTIAL
  - Registration schema checks length, but there is no centralized password policy or reset flow in the app.
- password reset: NOT IMPLEMENTED
- email verification: NOT IMPLEMENTED

### 2. Profiles

- profile creation: PARTIAL
  - Registration creates a basic user record with profile fields.
- profile editing: PARTIAL
  - Profile update route exists, but UI polish and validation consistency are uneven.
- bio: NOT IMPLEMENTED
- offered skills: IMPLEMENTED
  - Stored as an array and used in discovery and matching.
- wanted skills: IMPLEMENTED
- availability: IMPLEMENTED
- location: IMPLEMENTED
- profile visibility: PARTIAL
  - `isPublic` is present in schema and API.

### 3. Discovery

- user discovery: IMPLEMENTED
  - Public list endpoint and search/filter logic exist.
- search: IMPLEMENTED
- filtering: IMPLEMENTED
- pagination: IMPLEMENTED
- empty states: PARTIAL
  - Search and list pages appear to have some UI states, but they are not consistently applied across all async views.

### 4. Matching

- matching algorithm: IMPLEMENTED
  - The logic in [server/matching.ts](server/matching.ts) compares offered/wanted skills, availability overlap, location, and rating.
- matching score: IMPLEMENTED
- matching explanation: IMPLEMENTED
- realistic edge cases: PARTIAL
  - The algorithm is functional but simple and does not cover deeper compatibility semantics or fairness policies.

### 5. Swap lifecycle

- create and list requests: IMPLEMENTED
  - Authenticated users can request public learners, and profiles check the existing relationship before enabling submission.
  - Self-requests and active duplicate pairs are rejected by the API and protected by a database constraint.
- accept and reject: IMPLEMENTED
  - Only the recipient can accept or reject a pending request.
- cancel: IMPLEMENTED
  - Only the sender can cancel a pending request.
- request states: IMPLEMENTED
  - Pending requests can transition to accepted, rejected, or cancelled; terminal requests cannot be changed.
- profile and Requests UI: IMPLEMENTED
  - Public profiles, Matches, Browse, and Requests connect to the existing request API and show relationship state.
- completion: NOT IMPLEMENTED
- chat handoff: NOT IMPLEMENTED
  - Accepted requests are shown as accepted; there is no conversation or scheduling workflow to continue the exchange.

### 6. Notifications

- backend: NOT IMPLEMENTED
- frontend: NOT IMPLEMENTED
  - The Notifications page is a placeholder and explicitly says notifications are not connected.
- request event delivery: NOT IMPLEMENTED
  - Sending, accepting, or rejecting a request does not create or deliver a notification.
- unread count: NOT IMPLEMENTED
- mark read: NOT IMPLEMENTED
- notification types: NOT IMPLEMENTED

### 7. Reviews/reputation

- authorization: NOT IMPLEMENTED
- completed exchange requirement: NOT IMPLEMENTED
- duplicate reviews: NOT IMPLEMENTED
- UI: NOT IMPLEMENTED
- rating display: PARTIAL
  - The profile model has a `rating` field, but there is no real review workflow or rating distribution logic.

### 8. Chat

- conversations: NOT IMPLEMENTED
- messages: NOT IMPLEMENTED
- pagination: NOT IMPLEMENTED
- unread counts: NOT IMPLEMENTED
- read receipts: NOT IMPLEMENTED
- typing indicators: NOT IMPLEMENTED
- presence: NOT IMPLEMENTED
- WebSocket authentication: NOT IMPLEMENTED
- membership authorization: NOT IMPLEMENTED
- reconnect: NOT IMPLEMENTED
- frontend UI: PARTIAL / incomplete
- error/loading/empty states: NOT IMPLEMENTED

### 9. Security

- password hashing: IMPLEMENTED
  - bcrypt is used for registration and login.
- sessions: PARTIAL
- CSRF: PARTIAL / not clearly implemented at app layer
- rate limiting: NOT IMPLEMENTED
- security headers: PARTIAL
- token hashing: NOT IMPLEMENTED
- authorization: PARTIAL
- input validation: IMPLEMENTED for core schema checks
- abuse protection: NOT IMPLEMENTED

### 10. UX

- loading states: PARTIAL
- error states: PARTIAL
- empty states: PARTIAL
- form validation: PARTIAL
- responsive layout: PARTIAL
- accessibility: PARTIAL
- readable error messages: BROKEN in current form because raw backend JSON leaks to users
- consistent UI: PARTIAL

### 11. Production readiness

- environment configuration: PARTIAL
- migrations: PARTIAL
  - migration SQL exists, but the app does not guarantee schema bootstrap at startup.
- logging: PARTIAL
- deployment: PARTIAL
- email provider: NOT IMPLEMENTED
- health checks: NOT IMPLEMENTED
- error handling: PARTIAL

### 12. Missing major features

- admin: NOT IMPLEMENTED
- moderation: NOT IMPLEMENTED
- scheduling: NOT IMPLEMENTED
- AI matching: NOT IMPLEMENTED
- analytics: NOT IMPLEMENTED
- favorites/bookmarks: NOT IMPLEMENTED
- blocking/reporting: NOT IMPLEMENTED

## A. Completed features

- basic user registration schema and storage path
- bcrypt password hashing
- profile fields for name, username, email, availability, location, and public visibility
- core public-user discovery endpoint
- matching algorithm with mutual-skill ranking
- swap request lifecycle, public-profile initiation, and participant-aware Requests dashboard

## B. Partial features

- authentication flow and session setup
- profile editing workflow
- discovery and filtering UX
- notification and chat follow-through after request acceptance
- general UX and accessibility polish
- security hardening and deployment readiness

## C. Broken features

- registration error UX currently leaks raw JSON message strings and fails to show consistent user-friendly messaging
- app can fail with a 500 when the database schema has not been initialized yet
- error handling is inconsistent across pages and auth flows

## D. Missing features

- password reset
- email verification
- notifications
- reviews and reputation
- chat and messaging
- admin and moderation
- scheduling, analytics, bookmarking, and reporting

## E. Recommended implementation order

1. Stabilize database bootstrap and auth error handling
2. Standardize frontend API error UX and accessible alert states
3. Add consistent loading/empty/error states across pages
4. Improve profile and discovery validation
5. Ship demo data and a safe seeded local environment
6. Implement notifications and chat follow-through for accepted requests
7. Add review, chat, and moderation features in later phases
8. Add production monitoring, health checks, and deployment hardening

## Key findings

The most critical issue at the moment is not that user registration is fundamentally impossible, but that the app can throw a generic server 500 when the backend database schema is missing or the app is not bootstrapped correctly. The UX layer also needs a consistent sanitization pattern so 500s and validation failures become clear user-friendly messages rather than raw JSON.
