// Reads the LiquidationEngine's registered backstop bidders with plain viem (no SDK).
import { createPublicClient, http, parseAbi } from "viem"
const ENGINE = "0xA66d3C24Ad4a389d863846905D8173e1017e9F4D" // LiquidationEngine from the developer docs' contracts table
const pub = createPublicClient({ transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const abi = parseAbi(["function getBidderCount() view returns (uint256)", "function getBidders() view returns (address[])"])
const blockNumber = await pub.getBlockNumber()
const count = await pub.readContract({ address: ENGINE, abi, functionName: "getBidderCount", blockNumber })
const bidders = await pub.readContract({ address: ENGINE, abi, functionName: "getBidders", blockNumber })
console.log(`block ${blockNumber}: getBidderCount() = ${count}, getBidders() = ${JSON.stringify(bidders)}`)
for (const b of bidders) console.log(`  ${b}: code ${(((await pub.getCode({ address: b })) ?? "0x").length - 2) / 2} bytes, nonce ${await pub.getTransactionCount({ address: b })}`)
