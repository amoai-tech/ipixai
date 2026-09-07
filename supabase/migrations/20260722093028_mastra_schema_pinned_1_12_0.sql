-- IPI-628 · MASTRA-SUPABASE-002 — Version-pinned Mastra schema migration.
--
-- Creates the private "mastra" schema + the 24-table runtime subset. NOT
-- reproducible by re-running the installed @mastra/pg@1.12.0 package's
-- exportSchemas('mastra') alone: a fresh call to that function today emits
-- "organizationId" on only 1 table (mastra_ai_spans), but this file has it
-- on 7 (mastra_ai_spans, mastra_scorers, mastra_scorer_definitions,
-- mastra_datasets, mastra_dataset_items, mastra_experiments,
-- mastra_experiment_results) — plus projectId/batchId/datasetId/
-- datasetItemId/candidateKey/candidateId/externalId/toolMocks/
-- toolMockReport, none of which the generator (or @mastra/core's own
-- EXPERIMENTS_SCHEMA/DATASETS_SCHEMA/SCORERS_SCHEMA constants) define.
-- These 21 extra columns match the live remote's already-existing structure
-- exactly (verified via information_schema.columns) — this file records
-- reality, generated-then-reconciled against the live schema, not purely
-- generated. See IPI-616 ADR, tasks/mastra/ipi-616-storage-schema-adr.md,
-- Decision 1 + 2, and PR #601's discussion thread for the full verification.
--
-- Excludes 9 Mastra Studio/agent-builder tables (MCP clients/servers, Skills,
-- Workspaces) that iPix's production agents never use.
--
-- This migration is schema-DDL only: no grants, no RLS policies (→ IPI-629),
-- no app wiring (→ IPI-630). The existing public.mastra_* tables (33, created
-- by mastra dev's auto-init) are untouched by this migration — a separate
-- cutover ticket will retire them later.

CREATE SCHEMA IF NOT EXISTS "mastra";


            CREATE TABLE IF NOT EXISTS "mastra"."mastra_threads" (
              "id" TEXT PRIMARY KEY NOT NULL,
"resourceId" TEXT NOT NULL,
"title" TEXT NOT NULL,
"metadata" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_messages" (
              "id" TEXT PRIMARY KEY NOT NULL,
"thread_id" TEXT NOT NULL,
"content" TEXT NOT NULL,
"role" TEXT NOT NULL,
"type" TEXT NOT NULL,
"createdAt" TIMESTAMP NOT NULL,
"resourceId" TEXT ,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_resources" (
              "id" TEXT PRIMARY KEY NOT NULL,
"workingMemory" TEXT ,
"metadata" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_observational_memory" (
              "id" TEXT PRIMARY KEY NOT NULL,
"lookupKey" TEXT NOT NULL,
"scope" TEXT NOT NULL,
"resourceId" TEXT ,
"threadId" TEXT ,
"activeObservations" TEXT NOT NULL,
"activeObservationsPendingUpdate" TEXT ,
"originType" TEXT NOT NULL,
"config" TEXT NOT NULL,
"generationCount" INTEGER NOT NULL,
"lastObservedAt" TIMESTAMP ,
"lastReflectionAt" TIMESTAMP ,
"pendingMessageTokens" INTEGER NOT NULL,
"totalTokensObserved" INTEGER NOT NULL,
"observationTokenCount" INTEGER NOT NULL,
"isObserving" BOOLEAN NOT NULL,
"isReflecting" BOOLEAN NOT NULL,
"observedMessageIds" JSONB ,
"observedTimezone" TEXT ,
"bufferedObservations" TEXT ,
"bufferedObservationTokens" INTEGER ,
"bufferedMessageIds" JSONB ,
"bufferedReflection" TEXT ,
"bufferedReflectionTokens" INTEGER ,
"bufferedReflectionInputTokens" INTEGER ,
"reflectedObservationLineCount" INTEGER ,
"bufferedObservationChunks" JSONB ,
"isBufferingObservation" BOOLEAN NOT NULL,
"isBufferingReflection" BOOLEAN NOT NULL,
"lastBufferedAtTokens" INTEGER NOT NULL,
"lastBufferedAtTime" TIMESTAMP ,
"metadata" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"lastObservedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"lastReflectionAtZ" TIMESTAMPTZ DEFAULT NOW(),
"lastBufferedAtTimeZ" TIMESTAMPTZ DEFAULT NOW(),
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          
CREATE INDEX IF NOT EXISTS "mastra_idx_om_lookup_key" ON "mastra"."mastra_observational_memory" ("lookupKey");
CREATE INDEX IF NOT EXISTS "mastra_mastra_threads_resourceid_createdat_idx" ON "mastra"."mastra_threads" ("resourceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "mastra_mastra_messages_thread_id_createdat_idx" ON "mastra"."mastra_messages" ("thread_id", "createdAt" DESC);

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_ai_spans" (
              "traceId" TEXT NOT NULL,
"spanId" TEXT NOT NULL,
"name" TEXT NOT NULL,
"spanType" TEXT NOT NULL,
"isEvent" BOOLEAN NOT NULL,
"startedAt" TIMESTAMP NOT NULL,
"parentSpanId" TEXT ,
"entityType" TEXT ,
"entityId" TEXT ,
"entityName" TEXT ,
"parentEntityType" TEXT ,
"parentEntityId" TEXT ,
"parentEntityName" TEXT ,
"rootEntityType" TEXT ,
"rootEntityId" TEXT ,
"rootEntityName" TEXT ,
"userId" TEXT ,
"organizationId" TEXT ,
"resourceId" TEXT ,
"runId" TEXT ,
"sessionId" TEXT ,
"threadId" TEXT ,
"requestId" TEXT ,
"environment" TEXT ,
"serviceName" TEXT ,
"scope" JSONB ,
"entityVersionId" TEXT ,
"parentEntityVersionId" TEXT ,
"rootEntityVersionId" TEXT ,
"experimentId" TEXT ,
"source" TEXT ,
"metadata" JSONB ,
"tags" JSONB ,
"attributes" JSONB ,
"links" JSONB ,
"input" JSONB ,
"output" JSONB ,
"error" JSONB ,
"endedAt" TIMESTAMP ,
"requestContext" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP ,
"startedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"endedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = lower('mastra_mastra_ai_spans_traceid_spanid_pk') AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'mastra')
              ) THEN
                ALTER TABLE "mastra"."mastra_ai_spans"
                ADD CONSTRAINT mastra_mastra_ai_spans_traceid_spanid_pk
                PRIMARY KEY ("traceId", "spanId");
              END IF;
            END $$;
            
          
-- search_path pinned (public + pg_temp) — same hardening as
-- 20260121084425_fix_function_search_path_dynamic.sql. Empty search_path
-- would break unqualified NOW() / TG_OP in this body.
CREATE OR REPLACE FUNCTION "mastra".trigger_set_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW."createdAt" = NOW();
        NEW."updatedAt" = NOW();
        NEW."createdAtZ" = NOW();
        NEW."updatedAtZ" = NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        NEW."updatedAt" = NOW();
        NEW."updatedAtZ" = NOW();
        NEW."createdAt" = OLD."createdAt";
        NEW."createdAtZ" = OLD."createdAtZ";
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "mastra_ai_spans_timestamps" ON "mastra"."mastra_ai_spans";

CREATE TRIGGER "mastra_ai_spans_timestamps"
    BEFORE INSERT OR UPDATE ON "mastra"."mastra_ai_spans"
    FOR EACH ROW
    EXECUTE FUNCTION "mastra".trigger_set_timestamps();
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_traceid_startedat_idx" ON "mastra"."mastra_ai_spans" ("traceId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_parentspanid_startedat_idx" ON "mastra"."mastra_ai_spans" ("parentSpanId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_name_idx" ON "mastra"."mastra_ai_spans" ("name");
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_spantype_startedat_idx" ON "mastra"."mastra_ai_spans" ("spanType", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_root_spans_idx" ON "mastra"."mastra_ai_spans" ("startedAt" DESC) WHERE "parentSpanId" IS NULL;
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_entitytype_entityid_idx" ON "mastra"."mastra_ai_spans" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_entitytype_entityname_idx" ON "mastra"."mastra_ai_spans" ("entityType", "entityName");
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_orgid_userid_idx" ON "mastra"."mastra_ai_spans" ("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_metadata_gin_idx" ON "mastra"."mastra_ai_spans" USING gin ("metadata");
CREATE INDEX IF NOT EXISTS "mastra_mastra_ai_spans_tags_gin_idx" ON "mastra"."mastra_ai_spans" USING gin ("tags");

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_scorers" (
              "id" TEXT PRIMARY KEY NOT NULL,
"scorerId" TEXT NOT NULL,
"traceId" TEXT ,
"spanId" TEXT ,
"runId" TEXT NOT NULL,
"scorer" JSONB NOT NULL,
"preprocessStepResult" JSONB ,
"extractStepResult" JSONB ,
"analyzeStepResult" JSONB ,
"score" FLOAT NOT NULL,
"reason" TEXT ,
"metadata" JSONB ,
"preprocessPrompt" TEXT ,
"extractPrompt" TEXT ,
"generateScorePrompt" TEXT ,
"generateReasonPrompt" TEXT ,
"analyzePrompt" TEXT ,
"reasonPrompt" TEXT ,
"input" JSONB NOT NULL,
"output" JSONB NOT NULL,
"additionalContext" JSONB ,
"requestContext" JSONB ,
"entityType" TEXT ,
"entity" JSONB ,
"entityId" TEXT ,
"source" TEXT NOT NULL,
"resourceId" TEXT ,
"threadId" TEXT ,
"organizationId" TEXT ,
"projectId" TEXT ,
"batchId" TEXT ,
"datasetId" TEXT ,
"datasetItemId" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          
CREATE INDEX IF NOT EXISTS "mastra_mastra_scores_trace_id_span_id_created_at_idx" ON "mastra"."mastra_scorers" ("traceId", "spanId", "createdAt" DESC);

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_scorer_definitions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"status" TEXT NOT NULL,
"activeVersionId" TEXT ,
"authorId" TEXT ,
"organizationId" TEXT ,
"projectId" TEXT ,
"metadata" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_scorer_definition_versions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"scorerDefinitionId" TEXT NOT NULL,
"versionNumber" INTEGER NOT NULL,
"name" TEXT NOT NULL,
"description" TEXT ,
"type" TEXT NOT NULL,
"model" JSONB ,
"instructions" TEXT ,
"scoreRange" JSONB ,
"presetConfig" JSONB ,
"defaultSampling" JSONB ,
"changedFields" JSONB ,
"changeMessage" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          
CREATE UNIQUE INDEX IF NOT EXISTS "mastra_idx_scorer_definition_versions_def_version" ON "mastra"."mastra_scorer_definition_versions" ("scorerDefinitionId", "versionNumber");

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_prompt_blocks" (
              "id" TEXT PRIMARY KEY NOT NULL,
"status" TEXT NOT NULL,
"activeVersionId" TEXT ,
"authorId" TEXT ,
"metadata" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_prompt_block_versions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"blockId" TEXT NOT NULL,
"versionNumber" INTEGER NOT NULL,
"name" TEXT NOT NULL,
"description" TEXT ,
"content" TEXT NOT NULL,
"rules" JSONB ,
"requestContextSchema" JSONB ,
"changedFields" JSONB ,
"changeMessage" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          
CREATE UNIQUE INDEX IF NOT EXISTS "mastra_idx_prompt_block_versions_block_version" ON "mastra"."mastra_prompt_block_versions" ("blockId", "versionNumber");

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_agents" (
              "id" TEXT PRIMARY KEY NOT NULL,
"status" TEXT NOT NULL,
"activeVersionId" TEXT ,
"authorId" TEXT ,
"visibility" TEXT ,
"metadata" JSONB ,
"favoriteCount" INTEGER ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_agent_versions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"agentId" TEXT NOT NULL,
"versionNumber" INTEGER NOT NULL,
"name" TEXT NOT NULL,
"description" TEXT ,
"instructions" TEXT NOT NULL,
"model" JSONB NOT NULL,
"tools" JSONB ,
"defaultOptions" JSONB ,
"workflows" JSONB ,
"agents" JSONB ,
"integrationTools" JSONB ,
"toolProviders" JSONB ,
"inputProcessors" JSONB ,
"outputProcessors" JSONB ,
"memory" JSONB ,
"scorers" JSONB ,
"mcpClients" JSONB ,
"requestContextSchema" JSONB ,
"workspace" JSONB ,
"skills" JSONB ,
"skillsFormat" TEXT ,
"browser" JSONB ,
"changedFields" JSONB ,
"changeMessage" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_workflow_snapshot" (
              "workflow_name" TEXT NOT NULL,
"run_id" TEXT NOT NULL,
"resourceId" TEXT ,
"snapshot" JSONB NOT NULL,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
            -- IPI-628 fix (external review, 2026-07-22): the original generated
            -- guard skipped adding the constraint entirely if *either* a
            -- same-named pg_constraint row *or* a same-named index already
            -- existed — so a leftover index from an earlier partial apply
            -- silently left this table with no formal UNIQUE constraint,
            -- even though Mastra's INSERT ... ON CONFLICT (workflow_name,
            -- run_id) depends on one. Live-verified this had already
            -- happened: production has the index but no named constraint.
            -- Fixed to only skip when the constraint itself already exists;
            -- if a same-named index is present without it, promote that
            -- index into a real constraint (instant, reuses the index, no
            -- table rewrite) instead of silently doing nothing.
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = lower('mastra_mastra_workflow_snapshot_workflow_name_run_id_key') AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'mastra')
              ) THEN
                IF EXISTS (
                  SELECT 1 FROM pg_indexes WHERE indexname = lower('mastra_mastra_workflow_snapshot_workflow_name_run_id_key') AND schemaname = 'mastra'
                ) THEN
                  ALTER TABLE "mastra"."mastra_workflow_snapshot"
                  ADD CONSTRAINT mastra_mastra_workflow_snapshot_workflow_name_run_id_key
                  UNIQUE USING INDEX mastra_mastra_workflow_snapshot_workflow_name_run_id_key;
                ELSE
                  ALTER TABLE "mastra"."mastra_workflow_snapshot"
                  ADD CONSTRAINT mastra_mastra_workflow_snapshot_workflow_name_run_id_key
                  UNIQUE (workflow_name, run_id);
                END IF;
              END IF;
              IF EXISTS (
                SELECT 1 FROM pg_index i
                JOIN pg_class c ON i.indexrelid = c.oid
                JOIN pg_namespace n ON c.relnamespace = n.oid
                WHERE c.relname = lower('mastra_mastra_workflow_snapshot_workflow_name_run_id_key')
                AND n.nspname = 'mastra'
                AND i.indisreplident = false
              ) THEN
                ALTER TABLE "mastra"."mastra_workflow_snapshot"
                REPLICA IDENTITY USING INDEX mastra_mastra_workflow_snapshot_workflow_name_run_id_key;
              END IF;
            END $$;
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_datasets" (
              "id" TEXT PRIMARY KEY NOT NULL,
"name" TEXT NOT NULL,
"description" TEXT ,
"metadata" JSONB ,
"inputSchema" JSONB ,
"groundTruthSchema" JSONB ,
"requestContextSchema" JSONB ,
"tags" JSONB ,
"targetType" TEXT ,
"targetIds" JSONB ,
"scorerIds" JSONB ,
"organizationId" TEXT ,
"projectId" TEXT ,
"candidateKey" TEXT ,
"candidateId" TEXT ,
"version" INTEGER NOT NULL,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_dataset_items" (
              "id" TEXT NOT NULL,
"datasetId" TEXT NOT NULL,
"datasetVersion" INTEGER NOT NULL,
"externalId" TEXT ,
"organizationId" TEXT ,
"projectId" TEXT ,
"validTo" INTEGER ,
"isDeleted" BOOLEAN NOT NULL,
"input" JSONB NOT NULL,
"groundTruth" JSONB ,
"requestContext" JSONB ,
"metadata" JSONB ,
"source" JSONB ,
"expectedTrajectory" JSONB ,
"toolMocks" JSONB ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW(),
PRIMARY KEY ("id", "datasetVersion")
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_dataset_versions" (
              "id" TEXT PRIMARY KEY NOT NULL,
"datasetId" TEXT NOT NULL,
"version" INTEGER NOT NULL,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_experiments" (
              "id" TEXT PRIMARY KEY NOT NULL,
"name" TEXT ,
"description" TEXT ,
"metadata" JSONB ,
"datasetId" TEXT ,
"datasetVersion" INTEGER ,
"targetType" TEXT NOT NULL,
"targetId" TEXT NOT NULL,
"status" TEXT NOT NULL,
"totalItems" INTEGER NOT NULL,
"succeededCount" INTEGER NOT NULL,
"failedCount" INTEGER NOT NULL,
"skippedCount" INTEGER NOT NULL,
"startedAt" TIMESTAMP ,
"completedAt" TIMESTAMP ,
"agentVersion" TEXT ,
"organizationId" TEXT ,
"projectId" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"startedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"completedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_experiment_results" (
              "id" TEXT PRIMARY KEY NOT NULL,
"experimentId" TEXT NOT NULL,
"itemId" TEXT NOT NULL,
"itemDatasetVersion" INTEGER ,
"input" JSONB NOT NULL,
"output" JSONB ,
"groundTruth" JSONB ,
"error" JSONB ,
"startedAt" TIMESTAMP NOT NULL,
"completedAt" TIMESTAMP NOT NULL,
"retryCount" INTEGER NOT NULL,
"traceId" TEXT ,
"status" TEXT ,
"tags" JSONB ,
"toolMockReport" JSONB ,
"organizationId" TEXT ,
"projectId" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"startedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"completedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"createdAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_background_tasks" (
              "id" TEXT PRIMARY KEY NOT NULL,
"tool_call_id" TEXT NOT NULL,
"tool_name" TEXT NOT NULL,
"agent_id" TEXT NOT NULL,
"run_id" TEXT NOT NULL,
"thread_id" TEXT ,
"resource_id" TEXT ,
"status" TEXT NOT NULL,
"args" JSONB NOT NULL,
"result" JSONB ,
"error" JSONB ,
"suspend_payload" JSONB ,
"retry_count" INTEGER NOT NULL,
"max_retries" INTEGER NOT NULL,
"timeout_ms" INTEGER NOT NULL,
"createdAt" TIMESTAMP NOT NULL,
"startedAt" TIMESTAMP ,
"suspendedAt" TIMESTAMP ,
"completedAt" TIMESTAMP ,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"startedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"suspendedAtZ" TIMESTAMPTZ DEFAULT NOW(),
"completedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          
CREATE INDEX IF NOT EXISTS "mastra_mastra_bg_tasks_status_created_at_idx" ON "mastra"."mastra_background_tasks" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "mastra_mastra_bg_tasks_agent_status_idx" ON "mastra"."mastra_background_tasks" ("agent_id", "status");
CREATE INDEX IF NOT EXISTS "mastra_mastra_bg_tasks_thread_idx" ON "mastra"."mastra_background_tasks" ("thread_id", "createdAt");
CREATE INDEX IF NOT EXISTS "mastra_mastra_bg_tasks_tool_call_idx" ON "mastra"."mastra_background_tasks" ("tool_call_id");

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_favorites" (
              "userId" TEXT NOT NULL,
"entityType" TEXT NOT NULL,
"entityId" TEXT NOT NULL,
"createdAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
PRIMARY KEY ("userId", "entityType", "entityId")
            );
            
          
          
-- Manual fix: @mastra/pg@1.12.0's favorites-domain exportSchemas() output
-- omits the trailing semicolon here, breaking multi-statement application.
CREATE INDEX IF NOT EXISTS idx_favorites_entity ON "mastra"."mastra_favorites" ("entityType", "entityId");

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_channel_installations" (
              "id" TEXT PRIMARY KEY NOT NULL,
"platform" TEXT NOT NULL,
"agentId" TEXT NOT NULL,
"status" TEXT NOT NULL,
"webhookId" TEXT ,
"data" JSONB NOT NULL,
"configHash" TEXT ,
"error" TEXT ,
"createdAt" TIMESTAMP NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_channel_config" (
              "platform" TEXT PRIMARY KEY NOT NULL,
"data" JSONB NOT NULL,
"updatedAt" TIMESTAMP NOT NULL,
"updatedAtZ" TIMESTAMPTZ DEFAULT NOW()
            );
            
          
          
CREATE UNIQUE INDEX IF NOT EXISTS "mastra_idx_channel_installations_webhook" ON "mastra"."mastra_channel_installations" ("webhookId");
CREATE INDEX IF NOT EXISTS "mastra_idx_channel_installations_platform_agent" ON "mastra"."mastra_channel_installations" ("platform", "agentId");

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_schedules" (
              "id" TEXT PRIMARY KEY NOT NULL,
"target" JSONB NOT NULL,
"cron" TEXT NOT NULL,
"timezone" TEXT ,
"status" TEXT NOT NULL,
"next_fire_at" BIGINT NOT NULL,
"last_fire_at" BIGINT ,
"last_run_id" TEXT ,
"created_at" BIGINT NOT NULL,
"updated_at" BIGINT NOT NULL,
"metadata" JSONB ,
"owner_type" TEXT ,
"owner_id" TEXT 
            );
            
          
          

            CREATE TABLE IF NOT EXISTS "mastra"."mastra_schedule_triggers" (
              "id" TEXT PRIMARY KEY NOT NULL,
"schedule_id" TEXT NOT NULL,
"run_id" TEXT ,
"scheduled_fire_at" BIGINT NOT NULL,
"actual_fire_at" BIGINT NOT NULL,
"outcome" TEXT NOT NULL,
"error" TEXT ,
"trigger_kind" TEXT NOT NULL,
"parent_trigger_id" TEXT ,
"metadata" JSONB 
            );
            
          
          
CREATE INDEX IF NOT EXISTS "mastra_idx_mastra_schedules_status_next_fire" ON "mastra"."mastra_schedules" ("status", "next_fire_at");
CREATE INDEX IF NOT EXISTS "mastra_idx_mastra_schedule_triggers_schedule_fire" ON "mastra"."mastra_schedule_triggers" ("schedule_id", "actual_fire_at" DESC);
