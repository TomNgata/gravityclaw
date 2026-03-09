# 🚀 Deployment Guide

Gravity Claw is built for **High Availability (HA)** using a multi-cloud swarm strategy. This guide covers how to set up the Hub and Spokes.

## 1. Local Development
For initial setup and testing:
1. `npm install`
2. `npm run dev` (Starts via `tsx watch`)

## 2. Cloudflare Hub (Entry Point)
The "Immortal Hub" handles incoming webhooks and manages traffic.

### Local Deployment
1. Install Wrangler: `npm install -g wrangler`
2. Update `wrangler.toml` with your spoke URLs.
3. Deploy: `wrangler deploy`

### Automated Deployment (GitHub Actions)
This project is configured to deploy automatically to Cloudflare on every push to `master`.
1. Ensure the `CLOUDFLARE_API_TOKEN` secret is added to your GitHub repository.
2. The workflow is located at `.github/workflows/deploy-cloudflare.yml`.

## 3. Distributed Spokes (Railway / Render)
Spokes handle the heavy lifting (LLM logic, tool execution).

### Railway Setup
Use the provided automation scripts:
1. `auth_railway.ps1`: Authenticates with your Railway account.
2. `railway_setup.ps1`: Provisions the service and sets environment variables.

### Render Setup
1. Create a new "Web Service" from your GitHub repo.
2. Use `npm install` as the build command and `npm start` as the start command.
3. Add all required environment variables.

## 4. Environment Variables Reference

| Variable | Required | Description |
| :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Yes | Token from @BotFather. |
| `OPENROUTER_API_KEY` | Yes | Key for the LLM Swarm. |
| `SUPABASE_URL` | Yes | Your Supabase project URL. |
| `SUPABASE_ANON_KEY` | Yes | Anon/Public key for Supabase. |
| `ALLOWED_USER_IDS` | Yes | CSV list of Telegram IDs allowed to use the bot. |
| `SECRET_TOKEN` | Yes | For webhook validation (matches Cloudflare). |

### GitHub Secrets
The following secrets are required for automated deployments in GitHub Actions:

| Secret | Description |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | API Token with "Edit Cloudflare Workers" permissions. |
| `TELEGRAM_BOT_TOKEN` | Your new, rotated bot token from @BotFather. |
| `SECRET_TOKEN` | A secure, random string for webhook validation. |

## 5. Secrets Management
To keep your credentials secure, **never** hardcode them in `wrangler.toml` or any public file.

### For Cloudflare Workers
Run these commands locally to add secrets to your production worker:
```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put SECRET_TOKEN
```

## 6. Security Hardening
- **User Whitelisting**: Ensure `ALLOWED_USER_IDS` is strictly populated.
- **Admin Roles**: Use `/isAdmin` logic in `bot.ts` to protect sensitive commands.
- **Rate Limiting**: Configure `RATE_LIMIT_RPM` to prevent abuse.
