-- ============================================================
-- Migration: email-based workspace_id → UUID workspaces
--
-- ORDER:
--   1. Run THIS FILE in pgAdmin (Query Tool → run all)
--   2. Then run:  npx drizzle-kit push   (adds FK constraints only)
--
-- Do NOT run drizzle-kit push before this — it will fail trying
-- to cast varchar → uuid without a USING clause.
-- ============================================================

BEGIN;

-- 1. Create new tables (idempotent — safe to run even if they already exist)

CREATE TABLE IF NOT EXISTS users (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         varchar(255) NOT NULL UNIQUE,
  name          varchar(255),
  provider      varchar(50)  NOT NULL,
  is_verified   boolean      NOT NULL DEFAULT false,
  last_login_at timestamp,
  created_at    timestamp    NOT NULL DEFAULT NOW(),
  updated_at    timestamp    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(50) NOT NULL UNIQUE,
  description text,
  created_at  timestamp   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name          varchar(255),
  plan_tier     varchar(50)  NOT NULL DEFAULT 'free',
  created_at    timestamp    NOT NULL DEFAULT NOW(),
  updated_at    timestamp    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  workspace_id uuid         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role_id      uuid         NOT NULL REFERENCES roles(id)      ON DELETE RESTRICT,
  assigned_by  varchar(255),
  created_at   timestamp    NOT NULL DEFAULT NOW()
);

-- 2. Populate users from all distinct email workspace_ids across the system
INSERT INTO users (id, email, provider, is_verified, created_at, updated_at)
SELECT
  gen_random_uuid(),
  ws_email,
  'magic_link',
  true,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT workspace_id AS ws_email FROM projects
  UNION
  SELECT DISTINCT workspace_id FROM workspace_members
  UNION
  SELECT DISTINCT workspace_id FROM workspace_invitations
) all_emails
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = all_emails.ws_email);

-- 3. Seed default roles
INSERT INTO roles (id, name, description, created_at)
SELECT gen_random_uuid(), r.name, r.description, NOW()
FROM (VALUES
  ('owner',  'Full workspace control'),
  ('admin',  'Manage projects and members'),
  ('member', 'View and edit projects'),
  ('viewer', 'Read-only access to projects')
) AS r(name, description)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE roles.name = r.name);

-- 4. Create workspaces — one per user (owner model)
INSERT INTO workspaces (id, owner_user_id, name, plan_tier, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  u.email,
  'free',
  NOW(),
  NOW()
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.owner_user_id = u.id);

-- 5. Build mapping: old email workspace_id → new workspace UUID
CREATE TEMP TABLE ws_map AS
SELECT u.email, w.id AS workspace_uuid
FROM users u
JOIN workspaces w ON w.owner_user_id = u.id;

-- ── Convert each table ─────────────────────────────────────────────────────

-- projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE projects p SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE p.workspace_id::text = m.email;
ALTER TABLE projects DROP COLUMN workspace_id;
ALTER TABLE projects RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE projects ALTER COLUMN workspace_id SET NOT NULL;

-- topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE topics t SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE t.workspace_id::text = m.email;
ALTER TABLE topics DROP COLUMN workspace_id;
ALTER TABLE topics RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE topics ALTER COLUMN workspace_id SET NOT NULL;

-- prompts
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE prompts p SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE p.workspace_id::text = m.email;
ALTER TABLE prompts DROP COLUMN workspace_id;
ALTER TABLE prompts RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE prompts ALTER COLUMN workspace_id SET NOT NULL;

-- tags
ALTER TABLE tags ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE tags t SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE t.workspace_id::text = m.email;
ALTER TABLE tags DROP COLUMN workspace_id;
ALTER TABLE tags RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE tags ALTER COLUMN workspace_id SET NOT NULL;

-- prompt_tags
ALTER TABLE prompt_tags ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE prompt_tags pt SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE pt.workspace_id::text = m.email;
ALTER TABLE prompt_tags DROP COLUMN workspace_id;
ALTER TABLE prompt_tags RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE prompt_tags ALTER COLUMN workspace_id SET NOT NULL;

-- brands
ALTER TABLE brands ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE brands b SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE b.workspace_id::text = m.email;
ALTER TABLE brands DROP COLUMN workspace_id;
ALTER TABLE brands RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE brands ALTER COLUMN workspace_id SET NOT NULL;

-- chats
ALTER TABLE chats ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE chats c SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE c.workspace_id::text = m.email;
ALTER TABLE chats DROP COLUMN workspace_id;
ALTER TABLE chats RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE chats ALTER COLUMN workspace_id SET NOT NULL;

-- sources
ALTER TABLE sources ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE sources s SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE s.workspace_id::text = m.email;
ALTER TABLE sources DROP COLUMN workspace_id;
ALTER TABLE sources RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE sources ALTER COLUMN workspace_id SET NOT NULL;

-- citations
ALTER TABLE citations ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE citations c SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE c.workspace_id::text = m.email;
ALTER TABLE citations DROP COLUMN workspace_id;
ALTER TABLE citations RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE citations ALTER COLUMN workspace_id SET NOT NULL;

-- brand_profiles
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE brand_profiles bp SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE bp.workspace_id::text = m.email;
ALTER TABLE brand_profiles DROP COLUMN workspace_id;
ALTER TABLE brand_profiles RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE brand_profiles ALTER COLUMN workspace_id SET NOT NULL;

-- brand_mentions
ALTER TABLE brand_mentions ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE brand_mentions bm SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE bm.workspace_id::text = m.email;
ALTER TABLE brand_mentions DROP COLUMN workspace_id;
ALTER TABLE brand_mentions RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE brand_mentions ALTER COLUMN workspace_id SET NOT NULL;

-- earned_actions
ALTER TABLE earned_actions ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE earned_actions ea SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE ea.workspace_id::text = m.email;
ALTER TABLE earned_actions DROP COLUMN workspace_id;
ALTER TABLE earned_actions RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE earned_actions ALTER COLUMN workspace_id SET NOT NULL;

-- owned_actions
ALTER TABLE owned_actions ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE owned_actions oa SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE oa.workspace_id::text = m.email;
ALTER TABLE owned_actions DROP COLUMN workspace_id;
ALTER TABLE owned_actions RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE owned_actions ALTER COLUMN workspace_id SET NOT NULL;

-- brand_suggestions
ALTER TABLE brand_suggestions ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE brand_suggestions bs SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE bs.workspace_id::text = m.email;
ALTER TABLE brand_suggestions DROP COLUMN workspace_id;
ALTER TABLE brand_suggestions RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE brand_suggestions ALTER COLUMN workspace_id SET NOT NULL;

-- analytics_snapshots
ALTER TABLE analytics_snapshots ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE analytics_snapshots a SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE a.workspace_id::text = m.email;
ALTER TABLE analytics_snapshots DROP COLUMN workspace_id;
ALTER TABLE analytics_snapshots RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE analytics_snapshots ALTER COLUMN workspace_id SET NOT NULL;

-- workspace_members
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE workspace_members wm SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE wm.workspace_id::text = m.email;
ALTER TABLE workspace_members DROP COLUMN workspace_id;
ALTER TABLE workspace_members RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE workspace_members ALTER COLUMN workspace_id SET NOT NULL;

-- workspace_invitations
ALTER TABLE workspace_invitations ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE workspace_invitations wi SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE wi.workspace_id::text = m.email;
ALTER TABLE workspace_invitations DROP COLUMN workspace_id;
ALTER TABLE workspace_invitations RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE workspace_invitations ALTER COLUMN workspace_id SET NOT NULL;

-- action_history
ALTER TABLE action_history ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE action_history ah SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE ah.workspace_id::text = m.email;
ALTER TABLE action_history DROP COLUMN workspace_id;
ALTER TABLE action_history RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE action_history ALTER COLUMN workspace_id SET NOT NULL;

-- competitors
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS workspace_uuid uuid;
UPDATE competitors c SET workspace_uuid = m.workspace_uuid FROM ws_map m WHERE c.workspace_id::text = m.email;
ALTER TABLE competitors DROP COLUMN workspace_id;
ALTER TABLE competitors RENAME COLUMN workspace_uuid TO workspace_id;
ALTER TABLE competitors ALTER COLUMN workspace_id SET NOT NULL;

-- user_roles (was varchar, now uuid FK — if already created by drizzle-kit push it's fine)
-- No migration needed if user_roles was just created empty.

-- 6. Seed user_roles for all workspace owners
INSERT INTO user_roles (id, user_id, workspace_id, role_id, assigned_by, created_at)
SELECT
  gen_random_uuid(),
  u.id,
  w.id,
  r.id,
  u.email,
  NOW()
FROM users u
JOIN workspaces w ON w.owner_user_id = u.id
JOIN roles r ON r.name = 'owner'
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.workspace_id = w.id);

-- 7. Seed user_roles for existing workspace members
INSERT INTO user_roles (id, user_id, workspace_id, role_id, assigned_by, created_at)
SELECT
  gen_random_uuid(),
  u.id,
  wm.workspace_id,
  r.id,
  wm.invited_by,
  NOW()
FROM workspace_members wm
JOIN users u ON u.email = wm.email
JOIN roles r ON r.name = wm.role
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.workspace_id = wm.workspace_id);

COMMIT;

-- ============================================================
-- After this script succeeds, run:
--   npx drizzle-kit push
-- to add all FK constraints.
-- ============================================================
