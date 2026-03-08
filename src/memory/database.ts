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
    metadata TEXT, -- JSON for extra data
    media_type TEXT, -- e.g., 'image', 'audio', 'document'
    media_url TEXT, -- local path or remote URL
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
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
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
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

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    thinking_level TEXT DEFAULT 'off'
  );

  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cron_expression TEXT NOT NULL,
    prompt TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Procedural Migrations ─────────────────────────────────────────────
// Ensure columns exist even if tables were created in previous versions.
try {
  const tableInfo = db.prepare("PRAGMA table_info(memories)").all() as any[];
  const columns = tableInfo.map(c => c.name);
  
  if (!columns.includes("media_type")) {
    console.log("🛠️ Migrating: Adding media_type to memories");
    db.exec("ALTER TABLE memories ADD COLUMN media_type TEXT");
  }
  if (!columns.includes("media_url")) {
    console.log("🛠️ Migrating: Adding media_url to memories");
    db.exec("ALTER TABLE memories ADD COLUMN media_url TEXT");
  }
  if (!columns.includes("access_count")) {
    console.log("🛠️ Migrating: Adding access_count to memories");
    db.exec("ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0");
  }
  if (!columns.includes("last_accessed")) {
    console.log("🛠️ Migrating: Adding last_accessed to memories");
    db.exec("ALTER TABLE memories ADD COLUMN last_accessed DATETIME");
  }

  const kiInfo = db.prepare("PRAGMA table_info(knowledge_items)").all() as any[];
  const kiColumns = kiInfo.map(c => c.name);
  if (!kiColumns.includes("access_count")) {
    console.log("🛠️ Migrating: Adding access_count to knowledge_items");
    db.exec("ALTER TABLE knowledge_items ADD COLUMN access_count INTEGER DEFAULT 0");
  }
  if (!kiColumns.includes("last_accessed")) {
    console.log("🛠️ Migrating: Adding last_accessed to knowledge_items");
    db.exec("ALTER TABLE knowledge_items ADD COLUMN last_accessed DATETIME");
  }

  // Ensure user_settings exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER PRIMARY KEY,
      thinking_level TEXT DEFAULT 'off'
    )
  `);

  // Ensure scheduled_tasks exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      cron_expression TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

} catch (e) {
  console.error("Migration error:", e);
}

// ── Triggers for FTS Sync ──────────────────────────────────────────────
// Note: We use manual sync in manager.ts for memory/entities to avoid SQLite logic errors with FTS5.

console.log("📂 Database initialized at:", DB_PATH);

console.log("📂 Database initialized at:", DB_PATH);
