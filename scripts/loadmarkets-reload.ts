// loadMarkets() vs loadMarkets(true): how many perp (swap) markets come back, and how many are active.
// Run from a project whose @somnia-chain/markets-sdk is the version under test.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { readFileSync } from "node:fs"
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.resolve("@somnia-chain/markets-sdk")), "utf8")).version
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const count = (mk: Record<string, any>) => { const s = Object.values(mk).filter((m: any) => m.type === "swap"); return `swaps ${s.length}, active ${s.filter((m: any) => m.active).length}, ETH active ${(mk["ETH/USDso:USDso"] as any)?.active}` }
console.log(`markets-sdk ${version}`)
console.log("loadMarkets()       ->", count(await ex.loadMarkets()))
for (let i = 1; i <= 3; i++) { console.log(`loadMarkets(true) #${i} ->`, count(await ex.loadMarkets(true))); await new Promise((s) => setTimeout(s, 2000)) }
console.log("loadMarkets() again ->", count(await ex.loadMarkets()))
await ex.close()
