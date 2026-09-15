DO $$ BEGIN
  CREATE TYPE swap_request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
