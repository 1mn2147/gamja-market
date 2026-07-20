CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Product_search_fts_idx"
  ON "Product"
  USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));

CREATE INDEX "Product_title_trgm_idx"
  ON "Product"
  USING GIN ("title" gin_trgm_ops);
