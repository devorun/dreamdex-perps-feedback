# Test log

What was tested and what came out, so nothing is tested twice. Times are UTC.

## 2026-10-21: setup and read-only checks (no funds yet)

| # | Test | Result |
|---|---|---|
| 1 | Install `@somnia-chain/markets-sdk@0.32.1` in an empty project | OK. The docs give no install command. npm pulls `viem` as a peer; `react` and `@somnia-chain/reactivity` are optional peers. |
| 2 | Developer page "Connect" snippet, verbatim, read-only | OK: 21 perp markets, BTC row found. Exits on its own (indexer-only read). |
| 3 | Same with `privateKey` from `.env` | OK, `walletAddress` resolves. |
| 4 | Process exit after a chain read (`getPerpRiskParams`, `getPerpSystemConfig`) | Stays alive on the WebSocket until `markets.close()`. `close()` exists and works. Not reported: expected for a WS client. |
| 5 | Docs contracts table vs `getPerpSystemConfig` | All match. |
| 6 | `SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral` vs perps collateral | Different, as the docs' pitfall says. |
| 7 | Market table (tick, min size, leverage, IM/MM) vs chain | All match for 21 markets. |
| 8 | Base decimals table vs market rows | All match. |
| 9 | Open interest cap column and the "a tenth" rule vs `getPerpRiskParams` | Mismatch → **feedback 002**. |
| 10 | Paper USDso column vs `MarginBank.isVoucherMarketAllowed` | Mismatch → **feedback 001**. |
| 11 | Voucher campaign and eligibility | Live, 1000 USDso grant, `leverageCapX` 20; session wallet eligible. |
| 12 | `listPerpPoolStatuses` | 21 pools, all registered, none restricted. |
| 13 | SDK docs Quick start symbol `BTC/USDSO:USDSO` | Unknown symbol; the real one is `BTC/USDso:USDso`; misleading "call loadMarkets() first" → **feedback 003**. |
| 14 | SDK docs one-shot sample `listPerpMarkets({ baseSymbol: "WBTC" })` | 0 rows, then TypeError; "10 pools, four restricted" and "BTC and ETH only" are stale → **feedback 004**. |
| 15 | `getPerpState`, `getPerpFeedStatus`, `fetchTicker`, `fetchFundingRate` on BTC | Consistent with each other and with the indexer row (mark, index, funding rate, OI). |
| 16 | `fetchTicker.statsAsOf` is in the future | By design: TSDoc defines it as the end of the candle window. Not a bug. |
| 17 | `fetchTicker.lastSource.timestamp` is the candle bucket start, not the trade time | Documented in TSDoc. Not a bug. |
| 18 | `fetchOrderBook("BTC/USDso:USDso", 5)` | Prices on the 0.1 tick, sizes on the lot grid, best bid < best ask. |
| 19 | `getMaxPerpOrderSize` with a zero balance | `priceable: true`, `placeable: false`, `limitedBy: "collateral"`, `maxPositionSize` 100 BTC (matches risk params). |
| 20 | `getMarginAccount`, `fetchBalance`, `fetchPositions` on an empty account | Zeros / empty, `marginStatus: "Healthy"`. |
| 21 | dreamDEX HTTP API `GET https://stg.api.dreamdex.io/v0/markets` | Shannon only, 3 spot markets, no perps. The docs do not claim perps there. |
| 22 | Funding sign on BTC: mark < index while `fundingRate` > 0 | `emaPremium` > 0 (last trade above index). In this sample the rate was exactly `emaPremium` − 0.0005. The docs do not say how the rate is derived. Not reported yet; revisit when funding can be observed on a position. |

## 2026-10-21: bot kit (no funds)

Setup: owner (app account) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892` (not linked yet). The session wallet `0x344F…1E40` is empty and no longer used.

| # | Test | Result |
|---|---|---|
| 23 | Bot kit `npm ci` at `2579866` | OK. npm 11 warns that the esbuild postinstall is not in allowScripts; tsx still runs. perp-core resolves SDK 0.31.0, while the docs say the app runs 0.32.1. No failure seen from that yet. |
| 24 | `npm run perp:doctor` with bot key + OWNER_ADDRESS | OK: link `NOT LINKED`, bot gas 0 STT, owner margin 1000 unlocked / 0 withdrawable (voucher), 21 markets. |
| 25 | perp:doctor price formatting | `toFixed(2)` shows LIT/NEAR/SUI/XRP books as bid = ask → **feedback 005**. |
| 26 | Owner voucher account: `getPerpLeverage`, `getMaxPerpOrderSize`, `previewPerpOrderMargin` on BTC/ZEC/LIT/ZRO/TAO | All placeable, not voucher-blocked → added to **feedback 001**. |
| 27 | perp-core `sizeOrder` / `alignQuantity` / `placePerp` (code read) | Sizes via `getMaxPerpOrderSize`; lot alignment down; returns 0 below minQuantity; IOC no-fill and PostOnlyWouldCross handled. Nothing reportable. |
| 28 | Funding display on perp:doctor | Most markets show 10.950% APR (pays shorts) = 0.01% per 8h × 3 × 365, the positive floor the kit's comment mentions. |

## 2026-10-21: orders as a linked bot (owner `0xB667…309A`, bot `0x29cF…8892`)

| # | Test | Result |
|---|---|---|
| 29 | perp:doctor after linking | `link: ok on all 21 markets`, bot gas 5 STT. |
| 30 | Voucher account opens ZEC (docs: not allowed) | Filled, then closed → **001** confirmed end to end. |
| 31 | Gas / cost per successful `placeOrderFor` | 2.7M-4.3M gas, 0.016-0.026 STT at 6 gwei → **007**. Resting orders 1.1M-1.8M; cancel 173k; reduce 117k; a reverting IOC 110k. |
| 32 | `getPerpPosition.lastUpdatedTimestampNs` / `fetchPositions().timestamp` | Always 0 / 1970 → **006**. |
| 33 | IOC that misses the touch | Status 0; replay at parent block decodes `ImmediateOrCancelNoFill`, as the docs say. |
| 34 | Validation via simulation (`edge-sims.ts`) | qty 0 / below min → `QuantityBelowMinimum`; off lot → `InvalidQuantity`; off tick / 0 price → `InvalidPrice`; post-only crossing → `PostOnlyWouldCross`; FOK too large → `FillOrKillNotFillable`; past/0 expiry → `OrderAlreadyExpired`; builder fee w/o approval → `BuilderFeeExceedsApproval`; msg.value → `UnexpectedNativeDeposit`; > maxPositionSize at a tiny price → `MaxPositionSizeExceeded`; 18-dec qty scale → `InsufficientCollateral` (as the docs say). orderType 4 → bare revert (enum panic, not reported). Resting bids at 1 tick and asks at 2x the book are accepted (the band applies to fills only). |
| 35 | Resting order lock | locked = qty × price × IMF exactly (1.0231 for 0.00026 @ 78700 × 5%). |
| 36 | reduce → cancel → cancel again | Second cancel: `IncorrectSender(owner, 0x0 / other trader)` instead of the documented `OrderIdMismatch` → **008**. |
| 37 | Same-owner slot reuse + stale id | Stale id reverts `IncorrectOrder`; the newer order is untouched. No correctness bug. |
| 38 | Reduce-only for regular orders | Not in the ABI or `CreateOrderParams`; `reduceOnly` param silently dropped → **009**. |
| 39 | Analytics vs hand math (uPnL, notional, IM/MM, previewClose, leverage) | Equal to the wei. Liquidation price clamps to 0 for an over-collateralised long. |
| 40 | `placeOrdersFor` batch with an unfillable IOC | `successes [false, true]`; indexer rejection `ImmediateOrCancelNoFill`, `requestIndex 0`, as documented. |
| 41 | `fullQuantity` after reduce | Rewritten to the reduced size; history calls it "original size" → **010**. |
| 42 | bot kit perp-starter `DRY_RUN=true` on ETH-PERP, 20 USDso | Sizes 0.0082 ETH; TP/SL from the mark. Nothing sent. |
| 43 | Funding history rows vs chain | Each hourly row moves `cumulativeFundingPerUnit` by ≈ index × rate / 8, as the docs say. |
| 44 | `watchOrderBook` (30 s, ETH) vs `fetchOrderBook` | 25 updates, never crossed, timestamps monotonic, final book identical. |
| 46 | Funding settlement on a held BTC long (0.00013, entry 82907.6), boundary 07:11:43Z; closed at 07:12:23Z, tx `0x91230e2fe56fac78d8febdebd963b5474b2a79c911d54c63e5a929224327c2fd` | `FundingSettled.payment` 0.001594655649114580 USDso (long paid, rate > 0) = size × Δ`cumulativeFundingPerUnit`, rounded up 1 wei. Docs formula size × index × rate / 8, with the rate published at that settlement, gives 0.0015946 (index read 35 s later). `accruedFunding` from `getPerpPositionAnalytics` before the close was the same 1594655649114580. Realized PnL −0.001547 = (82895.7 − 82907.6) × 0.00013. Balance 999.993636344350885420 = previous − realized − funding, to the wei. All consistent. |
| 47 | bot kit perp-maker on ETH: DRY_RUN, then real for 75 s (12 USDso/side, cap 30) | Quotes ±15 bps around the mark, POST_ONLY; both rested (txs from the bot), no requote, no fill. Lock with both quotes = sum of both sides' IM (1.1804). Quotes left on the book after a kill were cancelled by hand. Nothing reportable. |
| 48 | bot kit perp-funding on BTC: DRY_RUN, then real (12 USDso, cap 13) | APR 142.654% = rate 0.0013028 × 3 × 365, correct; opened a 0.00014 BTC short (paid side). The log's "@ price" is the IOC limit, not the fill (83496.7). Held to the next funding to check that the receiving side is credited. |
| 49 | Liquidation engine / insurance / cadence vs Margin & Liquidations + Funding pages | Penalty 100 bps (= "up to 1%"), insurance fund 1.66M USDso, all 21 markets 8 h window / 1 h settlement, IM/MM/close-out halve on all 21. Backstop bidder registered and active, but the docs say none → **011**. |
| 50 | Funding sign vs premium on all 21 markets | Rate = P + clamp(0.0001 − P, ±0.0005) on 21/21; perp below index but longs pay on 10/21 → **012**. Mark sits 0-8 bps under the index on 20/21 markets; the mark formula is not documented, but nothing contradicts a doc, so not reported. |
| 51 | HTTP / WebSocket / CCXT / Contracts docs vs perps | None covers perps or the Hideki network; the indexer (21 perp queries, 21 subscriptions) is documented by URL only → **013**. Shannon spot endpoints were not tested (out of scope: Tokyo only). |
| 52 | Stop (TP/SL) reads | Registry fee 0.15 STT on all 21 markets (matches docs); `listPerpStopOrders` works (198 pending on BTC); owner has none, unclaimed SOMI 0. Placing stops skipped: a linked bot cannot arm them and the owner key is not available here. |
| 53 | Short 0.00014 BTC held across the 10:11:43Z settlement, closed in tx `0x13a1187be149f87b9db754b42877764a5d5e042d1d25db112a9b06b3393b6157` | `FundingSettled.payment` −0.001968265765586032 (short received; rate > 0) = size × Δcum; equals `accruedFunding` before the close; realized +0.003626; balance 999.999230610116471452 to the wei. Consistent. |
| 54 | Voucher rules (owner simulated via `eth_call`) | `withdraw(1 wei)` → `WithdrawalBelowCreditFloor` (matches docs). `setMaxLeverage` succeeds and writes storage → **014**. `isolated(owner)` false (cross default). |
| 55 | Liquidation fee | Not on `PositionLiquidated` (SDK: `penalty` reserved); charged as `LiquidationFeeCharged` = exactly 1% of fill notional, all to insurance; indexed via `listPerpFees({ kind: "LiquidationFee" })`. Consistent with "up to 1%". |
| 56 | FAQ "My order was rejected" vs contract | Min size, lot/tick, post-only, IOC remainder, self-trade (whole order refused, also with others' liquidity ahead) all match. SDK's CANCEL_TAKER wording does not → **015**. |
| 57 | Expiry | Past expiry: hidden by `fetchOrderBook`, still in `getOpenOrders` (no expiry field), margin stays locked until cancel, reduce → `ExpiredOrderMustBeCancelled`, history `Expired` → **016**. |
| 58 | SDK Perps docs samples (keeper, ADL, protocol state, equity, history, one-shots) | 79/82 documented calls exist; `quotePerpClose`, `getPerpPositionsPage`, `exchange.quotePerpClose` and the `CreditReclaimed` filter do not → **017**. `waitForIndexedBlock` timed out once on the WS (`eth_blockNumber`); not reproduced. |
| 59 | Amend (owner simulated) | Singular amend: reprice OK, crossing → `PostOnlyWouldCross`, gone id → `AmendOldOrderGone`, `alwaysPlace` places. Batch `amendOrders` with a rejected rung cancels the original and returns 0 → **018**. Bot can call `amendOrderFor` (documented: needs place+cancel grants). |
| 60 | Watch latency (ETH, 2 runs) | `getLiveUserOrders` (Open filter) and `watchOrders` show/drop the order within 0.1-0.2 s of the receipt; indexer `getOpenOrders` 0.7-1.6 s later. `watchPerpMarkets`: hydrates in ~3 s, live liquidation rows = indexed rows, newest-first. No issue. |
| 61 | bot kit perp-core tests, perp-guard, perp-starter real (ETH 12 USDso) | 31/31 tests pass; guard reports no positions. perp-starter opened 0.0049 ETH, then its watch loop threw once ("Live markets: (none)" on `loadMarkets(true)`) and exited with the position open and unwatched. Not reproduced in 7 replica ticks nor in `loadmarkets-reload.ts` on 0.31.0/0.32.1, so not reported. Position closed by hand (tx `0xbb551e44783ff5cfa6f7958ca39ab782dd368513b1995430fcdfdfe7d5f98e19`). |
| 62 | TP/SL via the app on the owner account (ETH long 0.1475 @ 2457.78) | Linked TP ≥2800 / SL ≤1500 in one tx (`0x4be55ab7…`): owner STT 15 → 14.70 (2 × 0.15), both `reduceOnly`, full size, `limitPrice` 0, siblings linked; gas paid by the app's signer. TP cancelled: +0.15 refunded, status CANCELLED / reason Owner, SL kept with sibling cleared. SL moved to 2456: old SL cancelled and new one created in one tx (`0x20ed9cc7…`), STT net unchanged. SL fired at 13:37:00Z (tx `0xdb6da828775fb56874c0214b28ab95a803f871c8d7fa0436c836e888855a8e58`, sent by the registry), filled 2455.29 (trigger 2456), realized −0.367275 = (2455.29 − 2457.78) × 0.1475; the 0.15 STT was consumed (owner STT stays 14.85), as the docs say. All consistent. My monitor stopped twice on indexer `fetch failed` / `ECONNRESET`; not a product finding. |
| 63 | 2026-10-24 change check | markets-sdk: no release since 2026-10-20 (`latest` 0.32.1). Bot kit: no new commits (`2579866`). dreamDEX perps pages (trader, developer, Margin & Liquidations, Funding, Orders, Link a Bot, Errors, Functions, FAQ): unchanged. SDK Perps page: one new paragraph on stop-registry checks (handled privately). LiquidationEngine implementation upgraded (`0x7043…219b` → `0xf46c…702d`); MarginBank and pool code unchanged. |
| 64 | Stop orders with the developer page's Connect config | `SOMNIA_HIDEKI_TESTNET_ADDRESSES` lacks `operatorPermissionsRegistry` → every stop build throws `NotConfiguredError` → **019**. |
| 65 | Re-run of all reports, 2026-10-24 | 001-006, 008-018 reproduce unchanged (012 now 12/21 markets; 005 now visible on XRP; 006 checked on 10 other accounts' BTC positions, all `lastUpdatedTimestampNs` 0). One 018 run looked fixed but the book had moved (the replacement no longer crossed); two traced re-runs show the gap again. 007: docs unchanged; resting order today 557k gas. Nothing fixed. |
| 66 | 2026-10-26 multi-market: ETH long 1.2, BTC short 0.018, SOL long 4.5 (`multi-market-views.ts`) | unlocked + Σ `equityContribution` = `getMarginAccount.equity` = raw `getAccountHealth` to the wei; Σ IM / Σ MM = imReq / mmReq (SDK and raw). `accountPositions` liq prices ≈ `getLiquidationPrice` (blocks apart) ≈ hand formula (ETH ≈ 1573). No issue. |
| 67 | `getMaxPerpOrderSize` with cross positions (ETH, AVAX, BTC; 12 cases, `max-size-check.ts`) | Equal to the pool's accepted max at the same block in all 12. AVAX max notional = free margin / 10%. No issue. |
| 68 | `accountPositions.subscribe` latency (`positions-view-latency.ts`) | Position drop and lock changes appear in the view at the receipt's block; `previewPerpOrderMargin` lock 17.518 = actual lock. A `getMarginAccount` read right after an HTTP receipt can still show the pre-tx state (WS vs HTTP node lag); not reported. |
| 69 | SDK-side input validation | `createOrder` floors to the lot and rejects < 1 lot, but its code comment assumes lot = minQuantity ("no band where an order passes here and still reverts as below-minimum"), which is false for perps (BTC: 13 lots). The privateKey executor does not simulate, so 1-12 lots would mine a revert (~110k gas). `limits.amount.min` is correct on all 21 markets. Minor; not reported. |
| 70 | Price band (`band-sims.ts`) | `getCircuitBreakerParameters` = 500 bps (ETH) / 2000 bps (ZEC). Taker sells priced 10% under the mark fill near the touch (book is deep); could not reach the band within margin. Inconclusive; not reported. |
| 71 | Developer page samples type-check (`tsc --strict`) | Compile cleanly against 0.32.1. Documented enum lists (limitedBy, voucher reasons) match the type unions. |
| 45 | `getMaxPerpOrderSize` vs pool acceptance (ETH, 4 cases) | Identical when simulated at the SDK's `asOfBlock`. A first run at a different block looked off by one lot; that was the block, not a bug. |

## Next (needs test funds)

- Claim the paper USDso voucher, then try an order on a market the docs mark `No` (confirms 001 end to end).
- Order lifecycle, validation edge cases, margin/PnL/funding numbers vs the docs' formulas.
- Bot kit perps examples (`perp-starter`, `perp-maker`, `perp:doctor`).
