CREATE TABLE "brand_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"chat_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"position" integer,
	"sentiment" real,
	"confidence" real,
	"mention_text" text
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_own" boolean DEFAULT false NOT NULL,
	"aliases" text[] NOT NULL,
	"domains" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"prompt_id" uuid NOT NULL,
	"engine" varchar(100) NOT NULL,
	"model_snapshot" varchar(100) NOT NULL,
	"run_date" timestamp NOT NULL,
	"raw_response" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"chat_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"inline_ref_marker" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"prompt_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"project_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"query" text NOT NULL,
	"volume_tier" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"chat_id" uuid NOT NULL,
	"url" text NOT NULL,
	"domain" varchar(255) NOT NULL,
	"title" text,
	"category" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar(255) NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_mentions" ADD CONSTRAINT "brand_mentions_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_mentions" ADD CONSTRAINT "brand_mentions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tags" ADD CONSTRAINT "prompt_tags_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tags" ADD CONSTRAINT "prompt_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_mentions_workspace_idx" ON "brand_mentions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "brand_mentions_chat_idx" ON "brand_mentions" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "brand_mentions_brand_idx" ON "brand_mentions" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "brands_workspace_idx" ON "brands" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "brands_project_idx" ON "brands" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "chats_workspace_idx" ON "chats" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "chats_prompt_idx" ON "chats" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "chats_engine_date_idx" ON "chats" USING btree ("engine","run_date");--> statement-breakpoint
CREATE UNIQUE INDEX "chats_idempotency_idx" ON "chats" USING btree ("workspace_id","prompt_id","engine","run_date");--> statement-breakpoint
CREATE INDEX "citations_workspace_idx" ON "citations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "citations_chat_idx" ON "citations" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "citations_source_idx" ON "citations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "prompt_tags_workspace_idx" ON "prompt_tags" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "prompt_tags_prompt_idx" ON "prompt_tags" USING btree ("prompt_id");--> statement-breakpoint
CREATE INDEX "prompts_workspace_idx" ON "prompts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "prompts_project_idx" ON "prompts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "prompts_topic_idx" ON "prompts" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "sources_workspace_idx" ON "sources" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sources_chat_idx" ON "sources" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "sources_domain_idx" ON "sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "tags_workspace_idx" ON "tags" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "topics_workspace_idx" ON "topics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "topics_project_idx" ON "topics" USING btree ("project_id");