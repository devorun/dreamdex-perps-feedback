# Documented perp symbol "BTC/USDSO:USDSO" does not resolve; the SDK builds "BTC/USDso:USDso" and its error blames loadMarkets()
Severity: normal
Area: SDK

## Steps to reproduce
1. Follow the "Quick start" of the SDK docs' Perps page (https://somnia-platform-docs.vercel.app/markets/somnia-markets/typescript/perps). It uses `"BTC/USDSO:USDSO"` for `depositMargin`, `createOrder` and `fetchFundingRate`. The SDK's own TSDoc uses the same form: `dist/unified/structs.d.ts` ("e.g. "BTC/USDSO:USDSO""), the `fetchFundingRateHistory` example in `dist/unified/exchange.d.ts`, and the notation comment at the top of `dist/unified/symbols.js`.
2. Run [`scripts/003-unified-symbol-case.ts`](../scripts/003-unified-symbol-case.ts) (`cd scripts && npm install && node 003-unified-symbol-case.ts`). It calls `loadMarkets()`, prints the BTC perp symbol and calls the read-only `fetchFundingRate` with both spellings.

## Expected
The documented symbol resolves after `loadMarkets()`, or the docs use the symbol the SDK actually builds. If a symbol is unknown after markets are loaded, the error says so and suggests the closest loaded symbol.

## Actual
`loadMarkets()` builds `BTC/USDso:USDso` from the token's on-chain symbol `USDso`, and the lookup in `SymbolTable.resolve` is case-sensitive. Every perp symbol written as documented fails, so every line of the Quick start throws.

The error also points the wrong way: `unknown symbol BTC/USDSO:USDSO — call loadMarkets() first`, raised right after `loadMarkets()` succeeded. A developer who follows it calls `loadMarkets()` again and gets the same error.

## Evidence
`node 003-unified-symbol-case.ts`, run 2026-10-21T06:15:11Z (two earlier runs in the same session also failed with the same error on `fetchTicker`):

```
BTC perp symbols after loadMarkets(): [ 'BTC/USDso:USDso' ]
fetchFundingRate("BTC/USDSO:USDSO") -> InvalidInputError: @somnia-chain/markets-sdk: unknown symbol BTC/USDSO:USDSO — call loadMarkets() first
fetchFundingRate("BTC/USDso:USDso") -> OK, fundingRate=0.001167515494303764
```

All 21 perp symbols after `loadMarkets()` use `USDso:USDso`, for example `ETH/USDso:USDso` and `ZRO/USDso:USDso`.

The same Quick start ships inside the npm package, in `node_modules/@somnia-chain/markets-sdk/docs/PERPS.md` lines 1197-1200.

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), chain `hidekiTestnet` from `@somnia-chain/markets-sdk/chains`. Wallet: none needed (read-only). Session wallet 0x344F9c80c7E4dF61080BDE9183CBD1C71eE61E40.
