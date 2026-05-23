-- Drop old auth Agent table (leftover from previous project)
DROP TABLE IF EXISTS "Agent";
DROP TYPE IF EXISTS "AgentStatus";

-- Rename GameAgent → Agent (preserves all 24 rows)
ALTER TABLE "GameAgent" RENAME TO "Agent";
ALTER INDEX "GameAgent_publicId_key" RENAME TO "Agent_publicId_key";
ALTER INDEX "GameAgent_name_key" RENAME TO "Agent_name_key";
