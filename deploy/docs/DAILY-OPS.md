# Daily ops — backup to Mac & deploy

Quick commands for day-to-day production work.

| Item               | Value                |
| ------------------ | -------------------- |
| **VM IP**          | `101.50.86.169`      |
| **SSH user**       | `adminprms98`        |
| **App URL**        | http://101.50.86.169 |
| **Repo on VM**     | `~/PRMSC-ENS-MRV`    |
| **Branch on prod** | `main`               |

For full ops (logs, SQL, troubleshooting), see [../VM-OPS.md](../VM-OPS.md).

---

## 1. Connect to the VM

From your **Mac**:

```bash
ssh adminprms98@101.50.86.169
```

Then:

```bash
cd ~/PRMSC-ENS-MRV
```

---

## 2. Take a DB backup on the VM, then copy it to your Mac

### Which terminal am I in?

| Prompt looks like | You are on | Safe for `scp` to Mac? |
| --- | --- | --- |
| `➜  PRMSC-MRV` or `aubairakif@...` | **Mac** | Yes |
| `adminprms98@prmsc-ens-mrv:~$` | **VM (SSH)** | **No** — `~/Downloads` is on the server |

If you run `scp` after the `adminprms98@prmsc-ens-mrv` prompt, the file stays on the VM. Your Mac Finder will still show old Jul 16 files.

### Easiest way (Mac only)

From your **Mac** project folder (not inside SSH):

```bash
cd /path/to/PRMSC-MRV
chmod +x deploy/scripts/pull-backup-to-mac.sh
./deploy/scripts/pull-backup-to-mac.sh
```

This downloads the newest dump to `~/Downloads/prmsc-backups/` and opens Finder.

### Manual way (two terminals)

| Where | What to do |
| --- | --- |
| **Terminal A (SSH → VM)** | Create the dump |
| **Terminal B (Mac only)** | Download the dump |

**Step A — VM**

```bash
cd ~/PRMSC-ENS-MRV
./deploy/scripts/backup-postgres.sh
ls -lh backups/
```

You should see a new file like `prmsc_mrv_20260721_071840.dump` (~400KB+ is normal — custom format is compressed).

**Step B — Mac** (type `exit` first if you are still in SSH)

```bash
mkdir -p ~/Downloads/prmsc-backups

LATEST=$(ssh adminprms98@101.50.86.169 'ls -1t ~/PRMSC-ENS-MRV/backups/prmsc_mrv_*.dump | head -1')
echo "Downloading: $LATEST"
scp "adminprms98@101.50.86.169:$LATEST" ~/Downloads/prmsc-backups/

ls -lh ~/Downloads/prmsc-backups/
open ~/Downloads/prmsc-backups
```

You should see today’s file (e.g. `prmsc_mrv_20260721_....dump`). ~400–450 KB is normal for this database.

---

## 3. Daily changes deployment

Production always deploys from **`main`**. Merge your feature branch into `main` first (PR or local merge), then deploy on the VM.

### On your Mac (before deploy)

1. Merge / push your work to `main` (via PR from `dev-` → `main`, or equivalent).
2. Confirm GitHub `main` has the commit you want.

### On the VM — deploy

```bash
ssh adminprms98@101.50.86.169
```

```bash
cd ~/PRMSC-ENS-MRV

# optional but recommended before a big release
./deploy/scripts/backup-postgres.sh

git pull origin main
docker compose --env-file .env.docker up -d --build
```

### Verify

```bash
curl -s http://localhost/api/health
docker compose --env-file .env.docker ps
```

Open: **http://101.50.86.169/**

### Faster rebuilds (when only one side changed)

Backend only:

```bash
docker compose --env-file .env.docker up -d --build backend
```

Frontend only:

```bash
docker compose --env-file .env.docker up -d --build frontend
```

---

## 4. One-liner cheat sheet

**SSH in**

```bash
ssh adminprms98@101.50.86.169
```

**Backup on VM + pull dump to Mac**

```bash
# VM
cd ~/PRMSC-ENS-MRV && ./deploy/scripts/backup-postgres.sh

# Mac (exit SSH first)
./deploy/scripts/pull-backup-to-mac.sh
```

**Daily deploy on VM**

```bash
cd ~/PRMSC-ENS-MRV && git pull origin main && docker compose --env-file .env.docker up -d --build
```

Optional VM alias (same as in VM-OPS):

```bash
alias mrv-deploy='cd ~/PRMSC-ENS-MRV && git pull origin main && docker compose --env-file .env.docker up -d --build'
```

---

## Related

- [../VM-OPS.md](../VM-OPS.md) — full production operations
- [../README.md](../README.md) — first-time VM setup
