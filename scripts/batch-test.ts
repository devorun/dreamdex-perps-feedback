// placeOrdersFor batch: one IOC that cannot fill + one POST_ONLY that rests. Checks the docs' claims:
// successes[i] false for the refused entry, OrderRejected reason 5, and client.listPerpOrderRejections naming it.
import { SomniaMarkets, contractErrorsAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, createWalletClient, http, parseAbi, parseEventLogs, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "BTC"
const ABI = [
  ...parseAbi([
    "struct PlaceOrderRequest { bool isBid; uint64 userData; uint256 price; uint256 quantity; uint64 expireTimestampNs; uint8 orderType; uint8 selfMatchingOption; address builder; uint96 builderFeeBpsTimes1k; }",
    "function placeOrdersFor(address owner, PlaceOrderRequest[] requests) returns (bool[] successes, uint128[] ids)",
    "event OrderRejected(uint128 indexed orderId, address indexed owner, uint8 indexed reason)",
  ]),
  ...contractErrorsAbi,
] as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
const pool = m.poolAddress as `0x${string}`
const tick = BigInt(m.tickSize), minQ = BigInt(m.minQuantity)
await ex.loadMarkets()
const bid = parseUnits(String((await ex.fetchOrderBook(`${base}/USDso:USDso`, 1)).bids[0][0]), 18)
const far = ((bid * 95n) / 100n / tick) * tick
const expire = BigInt(Math.floor(Date.now() / 1000) + 86400) * 1_000_000_000n
const Z = "0x0000000000000000000000000000000000000000" as const
const req = (isBid: boolean, price: bigint, orderType: number, userData: bigint) =>
  ({ isBid, userData, price, quantity: minQ, expireTimestampNs: expire, orderType, selfMatchingOption: 0, builder: Z, builderFeeBpsTimes1k: 0n })
const requests = [req(true, far, 2, 501n), req(true, far, 3, 502n)] // [IOC that cannot fill, POST_ONLY that rests]
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const wal = createWalletClient({ account: bot, chain: hidekiTestnet, transport: http("https://api.hideki2.infra.testnet.somnia.network") })

const { result } = await pub.simulateContract({ address: pool, abi: ABI, functionName: "placeOrdersFor", args: [OWNER, requests], account: bot, gas: 10_000_000n })
console.log("simulate", j(result))
const hash = await wal.writeContract({ address: pool, abi: ABI, functionName: "placeOrdersFor", args: [OWNER, requests], gas: 10_000_000n })
const r = await pub.waitForTransactionReceipt({ hash })
console.log("tx", hash, "status", r.status, "block", r.blockNumber, "gasUsed", r.gasUsed)
console.log("OrderRejected logs", j(parseEventLogs({ abi: ABI, logs: r.logs, eventName: "OrderRejected" }).map((l) => l.args)))
const ret = await pub.call({ to: pool, data: (await pub.getTransaction({ hash })).input, account: bot.address, blockNumber: r.blockNumber - 1n }).catch((e) => ({ data: "call failed " + e.shortMessage }))
console.log("note: replay of return values at parent block is indicative only:", String((ret as any).data).slice(0, 80))
for (let i = 0; i < 6; i++) {
  await new Promise((s) => setTimeout(s, 5000))
  const rej = await ex.client.listPerpOrderRejections({ owner: OWNER, limit: 5 })
  console.log(`listPerpOrderRejections after ${(i + 1) * 5}s:`, j(rej).slice(0, 700))
  if (rej.length) break
}
await ex.close()
