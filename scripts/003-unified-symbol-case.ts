// The SDK docs' perps Quick start and the SDK's own TSDoc use "BTC/USDSO:USDSO".
// This prints the symbols loadMarkets() actually produces and calls the documented symbol.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"

const exchange = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const loaded = await exchange.loadMarkets()
console.log("BTC perp symbols after loadMarkets():", Object.keys(loaded).filter((s) => s.startsWith("BTC/") && s.includes(":")))

for (const symbol of ["BTC/USDSO:USDSO", "BTC/USDso:USDso"]) {
  try {
    const r = await exchange.fetchFundingRate(symbol)
    console.log(`fetchFundingRate("${symbol}") -> OK, fundingRate=${r.fundingRate}`)
  } catch (e: any) {
    console.log(`fetchFundingRate("${symbol}") -> ${e.name}: ${e.message}`)
  }
}
await exchange.close()
