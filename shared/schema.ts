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

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("info"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: integer("related_entity_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIndex: index("notifications_user_idx").on(table.userId, table.createdAt),
  unreadIndex: index("notifications_unread_idx").on(table.userId, table.read),
}));

export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  userAId: integer("user_a_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userBId: integer("user_b_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  participantIndex: index("chat_conversations_participants_idx").on(table.userAId, table.userBId),
  uniqueConversation: uniqueIndex("chat_conversations_unique_pair_idx")
    .on(table.userAId, table.userBId),
}));

export const conversationParticipants = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  conversationUserIndex: uniqueIndex("conversation_participants_unique_idx").on(table.conversationId, table.userId),
}));

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  senderUserId: integer("sender_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  conversationIndex: index("chat_messages_conversation_idx").on(table.conversationId, table.createdAt),
}));

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  reviewerUserId: integer("reviewer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reviewedUserId: integer("reviewed_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  swapRequestId: integer("swap_request_id").notNull().references(() => swapRequests.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reviewIndex: uniqueIndex("reviews_swap_request_unique_idx").on(table.swapRequestId),
  reviewerReviewedIndex: uniqueIndex("reviews_reviewer_reviewed_unique_idx").on(table.reviewerUserId, table.reviewedUserId),
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

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  relatedEntityType: true,
  relatedEntityId: true,
  read: true,
});

export const insertReviewSchema = createInsertSchema(reviews).pick({
  reviewerUserId: true,
  reviewedUserId: true,
  swapRequestId: true,
  rating: true,
  comment: true,
});

export const swapRequestStatuses = ["pending", "accepted", "rejected", "cancelled"] as const;
export type SwapRequestStatus = (typeof swapRequestStatuses)[number];

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSwapRequest = z.infer<typeof insertSwapRequestSchema>;
export type SwapRequest = typeof swapRequests.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type ConversationParticipant = typeof conversationParticipants.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
