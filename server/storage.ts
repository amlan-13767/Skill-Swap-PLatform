import { and, asc, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  chatConversations,
  chatMessages,
  conversationParticipants,
  notifications,
  reviews,
  swapRequests,
  users,
  type ChatConversation,
  type ChatMessage,
  type Notification,
  type Review,
  type SwapRequest,
  type SwapRequestStatus,
  type User,
} from "@shared/schema";

export type PublicUser = Omit<User, "passwordHash" | "email">;

export type UserSearchOptions = {
  currentUserId?: number;
  search?: string;
  offeredSkill?: string;
  wantedSkill?: string;
  availability?: string;
  location?: string;
  sort?: "name" | "rating" | "newest";
  page: number;
  limit: number;
};

export type PaginatedUsers = {
  users: PublicUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: typeof users.$inferInsert): Promise<User>;
  updateUser(id: number, user: Partial<typeof users.$inferInsert>): Promise<User | undefined>;
  getPublicUsers(options: UserSearchOptions): Promise<PaginatedUsers>;
  getAllPublicUsers(currentUserId: number): Promise<PublicUser[]>;
  createSwapRequest(request: { fromUserId: number; toUserId: number; message?: string | null }): Promise<SwapRequest>;
  getSwapRequestsByUser(userId: number): Promise<SwapRequest[]>;
  getSwapRequest(id: number): Promise<SwapRequest | undefined>;
  updateSwapRequestStatus(id: number, status: SwapRequestStatus): Promise<SwapRequest | undefined>;
  deleteSwapRequest(id: number): Promise<boolean>;
  createNotification(notification: typeof notifications.$inferInsert): Promise<Notification>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: number): Promise<number>;
  getOrCreateConversation(userAId: number, userBId: number): Promise<ChatConversation>;
  getConversationsForUser(userId: number): Promise<Array<{ conversation: ChatConversation; otherUserId: number; unreadCount: number; lastMessage: ChatMessage | null }>>;
  getConversationMessages(conversationId: number, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: typeof chatMessages.$inferInsert): Promise<ChatMessage>;
  markConversationRead(conversationId: number, userId: number): Promise<void>;
  getReviewsForUser(userId: number): Promise<Review[]>;
  getAverageRatingForUser(userId: number): Promise<{ average: number; count: number }>;
  createReview(review: typeof reviews.$inferInsert): Promise<Review>;
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, email: _email, ...publicUser } = user;
  return publicUser;
}

function skillCondition(column: typeof users.skillsOffered | typeof users.skillsWanted, skill: string) {
  return sql`EXISTS (
    SELECT 1 FROM unnest(${column}) AS skill_value
    WHERE lower(trim(skill_value)) = lower(trim(${skill}))
  )`;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  }

  async getUserByUsername(username: string) {
    return db.query.users.findFirst({ where: eq(users.username, username) });
  }

  async getUserByEmail(email: string) {
    return db.query.users.findFirst({ where: eq(users.email, email) });
  }

  async createUser(user: typeof users.$inferInsert) {
    const [createdUser] = await db.insert(users).values(user).returning();
    return createdUser;
  }

  async updateUser(id: number, user: Partial<typeof users.$inferInsert>) {
    const [updatedUser] = await db
      .update(users)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getPublicUsers(options: UserSearchOptions = { page: 1, limit: 12 }): Promise<PaginatedUsers> {
    const offset = (options.page - 1) * options.limit;
    const filters = [eq(users.isPublic, true)];

    if (options.currentUserId) filters.push(sql`${users.id} <> ${options.currentUserId}`);
    if (options.search) {
      filters.push(or(ilike(users.name, `%${options.search}%`), ilike(users.username, `%${options.search}%`))!);
    }
    if (options.offeredSkill) filters.push(skillCondition(users.skillsOffered, options.offeredSkill));
    if (options.wantedSkill) filters.push(skillCondition(users.skillsWanted, options.wantedSkill));
    if (options.availability) filters.push(sql`${options.availability} = ANY(${users.availability})`);
    if (options.location) filters.push(ilike(users.location, `%${options.location}%`));

    const where = and(...filters);
    const orderBy = options.sort === "rating"
      ? desc(users.rating)
      : options.sort === "newest"
        ? desc(users.createdAt)
        : asc(users.name);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(users).where(where).orderBy(orderBy).limit(options.limit).offset(offset),
      db.select({ total: count() }).from(users).where(where),
    ]);
    const totalCount = Number(total);

    return {
      users: rows.map(toPublicUser),
      pagination: {
        page: options.page,
        limit: options.limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / options.limit),
      },
    };
  }

  async getAllPublicUsers(currentUserId: number) {
    const rows = await db.select().from(users).where(and(eq(users.isPublic, true), sql`${users.id} <> ${currentUserId}`));
    return rows.map(toPublicUser);
  }

  async createSwapRequest(request: { fromUserId: number; toUserId: number; message?: string | null }) {
    const [createdRequest] = await db.insert(swapRequests).values(request).returning();
    return createdRequest;
  }

  async getSwapRequestsByUser(userId: number) {
    return db.select().from(swapRequests).where(
      or(eq(swapRequests.fromUserId, userId), eq(swapRequests.toUserId, userId)),
    ).orderBy(desc(swapRequests.createdAt));
  }

  async getSwapRequest(id: number) {
    return db.query.swapRequests.findFirst({ where: eq(swapRequests.id, id) });
  }

  async updateSwapRequestStatus(id: number, status: SwapRequestStatus) {
    const [updatedRequest] = await db
      .update(swapRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(swapRequests.id, id))
      .returning();
    return updatedRequest;
  }

  async deleteSwapRequest(id: number) {
    const deleted = await db.delete(swapRequests).where(eq(swapRequests.id, id)).returning({ id: swapRequests.id });
    return deleted.length > 0;
  }

  async createNotification(notification: typeof notifications.$inferInsert) {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async getNotificationsByUser(userId: number) {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: number) {
    const [updated] = await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: number) {
    const result = await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning({ id: notifications.id });
    return result.length;
  }

  async getOrCreateConversation(userAId: number, userBId: number) {
    const [first, second] = [Math.min(userAId, userBId), Math.max(userAId, userBId)];
    const existing = await db.query.chatConversations.findFirst({
      where: and(eq(chatConversations.userAId, first), eq(chatConversations.userBId, second)),
    });
    if (existing) return existing;

    const [created] = await db.insert(chatConversations).values({
      userAId: first,
      userBId: second,
    }).returning();
    await Promise.all([
      db.insert(conversationParticipants).values({ conversationId: created.id, userId: first }),
      db.insert(conversationParticipants).values({ conversationId: created.id, userId: second }),
    ]);
    return created;
  }

  async getConversationsForUser(userId: number) {
    const rows = await db.select().from(conversationParticipants).where(eq(conversationParticipants.userId, userId));
    const acceptedRequests = await this.getSwapRequestsByUser(userId);
    const acceptedPartnerIds = new Set(acceptedRequests
      .filter((request) => request.status === "accepted")
      .map((request) => request.fromUserId === userId ? request.toUserId : request.fromUserId));
    const conversations = await Promise.all(rows.map(async (row) => {
      const conversation = await db.query.chatConversations.findFirst({ where: eq(chatConversations.id, row.conversationId) });
      if (!conversation) return null;
      const otherUserId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
      if (!acceptedPartnerIds.has(otherUserId)) return null;
      const lastMessage = await db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversation.id)).orderBy(desc(chatMessages.createdAt)).limit(1).then((items) => items[0] ?? null);
      const unreadCount = await db.select({ count: count() }).from(chatMessages)
        .where(and(
          eq(chatMessages.conversationId, conversation.id),
          ne(chatMessages.senderUserId, userId),
          row.lastReadAt ? sql`${chatMessages.createdAt} > ${row.lastReadAt}` : sql`TRUE`,
        ))
        .then((result) => Number(result[0]?.count ?? 0));
      return { conversation, otherUserId, unreadCount, lastMessage };
    }));
    return conversations.filter(Boolean) as Array<{ conversation: ChatConversation; otherUserId: number; unreadCount: number; lastMessage: ChatMessage | null }>;
  }

  async getConversationMessages(conversationId: number, limit = 50) {
    return db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .then((items) => items.reverse());
  }

  async createChatMessage(message: typeof chatMessages.$inferInsert) {
    const [created] = await db.insert(chatMessages).values(message).returning();
    return created;
  }

  async markConversationRead(conversationId: number, userId: number) {
    const row = await db.query.conversationParticipants.findFirst({
      where: and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)),
    });
    if (!row) return;
    await db.update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));
  }

  async getReviewsForUser(userId: number) {
    return db.select().from(reviews).where(eq(reviews.reviewedUserId, userId)).orderBy(desc(reviews.createdAt));
  }

  async getAverageRatingForUser(userId: number) {
    const rows = await db.select({ average: sql<number>`AVG(${reviews.rating})`, count: count() }).from(reviews).where(eq(reviews.reviewedUserId, userId));
    const result = rows[0];
    return { average: Number(result?.average ?? 0), count: Number(result?.count ?? 0) };
  }

  async createReview(review: typeof reviews.$inferInsert) {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
