#!/usr/bin/env bash
# Runs ON THE SERVER, from the repo checkout (see README → server setup).
#   infra/deploy.sh             first deploy and every update: pull, build, up
#   infra/deploy.sh reset-demo  full re-seed before a demo — deletes every user and session
#   infra/deploy.sh backup      pg_dump to infra/backups/, keeps 7 days (nightly from cron)
set -euo pipefail

cd "$(dirname "$0")/.."
compose() { docker compose -f infra/docker-compose.yml "$@"; }
sudo=$([ "$(id -u)" -eq 0 ] || echo sudo)

# The last NAME=value line of infra/.env, without the name.
env_val() { grep -E "^$1=" infra/.env | tail -n 1 | cut -d= -f2- || true; }

deploy() {
  [ -f infra/.env ] || { echo 'infra/.env is missing: cp infra/.env.example infra/.env and fill it in' >&2; exit 1; }
  for v in POSTGRES_PASSWORD SITE_ADDRESS; do
    [ -n "$(env_val "$v")" ] || { echo "infra/.env: $v is empty" >&2; exit 1; }
  done

  # A Next build can run a 4 GB box out of memory.
  if [ -z "$(swapon --show --noheadings)" ]; then
    echo 'No swap: adding a 2 GB /swapfile'
    $sudo fallocate -l 2G /swapfile
    $sudo chmod 600 /swapfile
    $sudo mkswap /swapfile
    $sudo swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | $sudo tee -a /etc/fstab >/dev/null
  fi

  git pull --ff-only
  compose up -d --build
  docker image prune -f
  compose ps
}

reset_demo() {
  read -r -p 'Re-seed: deletes EVERY user and session, then restores the demo data. Type yes: ' answer
  [ "$answer" = yes ] || { echo 'Aborted.'; exit 1; }
  compose run --rm -e SEED_IF_EMPTY= migrate pnpm db:seed
}

backup() {
  mkdir -p infra/backups
  local file
  file="infra/backups/p400-$(date +%F-%H%M).sql.gz"
  # Credentials come from the container's own POSTGRES_* env, so nothing is repeated here.
  if ! compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip >"$file"; then
    rm -f "$file"
    echo 'backup failed' >&2
    exit 1
  fi
  find infra/backups -name 'p400-*.sql.gz' -mtime +7 -delete
  echo "backup: $file ($(du -h "$file" | cut -f1))"
}

case "${1:-}" in
  '') deploy ;;
  reset-demo) reset_demo ;;
  backup) backup ;;
  *) echo "usage: $0 [reset-demo | backup]" >&2; exit 2 ;;
esac
