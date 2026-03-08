# 🛠️ Troubleshooting Guide

This guide addresses common issues encountered when deploying or running the Gravity Claw swarm.

## 1. Authentication & API Errors

### `429: Too Many Requests` (OpenRouter)
- **Cause**: Reaching rate limits on specific free models.
- **Solution**: Gravity Claw automatically falls back to secondary models. If all fail, check your OpenRouter credit balance or wait for the limit to reset.

### `401: Unauthorized` (Telegram)
- **Cause**: Invalid `TELEGRAM_BOT_TOKEN`.
- **Solution**: Verify the token with @BotFather and ensure it is correctly set in your `.env` file.

## 2. Database & Persistence

### `vector_dimension_mismatch`
- **Cause**: Supabase table expects 1536 dimensions but receives a different size.
- **Solution**: Ensure you are using `text-embedding-3-small` or similar models that output exactly 1536 dimensions.

### Connection Timed Out
- **Cause**: Spoke node cannot reach Supabase.
- **Solution**: Check if your Supabase project is "Paused" (common on free tiers). Restart the project via the Supabase dashboard.

## 3. Windows-Specific Issues

### `spawn npx ENOENT`
- **Cause**: Node.js cannot find the `npx` command in the environment path.
- **Solution**: Use `shell: true` in the spawn options (already implemented in `src/mcp/client.ts`). Ensure Node.js is correctly added to your system PATH.

### PowerShell Script Execution Policy
- **Cause**: Windows blocks running `.ps1` scripts by default.
- **Solution**: Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` in an administrator PowerShell window.

## 4. MCP Tools

### Tools Not Appearing
- **Cause**: MCP server failed to start or connection was refused.
- **Solution**: Check the console logs for `🔌 Connecting to MCP server: [name]...`. Ensure the server command (e.g., `npx`) is valid and the dependencies are installed.
