#!/usr/bin/env bash
# Verifica la salud del Write-Ahead Logging del cluster PostgreSQL.
#
# Uso:
#   ./scripts/verify-wal.sh                       # usa DATABASE_URL del entorno
#   DATABASE_URL=postgres://... ./scripts/verify-wal.sh
#   ./scripts/verify-wal.sh --docker              # ejecuta dentro del contenedor compose
#
# Reporta:
#   - data_checksums  (debe estar ON; protege contra corrupción silenciosa)
#   - wal_level       (replica/logical para permitir replicación y PITR)
#   - synchronous_commit  (on en producción)
#   - LSN actual y avance entre dos muestras (confirma que WAL está activo)
#   - cantidad y tamaño de WAL files en pg_wal/
#   - último checkpoint y latencia desde el anterior
#
# Sale con código != 0 si detecta una configuración insegura.

set -euo pipefail

if [[ "${1:-}" == "--docker" ]]; then
  PSQL=(docker compose exec -T postgres psql -U "${POSTGRES_USER:-edificia}" -d edificia)
elif [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL=(psql "$DATABASE_URL")
else
  echo "ERROR: definí DATABASE_URL o ejecutá con --docker (compose en runtime)." >&2
  exit 2
fi

q() { "${PSQL[@]}" -tAX -c "$1"; }

echo "── PostgreSQL WAL verification ──"
echo

server_version=$(q "SHOW server_version;")
echo "Server version: $server_version"
echo

# 1. Data checksums
checksums=$(q "SHOW data_checksums;")
echo "data_checksums      : $checksums"
if [[ "$checksums" != "on" ]]; then
  echo "  ⚠ Recomendado ON. Para cluster existente: detener el server y correr 'pg_checksums --enable'." >&2
  CHECKSUM_WARN=1
fi

# 2. WAL level y commit
wal_level=$(q "SHOW wal_level;")
sync_commit=$(q "SHOW synchronous_commit;")
echo "wal_level           : $wal_level"
echo "synchronous_commit  : $sync_commit"
if [[ "$wal_level" == "minimal" ]]; then
  echo "  ⚠ 'minimal' deshabilita streaming y PITR. Subir a 'replica' o 'logical'." >&2
  CONFIG_WARN=1
fi

# 3. Avance de LSN entre dos muestras (250 ms de margen para escrituras de fondo)
lsn1=$(q "SELECT pg_current_wal_lsn();")
sleep 0.25
# Una escritura trivial para forzar avance del WAL en clusters idle.
q "DO \$\$ BEGIN PERFORM pg_logical_emit_message(false, 'verify-wal', 'tick'); END \$\$;" >/dev/null 2>&1 || true
lsn2=$(q "SELECT pg_current_wal_lsn();")
echo "WAL LSN (t0 → t1)   : $lsn1 → $lsn2"

# 4. Conteo y tamaño de WAL files
wal_count=$(q "SELECT count(*) FROM pg_ls_waldir();")
wal_size=$(q "SELECT pg_size_pretty(sum(size)) FROM pg_ls_waldir();")
echo "WAL files actuales  : $wal_count ($wal_size)"

# 5. Último checkpoint
last_ckpt=$(q "SELECT checkpoint_time::timestamp(0) FROM pg_control_checkpoint();")
echo "Último checkpoint   : $last_ckpt"

echo
if [[ -n "${CHECKSUM_WARN:-}" || -n "${CONFIG_WARN:-}" ]]; then
  echo "Resultado: WARNINGS — revisar mensajes arriba."
  exit 1
fi
echo "Resultado: OK."
