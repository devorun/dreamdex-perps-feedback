# Perp TP/SL (stop) orders fail with the documented SDK setup: SOMNIA_HIDEKI_TESTNET_ADDRESSES has no operatorPermissionsRegistry
Severity: normal
Area: SDK

## Steps to reproduce
1. Create the client exactly as the developer page's "Connect" section shows (https://app.testnet.dreamdex.io/docs/developers/perps-testnet): `new SomniaMarkets({ chain: hidekiTestnet, indexerUrl, addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES, privateKey })`.
2. Build or place a perp stop as the SDK Perps docs describe, for example `trader.buildPlacePerpStopOrder({ isBid: false, quantity, triggerPrice, triggerOperator: 1, stopOrderType: 1, registry: market.stopRegistry, pool: market.poolAddress })` (or `placePerpStopOrder`, or with a `pair` for TP+SL).
3. Or run [`scripts/019-stop-orders-need-operator-registry.ts`](../scripts/019-stop-orders-need-operator-registry.ts) (`cd scripts && npm install && node --env-file=../.env 019-stop-orders-need-operator-registry.ts`). It only builds calls and sends nothing. A key is needed only because stop builds live on the Trader.

## Expected
With the documented configuration, TP/SL orders build and place. The `PlacePerpStopOrderParams.operatorRegistry` TSDoc says it is "Resolved from the live config (addresses.operatorPermissionsRegistry) if omitted". The developer page's contracts table lists `OperatorPermissionsRegistry | 0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a`.

## Actual
The SDK's own testnet preset `SOMNIA_HIDEKI_TESTNET_ADDRESSES` has no `operatorPermissionsRegistry` key. Every stop build or placement therefore throws:

`NotConfiguredError: @somnia-chain/markets-sdk: a perp stop order — needs operatorRegistry or addresses.operatorPermissionsRegistry`

Neither the developer page nor the SDK Perps page mentions passing `operatorRegistry`. A developer who follows the docs cannot place a TP or SL from code at all until they find the optional parameter and copy the address from the contracts table by hand.

## Evidence
`node --env-file=../.env 019-stop-orders-need-operator-registry.ts`, 2026-10-24T09:39:44Z:

```
markets-sdk 0.32.1
SOMNIA_HIDEKI_TESTNET_ADDRESSES keys: binaryModule, binaryPoolBeacon, binaryPoolImpl, binarySettlement, clobFactory, collateral, marginBank, marketCreator, marketCreatorFactory, marketsCore, oracleHub, perpPoolFactory, priceFeedScheduler, testUsdc
operatorPermissionsRegistry in preset: undefined
trader.buildPlacePerpStopOrder (SL on ETH-PERP): NotConfiguredError: @somnia-chain/markets-sdk: a perp stop order — needs operatorRegistry or addresses.operatorPermissionsRegistry
trader.buildPlacePerpStopOrder with pair (TP+SL): NotConfiguredError: @somnia-chain/markets-sdk: a perp stop order — needs operatorRegistry or addresses.operatorPermissionsRegistry
```

Second run, 2026-10-24T09:40:08Z: the same two `NotConfiguredError`s. Passing `operatorRegistry: "0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a"` (the address from the developer page) makes the same build succeed, and so does any other configuration that supplies the address.

## Environment
@somnia-chain/markets-sdk 0.32.1 (npm `latest`, unchanged since 2026-10-20), Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), ETH-PERP. Trader key `0x29cF993A7c66d2Af212EEE430F120750023e8892`, used only to construct the Trader; nothing was signed or sent.
