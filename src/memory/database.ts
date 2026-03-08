import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

// ── Supabase Client ────────────────────────────────────────────────────
// This replaces the local SQLite 'db' instance.
// All operations should now be asynchronous.
export const supabase = createClient(supabaseUrl, supabaseKey);

// For backwards compatibility during transition, we keep the export name if possible,
// but note that 'db' is now a Supabase client, not a better-sqlite3 instance.
// Note: Code using db.prepare() or db.exec() will need refactoring.
export const db = supabase; 

console.log("🌌 Supabase Swarm Brain connected:", supabaseUrl);
