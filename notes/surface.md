# Perps API / SDK surface

Inventory of everything perps-related on Somnia Tokyo testnet (Hideki, chain ID 50383), built from the docs, the `@somnia-chain/markets-sdk` 0.32.1 typings and live responses. "Checked" means a call was made in this repo and compared with the docs; see `log.md`.

## Endpoints

| What | Value | Checked |
|---|---|---|
| RPC (HTTP) | https://api.hideki2.infra.testnet.somnia.network | yes |
| RPC (WebSocket, required by the SDK) | wss://api.hideki2.infra.testnet.somnia.network/ws | yes (SDK) |
| Indexer (GraphQL, Hasura) | https://hideki-dev.smk.somnia.host/v1/graphql | yes |
| Explorer | explorer.testnet.somnia.network/tokyo | no |
| dreamDEX HTTP API | https://stg.api.dreamdex.io/v0 is Shannon (50312), spot only: `GET /v0/markets` returns 3 spot markets, no perps | yes |
| dreamDEX WebSocket API | wss://stg.api.dreamdex.io/v0/ws/public is Shannon, spot only per docs | no |

Perps have no REST surface. Everything goes through the SDK, the indexer or the contracts.

## Contracts (docs table vs `getPerpSystemConfig`)

| Contract | Address | Matches chain |
|---|---|---|
| MarginBank | 0x478769E1177C0773c43A593DCCc4Ad15F15F1394 | yes |
| Collateral (USDso) | 0xed7993A74dAe1e6656B704A424DcD8711aAf4F72 | yes |
| PerpPoolFactory | 0xE631fAEE547baeE07353E290f0562ea67d856560 | yes |
| LiquidationEngine | 0xA66d3C24Ad4a389d863846905D8173e1017e9F4D | yes |
| InsuranceFund | 0x50826894D47C6D4f3BeA38BFDC7Dc5c5be171b80 | yes |
| VoucherDistributor | 0x2ACD9EFdA721450906bfE1bef3edE269636E42C4 | yes (`getPerpVoucherCampaign`) |
| OperatorPermissionsRegistry | 0x6B2FbfeD328FF5F20C0BE7D3C3437613aFFE8D3a | not read |
| feeRecipient | 0xd58596620Ee6951B2958a931949e4ff7ce6222be | not in docs |

`SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral` is `0x9E94…148f` (testUsdc), not USDso, as the docs' pitfalls say.

Per market: `poolAddress`, `marginBank`, `stopRegistry` on the market row. 21 pools from the factory, all registered and none restricted.

## SDK entry points

```ts
new SomniaMarkets({ chain: hidekiTestnet, indexerUrl, addresses?, privateKey?, wsRpcUrl? })
markets.client   // reads (chain + indexer)
markets.trader   // writes (needs privateKey)
markets.*        // CCXT-like unified API (loadMarkets, fetchTicker, createOrder, ...)
markets.close()  // teardown: needed after any chain read, or the process stays alive on the WebSocket
```

Unified perp symbols are `BASE/USDso:USDso` (see feedback 003).

## Reads: markets and state

| Method | Tier | Checked |
|---|---|---|
| `client.listPerpMarkets(filter?)` | indexer | yes, 21 rows |
| `client.getPerpMarket(id)` | indexer | via doc sample |
| `client.readPerpMarketFromChain` | chain | no |
| `client.listPerpPoolStatuses({ factory })` / `listTradeablePerpPools` | chain | yes, 21 / 0 restricted |
| `client.isPerpPoolRegistered` | chain | no |
| `client.getPerpState(pool)` | chain | yes |
| `client.getPerpFeedStatus(pool)` | chain | yes |
| `client.getPerpHealthSnapshot(pool)` | chain | no |
| `client.getPerpRiskParams(pool)` | chain | yes, all 21 |
| `client.getEffectiveImfBps(pool)` | chain | yes, equals base IMF on all 21 |
| `client.getPerpFundingPremium` | chain | no |
| `client.getPerpSystemConfig(marginBank)` | chain | yes |
| `client.getInsuranceFundState` / `getLiquidationEngineConfig` | chain | no |
| `client.getPerpPlaneStatus` / `getPriceHealth` / `listPriceHealth` | chain | no |
| `exchange.loadMarkets()` / `fetchMarkets()` | indexer | yes |
| `exchange.fetchTicker(symbol)` | indexer + chain | yes |
| `exchange.fetchFundingRate(symbol)` / `fetchFundingRateHistory` | chain / indexer | yes / no |
| `exchange.fetchOrderBook(symbol, limit)` | chain | yes, BTC |
| `exchange.fetchTrades` / `fetchOHLCV` | indexer | no |
| `client.listFundingRateHistory` / `listFundingRateCandles` / `getOpenInterestHistory` | indexer | no |

## Reads: account, margin, positions

| Method | Tier | Checked |
|---|---|---|
| `client.getMarginAccount(marginBank, account)` | chain | yes, empty account |
| `client.getAccountHealth` / `getAccountEquity` / `listAccountEquities` / `tryGetPerpAccountEquity` / `getPerpCollateralBasis` | chain | no |
| `client.getPerpPosition` / `listPerpPositions` / `getPerpPositionsPage` | chain / indexer | no (no position) |
| `client.getPerpPositionAnalytics` / `listPerpPositionAnalytics` | chain | no |
| `client.getPerpLeverage(ref)` / `getPerpMaxLeverage` / `getPerpLeverageImSurcharge` | chain | yes / no / no |
| `client.getLiquidationPrice` / `getBankruptcyPrice` / `getPerpSideHolders` / `perpAdlQueue` | chain | no |
| `client.getMaxPerpOrderSize(p)` | chain | yes, `limitedBy: "collateral"` at zero balance |
| `client.previewPerpOrderMargin` / `previewPerpLiquidationPrice` / `previewPerpClosePnl` / `quotePerpClose` | chain | no |
| `client.quoteMeetsPerpImForOrder` / `meetsPerpImForFill` / `quotePerpOrderTopUp` | chain | no |
| `client.getPerpVoucherCampaign` / `getPerpVoucherEligibility` / `getPerpVoucher` | chain | yes / yes (eligible) / no |
| `exchange.fetchBalance()` / `fetchPositions()` | chain | yes, empty |

## Reads: history (indexer)

`getPerpPortfolio`, `listPerpOrderHistory`, `listPerpOrderRejections`, `getFundingPayments`, `getMarginEvents`, `listLiquidations` / `getLiquidations`, `listPerpPositionChanges` / `listPerpPositionChangesForFills`, `listPerpFees`, `listPerpMarginPulls`, `listPerpMainFundingEvents`, `listPerpInsuranceFundEvents`, `listPerpStopOrders`, `getPerpStopOrders`, `getUnclaimedPerpStopSomi`. None checked yet: they need account activity.

## Writes (trader), not run yet: they need funds

| Area | Methods |
|---|---|
| Margin | `depositMargin`, `withdrawMargin`, `build*` twins |
| Voucher | `claimPerpVoucher`, `buildClaimPerpVoucher` |
| Orders | `placePerpOrder` (`price`, `quantity`, `isBid`, `expireTimestampNs`, `builder`, `builderFeeBpsTimes1k`), `placeOrder`, `amendOrder(s)`, `cancelOrder(s)`, `cancelAllOrders`, `cancelExpiredOrders`, `reduceOrder(s)` |
| Leverage | `setPerpLeverage` |
| TP/SL | `placePerpStopOrder`, `cancelPerpStopOrder(s)`, `linkPerpStopOrders`, `claimPerpStopSomi` (0.15 STT per stop) |
| Builder fees | `approveBuilder`, `getBuilderApproval`, `getEffectiveBuilderApproval` |
| Linked wallets | `proposePerpWalletLink`, `acceptPerpWalletLink`, `unlinkPerpWallet`, `repayPerpMainFunding`, `recallPerpMainFunding` |
| Unified | `exchange.createOrder`, `cancelOrder`, `createStopOrder`, `cancelStopOrder`, `depositMargin`, `withdrawMargin` |
| Raw pool | `placeOrderFor`, `placeOrdersFor`, `cancelOrderFor`, `reduceOrderFor`, `amendOrders` (operator / Link a Bot) |

Time in force from the trader docs: GTC (default), IOC, FOK, ALO. Reduce-only and post-only (ALO) are listed.

## Subscriptions

`client.watchMarket(pool)` (book, funding rate, OI), `client.watchPerpMarkets()` (liquidations + funding settlement), `listLiveLiquidations`, `listLiveFundingPayments`, `subscribeLive`, React hooks (`useWatchPerpMarkets`, `useLiveLiquidations`, `useLiveFundingPayments`), unified `watchOrderBook`, `watchTrades`, `watchOrders`, `watchMyTrades`, `watchUser`. Raw event ABIs: `perpPoolEventsAbi`, `marginBankEventsAbi`, `liquidationEngineEventsAbi`. None checked yet.

## Docs claims to verify once funded

- Funding: hourly payment = size × index × rate / 8, applied when the position is next touched.
- Liquidation price formula on the SDK page (`10000 ∓ mmBps` factor).
- Paper USDso: voucher-blocked markets (feedback 001), leverage cannot change while the voucher remains.
- Errors: `InsufficientCollateral()` on mis-scaled `placeOrderFor`; `ImmediateOrCancelNoFill()`; `MaxPositionSizeExceeded()`; `IsolatedMarketBlocked`.
- Gas: resting order needs > 1.5M gas.
