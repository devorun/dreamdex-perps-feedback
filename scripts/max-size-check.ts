// Simulation only: getMaxPerpOrderSize's maxQuantity vs what placeOrderFor accepts (max, max + 1 lot), both sides.
import { SomniaMarkets, contractErrorsAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { ContractFunctionRevertedError, createPublicClient, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "ETH"
const ABI = [...parseAbi(["function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)"]), ...contractErrorsAbi] as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
await ex.loadMarkets()
const ob = await ex.fetchOrderBook(`${base}/USDso:USDso`, 1)
const tick = BigInt(m.tickSize), lot = BigInt(m.lotSize)
const al = (h: number) => (parseUnits(String(h), 18) / tick) * tick
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const expire = BigInt(Math.floor(Date.now() / 1000) + 86400) * 1_000_000_000n
const Z = "0x0000000000000000000000000000000000000000" as const
for (const [isBid, price, label] of [[true, al(ob.bids[0][0]), "bid @ best bid"], [false, al(ob.asks[0][0]), "ask @ best ask"], [false, al(ob.asks[0][0] * 1.03), "ask 3% over"], [true, al(ob.bids[0][0] * 0.97), "bid 3% under"]] as const) {
  const max = await ex.client.getMaxPerpOrderSize({ pool: m.poolAddress, marginBank: m.marginBank, account: OWNER, isBid, price })
  const blockNumber = max.asOfBlock // simulate on the exact block the SDK read
  const ok = async (q: bigint) => {
    try { await pub.simulateContract({ address: m.poolAddress as `0x${string}`, abi: ABI, functionName: "placeOrderFor", args: [OWNER, isBid, 0n, price, q, expire, 3, 0, Z, 0n], account: bot, gas: 10_000_000n, blockNumber }); return true }
    catch { return false }
  }
  // largest lot-aligned quantity the pool accepts at this block (binary search up to 4x the SDK max)
  let lo = max.maxQuantity / lot, hi = (max.maxQuantity * 4n) / lot
  if (!(await ok(lo * lot))) { console.log(`${label}: SDK max ${max.maxQuantity} itself rejected at block ${blockNumber}`); continue }
  while (hi - lo > 1n) { const mid = (lo + hi) / 2n; if (await ok(mid * lot)) lo = mid; else hi = mid }
  const trueMax = lo * lot
  const pct = Number(((trueMax - max.maxQuantity) * 100000n) / max.maxQuantity) / 1000
  console.log(`${label}: price ${price} block ${blockNumber} | SDK maxQuantity ${max.maxQuantity} (limitedBy ${max.limitedBy}) | pool accepts up to ${trueMax} | gap ${trueMax - max.maxQuantity} (${pct}%)`)
}
await ex.close()
