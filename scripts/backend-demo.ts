import "dotenv/config";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
type StepState = "passed" | "skipped" | "failed";

interface ApiResult {
  status: number;
  ok: boolean;
  body: JsonValue;
}

interface User {
  id: number;
  name: string;
  email?: string;
  username?: string;
  skillsOffered?: string[] | null;
  skillsWanted?: string[] | null;
  availability?: string[];
}

interface SwapRequest {
  id: number;
  fromUserId: number;
  toUserId: number;
  status: string;
  message?: string | null;
}

interface Match {
  user: User;
  compatibilityScore: number;
  matchingSkills: string[];
}

interface Notification {
  id: number;
  read: boolean;
  title: string;
}

interface Conversation {
  id: number;
  participant: User | null;
}

interface Review {
  id: number;
  reviewerUserId: number;
  reviewedUserId: number;
  swapRequestId: number;
  rating: number;
  comment?: string | null;
}

interface RatingSummary {
  average: number;
  count: number;
}

class BackendUnavailableError extends Error {}

class ApiFailure extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

class ApiClient {
  private sessionCookie: string | undefined;

  constructor(private readonly baseUrl: string) {}

  get hasSession() {
    return Boolean(this.sessionCookie);
  }

  async request(path: string, options: { method?: string; body?: unknown } = {}): Promise<ApiResult> {
    const method = options.method ?? "GET";
    const headers = new Headers({ accept: "application/json" });
    if (options.body !== undefined) headers.set("content-type", "application/json");
    if (this.sessionCookie) headers.set("cookie", this.sessionCookie);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network request failed";
      throw new BackendUnavailableError(message);
    }

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.sessionCookie = setCookie.split(";", 1)[0];

    const text = response.status === 204 ? "" : await response.text();
    let body: JsonValue = null;
    if (text) {
      try {
        body = JSON.parse(text) as JsonValue;
      } catch {
        body = text;
      }
    }

    return { status: response.status, ok: response.ok, body };
  }
}

const baseUrl = (process.env.SKILLSWAP_API_URL ?? "http://localhost:5000").replace(/\/+$/, "");
const demoEmail = process.env.SKILLSWAP_DEMO_EMAIL ?? "demo.riya@skillswap.local";
const demoPassword = process.env.SKILLSWAP_DEMO_PASSWORD ?? process.env.DEMO_PASSWORD ?? "SkillSwapDemo123!";
const api = new ApiClient(baseUrl);
const steps: StepState[] = [];

function printPass(message: string) {
  console.log(`  ✓ ${message}`);
}

function printSkip(message: string) {
  console.log(`  - ${message}`);
}

function responseMessage(body: JsonValue) {
  if (body && typeof body === "object" && !Array.isArray(body) && typeof body.message === "string") {
    return body.message;
  }
  return "Request was rejected";
}

function requireSuccess(result: ApiResult, method: string, path: string) {
  if (!result.ok) {
    throw new ApiFailure(method, path, result.status, responseMessage(result.body));
  }
  return result.body;
}

function asObject<T>(value: unknown): T {
  return value as T;
}

function recordFrom<T>(body: JsonValue, key: string): T {
  if (!body || typeof body !== "object" || Array.isArray(body) || !(key in body)) {
    throw new Error(`API response did not include '${key}'`);
  }
  return body[key] as T;
}

function printApiFailure(error: unknown) {
  if (error instanceof ApiFailure) {
    console.log(`  ✗ HTTP ${error.status}`);
    console.log(`    Endpoint: ${error.method} ${error.path}`);
    console.log(`    ${error.message}`);
    return;
  }
  console.log(`  ✗ ${error instanceof Error ? error.message : "Unexpected API failure"}`);
}

async function runStep<T>(number: number, title: string, action: () => Promise<T>): Promise<T | undefined> {
  console.log(`\n[${number}/10] ${title}`);
  try {
    const result = await action();
    steps.push("passed");
    return result;
  } catch (error) {
    steps.push("failed");
    printApiFailure(error);
    return undefined;
  }
}

function skipStep(number: number, title: string, reason: string) {
  console.log(`\n[${number}/10] ${title}`);
  printSkip(reason);
  steps.push("skipped");
}

function formatNames(values: string[] | null | undefined) {
  return values?.length ? values.join(", ") : "Not listed";
}

function activeRequest(requests: SwapRequest[], userId: number, partnerId?: number) {
  return requests.find((request) => {
    if (request.status !== "pending" && request.status !== "accepted") return false;
    if (partnerId === undefined) return true;
    return (request.fromUserId === userId && request.toUserId === partnerId)
      || (request.fromUserId === partnerId && request.toUserId === userId);
  });
}

async function getRequests() {
  const response = await api.request("/api/swap-requests");
  return recordFrom<SwapRequest[]>(requireSuccess(response, "GET", "/api/swap-requests"), "requests");
}

async function main() {
  console.log("========================================================");
  console.log("              SKILLSWAP BACKEND API DEMO");
  console.log("========================================================");
  console.log(`Base URL: ${baseUrl}`);

  let backendOnline = false;
  try {
    const response = await api.request("/api/users/public?limit=1");
    requireSuccess(response, "GET", "/api/users/public?limit=1");
    backendOnline = true;
    await runStep(1, "Backend connection", async () => {
      printPass("Backend is running");
    });
  } catch (error) {
    console.log("\n[1/10] Backend connection");
    if (error instanceof BackendUnavailableError) {
      console.log("  ✗ SkillSwap backend is not running. Start it with: npm run dev");
    } else {
      printApiFailure(error);
    }
    steps.push("failed");
  }

  if (!backendOnline) {
    for (let number = 2; number <= 10; number += 1) {
      const titles = ["Authentication", "Current User", "Profiles", "Matching", "Swap Requests", "Notifications", "Chat", "Reviews", "Authorization"];
      skipStep(number, titles[number - 2], "Skipped because the backend connection is unavailable.");
    }
    printSummary();
    process.exitCode = 1;
    return;
  }

  const login = await runStep(2, "Authentication", async () => {
    const path = "/api/auth/login";
    const response = await api.request(path, {
      method: "POST",
      body: { email: demoEmail, password: demoPassword },
    });
    const body = requireSuccess(response, "POST", path);
    if (!recordFrom<User>(body, "user") || !api.hasSession) {
      throw new Error("Login did not establish an authenticated session");
    }
    printPass("Login successful");
    printPass("Session established");
    return recordFrom<User>(body, "user");
  });

  let currentUser: User | undefined;
  if (login) {
    currentUser = await runStep(3, "Current User", async () => {
      const path = "/api/auth/me";
      const body = requireSuccess(await api.request(path), "GET", path);
      const user = recordFrom<User>(body, "user");
      printPass(`Authenticated user: ${user.name}`);
      console.log(`    Email: ${user.email ?? "Not returned"}`);
      console.log(`    User ID: ${user.id}`);
      return user;
    });
  } else {
    if (steps[1] === "failed") {
      console.log("  Hint: seed local demo accounts with: npm run seed:demo");
    }
    skipStep(3, "Current User", "Skipped because authentication did not succeed.");
  }

  let publicProfiles: User[] = [];
  if (currentUser) {
    const profileStep = await runStep(4, "Profiles", async () => {
      const ownPath = "/api/users/me";
      const ownBody = requireSuccess(await api.request(ownPath), "GET", ownPath);
      const ownProfile = recordFrom<User>(ownBody, "user");
      const listPath = "/api/users/public?limit=50";
      const listBody = requireSuccess(await api.request(listPath), "GET", listPath);
      publicProfiles = recordFrom<User[]>(listBody, "users");
      const profile = publicProfiles[0];
      if (profile) {
        const profilePath = `/api/users/${profile.id}`;
        const profileBody = requireSuccess(await api.request(profilePath), "GET", profilePath);
        const retrieved = recordFrom<User>(profileBody, "user");
        printPass(`Profile retrieved: ${retrieved.name}`);
        console.log(`    Skills offered: ${formatNames(retrieved.skillsOffered)}`);
        console.log(`    Skills wanted: ${formatNames(retrieved.skillsWanted)}`);
        console.log(`    Availability: ${formatNames(retrieved.availability)}`);
      } else {
        printPass("Own profile retrieved");
        printSkip("No other public profile is available to display.");
      }
      return ownProfile;
    });
    if (!profileStep) publicProfiles = [];
  } else {
    skipStep(4, "Profiles", "Skipped because the current user could not be authenticated.");
  }

  let matches: Match[] = [];
  if (currentUser) {
    const result = await runStep(5, "Matching", async () => {
      const path = "/api/matches";
      const body = requireSuccess(await api.request(path), "GET", path);
      matches = recordFrom<Match[]>(body, "matches");
      printPass(`Matches returned: ${matches.length}`);
      matches.slice(0, 3).forEach((match, index) => {
        console.log(`\n  ${index + 1}. ${match.user.name}`);
        console.log(`     Match: ${match.compatibilityScore}%`);
        console.log(`     Shared/relevant skills: ${formatNames(match.matchingSkills)}`);
      });
      if (!matches.length) printSkip("No compatible matches are currently available.");
      return matches;
    });
    if (!result) matches = [];
  } else {
    skipStep(5, "Matching", "Skipped because the current user could not be authenticated.");
  }

  let requests: SwapRequest[] = [];
  if (currentUser) {
    const result = await runStep(6, "Swap Requests", async () => {
      requests = await getRequests();
      printPass(`Requests retrieved: ${requests.length}`);
      let request = activeRequest(requests, currentUser!.id);
      if (request) {
        printPass(`Reusing existing ${request.status} request #${request.id}; no duplicate created.`);
      } else {
        const candidate = publicProfiles.find((profile) => !activeRequest(requests, currentUser!.id, profile.id));
        if (candidate) {
          const path = "/api/swap-requests";
          let createdRequestId: number | undefined;
          const created = await api.request(path, {
            method: "POST",
            body: { toUserId: candidate.id, message: "Backend API demo request" },
          });
          if (created.status === 201) {
            const createdRequest = recordFrom<{ request: SwapRequest }>(created.body, "request").request;
            createdRequestId = createdRequest.id;
            printPass(`Created one reusable pending request #${createdRequest.id} through the API.`);
          } else if (created.status === 409) {
            printSkip("An active request already exists; reusing it instead of creating a duplicate.");
          } else {
            requireSuccess(created, "POST", path);
          }
          requests = await getRequests();
          request = (createdRequestId === undefined ? undefined : requests.find((item) => item.id === createdRequestId))
            ?? activeRequest(requests, currentUser!.id, candidate.id);
        } else {
          printSkip("No public partner without an active request is available.");
        }
      }
      if (request) {
        printPass(`Request lifecycle API working; current status: ${request.status} (request #${request.id}).`);
      } else if (requests.length) {
        console.log(`  Existing request status: ${requests[0].status}`);
      }
      return requests;
    });
    if (!result) requests = [];
  } else {
    skipStep(6, "Swap Requests", "Skipped because the current user could not be authenticated.");
  }

  if (currentUser) {
    await runStep(7, "Notifications", async () => {
      const path = "/api/notifications";
      const body = requireSuccess(await api.request(path), "GET", path);
      const notifications = recordFrom<Notification[]>(body, "notifications");
      const unreadCount = notifications.filter((notification) => !notification.read).length;
      printPass(`Notifications retrieved: ${notifications.length}`);
      printPass(`Unread notifications: ${unreadCount}`);
    });
  } else {
    skipStep(7, "Notifications", "Skipped because the current user could not be authenticated.");
  }

  if (currentUser) {
    const chatResult = await runStep(8, "Chat", async () => {
      const conversationsPath = "/api/chat/conversations";
      let body = requireSuccess(await api.request(conversationsPath), "GET", conversationsPath);
      let conversations = recordFrom<Conversation[]>(body, "conversations");
      printPass(`Conversations retrieved: ${conversations.length}`);

      const accepted = requests.find((request) => request.status === "accepted");
      let targetId: number | undefined;
      if (accepted) targetId = accepted.fromUserId === currentUser!.id ? accepted.toUserId : accepted.fromUserId;
      let conversation = conversations.find((entry) => entry.participant?.id === targetId) ?? conversations[0];

      if (!conversation && targetId) {
        const createPath = "/api/chat/conversations";
        const created = await api.request(createPath, { method: "POST", body: { userId: targetId } });
        if (created.status === 201) {
          printPass("Authorized conversation created for an accepted swap pair.");
          body = requireSuccess(await api.request(conversationsPath), "GET", conversationsPath);
          conversations = recordFrom<Conversation[]>(body, "conversations");
          conversation = conversations.find((entry) => entry.participant?.id === targetId);
        } else if (created.status === 403) {
          printSkip("No eligible accepted-swap conversation is available.");
        } else {
          requireSuccess(created, "POST", createPath);
        }
      }

      if (!conversation) {
        printSkip("No authorized conversation is available; message retrieval was skipped.");
        return "skipped" as const;
      }

      const messagesPath = `/api/chat/conversations/${conversation.id}/messages`;
      const messagesBody = requireSuccess(await api.request(messagesPath), "GET", messagesPath);
      const messages = recordFrom<unknown[]>(messagesBody, "messages");
      printPass(`Authorized conversation opened: #${conversation.id} with ${conversation.participant?.name ?? "a participant"}.`);
      printPass(`Messages retrieved: ${messages.length}`);
      printSkip("No chat message was sent; the demo remains read-only for messages.");
      return "passed" as const;
    });
    if (chatResult === "skipped") steps[steps.length - 1] = "skipped";
  } else {
    skipStep(8, "Chat", "Skipped because the current user could not be authenticated.");
  }

  if (currentUser) {
    const reviewResult = await runStep(9, "Reviews", async () => {
      const accepted = requests.find((request) => request.status === "accepted");
      const partnerId = accepted
        ? accepted.fromUserId === currentUser!.id ? accepted.toUserId : accepted.fromUserId
        : publicProfiles[0]?.id;
      if (!partnerId) {
        printSkip("No other public profile is available for review retrieval.");
        return "skipped" as const;
      }

      const reviewsPath = `/api/users/${partnerId}/reviews`;
      let reviewsBody = requireSuccess(await api.request(reviewsPath), "GET", reviewsPath);
      let reviews = recordFrom<Review[]>(reviewsBody, "reviews");
      printPass(`Reviews retrieved for profile #${partnerId}: ${reviews.length}`);

      if (accepted && partnerId && !reviews.some((review) =>
        review.swapRequestId === accepted.id
        || (review.reviewerUserId === currentUser!.id && review.reviewedUserId === partnerId),
      )) {
        const created = await api.request(reviewsPath, {
          method: "POST",
          body: { rating: 5, comment: "Backend API demo review" },
        });
        if (created.status === 201) {
          printPass("Created one review for the eligible accepted exchange.");
          reviewsBody = requireSuccess(await api.request(reviewsPath), "GET", reviewsPath);
          reviews = recordFrom<Review[]>(reviewsBody, "reviews");
        } else if (created.status === 409) {
          printSkip("A review already exists; no duplicate was created.");
        } else if (created.status === 400) {
          printSkip("The backend reports this interaction is not eligible for a review.");
        } else {
          requireSuccess(created, "POST", reviewsPath);
        }
      } else if (!accepted) {
        printSkip("No accepted swap is available; review creation was skipped.");
      } else {
        printSkip("A review already exists for this interaction; no duplicate was created.");
      }

      const profilePath = `/api/users/${partnerId}`;
      const profileBody = requireSuccess(await api.request(profilePath), "GET", profilePath);
      recordFrom<User>(profileBody, "user");
      const summary = (profileBody as { ratingSummary?: RatingSummary }).ratingSummary ?? { average: 0, count: reviews.length };
      printPass(`Average rating: ${summary.count ? summary.average.toFixed(1) : "No ratings yet"}`);
      printPass(`Review API working (${summary.count} review${summary.count === 1 ? "" : "s"}).`);
      return summary;
    });
    if (reviewResult === "skipped") steps[steps.length - 1] = "skipped";
  } else {
    skipStep(9, "Reviews", "Skipped because the current user could not be authenticated.");
  }

  await runStep(10, "Authorization", async () => {
    const unauthenticated = new ApiClient(baseUrl);
    const path = "/api/notifications";
    const response = await unauthenticated.request(path);
    if (response.status !== 401 && response.status !== 403) {
      throw new ApiFailure("GET", path, response.status, "Expected unauthenticated access to be rejected with HTTP 401/403");
    }
    printPass(`Unauthenticated access correctly rejected (HTTP ${response.status}).`);
    printPass("Backend authorization is enforced.");
  });

  if (api.hasSession) {
    try {
      await api.request("/api/auth/logout", { method: "POST" });
    } catch {
      // Demo results should not be hidden by best-effort session cleanup.
    }
  }

  printSummary();
  if (steps.includes("failed")) process.exitCode = 1;
}

function printSummary() {
  const passed = steps.filter((state) => state === "passed").length;
  const skipped = steps.filter((state) => state === "skipped").length;
  const failed = steps.filter((state) => state === "failed").length;
  console.log("\n========================================================");
  console.log("             BACKEND DEMO COMPLETED");
  console.log("========================================================");
  console.log(`Passed: ${passed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  if (failed === 0 && skipped === 0) {
    console.log("\n✓ Backend workflows verified");
    console.log("✓ No frontend required");
  } else if (failed === 0) {
    console.log("\n✓ Demo completed; unavailable optional workflows were skipped");
    console.log("✓ No frontend required");
  }
  console.log("========================================================");
}

main().catch((error: unknown) => {
  if (error instanceof BackendUnavailableError) {
    console.error("SkillSwap backend is not running. Start it with: npm run dev");
  } else {
    printApiFailure(error);
  }
  console.log("\nPassed: 0\nSkipped: 0\nFailed: 1");
  process.exitCode = 1;
});
