-- AlterTable: Add edges JSON field for workflow DAG connections
ALTER TABLE "PipelineDefinition" ADD COLUMN "edges" TEXT NOT NULL DEFAULT '[]';
