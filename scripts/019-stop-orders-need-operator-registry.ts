// With the developer page's Connect config, every perp stop (TP/SL) build fails: the SDK's own
// SOMNIA_HIDEKI_TESTNET_ADDRESSES preset has no operatorPermissionsRegistry. Builds only; nothing is signed or sent.
// A key is needed only because stop builds live on the Trader:  node --env-file=../.env 019-stop-orders-need-operator-registry.ts
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { parseUnits } from "viem"
import { readFileSync } from "node:fs"
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.resolve("@somnia-chain/markets-sdk")), "utf8")).version
console.log(`markets-sdk ${version}`)
console.log("SOMNIA_HIDEKI_TESTNET_ADDRESSES keys:", Object.keys(SOMNIA_HIDEKI_TESTNET_ADDRESSES).join(", "))
console.log("operatorPermissionsRegistry in preset:", (SOMNIA_HIDEKI_TESTNET_ADDRESSES as any).operatorPermissionsRegistry)
const markets: any = new SomniaMarkets({
  chain: hidekiTestnet,
  indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  privateKey: (process.env.BOT_PRIVATE_KEY ?? process.env.PRIVATE_KEY) as `0x${string}`,
})
const eth = (await markets.client.listPerpMarkets({ baseSymbol: "ETH" }))[0]
const leg = { isBid: false, quantity: parseUnits("0.004", eth.baseDecimals), triggerPrice: parseUnits("1500", eth.quoteDecimals), triggerOperator: 1 as const, stopOrderType: 1 as const }
for (const [label, call] of [
  ["trader.buildPlacePerpStopOrder (SL on ETH-PERP)", () => markets.trader.buildPlacePerpStopOrder({ ...leg, registry: eth.stopRegistry, pool: eth.poolAddress })],
  ["trader.buildPlacePerpStopOrder with pair (TP+SL)", () => markets.trader.buildPlacePerpStopOrder({ ...leg, pair: { ...leg, triggerPrice: parseUnits("4000", 18), triggerOperator: 0 as const }, registry: eth.stopRegistry, pool: eth.poolAddress })],
] as const) {
  try { await call(); console.log(`${label}: built`) } catch (e: any) { console.log(`${label}: ${e.name}: ${e.message}`) }
}
await markets.close(); process.exit(0)
