# Production domain — MRV System

| | |
|---|---|
| **Production URL** | https://mrv.essprmsc.com |
| **VM IP** | `101.50.87.168` |
| **Platform ops** | [essprmsc-platform](https://github.com/YOUR_ORG/essprmsc-platform) |

DNS, TLS, and rollout checklists live in the **platform repo**, not here.

## Start here

→ **[Master checklist](https://github.com/YOUR_ORG/essprmsc-platform/blob/main/runbooks/MASTER-CHECKLIST.md)**

MRV-specific HTTPS steps:

→ **[04-https-mrv.md](https://github.com/YOUR_ORG/essprmsc-platform/blob/main/runbooks/04-https-mrv.md)**

## App-specific env (production)

After HTTPS is enabled, set in `.env.docker`:

```env
PUBLIC_ORIGIN=https://mrv.essprmsc.com
PASSWORD_RESET_FRONTEND_URL=https://mrv.essprmsc.com
```

**Mobile app** (`MobileOperator/src/config/env.ts`): uses `http://mrv.essprmsc.com/api` until HTTPS (port 443) is live on the VM. After TLS is enabled, switch to `https://mrv.essprmsc.com/api` and rebuild the release APK/IPA.

Then redeploy:

```bash
docker compose --env-file .env.docker up -d --build
```

## Files in this repo

| File | Purpose |
|------|---------|
| `deploy/nginx/default.conf` | Uncomment HTTPS block after certs are in `deploy/certs/` |
| `deploy/certs/` | Let's Encrypt `fullchain.pem` + `privkey.pem` |
| `docker-compose.yml` | Add port `443:443` when enabling HTTPS |

Replace `YOUR_ORG` with your GitHub organization after pushing `essprmsc-platform`.
