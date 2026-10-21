// Reads each perp pool's risk parameters and compares the open interest cap and the per-account
// position cap with the Perps on Testnet market table and its "a tenth of it on most markets" rule.
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { formatUnits } from "viem"

// "Open interest cap" column of https://app.testnet.dreamdex.io/docs/trading/perps-testnet
const DOCS_OI: Record<string, string> = {
  BTC: "246.81545", ETH: "3995.6125", HYPE: "23812.72", SOL: "47654.44", XRP: "344632", ADA: "2254678",
  AVAX: "66672.2", BNB: "693.975", DOGE: "5613590", LINK: "42643.6", NEAR: "250410", SUI: "635009",
  XLM: "2677780", "1000PEPE": "130285600", LIT: "138896.6", PUMP: "87993700", TAO: "2185.491",
  VVV: "21786.14", WLD: "1264000", ZEC: "420", ZRO: "250599.5",
}

const markets = new SomniaMarkets({
  chain: hidekiTestnet,
  indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
})
const perps = await markets.client.listPerpMarkets()
console.log("market   | docs OI cap  | on-chain maxOpenInterest | on-chain maxPositionSize | maxPositionSize / maxOpenInterest")
for (const m of perps.sort((a, b) => a.baseSymbol.localeCompare(b.baseSymbol))) {
  const r = await markets.client.getPerpRiskParams(m.poolAddress)
  const ratio = Number((r.maxPositionSize * 10000n) / r.maxOpenInterest) / 10000
  console.log(
    [m.baseSymbol.padEnd(8), DOCS_OI[m.baseSymbol].padEnd(12), formatUnits(r.maxOpenInterest, m.baseDecimals).padEnd(24),
      formatUnits(r.maxPositionSize, m.baseDecimals).padEnd(24), ratio].join(" | "),
  )
  await new Promise((s) => setTimeout(s, 200))
}
await markets.close()
