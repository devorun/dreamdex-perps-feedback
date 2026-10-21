# Position lastUpdatedTimestampNs is never written, so fetchPositions() dates every open position 1970-01-01
Severity: normal
Area: SDK

## Steps to reproduce
1. Open any perp position. Here a BTC-PERP long of 0.00013 for account `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, sent by its linked bot key with `placeOrderFor` (tx `0x0c58fd297348d56ffcb5360936f21d5ace0e6990699ae0b86b728955028baa0d`, block 29133664).
2. Run [`scripts/positions-view.ts`](../scripts/positions-view.ts) (`cd scripts && npm install && node positions-view.ts <account>`). It reads the position three ways: `exchange.fetchPositions()`, `client.getPerpPosition(...)` (`MarginBank.getPosition`) and `client.listPerpPositions(account)` (indexer).
3. Optionally read `MarginBank.getPosition(account, pool)` directly at blocks where the position is open.

## Expected
`UnifiedPosition.timestamp` is "When the position last changed on-chain (ms)", as its TSDoc in `dist/unified/structs.d.ts` says, and `datetime` is that time in ISO-8601. `Position.lastUpdatedTimestampNs` from `MarginBank.getPosition` is the time of the last update.

## Actual
`lastUpdatedTimestampNs` is `0` for an open position on chain. `fetchPositions()` derives `timestamp` from it (`Number(pos.lastUpdatedTimestampNs / 1000000n)` in `dist/unified/exchange.js`), so every position reports `timestamp: 0` and `datetime: "1970-01-01T00:00:00.000Z"`. The indexer has the real time (`updatedAt: "1792565299"`) for the same position. Any UI or bot that shows "opened / last changed" from the unified API shows 1970, and code that ages positions by this field treats every position as 56 years old.

## Evidence
`node positions-view.ts`, 2026-10-21T06:48:12Z, right after the fill (trimmed):

```
fetchPositions {"symbol":"BTC/USDso:USDso","side":"long","contracts":0.00013,"entryPrice":82907.6,...,"timestamp":0,"datetime":"1970-01-01T00:00:00.000Z","info":{"position":{"size":"13000","avgEntryPrice":"82907600000000000000000","entryFundingIndex":"2280675739495667903365167296031842875000","lastUpdatedTimestampNs":"0"},...}}
getPerpPosition {"size":"13000","avgEntryPrice":"82907600000000000000000","entryFundingIndex":"2280675739495667903365167296031842875000","lastUpdatedTimestampNs":"0"}
listPerpPositions(indexer) [{...,"size":"13000","avgEntryPrice":"82907600000000000000000","lastUpdateRealizedPnl":"0","updatedAt":"1792565299","updatedAtBlock":29133664}]
```

Second run, 2026-10-21T06:49:07Z: `"timestamp":0 "datetime":"1970-01-01T00:00:00.000Z" "lastUpdatedTimestampNs":"0"`, indexer `"updatedAt":"1792565299"`.

The same happens on a second market. A ZEC-PERP long (0.009 ZEC) opened in tx `0xb49fa126988f88f54be8219ea9e727d91f8fa246b1cce34878ff4ff47a36ec6a` (block 29131798) and closed in tx `0xc2b97fb2a93ad598f6b677937bb95f50694d1cd4d26ef2d0afcb43300164d40e` (block 29132088). `MarginBank.getPosition` read directly with viem:

```
29131797 size 0      entry 0                      lastUpdatedTimestampNs 0
29131798 size 900000 entry 1259974000000000000000 lastUpdatedTimestampNs 0
29131900 size 900000 entry 1259974000000000000000 lastUpdatedTimestampNs 0
29132087 size 900000 entry 1259974000000000000000 lastUpdatedTimestampNs 0
29132088 size 0      entry 0                      lastUpdatedTimestampNs 0
```

Either MarginBank should set `lastUpdatedTimestampNs` when it updates a position, or the SDK should not present the 0 as a time. For example, it could leave `timestamp`/`datetime` undefined, or fill them from the indexer's `updatedAt`.

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), MarginBank `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`. Account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`; orders sent by its linked bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892`.
