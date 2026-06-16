-- Runs once on first database initialisation (empty data volume).
-- Enables pgvector so later migrations can create vector columns.
CREATE EXTENSION IF NOT EXISTS vector;
