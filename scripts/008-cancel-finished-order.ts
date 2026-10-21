// eth_call only: what cancelOrderFor / reduceOrderFor / cancelOrder return for orders that already
// filled or were cancelled, next to getOrder for the same ids. Nothing is sent.
//   node --env-file=../.env 008-cancel-finished-order.ts
// Without BOT_PRIVATE_KEY the operator calls are simulated from the owner address instead.
import { contractErrorsAbi } from "@somnia-chain/markets-sdk"
import { ContractFunctionRevertedError, createPublicClient, http, parseAbi } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const BTC = "0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0" as const
const ZEC = "0x2a73129f26917124bd2a47a9b355c395c537f050" as const
// Finished orders of OWNER (indexer status in brackets)
const ORDERS: [string, `0x${string}`, bigint][] = [
  ["ZEC IOC buy, tx 0xb49fa126… [Filled]", ZEC, 129127208515968813332n],
  ["ZEC IOC sell, tx 0xc2b97fb2… [Filled]", ZEC, 129127208515968813374n],
  ["BTC limit bid, tx 0xd9c2c933… [Cancelled]", BTC, 7950546695768823436260n],
  ["BTC limit bid, tx 0xd75d279a… [Cancelled]", BTC, 15052543164147000809223n],
]
const ABI = [
  ...parseAbi([
    "function cancelOrderFor(address owner, uint128 orderId)",
    "function reduceOrderFor(address owner, uint128 orderId, uint256 newQuantityRemaining)",
    "function cancelOrder(uint128 orderId)",
    "function getOrder(uint128 orderId) view returns ((uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs))",
  ]),
  ...contractErrorsAbi,
] as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const pub = createPublicClient({ transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const operator = process.env.BOT_PRIVATE_KEY ? privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`).address : OWNER

async function call(pool: `0x${string}`, functionName: string, args: unknown[], account: `0x${string}`) {
  try {
    const { result } = await pub.simulateContract({ address: pool, abi: ABI, functionName: functionName as never, args: args as never, account })
    return `OK ${j(result)}`
  } catch (e: any) {
    const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | undefined
    return `revert ${r?.data?.errorName ?? "?"}(${j(r?.data?.args ?? [])})`
  }
}

console.log(`block ${await pub.getBlockNumber()}, operator ${operator}, owner ${OWNER}`)
for (const [label, pool, id] of ORDERS) {
  console.log(`\n${label} id ${id}`)
  console.log(`  getOrder(id)                 -> ${await call(pool, "getOrder", [id], OWNER)}`)
  console.log(`  cancelOrderFor(owner, id)    -> ${await call(pool, "cancelOrderFor", [OWNER, id], operator)}`)
  console.log(`  reduceOrderFor(owner, id, 0) -> ${await call(pool, "reduceOrderFor", [OWNER, id, 0n], operator)}`)
  console.log(`  cancelOrder(id) as owner     -> ${await call(pool, "cancelOrder", [id], OWNER)}`)
}
