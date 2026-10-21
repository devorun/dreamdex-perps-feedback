// Simulation only (eth_call from the owner address; nothing is signed or sent): Margin & Liquidations page claims.
//  - "Your leverage setting can't be changed while [the voucher] remains."
//  - "It can't be withdrawn. Only USDso above the voucher balance can leave the Perps account."
//  - Margin modes: cross default, isolated confines the account to one market.
import { SomniaMarkets, contractErrorsAbi, marginBankWriteAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { ContractFunctionRevertedError, createPublicClient, http, parseAbi } from "viem"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const MB = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394" as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const pub = createPublicClient({ transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const ABI = [...(marginBankWriteAbi as any), ...contractErrorsAbi, ...parseAbi([
  "function getMaxLeverage(address account, address perpPool) view returns (uint16)",
  "function getMaxLeverageLimit() view returns (uint16)",
  "function isolated(address account) view returns (bool)",
])] as const
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const perps = await ex.client.listPerpMarkets()
const eth = perps.find((m) => m.baseSymbol === "ETH")!
const blockNumber = await pub.getBlockNumber()
const sim = async (label: string, functionName: string, args: unknown[], from: `0x${string}` = OWNER) => {
  try { const { result } = await pub.simulateContract({ address: MB, abi: ABI as any, functionName, args, account: from, blockNumber }); console.log(`OK     ${label} -> ${j(result)}`) }
  catch (e: any) { const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError); console.log(`REVERT ${label} -> ${r?.data?.errorName ?? r?.signature ?? e.shortMessage}(${j(r?.data?.args ?? [])})`) }
}
const read = (fn: string, args: unknown[] = []) => pub.readContract({ address: MB, abi: ABI as any, functionName: fn, args, blockNumber })
console.log(`block ${blockNumber}`)
console.log("voucher", j(await ex.client.getPerpVoucher(MB, OWNER)), "| account", j(await ex.client.getMarginAccount(MB, OWNER)))
console.log("getMaxLeverage(owner, ETH)", await read("getMaxLeverage", [OWNER, eth.poolAddress]), "| getMaxLeverageLimit", await read("getMaxLeverageLimit"), "| isolated(owner)", await read("isolated", [OWNER]))
for (const x of [2, 5, 10, 20]) await sim(`setMaxLeverage(ETH, ${x}) as owner (voucher account)`, "setMaxLeverage", [eth.poolAddress, x])
await sim("withdraw(1 wei) as owner (voucher account)", "withdraw", [1n])
await sim("withdraw(0) as owner", "withdraw", [0n])
// Control: an address with no voucher and no balance
const CONTROL = "0x29cF993A7c66d2Af212EEE430F120750023e8892" as const
await sim("setMaxLeverage(ETH, 5) as a non-voucher address (control)", "setMaxLeverage", [eth.poolAddress, 5], CONTROL)
await sim("withdraw(1 wei) as a non-voucher empty address (control)", "withdraw", [1n], CONTROL)
await ex.close()
