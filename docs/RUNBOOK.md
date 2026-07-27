# OutlanderOS — Runbook

Operational procedures for the production server. Written 2026-07-27.

**Server:** `root@204.168.245.185` · app at `/var/www/outlanderos` · pm2 app `outlanderos`
· Postgres on the same box (`127.0.0.1:5432`, db/user `outlanderos`).

---

## Is it up?

```bash
curl -s http://204.168.245.185/api/health | head -c 200
```

`status` is `ok` (database reachable) or `degraded` (app alive, database not). The endpoint
is public by design and also reports uptime, memory and per-source sync times.

## Automated monitoring

| What | Where | Schedule |
|---|---|---|
| Health watchdog | `/usr/local/bin/outlanderos-healthcheck.sh` | every 5 min |
| Database backup | `/usr/local/bin/backup-outlanderos.sh` | 03:00 daily |

The watchdog polls `/api/health`, restarts pm2 if the process is gone, and logs to
`/var/log/outlanderos-health.log`. It alerts only on **state changes**, so an ongoing outage
doesn't spam. State is kept in `/var/run/outlanderos-health.state`.

**To get pushed alerts** (Slack, Discord, any JSON webhook), create
`/etc/outlanderos-watchdog.env`:

```bash
ALERT_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

Without it, alerts land in the log file only — which nobody is watching. Setting this is the
difference between "we found out on Monday" and "we found out in five minutes."

## Backups

```bash
/usr/local/bin/backup-outlanderos.sh          # run one now
ls -la /var/backups/outlanderos/              # list (30-day retention, ~600KB each)
```

**Restore:**
```bash
systemctl stop nginx && pm2 stop outlanderos
gunzip -c /var/backups/outlanderos/outlanderos_YYYYMMDD_HHMMSS.sql.gz \
  | PGPASSWORD=test123 psql -h 127.0.0.1 -U outlanderos -d outlanderos
pm2 start outlanderos && systemctl start nginx
```

⚠️ **A restore has never been rehearsed.** Do it once against a scratch database before you
need it for real — an untested backup is a hope, not a backup.

## Deploying

```bash
ssh root@204.168.245.185
cd /var/www/outlanderos
git checkout -- package-lock.json   # server npm installs rewrite it and block the pull
git pull origin main                # DO NOT pipe — a piped pull hides failure
npm install
npx prisma migrate deploy && npx prisma generate
export NODE_OPTIONS="--max-old-space-size=3584"
npm run build && pm2 restart outlanderos
git log --oneline -1                # MUST match what you pushed
```

**Always confirm that last line.** A piped `git pull` inside an `&&` chain returns `tail`'s
exit status, so an aborted pull lets the chain rebuild and restart the *old* code and print
`DONE`. This has already produced a deploy that silently shipped nothing.

## Restart policy

`ecosystem.config.js` sets `min_uptime: 60s`, `max_restarts: 50`, exponential backoff. The
counter only advances for restarts where the app died within 60s, so ordinary restarts don't
accumulate toward the cap. Run `pm2 save` after any pm2 config change or it won't survive a
reboot.

```bash
pm2 list                  # status
pm2 logs outlanderos      # live logs
pm2 describe outlanderos  # full config
tail -50 /root/.pm2/logs/outlanderos-error.log
```

## Known gaps

- **No TLS.** nginx serves port 80 only; passwords and session cookies cross the internet in
  cleartext. See `docs/BACKLOG.md` §0 — this is the top item.
- **No error tracking.** A 500 leaves one line in the pm2 log. The watchdog catches *down*
  and *degraded*, not application errors.
- **Single point of failure** at every layer: one box, one pm2 process, database on the same
  machine, OAuth tokens in a local `.tokens.json`.
