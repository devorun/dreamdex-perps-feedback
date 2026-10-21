// Own-account test: does cancelOrderFor(staleId) act on a NEWER order of the same owner that reused the slot?
// Places A, cancels A, places B; if B lands in A's slot (same high 64 bits), simulates cancelOrderFor(A) and reduceOrderFor(A).
// Nothing is sent for the stale id; only A and B are real orders, both resting far from the touch.
import { SomniaMarkets, contractErrorsAbi, decodePlaceOrder } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { ContractFunctionRevertedError, createPublicClient, createWalletClient, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "BTC"
const ABI = [
  ...parseAbi([
    "function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)",
    "function cancelOrderFor(address owner, uint128 orderId)",
    "function reduceOrderFor(address owner, uint128 orderId, uint256 newQuantityRemaining)",
    "function getOrder(uint128 orderId) view returns ((uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs))",
  ]),
  ...contractErrorsAbi,
] as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const slot = (id: bigint) => id >> 64n

const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
const pool = m.poolAddress as `0x${string}`
const tick = BigInt(m.tickSize)
await ex.loadMarkets()
const bid = parseUnits(String((await ex.fetchOrderBook(`${base}/USDso:USDso`, 1)).bids[0][0]), 18)
const price = ((bid * 95n) / 100n / tick) * tick
const qty = BigInt(m.minQuantity)
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const wal = createWalletClient({ account: bot, chain: hidekiTestnet, transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const expire = BigInt(Math.floor(Date.now() / 1000) + 86400) * 1_000_000_000n
const Z = "0x0000000000000000000000000000000000000000" as const

async function tx(functionName: "placeOrderFor" | "cancelOrderFor", args: readonly unknown[]) {
  const hash = await wal.writeContract({ address: pool, abi: ABI, functionName, args: args as never, gas: 10_000_000n })
  const r = await pub.waitForTransactionReceipt({ hash })
  console.log(`${functionName} tx ${hash} status ${r.status} block ${r.blockNumber}`)
  return r
}
async function sim(label: string, functionName: "cancelOrderFor" | "reduceOrderFor", args: readonly unknown[]) {
  try {
    await pub.simulateContract({ address: pool, abi: ABI, functionName, args: args as never, account: bot, gas: 10_000_000n })
    console.log(`SIM OK     ${label}`)
  } catch (e: any) {
    const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | undefined
    console.log(`SIM REVERT ${label}: ${r?.data?.errorName}(${j(r?.data?.args ?? [])})`)
  }
}

const place = () => tx("placeOrderFor", [OWNER, true, 0n, price, qty, expire, 0, 0, Z, 0n])
// prev = an order of ours that was just cancelled; next = the order placed right after it.
let prev = decodePlaceOrder(await place(), pool).orderId!
await tx("cancelOrderFor", [OWNER, prev])
let next = 0n
let found = false
for (let i = 0; i < 4; i++) {
  next = decodePlaceOrder(await place(), pool).orderId!
  console.log(`prev ${prev} slot ${slot(prev)} | next ${next} slot ${slot(next)}`)
  if (slot(next) === slot(prev)) { found = true; break }
  await tx("cancelOrderFor", [OWNER, next])
  prev = next
}
if (found) {
  const getOrder = (id: bigint) =>
    pub.readContract({ address: pool, abi: ABI, functionName: "getOrder", args: [id] }).then(j, (e) => "revert " + String(e.shortMessage).split("\n")[0])
  console.log("getOrder(prev):", await getOrder(prev))
  console.log("getOrder(next):", await getOrder(next))
  await sim(`cancelOrderFor(owner, prev=${prev}) [prev already cancelled, next rests in its slot]`, "cancelOrderFor", [OWNER, prev])
  await sim(`reduceOrderFor(owner, prev=${prev}, 0)`, "reduceOrderFor", [OWNER, prev, 0n])
  await sim(`cancelOrderFor(owner, next=${next}) [control]`, "cancelOrderFor", [OWNER, next])
  console.log(`next ${next} is left resting; cancel it with: op.ts cancel ${base} ${next}`)
} else console.log("no same-slot reuse in 4 tries; nothing left resting")
await ex.close()
