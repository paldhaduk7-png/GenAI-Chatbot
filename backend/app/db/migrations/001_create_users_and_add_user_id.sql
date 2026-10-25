-- Migration 001: Add users table and link conversations to users
-- Safe, idempotent, non-destructive migration preserving existing conversations and messages.

-- 1. Create the users table if it does not exist
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create unique index on users.email and index on users.id
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);
CREATE INDEX IF NOT EXISTS ix_users_id ON users (id);

-- 3. Safely add nullable user_id column to conversations referencing users.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE conversations 
        ADD COLUMN user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Create index on conversations.user_id
CREATE INDEX IF NOT EXISTS ix_conversations_user_id ON conversations (user_id);
