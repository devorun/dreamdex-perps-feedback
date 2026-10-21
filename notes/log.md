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
| 45 | `getMaxPerpOrderSize` vs pool acceptance (ETH, 4 cases) | Identical when simulated at the SDK's `asOfBlock`. A first run at a different block looked off by one lot; that was the block, not a bug. |

## Next (needs test funds)

- Claim the paper USDso voucher, then try an order on a market the docs mark `No` (confirms 001 end to end).
- Order lifecycle, validation edge cases, margin/PnL/funding numbers vs the docs' formulas.
- Bot kit perps examples (`perp-starter`, `perp-maker`, `perp:doctor`).
