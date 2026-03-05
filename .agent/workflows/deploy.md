---
description: Deploy Gravity Claw to Railway (pause → test → deploy → verify)
---

# Deploy to Railway

Follow these steps to deploy Gravity Claw to Railway.

// turbo-all

## 1. Pause the live Railway service

```bash
railway down
```

## 2. Type-check before deploying

```bash
npx tsc --noEmit
```

## 3. Deploy to Railway

```bash
railway up --detach
```

## 4. Verify the deployment

```bash
railway logs --lines 40
```
