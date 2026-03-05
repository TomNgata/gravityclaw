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
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    content,
    content_id UNINDEXED
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Triggers for FTS Sync ──────────────────────────────────────────────
// This keeps the FTS virtual table in sync with the memories table.

db.exec(`
  CREATE TRIGGER IF NOT EXISTS after_memories_insert AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(content, content_id) VALUES (new.content, new.id);
  END;

  CREATE TRIGGER IF NOT EXISTS after_memories_delete AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, content, content_id) VALUES('delete', old.content, old.id);
  END;
`);

console.log("📂 Database initialized at:", DB_PATH);
