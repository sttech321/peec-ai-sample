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
import { sql } from "drizzle-orm";

// Projects
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("projects_workspace_idx").on(table.workspaceId),
}));

// Topics
export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("topics_workspace_idx").on(table.workspaceId),
  projectIdx: index("topics_project_idx").on(table.projectId),
}));

// Prompts
export const prompts = pgTable("prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  volumeTier: varchar("volume_tier", { length: 50 }).notNull(), // Very High, High, Medium, Low
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("prompts_workspace_idx").on(table.workspaceId),
  projectIdx: index("prompts_project_idx").on(table.projectId),
  topicIdx: index("prompts_topic_idx").on(table.topicId),
}));

// Tags
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }),
  color: varchar("color", { length: 50 }).default("gray").notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("tags_workspace_idx").on(table.workspaceId),
  projectIdx: index("tags_project_idx").on(table.projectId),
}));

// PromptTags (Many-to-Many)
export const promptTags = pgTable("prompt_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  promptId: uuid("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({
  workspaceIdx: index("prompt_tags_workspace_idx").on(table.workspaceId),
  promptIdx: index("prompt_tags_prompt_idx").on(table.promptId),
}));

// Brands
export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  isOwn: boolean("is_own").default(false).notNull(),
  aliases: text("aliases").array().notNull(),
  domains: text("domains").array().notNull(),
}, (table) => ({
  workspaceIdx: index("brands_workspace_idx").on(table.workspaceId),
  projectIdx: index("brands_project_idx").on(table.projectId),
}));

// Chats (The AI response)
export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  promptId: uuid("prompt_id").notNull().references(() => prompts.id, { onDelete: "cascade" }),
  engine: varchar("engine", { length: 100 }).notNull(), // ChatGPT, Claude, Perplexity, Gemini, AI Overviews
  modelSnapshot: varchar("model_snapshot", { length: 100 }).notNull(), // e.g. gpt-5-2026-04-15
  runDate: timestamp("run_date").notNull(),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  workspaceIdx: index("chats_workspace_idx").on(table.workspaceId),
  promptIdx: index("chats_prompt_idx").on(table.promptId),
  engineDateIdx: index("chats_engine_date_idx").on(table.engine, table.runDate),
  idempotencyIdx: uniqueIndex("chats_idempotency_idx").on(table.workspaceId, table.promptId, table.engine, table.runDate),
}));

// Sources
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  title: text("title"),
  category: varchar("category", { length: 100 }), // owned, editorial, reference, ugc
}, (table) => ({
  workspaceIdx: index("sources_workspace_idx").on(table.workspaceId),
  chatIdx: index("sources_chat_idx").on(table.chatId),
  domainIdx: index("sources_domain_idx").on(table.domain),
}));

// Citations (Subset of sources with inline ref)
export const citations = pgTable("citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  inlineRefMarker: varchar("inline_ref_marker", { length: 50 }),
}, (table) => ({
  workspaceIdx: index("citations_workspace_idx").on(table.workspaceId),
  chatIdx: index("citations_chat_idx").on(table.chatId),
  sourceIdx: index("citations_source_idx").on(table.sourceId),
}));

// Brand Profile (semantic configuration layer for the project — feeds AI prompt generation,
// visibility scoring, and competitor analysis. One row per project.)
export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: uniqueIndex("brand_profiles_project_idx").on(table.projectId),
  workspaceIdx: index("brand_profiles_workspace_idx").on(table.workspaceId),
}));

// Brand Mentions
export const brandMentions = pgTable("brand_mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  position: integer("position"), // rank 1, 2, 3...
  sentiment: real("sentiment"), // 0-100 score
  confidence: real("confidence"), // extraction confidence
  mentionText: text("mention_text"),
}, (table) => ({
  workspaceIdx: index("brand_mentions_workspace_idx").on(table.workspaceId),
  chatIdx: index("brand_mentions_chat_idx").on(table.chatId),
  brandIdx: index("brand_mentions_brand_idx").on(table.brandId),
}));

// Earned Actions (Recommendations)
export const earnedActions = pgTable("earned_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // e.g., 'Listicle', 'Article', 'Reddit', 'Forum'
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 20 }).notNull(), // High, Medium, Low
  status: varchar("status", { length: 20 }).default("todo").notNull(), // todo, done, declined
  sourceUrl: text("source_url"),
  sourceDomain: varchar("source_domain", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("earned_actions_project_idx").on(table.projectId),
  workspaceIdx: index("earned_actions_workspace_idx").on(table.workspaceId),
}));

// Owned Actions (On-page recommendations)
export const ownedActions = pgTable("owned_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 20 }).notNull(), // High, Medium, Low
  status: varchar("status", { length: 20 }).default("todo").notNull(), // todo, done, declined
  pageUrl: text("page_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("owned_actions_project_idx").on(table.projectId),
  workspaceIdx: index("owned_actions_workspace_idx").on(table.workspaceId),
}));

// Brand Suggestions (Right sidebar on Brands page)
export const brandSuggestions = pgTable("brand_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }),
  mentions: integer("mentions").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, accepted, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("brand_suggestions_project_idx").on(table.projectId),
  workspaceIdx: index("brand_suggestions_workspace_idx").on(table.workspaceId),
}));

// Analytics Snapshots (Daily metrics for charts)
export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  snapshotDate: timestamp("snapshot_date").notNull(),
  visibilityScore: real("visibility_score").default(0).notNull(),
  mentionCount: integer("mention_count").default(0).notNull(),
  citationCount: integer("citation_count").default(0).notNull(),
  shareOfVoice: jsonb("share_of_voice"), // JSON of brand -> score
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("analytics_snapshots_project_idx").on(table.projectId),
  workspaceIdx: index("analytics_snapshots_workspace_idx").on(table.workspaceId),
  dateIdx: index("analytics_snapshots_date_idx").on(table.snapshotDate),
}));

// Competitors (Module 6)
export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: varchar("workspace_id", { length: 255 }).notNull(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("competitors_project_idx").on(table.projectId),
  workspaceIdx: index("competitors_workspace_idx").on(table.workspaceId),
}));
