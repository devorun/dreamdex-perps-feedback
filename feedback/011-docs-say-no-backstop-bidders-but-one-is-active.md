# Margin & Liquidations says no backstop bidders are registered on testnet, but one is registered and takes over positions
Severity: normal
Area: docs

## Steps to reproduce
1. Read https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations, "Liquidations": "No backstop bidders are registered on testnet, so the later stages come in sooner."
2. Run [`scripts/011-backstop-bidders.ts`](../scripts/011-backstop-bidders.ts) (`cd scripts && npm install && node 011-backstop-bidders.ts`). It reads `getBidderCount()` and `getBidders()` on the LiquidationEngine from the developer docs' contracts table (`0xA66d3C24Ad4a389d863846905D8173e1017e9F4D`) with plain viem.
3. Cross-check with the SDK: `client.getLiquidationEngineConfig(engine)` and `client.listLiquidations({ kinds: ["PositionTakenOver", "PositionTransferred"] })`.

## Expected
No registered bidders (`getBidderCount() == 0`) and no bidder takeovers in the liquidation history, so the waterfall goes from the order book straight to the Insurance Fund and ADL, as the page says.

## Actual
One backstop bidder is registered, `0xAF327764345c2f54C1F2bc3322D28E4f633793b9` (a contract), and it takes over liquidated positions. The indexer has `PositionTakenOver` rows with it as the counterparty on SOL-PERP and ETH-PERP. Of the last 200 `AccountLiquidated` rows, 3 reached `stageReached: 2` (BidderTakeover). The page's description of the testnet waterfall is wrong. Anyone who reads "the later stages come in sooner" to reason about insurance-fund and ADL exposure works from a stage that is in fact active.

## Evidence
`node 011-backstop-bidders.ts`, 2026-10-21T09:47:46Z:

```
block 29241245: getBidderCount() = 1, getBidders() = ["0xAF327764345c2f54C1F2bc3322D28E4f633793b9"]
  0xAF327764345c2f54C1F2bc3322D28E4f633793b9: code 176 bytes, nonce 1
```

`client.getLiquidationEngineConfig(...)`, same session: `{"penaltyBps":"100","minSpreadBps":"50","maxSpreadBps":"500","maxVolumePerBlock":"100000000000000000000000","bidderCount":"1"}`.

`client.listLiquidations({ kinds: ["PositionTakenOver", "PositionTransferred"], limit: 5 })`:

```
{"kind":"PositionTakenOver","account":"0x5e7a5481e91aeb199e974bcba961a9aee1a21436","counterparty":"0xaf327764345c2f54c1f2bc3322d28e4f633793b9","pool":"0xb483ec1fb34996638677c20ab087b16f1896fa53","size":"-156920000000","block":"28537567","tx":"0x40099b2c64df594961a4b113da8132795efd58cc15e67a9dced866ae4e8b3300"}
{"kind":"PositionTakenOver","account":"0x671846a0c593e8685342dae71da9c25fd8b8ce16","counterparty":"0xaf327764345c2f54c1f2bc3322d28e4f633793b9","pool":"0xb483ec1fb34996638677c20ab087b16f1896fa53","size":"-227770000000","block":"28537567","tx":"0x170891a3829d9362c44805fbbcf3ea8b02747c7c129a1cf57eeb1d00927f855e"}
{"kind":"PositionTakenOver","account":"0xc01592f1004ea02c6010f142ce430a31e4ee0d94","counterparty":"0xaf327764345c2f54c1f2bc3322d28e4f633793b9","pool":"0xd6cb1dd58580b84d76068ac21594219ce03aeddf","size":"-32429000000000000000","block":"28535489","tx":"0xeed95612916a94094a3791bcae20eccf0f729d606c70094394704eeaf99ab431"}
```

`AccountLiquidated` `stageReached` counts over the last 200 rows: `{"0":1,"1":196,"2":3}`.

The other liquidation figures on the page match the chain: penalty `penaltyBps` 100 (1%); the Insurance Fund holds 1,660,000 USDso; every market's close-out margin is half its maintenance margin.

## Environment
viem 2.57.7 (raw reads); @somnia-chain/markets-sdk 0.32.1 (SDK reads), Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). LiquidationEngine `0xA66d3C24Ad4a389d863846905D8173e1017e9F4D`. Read-only; no wallet needed.
