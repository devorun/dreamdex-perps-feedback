// Read-only: per market, the protocol's own premium (emaPremium) vs the published funding rate.
// Flags markets where the perp trades below the index (premium < 0) yet longs pay (rate > 0), and checks
// rate == P + clamp(0.0001 - P, -0.0005, 0.0005) (an interest term the Funding page does not mention).
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const perps = await ex.client.listPerpMarkets()
const E = 10n ** 18n, I = 10n ** 14n, CAP = 5n * 10n ** 14n // 0.0001 and 0.0005 in 1e18 units
const clamp = (x: bigint) => (x > CAP ? CAP : x < -CAP ? -CAP : x)
let contradict = 0, formulaOk = 0
console.log("market   | emaPremium (P)   | fundingRate      | P+clamp(0.0001-P,±0.0005) | perp vs index | who pays")
for (const m of perps.sort((a, b) => a.baseSymbol.localeCompare(b.baseSymbol))) {
  const st: any = await ex.client.getPerpState(m.poolAddress)
  const P = BigInt(st.emaPremium), F = BigInt(st.fundingRate), model = P + clamp(I - P)
  if (model === F) formulaOk++
  const below = P < 0n, longsPay = F > 0n
  if (below && longsPay) contradict++
  const f = (x: bigint) => (Number(x) / Number(E)).toFixed(6).padStart(10)
  console.log(`${m.baseSymbol.padEnd(8)} | ${f(P)}       | ${f(F)}       | ${f(model)}${model === F ? " (=)" : " (≠)"}              | ${below ? "below" : "above"}         | ${longsPay ? "longs pay" : F < 0n ? "shorts pay" : "none"}${below && longsPay ? "  <-- docs say shorts pay" : ""}`)
  await new Promise((s) => setTimeout(s, 150))
}
console.log(`\nformula matches on ${formulaOk}/${perps.length}; perp below index but longs pay on ${contradict}/${perps.length}`)
await ex.close()
