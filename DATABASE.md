# 🗄️ Database System (Swarm Brain)

Gravity Claw uses **Supabase (PostgreSQL)** as its centralized cloud persistence layer. This allows the bot to maintain a unified memory even when running across multiple distributed nodes.

## 1. Core Schema

### `conversations`
Logs every message sent to and from the bot.
- `id`: Unique identifier.
- `user_id`: Telegram user ID.
- `chat_id`: Telegram chat/group ID (for isolation).
- `message`: Incoming text.
- `response`: Outgoing AI response.
- `created_at`: Timestamp.

### `memories`
Stores extracted facts for long-term recall.
- `content`: The fact text.
- `embedding`: **Vector (1536)** - OpenAI embedding for semantic search.
- `chat_id`: Links memory to a specific chat context.
- `importance`: Weight (1-5) used for ranking results.
- `last_accessed`: For LRU eviction logic.

### `knowledge_items`
Hand-curated facts and rules.
- `title`: Subject.
- `content`: Detailed data.

## 2. Semantic Search (pgvector)
Gravity Claw uses the `pgvector` extension to perform cosine similarity searches.

### RPC: `match_memories`
The system invokes a PostgreSQL function to find the most relevant memories:
```sql
CREATE OR REPLACE FUNCTION match_memories (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_chat_id bigint
) RETURNS TABLE (...)
```

## 3. Group Isolation Logic
To ensure privacy and contextual relevance:
- **Private Chats**: `chat_id` matches the `user_id`.
- **Groups**: `chat_id` is the Telegram group ID (usually negative).
- All queries in `manager.ts` include a `.eq('chat_id', chatId)` filter.

## 4. Maintenance
- **Pruning**: The system automatically consolidates old history to prevent context window overflow.
- **Reorganization**: Periodically triggers a background job to re-index and link related memories.
