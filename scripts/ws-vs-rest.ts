// Subscription vs one-shot read: watchOrderBook updates for N seconds, then compare the last pushed book with fetchOrderBook.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const base = process.argv[2] ?? "ETH", secs = Number(process.argv[3] ?? 30)
const S = `${base}/USDso:USDso`
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
await ex.loadMarkets()
let n = 0, last: any, crossed = 0, nonMono = 0, prevTs = 0
const end = Date.now() + secs * 1000
while (Date.now() < end) {
  const ob: any = await Promise.race([ex.watchOrderBook(S, 5), new Promise((r) => setTimeout(() => r(null), 5000))])
  if (!ob) continue
  n++; last = ob
  if (ob.bids[0] && ob.asks[0] && ob.bids[0][0] >= ob.asks[0][0]) crossed++
  if (ob.timestamp && ob.timestamp < prevTs) nonMono++
  prevTs = ob.timestamp ?? prevTs
}
const rest: any = await ex.fetchOrderBook(S, 5)
console.log(`updates ${n}, crossed books ${crossed}, timestamp went backwards ${nonMono}`)
console.log("ws   top", JSON.stringify({ bids: last?.bids?.slice(0, 3), asks: last?.asks?.slice(0, 3), ts: last?.timestamp, nonce: last?.nonce }))
console.log("rest top", JSON.stringify({ bids: rest.bids.slice(0, 3), asks: rest.asks.slice(0, 3), ts: rest.timestamp, nonce: rest.nonce }))
await ex.close()
