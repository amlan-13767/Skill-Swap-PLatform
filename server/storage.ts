import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./db";
import { swapRequests, users, type SwapRequest, type SwapRequestStatus, type User } from "@shared/schema";

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
}

export const storage = new DatabaseStorage();
