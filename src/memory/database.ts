import DatabaseConstructor, { Database } from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "gravity-claw.db");

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });

export const db: Database = new DatabaseConstructor(DB_PATH);

// ── Initialize Schema ──────────────────────────────────────────────────
// memories: for long-term storage of facts
// conversations: for short-term history logging
// memories_fts: virtual table for full-text search (FTS5)

db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'facts',
    embedding BLOB,
    importance INTEGER DEFAULT 1,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content,
    content_id UNINDEXED
  );

  CREATE TABLE IF NOT EXISTS knowledge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    embedding BLOB,
    source_message_ids TEXT, -- JSON array of conversation IDs
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY, -- UUID or unique name
    name TEXT NOT NULL,
    type TEXT DEFAULT 'concept',
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
    name,
    content_id UNINDEXED
  );

  CREATE TABLE IF NOT EXISTS relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_id) REFERENCES entities(id),
    FOREIGN KEY(target_id) REFERENCES entities(id)
  );
`);

// ── Triggers for FTS Sync ──────────────────────────────────────────────
// This keeps the FTS virtual tables in sync.

db.exec(`
  CREATE TRIGGER IF NOT EXISTS after_memories_insert AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(content, content_id) VALUES (new.content, new.id);
  END;

  CREATE TRIGGER IF NOT EXISTS after_entities_insert AFTER INSERT ON entities BEGIN
    INSERT INTO entities_fts(name, content_id) VALUES (new.name, new.id);
  END;
`);

console.log("📂 Database initialized at:", DB_PATH);
