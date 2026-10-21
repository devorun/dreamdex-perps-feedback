// Reads MarginBank.isVoucherMarketAllowed(pool) for every perp pool with plain viem (no SDK),
// to compare against the "Paper USDso" column of the Perps on Testnet market table.
import { createPublicClient, http, parseAbi } from "viem"

const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const INDEXER = "https://hideki-dev.smk.somnia.host/v1/graphql"
const MARGIN_BANK = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394"
// Markets the docs table marks "No" under Paper USDso
const DOCS_NO = new Set(["1000PEPE", "LIT", "PUMP", "VVV", "ZEC", "ZRO"])

const q = await fetch(INDEXER, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: '{ Market(where: {marketType: {_eq: "PERP"}}) { id baseSymbol } }' }),
}).then((r) => r.json())
const rows: { id: `0x${string}`; baseSymbol: string }[] = q.data.Market

const client = createPublicClient({ transport: http(RPC) })
const abi = parseAbi(["function isVoucherMarketAllowed(address pool) view returns (bool)"])
const blockNumber = await client.getBlockNumber()
console.log(`block ${blockNumber}`)
console.log("market    pool                                        docs  isVoucherMarketAllowed")
for (const r of rows.sort((a, b) => a.baseSymbol.localeCompare(b.baseSymbol))) {
  const allowed = await client.readContract({ address: MARGIN_BANK, abi, functionName: "isVoucherMarketAllowed", args: [r.id], blockNumber })
  console.log(`${r.baseSymbol.padEnd(9)} ${r.id}  ${DOCS_NO.has(r.baseSymbol) ? "No " : "Yes"}   ${allowed}`)
  await new Promise((s) => setTimeout(s, 200))
}
