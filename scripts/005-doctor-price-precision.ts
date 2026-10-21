// Prints the top of book at full precision next to what dreamdex-bot-kit's perp-doctor shows.
// perp-doctor formats every price with `px(v) = |v| >= 1 ? v.toFixed(2) : v.toPrecision(4)`.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"

const px = (v: number) => (Math.abs(v) >= 1 ? v.toFixed(2) : v.toPrecision(4)) // copied from scripts/perp-doctor.ts

const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
await ex.loadMarkets()
console.log("market | tick   | best bid | best ask | perp-doctor shows")
for (const base of ["LIT", "NEAR", "SUI", "XRP"]) {
  const symbol = `${base}/USDso:USDso`
  const ob = await ex.fetchOrderBook(symbol, 1)
  const [bid] = ob.bids[0]
  const [ask] = ob.asks[0]
  console.log(`${base.padEnd(6)} | 0.0001 | ${bid} | ${ask} | book[bid=${px(bid)} ask=${px(ask)}]`)
}
await ex.close()
