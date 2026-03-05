---
name: Railway Deploy
description: Skill for deploying Gravity Claw to Railway with the standard pause → test → deploy → verify cycle.
---

# Railway Deploy Skill

## Overview

Gravity Claw is deployed to Railway using Docker. The Railway CLI manages deployments, environment variables, and logs.

## Key Rules

1. **Always pause Railway before local testing.** Two bot instances polling the same Telegram token will fight over messages.
2. **Always type-check before deploying.** Run `npx tsc --noEmit` to catch errors.
3. **Railway filesystem is ephemeral.** The SQLite database restarts fresh on each deploy unless using an external volume. 

## Deployment Commands

| Task            | Command                             |
| --------------- | ----------------------------------- |
| Pause live bot  | `railway down`                      |
| Start local dev | `npm run dev`                       |
| Type-check      | `ts-node src/check.ts` (or tsc)     |
| Deploy          | `railway up --detach`               |
| View logs       | `railway logs --lines 100`          |
| Set env var     | `railway variables set KEY="value"` |

## Deployment Workflow

Use the `/deploy` workflow command to run the full cycle.
