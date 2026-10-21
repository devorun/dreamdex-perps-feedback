// Read-only: penalty / closed notional on indexed PositionLiquidated rows vs the docs' "up to 1%".
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const perps = await ex.client.listPerpMarkets()
const dec = new Map(perps.map((m) => [m.poolAddress.toLowerCase(), { d: m.baseDecimals, s: m.baseSymbol }]))
const rows: any[] = await ex.client.listLiquidations({ kinds: ["PositionLiquidated"], limit: 200 } as any)
let over = 0, n = 0, max = 0, zero = 0
const sample: string[] = []
for (const r of rows) {
  const m = dec.get(String(r.pool).toLowerCase()); if (!m || r.penalty == null || r.size == null || r.price == null) continue
  const notional = (Math.abs(Number(r.size)) / 10 ** m.d) * (Number(r.price) / 1e18)
  const pen = Number(r.penalty) / 1e18
  const pct = notional ? (pen / notional) * 100 : 0
  n++; if (pct > 1.0000001) over++; if (pen === 0) zero++; if (pct > max) max = pct
  if (sample.length < 6) sample.push(`${m.s} size ${r.size} price ${r.price} penalty ${r.penalty} -> ${pct.toFixed(4)}% (tx ${r.txHash})`)
}
console.log(`PositionLiquidated rows checked ${n}: penalty > 1% of notional on ${over}, zero penalty on ${zero}, max ${max.toFixed(4)}%`)
for (const s of sample) console.log("  " + s)
await ex.close()
