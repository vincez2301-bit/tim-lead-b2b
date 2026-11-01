#!/usr/bin/env bash
# Chạy migration + test SQL trên một Postgres thường.
# Dùng: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-slf_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -v ON_ERROR_STOP=1 -q -X -d "$DB" -f "$1"; }
run tests/sql/00_supabase_shim.sql
for f in supabase/migrations/*.sql; do echo "migrate: $f"; run "$f"; done
for f in tests/sql/[1-9]*.sql; do echo "test:    $f"; run "$f"; done
echo "Tất cả test SQL đều đạt."
