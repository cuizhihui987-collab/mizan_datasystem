#!/bin/sh
set -e

DB_DIR="/app/packages/database/prisma"
DB_FILE="${DB_DIR}/prod.db"
SEED_DB="/app/seed.db"

# ── Database initialization ──────────────────────────────────
if [ ! -f "$DB_FILE" ]; then
  if [ -f "$SEED_DB" ]; then
    echo ">>> 首次启动：从开发数据库初始化生产数据库 ..."
    cp "$SEED_DB" "$DB_FILE"
    echo ">>> 开发数据库已复制到生产环境"
  else
    echo ">>> 未找到 seed 数据库，将创建全新的数据库"
    cd /app/packages/database && npx prisma db push --skip-generate --accept-data-loss
  fi
else
  echo ">>> 数据库已存在，跳过初始化"
fi

# ── Start application ────────────────────────────────────────
echo ">>> 启动 Mizan 数据管理系统 ..."
exec "$@"
