import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { formatSwapRequestError, getSwapActionLabel, getSwapRelationshipStatus, shouldShowSwapRequestAction } from "../client/src/lib/swapRequests";
import { pool } from "./db";
import { registerRoutes } from "./routes";

test("relationship status prefers accepted and recognizes the active pair", () => {
  const requests = [
    { fromUserId: 4, toUserId: 8, status: "pending" as const },
    { fromUserId: 8, toUserId: 4, status: "accepted" as const },
  ];

  assert.equal(getSwapRelationshipStatus(requests, 4, 8), "accepted");
  assert.equal(getSwapRelationshipStatus([{ ...requests[0], status: "pending" }], 4, 8), "pending");
  assert.equal(getSwapRelationshipStatus([{ ...requests[0], status: "rejected" }], 4, 8), "rejected");
  assert.equal(getSwapRelationshipStatus([{ ...requests[0], status: "cancelled" }], 4, 8), "cancelled");
  assert.equal(getSwapRelationshipStatus([], 4, 8), null);
  assert.equal(getSwapActionLabel("pending"), "Request Pending");
  assert.equal(getSwapActionLabel("accepted"), "Swap Accepted");
  assert.equal(getSwapActionLabel("rejected"), "Send New Request");
  assert.equal(getSwapActionLabel("cancelled"), "Send Swap Request");
  assert.equal(getSwapActionLabel(null), "Send Swap Request");
  assert.equal(shouldShowSwapRequestAction(4, 4), false);
  assert.equal(shouldShowSwapRequestAction(4, 8), true);
  assert.equal(shouldShowSwapRequestAction(undefined, 8), false);
});

test("swap request errors are presented as readable messages", () => {
  assert.equal(formatSwapRequestError("An active request already exists"), "You already have a pending request with this learner.");
  assert.equal(formatSwapRequestError("Authentication required"), "Please log in to send a swap request.");
  assert.equal(formatSwapRequestError("Recipient not found"), "This learner is no longer available.");
  assert.equal(formatSwapRequestError("Internal server error"), "Unable to send the swap request. Please try again.");
});

test("swap request API enforces ownership and supports the complete request lifecycle", async (t) => {
  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const createdUserIds: number[] = [];
  const cookies: string[] = [];

  const callApi = (path: string, options: { method?: string; cookie?: string; body?: unknown } = {}) => fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const registerUser = async (label: string) => {
    const username = `sw_${label}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const response = await callApi("/api/auth/register", {
      method: "POST",
      body: {
        username,
        password: "SwapTestPassword123!",
        name: `Swap Test ${label}`,
        email: `${username}@example.test`,
        location: "Bhubaneswar",
        skillsOffered: ["Python", "SQL"],
        skillsWanted: ["React"],
        availability: ["weekdays"],
      },
    });
    assert.equal(response.status, 201, `register ${label}`);
    const data = await response.json() as { user: { id: number } };
    const cookieHeader = response.headers.get("set-cookie");
    assert.ok(cookieHeader, "registration should establish a session cookie");
    const cookie = cookieHeader.split(";")[0];
    createdUserIds.push(data.user.id);
    cookies.push(cookie);
    return { id: data.user.id, cookie };
  };

  t.after(async () => {
    try {
      await Promise.all(cookies.map(async (cookie) => {
        try { await callApi("/api/auth/logout", { method: "POST", cookie }); } catch { /* Cleanup must continue. */ }
      }));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      if (createdUserIds.length) {
        await pool.query("DELETE FROM users WHERE id = ANY($1::int[])", [createdUserIds]);
      }
    }
  });

  const sender = await registerUser("sender");
  const recipient = await registerUser("recipient");
  const otherUser = await registerUser("other");

  const createdResponse = await callApi("/api/swap-requests", {
    method: "POST",
    cookie: sender.cookie,
    body: { toUserId: recipient.id, message: "I can teach Python in exchange for React." },
  });
  assert.equal(createdResponse.status, 201);
  const createdData = await createdResponse.json() as { request: { id: number; status: string; message: string } };
  assert.equal(createdData.request.status, "pending");
  assert.equal(createdData.request.message, "I can teach Python in exchange for React.");
  const requestId = createdData.request.id;

  const senderRequests = await callApi("/api/swap-requests", { cookie: sender.cookie });
  assert.equal(senderRequests.status, 200);
  assert.equal((await senderRequests.json() as { requests: unknown[] }).requests.length, 1);
  assert.equal((await callApi(`/api/swap-requests/user/${sender.id}`, { cookie: sender.cookie })).status, 200);
  assert.equal((await callApi(`/api/swap-requests/user/${recipient.id}`, { cookie: sender.cookie })).status, 403);
  assert.equal((await callApi("/api/swap-requests", { method: "POST", cookie: sender.cookie, body: { toUserId: sender.id } })).status, 400);
  assert.equal((await callApi("/api/swap-requests", { method: "POST", cookie: sender.cookie, body: { toUserId: 2_147_483_647 } })).status, 404);
  assert.equal((await callApi("/api/swap-requests", { method: "POST", cookie: sender.cookie, body: { toUserId: recipient.id } })).status, 409);
  assert.equal((await callApi("/api/swap-requests", { method: "POST", cookie: recipient.cookie, body: { toUserId: sender.id } })).status, 409);
  assert.equal((await callApi(`/api/swap-requests/${requestId}/status`, { method: "PATCH", body: { status: "accepted" } })).status, 401);
  assert.equal((await callApi(`/api/swap-requests/${requestId}/status`, { method: "PATCH", cookie: otherUser.cookie, body: { status: "accepted" } })).status, 403);
  assert.equal((await callApi(`/api/swap-requests/${requestId}`, { method: "DELETE", cookie: otherUser.cookie })).status, 403);

  const acceptedResponse = await callApi(`/api/swap-requests/${requestId}/status`, {
    method: "PATCH",
    cookie: recipient.cookie,
    body: { status: "accepted" },
  });
  assert.equal(acceptedResponse.status, 200);
  assert.equal((await acceptedResponse.json() as { request: { status: string } }).request.status, "accepted");
  assert.equal((await callApi(`/api/swap-requests/${requestId}/status`, { method: "PATCH", cookie: sender.cookie, body: { status: "cancelled" } })).status, 409);

  const rejectableResponse = await callApi("/api/swap-requests", {
    method: "POST",
    cookie: otherUser.cookie,
    body: { toUserId: sender.id },
  });
  assert.equal(rejectableResponse.status, 201);
  const rejectable = await rejectableResponse.json() as { request: { id: number } };
  const rejectedResponse = await callApi(`/api/swap-requests/${rejectable.request.id}/status`, {
    method: "PATCH",
    cookie: sender.cookie,
    body: { status: "rejected" },
  });
  assert.equal(rejectedResponse.status, 200);
  assert.equal((await rejectedResponse.json() as { request: { status: string } }).request.status, "rejected");

  const cancellableResponse = await callApi("/api/swap-requests", {
    method: "POST",
    cookie: sender.cookie,
    body: { toUserId: otherUser.id },
  });
  assert.equal(cancellableResponse.status, 201);
  const cancellable = await cancellableResponse.json() as { request: { id: number } };
  const cancelledResponse = await callApi(`/api/swap-requests/${cancellable.request.id}/status`, {
    method: "PATCH",
    cookie: sender.cookie,
    body: { status: "cancelled" },
  });
  assert.equal(cancelledResponse.status, 200);
  assert.equal((await cancelledResponse.json() as { request: { status: string } }).request.status, "cancelled");

  const deletableResponse = await callApi("/api/swap-requests", {
    method: "POST",
    cookie: recipient.cookie,
    body: { toUserId: otherUser.id },
  });
  assert.equal(deletableResponse.status, 201);
  const deletable = await deletableResponse.json() as { request: { id: number } };
  const deletedResponse = await callApi(`/api/swap-requests/${deletable.request.id}`, { method: "DELETE", cookie: recipient.cookie });
  assert.equal(deletedResponse.status, 200);
  assert.equal((await deletedResponse.json() as { request: { status: string } }).request.status, "cancelled");
});