// Read-only: SDK position analytics for the owner's BTC position vs hand computation from raw chain values.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "BTC"
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c = ex.client
const m = (await c.listPerpMarkets({ baseSymbol: base }))[0]
const ref = { marginBank: m.marginBank, account: OWNER, pool: m.poolAddress }
const block = await c.getViemClient().getBlockNumber()
const [pos, st, acct, an, liq, lev, close, snap, risk] = await Promise.all([
  c.getPerpPosition(ref), c.getPerpState(m.poolAddress), c.getMarginAccount(m.marginBank, OWNER),
  c.getPerpPositionAnalytics(ref), c.getLiquidationPrice(ref), c.getPerpLeverage(ref),
  c.previewPerpClosePnl({ pool: m.poolAddress, marginBank: m.marginBank, account: OWNER }),
  c.getPerpHealthSnapshot(m.poolAddress), c.getPerpRiskParams(m.poolAddress),
])
console.log("block", block, "now", Math.floor(Date.now() / 1000))
console.log("position", j(pos)); console.log("state", j({ mark: st.markPrice, index: st.indexPrice, rate: st.fundingRate, cum: st.cumulativeFundingPerUnit, projCum: st.projectedCumulativeFundingPerUnit, lastFundingUpdateAt: st.lastFundingUpdateAt, nextFundingAt: st.nextFundingAt }))
console.log("account", j(acct)); console.log("analytics", j(an)); console.log("liquidationPrice", j(liq)); console.log("leverage", j(lev)); console.log("previewClose", j(close)); console.log("healthSnapshot", j(snap))
const oneBase = 10n ** BigInt(m.baseDecimals)
const size = BigInt(pos.size), entry = BigInt(pos.avgEntryPrice), mark = BigInt(st.markPrice)
console.log("hand uPnL (mark-entry)*size/oneBase =", ((mark - entry) * size) / oneBase)
console.log("hand notional |size|*mark/oneBase =", (size * mark) / oneBase, " IM 5% =", (size * mark * risk.initialMarginBps) / (oneBase * 10000n), " MM 2.5% =", (size * mark * risk.maintenanceMarginBps) / (oneBase * 10000n))
const eq = BigInt(acct.equity), mm = BigInt(acct.mmReq), mmBps = risk.maintenanceMarginBps
console.log("hand long liq p = mark - (equity - mmReq)*oneBase*10000/(|size|*(10000-mmBps)) =", mark - ((eq - mm) * oneBase * 10000n) / (size * (10000n - mmBps)))
await ex.close()
