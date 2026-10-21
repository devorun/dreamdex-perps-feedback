// Read-only: perp stop (TP/SL) registry fee per market vs the docs' 0.15 STT, plus the stop listings.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { formatEther } from "viem"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c: any = ex.client
const perps = await c.listPerpMarkets()
const fees = new Map<string, string[]>()
for (const m of perps) {
  let v: string
  try { v = formatEther(BigInt(await c.getPerpStopOrderSomiPayment(m.stopRegistry))) } catch (e: any) { v = "ERR " + e.message.slice(0, 80) }
  fees.set(v, [...(fees.get(v) ?? []), m.baseSymbol])
  await new Promise((s) => setTimeout(s, 100))
}
for (const [v, ms] of fees) console.log(`stop fee ${v} STT on ${ms.length} markets: ${ms.join(",")}`)
const btc = perps.find((m: any) => m.baseSymbol === "BTC")
console.log("owner pending stops", j(await c.listPerpStopOrders({ account: OWNER })))
const book = await c.listPerpStopOrders({ pool: btc.poolAddress })
console.log("BTC pool pending stops", book.length, j(book.slice(0, 2)).slice(0, 600))
console.log("owner unclaimed SOMI on BTC registry", j(await c.getUnclaimedPerpStopSomi({ registry: btc.stopRegistry, account: OWNER })))
await ex.close()
