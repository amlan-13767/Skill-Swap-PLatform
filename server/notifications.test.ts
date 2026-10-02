import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { pool } from "./db";
import { registerRoutes } from "./routes";

async function createUserAndCookie(baseUrl: string, label: string) {
  const username = `notify_${label}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      password: "StrongPassword1!",
      name: `User ${label}`,
      email: `${username}@example.test`,
      location: "Bhubaneswar",
      skillsOffered: ["Python"],
      skillsWanted: ["SQL"],
      availability: ["weekdays"],
      isPublic: true,
    }),
  });

  assert.equal(response.status, 201, `register ${label}`);
  const data = await response.json() as { user: { id: number; name: string; email: string } };
  const cookieHeader = response.headers.get("set-cookie");
  assert.ok(cookieHeader, "registration should establish a session cookie");
  return { ...data.user, cookie: cookieHeader.split(";")[0] };
}

async function callApi(baseUrl: string, path: string, options: { method?: string; cookie?: string; body?: Record<string, unknown> } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
}

test("notifications are created for requests and scoped to the recipient", async (t) => {
  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const sender = await createUserAndCookie(baseUrl, "sender");
  const recipient = await createUserAndCookie(baseUrl, "recipient");
  const createdRequest = await callApi(baseUrl, "/api/swap-requests", {
    method: "POST",
    cookie: sender.cookie,
    body: { toUserId: recipient.id, message: "I can help with Python." },
  });
  assert.equal(createdRequest.status, 201);

  const inbox = await callApi(baseUrl, "/api/notifications", { cookie: recipient.cookie });
  assert.equal(inbox.status, 200);
  const inboxData = await inbox.json() as { notifications: Array<{ id: number; userId: number; type: string; title: string; message: string; read: boolean }> };
  const requestNotification = inboxData.notifications.find((notification) => notification.type === "swap_request");
  assert.ok(requestNotification, "swap request notification should exist");
  assert.equal(requestNotification.message, `New skill swap request from ${sender.name}`);
  assert.equal(requestNotification.userId, recipient.id);

  const blockedRead = await callApi(baseUrl, `/api/notifications/${requestNotification.id}/read`, {
    method: "PATCH",
    cookie: sender.cookie,
  });
  assert.equal(blockedRead.status, 403);

  const allowedRead = await callApi(baseUrl, `/api/notifications/${requestNotification.id}/read`, {
    method: "PATCH",
    cookie: recipient.cookie,
  });
  assert.equal(allowedRead.status, 200);
  const readData = await allowedRead.json() as { notification: { read: boolean } };
  assert.equal(readData.notification.read, true);

  t.after(async () => {
    await Promise.all([
      callApi(baseUrl, "/api/auth/logout", { method: "POST", cookie: sender.cookie }),
      callApi(baseUrl, "/api/auth/logout", { method: "POST", cookie: recipient.cookie }),
    ]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM users WHERE email LIKE '%@example.test'");
  });
});

test("accepted requests create chat and review flows for the involved users", async (t) => {
  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.name === "ZodError" ? 400 : 500).json({ message: error.message });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const sender = await createUserAndCookie(baseUrl, "reviewer");
  const recipient = await createUserAndCookie(baseUrl, "reviewed");
  const outsider = await createUserAndCookie(baseUrl, "outsider");
  const blockedConversation = await callApi(baseUrl, "/api/chat/conversations", {
    method: "POST",
    cookie: sender.cookie,
    body: { userId: outsider.id },
  });
  assert.equal(blockedConversation.status, 403, "chat requires an accepted swap request");
  const requestCreate = await callApi(baseUrl, "/api/swap-requests", {
    method: "POST",
    cookie: sender.cookie,
    body: { toUserId: recipient.id, message: "Happy to teach SQL." },
  });
  assert.equal(requestCreate.status, 201);
  const requestData = await requestCreate.json() as { request: { id: number } };
  const acceptResponse = await callApi(baseUrl, `/api/swap-requests/${requestData.request.id}/status`, {
    method: "PATCH",
    cookie: recipient.cookie,
    body: { status: "accepted" },
  });
  assert.equal(acceptResponse.status, 200);

  const conversationResponse = await callApi(baseUrl, "/api/chat/conversations", {
    method: "POST",
    cookie: sender.cookie,
    body: { userId: recipient.id },
  });
  assert.equal(conversationResponse.status, 201);
  const conversationData = await conversationResponse.json() as { conversation: { id: number } };

  const conversationList = await callApi(baseUrl, "/api/chat/conversations", { cookie: sender.cookie });
  assert.equal(conversationList.status, 200);
  const conversationListData = await conversationList.json() as { conversations: Array<{ id: number; participant: { id: number } }> };
  assert.ok(conversationListData.conversations.some((item) => item.id === conversationData.conversation.id && item.participant.id === recipient.id));

  const unauthorizedMessages = await callApi(baseUrl, `/api/chat/conversations/${conversationData.conversation.id}/messages`, { cookie: outsider.cookie });
  assert.equal(unauthorizedMessages.status, 403);
  const unauthorizedSend = await callApi(baseUrl, `/api/chat/conversations/${conversationData.conversation.id}/messages`, {
    method: "POST",
    cookie: outsider.cookie,
    body: { content: "This should not be delivered." },
  });
  assert.equal(unauthorizedSend.status, 403);

  const message = await callApi(baseUrl, `/api/chat/conversations/${conversationData.conversation.id}/messages`, {
    method: "POST",
    cookie: sender.cookie,
    body: { content: "Hello and thanks for accepting." },
  });
  assert.equal(message.status, 201);

  const recipientConversations = await callApi(baseUrl, "/api/chat/conversations", { cookie: recipient.cookie });
  const recipientConversationData = await recipientConversations.json() as { conversations: Array<{ id: number; unreadCount: number }> };
  assert.equal(recipientConversationData.conversations.find((item) => item.id === conversationData.conversation.id)?.unreadCount, 1);
  const receivedMessages = await callApi(baseUrl, `/api/chat/conversations/${conversationData.conversation.id}/messages`, { cookie: recipient.cookie });
  assert.equal(receivedMessages.status, 200);
  const receivedData = await receivedMessages.json() as { messages: Array<{ content: string }> };
  assert.equal(receivedData.messages.at(-1)?.content, "Hello and thanks for accepting.");
  const readConversationList = await callApi(baseUrl, "/api/chat/conversations", { cookie: recipient.cookie });
  const readConversationData = await readConversationList.json() as { conversations: Array<{ id: number; unreadCount: number }> };
  assert.equal(readConversationData.conversations.find((item) => item.id === conversationData.conversation.id)?.unreadCount, 0);

  const recipientInbox = await callApi(baseUrl, "/api/notifications", { cookie: recipient.cookie });
  assert.equal(recipientInbox.status, 200);
  const recipientData = await recipientInbox.json() as { notifications: Array<{ type: string; message: string }> };
  assert.ok(recipientData.notifications.some((notification) => notification.type === "chat_message" || notification.type === "swap_request_accepted"));

  const reviewResponse = await callApi(baseUrl, `/api/users/${recipient.id}/reviews`, {
    method: "POST",
    cookie: sender.cookie,
    body: { rating: 5, comment: "Great collaboration." },
  });
  assert.equal(reviewResponse.status, 201);

  const invalidRating = await callApi(baseUrl, `/api/users/${recipient.id}/reviews`, {
    method: "POST",
    cookie: sender.cookie,
    body: { rating: 6 },
  });
  assert.equal(invalidRating.status, 400);
  const selfReview = await callApi(baseUrl, `/api/users/${sender.id}/reviews`, {
    method: "POST",
    cookie: sender.cookie,
    body: { rating: 5 },
  });
  assert.equal(selfReview.status, 400);
  const duplicateReview = await callApi(baseUrl, `/api/users/${recipient.id}/reviews`, {
    method: "POST",
    cookie: sender.cookie,
    body: { rating: 4, comment: "Another rating." },
  });
  assert.equal(duplicateReview.status, 409);

  const reviewsResponse = await callApi(baseUrl, `/api/users/${recipient.id}/reviews`, { cookie: sender.cookie });
  assert.equal(reviewsResponse.status, 200);
  const reviewsData = await reviewsResponse.json() as { reviews: Array<{ rating: number; reviewer: { name: string; email?: string; passwordHash?: string } }> };
  assert.equal(reviewsData.reviews[0]?.rating, 5);
  assert.equal(reviewsData.reviews[0]?.reviewer.name, sender.name);
  assert.equal(reviewsData.reviews[0]?.reviewer.email, undefined);
  assert.equal(reviewsData.reviews[0]?.reviewer.passwordHash, undefined);
  const profileResponse = await callApi(baseUrl, `/api/users/${recipient.id}`, { cookie: sender.cookie });
  const profileData = await profileResponse.json() as { ratingSummary: { average: number; count: number } };
  assert.deepEqual(profileData.ratingSummary, { average: 5, count: 1 });

  t.after(async () => {
    await Promise.all([
      callApi(baseUrl, "/api/auth/logout", { method: "POST", cookie: sender.cookie }),
      callApi(baseUrl, "/api/auth/logout", { method: "POST", cookie: recipient.cookie }),
      callApi(baseUrl, "/api/auth/logout", { method: "POST", cookie: outsider.cookie }),
    ]);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM users WHERE email LIKE '%@example.test'");
  });
});
