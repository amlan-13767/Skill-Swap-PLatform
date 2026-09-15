import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  check,
  integer,
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const swapRequestStatus = pgEnum("swap_request_status", [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  location: text("location"),
  avatar: text("avatar"),
  skillsOffered: text("skills_offered").array(),
  skillsWanted: text("skills_wanted").array(),
  availability: text("availability").array().notNull().default([]),
  rating: integer("rating").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  publicUsersIndex: index("users_public_idx").on(table.isPublic),
  nameIndex: index("users_name_idx").on(table.name),
}));

export const swapRequests = pgTable("swap_requests", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  toUserId: integer("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: swapRequestStatus("status").notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  participantsIndex: index("swap_requests_participants_idx").on(table.fromUserId, table.toUserId),
  statusIndex: index("swap_requests_status_idx").on(table.status),
  activePairIndex: uniqueIndex("swap_requests_active_pair_idx")
    .on(table.fromUserId, table.toUserId)
    .where(sql`status IN ('pending', 'accepted')`),
  differentUsersCheck: check("swap_requests_different_users_check", sql`from_user_id <> to_user_id`),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  passwordHash: true,
  name: true,
  email: true,
  location: true,
  avatar: true,
  skillsOffered: true,
  skillsWanted: true,
  availability: true,
  isPublic: true,
});

export const insertSwapRequestSchema = createInsertSchema(swapRequests).pick({
  fromUserId: true,
  toUserId: true,
  message: true,
});

export const swapRequestStatuses = ["pending", "accepted", "rejected", "cancelled"] as const;
export type SwapRequestStatus = (typeof swapRequestStatuses)[number];

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSwapRequest = z.infer<typeof insertSwapRequestSchema>;
export type SwapRequest = typeof swapRequests.$inferSelect;
