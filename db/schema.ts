import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  boolean,
  index,
  uniqueIndex,
  real,
  jsonb,
} from "drizzle-orm/pg-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  provider: varchar("provider", { length: 50 }).default("magic_link").notNull(),
  providerId: varchar("provider_id", { length: 255 }),
  isVerified: boolean("is_verified").default(false).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

// ─── Roles ────────────────────────────────────────────────────────────────────
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(), // owner | admin | member | viewer
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  nameIdx: uniqueIndex("roles_name_idx").on(t.name),
}));

// ─── Workspaces ───────────────────────────────────────────────────────────────
// One workspace per user (owner). Members join via user_roles.
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  planTier: varchar("plan_tier", { length: 50 }).default("free").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  ownerIdx: index("workspaces_owner_idx").on(t.ownerUserId),
  ownerUnique: uniqueIndex("workspaces_owner_unique").on(t.ownerUserId),
}));

// ─── User Roles ───────────────────────────────────────────────────────────────
// Defines which role a user holds inside a workspace.
export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "restrict" }),
  assignedBy: varchar("assigned_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueUserWorkspace: uniqueIndex("user_roles_unique").on(t.userId, t.workspaceId),
  userIdx: index("user_roles_user_idx").on(t.userId),
  workspaceIdx: index("user_roles_workspace_idx").on(t.workspaceId),
  roleIdx: index("user_roles_role_idx").on(t.roleId),
}));

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  allocatedPrompts: integer("allocated_prompts").default(100).notNull(),
  allocatedCredits: integer("allocated_credits").default(3000).notNull(),
  frequency: varchar("frequency", { length: 20 }).default("Daily").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  projectType: varchar("project_type", { length: 20 }).default("Customer").notNull(),
  color: varchar("color", { length: 20 }),
  models: text("models").array(),
  brandName: varchar("brand_name", { length: 255 }),
  location: varchar("location", { length: 100 }).default("United States"),
  language: varchar("language", { length: 50 }).default("English"),
  timezone: varchar("timezone", { length: 100 }).default("America/New_York"),
  hiddenBrandIds: text("hidden_brand_ids").array().default([]).notNull(),
  domainTypeOverrides: jsonb("domain_type_overrides").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  workspaceIdx: index("projects_workspace_idx").on(t.workspaceId),
}));

// ─── Topics ───────────────────────────────────────────────────────────────────
export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  workspaceIdx: index("topics_workspace_idx").on(t.workspaceId),
  projectIdx: index("topics_project_idx").on(t.projectId),
}));

// ─── Prompts ──────────────────────────────────────────────────────────────────
export const prompts = pgTable("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  volumeTier: varchar("volume_tier", { length: 50 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  location: varchar("location", { length: 2 }).default("US").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  workspaceIdx: index("prompts_workspace_idx").on(t.workspaceId),
  projectIdx: index("prompts_project_idx").on(t.projectId),
  topicIdx: index("prompts_topic_idx").on(t.topicId),
}));

// ─── Tags ─────────────────────────────────────────────────────────────────────
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }),
  color: varchar("color", { length: 50 }).default("gray").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  workspaceIdx: index("tags_workspace_idx").on(t.workspaceId),
  projectIdx: index("tags_project_idx").on(t.projectId),
}));

// ─── PromptTags ───────────────────────────────────────────────────────────────
export const promptTags = pgTable("prompt_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  promptId: uuid("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  workspaceIdx: index("prompt_tags_workspace_idx").on(t.workspaceId),
  promptIdx: index("prompt_tags_prompt_idx").on(t.promptId),
}));

// ─── Brands ───────────────────────────────────────────────────────────────────
export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  isOwn: boolean("is_own").default(false).notNull(),
  color: varchar("color", { length: 20 }),
  aliases: text("aliases").array().notNull(),
  domains: text("domains").array().notNull(),
}, (t) => ({
  workspaceIdx: index("brands_workspace_idx").on(t.workspaceId),
  projectIdx: index("brands_project_idx").on(t.projectId),
}));

// ─── Chats ────────────────────────────────────────────────────────────────────
export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  promptId: uuid("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  engine: varchar("engine", { length: 100 }).notNull(),
  modelSnapshot: varchar("model_snapshot", { length: 100 }).notNull(),
  runDate: timestamp("run_date").notNull(),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  workspaceIdx: index("chats_workspace_idx").on(t.workspaceId),
  promptIdx: index("chats_prompt_idx").on(t.promptId),
  engineDateIdx: index("chats_engine_date_idx").on(t.engine, t.runDate),
  idempotencyIdx: uniqueIndex("chats_idempotency_idx").on(t.workspaceId, t.promptId, t.engine, t.runDate),
}));

// ─── Sources ──────────────────────────────────────────────────────────────────
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  title: text("title"),
  category: varchar("category", { length: 100 }),
}, (t) => ({
  workspaceIdx: index("sources_workspace_idx").on(t.workspaceId),
  chatIdx: index("sources_chat_idx").on(t.chatId),
  domainIdx: index("sources_domain_idx").on(t.domain),
}));

// ─── Citations ────────────────────────────────────────────────────────────────
export const citations = pgTable("citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  inlineRefMarker: varchar("inline_ref_marker", { length: 50 }),
}, (t) => ({
  workspaceIdx: index("citations_workspace_idx").on(t.workspaceId),
  chatIdx: index("citations_chat_idx").on(t.chatId),
  sourceIdx: index("citations_source_idx").on(t.sourceId),
}));

// ─── Brand Profiles ───────────────────────────────────────────────────────────
export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  projectIdx: uniqueIndex("brand_profiles_project_idx").on(t.projectId),
  workspaceIdx: index("brand_profiles_workspace_idx").on(t.workspaceId),
}));

// ─── Brand Mentions ───────────────────────────────────────────────────────────
export const brandMentions = pgTable("brand_mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  position: integer("position"),
  sentiment: real("sentiment"),
  confidence: real("confidence"),
  mentionText: text("mention_text"),
}, (t) => ({
  workspaceIdx: index("brand_mentions_workspace_idx").on(t.workspaceId),
  chatIdx: index("brand_mentions_chat_idx").on(t.chatId),
  brandIdx: index("brand_mentions_brand_idx").on(t.brandId),
}));

// ─── Earned Actions ───────────────────────────────────────────────────────────
export const earnedActions = pgTable("earned_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("todo").notNull(),
  sourceUrl: text("source_url"),
  sourceDomain: varchar("source_domain", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  projectIdx: index("earned_actions_project_idx").on(t.projectId),
  workspaceIdx: index("earned_actions_workspace_idx").on(t.workspaceId),
}));

// ─── Owned Actions ────────────────────────────────────────────────────────────
export const ownedActions = pgTable("owned_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("todo").notNull(),
  pageUrl: text("page_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  projectIdx: index("owned_actions_project_idx").on(t.projectId),
  workspaceIdx: index("owned_actions_workspace_idx").on(t.workspaceId),
}));

// ─── Brand Suggestions ────────────────────────────────────────────────────────
export const brandSuggestions = pgTable("brand_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  mentions: integer("mentions").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  projectIdx: index("brand_suggestions_project_idx").on(t.projectId),
  workspaceIdx: index("brand_suggestions_workspace_idx").on(t.workspaceId),
}));

// ─── Prompt Suggestions ───────────────────────────────────────────────────────
export const promptSuggestions = pgTable("prompt_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  query: varchar("query", { length: 500 }).notNull(),
  intentType: varchar("intent_type", { length: 50 }).default("informational").notNull(),
  volumeTier: varchar("volume_tier", { length: 50 }).default("Medium").notNull(),
  location: varchar("location", { length: 10 }).default("US").notNull(),
  topicName: varchar("topic_name", { length: 255 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  projectIdx: index("prompt_suggestions_project_idx").on(t.projectId),
  statusIdx:  index("prompt_suggestions_status_idx").on(t.status),
}));

// ─── Analytics Snapshots ──────────────────────────────────────────────────────
export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  snapshotDate: timestamp("snapshot_date").notNull(),
  visibilityScore: real("visibility_score").default(0).notNull(),
  mentionCount: integer("mention_count").default(0).notNull(),
  citationCount: integer("citation_count").default(0).notNull(),
  shareOfVoice: jsonb("share_of_voice"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  projectIdx: index("analytics_snapshots_project_idx").on(t.projectId),
  workspaceIdx: index("analytics_snapshots_workspace_idx").on(t.workspaceId),
  dateIdx: index("analytics_snapshots_date_idx").on(t.snapshotDate),
}));

// ─── Workspace Members ────────────────────────────────────────────────────────
// Accepted workspace invitations. invitedBy stays varchar (email) — audit field.
export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  invitedBy: varchar("invited_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  workspaceIdx: index("workspace_members_workspace_idx").on(t.workspaceId),
  uniqueMember: uniqueIndex("workspace_members_unique").on(t.workspaceId, t.email),
}));

// ─── Workspace Invitations ────────────────────────────────────────────────────
export const workspaceInvitations = pgTable("workspace_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  token: varchar("token", { length: 128 }).notNull(),
  invitedBy: varchar("invited_by", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex("workspace_invitations_token_idx").on(t.token),
  workspaceIdx: index("workspace_invitations_workspace_idx").on(t.workspaceId),
}));

// ─── Magic Link Tokens ────────────────────────────────────────────────────────
// Pre-auth table — no workspaceId, just email.
export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  token: varchar("token", { length: 128 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex("magic_link_tokens_token_idx").on(t.token),
  emailIdx: index("magic_link_tokens_email_idx").on(t.email),
}));

// ─── Action History ───────────────────────────────────────────────────────────
export const actionHistory = pgTable("action_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  actionId: uuid("action_id").notNull(),
  actionKind: varchar("action_kind", { length: 10 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  changedBy: varchar("changed_by", { length: 255 }), // email — audit field, no FK
  changedAt: timestamp("changed_at").defaultNow().notNull(),
}, (t) => ({
  actionIdx: index("action_history_action_idx").on(t.actionId),
  workspaceIdx: index("action_history_workspace_idx").on(t.workspaceId),
}));

// ─── Competitors ──────────────────────────────────────────────────────────────
export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  projectIdx: index("competitors_project_idx").on(t.projectId),
  workspaceIdx: index("competitors_workspace_idx").on(t.workspaceId),
}));
