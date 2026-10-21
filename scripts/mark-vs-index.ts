// Read-only: mark vs index vs book mid for every perp market, in bps, plus the funding rate sign.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
await ex.loadMarkets()
const perps = await ex.client.listPerpMarkets()
const bps = (a: number, b: number) => ((a - b) / b) * 1e4
let below = 0, n = 0
console.log("market   | mark-index bps | mid-index bps | mark-mid bps | rate (per 8h) | emaPremium")
for (const m of perps.sort((a, b) => a.baseSymbol.localeCompare(b.baseSymbol))) {
  const st = await ex.client.getPerpState(m.poolAddress)
  const ob = await ex.fetchOrderBook(`${m.baseSymbol}/USDso:USDso`, 1)
  const mark = Number(st.markPrice) / 1e18, index = Number(st.indexPrice) / 1e18
  const mid = ob.bids[0] && ob.asks[0] ? (ob.bids[0][0] + ob.asks[0][0]) / 2 : NaN
  n++; if (mark < index && mark < mid) below++
  console.log(`${m.baseSymbol.padEnd(8)} | ${bps(mark, index).toFixed(1).padStart(14)} | ${bps(mid, index).toFixed(1).padStart(13)} | ${bps(mark, mid).toFixed(1).padStart(12)} | ${(Number(st.fundingRate) / 1e18).toFixed(6).padStart(13)} | ${(Number((st as any).emaPremium) / 1e18).toFixed(6)}`)
  await new Promise((s) => setTimeout(s, 150))
}
console.log(`mark below both index and mid on ${below}/${n} markets`)
await ex.close()
