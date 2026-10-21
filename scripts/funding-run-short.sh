#!/bin/sh
# Waits for the 10:11:43Z BTC-PERP funding boundary, reads analytics, closes the 0.00014 short opened by perp-funding.
cd "$(dirname "$0")"
TARGET=1792577540
while [ "$(date +%s)" -lt "$TARGET" ]; do sleep 5; done
echo "=== $(date -u +%FT%TZ) analytics before close"; timeout 90 node analytics.ts BTC 2>&1 | grep -E 'position|state|analytics|account'
ASK=$(timeout 60 node --env-file=../.env op.ts state BTC 2>&1 | grep -oE 'asks \[\[[0-9.]+' | grep -oE '[0-9.]+$')
LIMIT=$(node -e "console.log((Math.ceil(${ASK:-84000}*1.003*10)/10).toFixed(1))")
echo "=== $(date -u +%FT%TZ) close at limit $LIMIT (best ask $ASK)"; OUT=$(timeout 120 node --env-file=../.env op.ts place BTC buy 0.00014 $LIMIT ioc 2>&1); echo "$OUT" | grep -v Assertion
TX=$(echo "$OUT" | grep -oE '^tx 0x[0-9a-f]+' | cut -c4-)
[ -n "$TX" ] && { echo "=== MarginBank events in $TX"; timeout 60 node decode-bank-events.ts "$TX"; }
echo "=== $(date -u +%FT%TZ) state after"; timeout 90 node --env-file=../.env op.ts state BTC 2>&1 | grep -E 'position|margin'
