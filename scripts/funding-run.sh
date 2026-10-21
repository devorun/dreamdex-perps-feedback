#!/bin/sh
# Waits for the BTC-PERP funding boundary, reads analytics, closes the min-size long, decodes MarginBank events.
cd "$(dirname "$0")"
TARGET=1792566735
while [ "$(date +%s)" -lt "$TARGET" ]; do sleep 5; done
echo "=== $(date -u +%FT%TZ) analytics before close"; timeout 90 node analytics.ts BTC 2>&1 | grep -E 'position|state|analytics|account'
echo "=== $(date -u +%FT%TZ) close"; OUT=$(timeout 120 node --env-file=../.env op.ts place BTC sell 0.00013 82000 ioc 2>&1); echo "$OUT" | grep -v Assertion
TX=$(echo "$OUT" | grep -oE '^tx 0x[0-9a-f]+' | cut -c4-)
[ -n "$TX" ] && { echo "=== MarginBank events in $TX"; timeout 60 node decode-bank-events.ts "$TX"; }
echo "=== $(date -u +%FT%TZ) state after"; timeout 90 node --env-file=../.env op.ts state BTC 2>&1 | grep -E 'position|margin'
