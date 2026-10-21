// Read-only: liquidation engine, insurance fund, funding cadence and margin ladder for every perp market,
// to compare with the Margin & Liquidations and Funding pages.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c = ex.client
const perps = await c.listPerpMarkets()
const cfg = await c.getPerpSystemConfig(perps[0].marginBank)
console.log("engine", j(await c.getLiquidationEngineConfig(cfg.liquidationEngine)))
console.log("insurance", j(await c.getInsuranceFundState(cfg.insuranceFund)))
const odd: string[] = []
for (const m of perps) {
  const [st, r] = await Promise.all([c.getPerpState(m.poolAddress), c.getPerpRiskParams(m.poolAddress)])
  const ladder = r.maintenanceMarginBps * 2n === r.initialMarginBps && r.closeOutMarginBps * 2n === r.maintenanceMarginBps
  if (st.fundingWindowSec !== 28800 || st.fundingIntervalSec !== 3600 || !ladder) odd.push(`${m.baseSymbol} window ${st.fundingWindowSec} interval ${st.fundingIntervalSec} im/mm/co ${r.initialMarginBps}/${r.maintenanceMarginBps}/${r.closeOutMarginBps}`)
  await new Promise((s) => setTimeout(s, 150))
}
console.log(`markets checked ${perps.length}; not 8h/1h or not halving ladder: ${odd.length ? odd.join("; ") : "none"}`)
const liqs: any[] = await c.listLiquidations({ limit: 10 } as any)
console.log("recent liquidation rows", liqs.length, j(liqs.slice(0, 3)).slice(0, 1500))
await ex.close()
