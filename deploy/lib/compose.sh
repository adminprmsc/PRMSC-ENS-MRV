#!/usr/bin/env bash
# Shared docker compose helpers for deploy scripts.

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo docker compose
  elif command -v docker-compose >/dev/null 2>&1; then
    echo docker-compose
  else
    echo "Docker Compose not found. Install: curl -fsSL https://get.docker.com | sudo sh" >&2
    return 1
  fi
}

compose_args() {
  local root="${1:?root dir required}"
  local env_file="${ENV_FILE:-$root/.env.docker}"
  local compose_file="${COMPOSE_FILE:-$root/docker-compose.yml}"
  echo -f "$compose_file" --env-file "$env_file"
}
