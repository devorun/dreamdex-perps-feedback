// Unified fetchPositions() and the raw position for an address-only (read-only) account.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const OWNER = (process.argv[2] ?? "0xB667DAae78712068Ef9c2Cab61c3217901a0309A") as `0x${string}`
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", account: OWNER } as any)
console.log("walletAddress", ex.walletAddress)
await ex.loadMarkets()
for (const p of await ex.fetchPositions()) console.log("fetchPositions", j(p))
const btc = (await ex.client.listPerpMarkets({ baseSymbol: "BTC" }))[0]
console.log("getPerpPosition", j(await ex.client.getPerpPosition({ marginBank: btc.marginBank, account: OWNER, pool: btc.poolAddress })))
console.log("listPerpPositions(indexer)", j(await ex.client.listPerpPositions(OWNER)))
await ex.close()
