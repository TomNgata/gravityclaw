# 🔌 API Reference

Gravity Claw exposes a limited but critical set of HTTP endpoints for health monitoring and webhook integration.

## 1. Public Endpoints

| Endpoint | Method | Description | Authentication |
| :--- | :--- | :--- | :--- |
| `/health` | `GET` | Returns service status, uptime, and timestamp. | None |
| `/ping` | `GET` | Simple keepalive, returns 200 OK. | None |
| `/webhook` | `POST` | Primary Telegram update endpoint. | `X-Telegram-Bot-Api-Secret-Token` |

## 2. Webhook Integration
When configured for Webhook mode (`USE_WEBHOOK=true`), Gravity Claw listens for POST requests from Telegram.

### Security
The webhook endpoint is protected by a secret token. You must set `SECRET_TOKEN` in your environment and configure the Telegram bot to send this token in the header.

### Request Format
Expects a standard Telegram `Update` object.

## 3. Internal Tool "API"
While not exposed via HTTP, the agent uses an internal tool execution system (`src/tools/index.ts`). Expert models can invoke these "pseudo-API" calls.

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `store_memory` | `content`, `category` | Saves a fact to the Supabase Brain. |
| `recall_memory` | `query` | Performs semantic search on past memories. |
| `execute_shell` | `command` | Runs a system command (Restricted). |
| `read_file` | `path` | Reads a file from the local Spoke filesystem. |

## 4. Error Responses
All endpoints return JSON responses. Errors follow this schema:

```json
{
  "status": "error",
  "message": "Human readable error description",
  "code": "INTERNAL_SERVER_ERROR"
}
```
