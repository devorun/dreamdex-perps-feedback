# SDK Perps docs describe an older testnet: the "One-shot reads" sample filters on WBTC and crashes
Severity: normal
Area: docs

## Steps to reproduce
1. Open the SDK docs' Perps page: https://somnia-platform-docs.vercel.app/markets/somnia-markets/typescript/perps.
2. Section "One-shot reads (no watch)":
   ```ts
   const perps = await client.listPerpMarkets({ baseSymbol: "WBTC", limit: 20 });
   const one = await client.getPerpMarket(perps[0].id); // null if not a perp
   ```
3. Run [`scripts/004-sdk-docs-wbtc-sample.ts`](../scripts/004-sdk-docs-wbtc-sample.ts) (`cd scripts && npm install && node 004-sdk-docs-wbtc-sample.ts`). It runs the sample as written and also lists the live perp markets and pool statuses.

## Expected
The sample returns the BTC perp market, and the page's description of the testnet matches the live deployment.

## Actual
- `listPerpMarkets({ baseSymbol: "WBTC" })` returns 0 rows, because the live BTC perp has `baseSymbol: "BTC"`. `perps[0].id` then throws `TypeError: Cannot read properties of undefined (reading 'id')`. The comment `// null if not a perp` suggests a soft failure, but the sample crashes first.
- The same page also describes an older deployment in two other places. "The shape" opens with "Perps are live on testnet: BTC/USDSO:USDSO and ETH/USDSO:USDSO", but 21 perp markets are live. "Market discovery" says "Testnet today has 10 pools, four of them restricted SBTC* arena markets", but `listPerpPoolStatuses` returns 21 pools and none is restricted. A developer who relies on the second statement expects restricted pools in the list and may write handling for markets that do not exist.

## Evidence
`node 004-sdk-docs-wbtc-sample.ts`, run 2026-10-21T06:15:16Z (an earlier run in the same session gave the same 0 rows and the same TypeError):

```
listPerpMarkets(): 21 markets, base symbols: 1000PEPE,ADA,AVAX,BNB,BTC,DOGE,ETH,HYPE,LINK,LIT,NEAR,PUMP,SOL,SUI,TAO,VVV,WLD,XLM,XRP,ZEC,ZRO
listPerpPoolStatuses(): 21 pools, restricted: 0
listPerpMarkets({ baseSymbol: "WBTC" }) -> 0 rows
docs sample threw TypeError: Cannot read properties of undefined (reading 'id')
```

The same text ships inside the npm package, in `node_modules/@somnia-chain/markets-sdk/docs/PERPS.md`: line 3 ("Perps are live on testnet"), line 571 ("10 pools, four of them restricted") and line 1208 (the WBTC sample).

The `USDSO` casing in the same sentence is a separate problem, reported in [003](003-perp-symbol-case-usdso.md).

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), indexer https://hideki-dev.smk.somnia.host/v1/graphql. Wallet: none needed (read-only). Session wallet 0x344F9c80c7E4dF61080BDE9183CBD1C71eE61E40.
