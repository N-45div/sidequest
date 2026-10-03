CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS sidequest_venues (
  id text PRIMARY KEY,
  city text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  payload jsonb NOT NULL,
  embedding vector(384) NOT NULL,
  retrieved_at timestamptz NOT NULL,
  search_document tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);
CREATE INDEX IF NOT EXISTS sidequest_venues_lexical ON sidequest_venues USING gin(search_document);
CREATE INDEX IF NOT EXISTS sidequest_venues_semantic ON sidequest_venues USING hnsw(embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS sidequest_venues_city ON sidequest_venues(city, category, retrieved_at);
