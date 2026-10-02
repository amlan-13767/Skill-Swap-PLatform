import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start the application");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export function getDatabaseStartupErrorMessage(error: unknown): string {
  const errorCode = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
  const nestedMessages = error instanceof AggregateError
    ? error.errors.map((item) => (item instanceof Error ? item.message : String(item))).join(" | ")
    : error instanceof Error
      ? error.message
      : String(error ?? "Unknown database error");

  const message = nestedMessages;

  if (errorCode === "28P01" || message.includes("password authentication failed")) {
    return "PostgreSQL rejected the username or password in DATABASE_URL. Update the credentials in .env to match your PostgreSQL user.";
  }

  if (errorCode === "3D000") {
    return "The database named in DATABASE_URL does not exist. Create it or correct the database name in .env.";
  }

  if (message.includes("ECONNREFUSED") || message.includes("connect ECONNREFUSED")) {
    return "PostgreSQL is not running or DATABASE_URL is pointing to an unavailable database. Start PostgreSQL and confirm your DATABASE_URL is correct. Example: postgresql://postgres:postgres@localhost:5432/skillswap";
  }

  if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
    return "DATABASE_URL hostname could not be resolved. Check the host, port, and credentials in your .env file.";
  }

  if (message.includes("role") || message.includes("database")) {
    return "Database authentication or database name is invalid. Verify DATABASE_URL in your .env file.";
  }

  return `Database startup failed: ${message || "Unknown database error"}`;
}

export async function ensureDatabaseSchema() {
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'swap_request_status') THEN
          CREATE TYPE swap_request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id serial PRIMARY KEY,
        username text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        location text,
        avatar text,
        skills_offered text[],
        skills_wanted text[],
        availability text[] NOT NULL DEFAULT '{}',
        rating integer NOT NULL DEFAULT 0,
        is_public boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS users_public_idx ON users (is_public);
      CREATE INDEX IF NOT EXISTS users_name_idx ON users (name);

      CREATE TABLE IF NOT EXISTS swap_requests (
        id serial PRIMARY KEY,
        from_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status swap_request_status NOT NULL DEFAULT 'pending',
        message text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT swap_requests_different_users_check CHECK (from_user_id <> to_user_id)
      );

      CREATE INDEX IF NOT EXISTS swap_requests_participants_idx ON swap_requests (from_user_id, to_user_id);
      CREATE INDEX IF NOT EXISTS swap_requests_status_idx ON swap_requests (status);
      CREATE UNIQUE INDEX IF NOT EXISTS swap_requests_active_pair_idx
        ON swap_requests (from_user_id, to_user_id)
        WHERE status IN ('pending', 'accepted');

      CREATE TABLE IF NOT EXISTS notifications (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type text NOT NULL DEFAULT 'info',
        title text NOT NULL,
        message text NOT NULL,
        related_entity_type text,
        related_entity_id integer,
        read boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id, read);

      CREATE TABLE IF NOT EXISTS chat_conversations (
        id serial PRIMARY KEY,
        user_a_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_b_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chat_conversations_different_users_check CHECK (user_a_id <> user_b_id)
      );
      CREATE INDEX IF NOT EXISTS chat_conversations_participants_idx ON chat_conversations (user_a_id, user_b_id);
      CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_unique_pair_idx ON chat_conversations (user_a_id, user_b_id);

      CREATE TABLE IF NOT EXISTS conversation_participants (
        id serial PRIMARY KEY,
        conversation_id integer NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (conversation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id serial PRIMARY KEY,
        conversation_id integer NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        sender_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON chat_messages (conversation_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS reviews (
        id serial PRIMARY KEY,
        reviewer_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reviewed_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        swap_request_id integer NOT NULL REFERENCES swap_requests(id) ON DELETE CASCADE,
        rating integer NOT NULL,
        comment text,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (swap_request_id),
        UNIQUE (reviewer_user_id, reviewed_user_id)
      );
    `);
  } catch (error) {
    const helpfulMessage = getDatabaseStartupErrorMessage(error);
    console.error(`\n[database:error] ${helpfulMessage}`);
    console.error("[database:error] Detailed backend diagnostics:", error);
    throw error;
  }
}
