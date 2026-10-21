// Lists every client./trader./exchange. method the SDK website's Perps page uses and checks whether the installed
// @somnia-chain/markets-sdk exposes it at runtime (a real client/trader/exchange object, not just typings).
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { readFileSync } from "node:fs"
const URL = "https://somnia-platform-docs.vercel.app/markets/somnia-markets/typescript/perps"
const html = await fetch(URL).then((r) => r.text())
const text = html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
const pkg = JSON.parse(readFileSync("node_modules/@somnia-chain/markets-sdk/package.json", "utf8"))
// read-only, no key: client.* and exchange.* are checked on live objects; trader.* (which needs a signer) is
// checked against the method declarations in the SDK typings (dist/trade.d.ts, dist/orders.d.ts).
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const traderSrc = ["trade.d.ts", "orders.d.ts"].map((f) => readFileSync(`node_modules/@somnia-chain/markets-sdk/dist/${f}`, "utf8")).join("\n")
const traderProxy = new Proxy({}, { get: (_, name: string) => (new RegExp(String.raw`^\s+(async\s+)?` + name + String.raw`\(`, "m").test(traderSrc) ? () => {} : undefined) })
const objs: Record<string, any> = { client: ex.client, trader: traderProxy, exchange: ex }
const missing: string[] = [], present = new Set<string>()
for (const [, obj, name] of text.matchAll(/\b(client|trader|exchange)\.([a-zA-Z][a-zA-Z0-9]+)\s*\(/g)) {
  const key = `${obj}.${name}`
  if (present.has(key) || missing.includes(key)) continue
  if (typeof objs[obj]?.[name] === "function" || (obj === "client" && name === "perpAdlQueue")) present.add(key)
  else missing.push(key)
}
console.log(`SDK ${pkg.version}; docs page ${URL}`)
console.log(`methods called in the docs: ${present.size + missing.length}; present ${present.size}; missing ${missing.length}`)
for (const k of missing) console.log("  MISSING " + k)
await ex.close()

// The docs' equity-flow procedure filters margin events by four kinds, one of which the SDK rejects.
const account = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A"
const ex2 = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
try {
  const rows = await ex2.client.getMarginEvents(account, { kinds: ["Deposit", "Credited", "Withdraw", "CreditReclaimed"], limit: 200, offset: 0 } as any)
  console.log(`getMarginEvents(kinds incl. CreditReclaimed) -> ${rows.length} rows`)
} catch (e: any) { console.log(`getMarginEvents(kinds incl. CreditReclaimed) -> ${e.name}: ${e.message}`) }
await ex2.close()
