// Simulates (eth_call only, nothing is sent) placeOrderFor edge cases from the linked bot key for the owner,
// and prints the named revert or the returned (success, orderId).
//   node --env-file=../.env edge-sims.ts [BASE]
import { SomniaMarkets, contractErrorsAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { BaseError, ContractFunctionRevertedError, createPublicClient, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "BTC"
const ABI = [
  ...parseAbi(["function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)"]),
  ...contractErrorsAbi,
] as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))

const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
await ex.loadMarkets()
const book = await ex.fetchOrderBook(`${base}/USDso:USDso`, 1)
const pool = m.poolAddress as `0x${string}`
const tick = BigInt(m.tickSize), lot = BigInt(m.lotSize), minQ = BigInt(m.minQuantity)
const P = (h: number | string) => (parseUnits(String(h), 18) / tick) * tick
const bestBid = P(book.bids[0][0]), bestAsk = P(book.asks[0][0])
const rest = (bestBid * 95n) / 100n / tick * tick // 5% under the bid: rests, inside a 10%+ band
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const future = BigInt(Math.floor(Date.now() / 1000) + 86400) * 1_000_000_000n
const ZERO = "0x0000000000000000000000000000000000000000" as const

type Case = { name: string; isBid: boolean; price: bigint; qty: bigint; type?: number; expire?: bigint; builder?: `0x${string}`; fee?: bigint; value?: bigint }
const cases: Case[] = [
  { name: "baseline: min qty bid 5% under bid (LIMIT)", isBid: true, price: rest, qty: minQ },
  { name: "qty 0", isBid: true, price: rest, qty: 0n },
  { name: "qty = min - 1 lot", isBid: true, price: rest, qty: minQ - lot },
  { name: "qty off lot grid (min + 1 raw)", isBid: true, price: rest, qty: minQ + 1n },
  { name: "price off tick grid (+1 raw)", isBid: true, price: rest + 1n, qty: minQ },
  { name: "price 0", isBid: true, price: 0n, qty: minQ },
  { name: "price 1 tick", isBid: true, price: tick, qty: minQ },
  { name: "bid 50% under the book", isBid: true, price: bestBid / 2n / tick * tick, qty: minQ },
  { name: "ask 2x over the book", isBid: false, price: bestAsk * 2n, qty: minQ },
  { name: "qty 18-decimals for 0.001 (docs' scale mistake)", isBid: true, price: rest, qty: parseUnits("0.001", 18) / lot * lot },
  { name: "huge qty (maxPositionSize + lot)", isBid: true, price: rest, qty: 0n },
  { name: "POST_ONLY bid at best ask (would cross)", isBid: true, price: bestAsk, qty: minQ, type: 3 },
  { name: "FOK bid 100 BTC-equivalent at best ask", isBid: true, price: bestAsk, qty: minQ * 1000n, type: 1 },
  { name: "expire in the past (1s after epoch)", isBid: true, price: rest, qty: minQ, expire: 1_000_000_000n },
  { name: "expire 0", isBid: true, price: rest, qty: minQ, expire: 0n },
  { name: "orderType 4 (out of enum)", isBid: true, price: rest, qty: minQ, type: 4 },
  { name: "builder fee without approval", isBid: true, price: rest, qty: minQ, builder: bot.address, fee: 1000n },
  { name: "msg.value 1 wei on a limit order", isBid: true, price: rest, qty: minQ, value: 1n },
]
const risk = await ex.client.getPerpRiskParams(pool)
cases.find((c) => c.name.startsWith("huge"))!.qty = risk.maxPositionSize + lot

console.log(`${base} pool ${pool} tick ${tick} lot ${lot} min ${minQ} bestBid ${bestBid} bestAsk ${bestAsk} block ${await pub.getBlockNumber()}`)
for (const c of cases) {
  try {
    const { result } = await pub.simulateContract({
      address: pool, abi: ABI, functionName: "placeOrderFor", account: bot, gas: 10_000_000n, value: c.value ?? 0n,
      args: [OWNER, c.isBid, 0n, c.price, c.qty, c.expire ?? future, c.type ?? 0, 0, c.builder ?? ZERO, c.fee ?? 0n],
    })
    console.log(`OK     ${c.name} -> ${j(result)}`)
  } catch (e) {
    let msg = String(e)
    if (e instanceof BaseError) {
      const r = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null
      msg = r ? `${r.data?.errorName ?? r.signature ?? "?"}(${j(r.data?.args ?? [])})${r.reason ? " reason=" + r.reason : ""}` : e.shortMessage
    }
    console.log(`REVERT ${c.name} -> ${msg}`)
  }
  await new Promise((s) => setTimeout(s, 250))
}
await ex.close()
