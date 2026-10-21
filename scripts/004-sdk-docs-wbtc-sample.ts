// "One-shot reads" sample from the SDK docs' Perps page, verbatim apart from the setup.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"

const exchange = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const client = exchange.client

const all = await client.listPerpMarkets()
console.log(`listPerpMarkets(): ${all.length} markets, base symbols: ${all.map((m) => m.baseSymbol).sort().join(",")}`)
const statuses = await client.listPerpPoolStatuses({ factory: (await client.getPerpSystemConfig(all[0].marginBank)).perpPoolFactory })
console.log(`listPerpPoolStatuses(): ${statuses.length} pools, restricted: ${statuses.filter((s) => s.restricted).length}`)

try {
  const perps = await client.listPerpMarkets({ baseSymbol: "WBTC", limit: 20 })
  console.log(`listPerpMarkets({ baseSymbol: "WBTC" }) -> ${perps.length} rows`)
  const one = await client.getPerpMarket(perps[0].id) // null if not a perp
  console.log(one?.baseSymbol)
} catch (e: any) {
  console.log(`docs sample threw ${e.name}: ${e.message}`)
}
await exchange.close()
