// getMarginEvents in markets-sdk 0.32.1 drops a sinceBlock/toBlock range without an error and returns the account's whole
// history. The SDK docs' equity-flow procedure relies on that range to net the flows between two equity snapshots.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const OWNER = (process.argv[2] ?? "0xB667DAae78712068Ef9c2Cab61c3217901a0309A") as `0x${string}`
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c: any = ex.client
const head: bigint = await c.getViemClient().getBlockNumber()
const range = { sinceBlock: head - 5n, toBlock: head } // a 6-block window ending now
const kinds = ["Deposit", "Credited", "Withdraw"]
const all: any[] = await c.getMarginEvents(OWNER, { kinds, limit: 200, offset: 0 })
const ranged: any[] = await c.getMarginEvents(OWNER, { kinds, ...range, limit: 200, offset: 0 })
const inverted: any[] = await c.getMarginEvents(OWNER, { kinds, sinceBlock: head, toBlock: head - 10n, limit: 200, offset: 0 })
const ts = (r: any) => new Date(Number(r.timestamp) * 1000).toISOString()
console.log(`head ${head}; range ${range.sinceBlock}..${range.toBlock}`)
console.log(`getMarginEvents(no range): ${all.length} rows; with the 6-block range: ${ranged.length} rows; with an inverted range: ${inverted.length} rows`)
console.log(`rows returned for the 6-block range (none of them is in it):`)
for (const r of ranged) console.log(`  ${r.kind.padEnd(9)} ${r.amount} at ${ts(r)} tx ${r.txHash} blockNumber field: ${r.blockNumber ?? "(absent)"}`)
const net = ranged.reduce((a, r) => a + (r.kind === "Withdraw" ? -BigInt(r.amount) : BigInt(r.amount)), 0n)
console.log(`net flow the documented procedure would subtract for this 6-block window: ${Number(net) / 1e18} USDso (expected 0)`)
await ex.close(); process.exit(0)
